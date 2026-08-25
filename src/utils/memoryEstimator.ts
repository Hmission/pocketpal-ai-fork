import {Model, GGUFMetadata, ContextInitParams} from './types';

/**
 * Validate that GGUF metadata has valid numeric values for core fields.
 * Returns false if any required field is NaN, undefined, or non-positive.
 * This catches corrupted metadata from older app versions.
 */
function isValidGGUFMetadata(metadata: GGUFMetadata): boolean {
  const requiredFields = [
    metadata.n_layers,
    metadata.n_embd,
    metadata.n_head,
    metadata.n_head_kv,
    metadata.n_vocab,
    metadata.n_embd_head_k,
    metadata.n_embd_head_v,
  ];

  return requiredFields.every(
    value => typeof value === 'number' && !isNaN(value) && value > 0,
  );
}

/**
 * Get bytes per element for KV cache based on quantization type
 * Reference: llama.cpp cache type sizes
 */
export function getKVCacheTypeBytes(cacheType: string): number {
  const typeMap: Record<string, number> = {
    f32: 4.0,
    f16: 2.0,
    bf16: 2.0,
    q8_0: 1.0625, // 34/32
    q4_0: 0.5625, // 18/32
    q4_1: 0.625, // 20/32
    q5_0: 0.6875, // 22/32
    q5_1: 0.75, // 24/32
  };
  return typeMap[cacheType.toLowerCase()] || 2.0; // Default to f16
}

/**
 * Calculate KV cache memory requirement using GGUF metadata and context settings
 */
function calculateKVCacheMemory(
  metadata: GGUFMetadata,
  contextSettings: ContextInitParams,
): number {
  // Defensive: Convert to numbers in case metadata was persisted as strings
  const n_layers = Number(metadata.n_layers);
  const n_embd_head_k = Number(metadata.n_embd_head_k);
  const n_embd_head_v = Number(metadata.n_embd_head_v);
  const n_head_kv = Number(metadata.n_head_kv);
  const sliding_window = metadata.sliding_window
    ? Number(metadata.sliding_window)
    : undefined;

  const {n_ctx, cache_type_k, cache_type_v} = contextSettings;

  // For SWA (Sliding Window Attention) models like Gemma
  const effectiveCtx = sliding_window ? Math.min(n_ctx, sliding_window) : n_ctx;

  // Calculate key and value cache separately (may have different quantization)
  const bytesPerK = getKVCacheTypeBytes(cache_type_k || 'f16');
  const bytesPerV = getKVCacheTypeBytes(cache_type_v || 'f16');

  const keyCacheSize =
    n_layers * effectiveCtx * n_embd_head_k * n_head_kv * bytesPerK;
  const valueCacheSize =
    n_layers * effectiveCtx * n_embd_head_v * n_head_kv * bytesPerV;

  return keyCacheSize + valueCacheSize;
}

/**
 * Calculate compute buffer memory requirement
 */
function calculateComputeBuffer(
  metadata: GGUFMetadata,
  contextSettings: ContextInitParams,
): number {
  // Defensive: Convert to numbers in case metadata was persisted as strings
  const n_vocab = Number(metadata.n_vocab);
  const n_embd = Number(metadata.n_embd);
  const {n_ubatch} = contextSettings;

  // Compute buffer: (n_vocab + n_embd) × n_ubatch × 4 bytes
  return (n_vocab + n_embd) * n_ubatch * 4;
}

/**
 * PSS 安全预算（2026-08-19 K90 真机血证）：厂商 PSS 看护（HyperOS 实测
 * pss threshold 6GB 硬杀，与空闲内存无关）是进程存活的真正天花板。
 * 自动预调的内存预算 = 6GB 硬限 − 运行时开销与估算乐观余量 2GB。
 * 估算（权重+KV+计算×1.1）是理论值，实测 PSS 额外含 RN 运行时/原生库/分片
 * 损耗（K90 实证：理论 ~5GB 的档位实际 PSS 6.77GB 被杀）。宁少勿杀；
 * 2026-08-26 大王裁定「探索上限」：预算改为设备感知（resolvePssSafeBudget），
 * 本常量退为无可用内存数据时的 fallback；用户手调不受此限（决策可见，风险自担）。
 */
export const PSS_SAFE_BUDGET = 4.0e9;

/** 设备感知预算上限（2026-08-26 大王口径：8-9GB 挥霍，仅考虑本 App）。 */
const PSS_SAFE_BUDGET_CEILING = 9.0e9;

/**
 * 设备感知安全预算（2026-08-26）：预算 = 启动实测可用内存（availableMemoryCeiling），
 * 硬上限 9GB；无实测数据回退 PSS_SAFE_BUDGET（4GB）。availMem 吃紧时预算自然
 * 收紧（宁紧勿杀），空闲时（K90 实测 8-9GB）放开探索上限。KV 保持 f16 不加
 * 量化旋钮（锋利不预设）；越界仍由启动审计降档兜底（守卫 hook 语义不变）。
 */
export function resolvePssSafeBudget(availableBytes?: number): number {
  if (!availableBytes || availableBytes <= 0) {
    return PSS_SAFE_BUDGET;
  }
  return Math.min(availableBytes, PSS_SAFE_BUDGET_CEILING);
}

/**
 * Get model memory requirement estimate in bytes
 *
 * When GGUF metadata is available:
 *   Uses accurate formula: (Weights + KV Cache + Compute Buffer) × 1.1
 *
 * When GGUF metadata is NOT available:
 *   Uses fallback: (modelSize + mmProjSize) × 1.2
 *
 * @param model - The model to estimate memory for
 * @param projectionModel - Optional mmproj model for multimodal
 * @param contextSettings - Optional context settings (n_ctx, cache types, etc.)
 * @returns Estimated memory requirement in bytes
 */
export function getModelMemoryRequirement(
  model: Model,
  projectionModel?: Model,
  contextSettings?: ContextInitParams,
): number {
  const mmProjSize = projectionModel?.size || 0;

  // If GGUF metadata is available and valid, use accurate formula
  if (
    model.ggufMetadata &&
    contextSettings &&
    isValidGGUFMetadata(model.ggufMetadata)
  ) {
    const metadata = model.ggufMetadata;

    // Weights: already quantized in GGUF file
    const weightsSize = model.size;

    // KV Cache: depends on context length, architecture, and cache quantization
    const kvCacheSize = calculateKVCacheMemory(metadata, contextSettings);

    // Compute Buffer: temporary buffers for inference
    const computeBuffer = calculateComputeBuffer(metadata, contextSettings);

    // Total: (Weights + KV Cache + Compute) × 1.1 overhead + mmproj
    const baseMemory = weightsSize + kvCacheSize + computeBuffer;
    const totalMemory = baseMemory * 1.1 + mmProjSize * 1.1;

    return totalMemory;
  }

  // Fallback: simple size-based estimation
  const totalSize = model.size + mmProjSize;
  const estimated = totalSize * 1.2; // 20% overhead (more conservative when no metadata)

  return estimated;
}
