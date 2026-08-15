/**
 * Design-token types for PocketPal's new design system (Phase 1).
 *
 * Pure data types. No React, no Paper, no MobX imports.
 */
import {TextStyle} from 'react-native';

import type {ShapeRole} from './radius';

export type Mode = 'light' | 'dark';

/**
 * Color tokens — every key has a light and dark binding (encoded in the
 * `lightColors` / `darkColors` exports). Names mirror MD3 conventions for
 * the migration layer; semantic / PocketPal-specific extras are appended.
 */
export interface TokenColors {
  // MD3 base palette
  primary: string;
  onPrimary: string;
  primaryContainer: string;
  onPrimaryContainer: string;
  secondary: string;
  onSecondary: string;
  secondaryContainer: string;
  onSecondaryContainer: string;
  tertiary: string;
  onTertiary: string;
  tertiaryContainer: string;
  onTertiaryContainer: string;
  error: string;
  onError: string;
  errorContainer: string;
  onErrorContainer: string;
  background: string;
  onBackground: string;
  surface: string;
  onSurface: string;
  surfaceVariant: string;
  onSurfaceVariant: string;
  outline: string;
  outlineVariant: string;
  // Subtle border / divider colour. Maps to design-system muted/light.
  mutedLight: string;
  // Design-system `Color/Secondary/Default` — small DS button surface.
  secondaryDefault: string;

  // MD3 extras
  surfaceDisabled: string;
  onSurfaceDisabled: string;
  inverseSurface: string;
  inverseOnSurface: string;
  inversePrimary: string;
  inverseSecondary: string;
  shadow: string;
  scrim: string;
  backdrop: string;

  // Surface variants (semantic; current dark theme derives via withOpacity)
  surfaceContainerHighest: string;
  surfaceContainerHigh: string;
  surfaceContainer: string;
  surfaceContainerLow: string;
  surfaceContainerLowest: string;
  surfaceDim: string;
  surfaceBright: string;

  // Text
  text: string;
  textSecondary: string;
  inverseText: string;
  inverseTextSecondary: string;

  // Border / placeholder
  border: string;
  placeholder: string;

  // Interactive state opacities (kept under colors for source-compat; will
  // move to a dedicated `interaction` namespace in a later phase)
  stateLayerOpacity: number;
  hoverStateOpacity: number;
  pressedStateOpacity: number;
  draggedStateOpacity: number;
  focusStateOpacity: number;

  // Menu
  menuBackground: string;
  menuBackgroundDimmed: string;
  menuBackgroundActive: string;
  menuSeparator: string;
  menuGroupSeparator: string;
  menuText: string;
  menuDangerText: string;

  // Messages
  authorBubbleBackground: string;
  /** 助手气泡语义点缀色（低饱和暖蓝，深浅双模式） */
  assistantBubbleBackground: string;
  /** 助手气泡上的文本色 */
  onAssistantBubble: string;
  /** 品牌点缀色（小黄鸡暖黄）：性能数字/模型徽章等强调信息用 */
  brandAccent: string;
  /** 品牌点缀色上的文本色 */
  onBrandAccent: string;
  receivedMessageDocumentIcon: string;
  sentMessageDocumentIcon: string;
  userAvatarImageBackground: string;
  userAvatarNameColors: string[];
  searchBarBackground: string;

  // Thinking bubble
  thinkingBubbleBackground: string;
  thinkingBubbleText: string;
  thinkingBubbleBorder: string;
  thinkingBubbleShadow: string;
  thinkingBubbleChevronBackground: string;
  thinkingBubbleChevronBorder: string;

  // Status bar
  bgStatusActive: string;
  bgStatusIdle: string;

  // Buttons
  btnPrimaryBg: string;
  btnPrimaryBorder: string;
  btnPrimaryText: string;
  btnReadyBg: string;
  btnReadyBorder: string;
  btnReadyText: string;
  btnDownloadBg: string;
  btnDownloadBorder: string;
  btnDownloadText: string;

  // Icons
  iconModelTypeText: string;
  iconModelTypeVision: string;
  iconModelTypeAudio: string;

  // 语义状态色（DESIGN_SPEC §1.3：收编生图四色按钮等散落硬编码）
  success: string;
  onSuccess: string;
  warning: string;
  onWarning: string;
  danger: string;
  onDanger: string;
  info: string;
  onInfo: string;

  // 模型族徽章色（DESIGN_SPEC §1.4）
  badgeSd35: string;
  badgeZImage: string;
  badgeDreamlite: string;

  // 悬浮层表面（半透明+阴影分层，禁 blur；DESIGN_SPEC §1.5）
  surfaceElevated: string;

  // 功能域彩色（一域一色，HarmonyOS Vivid Colour 思路；DESIGN_SPEC §1.2）
  domain: {
    chat: string;
    imageGen: string;
    memory: string;
    knowledge: string;
    workspace: string;
    tools: string;
  };

  // Accent — peach pill / recommended-tier highlight (canonical Figma
  // `Color/Accent/Peach`; see `accent.peach` consumers in onboarding).
  // `accent.greenStrong` powers the download progress-bar fill.
  accent: {
    peach: string;
    greenStrong: string;
  };
}

/**
 * A single named typography style ready to spread into a RN TextStyle.
 * Line-heights are absolute pixels (no multipliers or percentage strings).
 * `fontWeight` is the literal weight string RN accepts.
 */
export interface TypographyStyle {
  fontFamily: string;
  fontSize: number;
  lineHeight: number;
  fontWeight: TextStyle['fontWeight'];
  letterSpacing?: number;
  fontStyle?: TextStyle['fontStyle'];
}

/**
 * Typography tokens — base (Latin) values. Locale-aware swapping happens
 * in the theme builder via `typographyForLocale()`.
 */
export interface TokenTypography {
  displayS: TypographyStyle;
  bodyM: TypographyStyle;
  bodyS: TypographyStyle;
  uiM: TypographyStyle;
  uiS: TypographyStyle;
  titleL: TypographyStyle;
  titleM: TypographyStyle;
  titleS: TypographyStyle;
  captionM: TypographyStyle;
  captionS: TypographyStyle;
  headlineH1: TypographyStyle;
  styledXs: TypographyStyle;
  codeM: TypographyStyle;
  codeS: TypographyStyle;
  numericM: TypographyStyle;
}

export interface TokenSpacing {
  none: 0;
  xxs: 2;
  xs: 4;
  s: 8;
  sm: 12;
  m: 16;
  ml: 20;
  l: 24;
  xl: 32;
  xxl: 40;
}

// Key names mirror canonical Figma `Radius/*` (None/XXS/XS/S/M/ML/L/XL/XXL)
// so a Figma spec saying `Radius/L` maps directly to `theme.radius.l`.
// Note: there is no `sm` step — Figma jumps S(8) → M(12).
export interface TokenRadius {
  none: 0;
  xxs: 2;
  xs: 4;
  s: 8;
  m: 12;
  ml: 16;
  l: 20;
  xl: 32;
  xxl: 40;
  // 胶囊（pill 按钮/徽章/模型胶囊；DESIGN_SPEC §4）
  full: 999;
}

// Key names mirror canonical Figma `Stroke/*` (xs/sm/md/lg).
export interface TokenStroke {
  xs: 0.5;
  sm: 1;
  md: 1.5;
  lg: 3;
}

/**
 * The full set of resolved tokens for a given mode. Mode selection is a
 * binding selection (light vs dark), not a mutation.
 */
export interface Tokens {
  colors: TokenColors;
  typography: TokenTypography;
  spacing: TokenSpacing;
  radius: TokenRadius;
  stroke: TokenStroke;
  // shapeRoles 角色→radius 映射（DESIGN_SPEC §4 形状语言），供 theme.shapeRoles 暴露
  shapeRoles: Record<ShapeRole, keyof TokenRadius>;
}
