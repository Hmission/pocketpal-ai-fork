/**
 * Icon size tokens (B10). Single scale, canonical Figma `Icon/*` mapping.
 *
 * 规范（DESIGN_SPEC §4）：顶栏图标 = m(20)，内容区小图标 = s(16)，
 * 大触控/强调图标 = l(24)。组件一律经 `theme.iconSize.<role>` 解析，
 * 禁止硬编码 16/18/20/22/24/40。
 */
import {TokenIconSize} from './types';

export const iconSize: TokenIconSize = {
  xs: 14,
  s: 16,
  m: 20,
  l: 24,
  xl: 28,
};
