/**
 * Onboarding illustration assets.
 *
 * 品牌化（2026-08-14）：Splash/Screen1 hero 已从小黄鸡 PNG 源图
 * `pocketpal-dark-v2.png`（与 app 图标同一源图）渲染，替换 PocketPal
 * 原版 splash-mark.svg。其余引导插画（PhoneWithPals 等）保持原样。
 *
 *  - `SplashMark`    — 小黄鸡品牌 mark（透明底 PNG，112×112）。
 *  - `Screen1Hero`   — 同 splash mark（欢迎页 hero，112×112）。
 *  - `ShieldGlyph`   — privacy-shield vector used inside screen 4's
 *                      phone-outline composite (Figma `885:29695`).
 *  - `chipIcons`     — per-topic vector glyphs for screen 5 chips,
 *                      exported verbatim from Figma's iconify slots
 *                      (`fluent:chat-28-filled`, `typcn:code`,
 *                      `wpf:books`, `solar:mask-happly-bold`,
 *                      `fa6-solid:feather`).
 *  - `ArrowRightGlyph` / `HeadphonesGlyph` — flat SVGs used by the
 *                      Figma button instances; matched 1:1 to avoid
 *                      hand-drawing.
 */
import React from 'react';
import {Image, ImageStyle} from 'react-native';
import ShieldGlyph from './shield.svg';
import ArrowRightGlyph from './arrow-right.svg';
import HeadphonesGlyph from './headphones.svg';

import SmartChatChip from './chip-icons/smart-chat.svg';
import CodingChip from './chip-icons/coding.svg';
import EducationChip from './chip-icons/education.svg';
import RoleplayChip from './chip-icons/roleplay.svg';
import CreativeWritingChip from './chip-icons/creative-writing.svg';

import type {TopicKey} from '../../store/onboarding/types';

// 小黄鸡品牌 mark（透明底 PNG，与 app 图标同一源图）
import chickMark from '../pocketpal-dark-v2.png';

type MarkProps = {
  width?: number;
  height?: number;
  accessibilityLabel?: string;
  accessibilityRole?: string;
};

/**
 * 小黄鸡 splash mark — 透明底 PNG 渲染，支持 width/height 与无障碍属性。
 */
export const SplashMark: React.FC<MarkProps> = ({
  width = 112,
  height = 112,
  accessibilityLabel,
  accessibilityRole,
}) => (
  <Image
    source={chickMark}
    style={{width, height} as ImageStyle}
    accessibilityLabel={accessibilityLabel}
    accessibilityRole={accessibilityRole as any}
  />
);

export {ShieldGlyph, ArrowRightGlyph, HeadphonesGlyph};

// Screen 1 hero 与 splash mark 同一源图（欢迎页 112×112）
export const Screen1Hero = SplashMark;

type SvgComponent = React.ComponentType<{
  width?: number;
  height?: number;
  fill?: string;
  stroke?: string;
}>;

// Per-topic chip glyphs (screen 5). Indexed by TopicKey. `else` is
// rendered as an outlined-only chip and intentionally has no glyph.
export const topicChipGlyphs: Partial<Record<TopicKey, SvgComponent>> = {
  smartchat: SmartChatChip,
  coding: CodingChip,
  education: EducationChip,
  roleplay: RoleplayChip,
  creative_writing: CreativeWritingChip,
};
