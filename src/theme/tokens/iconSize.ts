/**
 * Icon size tokens (B10). Single scale, canonical Figma `Icon/*` mapping.
 *
 * 规范（DESIGN_SPEC §4 / ICON_SPEC §4.5）：顶栏与同行栏位图标 = m(20)，内容区小图标 = s(16)，
 * 行尾指示件与工具条图标 = inline(18)，大触控/强调图标 = l(24)。组件一律经
 * `theme.iconSize.<role>` 解析，禁止硬编码像素值。
 *
 * 注：`inline`/`micro`/`hero`/`display` 都是**把仓内已成事实的尺寸转正**（值不变、只给名字），
 * 而不是拿现有档去推平它们——后者会用“归档”的名义静默重排观感（W9a/W9b-lite，2026-09-08）。
 * 尚余 10/13/15/22/26/32/36 需逐屏目视定归向（W9b-V，见 ICON_SPEC §4.5）。
 */
import {TokenIconSize} from './types';

export const iconSize: TokenIconSize = {
  micro: 12,
  xs: 14,
  s: 16,
  inline: 18,
  m: 20,
  l: 24,
  xl: 28,
  hero: 34,
  display: 48,
};
