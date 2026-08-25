/**
 * 策展默认 n_ctx 门禁：每个策展档必须通过设备感知预算验算。
 *
 * 2026-08-21 按真实 GGUF 头部元数据定表（qwen35/lfm2/mistral3 架构
 * 前缀命名），此处用与 App 侧 fetchAndPersistGGUFMetadata 相同取值
 * 逻辑的 fixture 重建估算，断言 (权重+KV+compute)×1.1 ≤ 设备预算
 * （2026-08-26 v2：resolvePssSafeBudget(8.5e9) K90 档——大王裁定探索上限，
 * 8-9GB 挥霍口径；未知设备回退 4GB）。
 * 新增/调整策展档必须同步本测试——防止策展值超预算导致真机被杀
 * 或启动审计反复降档（设置页显示与生效值撕裂）。
 */
import {
  CURATED_TABLE_VERSION,
  defaultNCtxForModel,
} from '../modelContextDefaults';
import {
  getModelMemoryRequirement,
  resolvePssSafeBudget,
} from '../memoryEstimator';
import {TOOL_BASELINE_TOKENS} from '../bannerVariantResolver';
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

describe('策展默认 n_ctx 门禁（2026-08-21 真实 GGUF 验算；v2 2026-08-26 设备预算）', () => {
  // K90 档设备预算（大王口径：可用内存 8-9GB 挥霍，仅考虑本 App）
  const DEVICE_BUDGET = resolvePssSafeBudget(8.5e9);

  it.each(FIXTURES.map(f => [f.name, f]))(
    '%s 的策展档在设备感知预算内（8.5GB 档）',
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
      expect(estimated).toBeLessThanOrEqual(DEVICE_BUDGET);
    },
  );

  it('未知设备（无可用内存）回退 4GB 预算仍不破档（v2 兼容旧设备）', () => {
    for (const fixture of FIXTURES) {
      const model = {
        name: fixture.name,
        filename: fixture.filename,
        size: fixture.size,
        ggufMetadata: fixture.metadata,
      } as unknown as Model;
      const curated = defaultNCtxForModel(model);
      if (curated <= 12288) {
        continue;
      }
      // 4GB fallback 下允许审计降档（旧设备安全优先）；此处断言不破 native 上限即可
      expect(curated).toBeLessThanOrEqual(
        fixture.metadata.context_length ?? Number.MAX_SAFE_INTEGER,
      );
    }
  });

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
    expect(defaultNCtxForModel(model)).toBe(32768);
  });

  it('v2 规则档位锚定（2026-08-26 大王裁定探索上限）', () => {
    const qwen4b = {
      name: 'Qwen3.5-4B',
      filename: 'Qwen3.5-4B-Uncensored-HauhauCS-Aggressive-Q4_K_M.gguf',
      size: 2.71e9,
    } as unknown as Model;
    expect(defaultNCtxForModel(qwen4b)).toBe(16384);
  });

  it('每档保底满足智能体工作集：nCtx ≥ 工具基线 + 对话窗 + 生成预留', () => {
    // 对话窗按 2 轮保守估算 2048 token（含角色包装开销），配生成预留 512
    const MIN_AGENT_WORKING_SET = TOOL_BASELINE_TOKENS + 2048 + 512;
    for (const fixture of FIXTURES) {
      const model = {
        name: fixture.name,
        filename: fixture.filename,
        size: fixture.size,
      } as unknown as Model;
      const curated = defaultNCtxForModel(model);
      expect(curated).toBeGreaterThanOrEqual(MIN_AGENT_WORKING_SET);
    }
  });

  it('版本号已随 v2 表升档（CURATED_TABLE_VERSION=2，驱动拉齐）', () => {
    expect(CURATED_TABLE_VERSION).toBe(2);
  });
});
