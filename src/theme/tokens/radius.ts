/**
 * Radius tokens. Single scale. Key names mirror canonical Figma
 * `Radius/*` (None/XXS/XS/S/M/ML/L/XL/XXL) so a Figma spec saying
 * `Radius/L` maps directly to `radius.l`. There is no `sm` step —
 * Figma jumps S(8) → M(12). The legacy lowercase `radius/radius-xs`
 * (= 4) alias resolves to `xs` here.
 */
import {TokenRadius} from './types';

export const radius: TokenRadius = {
  none: 0,
  xxs: 2,
  xs: 4,
  s: 8,
  m: 12,
  ml: 16,
  l: 20,
  xl: 32,
  xxl: 40,
  // 胶囊（pill 按钮/徽章/模型胶囊；DESIGN_SPEC §4）
  full: 999,
};

/**
 * Shape roles (DESIGN_SPEC §4 — 形状语言). The canonical role→token map: a
 * given shape role always resolves to one radius token, so every component
 * that asks for a role gets the same corner value (同角色同值). Components
 * SHOULD resolve radii via `radius[shapeRoles.<role>]` instead of hardcoding.
 */
export type ShapeRole =
  | 'card'
  | 'surface'
  | 'rectangle'
  | 'pill'
  | 'secondary'
  | 'inputSmall'
  | 'iconTile'
  | 'circle';

export const shapeRoles: Record<ShapeRole, keyof typeof radius> = {
  card: 'l', // 内容卡片：分组 Surface / 结果图卡 / 设置行卡
  surface: 'xl', // 浮层表面：抽屉 / 底部 sheet / 悬浮下拉面板
  rectangle: 'none', // 仅分隔线 / 全幅媒体 / 表格细线
  pill: 'full', // 主操作按钮 / chip / badge / 模型胶囊 / 圆形容器
  secondary: 'ml', // 次级按钮 / 输入框容器
  inputSmall: 's', // 输入框本体 / 小标签
  iconTile: 'm', // IconTile 40×40
  circle: 'full', // 头像 / FAB
};
