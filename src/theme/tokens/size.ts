/**
 * Size tokens — 控件尺寸/触区基线（R1，2026-08-26）。
 *
 * 病灶（REMAINING_FIX_PLAN §二）：44/36 裸值靠「人人记得写」维系——同 spacing
 * 野档病根。补常量即断根：行/输入/触发器用 `minTapTarget` 实体高度；紧凑控件
 * 用 `controlHeight` 基线（≤36 的紧凑图标钮触区由 hitSlop 补偿至 44）。
 */
import {TokenSize} from './types';

export const size: TokenSize = {
  /** 最小触控目标（Apple HIG 44pt · 无障碍触区基线） */
  minTapTarget: 44,
  /** 紧凑控件/行高基线（聊天输入 36px 高度基线等） */
  controlHeight: 36,
};
