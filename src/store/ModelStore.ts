import {AppState, AppStateStatus} from 'react-native';
import DeviceInfo from 'react-native-device-info';

import 'react-native-get-random-values';

import {makePersistable} from 'mobx-persist-store';
import {engineMutex} from './engineMutex';

import {computed, makeAutoObservable, runInAction} from 'mobx';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {ContextParams, LlamaContext} from 'llama.rn';
import {CompletionParams, CompletionEngine} from '../utils/completionTypes';

import {uiStore} from '.';
import {serverStore} from './ServerStore';
import {hfAsModel, getMmprojFiles, filterProjectionModels} from '../utils';
import {getRecommendedProjectionModel} from '../utils/multimodalHelpers';
import type {OnboardingPalModelEntry} from './onboarding/onboardingPals';

import {downloadManager} from '../services/downloads';

import {CatalogFile, CatalogModel} from '../utils/modelCatalog';
import {DownloadSource} from '../utils/downloadSources';

// Bump when the migration logic that re-merges the persisted model list
// changes. Crossing this version runs the one-time prune-and-reconcile.
export const MODEL_LIST_VERSION = 15;

import {
  CacheType,
  ChatTemplateConfig,
  ContextInitParams,
  HuggingFaceModel,
  Model,
  ModelFile,
  ModelOrigin,
  ModelType,
  RemoteSessionBinding,
} from '../utils/types';

import {ErrorState, createErrorState} from '../utils/errors';
import {
  getRecommendedThreadCount,
  getCpuCoreCount,
} from '../utils/deviceCapabilities';
import {ReasoningCapability} from '../utils/reasoningCapability';
import type {CapabilityEnv, ModelCapabilityView} from '../utils/modelCaps';
import {createDefaultContextInitParams} from '../utils/contextInitParamsVersions';
import NativeHardwareInfo from '../specs/NativeHardwareInfo';
import type {ContextPolicy} from '../services/contextCompaction/decision';
import {applyModelStoreMethodGroups} from './modelStoreMethods';

/**
 * Factory function to create a Model object for a remote model from an OpenAI-compatible server.
 * Fills all required Model fields with sensible defaults.
 */
function createRemoteModel(params: {
  serverId: string;
  serverName: string;
  remoteModelId: string;
  modelName: string;
}): Model {
  const emptyChatTemplate = {
    name: '',
    addBosToken: false,
    addEosToken: false,
    bosToken: '',
    eosToken: '',
    chatTemplate: '',
    addGenerationPrompt: false,
  };
  return {
    id: `${params.serverId}/${params.remoteModelId}`,
    name: params.modelName,
    author: params.serverName,
    origin: ModelOrigin.REMOTE,
    isDownloaded: true,
    isLocal: false,
    size: 0,
    params: 0,
    downloadUrl: '',
    hfUrl: '',
    progress: 0,
    filename: '',
    defaultChatTemplate: emptyChatTemplate,
    chatTemplate: emptyChatTemplate,
    defaultStopWords: [],
    stopWords: [],
    defaultCompletionSettings: {} as CompletionParams,
    completionSettings: {} as CompletionParams,
    serverId: params.serverId,
    serverName: params.serverName,
    remoteModelId: params.remoteModelId,
  };
}

class ModelStore {
  models: Model[] = [];
  version: number | undefined = undefined; // Persisted version
  lastScanTime: number | null = null; // last scanLocalModels timestamp

  /**
   * Returns models with projection models filtered out for display purposes
   */
  get displayModels(): Model[] {
    return [...filterProjectionModels(this.models), ...this.remoteModels];
  }

  appState: AppStateStatus = AppState.currentState;
  useAutoRelease: boolean = true;
  // UI loading state - true during model load/release transitions
  isContextLoading: boolean = false;
  loadingModel: Model | undefined = undefined;

  // Unified context initialization parameters
  contextInitParams: ContextInitParams = createDefaultContextInitParams();

  max_threads: number = 4; // Will be set in constructor

  activeModelId: string | undefined = undefined;

  // Flag to track if multimodal is currently active
  isMultimodalActive: boolean = false;
  activeProjectionModelId: string | undefined = undefined;

  // Track initialization settings for the active context
  activeContextSettings: ContextInitParams | undefined = undefined;

  // 每模型上下文长度覆盖（2026-08-18 大王裁定：n_ctx 每模型独立）。
  // 全局 contextInitParams.n_ctx 作默认值；加载链按 modelId 取覆盖。
  perModelNCtx: Record<string, number> = {};

  // 覆盖来源（2026-08-19）：preset=自动预调/审计写入，user=用户手调。
  // PSS 审计只动 preset/无源（旧版污染）档，用户手调=可见决策=主权，审计不碰。
  perModelNCtxSource: Record<string, 'preset' | 'user'> = {};

  // B19 上下文治理策略（2026-08-19）：每模型 'expand' | 'compact' | 'ask'，
  // 默认 'ask'。发送前预算决策机消费；banner CTA（增大/压缩）与生成设置页
  // 写入；persist 持久化——用户的选择被记住，后续免打扰。
  perModelContextPolicy: Record<string, ContextPolicy> = {};

  // B19 自动压缩总开关（2026-08-19）：关闭后发送前不自动压缩（banner 手动
  // CTA 仍可用），默认开。生成设置页「上下文策略」段开关。
  contextAutoCompaction: boolean = true;

  context: LlamaContext | undefined = undefined;

  engine: CompletionEngine | undefined = undefined;

  activeRemoteBinding: RemoteSessionBinding | undefined = undefined;

  lastUsedModelId: string | undefined = undefined;

  // Auto-release tracking (persistent)
  wasAutoReleased: boolean = false;
  lastAutoReleasedModelId: string | undefined = undefined;

  // System UI protection (runtime)
  // R3-P5：被 loadReleaseMethods 组读写，去掉 private（private 迁出变公开实例
  // 属性——接受，不造访问控制补丁）
  autoReleaseDisabledReasons = new Set<string>();

  MIN_CONTEXT_SIZE = 200;

  inferencing: boolean = false;
  isStreaming: boolean = false;

  // Track active completion promise for safe context release
  // This prevents race condition where context is freed while completion is still running
  // R3-P5：被 loadReleaseMethods 组读写，去掉 private
  activeCompletionPromise: Promise<any> | null = null;

  // Mutex to serialize model load/release operations to prevent memory leaks
  // R3-P5：被 loadReleaseMethods 组读写，去掉 private
  contextOperationMutex: Promise<void> = Promise.resolve();

  // Last requested model ID - enables "last one wins" during rapid switching
  // R3-P5：被 loadReleaseMethods 组读写，去掉 private
  pendingModelId: string | null = null;

  // When true, the e2e benchmark runner owns the native context lifecycle.
  // Other callers (ChatView auto-load, selectModel, initContext) must defer
  // to keep the matrix's per-cell devices/n_gpu_layers from being shadowed
  // by an in-flight init that started before the matrix could configure them.
  // Runtime-only; not persisted.
  benchmarkActive: boolean = false;

  downloadError: ErrorState | null = null;
  modelLoadError: ErrorState | null = null;

  // Memory calibration variables (persisted)
  // Updated at app startup and after model release
  availableMemoryCeiling: number | undefined = undefined;
  // Updated after successful model load using GGUF estimator
  largestSuccessfulLoad: number | undefined = undefined;
  // 策展表版本（v2 2026-08-26）：preset 源档位随表版本一次性拉齐的记账字段
  curatedTableVersion: number | undefined = undefined;

  constructor() {
    // models 域拆分（R3）：方法组挂载必须在 makeAutoObservable 之前，
    // 箭头函数实例属性与原 class field 语义一致（自动标注 MobX action）
    applyModelStoreMethodGroups(this);
    makeAutoObservable(this, {
      activeModel: computed,
      activeModelCaps: computed,
      contextId: computed,
      remoteModels: computed,
      activeDownloads: computed,
    });
    makePersistable(this, {
      name: 'ModelStore',
      properties: [
        'models',
        'version',
        'useAutoRelease',
        'contextInitParams',
        'perModelNCtx',
        'perModelNCtxSource',
        'perModelContextPolicy',
        'contextAutoCompaction',
        'lastUsedModelId',
        'wasAutoReleased',
        'lastAutoReleasedModelId',
        'availableMemoryCeiling',
        'largestSuccessfulLoad',
        'curatedTableVersion',
      ],
      storage: AsyncStorage,
    }).then(async () => {
      await this.initializeThreadCount();
      this.initializeStore();
    });

    this.setupAppStateListener();

    // Set up download manager callbacks
    downloadManager.setCallbacks({
      onProgress: (modelId, progress) => {
        const model = this.models.find(m => m.id === modelId);
        if (model) {
          runInAction(() => {
            model.progress = progress.progress;
            model.downloadSpeed = `${progress.speed} ${uiStore.l10n.common.downloadETA}: ${progress.eta}`;
          });
        }
      },
      onComplete: async modelId => {
        const model = this.models.find(m => m.id === modelId);
        if (model) {
          runInAction(() => {
            model.progress = 100;
            model.isDownloaded = true;
          });

          // Fetch and persist GGUF metadata after download completes
          // Skip for projection models (CLIP) - they have different metadata structure
          if (model.modelType !== ModelType.PROJECTION) {
            await this.fetchAndPersistGGUFMetadata(model);
          }
        }
      },
      onError: (modelId, error) => {
        console.error('Download error for model', modelId, error);
        const model = this.models.find(m => m.id === modelId);
        if (model) {
          runInAction(() => {
            model.progress = 0;
            model.isDownloaded = false;
          });
        }

        const errorState = createErrorState(error, 'download', 'huggingface', {
          modelId,
        });

        runInAction(() => {
          this.downloadError = errorState;
        });
      },
    });
  }

  private async initializeThreadCount() {
    try {
      const cores = await getCpuCoreCount();
      runInAction(() => {
        this.max_threads = cores;
      });

      // Only set recommended thread count on first launch.
      // After hydration, this.version is set if the store was previously persisted.
      // On fresh install, this.version is undefined (default).
      const isFirstLaunch = this.version === undefined;
      if (isFirstLaunch) {
        const threads = await getRecommendedThreadCount();
        runInAction(() => {
          this.contextInitParams = {
            ...this.contextInitParams,
            n_threads: threads,
          };
        });
      }
    } catch (error) {
      console.error('Failed to initialize thread count:', error);
      runInAction(() => {
        this.max_threads = 4;
      });
    }
  }

  initializeStore = async () => {
    const storedVersion = this.version || 0;
    console.log('models: ', this.models);

    // Sync download manager with active downloads
    await downloadManager.syncWithActiveDownloads(this.models);

    // Resolve the fixed catalog presets (no network, 单一事实源) then
    // merge/reconcile against persisted models.
    const presets = await this.resolvePresets();

    if (storedVersion < MODEL_LIST_VERSION) {
      this.mergeModelLists(presets);
      // Only finalize the one-time migration once presets actually resolved.
      // An empty result signals a transient resolve failure (e.g. the RAM read
      // rejected); leave the version unbumped so the migration retries next
      // launch instead of locking in an empty default list.
      if (presets.length > 0) {
        runInAction(() => {
          this.version = MODEL_LIST_VERSION;
        });
      }
    } else {
      this.reconcilePresets(presets);
      await this.initializeDownloadStatus();
      this.removeInvalidLocalModels();
    }

    // 在线规则已退役（2026-08-20）：清单 = catalog 固定单一事实源（MODEL_MATRIX 代码化），
    // 不再拉取上游 device-rules，杜绝清单被上游污染。

    await this.initializeGpuSettings(); // Should be awaited to ensure GPU settings are applied before initializing context

    // Initialize available memory ceiling at app startup if not set
    if (this.availableMemoryCeiling === undefined) {
      try {
        const availableBytes = await NativeHardwareInfo.getAvailableMemory();
        runInAction(() => {
          this.availableMemoryCeiling = availableBytes;
        });
      } catch (error) {
        // Fallback when native call fails
        console.warn(
          '[ModelStore] Native getAvailableMemory failed, using fallback:',
          error,
        );
        const totalMemory = await DeviceInfo.getTotalMemory();
        // Use conservative heuristic: min(60% of RAM, RAM - 1.2GB)
        const fallbackCeiling = Math.min(
          totalMemory * 0.6,
          totalMemory - 1.2 * 1e9,
        );
        runInAction(() => {
          this.availableMemoryCeiling = Math.max(fallbackCeiling, 0); // Ensure non-negative
        });
      }
    }

    // Load missing GGUF metadata for downloaded models (background, non-blocking)
    this.loadMissingGGUFMetadata();

    // 生图清单条目状态刷新（模型页渲染，后台非阻塞）
    this.refreshCatalogImageGenStatus();

    // PSS 安全审计：自愈旧版预调写入的超限 n_ctx 档（估算超 PSS 安全预算
    // 降到最大安全档）——K90 实证超限档生成中被厂商看护硬杀。
    this.auditPerModelNCtxAgainstPss();

    // 策展默认归一：旧梯子遗留 preset 超策展档者降档（user 源不碰）。
    this.normalizePresetNCtxToCuratedDefaults();

    // Check if we need to reload an auto-released model (for app restarts)
    this.checkAndReloadAutoReleasedModel();
  };

  // 生图清单条目（模型页渲染，2026-08-20 catalog 对齐）：状态由
  // refreshCatalogImageGenStatus 刷新（main 文件存在 = 已下载）。生图条目不进
  // models 数组——与 LLM 列表完全隔离（路由专工：聊天页 LLM-only、生图页
  // manifest-only，均不触碰）。
  catalogImageGenEntries: {entry: CatalogModel; isDownloaded: boolean}[] = [];

  get activeModel(): Model | undefined {
    // Look in local models first, then remote models
    return (
      this.models.find(model => model.id === this.activeModelId) ||
      this.remoteModels.find(model => model.id === this.activeModelId)
    );
  }

  // R3-P5：capabilityEnv 是 getter，无法作为实例属性挂载（mixin pattern 仅
  // 赋值方法）；且 makeAutoObservable 需在类声明期识别 computed——按「getter
  // 留 facade」纪律保留本 getter（去 private 供 loadReleaseMethods 的
  // capsFor 消费），实现零行为变化。
  get capabilityEnv(): CapabilityEnv {
    return {
      remoteCaps: serverStore.remoteCaps,
      listCaps: serverStore.listCaps,
      binding: this.activeRemoteBinding,
      isMultimodalActive: this.isMultimodalActive,
      activeContextSettings: this.activeContextSettings,
      activeModelId: this.activeModelId,
    };
  }

  /** Capabilities of the live session — chat's entry point. */
  get activeModelCaps(): ModelCapabilityView {
    return this.capsFor(this.activeModel);
  }

  get isAutoReleaseEnabled() {
    return this.useAutoRelease && this.autoReleaseDisabledReasons.size === 0;
  }

  get isDownloading() {
    return (modelId: string) => downloadManager.isDownloading(modelId);
  }

  get lastUsedModel(): Model | undefined {
    return this.lastUsedModelId
      ? this.models.find(m => m.id === this.lastUsedModelId && m.isDownloaded)
      : undefined;
  }

  /**
   * Returns a string context identifier for the active model.
   * For local models: the numeric native context ID as a string.
   * For remote models: "remote-{serverId}" string.
   */
  get contextId(): string | undefined {
    if (this.context) {
      return String(this.context.id);
    }
    const model = this.activeModel;
    if (model?.origin === ModelOrigin.REMOTE && model.serverId) {
      return `remote-${model.serverId}`;
    }
    return undefined;
  }

  /**
   * Derived from `serverStore.userSelectedModels` and `serverStore.servers` —
   * not from `serverModels`, so the list a server currently advertises does not
   * change which cards exist. Remote models are never stored in the persisted
   * `models` array.
   */
  get remoteModels(): Model[] {
    const models: Model[] = [];
    for (const selected of serverStore.userSelectedModels) {
      const server = serverStore.servers.find(s => s.id === selected.serverId);
      if (!server) {
        continue;
      }
      // Use the remote model ID as the display name
      models.push(
        createRemoteModel({
          serverId: selected.serverId,
          serverName: server.name,
          remoteModelId: selected.remoteModelId,
          modelName: selected.remoteModelId,
        }),
      );
    }
    return models;
  }

  /**
   * Reactive list of in-flight downloads. Each entry carries the Model object
   * plus the latest formatted progress strings so observers can render a
   * banner / sheet / list row without re-deriving anything per frame.
   */
  get activeDownloads(): Array<{
    modelId: string;
    model: Model;
    progress: number;
    bytesDownloaded: number;
    bytesTotal: number;
    speedLabel: string;
    etaLabel: string;
  }> {
    return downloadManager.activeJobs.map(job => ({
      modelId: job.model.id,
      model: job.model,
      progress: job.state.progress?.progress ?? 0,
      bytesDownloaded: job.state.progress?.bytesDownloaded ?? 0,
      bytesTotal: job.state.progress?.bytesTotal ?? 0,
      speedLabel: job.state.progress?.speed ?? '',
      etaLabel: job.state.progress?.eta ?? '',
    }));
  }

  /**
   * Adds a new HF model to the models list, only if it doesn't exist yet.
   * For multimodal models, ensures all required projection models are also added.
   * @param hfModel - The Hugging Face model to add.
   * @param modelFile - The model file to add.
   * @returns The new model that was added.
   */
  addHFModel = async (hfModel: HuggingFaceModel, modelFile: ModelFile) => {
    const newModel = hfAsModel(hfModel, modelFile);
    const storeModel = this.models.find(m => m.id === newModel.id);

    // For non-multimodal models, return early if the model already exists
    if (storeModel && !newModel.supportsMultimodal) {
      return storeModel;
    }

    // Add the model to the store if it doesn't exist
    let modelToReturn = storeModel;
    if (!storeModel) {
      runInAction(() => {
        this.models.push(newModel);
      });
      modelToReturn = newModel;
    }

    // For multimodal models, always ensure projection models are in the store
    if (
      newModel.supportsMultimodal &&
      newModel.compatibleProjectionModels?.length
    ) {
      // Get the mmproj files from the repository
      const mmprojFiles = getMmprojFiles(hfModel.siblings || []);

      // Add each projection model to the store if it doesn't exist
      for (const mmprojFile of mmprojFiles) {
        const projModelId = `${hfModel.id}/${mmprojFile.rfilename}`;
        const existingProjModel = this.models.find(m => m.id === projModelId);

        if (!existingProjModel) {
          // Create and add the projection model
          const projModel = hfAsModel(hfModel, mmprojFile);
          runInAction(() => {
            this.models.push(projModel);
          });
        }
      }

      // If we're working with an existing model, update its projection model references
      // to ensure they're current with what's now in the store
      if (storeModel) {
        const updatedCompatibleModels = mmprojFiles.map(
          file => `${hfModel.id}/${file.rfilename}`,
        );

        runInAction(() => {
          // Update compatible projection models list
          storeModel.compatibleProjectionModels = updatedCompatibleModels;

          // Ensure default projection model is set if not already set
          if (
            !storeModel.defaultProjectionModel &&
            updatedCompatibleModels.length > 0
          ) {
            // Use the same logic as hfAsModel to determine the default
            const mmprojFilenames = mmprojFiles.map(file => file.rfilename);
            const recommendedFile = getRecommendedProjectionModel(
              modelFile.rfilename,
              mmprojFilenames,
            );
            if (recommendedFile) {
              storeModel.defaultProjectionModel = `${hfModel.id}/${recommendedFile}`;
            }
          }
        });
      }
    }

    // If this is a projection model, check if we need to update any vision models
    if (newModel.modelType === ModelType.PROJECTION) {
      // Get the repository ID from the model ID
      const repoId = newModel.id.split('/').slice(0, 2).join('/');

      // Find vision models from the same repository
      const visionModels = this.models.filter(
        m =>
          m.supportsMultimodal &&
          m.id.startsWith(repoId) &&
          m.id !== newModel.id,
      );

      // Update the compatible projection models for each vision model
      for (const visionModel of visionModels) {
        if (!visionModel.compatibleProjectionModels?.includes(newModel.id)) {
          runInAction(() => {
            if (!visionModel.compatibleProjectionModels) {
              visionModel.compatibleProjectionModels = [];
            }
            visionModel.compatibleProjectionModels.push(newModel.id);

            // If no default projection model is set, set this one as default
            if (!visionModel.defaultProjectionModel) {
              visionModel.defaultProjectionModel = newModel.id;
            }
          });
        }
      }
    }

    await this.refreshDownloadStatuses();
    return modelToReturn;
  };

  /**
   * Lazy-register a curated onboarding-pal HF entry into `models`.
   * Single writer for HF-origin onboarding picks; only call site is
   * `useOnboardingHandlers.finish`. Synthesizes the minimal
   * `{hfModel, modelFile}` pair and delegates to `addHFModel`, which
   * provides idempotency. `siblings: []` keeps `isVisionRepo` false so
   * no projection model materializes (text-only by design).
   */
  registerOnboardingPalModel = async (
    entry: OnboardingPalModelEntry,
  ): Promise<Model | undefined> => {
    const modelFile: ModelFile = {
      rfilename: entry.filename,
      url: entry.downloadUrl,
      size: entry.sizeBytes,
    } as ModelFile;
    const hfModel: HuggingFaceModel = {
      id: entry.repo,
      author: entry.author,
      url: `https://huggingface.co/${entry.repo}`,
      specs: {gguf: {total: entry.params}},
      siblings: [] as ModelFile[],
    } as HuggingFaceModel;
    return this.addHFModel(hfModel, modelFile);
  };

  /**
   * Returns available (i.e. downloaded models) models with projection models filtered out,
   * plus remote models from configured servers.
   */
  get availableModels(): Model[] {
    const localAvailable = filterProjectionModels(
      this.models.filter(
        model =>
          // Include models that are either local or downloaded
          model.isLocal ||
          model.origin === ModelOrigin.LOCAL ||
          model.isDownloaded,
      ),
    );
    return [...localAvailable, ...this.remoteModels];
  }

  setInferencing(value: boolean) {
    this.inferencing = value;
  }

  setIsStreaming(value: boolean) {
    this.isStreaming = value;
  }

  /**
   * Register an active completion promise for safe context release.
   * This should be called when starting a completion operation.
   * @param promise The completion promise to track
   */
  registerCompletionPromise(promise: Promise<any>) {
    this.activeCompletionPromise = promise;
  }

  /**
   * Clear the active completion promise.
   * This should be called when the completion finishes (success or error).
   */
  clearCompletionPromise() {
    this.activeCompletionPromise = null;
  }

  isModelAvailable = (modelId?: string): boolean => {
    if (!modelId) {
      return false;
    }
    return this.availableModels.some(m => m.id === modelId);
  };

  clearModelLoadError = () => {
    this.modelLoadError = null;
  };

  // 推理能力方法组：实现迁至 modelStoreMethods/reasoningMethods.ts（行为零变化）
  recordReasoningObserved!: (modelId: string) => void;
  setReasoningOverride!: (modelId: string, cap: ReasoningCapability) => void;

  // A 配置域方法组：实现迁至 modelStoreMethods/contextConfigMethods.ts（行为零变化）
  setNThreads!: (n_threads: number) => void;
  setCacheTypeK!: (cache_type: CacheType) => void;
  setCacheTypeV!: (cache_type: CacheType) => void;
  setNBatch!: (n_batch: number) => void;
  setNUBatch!: (n_ubatch: number) => void;
  setNContext!: (n_ctx: number) => void;
  setModelNCtx!: (
    modelId: string,
    n_ctx: number,
    source?: 'preset' | 'user',
  ) => void;
  getModelNCtx!: (modelId?: string | null) => number;
  getContextPolicy!: (modelId?: string | null) => ContextPolicy;
  setContextPolicy!: (modelId: string, policy: ContextPolicy) => void;
  setContextAutoCompaction!: (enabled: boolean) => void;
  presetModelNCtxIfAbsent!: (model: Model, _projectionModel?: Model) => void;
  normalizePresetNCtxToCuratedDefaults!: () => void;
  auditPerModelNCtxAgainstPss!: () => void;
  setNGPULayers!: (n_gpu_layers: number) => void;
  setImageMaxTokens!: (image_max_tokens: number) => void;
  setUseMlock!: (use_mlock: boolean) => void;
  setUseMmap!: (use_mmap: 'true' | 'false' | 'smart') => void;
  setNoExtraBufts!: (no_extra_bufts: boolean) => void;
  getEffectiveContextInitParams!: (
    filePath?: string,
    modelId?: string,
  ) => Promise<Omit<ContextParams, 'model'>>;
  getEffectiveBatchValues!: () => {
    n_ctx: number;
    n_batch: number;
    n_ubatch: number;
  };
  getEffectiveInitSettings!: (
    filePath?: string,
  ) => Promise<Omit<ContextParams, 'model'>>;
  getEffectiveValues!: () => {
    n_ctx: number;
    n_batch: number;
    n_ubatch: number;
  };
  initializeGpuSettings!: () => Promise<void>;
  setNoGpuDevices!: (no_gpu_devices: boolean) => void;
  setDevices!: (devices: string[] | undefined) => void;
  setFlashAttnType!: (flash_attn_type: 'auto' | 'on' | 'off') => void;
  setKvUnified!: (kv_unified: boolean) => void;
  setNParallel!: (n_parallel: number) => void;

  // 投影模型方法组：实现迁至 modelStoreMethods/projectionMethods.ts（行为零变化）
  getCompatibleProjectionModels!: (modelId: string) => Model[];
  setDefaultProjectionModel!: (
    modelId: string,
    projectionModelId: string,
  ) => void;
  getDefaultProjectionModel!: (modelId: string) => Model | undefined;
  getLLMsUsingProjectionModel!: (projectionModelId: string) => Model[];
  getDownloadedLLMsUsingProjectionModel!: (
    projectionModelId: string,
  ) => Model[];
  hasRequiredProjectionModel!: (model: Model) => boolean;
  getProjectionModelStatus!: (model: Model) => {
    isAvailable: boolean;
    state: 'not_needed' | 'downloaded' | 'downloading' | 'missing';
    projectionModel?: Model;
  };

  canDeleteProjectionModel!: (projectionModelId: string) => {
    canDelete: boolean;
    reason?: string;
    dependentModels?: Model[];
  };
  cleanupOrphanedProjectionModel!: (projectionModelId: string) => Promise<void>;
  cleanupOrphanedProjectionModels!: (
    projectionModelIds: string[],
  ) => Promise<void>;
  setModelVisionEnabled!: (modelId: string, enabled: boolean) => Promise<void>;
  getModelVisionPreference!: (model: Model) => boolean;

  // CRUD 方法组：实现迁至 modelStoreMethods/crudMethods.ts（行为零变化）
  removeModelFromList!: (model: Model) => boolean;
  deleteModel!: (model: Model) => Promise<void>;
  fetchAndPersistGGUFMetadata!: (model: Model) => Promise<void>;
  loadMissingGGUFMetadata!: () => void;
  updateModelChatTemplate!: (
    modelId: string,
    newConfig: ChatTemplateConfig,
  ) => void;
  updateModelStopWords!: (
    modelId: string,
    newStopWords: CompletionParams['stop'],
  ) => void;
  updateModelName!: (modelId: string, newName: string) => void;
  updateModelCapabilities!: (
    modelId: string,
    newCapabilities: Model['capabilities'],
  ) => void;
  resetModels!: () => Promise<void>;
  resetModelChatTemplate!: (modelId: string) => void;
  resetModelStopWords!: (modelId: string) => void;
  resetModelName!: (modelId: string) => void;

  // 下载方法组：实现迁至 modelStoreMethods/downloadMethods.ts（行为零变化）
  _downloadProjectionModelIfNeeded!: (
    model: Model,
    source?: DownloadSource,
  ) => Promise<void>;
  checkSpaceAndDownload!: (
    modelId: string,
    source?: DownloadSource,
  ) => Promise<void>;
  cancelDownload!: (modelId: string) => Promise<void>;
  getDownloadProgress!: (modelId: string) => number;
  downloadHFModel!: (
    hfModel: HuggingFaceModel,
    modelFile: ModelFile,
    options?: {
      enableVision?: boolean;
      projectionModelId?: string; // User-selected projection model
    },
  ) => Promise<void>;
  fetchAndUpdateModelFileDetails!: (model: Model) => Promise<void>;
  updateModelHash!: (modelId: string, force?: boolean) => Promise<void>;
  clearDownloadError!: () => void;
  retryDownload!: () => void;

  // 目录方法组：实现迁至 modelStoreMethods/catalogScanMethods.ts（行为零变化）
  resolvePresets!: () => Promise<Model[]>;
  resolveCatalogPresets!: () => Model[];
  catalogEntryToPair!: (
    entry: CatalogModel,
    extraFile?: CatalogFile,
  ) => {hfModel: HuggingFaceModel; modelFile: ModelFile} | null;
  catalogSourceLessStub!: (entry: CatalogModel) => Model;
  refreshCatalogImageGenStatus!: () => Promise<void>;
  isCatalogEntryDownloading!: (entryId: string) => boolean;
  downloadCatalogEntry!: (
    entryId: string,
    source: DownloadSource,
  ) => Promise<void>;
  catalogFileStub!: (
    entry: CatalogModel,
    file: CatalogFile,
    resolved: {source: DownloadSource; repo: string},
  ) => Model;
  reconcilePresets!: (presets: Model[]) => void;
  mergeModelLists!: (presets?: Model[]) => void;

  // 本地扫描方法组：实现迁至 modelStoreMethods/localScanMethods.ts（行为零变化）
  scanLocalModels!: () => Promise<void>;
  removeModelByFullPath!: (fullPath: string) => void;
  addLocalModel!: (localFilePath: string) => Promise<void>;

  // 加载/释放生命周期方法组：实现迁至 modelStoreMethods/loadReleaseMethods.ts（行为零变化）
  resolveMultimodalConfig!: (
    model: Model,
    mmProjPath?: string,
  ) => Promise<{
    isMultimodalInit: boolean;
    resolvedMmProjPath?: string;
    projectionModel?: Model;
  }>;
  checkMemoryAndConfirm!: (
    model: Model,
    isMultimodalInit: boolean,
    projectionModel?: Model,
  ) => Promise<boolean>;
  enterBenchmarkMode!: () => Promise<void>;
  exitBenchmarkMode!: () => void;
  initContext!: (
    model: Model,
    mmProjPath?: string,
  ) => Promise<LlamaContext | null>;
  proceedWithInitialization!: (
    model: Model,
    mmProjPath?: string,
    isMultimodalInit?: boolean,
    projectionModel?: Model,
  ) => Promise<LlamaContext>;
  _releaseContextInternal!: (clearActiveModel?: boolean) => Promise<string>;
  releaseContext!: (clearActiveModel?: boolean) => Promise<string>;
  manualReleaseContext!: () => Promise<void>;
  reinitializeContext!: () => Promise<void>;
  setActiveModel!: (modelId: string) => void;
  setRemoteModel!: (model: Model) => Promise<void>;
  selectModel!: (model: Model) => Promise<void>;
  capsFor!: (model: Model | undefined) => ModelCapabilityView;
  updateModelStopTokens!: (ctx: LlamaContext, model: Model) => Promise<void>;
  updateModelThinkingCapabilities!: (
    ctx: LlamaContext,
    model: Model,
  ) => Promise<void>;
  startImageCompletion!: (params: {
    prompt: string;
    image_path?: string; // For backward compatibility
    image_paths?: string[]; // New parameter for multiple images
    systemMessage?: string;
    onToken?: (token: string) => void;
    onComplete?: (text: string) => void;
    onError?: (error: Error) => void;
  }) => Promise<void>;
  setupAppStateListener!: () => void;
  disableAutoRelease!: (reason: string) => void;
  enableAutoRelease!: (reason: string) => void;
  markAutoReleased!: (modelId: string) => void;
  clearAutoReleaseFlags!: () => void;
  checkAndReloadAutoReleasedModel!: () => Promise<void>;
  handleAppStateChange!: (nextAppState: AppStateStatus) => Promise<void>;
  reprobeRemoteCapsIfUnknown!: () => void;
  updateUseAutoRelease!: (useAutoRelease: boolean) => void;
  getModelFullPath!: (model: Model) => Promise<string>;
  checkFileExists!: (model: Model) => Promise<void>;
  refreshDownloadStatuses!: () => Promise<void>;
  initializeDownloadStatus!: () => Promise<void>;
  removeInvalidLocalModels!: () => void;
}

export const modelStore = new ModelStore();
engineMutex.register('chat', async () => {
  await modelStore.releaseContext();
});
