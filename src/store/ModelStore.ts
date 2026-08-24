import {AppState, AppStateStatus, Platform, Alert} from 'react-native';
import DeviceInfo from 'react-native-device-info';

import {v4 as uuidv4} from 'uuid';
import 'react-native-get-random-values';
import {makePersistable} from 'mobx-persist-store';
import * as RNFS from '@dr.pogodin/react-native-fs';
import {DEFAULT_MODELS_DIR} from '../utils/paths';
import {getAllModelDirs} from '../utils/modelDirs';
import {engineMutex} from './engineMutex';
import {chatEngineGuard} from '../utils/engineGuard';
import {MMProjRegex} from '../utils/multimodalPatterns';
import {nightTaskRegistry} from './nightTaskRegistry';

import {computed, makeAutoObservable, runInAction, toJS} from 'mobx';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {ContextParams, LlamaContext, initLlama} from 'llama.rn';
import {
  CompletionParams,
  CompletionEngine,
  toApiCompletionParams,
} from '../utils/completionTypes';

import {fetchModelFilesDetails} from '../api/hf';
import {
  LocalCompletionEngine,
  OpenAICompletionEngine,
} from '../api/completionEngines';

import {uiStore, hfStore} from '.';
import {serverStore} from './ServerStore';
import {chatSessionStore} from './ChatSessionStore';
import {checkGpuSupport} from '../utils/deviceCapabilities';
import {
  deepMerge,
  getSHA256Hash,
  hfAsModel,
  getMmprojFiles,
  filterProjectionModels,
  inferRepoFromModelId,
  parseSizeLabel,
} from '../utils';
import {getRecommendedProjectionModel} from '../utils/multimodalHelpers';
import {getOriginalModelName} from '../utils/formatters';
import type {OnboardingPalModelEntry} from './onboarding/onboardingPals';

import {downloadManager, DownloadCancelledError} from '../services/downloads';
import {ensureStorageAccess} from '../utils/androidPermission';

import {
  CATALOG_LLM,
  CATALOG_IMAGEGEN,
  CatalogFile,
  CatalogModel,
  catalogEntryById,
  catalogEntryByFilename,
  catalogEntryTotalBytes,
} from '../utils/modelCatalog';
import {
  DownloadSource,
  fileRemotePath,
  getAvailableSources,
  repoForSource,
  resolveDownloadUrl,
  resolveFileSource,
} from '../utils/downloadSources';
import {AIOS_ROOT, AIOS_MODELS_DIR} from '../utils/paths';

// Bump when the migration logic that re-merges the persisted model list
// changes. Crossing this version runs the one-time prune-and-reconcile.
export const MODEL_LIST_VERSION = 15;

import {
  getHFDefaultSettings,
  getLocalModelDefaultSettings,
  stops,
} from '../utils/chat';
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
import {chatSessionRepository} from '../repositories/ChatSessionRepository';
import {hasEnoughMemory} from '../hooks/useMemoryCheck';
import {
  isHighEndDevice,
  getRecommendedThreadCount,
  getCpuCoreCount,
} from '../utils/deviceCapabilities';
import {
  detectThinkingCapability,
  detectReasoningReinject,
} from '../utils/thinkingCapabilityDetection';
import {ReasoningCapability} from '../utils/reasoningCapability';
import {capsMatchBinding} from '../utils/remoteCaps';
import {resolveModelCaps} from '../utils/modelCaps';
import type {CapabilityEnv, ModelCapabilityView} from '../utils/modelCaps';
import {t} from '../locales';
import {resolveUseMmap} from '../utils/memorySettings';
import {IMAGE_GEN_MODEL_FILES} from '../utils/imageGenManifest';
import {
  createContextInitParams,
  createDefaultContextInitParams,
} from '../utils/contextInitParamsVersions';
import NativeHardwareInfo from '../specs/NativeHardwareInfo';
import {
  getModelMemoryRequirement,
  PSS_SAFE_BUDGET,
} from '../utils/memoryEstimator';
import {CONTEXT_LADDER} from '../utils/bannerVariantResolver';
import {defaultNCtxForModel} from '../utils/modelContextDefaults';
import type {ContextPolicy} from '../services/contextCompaction/decision';
import {loadLlamaModelInfo} from 'llama.rn';
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
  private autoReleaseDisabledReasons = new Set<string>();

  MIN_CONTEXT_SIZE = 200;

  inferencing: boolean = false;
  isStreaming: boolean = false;

  // Track active completion promise for safe context release
  // This prevents race condition where context is freed while completion is still running
  private activeCompletionPromise: Promise<any> | null = null;

  // Mutex to serialize model load/release operations to prevent memory leaks
  private contextOperationMutex: Promise<void> = Promise.resolve();

  // Last requested model ID - enables "last one wins" during rapid switching
  private pendingModelId: string | null = null;

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

  constructor() {
    // models 域拆分（批次4 P3）：方法组挂载必须在 makeAutoObservable 之前，
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

  setNThreads = (n_threads: number) => {
    runInAction(() => {
      this.contextInitParams = {
        ...this.contextInitParams,
        n_threads,
      };
    });
  };

  setCacheTypeK = (cache_type: CacheType) => {
    runInAction(() => {
      // Only allow changing cache type if flash attention is enabled
      // Support both old flash_attn and new flash_attn_type
      const flashAttnEnabled =
        this.contextInitParams.flash_attn ||
        (this.contextInitParams.flash_attn_type &&
          this.contextInitParams.flash_attn_type !== 'off');

      if (flashAttnEnabled) {
        this.contextInitParams = {
          ...this.contextInitParams,
          cache_type_k: cache_type,
        };
      }
    });
  };

  setCacheTypeV = (cache_type: CacheType) => {
    runInAction(() => {
      // Only allow changing cache type if flash attention is enabled
      // Support both old flash_attn and new flash_attn_type
      const flashAttnEnabled =
        this.contextInitParams.flash_attn ||
        (this.contextInitParams.flash_attn_type &&
          this.contextInitParams.flash_attn_type !== 'off');

      if (flashAttnEnabled) {
        this.contextInitParams = {
          ...this.contextInitParams,
          cache_type_v: cache_type,
        };
      }
    });
  };

  setNBatch = (n_batch: number) => {
    runInAction(() => {
      this.contextInitParams = {
        ...this.contextInitParams,
        n_batch,
      };
    });
  };

  setNUBatch = (n_ubatch: number) => {
    runInAction(() => {
      this.contextInitParams = {
        ...this.contextInitParams,
        n_ubatch,
      };
    });
  };

  setNContext = (n_ctx: number) => {
    runInAction(() => {
      this.contextInitParams = {
        ...this.contextInitParams,
        n_ctx,
      };
    });
  };

  /** 每模型上下文覆盖写入（生成设置页活动模型行 / 聊天页入口共用） */
  setModelNCtx = (
    modelId: string,
    n_ctx: number,
    source: 'preset' | 'user' = 'user',
  ) => {
    runInAction(() => {
      this.perModelNCtx = {...this.perModelNCtx, [modelId]: n_ctx};
      this.perModelNCtxSource = {...this.perModelNCtxSource, [modelId]: source};
    });
  };

  /** 生效 n_ctx：每模型覆盖优先，无覆盖回退全局默认 */
  getModelNCtx = (modelId?: string | null): number =>
    (modelId && this.perModelNCtx[modelId]) || this.contextInitParams.n_ctx;

  /** B19 上下文治理策略：每模型覆盖优先，无覆盖默认 'ask'（首次触发弹选择）。 */
  getContextPolicy = (modelId?: string | null): ContextPolicy =>
    (modelId && this.perModelContextPolicy[modelId]) || 'ask';

  /** B19 策略写入（banner CTA / 设置页），persist 持久化免打扰。 */
  setContextPolicy = (modelId: string, policy: ContextPolicy) => {
    runInAction(() => {
      this.perModelContextPolicy = {
        ...this.perModelContextPolicy,
        [modelId]: policy,
      };
    });
  };

  /** B19 自动压缩总开关（设置页），persist 持久化。 */
  setContextAutoCompaction = (enabled: boolean) => {
    runInAction(() => {
      this.contextAutoCompaction = enabled;
    });
  };

  /**
   * §18.6 每模型预调：无覆盖时写人工策展默认（modelContextDefaults），
   * 一次预调、持久化。策展表取代内存梯子「能装多大给多大」
   * （2026-08-19 大王裁定：K90 实证梯子给 1B 写 98304 KV 虚占、
   * 漏档模型回全局 4096 一轮即满）；设备内存安全由 PSS 审计兜底，
   * 用户手调 = 主权不碰。
   */
  private presetModelNCtxIfAbsent = (
    model: Model,
    _projectionModel?: Model,
  ): void => {
    if (model.origin === ModelOrigin.REMOTE || this.perModelNCtx[model.id]) {
      return;
    }
    this.setModelNCtx(model.id, defaultNCtxForModel(model), 'preset');
  };
  
  /**
   * 策展默认一次归一（2026-08-19）：preset 源超策展默认者降档
   * （旧梯子遗留，如 1B 98304）；user 源不碰（主权）；preset 低于
   * 策展者是审计的安全决策，不拉回（防与审计乒乓）。
   */
  normalizePresetNCtxToCuratedDefaults = (): void => {
    for (const model of this.models) {
      if (model.origin === ModelOrigin.REMOTE) {
        continue;
      }
      if (this.perModelNCtxSource[model.id] === 'user') {
        continue;
      }
      const current = this.perModelNCtx[model.id];
      if (!current) {
        continue;
      }
      const curated = defaultNCtxForModel(model);
      if (current > curated) {
        console.warn(
          `[ModelStore] curated default: ${model.name} n_ctx ${current} → ${curated}`,
        );
        this.setModelNCtx(model.id, curated, 'preset');
      }
    }
  };

  /**
   * PSS 安全审计（2026-08-19）：启动时复查每模型生效 n_ctx（覆盖优先，
   * 无覆盖取全局默认），估算超 PSS_SAFE_BUDGET 者降到最大安全档——
   * 自愈旧版预调污染与全局默认越限（K90 实证：40960 档 f16 KV 生成中
   * PSS 6.77GB > 6GB 硬限被杀；8B 模型全局默认 8192 亦越限）。
   * 用户手调（source='user'）= 可见决策 = 主权，审计不碰；
   * 「只升不降」保护的是安全范围内的用户主权，不是必杀值。
   */
  auditPerModelNCtxAgainstPss = (): void => {
    for (const model of this.models) {
      if (model.origin === ModelOrigin.REMOTE) {
        continue;
      }
      if (this.perModelNCtxSource[model.id] === 'user') {
        continue;
      }
      const nCtx = this.perModelNCtx[model.id] ?? this.contextInitParams.n_ctx;
      let estimated: number;
      try {
        estimated = getModelMemoryRequirement(model, undefined, {
          ...this.contextInitParams,
          n_ctx: nCtx,
        });
      } catch {
        continue;
      }
      if (estimated <= PSS_SAFE_BUDGET) {
        continue;
      }
      let safe: number | undefined;
      for (const tier of CONTEXT_LADDER) {
        if (tier >= nCtx) {
          break;
        }
        try {
          const mem = getModelMemoryRequirement(model, undefined, {
            ...this.contextInitParams,
            n_ctx: tier,
          });
          if (mem <= PSS_SAFE_BUDGET) {
            safe = tier;
          } else {
            break;
          }
        } catch {
          break;
        }
      }
      if (safe && safe < nCtx) {
        console.warn(
          `[ModelStore] PSS audit: ${model.name} n_ctx ${nCtx} → ${safe} (estimate exceeded PSS safe budget)`,
        );
        this.setModelNCtx(model.id, safe, 'preset');
      }
    }
  };

  setNGPULayers = (n_gpu_layers: number) => {
    runInAction(() => {
      this.contextInitParams = {
        ...this.contextInitParams,
        n_gpu_layers,
      };
    });
  };

  setImageMaxTokens = (image_max_tokens: number) => {
    runInAction(() => {
      this.contextInitParams = {
        ...this.contextInitParams,
        image_max_tokens,
      };
    });
  };

  setUseMlock = (use_mlock: boolean) => {
    runInAction(() => {
      this.contextInitParams = {
        ...this.contextInitParams,
        use_mlock,
      };
    });
  };

  setUseMmap = (use_mmap: 'true' | 'false' | 'smart') => {
    runInAction(() => {
      this.contextInitParams = {
        ...this.contextInitParams,
        use_mmap,
      };
    });
  };

  setNoExtraBufts = (no_extra_bufts: boolean) => {
    runInAction(() => {
      this.contextInitParams = {
        ...this.contextInitParams,
        no_extra_bufts,
      };
    });
  };

  /**
   * Get effective context initialization parameters with constraints applied
   * This is the unified method that replaces both getEffectiveBatchValues and getEffectiveInitSettings
   */
  getEffectiveContextInitParams = async (
    filePath?: string,
    modelId?: string,
  ): Promise<Omit<ContextParams, 'model'>> => {
    // Apply batch constraints（n_ctx 每模型独立：加载哪个模型取哪个覆盖）
    const effectiveContext = this.getModelNCtx(modelId);
    const effectiveBatch = Math.min(
      this.contextInitParams.n_batch,
      effectiveContext,
    );
    const effectiveUBatch = Math.min(
      this.contextInitParams.n_ubatch,
      effectiveBatch,
    );

    // Resolve the effective use_mmap value based on the setting
    const currentUseMmap = this.contextInitParams.use_mmap;
    let effectiveUseMmap: boolean;

    if (currentUseMmap === 'smart') {
      // Handle 'smart' option
      effectiveUseMmap = filePath
        ? await resolveUseMmap('smart', filePath)
        : true;
    } else if (currentUseMmap === 'true') {
      effectiveUseMmap = true;
    } else if (currentUseMmap === 'false') {
      effectiveUseMmap = false;
    } else {
      // Default fallback
      effectiveUseMmap = true;
    }

    // Handle flash_attn_type (v2.0) - platform-specific default
    const flash_attn_type =
      this.contextInitParams.flash_attn_type ??
      (Platform.OS === 'ios' ? 'auto' : 'off');

    // Build the params object, filtering out undefined values
    const params: Partial<Omit<ContextParams, 'model'>> = {
      n_ctx: effectiveContext,
      n_batch: effectiveBatch,
      n_ubatch: effectiveUBatch,
      n_threads: this.contextInitParams.n_threads,
      flash_attn_type, // NEW: replaces flash_attn boolean
      cache_type_k: this.contextInitParams.cache_type_k,
      cache_type_v: this.contextInitParams.cache_type_v,
      n_gpu_layers: this.contextInitParams.n_gpu_layers ?? 99,
      devices: this.contextInitParams.devices, // NEW
      kv_unified: this.contextInitParams.kv_unified ?? true, // NEW (default true!)
      n_parallel: this.contextInitParams.n_parallel ?? 1, // NEW (1 for blocking mode only)
      use_mlock: this.contextInitParams.use_mlock,
      use_mmap: effectiveUseMmap,
      no_extra_bufts: this.contextInitParams.no_extra_bufts,
    };

    // Remove undefined values from the params object
    return Object.fromEntries(
      Object.entries(params).filter(([_, value]) => value !== undefined),
    ) as Omit<ContextParams, 'model'>;
  };

  // Legacy methods for backward compatibility

  /** @deprecated Use getEffectiveContextInitParams instead */
  getEffectiveBatchValues = () => {
    const effectiveContext = this.contextInitParams.n_ctx;
    const effectiveBatch = Math.min(
      this.contextInitParams.n_batch,
      effectiveContext,
    );
    const effectiveUBatch = Math.min(
      this.contextInitParams.n_ubatch,
      effectiveBatch,
    );

    return {
      n_ctx: effectiveContext,
      n_batch: effectiveBatch,
      n_ubatch: effectiveUBatch,
    };
  };

  /** @deprecated Use getEffectiveContextInitParams instead */
  getEffectiveInitSettings = async (
    filePath?: string,
  ): Promise<Omit<ContextParams, 'model'>> => {
    return this.getEffectiveContextInitParams(filePath);
  };

  /** @deprecated Use getEffectiveBatchValues instead */
  getEffectiveValues = () => {
    return this.getEffectiveBatchValues();
  };

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

  // Resolve the preset list from the fixed catalog (MODEL_MATRIX 代码化单一事实源) —
  // no network, no upstream rules. Populates the full LLM list immediately on
  // first launch: every catalog entry materializes as a stub (source-less ones
  // render without a download button), downloaded models are kept as-is by
  // merge/reconcile keyed on model.id.
  private resolvePresets = async (): Promise<Model[]> => {
    try {
      return this.resolveCatalogPresets();
    } catch (error) {
      console.warn('[ModelStore] catalog preset resolution failed:', error);
      return [];
    }
  };

  // Materialize the full LLM catalog as origin:HF stubs (identical to an
  // HF-browser add, mirrors the old rules path). Entries with an HF repo get
  // the deterministic download URL from the first available source; entries
  // without any online source (e.g. PC-pushed butler) get a source-less stub
  // so the model is still visible and manageable. Multimodal entries also push
  // their mmproj projector stub so the projection is resolvable for download.
  // Deduped by model.id (author/repo/filename), first wins.
  resolveCatalogPresets = (): Model[] => {
    const flat: Model[] = [];
    for (const entry of CATALOG_LLM) {
      const pair = this.catalogEntryToPair(entry);
      if (!pair) {
        flat.push(this.catalogSourceLessStub(entry));
        continue;
      }
      flat.push({
        ...hfAsModel(pair.hfModel, pair.modelFile),
        name: entry.displayName,
        isRulePreset: true,
      });
      for (const extra of entry.extras ?? []) {
        if (!/mmproj/i.test(extra.name)) {
          continue;
        }
        const projPair = this.catalogEntryToPair(entry, extra);
        if (projPair) {
          flat.push({
            ...hfAsModel(projPair.hfModel, projPair.modelFile),
            isRulePreset: true,
          });
        }
      }
    }
    const seen = new Set<string>();
    const presets: Model[] = [];
    for (const model of flat) {
      if (seen.has(model.id)) {
        continue;
      }
      seen.add(model.id);
      presets.push(model);
    }
    return presets;
  };

  // Synthesize the minimal {hfModel, modelFile} pair the unchanged hfAsModel
  // reads from a catalog entry, with no network. The download URL is pinned to
  // the first declared source; HF-derivable data (oid/lfs/templates) resolves at
  // download. An explicit extra file (mmproj) builds its own pair; the main
  // file + extras form the siblings for vision pairing.
  private catalogEntryToPair = (
    entry: CatalogModel,
    extraFile?: CatalogFile,
  ): {hfModel: HuggingFaceModel; modelFile: ModelFile} | null => {
    if (!entry.hfRepo) {
      return null;
    }
    const sources = getAvailableSources(entry);
    const defaultSource: DownloadSource = sources[0] ?? 'hf';
    const repo = repoForSource(entry, defaultSource) ?? entry.hfRepo;
    const file = extraFile ?? entry.file;
    const filename = file.name;
    const sizeBytes = file.sizeBytes;
    const modelFile: ModelFile = {
      rfilename: filename,
      // 本地落盘名与远程路径解耦：远程改名/子目录由 fileRemotePath 解析
      url: resolveDownloadUrl(
        repo,
        fileRemotePath(file, defaultSource),
        defaultSource,
      ),
      size: sizeBytes,
    };
    const siblings: ModelFile[] = [
      {
        rfilename: entry.file.name,
        size: entry.file.sizeBytes,
        url: resolveDownloadUrl(
          repo,
          fileRemotePath(entry.file, defaultSource),
          defaultSource,
        ),
      },
      ...(entry.extras ?? []).map(f => ({
        rfilename: f.name,
        url: resolveDownloadUrl(
          repo,
          fileRemotePath(f, defaultSource),
          defaultSource,
        ),
        size: f.sizeBytes,
      })),
    ];
    const hfModel = {
      id: entry.hfRepo,
      author: entry.hfRepo.split('/')[0],
      url: `https://huggingface.co/${entry.hfRepo}`,
      specs: {gguf: {total: 0}},
      siblings,
    } as unknown as HuggingFaceModel;
    return {hfModel, modelFile};
  };

  // Source-less catalog entry (no online repo): a stub that is visible and
  // manageable but has no download URL (download button suppressed by guard).
  // The filename matches the shared-storage file so scanLocalModels adoptExisting
  // redirects it once the file is on device.
  private catalogSourceLessStub = (entry: CatalogModel): Model => {
    const filename = entry.file.name;
    const hfModel = {
      id: `unknown/${filename}`,
      author: 'unknown',
      url: '',
      specs: undefined,
      siblings: [],
    } as unknown as HuggingFaceModel;
    const modelFile: ModelFile = {
      rfilename: filename,
      size: entry.file.sizeBytes,
      url: '',
    };
    return {
      ...hfAsModel(hfModel, modelFile),
      name: entry.displayName,
      isRulePreset: true,
    };
  };

  // 生图清单条目（模型页渲染，2026-08-20 catalog 对齐）：状态由
  // refreshCatalogImageGenStatus 刷新（main 文件存在 = 已下载）。生图条目不进
  // models 数组——与 LLM 列表完全隔离（路由专工：聊天页 LLM-only、生图页
  // manifest-only，均不触碰）。
  catalogImageGenEntries: {entry: CatalogModel; isDownloaded: boolean}[] = [];

  // 刷新生图条目下载状态（ModelsScreen 挂载/下载完成/下拉刷新时调用）
  // 2026-08-22 Box 清单项 4 收口1：完成态诚实——main 或任一 companion 缺失
  // 都不得显示「已下载」（原只看 main，缺 companions 的套件被误报完整）。
  // 复用 catalog 文件清单（file + extras）逐文件探测，零新逻辑。
  refreshCatalogImageGenStatus = async () => {
    const next: {entry: CatalogModel; isDownloaded: boolean}[] = [];
    for (const entry of CATALOG_IMAGEGEN) {
      const allFiles = [entry.file, ...(entry.extras ?? [])];
      let allExist = true;
      for (const file of allFiles) {
        const dir =
          file.dir === 'dreamlite' ? `${AIOS_ROOT}/dreamlite` : AIOS_MODELS_DIR;
        let exists = false;
        try {
          exists = await RNFS.exists(`${dir}/${file.name}`);
        } catch {
          exists = false;
        }
        if (!exists) {
          allExist = false;
          break;
        }
      }
      next.push({entry, isDownloaded: allExist});
    }
    runInAction(() => {
      this.catalogImageGenEntries = next;
    });
  };

  // 生图套件是否任一文件下载中（UI 行内按钮状态）
  isCatalogEntryDownloading = (entryId: string): boolean => {
    const entry = catalogEntryById(entryId);
    if (!entry) {
      return false;
    }
    return [entry.file, ...(entry.extras ?? [])].some(f =>
      downloadManager.isDownloading(`${entryId}/${f.name}`),
    );
  };

  // 生图套件下载：逐文件 startDownload（同一 catalog 源，落 AIOS 共享目录——
  // 生图页扫描源），单文件失败显式报错并停止（不静默跳过——锋利）。
  // 跨仓套件（SD3.5/Z-Image companions 分布多仓）按文件解析 repo/远程路径：
  // 文件在首选源无 repo 时自动回退其余可用源。完成回调刷新条目下载状态。
  // 权限守卫与 checkSpaceAndDownload 同点挂接（守卫 hook 指南针统一下载入口）。
  downloadCatalogEntry = async (
    entryId: string,
    source: DownloadSource,
  ): Promise<void> => {
    const entry = catalogEntryById(entryId);
    if (!entry) {
      throw new Error(`Catalog entry not found: ${entryId}`);
    }
    if (!(await ensureStorageAccess())) {
      throw new Error('Storage permission not granted for catalog download');
    }
    const files = [entry.file, ...(entry.extras ?? [])];
    // 单次预扫描驱动「存储守卫 + 去重」（2026-08-22 Box 清单项 4 收口2 + 项 5）：
    // 生图下载链此前只查权限、不查存储——klein ~7GB 级套件入库前必须先挂存储闸门。
    // 增量判定 = 未存在文件总和（共享文件 TE zimage_llm.gguf 被 Z-Image/klein 共用，
    // 已存在则不占新空间，避免"已装 Z-Image 再装 klein"被总量误杀）。单一路径，不双扫。
    const pending = await (async () => {
      const list: {
        file: CatalogFile;
        destinationPath: string;
        exists: boolean;
      }[] = [];
      for (const file of files) {
        const destDir =
          file.dir === 'dreamlite' ? `${AIOS_ROOT}/dreamlite` : AIOS_MODELS_DIR;
        const destinationPath = `${destDir}/${file.name}`;
        let exists = false;
        try {
          exists = await RNFS.exists(destinationPath);
        } catch {
          exists = false;
        }
        list.push({file, destinationPath, exists});
      }
      return list;
    })();
    const pendingBytes = pending
      .filter(f => !f.exists)
      .reduce((sum, f) => sum + f.file.sizeBytes, 0);
    if (pendingBytes > 0) {
      const freeBytes = await DeviceInfo.getFreeDiskStorage('important');
      if (pendingBytes > freeBytes) {
        throw new Error(
          `Insufficient storage for catalog suite: need ${Math.ceil(
            pendingBytes / 1073741824,
          )}GB, free ${Math.round(freeBytes / 1073741824)}GB`,
        );
      }
    }
    for (const {file, destinationPath, exists} of pending) {
      if (exists) {
        // 去重：共享文件已存在则跳过重下，显式日志不静默（不做哈希校验——
        // 哈希为不存在的损坏场景兜底，锋利：不预支成本）
        console.log(
          `[ModelStore] 复用已存在共享文件，跳过下载: ${file.name}`,
        );
        continue;
      }
      const resolved = resolveFileSource(file, entry, source);
      if (!resolved) {
        throw new Error(
          `No download source for catalog file: ${entryId}/${file.name}`,
        );
      }
      const stub = this.catalogFileStub(entry, file, resolved);
      const authToken =
        resolved.source === 'hf' && hfStore.shouldUseToken
          ? hfStore.hfToken
          : null;
      await downloadManager.startDownload(stub, destinationPath, authToken);
    }
    await this.refreshCatalogImageGenStatus();
  };

  // 生图套件单文件 stub（id = 条目 id + 文件名，downloadManager 按此跟踪；
  // rfilename = 本地落盘名，url = 远程 URL——远程改名/子目录由
  // fileRemotePath 解析，两字段解耦）
  private catalogFileStub = (
    entry: CatalogModel,
    file: CatalogFile,
    resolved: {source: DownloadSource; repo: string},
  ): Model => {
    const hfModel = {
      id: entry.id,
      author: resolved.repo.split('/')[0] ?? 'unknown',
      url: '',
      specs: undefined,
      siblings: [],
    } as unknown as HuggingFaceModel;
    const modelFile: ModelFile = {
      rfilename: file.name,
      size: file.sizeBytes,
      url: resolveDownloadUrl(
        resolved.repo,
        fileRemotePath(file, resolved.source),
        resolved.source,
      ),
    };
    return hfAsModel(hfModel, modelFile);
  };

  // Reconcile the freshly-resolved catalog presets into the model list. Keyed on the
  // full model id (author/repo/filename), which spans origins: a downloaded
  // legacy PRESET and a new origin:HF catalog stub share it, so the kept download
  // suppresses the stub (no duplicate card, no re-download).
  //
  // Two-sided so the list stays equal to the current catalog set:
  //  - prune non-downloaded preset-provenance stubs no longer in the fresh set
  //    (a newer catalog dropped them, or the device re-tiered). Downloaded
  //    models of any origin and user-added HF/LOCAL models are never pruned.
  //  - append the fresh presets not already represented by a kept model.
  reconcilePresets = (presets: Model[]) => {
    if (presets.length === 0) {
      return;
    }
    const freshIds = new Set(presets.map(p => p.id));
    const kept = this.models.filter(
      m => !(m.isRulePreset && !m.isDownloaded && !freshIds.has(m.id)),
    );
    const existing = new Set(kept.map(m => m.id));
    const toAdd = presets.filter(p => !existing.has(p.id));
    if (kept.length === this.models.length && toAdd.length === 0) {
      return;
    }
    runInAction(() => {
      this.models = [...kept, ...toAdd];
    });
  };

  mergeModelLists = (presets: Model[] = []) => {
    // The default list is data-driven: catalog-resolved origin:HF presets
    // replace the old static PRESET array. Keep every downloaded model
    // regardless of origin, drop non-downloaded PRESET stubs, then reconcile
    // the resolved presets in by model.id (author/repo/filename, origin-spanning)
    // so a kept legacy PRESET download suppresses its catalog stub.
    const mergedModels = [...this.models].filter(
      model => model.origin !== ModelOrigin.PRESET || model.isDownloaded,
    );

    // Handle HF and LOCAL models
    mergedModels.forEach(model => {
      if (
        model.origin === ModelOrigin.HF ||
        model.origin === ModelOrigin.LOCAL ||
        model.isLocal
      ) {
        // Reset default settings
        if (model.origin === ModelOrigin.LOCAL || model.isLocal) {
          const defaultSettings = getLocalModelDefaultSettings();
          model.defaultChatTemplate = {...defaultSettings.chatTemplate};
          model.defaultStopWords = defaultSettings.completionParams.stop;
        } else if (model.origin === ModelOrigin.HF) {
          const defaultSettings = getHFDefaultSettings(
            model.hfModel as HuggingFaceModel,
          );
          model.defaultChatTemplate = {...defaultSettings.chatTemplate};
          model.defaultStopWords = defaultSettings.completionParams.stop;
        }

        // Update current settings while preserving any customizations
        model.chatTemplate = deepMerge(
          model.chatTemplate || {},
          model.defaultChatTemplate,
        );
        model.stopWords = [
          ...(model.stopWords || []),
          ...(model.defaultStopWords || []),
        ];

        // Infer repo from model.id if missing (for existing HF models)
        if (model.origin === ModelOrigin.HF && !model.repo) {
          const inferredRepo = inferRepoFromModelId(model.id);
          if (inferredRepo) {
            model.repo = inferredRepo;
            console.log(
              `[ModelStore] Inferred repo "${inferredRepo}" from model.id: ${model.id}`,
            );
          }
        }
      }
    });

    runInAction(() => {
      this.models = mergedModels;
    });

    this.reconcilePresets(presets);

    this.initializeDownloadStatus();
  };

  setupAppStateListener = () => {
    AppState.addEventListener('change', this.handleAppStateChange);
  };

  // Auto-release management methods
  disableAutoRelease = (reason: string) => {
    this.autoReleaseDisabledReasons.add(reason);
    console.log(
      `Auto-release disabled: ${reason}`,
      Array.from(this.autoReleaseDisabledReasons),
    );
  };

  enableAutoRelease = (reason: string) => {
    this.autoReleaseDisabledReasons.delete(reason);
    console.log(
      `Auto-release enabled: ${reason}`,
      Array.from(this.autoReleaseDisabledReasons),
    );
  };

  get isAutoReleaseEnabled() {
    return this.useAutoRelease && this.autoReleaseDisabledReasons.size === 0;
  }

  private markAutoReleased = (modelId: string) => {
    // Skip auto-release for remote models (no native context to release)
    const model = this.activeModel;
    if (model?.origin === ModelOrigin.REMOTE) {
      return;
    }
    console.log('Marking auto-released: ', modelId);
    runInAction(() => {
      this.wasAutoReleased = true;
      this.lastAutoReleasedModelId = modelId;
    });
  };

  private clearAutoReleaseFlags = () => {
    console.log('Clearing auto-release flags');
    runInAction(() => {
      this.wasAutoReleased = false;
      this.lastAutoReleasedModelId = undefined;
    });
  };

  checkAndReloadAutoReleasedModel = async () => {
    if (this.wasAutoReleased && this.lastAutoReleasedModelId) {
      // Skip if the auto-released model ID refers to a remote model
      if (this.lastAutoReleasedModelId.includes('/')) {
        const remoteModel = this.remoteModels.find(
          m => m.id === this.lastAutoReleasedModelId,
        );
        if (remoteModel) {
          this.clearAutoReleaseFlags();
          return;
        }
      }
      const model = this.models.find(
        m => m.id === this.lastAutoReleasedModelId && m.isDownloaded,
      );
      if (model) {
        console.log('Reloading auto-released model:', model.id);
        await this.initContext(model);
      }
      this.clearAutoReleaseFlags();
    }
  };

  handleAppStateChange = async (nextAppState: AppStateStatus) => {
    console.log(`App state change: ${this.appState} → ${nextAppState}`);

    if (
      this.appState.match(/inactive|background/) &&
      nextAppState === 'active'
    ) {
      // Coming to foreground - check if we need to reload auto-released model
      await this.checkAndReloadAutoReleasedModel();
      this.reprobeRemoteCapsIfUnknown();
      // 授权返回后重扫（task-7c3e）：MANAGE 权限在系统设置页授予后回到 App，
      // 模型列表自动出现，无需重启。
      this.scanLocalModels();
      this.refreshCatalogImageGenStatus();
    } else if (this.appState === 'active' && nextAppState === 'inactive') {
      // active → inactive: NO action (per requirements)
      console.log('Active → Inactive: No auto-release action');
    } else if (this.appState === 'inactive' && nextAppState === 'background') {
      // inactive → background: release if enabled
      // Skip for remote models — no native context to release, and
      // releaseContext() would clear the engine with no reload path.
      // 夜间长任务模式（§7.1）：生图/视频任务进行中不释放——
      // releaseContext 会释放 image 引擎互斥槽，与长任务抢内存。
      if (
        this.isAutoReleaseEnabled &&
        this.activeModelId &&
        this.activeModel?.origin !== ModelOrigin.REMOTE &&
        !nightTaskRegistry.isBusy
      ) {
        console.log('Inactive → Background: Auto-releasing context');
        this.markAutoReleased(this.activeModelId);
        await this.releaseContext();
      } else if (nightTaskRegistry.isBusy) {
        console.log('Inactive → Background: night task active, keep context');
      }
    } else if (this.appState === 'active' && nextAppState === 'background') {
      // active → background: release if enabled (direct transition)
      // Skip for remote models — same reason as above.
      // 夜间长任务模式（§7.1）：同 inactive 分支，任务进行中不释放。
      if (
        this.isAutoReleaseEnabled &&
        this.activeModelId &&
        this.activeModel?.origin !== ModelOrigin.REMOTE &&
        !nightTaskRegistry.isBusy
      ) {
        console.log('Active → Background: Auto-releasing context');
        this.markAutoReleased(this.activeModelId);
        await this.releaseContext();
      } else if (nightTaskRegistry.isBusy) {
        console.log('Active → Background: night task active, keep context');
      }
    }

    runInAction(() => {
      this.appState = nextAppState;
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
  private reprobeRemoteCapsIfUnknown = () => {
    const model = this.activeModel;
    if (
      model?.origin !== ModelOrigin.REMOTE ||
      !model.serverId ||
      !model.remoteModelId ||
      capsMatchBinding(
        serverStore.remoteCaps[model.id],
        this.activeRemoteBinding,
        model.id,
      )
    ) {
      return;
    }
    const binding = this.activeRemoteBinding;
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

  reinitializeContext = async () => {
    if (this.activeModelId) {
      const model = this.models.find(m => m.id === this.activeModelId);
      if (model) {
        await this.initContext(model);
      }
    }
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
  getModelFullPath = async (model: Model): Promise<string> => {
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

  async checkFileExists(model: Model) {
    const filePath = await this.getModelFullPath(model);
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
  }

  refreshDownloadStatuses = async () => {
    this.models.forEach(model => {
      this.checkFileExists(model);
    });
  };

  initializeDownloadStatus = async () => {
    await this.refreshDownloadStatuses();
  };

  removeInvalidLocalModels = () => {
    runInAction(() => {
      this.models = this.models.filter(
        model =>
          // Keep all non-local models (preset and HF)
          !(model.isLocal || model.origin === ModelOrigin.LOCAL) ||
          // This condition ensures that we keep models that are downloaded.
          // For local models, isDownloaded==true means the file exists, otherwise it's invalid.
          model.isDownloaded,
      );
    });
  };

  /**
   * Private method to handle projection model download for vision models
   * @param model The vision model that needs its projection model downloaded
   */
  private _downloadProjectionModelIfNeeded = async (
    model: Model,
    source?: DownloadSource,
  ) => {
    // Only auto-download for vision models that aren't projection models themselves
    if (
      !model.supportsMultimodal ||
      !model.defaultProjectionModel ||
      model.modelType === ModelType.PROJECTION
    ) {
      return;
    }

    // Check if vision is enabled for this model (uses getModelVisionPreference for proper default handling)
    if (!this.getModelVisionPreference(model)) {
      console.log(
        'Vision disabled for model, skipping projection model download:',
        model.id,
      );
      return;
    }

    const projModelId = model.defaultProjectionModel;
    const projModel = this.models.find(m => m.id === projModelId);

    if (
      projModel &&
      !projModel.isDownloaded &&
      !downloadManager.isDownloading(projModelId)
    ) {
      console.log('Auto-downloading projection model for vision model:', {
        llm: model.id,
        projection: projModelId,
      });

      try {
        // Download the projection model
        await this.checkSpaceAndDownload(projModelId, source);
      } catch (error) {
        console.error('Failed to auto-download projection model:', error);
        // Don't re-throw - projection model download failure shouldn't fail the main model download
        // The user can manually download the projection model later if needed
      }
    }
  };

  checkSpaceAndDownload = async (
    modelId: string,
    source?: DownloadSource,
  ) => {
    const model = this.models.find(m => m.id === modelId);
    if (!model) {
      throw new Error(`Model not found for download: ${modelId}`);
    }
    // 幂等：已下载/本地模型不重复下载（非错误，静默返回）
    if (model.isDownloaded || model.isLocal || model.origin === ModelOrigin.LOCAL) {
      return;
    }
    if (!model.downloadUrl) {
      throw new Error(`Model has no download URL: ${modelId}`);
    }

    try {
      // 权限守卫（守卫 hook 指南针）：统一下载入口单点挂接，覆盖 ModelCard/
      // downloadHFModel/双源弹窗全入口；不可读时已弹「所有文件访问」引导。
      if (!(await ensureStorageAccess())) {
        throw new Error('Storage permission not granted for model download');
      }
      const destinationPath = await this.getModelFullPath(model);
      const authToken = hfStore.shouldUseToken ? hfStore.hfToken : null;
      // 显式源（HF/ModelScope 双源，2026-08-20）：catalog 条目按所选源重建
      // downloadUrl（远程路径走 fileRemotePath——本地落盘名≠远程名时不可用
      // 本地名拼 URL，否则 404）；token 守卫在 downloadManager（非 HF 恒不带）。
      let downloadModel = model;
      if (source) {
        const entry = catalogEntryByFilename(model.filename);
        const file =
          entry?.file.name === model.filename
            ? entry.file
            : entry?.extras?.find(f => f.name === model.filename);
        const repo = entry ? repoForSource(entry, source) : undefined;
        if (repo && file) {
          downloadModel = {
            ...model,
            downloadUrl: resolveDownloadUrl(
              repo,
              fileRemotePath(file, source),
              source,
            ),
          };
        }
      }
      await downloadManager.startDownload(
        downloadModel,
        destinationPath,
        authToken,
      );

      // For vision models, automatically download the projection model
      await this._downloadProjectionModelIfNeeded(model, source);
    } catch (err) {
      if (err instanceof DownloadCancelledError) {
        // User cancelled — not a failure. Don't surface an error and don't
        // chain the projection-model download for multimodal models.
        return;
      }

      console.error('Failed to start download:', err);

      // Create proper error state for the snackbar system
      const errorState = createErrorState(err, 'download', 'huggingface', {
        modelId,
      });

      runInAction(() => {
        this.downloadError = errorState;
      });

      // Re-throw so the caller knows the download failed
      throw err;
    }
  };

  cancelDownload = async (modelId: string) => {
    await downloadManager.cancelDownload(modelId);
    const model = this.models.find(m => m.id === modelId);
    if (model) {
      runInAction(() => {
        model.isDownloaded = false;
        model.progress = 0;
      });
    }
    this.refreshDownloadStatuses();
  };

  get isDownloading() {
    return (modelId: string) => downloadManager.isDownloading(modelId);
  }

  getDownloadProgress = (modelId: string) => {
    return downloadManager.getDownloadProgress(modelId);
  };

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
   * Removes a model from the models list if it is not downloaded.
   * @param modelId - The ID of the model to remove.
   * @returns boolean - Returns true if the model was removed, false otherwise.
   */
  removeModelFromList = (model: Model): boolean => {
    const modelIndex = this.models.findIndex(
      m => m.id === model.id && m.origin === model.origin,
    );
    if (modelIndex !== -1) {
      const _model = this.models[modelIndex];
      if (!_model.isDownloaded) {
        runInAction(() => {
          this.models.splice(modelIndex, 1);
        });
        return true;
      }
    }
    return false;
  };

  deleteModel = async (model: Model) => {
    // id should work as well, as long as we are differentiating between models by origin.
    const modelIndex = this.models.findIndex(
      m => m.id === model.id && m.origin === model.origin,
    );
    if (modelIndex === -1) {
      return;
    }
    const _model = this.models[modelIndex];

    // Special handling for projection models
    if (_model.modelType === ModelType.PROJECTION) {
      const canDeleteResult = this.canDeleteProjectionModel(_model.id);
      if (!canDeleteResult.canDelete) {
        throw new Error(
          canDeleteResult.reason || 'Cannot delete projection model',
        );
      }

      // Disable vision for dependent models when their projection model is deleted
      if (
        canDeleteResult.dependentModels &&
        canDeleteResult.dependentModels.length > 0
      ) {
        // Use Promise.allSettled to handle potential errors gracefully
        await Promise.allSettled(
          canDeleteResult.dependentModels.map(dependentModel =>
            this.setModelVisionEnabled(dependentModel.id, false),
          ),
        );
      }
    }

    // Store all projection model IDs that this LLM could use
    const projectionModelIds: string[] = [];
    if (_model.supportsMultimodal) {
      // Add the default projection model
      if (_model.defaultProjectionModel) {
        projectionModelIds.push(_model.defaultProjectionModel);
      }
      // Add all compatible projection models (in case user downloaded additional ones)
      if (_model.compatibleProjectionModels) {
        _model.compatibleProjectionModels.forEach(id => {
          if (!projectionModelIds.includes(id)) {
            projectionModelIds.push(id);
          }
        });
      }
    }

    const filePath = await this.getModelFullPath(_model);
    if (_model.isLocal || _model.origin === ModelOrigin.LOCAL) {
      // Local models are always removed from the list, when the file is deleted.

      // Check if we need to release context (if this model is currently active)
      const needsContextRelease = this.activeModelId === _model.id;

      // Remove model from list first
      runInAction(() => {
        this.models.splice(modelIndex, 1);
      });

      // Release context if needed - this will handle all state cleanup
      if (needsContextRelease) {
        await this.releaseContext(true); // Clear active model and all related state
      }

      // Delete the file from internal storage
      try {
        await RNFS.unlink(filePath);
      } catch (err) {
        console.error('Failed to delete local model file:', err);
      }
    } else {
      // Non-local models are not removed from the list, when the file is deleted.
      console.log('deleting: ', filePath);

      try {
        if (filePath) {
          await RNFS.unlink(filePath);

          // Check if we need to release context (if this model is currently active)
          const needsContextRelease = this.activeModelId === _model.id;

          // Update model state first
          runInAction(() => {
            _model.progress = 0;
            _model.isDownloaded = false; // Mark as not downloaded after successful deletion
          });

          // Release context if needed - this will handle all state cleanup
          if (needsContextRelease) {
            await this.releaseContext(true); // Clear active model and all related state
          }

          //console.log('models: ', this.models);
        } else {
          console.error("Failed to delete, file doesn't exist: ", filePath);
        }
        this.refreshDownloadStatuses();
      } catch (err) {
        console.error('Failed to delete:', err);
      }
    }

    // After deleting an LLM, check if any of its projection models have become orphaned
    if (
      projectionModelIds.length > 0 &&
      _model.modelType !== ModelType.PROJECTION
    ) {
      await this.cleanupOrphanedProjectionModels(projectionModelIds);
    }
  };

  /**
   * Fetch and persist GGUF metadata for a downloaded model
   * Called after download completes to enable accurate memory estimation
   */
  fetchAndPersistGGUFMetadata = async (model: Model) => {
    try {
      const filePath = await this.getModelFullPath(model);
      if (!filePath) {
        console.warn(
          '[ModelStore] Cannot fetch GGUF metadata: model path is undefined',
        );
        return;
      }

      const modelInfo = await loadLlamaModelInfo(filePath);
      if (!modelInfo || typeof modelInfo !== 'object') {
        console.warn('[ModelStore] Invalid model info returned');
        return;
      }

      // Default vocab sizes by architecture (matches Python memory_estimator.py)
      const ARCH_DEFAULT_VOCAB: Record<string, number> = {
        llama: 128256,
        gemma2: 256000,
        gemma3n: 262144,
        qwen2: 151936,
        qwen3: 151936,
        lfm2: 65536,
        phi3: 32064,
        mistral: 32000,
        deepseek2: 102400,
        clip: 49408, // CLIP models have smaller vocab
      };

      // Get the architecture to determine the correct key prefix
      const architecture: string =
        (modelInfo as any)['general.architecture'] || 'llama';

      // Helper to get architecture-specific value with fallback (matches Python get_arch_value)
      const getArchValue = (
        field: string,
        defaultValue?: number,
      ): number | undefined => {
        const key = `${architecture}.${field}`;
        const value = (modelInfo as any)[key];
        if (value !== undefined && value !== null) {
          // Handle string values (GGUF sometimes returns strings)
          if (typeof value === 'string') {
            const parsed = value.includes('.')
              ? parseFloat(value)
              : parseInt(value, 10);
            return isNaN(parsed) ? defaultValue : parsed;
          }
          return typeof value === 'number' ? value : defaultValue;
        }
        return defaultValue;
      };

      // Extract core fields (these are required)
      const n_layers = getArchValue('block_count');
      const n_embd = getArchValue('embedding_length');
      const n_head = getArchValue('attention.head_count');

      // Validate core fields exist - without these we can't estimate memory
      if (!n_layers || !n_embd || !n_head) {
        return;
      }

      // Extract optional fields with fallbacks (matches Python ModelInfo.__post_init__)
      const n_head_kv = getArchValue('attention.head_count_kv', n_head); // fallback to n_head
      const n_vocab =
        getArchValue('vocab_size') ||
        ARCH_DEFAULT_VOCAB[architecture] ||
        128000;

      // Derive head dimensions if not present (matches Python)
      const n_embd_head_k =
        getArchValue('attention.key_length') || Math.floor(n_embd / n_head);
      const n_embd_head_v =
        getArchValue('attention.value_length') || Math.floor(n_embd / n_head);

      // SWA (Sliding Window Attention) - optional
      const sliding_window = getArchValue('attention.sliding_window');

      // Context length from GGUF
      const context_length = getArchValue('context_length');

      const metadata = {
        architecture,
        n_layers,
        n_embd,
        n_head,
        n_head_kv: n_head_kv!,
        n_vocab,
        n_embd_head_k,
        n_embd_head_v,
        sliding_window,
        context_length,
      };

      const paramCount = parseSizeLabel(
        (modelInfo as any)['general.size_label'],
      );

      runInAction(() => {
        model.ggufMetadata = metadata;
        if (!model.params && paramCount) {
          model.params = paramCount;
        }
      });
    } catch (error) {
      console.warn('[ModelStore] Failed to fetch GGUF metadata:', error);
    }
  };

  /**
   * Load GGUF metadata for downloaded models that don't have it yet.
   * Runs in background, doesn't block startup.
   */
  private loadMissingGGUFMetadata = () => {
    const modelsNeedingMetadata = this.models.filter(
      m =>
        m.isDownloaded &&
        !m.ggufMetadata &&
        m.modelType !== ModelType.PROJECTION,
    );

    if (modelsNeedingMetadata.length === 0) {
      return;
    }

    // Fetch in background, don't block startup
    (async () => {
      for (const model of modelsNeedingMetadata) {
        try {
          await this.fetchAndPersistGGUFMetadata(model);
        } catch (error) {
          // Log but continue - not critical for startup
          console.warn(
            '[ModelStore] Failed to fetch metadata for',
            model.name,
            error,
          );
        }
      }
    })();
  };

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
  private resolveMultimodalConfig = async (
    model: Model,
    mmProjPath?: string,
  ): Promise<{
    isMultimodalInit: boolean;
    resolvedMmProjPath?: string;
    projectionModel?: Model;
  }> => {
    const visionEnabled = this.getModelVisionPreference(model);

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
      const projectionModel = this.models.find(
        m => m.id === model.defaultProjectionModel,
      );
      if (projectionModel?.isDownloaded) {
        const resolvedPath = await this.getModelFullPath(projectionModel);
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
  private checkMemoryAndConfirm = async (
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
  enterBenchmarkMode = async (): Promise<void> => {
    runInAction(() => {
      this.benchmarkActive = true;
    });

    const op = this.contextOperationMutex.then(async () => {
      // Release any context the rest of the app loaded (e.g. ChatView's
      // auto-load on cold launch). clearActiveModel:true so the queued
      // post-mutex callers see a clean slate if they ever run.
      await this._releaseContextInternal(true);
    });
    this.contextOperationMutex = op.then(() => {}).catch(() => {});
    await op;
  };

  /**
   * Hand context ownership back to the rest of the app. Intentionally
   * trivial — no native work — so it's safe to call from a `finally` block.
   */
  exitBenchmarkMode = (): void => {
    runInAction(() => {
      this.benchmarkActive = false;
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
  initContext = async (model: Model, mmProjPath?: string) => {
    // Benchmark mode owns the native context lifecycle end-to-end.
    // Reject synchronously so any racing caller (ChatView auto-load, header,
    // sheet) fails fast instead of silently shadowing the matrix's per-cell
    // devices / n_gpu_layers via the "already loaded → skip" path.
    if (this.benchmarkActive) {
      throw new Error(
        '[ModelStore] initContext rejected: benchmark mode is active',
      );
    }

    // === Phase 1: Pre-flight checks OUTSIDE mutex ===

    // Mark intent immediately - this is the "last-one-wins" tracking
    // If another model is requested while we're showing an Alert, their
    // pendingModelId will overwrite ours and we'll detect it later
    this.pendingModelId = model.id;

    // Set loading state immediately for UI feedback
    runInAction(() => {
      this.isContextLoading = true;
      this.loadingModel = model;
    });

    try {
      // Resolve multimodal configuration
      const {isMultimodalInit, resolvedMmProjPath, projectionModel} =
        await this.resolveMultimodalConfig(model, mmProjPath);

      // Check memory and get user confirmation if needed (no mutex - UI interaction)
      const shouldProceed = await this.checkMemoryAndConfirm(
        model,
        isMultimodalInit,
        projectionModel,
      );

      if (!shouldProceed) {
        throw new Error('Model loading cancelled by user');
      }

      // After Alert (if shown), check if we're still the intended model
      // Another model request might have come in while user was deciding
      if (this.pendingModelId !== model.id) {
        console.log(
          `[ModelStore] Skipping "${model.name}" - user switched to "${this.pendingModelId}" during confirmation`,
        );
        return null;
      }

      // === Phase 2: Execute context operations WITH mutex ===

      const operationPromise = this.contextOperationMutex.then(async () => {
        // A benchmark may have started while this load sat in the mutex
        // queue (cold-launch deep-link race). Bail before doing native work
        // — enterBenchmarkMode will release any context we leave behind.
        if (this.benchmarkActive) {
          console.log(
            `[ModelStore] Skipping queued load for "${model.name}" - benchmark mode is active`,
          );
          return null;
        }

        // Final check if this request is still current (last-one-wins)
        // This catches race conditions where another request queued while we waited
        if (this.pendingModelId !== model.id) {
          console.log(
            `[ModelStore] Skipping outdated load for "${model.name}" - user now wants model "${this.pendingModelId}"`,
          );
          return null;
        }

        // Skip if already loaded
        if (this.activeModelId === model.id && this.context) {
          console.log(
            `[ModelStore] Model "${model.name}" is already loaded, skipping`,
          );
          return this.context;
        }

        // Release existing context
        // 互斥：换 chat 模型前先释放 sd 引擎（engineMutex 自动调 imageGenStore.unloadModel）
        await engineMutex.acquire('chat');
        await this._releaseContextInternal();

        // Small delay for native cleanup before loading next model
        await new Promise(resolve => setTimeout(resolve, 100));

        // Proceed with actual initialization
        return this.proceedWithInitialization(
          model,
          resolvedMmProjPath,
          isMultimodalInit,
          projectionModel,
        );
      });

      // Keep mutex chain intact by swallowing errors
      this.contextOperationMutex = operationPromise
        .then(() => {})
        .catch(() => {});

      return await operationPromise;
    } finally {
      runInAction(() => {
        this.isContextLoading = false;
        this.loadingModel = undefined;
      });
    }
  };

  /**
   * Proceed with the actual model initialization after device capability checks
   */
  private async proceedWithInitialization(
    model: Model,
    mmProjPath?: string,
    isMultimodalInit: boolean = false,
    projectionModel?: Model,
  ): Promise<LlamaContext> {
    const filePath = await this.getModelFullPath(model);
    if (!filePath) {
      throw new Error('Model path is undefined');
    }

    runInAction(() => {
      this.isMultimodalActive = false; // Reset until we confirm it's enabled
      this.activeProjectionModelId = projectionModel?.id;
    });

    // §18.6 每模型预调：无覆盖时按内存 ceiling 预写最大可装档（一次预调、
    // 持久化），赶在 getEffectiveContextInitParams 读取之前。
    this.presetModelNCtxIfAbsent(model, projectionModel);

    // Get all effective initialization settings BEFORE try block
    // so they're available for error reporting if initialization fails
    const effectiveSettings =
      await this.getEffectiveContextInitParams(filePath, model.id);

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

      await this.updateModelStopTokens(ctx, model);

      // Check and update thinking capabilities
      await this.updateModelThinkingCapabilities(ctx, model);

      // Initialize multimodal support if mmproj path was provided
      if (isMultimodalInit && mmProjPath) {
        try {
          console.log('Initializing multimodal support with path:', mmProjPath);

          // Initialize multimodal with the new API format
          // Apply effective value: clamp image_max_tokens to n_ctx
          const success = await ctx.initMultimodal({
            path: mmProjPath,
            use_gpu: !this.contextInitParams.no_gpu_devices,
            image_max_tokens: Math.min(
              this.contextInitParams.image_max_tokens ?? 512,
              this.contextInitParams.n_ctx,
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
              this.isMultimodalActive = isEnabled;
            });
          }
        } catch (error) {
          console.error('Error initializing multimodal support:', error);
          runInAction(() => {
            this.isMultimodalActive = false;
            this.activeProjectionModelId = undefined;
          });
        }
      }

      runInAction(() => {
        this.context = ctx;
        this.engine = new LocalCompletionEngine(ctx);
        this.activeRemoteBinding = undefined;
        this.activeContextSettings = contextInitParams;
        this.setActiveModel(model.id);
        this.pendingModelId = null;
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
            this.largestSuccessfulLoad === undefined ||
            estimated > this.largestSuccessfulLoad
          ) {
            this.largestSuccessfulLoad = estimated;
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
        this.modelLoadError = errorState;
      });

      throw error;
    } finally {
      runInAction(() => {
        this.lastUsedModelId = model.id;
      });
    }
  }

  /** Internal release - caller must already hold the mutex. */
  private _releaseContextInternal = async (
    clearActiveModel: boolean = false,
  ) => {
    console.log('attempt to release');
    chatSessionStore.exitEditMode();
    if (!this.context) {
      // For remote models or deletion scenarios, clear engine and state
      if (this.engine || clearActiveModel) {
        // Stop any active remote completion
        if (this.engine) {
          try {
            await this.engine.stopCompletion();
          } catch {
            // Ignore errors from stopping remote completion
          }
        }
        runInAction(() => {
          this.engine = undefined;
          this.activeRemoteBinding = undefined;
          if (clearActiveModel) {
            this.activeModelId = undefined;
          }
          this.isMultimodalActive = false;
          this.activeProjectionModelId = undefined;
        });
      }
      if (!this.engine && !clearActiveModel) {
        return 'No context to release';
      }
      return 'Remote engine cleared';
    }

    try {
      // IMPORTANT: Stop-Await-Release Pattern
      // This prevents race condition where completion callback fires after context is freed
      // which causes SIGSEGV in isMultimodalEnabled/createCompletionResult
      if (
        this.inferencing ||
        this.isStreaming ||
        this.activeCompletionPromise
      ) {
        console.log('Stopping active completion before context release');

        // Step 1: Signal the completion to stop
        try {
          await this.context.stopCompletion();
        } catch (stopError) {
          console.warn('Error stopping completion:', stopError);
          // Continue with release even if stop fails
        }

        // Step 2: Wait for the completion promise to actually finish
        // This is critical - stopCompletion() only signals, it doesn't wait
        if (this.activeCompletionPromise) {
          console.log('Waiting for completion promise to finish...');
          try {
            // Wait for promise to settle (ignore errors, just wait for it to complete)
            await this.activeCompletionPromise.catch(() => {});
          } catch {
            // Ignore any errors, we just need to wait
          }
          this.activeCompletionPromise = null;
        }

        // Clear inference flags
        runInAction(() => {
          this.inferencing = false;
          this.isStreaming = false;
        });
      }

      // Step 3: Now safe to release - First check if multimodal is enabled and release it if needed
      if (this.isMultimodalActive) {
        console.log('Releasing multimodal context first');
        try {
          await this.context.releaseMultimodal();
          // Immediately clear multimodal state after successful release
          runInAction(() => {
            this.isMultimodalActive = false;
            this.activeProjectionModelId = undefined;
          });
          console.log('Multimodal context released and state cleared');
        } catch (error) {
          console.error('Error releasing multimodal context:', error);
          // Even if release fails, clear the state to prevent blocking deletion
          runInAction(() => {
            this.isMultimodalActive = false;
            this.activeProjectionModelId = undefined;
          });
        }
      }

      // Then release the main context
      await this.context.release();
      console.log('released');
    } catch (error) {
      console.error('Error during context release:', error);
    } finally {
      runInAction(() => {
        this.context = undefined;
        this.engine = undefined;
        this.activeRemoteBinding = undefined;
        this.activeContextSettings = undefined;
        // Ensure multimodal state is cleared even if something went wrong above
        this.isMultimodalActive = false;
        this.activeProjectionModelId = undefined;
        // Clear active model if requested (for deletion scenarios)
        if (clearActiveModel) {
          this.activeModelId = undefined;
        }
      });

      // Update availableMemoryCeiling after release (clean state)
      try {
        const availableBytes = await NativeHardwareInfo.getAvailableMemory();
        runInAction(() => {
          if (
            this.availableMemoryCeiling === undefined ||
            availableBytes > this.availableMemoryCeiling
          ) {
            this.availableMemoryCeiling = availableBytes;
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
  releaseContext = async (clearActiveModel: boolean = false) => {
    const operationPromise = this.contextOperationMutex.then(async () => {
      return this._releaseContextInternal(clearActiveModel);
    });

    // Swallow errors to keep mutex chain intact
    this.contextOperationMutex = operationPromise
      .then(() => {})
      .catch(() => {});

    await operationPromise.catch(() => {});
    engineMutex.release();
    return operationPromise;
  };

  manualReleaseContext = async () => {
    await this.releaseContext(true); // Clear active model for manual release
  };

  get activeModel(): Model | undefined {
    // Look in local models first, then remote models
    return (
      this.models.find(model => model.id === this.activeModelId) ||
      this.remoteModels.find(model => model.id === this.activeModelId)
    );
  }

  private get capabilityEnv(): CapabilityEnv {
    return {
      remoteCaps: serverStore.remoteCaps,
      listCaps: serverStore.listCaps,
      binding: this.activeRemoteBinding,
      isMultimodalActive: this.isMultimodalActive,
      activeContextSettings: this.activeContextSettings,
      activeModelId: this.activeModelId,
    };
  }

  /**
   * Capabilities of any model, active or not — the model card's entry point.
   * Never annotate it explicitly as `action`: that untracks the observable
   * reads, so every card would freeze on its first value while the suite
   * stayed green.
   */
  capsFor = (model: Model | undefined): ModelCapabilityView =>
    resolveModelCaps(model, this.capabilityEnv);

  /** Capabilities of the live session — chat's entry point. */
  get activeModelCaps(): ModelCapabilityView {
    return this.capsFor(this.activeModel);
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

  setActiveModel(modelId: string) {
    this.activeModelId = modelId;
  }

  /**
   * Set a remote model as the active model and create an OpenAI completion engine.
   * Releases any active local context first.
   */
  setRemoteModel = async (model: Model): Promise<void> => {
    if (!model.serverId || !model.remoteModelId) {
      throw new Error('Model is missing remote configuration');
    }

    // Release any existing context (local or remote)
    await this.releaseContext();

    const apiKey = await serverStore.getApiKey(model.serverId);
    const server = serverStore.servers.find(s => s.id === model.serverId);
    if (!server) {
      throw new Error('Server not found');
    }

    runInAction(() => {
      this.engine = new OpenAICompletionEngine(
        server.url,
        model.remoteModelId!,
        apiKey,
        server.requestTimeoutMs,
        server.serverType,
      );
      this.activeRemoteBinding = {
        modelId: model.id,
        serverId: model.serverId!,
        remoteModelId: model.remoteModelId!,
        url: server.url,
        serverType: server.serverType,
      };
      this.setActiveModel(model.id);
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
  selectModel = async (model: Model): Promise<void> => {
    if (model.origin === ModelOrigin.REMOTE) {
      await this.setRemoteModel(model);
    } else {
      await this.initContext(model);
    }
  };

  downloadHFModel = async (
    hfModel: HuggingFaceModel,
    modelFile: ModelFile,
    options?: {
      enableVision?: boolean;
      projectionModelId?: string; // User-selected projection model
    },
  ) => {
    try {
      const newModel = await this.addHFModel(hfModel, modelFile);
      if (!newModel) {
        throw new Error('Failed to add model to store');
      }

      // Set vision preference based on user choice
      if (newModel.supportsMultimodal && options?.enableVision !== undefined) {
        this.setModelVisionEnabled(newModel.id, options.enableVision);
        // runInAction(() => {
        //   newModel.visionEnabled = options.enableVision;
        // });
      }

      // Override default projection model with user selection if provided
      if (newModel.supportsMultimodal && options?.projectionModelId) {
        // Validate that selected projection model exists in repository
        const mmprojFiles = getMmprojFiles(hfModel.siblings || []);
        const selectedExists = mmprojFiles.some(
          file =>
            `${hfModel.id}/${file.rfilename}` === options.projectionModelId,
        );

        if (selectedExists) {
          runInAction(() => {
            newModel.defaultProjectionModel = options.projectionModelId;
          });
        } else {
          console.warn(
            'Selected projection model not found in repository, using auto-determined default',
          );
        }
      }

      // Wait a bit to ensure the projection model is added to the store
      // This is needed because addHFModel adds mmproj models asynchronously
      await new Promise(resolve => setTimeout(resolve, 200));

      // Use the centralized download method which handles mmproj automatically
      this.checkSpaceAndDownload(newModel.id);

      // The error handling is now done in the downloadManager callbacks
    } catch (error) {
      // Only handle errors related to the initial setup before the download starts
      console.error('Failed to set up HF model download:', error);
      Alert.alert(
        uiStore.l10n.errors.downloadSetupFailedTitle,
        t(uiStore.l10n.errors.downloadSetupFailedMessage, {
          message: (error as Error).message,
        }),
      );
    }
  };

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
   * Scan model dirs for .gguf files (B15 双轨：默认目录 ∪ 自定义目录，去重按文件名).
   * Auto-registers models not yet in the store.
   * Called on app startup after ensureAiosDirs().
   */
  scanLocalModels = async () => {
    try {
      // B15（ADR-0004）：扫描范围 = 默认规范目录 ∪ 自定义目录列表；
      // 同名文件仅保留第一个（默认目录优先），后续目录视为重复。
      const dirs = await getAllModelDirs();
      const filesByDir: {dir: string; files: RNFS.ReadDirResItemT[]}[] = [];
      for (const dir of dirs) {
        try {
          if (!(await RNFS.exists(dir))) {
            continue;
          }
          const files = await RNFS.readDir(dir);
          filesByDir.push({dir, files});
        } catch (e) {
          // 单个目录读不到（权限/缺失）不阻断整体扫描
          console.warn(`[ModelStore] scan dir skipped: ${dir}`, e);
        }
      }
      const ggufFiles = filesByDir
        .flatMap(({files}) => files)
        .filter(f => (f.name as string).toLowerCase().endsWith('.gguf'));
      const seenNames = new Set<string>();
      const uniqueGgufFiles = ggufFiles.filter(f => {
        const name = f.name as string;
        if (seenNames.has(name)) {
          return false;
        }
        seenNames.add(name);
        return true;
      });
      const isRegistered = (fullPath: string) =>
        this.models.some(
          m =>
            (m.isLocal || m.origin === ModelOrigin.LOCAL) &&
            m.fullPath === fullPath,
        );

      // 已知同名模型: 不重复注册; 文件丢失则重定向到共享副本; mmproj 条目升级为 projection 类型
      const adoptExisting = async (
        filename: string,
        fullPath: string,
      ): Promise<Model | null> => {
        const existing = this.models.find(m => m.filename === filename);
        if (!existing) {
          return null;
        }
        const oldOk =
          !!existing.fullPath && (await RNFS.exists(existing.fullPath));
        runInAction(() => {
          if (!oldOk) {
            existing.fullPath = fullPath;
          }
          if (MMProjRegex.test(filename)) {
            if (existing.modelType !== ModelType.PROJECTION) {
              existing.modelType = ModelType.PROJECTION;
            }
          } else if (existing.modelType === undefined) {
            // 已有同名本地模型（WatermelonDB/预设加载）未标注类型时补 LLM，
            // 否则 isChatSelectable(modelType===LLM) 过滤后聊天列表为空
            existing.modelType = ModelType.LLM;
          }
        });
        return existing;
      };

      // Pass 1: 注册 LLM 模型（跳过 mmproj 与生图模型文件）
      for (const file of uniqueGgufFiles) {
        const filename = file.name as string;
        if (MMProjRegex.test(filename)) {
          continue;
        }
        // 生图模型（manifest 声明）不注册为 LLM，避免污染聊天模型列表
        if (IMAGE_GEN_MODEL_FILES.has(filename)) {
          continue;
        }
        const fullPath = file.path as string;
        if (await adoptExisting(filename, fullPath)) {
          continue;
        }
        if (!isRegistered(fullPath)) {
          await this.addLocalModel(fullPath);
        }
      }

      // Pass 2: 注册 mmproj 视觉模块并自动配对到同基座 LLM
      for (const file of uniqueGgufFiles) {
        const filename = file.name as string;
        if (!MMProjRegex.test(filename)) {
          continue;
        }
        const fullPath = file.path as string;
        const adopted = await adoptExisting(filename, fullPath);
        if (!adopted && !isRegistered(fullPath)) {
          await this.addLocalModel(fullPath);
        }
        // 配对: mmproj-X-base-quant.gguf 的基座名 = 去掉 mmproj 前缀和量化后缀
        const mmprojModel =
          adopted ?? this.models.find(m => m.fullPath === fullPath);
        if (!mmprojModel) {
          continue;
        }
        const base = filename
          .replace(/^[-_.]*mmproj[-_.]/i, '')
          .replace(/\.(gguf)$/i, '')
          .replace(/[-_.](f16|bf16|q\d+[a-z_]*|fp16)$/i, '');
        const target = this.models.find(
          m =>
            m.id !== mmprojModel.id &&
            m.modelType !== ModelType.PROJECTION &&
            (m.filename || '').startsWith(base),
        );
        if (target) {
          runInAction(() => {
            target.supportsMultimodal = true;
            if (!target.compatibleProjectionModels) {
              target.compatibleProjectionModels = [];
            }
            if (!target.compatibleProjectionModels.includes(mmprojModel.id)) {
              target.compatibleProjectionModels.push(mmprojModel.id);
            }
            if (!target.defaultProjectionModel) {
              target.defaultProjectionModel = mmprojModel.id;
            }
          });
          console.log(
            '[ModelStore] mmproj paired: ' + filename + ' -> ' + target.filename,
          );
        }
      }
      runInAction(() => {
        this.lastScanTime = Date.now();
      });
      console.log('[ModelStore] scanLocalModels completed');
    } catch (e) {
      console.warn('[ModelStore] scanLocalModels failed:', e);
    }
  };

  removeModelByFullPath = (fullPath: string) => {
    const index = this.models.findIndex(
      m =>
        (m.isLocal || m.origin === ModelOrigin.LOCAL) &&
        m.fullPath === fullPath,
    );
    if (index !== -1) {
      this.models.splice(index, 1);
    }
  };

  addLocalModel = async (localFilePath: string) => {
    const filename = localFilePath.split('/').pop(); // Extract filename from path
    if (!filename) {
      throw new Error('Invalid local file path');
    }

    // Read file size from disk
    let fileSize = 0;
    try {
      const stat = await RNFS.stat(localFilePath);
      fileSize = Number(stat.size) || 0;
    } catch (e) {
      console.warn('[ModelStore] Failed to read file size:', e);
    }

    const defaultSettings = getLocalModelDefaultSettings();

    const isMmproj = MMProjRegex.test(filename);
    const model: Model = {
      id: uuidv4(), // Generate a unique ID
      author: '',
      name: filename,
      size: fileSize,
      params: 0, // Will be updated after GGUF metadata read
      isDownloaded: true,
      downloadUrl: '',
      hfUrl: '',
      progress: 0,
      filename,
      fullPath: localFilePath,
      isLocal: true, // Kept for backward compatibility
      origin: ModelOrigin.LOCAL,
      // 本地扫描的 gguf 默认为 LLM（聊天可选用）；mmproj 为 PROJECTION。
      // 不设会 undefined → isChatSelectable(modelType===LLM) 过滤后列表空
      modelType: isMmproj ? ModelType.PROJECTION : ModelType.LLM,
      defaultChatTemplate: {...defaultSettings.chatTemplate},
      chatTemplate: {...defaultSettings.chatTemplate},
      defaultStopWords: [...(defaultSettings?.completionParams?.stop || [])],
      stopWords: [...(defaultSettings?.completionParams?.stop || [])],
      defaultCompletionSettings: defaultSettings.completionParams,
      completionSettings: {...defaultSettings.completionParams},
    };

    runInAction(() => {
      this.models.push(model);
      this.refreshDownloadStatuses();
    });

    // Get the MobX observable version — the plain `model` object was wrapped
    // in a proxy when pushed into the observable array. We must pass the proxy
    // so that mutations inside fetchAndPersistGGUFMetadata trigger reactivity.
    const observableModel = this.models.find(m => m.id === model.id);
    if (observableModel) {
      await this.fetchAndPersistGGUFMetadata(observableModel);
    }
  };

  updateModelChatTemplate = (
    modelId: string,
    newConfig: ChatTemplateConfig,
  ) => {
    const model = this.models.find(m => m.id === modelId);
    if (model) {
      runInAction(() => {
        model.chatTemplate = newConfig;
      });
    }
  };

  updateModelStopWords = (
    modelId: string,
    newStopWords: CompletionParams['stop'],
  ) => {
    const model = this.models.find(m => m.id === modelId);
    if (model) {
      runInAction(() => {
        model.stopWords = newStopWords;
      });
    }
  };

  updateModelName = (modelId: string, newName: string) => {
    const model = this.models.find(m => m.id === modelId);
    if (model) {
      runInAction(() => {
        model.name = newName;
      });
    }
  };

  /**
   * §18.7 模型用途标签：capabilities 唯一写入口（ModelSettingsSheet 用途 chips）。
   * 沿用 updateModelName 同款持久化链（models 持久白名单）。
   * 选型闭环：listModelsForTask 读标签 → 弹窗多候选。
   */
  updateModelCapabilities = (
    modelId: string,
    newCapabilities: Model['capabilities'],
  ) => {
    const model = this.models.find(m => m.id === modelId);
    if (model) {
      runInAction(() => {
        model.capabilities = newCapabilities;
      });
    }
  };

  resetModels = async () => {
    const localModels = this.models.filter(
      model => model.isLocal || model.origin === ModelOrigin.LOCAL,
    );
    localModels.forEach(model => {
      const defaultSettings = getLocalModelDefaultSettings();
      // We change the default settings as well, in case the app introduces new settings.
      model.defaultChatTemplate = {...defaultSettings.chatTemplate};
      model.defaultStopWords = [
        ...(defaultSettings?.completionParams?.stop || []),
      ];
      model.chatTemplate = {...defaultSettings.chatTemplate};
      model.stopWords = [...(defaultSettings?.completionParams?.stop || [])];

      // Clear GGUF metadata to force re-fetch with correct number types
      model.ggufMetadata = undefined;
    });

    const hfModels = this.models.filter(
      model => model.origin === ModelOrigin.HF,
    );
    hfModels.forEach(model => {
      const defaultSettings = getHFDefaultSettings(
        model.hfModel as HuggingFaceModel,
      );
      // We change the default settings as well, in case the app introduces new settings.
      model.defaultChatTemplate = {...defaultSettings.chatTemplate};
      model.defaultStopWords = [
        ...(defaultSettings?.completionParams?.stop || []),
      ];
      model.chatTemplate = {...defaultSettings.chatTemplate};
      model.stopWords = [...(defaultSettings?.completionParams?.stop || [])];

      // Clear GGUF metadata to force re-fetch with correct number types
      model.ggufMetadata = undefined;
    });

    // Re-resolve the device-appropriate presets so reset repopulates the
    // default rule list synchronously, mirroring initializeStore (rather than
    // leaving it empty until the next launch re-migrates).
    const presets = await this.resolvePresets();

    runInAction(() => {
      // Seed with the kept local/HF models so the preset reconcile dedups
      // against them (a downloaded HF model matching a rule preset is not
      // duplicated).
      this.models = [...localModels, ...hfModels];
      this.version = 0;
      this.mergeModelLists(presets);

      // mergeModelLists appends defaultStopWords onto existing stopWords to
      // preserve user customizations; on the just-reset kept models that
      // duplicates the seeded defaults. Dedup the affected models (distinct
      // entries are preserved).
      [...localModels, ...hfModels].forEach(model => {
        model.stopWords = [...new Set(model.stopWords)];
      });
    });

    // Re-fetch GGUF metadata with correct number types
    this.loadMissingGGUFMetadata();
  };

  resetModelChatTemplate = (modelId: string) => {
    const model = this.models.find(m => m.id === modelId);
    if (model) {
      runInAction(() => {
        model.chatTemplate = {...model.defaultChatTemplate};
      });
    }
  };

  resetModelStopWords = (modelId: string) => {
    const model = this.models.find(m => m.id === modelId);
    if (model) {
      runInAction(() => {
        model.stopWords = [...(model.defaultStopWords || [])];
      });
    }
  };

  resetModelName = (modelId: string) => {
    const model = this.models.find(m => m.id === modelId);
    if (model) {
      runInAction(() => {
        model.name = getOriginalModelName(model);
      });
    }
  };

  private async initializeGpuSettings() {
    const gpuCapabilities = await checkGpuSupport();

    // If GPU is not supported but currently enabled, disable it
    if (
      !gpuCapabilities.isSupported &&
      this.contextInitParams.no_gpu_devices === false
    ) {
      runInAction(() => {
        this.contextInitParams = {
          ...this.contextInitParams,
          no_gpu_devices: true,
          n_gpu_layers: 0,
        };
      });
    }
    // If GPU is supported, the persisted value will be used
  }

  setNoGpuDevices = (no_gpu_devices: boolean) => {
    runInAction(() => {
      this.contextInitParams = {
        ...this.contextInitParams,
        no_gpu_devices,
      };
    });
  };

  // New v2.0 setters
  setDevices = (devices: string[] | undefined) => {
    runInAction(() => {
      this.contextInitParams = {
        ...this.contextInitParams,
        devices,
      };
    });
  };

  setFlashAttnType = (flash_attn_type: 'auto' | 'on' | 'off') => {
    runInAction(() => {
      this.contextInitParams = {
        ...this.contextInitParams,
        flash_attn_type,
        // Reset cache types to F16 if flash attention is disabled
        ...(flash_attn_type !== 'off'
          ? {}
          : {
              cache_type_k: CacheType.F16,
              cache_type_v: CacheType.F16,
            }),
      };
    });
  };

  setKvUnified = (kv_unified: boolean) => {
    runInAction(() => {
      this.contextInitParams = {
        ...this.contextInitParams,
        kv_unified,
      };
    });
  };

  setNParallel = (n_parallel: number) => {
    runInAction(() => {
      this.contextInitParams = {
        ...this.contextInitParams,
        n_parallel,
      };
    });
  };

  updateUseAutoRelease = (useAutoRelease: boolean) => {
    runInAction(() => {
      this.useAutoRelease = useAutoRelease;
    });
  };

  /**
   * Updates stop tokens for a model based on its context and chat template
   * @param ctx - The LlamaContext instance
   * @param model - App model to update stop tokens for
   */
  private async updateModelStopTokens(ctx: LlamaContext, model: Model) {
    const storeModel = this.models.find(m => m.id === model.id);
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
  }

  /**
   * Update model thinking capabilities based on the loaded context
   */
  private async updateModelThinkingCapabilities(
    ctx: LlamaContext,
    model: Model,
  ) {
    try {
      const storeModel = this.models.find(m => m.id === model.id);
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
  }

  /**
   * Learn-from-stream entry point. The first time a model actually emits
   * reasoning, flip axis-1 to learned 'yes'. Routes remote ids to ServerStore
   * (one direction). Idempotent and monotonic; never overrides a user
   * declaration (handled by the per-store writers).
   */
  // 推理能力方法组：实现迁至 modelStoreMethods/reasoningMethods.ts（行为零变化）
  recordReasoningObserved!: (modelId: string) => void;
  setReasoningOverride!: (modelId: string, cap: ReasoningCapability) => void;

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

  // 投影模型方法组：实现迁至 modelStoreMethods/projectionMethods.ts（行为零变化）
  getCompatibleProjectionModels!: (modelId: string) => Model[];
  setDefaultProjectionModel!: (modelId: string, projectionModelId: string) => void;
  getDefaultProjectionModel!: (modelId: string) => Model | undefined;
  getLLMsUsingProjectionModel!: (projectionModelId: string) => Model[];
  getDownloadedLLMsUsingProjectionModel!: (projectionModelId: string) => Model[];
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
  cleanupOrphanedProjectionModels!: (projectionModelIds: string[]) => Promise<void>;
  setModelVisionEnabled!: (modelId: string, enabled: boolean) => Promise<void>;
  getModelVisionPreference!: (model: Model) => boolean;

  /**
   * Starts a completion with one or more images
   * @param params - Completion parameters including image paths
   * @returns Promise<void>
   */
  startImageCompletion = async (params: {
    prompt: string;
    image_path?: string; // For backward compatibility
    image_paths?: string[]; // New parameter for multiple images
    systemMessage?: string;
    onToken?: (token: string) => void;
    onComplete?: (text: string) => void;
    onError?: (error: Error) => void;
  }): Promise<void> => {
    if (!this.context) {
      throw new Error('No model context available');
    }

    // Check if multimodal is enabled
    if (!this.isMultimodalActive) {
      throw new Error('Multimodal is not enabled for this model');
    }

    runInAction(() => {
      this.inferencing = true;
      this.isStreaming = false;
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
        this.isStreaming = true;
      });

      const completionParams =
        await chatSessionRepository.getGlobalCompletionSettings();
      const stopWords = toJS(modelStore.activeModel?.stopWords);

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
        this.context!.completion(
          cleanCompletionParams,
          data => {
            if (data.token) {
              params.onToken?.(data.token);
            }
          },
        ),
      );

      // Register the promise so releaseContext can wait for it
      this.registerCompletionPromise(completionPromise);

      const result = await completionPromise;

      // Clear the promise after completion finishes
      this.clearCompletionPromise();

      params.onComplete?.(result.text);
    } catch (error) {
      // Clear the promise on error too
      this.clearCompletionPromise();
      console.error('Error in multi-image completion:', error);
      params.onError?.(
        error instanceof Error ? error : new Error(String(error)),
      );
    } finally {
      runInAction(() => {
        this.inferencing = false;
        this.isStreaming = false;
      });
    }
  };

  /**
   * Fetches and updates model file details from HuggingFace.
   * This is used when we need to get the lfs.oid for integrity checks.
   * @param model - The model to update
   * @returns Promise<void>
   */
  async fetchAndUpdateModelFileDetails(model: Model): Promise<void> {
    if (!model.hfModel?.id) {
      return;
    }

    try {
      const fileDetails = await fetchModelFilesDetails(model.hfModel.id);
      const matchingFile = fileDetails.find(
        file => file.path === model.hfModelFile?.rfilename,
      );

      if (matchingFile && matchingFile.lfs) {
        runInAction(() => {
          if (model.hfModelFile) {
            model.hfModelFile.lfs = matchingFile.lfs;
          }
        });
      }
    } catch (error) {
      console.error('Failed to fetch model file details:', error);
    }
  }

  // Expensive operation.
  // It will be calculating hash if hash is not set, unless force is true.
  updateModelHash = async (modelId: string, force: boolean = false) => {
    const model = this.models.find(m => m.id === modelId);

    // We only update hash if the model is downloaded and not currently being downloaded.
    if (model?.isDownloaded && !downloadManager.isDownloading(modelId)) {
      // If not forced, we only update hash if it's not already set.
      if (model.hash && !force) {
        return;
      }
      const filePath = await this.getModelFullPath(model);
      const hash = await getSHA256Hash(filePath);
      runInAction(() => {
        model.hash = hash;
      });
    }
  };

  isModelAvailable = (modelId?: string): boolean => {
    if (!modelId) {
      return false;
    }
    return this.availableModels.some(m => m.id === modelId);
  };

  // /**
  //  * Gets localized strings based on the current language from uiStore
  //  */
  // getL10n() {
  //   const language = uiStore.language;
  //   // Import the l10n object from locales
  //   const {l10n} = require('../locales');
  //   // Return the localized strings for the current language
  //   return l10n[language];
  // }

  clearDownloadError = () => {
    this.downloadError = null;
  };

  clearModelLoadError = () => {
    this.modelLoadError = null;
  };

  retryDownload = () => {
    const modelId = this.downloadError?.metadata?.modelId;
    this.clearDownloadError();

    if (modelId) {
      // Find the model and retry download
      const model = this.models.find(m => m.id === modelId);
      if (model) {
        this.checkSpaceAndDownload(model.id);
      }
    }
  };
}

export const modelStore = new ModelStore();
engineMutex.register('chat', async () => {
  await modelStore.releaseContext();
});
