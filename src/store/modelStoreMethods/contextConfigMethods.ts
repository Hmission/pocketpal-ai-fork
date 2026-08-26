/**
 * contextConfigMethods — ModelStore 上下文配置方法组（models 域拆分 · R3-P1-B）
 *
 * 「A 配置域」自 ModelStore.ts 原样迁出（行为零变化）：上下文初始化参数
 * setter 族（线程/批量/上下文长度/KV）、每模型 n_ctx 三件套（策展预调 /
 * preset 归一 / PSS 审计）、生效参数解析（getEffective* 族）、GPU 初始化族。
 * 挂载方式见 projectionMethods.ts 头注（constructor 在 makeAutoObservable
 * 之前调用；private 迁出后变公开实例属性，接受，不造访问控制补丁）。
 */
import {runInAction} from 'mobx';
import {Platform} from 'react-native';
import type {ContextParams} from 'llama.rn';

import type {modelStore as modelStoreInstance} from '../ModelStore';
import {CacheType, Model, ModelOrigin} from '../../utils/types';
import type {ContextPolicy} from '../../services/contextCompaction/decision';
import {
  CURATED_TABLE_VERSION,
  defaultNCtxForModel,
} from '../../utils/modelContextDefaults';
import {resolveUseMmap} from '../../utils/memorySettings';
import {
  getModelMemoryRequirement,
  resolvePssSafeBudget,
} from '../../utils/memoryEstimator';
import {CONTEXT_LADDER} from '../../utils/bannerVariantResolver';
import {checkGpuSupport} from '../../utils/deviceCapabilities';

/** ModelStore 实例类型（类未导出，从单例推导；type-only import 无运行时环） */
type ModelStore = typeof modelStoreInstance;

export function applyContextConfigMethods(store: ModelStore): void {
  store.setNThreads = (n_threads: number) => {
    runInAction(() => {
      store.contextInitParams = {
        ...store.contextInitParams,
        n_threads,
      };
    });
  };

  store.setCacheTypeK = (cache_type: CacheType) => {
    runInAction(() => {
      // Only allow changing cache type if flash attention is enabled
      // Support both old flash_attn and new flash_attn_type
      const flashAttnEnabled =
        store.contextInitParams.flash_attn ||
        (store.contextInitParams.flash_attn_type &&
          store.contextInitParams.flash_attn_type !== 'off');

      if (flashAttnEnabled) {
        store.contextInitParams = {
          ...store.contextInitParams,
          cache_type_k: cache_type,
        };
      }
    });
  };

  store.setCacheTypeV = (cache_type: CacheType) => {
    runInAction(() => {
      // Only allow changing cache type if flash attention is enabled
      // Support both old flash_attn and new flash_attn_type
      const flashAttnEnabled =
        store.contextInitParams.flash_attn ||
        (store.contextInitParams.flash_attn_type &&
          store.contextInitParams.flash_attn_type !== 'off');

      if (flashAttnEnabled) {
        store.contextInitParams = {
          ...store.contextInitParams,
          cache_type_v: cache_type,
        };
      }
    });
  };

  store.setNBatch = (n_batch: number) => {
    runInAction(() => {
      store.contextInitParams = {
        ...store.contextInitParams,
        n_batch,
      };
    });
  };

  store.setNUBatch = (n_ubatch: number) => {
    runInAction(() => {
      store.contextInitParams = {
        ...store.contextInitParams,
        n_ubatch,
      };
    });
  };

  store.setNContext = (n_ctx: number) => {
    runInAction(() => {
      store.contextInitParams = {
        ...store.contextInitParams,
        n_ctx,
      };
    });
  };

  /** 每模型上下文覆盖写入（生成设置页活动模型行 / 聊天页入口共用） */
  store.setModelNCtx = (
    modelId: string,
    n_ctx: number,
    source: 'preset' | 'user' = 'user',
  ) => {
    runInAction(() => {
      store.perModelNCtx = {...store.perModelNCtx, [modelId]: n_ctx};
      store.perModelNCtxSource = {
        ...store.perModelNCtxSource,
        [modelId]: source,
      };
    });
  };

  /** 生效 n_ctx：每模型覆盖优先，无覆盖回退全局默认 */
  store.getModelNCtx = (modelId?: string | null): number =>
    (modelId && store.perModelNCtx[modelId]) || store.contextInitParams.n_ctx;

  /** B19 上下文治理策略：每模型覆盖优先，无覆盖默认 'ask'（首次触发弹选择）。 */
  store.getContextPolicy = (modelId?: string | null): ContextPolicy =>
    (modelId && store.perModelContextPolicy[modelId]) || 'ask';

  /** B19 策略写入（banner CTA / 设置页），persist 持久化免打扰。 */
  store.setContextPolicy = (modelId: string, policy: ContextPolicy) => {
    runInAction(() => {
      store.perModelContextPolicy = {
        ...store.perModelContextPolicy,
        [modelId]: policy,
      };
    });
  };

  /** B19 自动压缩总开关（设置页），persist 持久化。 */
  store.setContextAutoCompaction = (enabled: boolean) => {
    runInAction(() => {
      store.contextAutoCompaction = enabled;
    });
  };

  /**
   * §18.6 每模型预调：无覆盖时写人工策展默认（modelContextDefaults），
   * 一次预调、持久化。策展表取代内存梯子「能装多大给多大」
   * （2026-08-19 大王裁定：K90 实证梯子给 1B 写 98304 KV 虚占、
   * 漏档模型回全局 4096 一轮即满）；设备内存安全由 PSS 审计兜底，
   * 用户手调 = 主权不碰。
   */
  store.presetModelNCtxIfAbsent = (
    model: Model,
    _projectionModel?: Model,
  ): void => {
    if (model.origin === ModelOrigin.REMOTE || store.perModelNCtx[model.id]) {
      return;
    }
    store.setModelNCtx(model.id, defaultNCtxForModel(model), 'preset');
  };

  /**
   * 策展默认归一 + 版本化拉齐（2026-08-19 建立；v2 2026-08-26 升级）：
   * - preset 源超策展默认者降档（旧梯子遗留污染自愈，如 1B 98304）；
   * - 策展表版本升级（CURATED_TABLE_VERSION）且 preset 源低于新策展者 →
   *   一次性升档拉齐（解除旧「只降不升」导致老用户 stuck 旧短值的钉死）；
   * user 源不碰（主权）；防乒乓：版本记账只在本次迭代完成时落一次。
   */
  store.normalizePresetNCtxToCuratedDefaults = (): void => {
    const tableVersioned = store.curatedTableVersion !== CURATED_TABLE_VERSION;
    for (const model of store.models) {
      if (model.origin === ModelOrigin.REMOTE) {
        continue;
      }
      if (store.perModelNCtxSource[model.id] === 'user') {
        continue;
      }
      const current = store.perModelNCtx[model.id];
      if (!current) {
        continue;
      }
      const curated = defaultNCtxForModel(model);
      if (current > curated) {
        console.warn(
          `[ModelStore] curated default: ${model.name} n_ctx ${current} → ${curated}`,
        );
        store.setModelNCtx(model.id, curated, 'preset');
      } else if (tableVersioned && current < curated) {
        console.warn(
          `[ModelStore] curated table v${CURATED_TABLE_VERSION}: ${model.name} n_ctx ${current} → ${curated}`,
        );
        store.setModelNCtx(model.id, curated, 'preset');
      }
    }
    if (tableVersioned) {
      runInAction(() => {
        store.curatedTableVersion = CURATED_TABLE_VERSION;
      });
    }
  };

  /**
   * PSS 安全审计（2026-08-19 建立；2026-08-26 设备化）：启动时复查每模型生效
   * n_ctx（覆盖优先，无覆盖取全局默认），估算超预算者降到最大安全档——
   * 自愈旧版预调污染与全局默认越限（K90 实证：40960 档 f16 KV 生成中
   * PSS 6.77GB > 6GB 硬限被杀；8B 模型全局默认 8192 亦越限）。
   * 预算 = resolvePssSafeBudget(availableMemoryCeiling)（K90 8-9GB 挥霍口径，
   * 上限 9GB；未知设备回退 4GB）——守卫 hook 语义不变，预算值换设备口径。
   * 用户手调（source='user'）= 可见决策 = 主权，审计不碰；
   * 「只升不降」保护的是安全范围内的用户主权，不是必杀值。
   */
  store.auditPerModelNCtxAgainstPss = (): void => {
    const budget = resolvePssSafeBudget(store.availableMemoryCeiling);
    for (const model of store.models) {
      if (model.origin === ModelOrigin.REMOTE) {
        continue;
      }
      if (store.perModelNCtxSource[model.id] === 'user') {
        continue;
      }
      const nCtx =
        store.perModelNCtx[model.id] ?? store.contextInitParams.n_ctx;
      let estimated: number;
      try {
        estimated = getModelMemoryRequirement(model, undefined, {
          ...store.contextInitParams,
          n_ctx: nCtx,
        });
      } catch {
        continue;
      }
      if (estimated <= budget) {
        continue;
      }
      let safe: number | undefined;
      for (const tier of CONTEXT_LADDER) {
        if (tier >= nCtx) {
          break;
        }
        try {
          const mem = getModelMemoryRequirement(model, undefined, {
            ...store.contextInitParams,
            n_ctx: tier,
          });
          if (mem <= budget) {
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
        store.setModelNCtx(model.id, safe, 'preset');
      }
    }
  };

  store.setNGPULayers = (n_gpu_layers: number) => {
    runInAction(() => {
      store.contextInitParams = {
        ...store.contextInitParams,
        n_gpu_layers,
      };
    });
  };

  store.setImageMaxTokens = (image_max_tokens: number) => {
    runInAction(() => {
      store.contextInitParams = {
        ...store.contextInitParams,
        image_max_tokens,
      };
    });
  };

  store.setUseMlock = (use_mlock: boolean) => {
    runInAction(() => {
      store.contextInitParams = {
        ...store.contextInitParams,
        use_mlock,
      };
    });
  };

  store.setUseMmap = (use_mmap: 'true' | 'false' | 'smart') => {
    runInAction(() => {
      store.contextInitParams = {
        ...store.contextInitParams,
        use_mmap,
      };
    });
  };

  store.setNoExtraBufts = (no_extra_bufts: boolean) => {
    runInAction(() => {
      store.contextInitParams = {
        ...store.contextInitParams,
        no_extra_bufts,
      };
    });
  };

  /**
   * Get effective context initialization parameters with constraints applied
   * This is the unified method that replaces both getEffectiveBatchValues and getEffectiveInitSettings
   */
  store.getEffectiveContextInitParams = async (
    filePath?: string,
    modelId?: string,
  ): Promise<Omit<ContextParams, 'model'>> => {
    // Apply batch constraints（n_ctx 每模型独立：加载哪个模型取哪个覆盖）
    const effectiveContext = store.getModelNCtx(modelId);
    const effectiveBatch = Math.min(
      store.contextInitParams.n_batch,
      effectiveContext,
    );
    const effectiveUBatch = Math.min(
      store.contextInitParams.n_ubatch,
      effectiveBatch,
    );

    // Resolve the effective use_mmap value based on the setting
    const currentUseMmap = store.contextInitParams.use_mmap;
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
      store.contextInitParams.flash_attn_type ??
      (Platform.OS === 'ios' ? 'auto' : 'off');

    // Build the params object, filtering out undefined values
    const params: Partial<Omit<ContextParams, 'model'>> = {
      n_ctx: effectiveContext,
      n_batch: effectiveBatch,
      n_ubatch: effectiveUBatch,
      n_threads: store.contextInitParams.n_threads,
      flash_attn_type, // NEW: replaces flash_attn boolean
      cache_type_k: store.contextInitParams.cache_type_k,
      cache_type_v: store.contextInitParams.cache_type_v,
      n_gpu_layers: store.contextInitParams.n_gpu_layers ?? 99,
      devices: store.contextInitParams.devices, // NEW
      kv_unified: store.contextInitParams.kv_unified ?? true, // NEW (default true!)
      n_parallel: store.contextInitParams.n_parallel ?? 1, // NEW (1 for blocking mode only)
      use_mlock: store.contextInitParams.use_mlock,
      use_mmap: effectiveUseMmap,
      no_extra_bufts: store.contextInitParams.no_extra_bufts,
    };

    // Remove undefined values from the params object
    return Object.fromEntries(
      Object.entries(params).filter(([_, value]) => value !== undefined),
    ) as Omit<ContextParams, 'model'>;
  };

  // Legacy methods for backward compatibility

  /** @deprecated Use getEffectiveContextInitParams instead */
  store.getEffectiveBatchValues = () => {
    const effectiveContext = store.contextInitParams.n_ctx;
    const effectiveBatch = Math.min(
      store.contextInitParams.n_batch,
      effectiveContext,
    );
    const effectiveUBatch = Math.min(
      store.contextInitParams.n_ubatch,
      effectiveBatch,
    );

    return {
      n_ctx: effectiveContext,
      n_batch: effectiveBatch,
      n_ubatch: effectiveUBatch,
    };
  };

  /** @deprecated Use getEffectiveContextInitParams instead */
  store.getEffectiveInitSettings = async (
    filePath?: string,
  ): Promise<Omit<ContextParams, 'model'>> => {
    return store.getEffectiveContextInitParams(filePath);
  };

  /** @deprecated Use getEffectiveBatchValues instead */
  store.getEffectiveValues = () => {
    return store.getEffectiveBatchValues();
  };

  store.initializeGpuSettings = async () => {
    const gpuCapabilities = await checkGpuSupport();

    // If GPU is not supported but currently enabled, disable it
    if (
      !gpuCapabilities.isSupported &&
      store.contextInitParams.no_gpu_devices === false
    ) {
      runInAction(() => {
        store.contextInitParams = {
          ...store.contextInitParams,
          no_gpu_devices: true,
          n_gpu_layers: 0,
        };
      });
    }
    // If GPU is supported, the persisted value will be used
  };

  store.setNoGpuDevices = (no_gpu_devices: boolean) => {
    runInAction(() => {
      store.contextInitParams = {
        ...store.contextInitParams,
        no_gpu_devices,
      };
    });
  };

  // New v2.0 setters
  store.setDevices = (devices: string[] | undefined) => {
    runInAction(() => {
      store.contextInitParams = {
        ...store.contextInitParams,
        devices,
      };
    });
  };

  store.setFlashAttnType = (flash_attn_type: 'auto' | 'on' | 'off') => {
    runInAction(() => {
      store.contextInitParams = {
        ...store.contextInitParams,
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

  store.setKvUnified = (kv_unified: boolean) => {
    runInAction(() => {
      store.contextInitParams = {
        ...store.contextInitParams,
        kv_unified,
      };
    });
  };

  store.setNParallel = (n_parallel: number) => {
    runInAction(() => {
      store.contextInitParams = {
        ...store.contextInitParams,
        n_parallel,
      };
    });
  };
}
