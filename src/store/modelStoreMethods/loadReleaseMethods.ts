/**
 * loadReleaseMethods — ModelStore 加载/释放生命周期方法组（models 域拆分 · R3-P5，风险最高）
 *
 * 「加载域」自 ModelStore.ts 原样迁出（行为零变化）：四组内存安全不变式——
 * contextOperationMutex 串行化、last-one-wins（pendingModelId）、
 * Stop-Await-Release（释放前停流并等待活跃 completion）、benchmark 独占模式
 * （initLlama 调用签名不动，迁出的只是编排壳）。外加自动释放管理族
 * （前后台状态机）、模型路径解析族与初始化后的能力回写。
 * 挂载方式见 projectionMethods.ts 头注；constructor setCallbacks / engineMutex.register
 * 留 facade。private 字段 autoReleaseDisabledReasons / activeCompletionPromise /
 * contextOperationMutex / pendingModelId 由 facade 公开化供本组读取（接受）。
 */
import {AppState, AppStateStatus, Platform, Alert} from 'react-native';
import {runInAction, toJS} from 'mobx';
import * as RNFS from '@dr.pogodin/react-native-fs';
import {LlamaContext, initLlama} from 'llama.rn';

import type {modelStore as modelStoreInstance} from '../ModelStore';
import {serverStore} from '../ServerStore';
import {chatSessionStore} from '../ChatSessionStore';
import {uiStore} from '../UIStore';
import {engineMutex} from '../engineMutex';
import {nightTaskRegistry} from '../nightTaskRegistry';
import {chatEngineGuard} from '../../utils/engineGuard';
import {
  CompletionParams,
  toApiCompletionParams,
} from '../../utils/completionTypes';
import {
  LocalCompletionEngine,
  OpenAICompletionEngine,
} from '../../api/completionEngines';
import {Model, ModelOrigin} from '../../utils/types';
import {resolveModelCaps} from '../../utils/modelCaps';
import type {ModelCapabilityView} from '../../utils/modelCaps';
import {capsMatchBinding} from '../../utils/remoteCaps';
import {hasEnoughMemory} from '../../hooks/useMemoryCheck';
import {isHighEndDevice} from '../../utils/deviceCapabilities';
import {getModelMemoryRequirement} from '../../utils/memoryEstimator';
import {
  detectThinkingCapability,
  detectReasoningReinject,
} from '../../utils/thinkingCapabilityDetection';
import {createErrorState} from '../../utils/errors';
import {createContextInitParams} from '../../utils/contextInitParamsVersions';
import NativeHardwareInfo from '../../specs/NativeHardwareInfo';
import {DEFAULT_MODELS_DIR} from '../../utils/paths';
import {inferRepoFromModelId} from '../../utils';
import {downloadManager} from '../../services/downloads';
import {stops} from '../../utils/chat';
import {chatSessionRepository} from '../../repositories/ChatSessionRepository';

/** ModelStore 实例类型（类未导出，从单例推导；type-only import 无运行时环） */
type ModelStore = typeof modelStoreInstance;

export function applyLoadReleaseMethods(store: ModelStore): void {
  /**
   * Determines whether multimodal (vision) should be enabled for a model load.
   *
   * Resolves multimodal config: enables vision if model supports it and a projection
   * model is available (explicit path or downloaded default).
   *
   * @returns
   * - isMultimodalInit: true if we should initialize with vision support
   * - resolvedMmProjPath: file path to the projection model (only if isMultimodalInit=true)
   * - projectionModel: the Model object for the projection (only when auto-resolved from defaults)
   *
   * Note: This is a read-only operation safe to call outside the mutex.
   */
  store.resolveMultimodalConfig = async (
    model: Model,
    mmProjPath?: string,
  ): Promise<{
    isMultimodalInit: boolean;
    resolvedMmProjPath?: string;
    projectionModel?: Model;
  }> => {
    const visionEnabled = store.getModelVisionPreference(model);

    // Priority 1: Explicit path provided by caller
    if (mmProjPath && visionEnabled) {
      return {isMultimodalInit: true, resolvedMmProjPath: mmProjPath};
    }

    // Priority 2: Auto-resolve from model's default projection model
    if (
      model.supportsMultimodal &&
      model.defaultProjectionModel &&
      visionEnabled
    ) {
      const projectionModel = store.models.find(
        m => m.id === model.defaultProjectionModel,
      );
      if (projectionModel?.isDownloaded) {
        const resolvedPath = await store.getModelFullPath(projectionModel);
        return {
          isMultimodalInit: true,
          resolvedMmProjPath: resolvedPath,
          projectionModel,
        };
      }
    }

    // Default: No multimodal support
    return {isMultimodalInit: false};
  };

  /**
   * Check memory/capability requirements and show warning alert if needed.
   * Returns true if user confirms or no warning needed, false if cancelled.
   */
  store.checkMemoryAndConfirm = async (
    model: Model,
    isMultimodalInit: boolean,
    projectionModel?: Model,
  ): Promise<boolean> => {
    let hasMemory = true;
    try {
      hasMemory = await hasEnoughMemory(model, projectionModel);
    } catch (error) {
      console.error('Memory check failed:', error);
      return false;
    }

    const isCapable = isMultimodalInit ? await isHighEndDevice() : true;
    const hasMemoryIssue = !hasMemory;
    const hasCapabilityIssue = isMultimodalInit && !isCapable;

    if (!hasMemoryIssue && !hasCapabilityIssue) {
      return true; // No warning needed
    }

    console.warn(
      `Device performance warning for model: ${model.name} - Memory: ${hasMemoryIssue}, Capability: ${hasCapabilityIssue}`,
    );

    let title: string;
    let message: string;

    if (hasMemoryIssue && hasCapabilityIssue) {
      title = uiStore.l10n.memory.alerts.combinedWarningTitle;
      message = uiStore.l10n.memory.alerts.combinedWarningMessage;
    } else if (hasMemoryIssue) {
      title = uiStore.l10n.memory.alerts.memoryWarningTitle;
      message = uiStore.l10n.memory.alerts.memoryWarningMessage;
    } else {
      title = uiStore.l10n.memory.alerts.multimodalWarningTitle;
      message = uiStore.l10n.memory.alerts.multimodalWarningMessage;
    }

    // Show alert and wait for user decision - this happens OUTSIDE the mutex
    return new Promise<boolean>(resolve => {
      Alert.alert(title, message, [
        {
          text: uiStore.l10n.memory.alerts.cancel,
          style: 'cancel',
          onPress: () => resolve(false),
        },
        {
          text: uiStore.l10n.memory.alerts.continue,
          onPress: () => resolve(true),
        },
      ]);
    });
  };

  /**
   * Take exclusive ownership of the native context for the e2e benchmark
   * runner. Sets `benchmarkActive` synchronously so any new auto-load is
   * gated, then drains the mutex (in case one is already in flight) and
   * releases whatever context exists. After this resolves, the runner can
   * safely call `initLlama` directly without racing the rest of the app.
   *
   * Pairs with `exitBenchmarkMode()`. The runner MUST call exit even on
   * failure paths or chat / header / sheet inits will stay rejected.
   */
  store.enterBenchmarkMode = async (): Promise<void> => {
    runInAction(() => {
      store.benchmarkActive = true;
    });

    const op = store.contextOperationMutex.then(async () => {
      // Release any context the rest of the app loaded (e.g. ChatView's
      // auto-load on cold launch). clearActiveModel:true so the queued
      // post-mutex callers see a clean slate if they ever run.
      await store._releaseContextInternal(true);
    });
    store.contextOperationMutex = op.then(() => {}).catch(() => {});
    await op;
  };

  /**
   * Hand context ownership back to the rest of the app. Intentionally
   * trivial — no native work — so it's safe to call from a `finally` block.
   */
  store.exitBenchmarkMode = (): void => {
    runInAction(() => {
      store.benchmarkActive = false;
    });
  };

  /**
   * Initialize a model context, optionally with multimodal support.
   *
   * Architecture:
   * - Phase 1 (outside mutex): Resolve config, check memory, show alert if needed
   * - Phase 2 (inside mutex): Release old context, load new context
   *
   * The "last-one-wins" pattern uses pendingModelId set at the START, then checked
   * both after the Alert (to skip if superseded) and inside the mutex (final check).
   * Note: "last-one-wins" not always loading the last tapped model, but it's ok, as
   * long as it is not leading the deadlock or mem leak.
   *
   * @param model The main LLM model to initialize
   * @param mmProjPath Optional path to a projection model for multimodal support
   * @returns The initialized LlamaContext, or null if cancelled/skipped
   */
  store.initContext = async (model: Model, mmProjPath?: string) => {
    // Benchmark mode owns the native context lifecycle end-to-end.
    // Reject synchronously so any racing caller (ChatView auto-load, header,
    // sheet) fails fast instead of silently shadowing the matrix's per-cell
    // devices / n_gpu_layers via the "already loaded → skip" path.
    if (store.benchmarkActive) {
      throw new Error(
        '[ModelStore] initContext rejected: benchmark mode is active',
      );
    }

    // === Phase 1: Pre-flight checks OUTSIDE mutex ===

    // Mark intent immediately - this is the "last-one-wins" tracking
    // If another model is requested while we're showing an Alert, their
    // pendingModelId will overwrite ours and we'll detect it later
    store.pendingModelId = model.id;

    // Set loading state immediately for UI feedback
    runInAction(() => {
      store.isContextLoading = true;
      store.loadingModel = model;
    });

    try {
      // Resolve multimodal configuration
      const {isMultimodalInit, resolvedMmProjPath, projectionModel} =
        await store.resolveMultimodalConfig(model, mmProjPath);

      // Check memory and get user confirmation if needed (no mutex - UI interaction)
      const shouldProceed = await store.checkMemoryAndConfirm(
        model,
        isMultimodalInit,
        projectionModel,
      );

      if (!shouldProceed) {
        throw new Error('Model loading cancelled by user');
      }

      // After Alert (if shown), check if we're still the intended model
      // Another model request might have come in while user was deciding
      if (store.pendingModelId !== model.id) {
        console.log(
          `[ModelStore] Skipping "${model.name}" - user switched to "${store.pendingModelId}" during confirmation`,
        );
        return null;
      }

      // === Phase 2: Execute context operations WITH mutex ===

      const operationPromise = store.contextOperationMutex.then(async () => {
        // A benchmark may have started while this load sat in the mutex
        // queue (cold-launch deep-link race). Bail before doing native work
        // — enterBenchmarkMode will release any context we leave behind.
        if (store.benchmarkActive) {
          console.log(
            `[ModelStore] Skipping queued load for "${model.name}" - benchmark mode is active`,
          );
          return null;
        }

        // Final check if this request is still current (last-one-wins)
        // This catches race conditions where another request queued while we waited
        if (store.pendingModelId !== model.id) {
          console.log(
            `[ModelStore] Skipping outdated load for "${model.name}" - user now wants model "${store.pendingModelId}"`,
          );
          return null;
        }

        // Skip if already loaded
        if (store.activeModelId === model.id && store.context) {
          console.log(
            `[ModelStore] Model "${model.name}" is already loaded, skipping`,
          );
          return store.context;
        }

        // Release existing context
        // 互斥：换 chat 模型前先释放 sd 引擎（engineMutex 自动调 imageGenStore.unloadModel）
        await engineMutex.acquire('chat');
        await store._releaseContextInternal();

        // Small delay for native cleanup before loading next model
        await new Promise(resolve => setTimeout(resolve, 100));

        // Proceed with actual initialization
        return store.proceedWithInitialization(
          model,
          resolvedMmProjPath,
          isMultimodalInit,
          projectionModel,
        );
      });

      // Keep mutex chain intact by swallowing errors
      store.contextOperationMutex = operationPromise
        .then(() => {})
        .catch(() => {});

      return await operationPromise;
    } finally {
      runInAction(() => {
        store.isContextLoading = false;
        store.loadingModel = undefined;
      });
    }
  };

  /**
   * Proceed with the actual model initialization after device capability checks
   */
  store.proceedWithInitialization = async (
    model: Model,
    mmProjPath?: string,
    isMultimodalInit: boolean = false,
    projectionModel?: Model,
  ): Promise<LlamaContext> => {
    const filePath = await store.getModelFullPath(model);
    if (!filePath) {
      throw new Error('Model path is undefined');
    }

    runInAction(() => {
      store.isMultimodalActive = false; // Reset until we confirm it's enabled
      store.activeProjectionModelId = projectionModel?.id;
    });

    // §18.6 每模型预调：无覆盖时按内存 ceiling 预写最大可装档（一次预调、
    // 持久化），赶在 getEffectiveContextInitParams 读取之前。
    store.presetModelNCtxIfAbsent(model, projectionModel);

    // Get all effective initialization settings BEFORE try block
    // so they're available for error reporting if initialization fails
    const effectiveSettings = await store.getEffectiveContextInitParams(
      filePath,
      model.id,
    );

    try {
      // Create properly versioned ContextInitParams
      const contextInitParams = createContextInitParams(effectiveSettings);

      const t0 = Date.now();
      const ctx = await initLlama(
        {
          model: filePath,
          ...effectiveSettings, // Use effectiveSettings without version for llama.rn
          use_progress_callback: true,
        },
        (_progress: number) => {
          //console.log('progress: ', _progress);
        },
      );
      const t1 = Date.now();
      console.log('init time: ', t1 - t0);

      await store.updateModelStopTokens(ctx, model);

      // Check and update thinking capabilities
      await store.updateModelThinkingCapabilities(ctx, model);

      // Initialize multimodal support if mmproj path was provided
      if (isMultimodalInit && mmProjPath) {
        try {
          console.log('Initializing multimodal support with path:', mmProjPath);

          // Initialize multimodal with the new API format
          // Apply effective value: clamp image_max_tokens to n_ctx
          const success = await ctx.initMultimodal({
            path: mmProjPath,
            use_gpu: !store.contextInitParams.no_gpu_devices,
            image_max_tokens: Math.min(
              store.contextInitParams.image_max_tokens ?? 512,
              store.contextInitParams.n_ctx,
            ),
          });

          if (!success) {
            console.error('Failed to initialize multimodal support');
          } else {
            console.log('Multimodal support initialized successfully');
            // Verify that multimodal is now enabled
            const isEnabled = await ctx.isMultimodalEnabled();
            console.log('Multimodal enabled status:', isEnabled);

            // Update the multimodal active flag
            runInAction(() => {
              store.isMultimodalActive = isEnabled;
            });
          }
        } catch (error) {
          console.error('Error initializing multimodal support:', error);
          runInAction(() => {
            store.isMultimodalActive = false;
            store.activeProjectionModelId = undefined;
          });
        }
      }

      runInAction(() => {
        store.context = ctx;
        store.engine = new LocalCompletionEngine(ctx);
        store.activeRemoteBinding = undefined;
        store.activeContextSettings = contextInitParams;
        store.setActiveModel(model.id);
        store.pendingModelId = null;
      });

      // Update largestSuccessfulLoad using GGUF estimator
      try {
        const estimated = getModelMemoryRequirement(
          model,
          projectionModel,
          contextInitParams,
        );
        runInAction(() => {
          if (
            store.largestSuccessfulLoad === undefined ||
            estimated > store.largestSuccessfulLoad
          ) {
            store.largestSuccessfulLoad = estimated;
          }
        });
      } catch (error) {
        console.warn(
          '[ModelStore] Failed to update largestSuccessfulLoad:',
          error,
        );
      }

      return ctx;
    } catch (error) {
      console.error(
        `Failed to initialize model context for "${model.name}" (${model.id}):`,
        error,
      );

      // Set error state for UI feedback - include model info and context params for error reporting
      const errorState = createErrorState(error, 'modelInit', undefined, {
        modelId: model.id,
        modelName: model.name,
        modelUrl: model.hfUrl,
        modelSize: model.size,
        contextParams: effectiveSettings,
      });
      runInAction(() => {
        store.modelLoadError = errorState;
      });

      throw error;
    } finally {
      runInAction(() => {
        store.lastUsedModelId = model.id;
      });
    }
  };

  /** Internal release - caller must already hold the mutex. */
  store._releaseContextInternal = async (clearActiveModel: boolean = false) => {
    console.log('attempt to release');
    chatSessionStore.exitEditMode();
    if (!store.context) {
      // For remote models or deletion scenarios, clear engine and state
      if (store.engine || clearActiveModel) {
        // Stop any active remote completion
        if (store.engine) {
          try {
            await store.engine.stopCompletion();
          } catch {
            // Ignore errors from stopping remote completion
          }
        }
        runInAction(() => {
          store.engine = undefined;
          store.activeRemoteBinding = undefined;
          if (clearActiveModel) {
            store.activeModelId = undefined;
          }
          store.isMultimodalActive = false;
          store.activeProjectionModelId = undefined;
        });
      }
      if (!store.engine && !clearActiveModel) {
        return 'No context to release';
      }
      return 'Remote engine cleared';
    }

    try {
      // IMPORTANT: Stop-Await-Release Pattern
      // This prevents race condition where completion callback fires after context is freed
      // which causes SIGSEGV in isMultimodalEnabled/createCompletionResult
      if (
        store.inferencing ||
        store.isStreaming ||
        store.activeCompletionPromise
      ) {
        console.log('Stopping active completion before context release');

        // Step 1: Signal the completion to stop
        try {
          await store.context.stopCompletion();
        } catch (stopError) {
          console.warn('Error stopping completion:', stopError);
          // Continue with release even if stop fails
        }

        // Step 2: Wait for the completion promise to actually finish
        // This is critical - stopCompletion() only signals, it doesn't wait
        if (store.activeCompletionPromise) {
          console.log('Waiting for completion promise to finish...');
          try {
            // Wait for promise to settle (ignore errors, just wait for it to complete)
            await store.activeCompletionPromise.catch(() => {});
          } catch {
            // Ignore any errors, we just need to wait
          }
          store.activeCompletionPromise = null;
        }

        // Clear inference flags
        runInAction(() => {
          store.inferencing = false;
          store.isStreaming = false;
        });
      }

      // Step 3: Now safe to release - First check if multimodal is enabled and release it if needed
      if (store.isMultimodalActive) {
        console.log('Releasing multimodal context first');
        try {
          await store.context.releaseMultimodal();
          // Immediately clear multimodal state after successful release
          runInAction(() => {
            store.isMultimodalActive = false;
            store.activeProjectionModelId = undefined;
          });
          console.log('Multimodal context released and state cleared');
        } catch (error) {
          console.error('Error releasing multimodal context:', error);
          // Even if release fails, clear the state to prevent blocking deletion
          runInAction(() => {
            store.isMultimodalActive = false;
            store.activeProjectionModelId = undefined;
          });
        }
      }

      // Then release the main context
      await store.context.release();
      console.log('released');
    } catch (error) {
      console.error('Error during context release:', error);
    } finally {
      runInAction(() => {
        store.context = undefined;
        store.engine = undefined;
        store.activeRemoteBinding = undefined;
        store.activeContextSettings = undefined;
        // Ensure multimodal state is cleared even if something went wrong above
        store.isMultimodalActive = false;
        store.activeProjectionModelId = undefined;
        // Clear active model if requested (for deletion scenarios)
        if (clearActiveModel) {
          store.activeModelId = undefined;
        }
      });

      // Update availableMemoryCeiling after release (clean state)
      try {
        const availableBytes = await NativeHardwareInfo.getAvailableMemory();
        runInAction(() => {
          if (
            store.availableMemoryCeiling === undefined ||
            availableBytes > store.availableMemoryCeiling
          ) {
            store.availableMemoryCeiling = availableBytes;
          }
        });
      } catch (error) {
        console.warn(
          '[ModelStore] Failed to update availableMemoryCeiling:',
          error,
        );
      }
    }
    return 'Context released successfully';
  };

  /** Acquires mutex before releasing context. */
  store.releaseContext = async (clearActiveModel: boolean = false) => {
    const operationPromise = store.contextOperationMutex.then(async () => {
      return store._releaseContextInternal(clearActiveModel);
    });

    // Swallow errors to keep mutex chain intact
    store.contextOperationMutex = operationPromise
      .then(() => {})
      .catch(() => {});

    await operationPromise.catch(() => {});
    engineMutex.release();
    return operationPromise;
  };

  store.manualReleaseContext = async () => {
    await store.releaseContext(true); // Clear active model for manual release
  };

  store.reinitializeContext = async () => {
    if (store.activeModelId) {
      const model = store.models.find(m => m.id === store.activeModelId);
      if (model) {
        await store.initContext(model);
      }
    }
  };

  store.setActiveModel = (modelId: string) => {
    store.activeModelId = modelId;
  };

  /**
   * Set a remote model as the active model and create an OpenAI completion engine.
   * Releases any active local context first.
   */
  store.setRemoteModel = async (model: Model): Promise<void> => {
    if (!model.serverId || !model.remoteModelId) {
      throw new Error('Model is missing remote configuration');
    }

    // Release any existing context (local or remote)
    await store.releaseContext();

    const apiKey = await serverStore.getApiKey(model.serverId);
    const server = serverStore.servers.find(s => s.id === model.serverId);
    if (!server) {
      throw new Error('Server not found');
    }

    runInAction(() => {
      store.engine = new OpenAICompletionEngine(
        server.url,
        model.remoteModelId!,
        apiKey,
        server.requestTimeoutMs,
        server.serverType,
      );
      store.activeRemoteBinding = {
        modelId: model.id,
        serverId: model.serverId!,
        remoteModelId: model.remoteModelId!,
        url: server.url,
        serverType: server.serverType,
      };
      store.setActiveModel(model.id);
      // Do NOT set lastUsedModelId for remote models -- server may be offline on next launch
    });

    serverStore
      .fetchRemoteModelCaps(model.serverId, model.remoteModelId, apiKey)
      .catch(() => {});
  };

  /**
   * Public method that routes model selection to the appropriate handler.
   * All callsites should use selectModel() instead of initContext() directly.
   * - Remote models: calls setRemoteModel()
   * - Local models: calls initContext()
   */
  store.selectModel = async (model: Model): Promise<void> => {
    if (model.origin === ModelOrigin.REMOTE) {
      await store.setRemoteModel(model);
    } else {
      await store.initContext(model);
    }
  };

  /**
   * Capabilities of any model, active or not — the model card's entry point.
   * Never annotate it explicitly as `action`: that untracks the observable
   * reads, so every card would freeze on its first value while the suite
   * stayed green.
   */
  store.capsFor = (model: Model | undefined): ModelCapabilityView =>
    resolveModelCaps(model, store.capabilityEnv);

  /**
   * Updates stop tokens for a model based on its context and chat template
   * @param ctx - The LlamaContext instance
   * @param model - App model to update stop tokens for
   */
  store.updateModelStopTokens = async (ctx: LlamaContext, model: Model) => {
    const storeModel = store.models.find(m => m.id === model.id);
    if (!storeModel) {
      return;
    }

    const stopTokens: string[] = [];

    try {
      // Get EOS token from model metadata
      const eos_token_id = Number(
        (ctx.model as any)?.metadata?.['tokenizer.ggml.eos_token_id'],
      );

      if (!isNaN(eos_token_id)) {
        const detokenized = await ctx.detokenize([eos_token_id]);
        if (detokenized) {
          stopTokens.push(detokenized);
        }
      }

      // Add relevant stop tokens from chat templates
      // First check model's custom chat template.
      const template = storeModel.chatTemplate?.chatTemplate;
      console.log('template: ', template);
      if (template) {
        const templateStops = stops.filter(stop => template.includes(stop));
        stopTokens.push(...templateStops);
      }

      // Then check context's chat template
      const ctxtTemplate = (ctx.model as any)?.metadata?.[
        'tokenizer.chat_template'
      ];
      if (ctxtTemplate) {
        const contextStops = stops.filter(stop => ctxtTemplate.includes(stop));
        stopTokens.push(...contextStops);
      }

      console.log('stopTokens: ', stopTokens);
      // Only update if we found stop tokens
      if (stopTokens.length > 0) {
        runInAction(() => {
          // Helper function to check and update stop tokens
          const updateStopTokens = (words: CompletionParams['stop']) => {
            const uniqueStops = Array.from(
              new Set([...(words || []), ...stopTokens]),
            ).filter(Boolean); // Remove any null/undefined/empty values
            return uniqueStops;
          };

          // Update both default and current completion settings
          storeModel.defaultStopWords = updateStopTokens(
            storeModel.defaultStopWords,
          );
          storeModel.stopWords = updateStopTokens(storeModel.stopWords);
        });
      }
    } catch (error) {
      console.error('Error updating model stop tokens:', error);
      // Continue execution - stop token update is not critical
    }
  };

  /**
   * Update model thinking capabilities based on the loaded context
   */
  store.updateModelThinkingCapabilities = async (
    ctx: LlamaContext,
    model: Model,
  ) => {
    try {
      const storeModel = store.models.find(m => m.id === model.id);
      if (!storeModel) {
        return;
      }

      // Detection is the 'detected' writer; it must not override a user
      // declaration or a learned flip (precedence: user > learned > detected).
      if (
        storeModel.reasoning?.source === 'user' ||
        storeModel.reasoning?.source === 'learned'
      ) {
        return;
      }

      const result = await detectThinkingCapability(ctx);
      // Reasoning 回灌探针：能生成 ≠ 能回灌（Ministral 回灌即 Jinja 拒收）。
      const reinject = await detectReasoningReinject(ctx);

      runInAction(() => {
        // Keep the deprecated boolean + tags in sync for back-compat readers.
        storeModel.supportsThinking = result.supported;
        storeModel.reasoningReinject = reinject;
        if (result.thinkingStartTag) {
          storeModel.thinkingStartTag = result.thinkingStartTag;
        }
        if (result.thinkingEndTag) {
          storeModel.thinkingEndTag = result.thinkingEndTag;
        }
        storeModel.reasoning = {
          isReasoning: result.supported ? 'yes' : 'no',
          source: 'detected',
          supportsEffort: false,
          effortValues: [],
          effortSource: 'none',
        };
      });
    } catch (error) {
      console.error('Error updating model thinking capabilities:', error);
      // Continue execution - thinking capability detection is not critical
    }
  };

  /**
   * Starts a completion with one or more images
   * @param params - Completion parameters including image paths
   * @returns Promise<void>
   */
  store.startImageCompletion = async (params: {
    prompt: string;
    image_path?: string; // For backward compatibility
    image_paths?: string[]; // New parameter for multiple images
    systemMessage?: string;
    onToken?: (token: string) => void;
    onComplete?: (text: string) => void;
    onError?: (error: Error) => void;
  }): Promise<void> => {
    if (!store.context) {
      throw new Error('No model context available');
    }

    // Check if multimodal is enabled
    if (!store.isMultimodalActive) {
      throw new Error('Multimodal is not enabled for this model');
    }

    runInAction(() => {
      store.inferencing = true;
      store.isStreaming = false;
    });

    try {
      // Handle both single image_path and multiple image_paths
      let imagePaths: string[] = [];

      if (params.image_paths && params.image_paths.length > 0) {
        // Use the provided image_paths array
        imagePaths = [...params.image_paths];
      } else if (params.image_path) {
        // Backward compatibility: convert single image_path to array
        imagePaths = [params.image_path];
      }

      if (imagePaths.length === 0) {
        throw new Error('No images provided for multimodal completion');
      }

      // Process all image paths to handle file:// prefix
      const processedImagePaths = imagePaths.map(path =>
        path.startsWith('file://')
          ? Platform.OS === 'ios'
            ? path.substring(7) // iOS: remove 'file://'
            : path // Android: keep as is
          : path,
      );

      // Create a system message if provided
      const systemMessage = params.systemMessage?.trim()
        ? {
            role: 'system',
            content: params.systemMessage,
          }
        : undefined;

      // Create a user message with text and all images
      const userMessage = {
        role: 'user',
        content: [
          {
            type: 'text',
            text: params.prompt,
          },
          // Add all images to the content array
          ...processedImagePaths.map(path => ({
            type: 'image_url',
            image_url: {url: path},
          })),
        ],
      };

      // Start the completion
      runInAction(() => {
        store.isStreaming = true;
      });

      const completionParams =
        await chatSessionRepository.getGlobalCompletionSettings();
      const stopWords = toJS(store.activeModel?.stopWords);

      // Create completion params with app-specific properties
      const messages = systemMessage
        ? [systemMessage, userMessage]
        : [userMessage];
      const completionParamsWithAppProps = {
        ...completionParams,
        messages: messages,
        stop: stopWords,
      } as CompletionParams;

      // Strip app-specific properties before passing to llama.rn
      const cleanCompletionParams = toApiCompletionParams(
        completionParamsWithAppProps,
      );

      // Create the completion promise and register it for safe context release
      // （guard：串行化+冷却窗+重试，防冷却期 HostFunction 异常）
      const completionPromise = chatEngineGuard.run(() =>
        store.context!.completion(cleanCompletionParams, data => {
          if (data.token) {
            params.onToken?.(data.token);
          }
        }),
      );

      // Register the promise so releaseContext can wait for it
      store.registerCompletionPromise(completionPromise);

      const result = await completionPromise;

      // Clear the promise after completion finishes
      store.clearCompletionPromise();

      params.onComplete?.(result.text);
    } catch (error) {
      // Clear the promise on error too
      store.clearCompletionPromise();
      console.error('Error in multi-image completion:', error);
      params.onError?.(
        error instanceof Error ? error : new Error(String(error)),
      );
    } finally {
      runInAction(() => {
        store.inferencing = false;
        store.isStreaming = false;
      });
    }
  };

  store.setupAppStateListener = () => {
    AppState.addEventListener('change', store.handleAppStateChange);
  };

  // Auto-release management methods
  store.disableAutoRelease = (reason: string) => {
    store.autoReleaseDisabledReasons.add(reason);
    console.log(
      `Auto-release disabled: ${reason}`,
      Array.from(store.autoReleaseDisabledReasons),
    );
  };

  store.enableAutoRelease = (reason: string) => {
    store.autoReleaseDisabledReasons.delete(reason);
    console.log(
      `Auto-release enabled: ${reason}`,
      Array.from(store.autoReleaseDisabledReasons),
    );
  };

  store.markAutoReleased = (modelId: string) => {
    // Skip auto-release for remote models (no native context to release)
    const model = store.activeModel;
    if (model?.origin === ModelOrigin.REMOTE) {
      return;
    }
    console.log('Marking auto-released: ', modelId);
    runInAction(() => {
      store.wasAutoReleased = true;
      store.lastAutoReleasedModelId = modelId;
    });
  };

  store.clearAutoReleaseFlags = () => {
    console.log('Clearing auto-release flags');
    runInAction(() => {
      store.wasAutoReleased = false;
      store.lastAutoReleasedModelId = undefined;
    });
  };

  store.checkAndReloadAutoReleasedModel = async () => {
    if (store.wasAutoReleased && store.lastAutoReleasedModelId) {
      // Skip if the auto-released model ID refers to a remote model
      if (store.lastAutoReleasedModelId.includes('/')) {
        const remoteModel = store.remoteModels.find(
          m => m.id === store.lastAutoReleasedModelId,
        );
        if (remoteModel) {
          store.clearAutoReleaseFlags();
          return;
        }
      }
      const model = store.models.find(
        m => m.id === store.lastAutoReleasedModelId && m.isDownloaded,
      );
      if (model) {
        console.log('Reloading auto-released model:', model.id);
        await store.initContext(model);
      }
      store.clearAutoReleaseFlags();
    }
  };

  store.handleAppStateChange = async (nextAppState: AppStateStatus) => {
    console.log(`App state change: ${store.appState} → ${nextAppState}`);

    if (
      store.appState.match(/inactive|background/) &&
      nextAppState === 'active'
    ) {
      // Coming to foreground - check if we need to reload auto-released model
      await store.checkAndReloadAutoReleasedModel();
      store.reprobeRemoteCapsIfUnknown();
      // 授权返回后重扫（task-7c3e）：MANAGE 权限在系统设置页授予后回到 App，
      // 模型列表自动出现，无需重启。
      store.scanLocalModels();
      store.refreshCatalogImageGenStatus();
    } else if (store.appState === 'active' && nextAppState === 'inactive') {
      // active → inactive: NO action (per requirements)
      console.log('Active → Inactive: No auto-release action');
    } else if (store.appState === 'inactive' && nextAppState === 'background') {
      // inactive → background: release if enabled
      // Skip for remote models — no native context to release, and
      // releaseContext() would clear the engine with no reload path.
      // 夜间长任务模式（§7.1）：生图/视频任务进行中不释放——
      // releaseContext 会释放 image 引擎互斥槽，与长任务抢内存。
      if (
        store.isAutoReleaseEnabled &&
        store.activeModelId &&
        store.activeModel?.origin !== ModelOrigin.REMOTE &&
        !nightTaskRegistry.isBusy
      ) {
        console.log('Inactive → Background: Auto-releasing context');
        store.markAutoReleased(store.activeModelId);
        await store.releaseContext();
      } else if (nightTaskRegistry.isBusy) {
        console.log('Inactive → Background: night task active, keep context');
      }
    } else if (store.appState === 'active' && nextAppState === 'background') {
      // active → background: release if enabled (direct transition)
      // Skip for remote models — same reason as above.
      // 夜间长任务模式（§7.1）：同 inactive 分支，任务进行中不释放。
      if (
        store.isAutoReleaseEnabled &&
        store.activeModelId &&
        store.activeModel?.origin !== ModelOrigin.REMOTE &&
        !nightTaskRegistry.isBusy
      ) {
        console.log('Active → Background: Auto-releasing context');
        store.markAutoReleased(store.activeModelId);
        await store.releaseContext();
      } else if (nightTaskRegistry.isBusy) {
        console.log('Active → Background: night task active, keep context');
      }
    }

    runInAction(() => {
      store.appState = nextAppState;
    });
  };

  /**
   * Remote models are exempt from auto-release, so a session survives
   * backgrounding — but the capability probe behind it may not have: iOS can
   * tear the request down, and the first probe is the request that raises the
   * local-network prompt, so a grant always arrives after it already failed.
   * Without this, caps stay unknown for the rest of the session and the only
   * recovery is re-selecting the model by hand.
   *
   * Also skipped once the server record has been repointed away from that
   * backend: the probe would read a backend this session never talks to, and
   * it cannot produce caps this session could use. The next activation
   * rebuilds the binding and probes the url it is built from.
   */
  store.reprobeRemoteCapsIfUnknown = () => {
    const model = store.activeModel;
    if (
      model?.origin !== ModelOrigin.REMOTE ||
      !model.serverId ||
      !model.remoteModelId ||
      capsMatchBinding(
        serverStore.remoteCaps[model.id],
        store.activeRemoteBinding,
        model.id,
      )
    ) {
      return;
    }
    const binding = store.activeRemoteBinding;
    if (binding?.modelId === model.id) {
      const configuredUrl = serverStore.servers.find(
        s => s.id === model.serverId,
      )?.url;
      if (configuredUrl !== undefined && configuredUrl !== binding.url) {
        return;
      }
    }
    serverStore
      .fetchRemoteModelCaps(model.serverId, model.remoteModelId)
      .catch(() => {});
  };

  store.updateUseAutoRelease = (useAutoRelease: boolean) => {
    runInAction(() => {
      store.useAutoRelease = useAutoRelease;
    });
  };

  /**
   * Determines the full path for a model file on the device's storage.
   * This path is used for multiple purposes:
   * - As the destination path when downloading a model
   * - To check if a model is downloaded (by checking file existence at this path)
   * - To access the model file for operations like context initialization or deletion
   *
   * Path structure varies by model origin:
   * - LOCAL: Uses the model's fullPath property
   * - PRESET: Checks both legacy path (DocumentDirectoryPath/filename) and
   *          new path (DocumentDirectoryPath/models/preset/author/filename)
   * - HF: Uses DocumentDirectoryPath/models/hf/author/filename
   *
   * IMPORTANT: This logic is duplicated in native Swift code for iOS Shortcuts
   * See: ios/PocketPal/AppIntents/PalDataProvider.swift - parseModelPath() method
   * If we modify this function, we need to update the Swift version as well.
   *
   * @param model - The model object containing necessary metadata (origin, filename, author, etc.)
   * @returns Promise<string> - The full path where the model file is or should be stored
   * @throws Error if filename is undefined or if fullPath is undefined for local models
   */
  store.getModelFullPath = async (model: Model): Promise<string> => {
    // For local models, use the fullPath
    if (model.isLocal || model.origin === ModelOrigin.LOCAL) {
      if (!model.fullPath) {
        throw new Error('Full path is undefined for local model');
      }
      return model.fullPath;
    }

    if (!model.filename) {
      throw new Error('Model filename is undefined');
    }

    // For preset models, check both old and new paths
    if (model.origin === ModelOrigin.PRESET) {
      const author = model.author || 'unknown';
      const repo = model.repo || 'unknown';

      // Very old path (deprecated, for backwards compatibility)
      const veryOldPath = `${RNFS.DocumentDirectoryPath}/${model.filename}`;

      // Old path (deprecated, for backwards compatibility)
      const oldPath = `${RNFS.DocumentDirectoryPath}/models/preset/${author}/${model.filename}`;

      // New path: B15 双轨默认规范目录（ADR-0004），零权限、Play 合规
      const newPath = `${DEFAULT_MODELS_DIR}/preset/${author}/${repo}/${model.filename}`;

      // Check if file exists at very old path first (for backwards compatibility)
      try {
        if (await RNFS.exists(veryOldPath)) {
          return veryOldPath;
        }
      } catch (err) {
        console.log('Error checking very old preset path:', err);
      }

      // Check if file exists at old path (for backwards compatibility)
      try {
        if (await RNFS.exists(oldPath)) {
          return oldPath;
        }
      } catch (err) {
        console.log('Error checking old preset path:', err);
      }

      // Otherwise use new path
      return newPath;
    }

    // For HF models, use author/repo/model structure with backwards compatibility
    if (model.origin === ModelOrigin.HF) {
      const author = model.author || 'unknown';

      // Try to get repo from model, or infer from model.id, or fallback to 'unknown'
      let repo = model.repo;
      if (!repo) {
        repo = inferRepoFromModelId(model.id) || 'unknown';
      }

      // Old path structure (for backwards compatibility)
      const oldPath = `${RNFS.DocumentDirectoryPath}/models/hf/${author}/${model.filename}`;

      // New path: B15 双轨默认规范目录（ADR-0004），零权限、Play 合规
      const newPath = `${DEFAULT_MODELS_DIR}/hf/${author}/${repo}/${model.filename}`;

      // Check if file exists at old path (backwards compatibility)
      // This handles: existing downloads, models after reset, models after app update
      try {
        if (await RNFS.exists(oldPath)) {
          return oldPath;
        }
      } catch (err) {
        console.log('Error checking old HF model path:', err);
      }

      // Otherwise use new path
      return newPath;
    }

    // Fallback (shouldn't reach here)
    console.error('should not reach here. model: ', model);
    return `${RNFS.DocumentDirectoryPath}/${model.filename}`;
  };

  store.checkFileExists = async (model: Model) => {
    const filePath = await store.getModelFullPath(model);
    const exists = await RNFS.exists(filePath);

    // Don't mark as downloaded if currently downloading
    if (exists && !downloadManager.isDownloading(model.id)) {
      if (!model.isDownloaded) {
        console.log(
          'checkFileExists: marking as downloaded - this should not happen:',
          model.id,
        );
        runInAction(() => {
          model.isDownloaded = true;
        });
      }
    } else {
      runInAction(() => {
        model.isDownloaded = false;
      });
    }
  };

  store.refreshDownloadStatuses = async () => {
    store.models.forEach(model => {
      store.checkFileExists(model);
    });
  };

  store.initializeDownloadStatus = async () => {
    await store.refreshDownloadStatuses();
  };

  store.removeInvalidLocalModels = () => {
    runInAction(() => {
      store.models = store.models.filter(
        model =>
          // Keep all non-local models (preset and HF)
          !(model.isLocal || model.origin === ModelOrigin.LOCAL) ||
          // This condition ensures that we keep models that are downloaded.
          // For local models, isDownloaded==true means the file exists, otherwise it's invalid.
          model.isDownloaded,
      );
    });
  };
}
