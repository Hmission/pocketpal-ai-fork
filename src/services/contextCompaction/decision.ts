/**
 * 上下文治理决策机（contextCompaction/decision）
 *
 * 纯函数单状态机：发送前预算估算 → 决策动作。无 IO、无 MobX、无副作用。
 *
 * 人机协作设计（2026-08-19 大王裁定 + 行业验证）：
 * - 扩窗优先：设备内存允许时优先扩窗（无损体验）。
 * - 压缩兜底：已到内存天花板（无更大阶梯档/审计不过）→ 自动转压缩。
 * - 选择记忆：per-model 策略持久化（'expand'/'compact'/'ask'），
 *   'ask' 首次触发弹选择并记住，之后免打扰。
 *
 * 触发阈值默认 0.8（WARNING_THRESHOLD），与 banner context-warning 同源，
 * 行业对齐（Claude Code auto-compact 约 80% 容量触发）。
 */
import {WARNING_THRESHOLD} from '../../utils/bannerVariantResolver';

export type ContextPolicy = 'expand' | 'compact' | 'ask';

export type ContextAction = 'send' | 'expand' | 'compact' | 'ask';

export interface DecideContextInput {
  /** 组装后（system+召回+消息）估算 token */
  used: number;
  /** 生效 n_ctx（每模型覆盖优先，全局 fallback） */
  nCtx: number;
  /** 设备内存允许扩窗：存在更大阶梯档且 PSS 审计通过 */
  canExpand: boolean;
  /** per-model 策略（默认 'ask'） */
  policy: ContextPolicy;
  /** 触发阈值（used/n_ctx），默认 0.8 */
  threshold?: number;
}

export function decideContextAction(input: DecideContextInput): ContextAction {
  const threshold = input.threshold ?? WARNING_THRESHOLD;
  if (input.used < input.nCtx * threshold) {
    return 'send';
  }
  switch (input.policy) {
    case 'expand':
      return input.canExpand ? 'expand' : 'compact';
    case 'compact':
      return 'compact';
    case 'ask':
      // 已到天花板无选择余地 → 直接压缩；否则询问用户（扩窗/压缩）。
      return input.canExpand ? 'ask' : 'compact';
  }
}
