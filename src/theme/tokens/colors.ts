/**
 * Color tokens — light and dark bindings.
 *
 * Sources:
 *   - Light values: current `createBaseColors(AppTheme.Light)` +
 *     `createSemanticColors(_, false)` output from `src/utils/theme.ts`,
 *     preserved verbatim (no visual regression).
 *   - Dark values: extracted from canonical Figma `RZxDJea4t6jnBZrV4YBacF`,
 *     dark band `3011:*`. Where the canonical dark binding disagreed with
 *     the current dark Theme value at a key with visible consumers, the
 *     current dark value wins to avoid visual regression; the disagreement
 *     is tracked as a designer follow-up.
 *
 * `withOpacity` calls are deferred to a util (not inlined as literals) so
 * the output is byte-identical to today's runtime computation — this is
 * what guarantees no visual regression for the surfaceContainer* + border
 * + placeholder etc keys that currently derive via opacity math.
 *
 * NOTE on imports: this module imports from `../../utils/colorUtils` only,
 * which is a pure utility (no React, no Paper, no MobX). The purity
 * constraint for this module forbids React/Paper/MobX imports only.
 */
import {withOpacity, stateLayerOpacity} from '../../utils/colorUtils';

import {TokenColors} from './types';

// Light base colors (verbatim from src/utils/theme.ts:111-147).
// B1（DESIGN_SPEC §1.1）：primary 升级为品牌暖黄；原灰黑降级为 INK ——
// 仅承担中性表面派生（outline/surfaceContainer*）与图标/头像等非交互职责，
// 避免 5% 透明度的黄色 outline 在浅色模式下不可见。
const LIGHT_PRIMARY = '#F5A623';
const LIGHT_INK = '#333333';
const LIGHT_SECONDARY = '#1E4DF6';
const LIGHT_TERTIARY = '#7880FF';
const LIGHT_ERROR = '#FF653F';
const LIGHT_BACKGROUND = '#ffffff';
const LIGHT_ON_BACKGROUND = '#111111';
const LIGHT_SURFACE = '#F9FAFB';
const LIGHT_ON_SURFACE = '#333333';
const LIGHT_INVERSE_ON_SURFACE = '#fcfcfc';

export const lightColors: TokenColors = {
  // MD3 base palette (light) — primary 为品牌暖黄（B1）
  primary: LIGHT_PRIMARY,
  onPrimary: '#3D2E00',
  primaryContainer: '#FDEBC8',
  onPrimaryContainer: '#4A3500',
  secondary: LIGHT_SECONDARY,
  onSecondary: '#FFFFFF',
  secondaryContainer: '#E0E0E0',
  onSecondaryContainer: '#424242',
  tertiary: LIGHT_TERTIARY,
  onTertiary: '#FFFFFF',
  tertiaryContainer: '#F1F3FF',
  onTertiaryContainer: '#013332',
  error: LIGHT_ERROR,
  onError: '#FFFFFF',
  errorContainer: '#E6ACA9',
  onErrorContainer: '#330B09',
  background: LIGHT_BACKGROUND,
  onBackground: LIGHT_ON_BACKGROUND,
  surface: LIGHT_SURFACE,
  onSurface: LIGHT_ON_SURFACE,
  surfaceVariant: '#e4e4e6',
  onSurfaceVariant: '#646466',
  outline: withOpacity(LIGHT_INK, 0.05),
  outlineVariant: '#a1a1a1',
  mutedLight: '#e5e3e1',
  // Figma `Color/Secondary/Default` — the secondary surface used by
  // small DS buttons (back chevron, audio glyph) over the muted canvas.
  secondaryDefault: '#f3f2f2',
  // MD3 extras
  surfaceDisabled: withOpacity('#fcfcfc', 0.12),
  onSurfaceDisabled: withOpacity('#333333', 0.38),
  inverseSurface: '#858585',
  inverseOnSurface: LIGHT_INVERSE_ON_SURFACE,
  inversePrimary: '#DEE0E6',
  inverseSecondary: '#95ABE6',
  shadow: '#000000',
  scrim: 'rgba(0, 0, 0, 0.25)',
  backdrop: 'rgba(51, 51, 51, 0.6)',

  // Semantic surface variants (light derives via neutral-ink tint math)
  surfaceContainerHighest: withOpacity(LIGHT_INK, 0.05),
  surfaceContainerHigh: withOpacity(LIGHT_INK, 0.03),
  surfaceContainer: withOpacity(LIGHT_INK, 0.02),
  surfaceContainerLow: withOpacity(LIGHT_INK, 0.01),
  surfaceContainerLowest: LIGHT_SURFACE,
  surfaceDim: withOpacity(LIGHT_INK, 0.06),
  surfaceBright: LIGHT_SURFACE,

  // Text
  text: LIGHT_ON_BACKGROUND,
  textSecondary: withOpacity(LIGHT_ON_SURFACE, 0.5),
  inverseText: LIGHT_INVERSE_ON_SURFACE,
  inverseTextSecondary: withOpacity(LIGHT_INVERSE_ON_SURFACE, 0.5),

  // Border / placeholder
  border: withOpacity(LIGHT_ON_SURFACE, 0.05),
  placeholder: withOpacity(LIGHT_ON_SURFACE, 0.3),

  // Interactive state opacities
  stateLayerOpacity: 0.12,
  hoverStateOpacity: stateLayerOpacity.hover,
  pressedStateOpacity: stateLayerOpacity.pressed,
  draggedStateOpacity: stateLayerOpacity.dragged,
  focusStateOpacity: stateLayerOpacity.focus,

  // Menu
  menuBackground: LIGHT_SURFACE,
  menuBackgroundDimmed: withOpacity(LIGHT_SURFACE, 0.9),
  menuBackgroundActive: withOpacity(LIGHT_INK, 0.08),
  menuSeparator: withOpacity(LIGHT_INK, 0.5),
  menuGroupSeparator: withOpacity('#000000', 0.08),
  menuText: LIGHT_ON_SURFACE,
  menuDangerText: LIGHT_ERROR,

  // Messages
  authorBubbleBackground: '#f2f2f2',
  // 助手气泡语义点缀色（品牌小鸡暖米色，深浅双模式；与品牌暖黄系同族）
  assistantBubbleBackground: '#FBF3E4',
  onAssistantBubble: '#4A3B22',
  // 品牌点缀色（小黄鸡暖黄）：性能数字/模型徽章等强调信息用，深浅双模式
  brandAccent: '#FFB300',
  onBrandAccent: '#3D2E00',
  receivedMessageDocumentIcon: LIGHT_INK,
  sentMessageDocumentIcon: LIGHT_ON_SURFACE,
  userAvatarImageBackground: 'transparent',
  userAvatarNameColors: [
    LIGHT_INK,
    LIGHT_SECONDARY,
    LIGHT_TERTIARY,
    LIGHT_ERROR,
  ],
  searchBarBackground: 'rgba(118, 118, 128, 0.12)',

  // Thinking bubble
  thinkingBubbleBackground: '#f0f5fa',
  thinkingBubbleText: '#0a5999',
  thinkingBubbleBorder: 'rgba(10, 89, 153, 0.4)',
  thinkingBubbleShadow: '#0a5999',
  thinkingBubbleChevronBackground: 'rgba(10, 89, 153, 0.1)',
  thinkingBubbleChevronBorder: 'rgba(10, 89, 153, 0.2)',

  // Status bar
  bgStatusActive: '#22c55e',
  bgStatusIdle: '#d1d5db',

  // Buttons
  btnPrimaryBg: '#eff6ff',
  btnPrimaryBorder: '#bfdbff',
  btnPrimaryText: '#1447e6',
  btnReadyBg: '#ecfdf5',
  btnReadyBorder: '#bbf7d0',
  btnReadyText: '#047857',
  btnDownloadBg: '#ecfdf5',
  btnDownloadBorder: '#bbf7d0',
  btnDownloadText: '#047857',

  // Icons
  iconModelTypeText: '#3b82f6',
  iconModelTypeVision: '#9810fa',
  iconModelTypeAudio: '#f97316',

  // 语义状态色（DESIGN_SPEC §1.3，浅深双 binding）
  success: '#2E7D32',
  onSuccess: '#FFFFFF',
  warning: '#EF6C00',
  onWarning: '#FFFFFF',
  danger: '#C62828',
  onDanger: '#FFFFFF',
  info: '#1565C0',
  onInfo: '#FFFFFF',

  // 模型族徽章色（DESIGN_SPEC §1.4）
  badgeSd35: '#8E24AA',
  badgeZImage: '#00838F',
  badgeDreamlite: '#D81B60',

  // 悬浮层表面：半透明+阴影分层（禁 blur；DESIGN_SPEC §1.5）
  surfaceElevated: 'rgba(255, 255, 255, 0.96)',

  // 功能域彩色（一域一色；浅色模式实色，DESIGN_SPEC §1.2）
  domain: {
    chat: '#1E4DF6',
    imageGen: '#D81B60',
    memory: '#00838F',
    knowledge: '#2E7D32',
    workspace: '#EF6C00',
    tools: '#6750A4',
  },

  // Accent — peach pill background (canonical Figma `Color/Accent/Peach`).
  accent: {
    peach: '#FCE7CF',
    // Progress-bar fill (canonical Figma `Color/Green/Strong`).
    greenStrong: '#7c8e8a',
  },
};

// Dark base values from canonical Figma. B1：primary 升级为品牌暖黄；
// 原浅灰降级为 INK，承担中性派生职责。
const DARK_PRIMARY = '#FFC54D';
const DARK_INK = '#DADDE6';
const DARK_SECONDARY = '#95ABE6';
const DARK_TERTIARY = '#80E6E4';
const DARK_ERROR = '#FF653F';
const DARK_BACKGROUND = '#000000';
const DARK_ON_BACKGROUND = '#ffffff';
const DARK_SURFACE = '#0E0E0E';
const DARK_ON_SURFACE = '#E2E2E2';
const DARK_INVERSE_ON_SURFACE = '#333333';

export const darkColors: TokenColors = {
  // MD3 base palette (dark) — primary 为品牌暖黄（B1）
  primary: DARK_PRIMARY,
  onPrimary: '#332700',
  primaryContainer: '#5C4400',
  onPrimaryContainer: '#FFE29A',
  secondary: DARK_SECONDARY,
  onSecondary: '#11214C',
  secondaryContainer: '#424242',
  onSecondaryContainer: '#E0E0E0',
  tertiary: DARK_TERTIARY,
  onTertiary: '#014C4C',
  tertiaryContainer: '#016665',
  onTertiaryContainer: '#9EE6E5',
  error: DARK_ERROR,
  onError: '#4C100D',
  errorContainer: '#661511',
  onErrorContainer: '#E6ACA9',
  background: DARK_BACKGROUND,
  onBackground: DARK_ON_BACKGROUND,
  surface: DARK_SURFACE,
  onSurface: DARK_ON_SURFACE,
  surfaceVariant: '#646466',
  onSurfaceVariant: '#e3e4e6',
  outline: '#444444',
  outlineVariant: '#a1a1a1',
  mutedLight: '#3a3937',
  // Figma `Color/Secondary/Default` — dark binding from canonical file.
  secondaryDefault: '#2a2928',
  // MD3 extras
  surfaceDisabled: withOpacity('#333333', 0.12),
  onSurfaceDisabled: withOpacity('#e5e5e6', 0.38),
  inverseSurface: '#e5e5e6',
  inverseOnSurface: DARK_INVERSE_ON_SURFACE,
  inversePrimary: '#5C4400',
  inverseSecondary: LIGHT_SECONDARY, // md3BaseColors.secondary used in current code
  shadow: '#ffffff',
  scrim: 'rgba(0, 0, 0, 0.25)',
  backdrop: 'rgba(66, 66, 66, 0.8)',

  // Semantic surface variants (dark derives via surface-tint math)
  // Explicit binding pending in a later design-system phase.
  surfaceContainerHighest: withOpacity(DARK_SURFACE, 0.22),
  surfaceContainerHigh: withOpacity(DARK_SURFACE, 0.16),
  surfaceContainer: withOpacity(DARK_SURFACE, 0.12),
  surfaceContainerLow: withOpacity(DARK_SURFACE, 0.08),
  surfaceContainerLowest: withOpacity(DARK_SURFACE, 0.04),
  surfaceDim: withOpacity(DARK_SURFACE, 0.06),
  surfaceBright: withOpacity(DARK_SURFACE, 0.24),

  // Text
  text: DARK_ON_BACKGROUND,
  textSecondary: withOpacity(DARK_ON_SURFACE, 0.5),
  inverseText: DARK_INVERSE_ON_SURFACE,
  inverseTextSecondary: withOpacity(DARK_INVERSE_ON_SURFACE, 0.5),

  // Border / placeholder
  border: withOpacity(DARK_ON_SURFACE, 0.05),
  placeholder: withOpacity(DARK_ON_SURFACE, 0.3),

  // Interactive state opacities
  stateLayerOpacity: 0.12,
  hoverStateOpacity: stateLayerOpacity.hover,
  pressedStateOpacity: stateLayerOpacity.pressed,
  draggedStateOpacity: stateLayerOpacity.dragged,
  focusStateOpacity: stateLayerOpacity.focus,

  // Menu
  menuBackground: '#2a2a2a',
  menuBackgroundDimmed: withOpacity(DARK_SURFACE, 0.9),
  menuBackgroundActive: withOpacity(DARK_INK, 0.08),
  menuSeparator: withOpacity(DARK_INK, 0.5),
  menuGroupSeparator: withOpacity('#FFFFFF', 0.08),
  menuText: DARK_ON_SURFACE,
  menuDangerText: DARK_ERROR,

  // Messages
  authorBubbleBackground: '#212121',
  // 助手气泡语义点缀色（暗色模式）
  // 助手气泡语义点缀色（暖棕底，深浅双模式；与品牌暖黄系同族）
  assistantBubbleBackground: '#2B2620',
  onAssistantBubble: '#E8DCC8',
  // 品牌点缀色（暗色模式：更柔和的金黄，保证深底对比度）
  brandAccent: '#FFC54D',
  onBrandAccent: '#332700',
  receivedMessageDocumentIcon: DARK_INK,
  sentMessageDocumentIcon: DARK_ON_SURFACE,
  userAvatarImageBackground: 'transparent',
  userAvatarNameColors: [DARK_INK, DARK_SECONDARY, DARK_TERTIARY, DARK_ERROR],
  searchBarBackground: 'rgba(28, 28, 30, 0.92)',

  // Thinking bubble
  thinkingBubbleBackground: '#142e4d',
  thinkingBubbleText: '#6abaff',
  thinkingBubbleBorder: 'rgba(74, 140, 199, 0.6)',
  thinkingBubbleShadow: '#4a9fff',
  thinkingBubbleChevronBackground: 'rgba(74, 140, 199, 0.15)',
  thinkingBubbleChevronBorder: 'rgba(74, 140, 199, 0.3)',

  // Status bar
  bgStatusActive: '#22c55e',
  bgStatusIdle: '#4b5563',

  // Buttons
  btnPrimaryBg: '#0f1629',
  btnPrimaryBorder: '#192645',
  btnPrimaryText: '#93c5fd',
  btnReadyBg: '#052e16',
  btnReadyBorder: '#166534',
  btnReadyText: '#6ee7b7',
  btnDownloadBg: '#0a1f17',
  btnDownloadBorder: '#143d2d',
  btnDownloadText: '#34d399',

  // Icons
  iconModelTypeText: '#93c5fd',
  iconModelTypeVision: '#c4b5fd',
  iconModelTypeAudio: '#fdba74',

  // 语义状态色（暗色模式：提亮变体保深底对比度）
  success: '#6BC67E',
  onSuccess: '#0B2E10',
  warning: '#FFB74D',
  onWarning: '#3E2600',
  danger: '#F28B82',
  onDanger: '#3B0906',
  info: '#90CAF9',
  onInfo: '#0D2744',

  // 模型族徽章色（暗色模式）
  badgeSd35: '#CE93D8',
  badgeZImage: '#4DD0E1',
  badgeDreamlite: '#F48FB1',

  // 悬浮层表面：半透明+阴影分层（禁 blur）
  surfaceElevated: 'rgba(30, 30, 32, 0.96)',

  // 功能域彩色（暗色模式：提亮变体）
  domain: {
    chat: '#7B9AF7',
    imageGen: '#F48FB1',
    memory: '#4DD0E1',
    knowledge: '#81C784',
    workspace: '#FFB74D',
    tools: '#B39DDB',
  },

  // Accent — peach pill background (dark binding from canonical Figma).
  accent: {
    peach: '#7A4A1F',
    // Progress-bar fill — dark binding mirrors the light token (same hue).
    greenStrong: '#7c8e8a',
  },
};
