/**
 * 每模型默认上下文长度人工策展表（2026-08-19 大王裁定；
 * 2026-08-21 按真实 GGUF 元数据验算重排——小模型长上下文）。
 *
 * 策展原则：模型越小 → 上下文越长（KV 便宜 + 速度快），上限 = GGUF
 * context_length，预算 = PSS_SAFE_BUDGET 4GB。本表每个档位都经
 * memoryEstimator 公式 (权重+KV+compute)×1.1 验算（见 __tests__/
 * modelContextDefaults.test.ts 门禁），验算数据来自入选模型真实 GGUF
 * 头部（qwen35 2B: 24层/2KV头×256 → 48KB/token；qwen35 4B: 32层/
 * 4KV头×256 → 128KB/token；mistral3: 26层/8KV头×128 → 106KB/token；
 * lfm2 无 KV 声明，App 保守按 32 头×64 估 → 240KB/token）。
 * 设备内存安全仍由 PSS 审计兜底（preset 可自愈）；用户手调 =
 * 主权，任何迁移/归一都不碰。
 */
import type {Model} from './types';

// 文件名/名匹配规则（先于尺寸档）。工具 schema 注入后提示词基线 ~4.5K：
// 1B 级 16384 为管家舒适档；2B 级 24576 为写作/聊天主力档（Q8 近无损 + KV
// 48KB/token 极省）；3B 级 12288（Ministral KV 106KB/token，16384 超预算）；
// 4B 级 4096 为 KV 大户诚实档（128KB/token，6144 即超预算，KV 量化后可上探）。
const CURATED_RULES: Array<{match: RegExp; nCtx: number}> = [
  {match: /ministral/i, nCtx: 12288},
  {match: /minicpm/i, nCtx: 16384},
  {match: /qwen3\.5-2b/i, nCtx: 24576},
  {match: /qwen3\.5-4b/i, nCtx: 4096},
  {match: /gemma-3-4b/i, nCtx: 16384},
  {match: /lfm2\.5-8b/i, nCtx: 12288},
  {match: /lfm2\.5-2\.6b/i, nCtx: 6144},
];

/**
 * 模型策展默认 n_ctx：规则表优先，未命中按尺寸分档
 * （≤1.5GB→16384；≤4GB→24576；更大→12288，KV 成本随嵌入维度涨）。
 */
export function defaultNCtxForModel(
  model: Pick<Model, 'filename' | 'name'> & {size?: number},
): number {
  const hay = `${model.filename ?? ''} ${model.name ?? ''}`;
  for (const rule of CURATED_RULES) {
    if (rule.match.test(hay)) {
      return rule.nCtx;
    }
  }
  if (model.size && model.size <= 1.5e9) {
    return 16384;
  }
  if (model.size && model.size <= 4e9) {
    return 24576;
  }
  return 12288;
}
