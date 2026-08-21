/**
 * 策展默认 n_ctx 门禁：每个策展档必须通过 PSS 预算验算。
 *
 * 2026-08-21 按真实 GGUF 头部元数据定表（qwen35/lfm2/mistral3 架构
 * 前缀命名），此处用与 App 侧 fetchAndPersistGGUFMetadata 相同取值
 * 逻辑的 fixture 重建估算，断言 (权重+KV+compute)×1.1 ≤ PSS_SAFE_BUDGET。
 * 新增/调整策展档必须同步本测试——防止策展值超预算导致真机被杀
 * 或启动审计反复降档（设置页显示与生效值撕裂）。
 */
import {
  defaultNCtxForModel,
} from '../modelContextDefaults';
import {
  getModelMemoryRequirement,
  PSS_SAFE_BUDGET,
} from '../memoryEstimator';
import type {Model, GGUFMetadata} from '../types';

/** 按真实 GGUF 验算数据的模型 fixture（size = 文件实际字节）。 */
const FIXTURES: Array<{
  name: string;
  filename: string;
  size: number;
  metadata: GGUFMetadata;
}> = [
  {
    // qwen35 2B Q8_0：24 层 / 2 KV 头 × 256 维 → KV 48KB/token（实测头部）
    name: 'Qwen3.5-2B-Uncensored-HauhauCS-Aggressive',
    filename: 'Qwen3.5-2B-Uncensored-HauhauCS-Aggressive-Q8_0.gguf',
    size: 2.01e9,
    metadata: {
      architecture: 'qwen35',
      n_layers: 24,
      n_embd: 2048,
      n_head: 8,
      n_head_kv: 2,
      n_vocab: 128000,
      n_embd_head_k: 256,
      n_embd_head_v: 256,
      context_length: 262144,
    },
  },
  {
    // qwen35 4B Q4_K_M：32 层 / 4 KV 头 × 256 维 → KV 128KB/token（KV 大户）
    name: 'Qwen3.5-4B-Uncensored-HauhauCS-Aggressive',
    filename: 'Qwen3.5-4B-Uncensored-HauhauCS-Aggressive-Q4_K_M.gguf',
    size: 2.71e9,
    metadata: {
      architecture: 'qwen35',
      n_layers: 32,
      n_embd: 2560,
      n_head: 16,
      n_head_kv: 4,
      n_vocab: 128000,
      n_embd_head_k: 256,
      n_embd_head_v: 256,
      context_length: 262144,
    },
  },
  {
    // mistral3 3B：26 层 / 8 KV 头 × 128 维 → KV 106KB/token，原生 256K
    name: 'Ministral-3-3B-Instruct-2512',
    filename: 'Ministral-3-3B-Instruct-2512-Q4_K_M.gguf',
    size: 2.0e9,
    metadata: {
      architecture: 'mistral3',
      n_layers: 26,
      n_embd: 3072,
      n_head: 32,
      n_head_kv: 8,
      n_vocab: 131072,
      n_embd_head_k: 128,
      n_embd_head_v: 128,
      context_length: 262144,
    },
  },
  {
    // lfm2 2.6B：无 KV 声明 → App 保守按 32 头 × 64 维估 → 240KB/token
    name: 'LFM2.5-2.6B',
    filename: 'LFM2.5-2.6B-Q4_K_M.gguf',
    size: 1.67e9,
    metadata: {
      architecture: 'lfm2',
      n_layers: 30,
      n_embd: 2048,
      n_head: 32,
      n_head_kv: 32,
      n_vocab: 128000,
      n_embd_head_k: 64,
      n_embd_head_v: 64,
      context_length: 128000,
    },
  },
  {
    // minicpm 1B 管家：保守按 32 层 / 8 KV 头 × 128 维估
    name: 'MiniCPM5-1B',
    filename: 'minicpm5_1b_heretic_q4km.gguf',
    size: 0.69e9,
    metadata: {
      architecture: 'minicpm',
      n_layers: 32,
      n_embd: 2048,
      n_head: 32,
      n_head_kv: 8,
      n_vocab: 128000,
      n_embd_head_k: 128,
      n_embd_head_v: 128,
      context_length: 32768,
    },
  },
];

describe('策展默认 n_ctx 门禁（2026-08-21 真实 GGUF 验算）', () => {
  it.each(FIXTURES.map(f => [f.name, f]))(
    '%s 的策展档在 PSS 4GB 预算内',
    (_name, fixture) => {
      const model = {
        name: fixture.name,
        filename: fixture.filename,
        size: fixture.size,
        ggufMetadata: fixture.metadata,
      } as unknown as Model;
      const curated = defaultNCtxForModel(model);
      const estimated = getModelMemoryRequirement(model, undefined, {
        n_ctx: curated,
        n_batch: 512,
        n_ubatch: 512,
        cache_type_k: 'f16',
        cache_type_v: 'f16',
      } as any);
      expect(estimated).toBeLessThanOrEqual(PSS_SAFE_BUDGET);
    },
  );

  it('策展档不超过模型原生 context_length（上限封顶语义）', () => {
    for (const fixture of FIXTURES) {
      const model = {
        name: fixture.name,
        filename: fixture.filename,
        size: fixture.size,
      } as unknown as Model;
      const curated = defaultNCtxForModel(model);
      expect(curated).toBeLessThanOrEqual(
        fixture.metadata.context_length ?? Number.MAX_SAFE_INTEGER,
      );
    }
  });

  it('规则命中优先于尺寸分档（minicpm 1B 不落 ≤1.5GB 档位覆盖）', () => {
    const model = {
      name: 'MiniCPM5-1B',
      filename: 'minicpm5_1b_heretic_q4km.gguf',
      size: 0.69e9,
    } as unknown as Model;
    expect(defaultNCtxForModel(model)).toBe(16384);
  });
});
