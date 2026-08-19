/**
 * 每模型默认上下文长度人工策展表（2026-08-19 大王裁定）。
 *
 * 内存梯子预调「能装多大给多大」不等于「合适」：K90 实证 1B 管家被梯子
 * 写 98304（KV 虚占）、2.6B 漏档回全局 4096（一轮即满）。策展表按模型
 * 定位给合理默认；设备内存安全仍由 PSS 审计兜底（preset 可自愈）；
 * 用户手调（source='user'）= 主权，任何迁移/归一都不碰。
 */
import type {Model} from './types';

// 文件名/名匹配规则（先于尺寸档）。工具 schema 注入后提示词基线 ~4.5K，
// 8192 为 3B 级保守档；4B 级 16384 为玩法（冒险/玩具）舒适档。
const CURATED_RULES: Array<{match: RegExp; nCtx: number}> = [
  {match: /ministral/i, nCtx: 8192},
  {match: /minicpm/i, nCtx: 8192},
  {match: /qwen3\.5-2b/i, nCtx: 16384},
  {match: /qwen3\.5-4b/i, nCtx: 16384},
  {match: /gemma-3-4b/i, nCtx: 16384},
  {match: /lfm2\.5-8b/i, nCtx: 12288},
  {match: /lfm2\.5-2\.6b/i, nCtx: 16384},
];

/**
 * 模型策展默认 n_ctx：规则表优先，未命中按尺寸分档
 * （≤1.5GB→8192；≤4GB→16384；更大→8192，KV 成本随嵌入维度涨）。
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
    return 8192;
  }
  if (model.size && model.size <= 4e9) {
    return 16384;
  }
  return 8192;
}
