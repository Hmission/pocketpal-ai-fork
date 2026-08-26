import {StyleSheet, type TextStyle, type ViewStyle} from 'react-native';

import type {Theme} from '../../../utils/types';

export type ChipVariant = 'display' | 'selectable' | 'input' | 'outline';
export type ChipSize = 's' | 'm';
/** outline 变体的语义色（描边/文本同色） */
export type ChipColor = 'primary' | 'danger';

export type ChipStyleArgs = {
  variant: ChipVariant;
  size: ChipSize;
  selected?: boolean;
  disabled?: boolean;
  /** 仅 outline 变体生效 */
  color?: ChipColor;
};

const sizeTokens = (theme: Theme, size: ChipSize) => {
  if (size === 's') {
    return {
      paddingHorizontal: theme.spacing.s,
      paddingVertical: theme.spacing.xxs,
      borderRadius: theme.radius.xs,
      labelStyle: theme.typography.captionS,
      gap: theme.spacing.xxs,
    };
  }
  return {
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.radius.s,
    labelStyle: theme.typography.captionM,
    gap: theme.spacing.xs,
  };
};

const variantTokens = (
  theme: Theme,
  variant: ChipVariant,
  selected: boolean,
  disabled: boolean,
  color: ChipColor = 'primary',
) => {
  // B57：outline 变体——透明底 + 1px 描边 + 语义色（收敛动作胶囊样板：
  // ImageTaskActions/TaskErrorCard/ButlerUpgradeRow 等 4 处）
  if (variant === 'outline') {
    const accent =
      color === 'danger' ? theme.colors.error : theme.colors.primary;
    if (disabled) {
      return {
        background: 'transparent',
        foreground: theme.colors.onSurfaceVariant,
        borderColor: theme.colors.outlineVariant,
      };
    }
    return {
      background: 'transparent',
      foreground: accent,
      borderColor: accent,
    };
  }
  if (disabled) {
    return {
      background: theme.colors.surfaceContainerLow,
      foreground: theme.colors.onSurfaceVariant,
    };
  }
  if (variant === 'selectable' && selected) {
    return {
      background: theme.colors.secondaryContainer,
      foreground: theme.colors.onSecondaryContainer,
    };
  }
  if (variant === 'input') {
    return {
      background: theme.colors.surfaceContainerHigh,
      foreground: theme.colors.onSurface,
    };
  }
  return {
    background: theme.colors.surfaceContainer,
    foreground: theme.colors.onSurface,
  };
};

export const createStyles = (
  theme: Theme,
  {variant, size, selected, disabled, color}: ChipStyleArgs,
) => {
  const s = sizeTokens(theme, size);
  const v = variantTokens(theme, variant, !!selected, !!disabled, color);
  const root: ViewStyle = {
    paddingHorizontal: s.paddingHorizontal,
    paddingVertical: s.paddingVertical,
    // outline 变体统一胶囊形（对齐动作胶囊样板）；其余变体保持 size 档
    borderRadius:
      variant === 'outline'
        ? theme.radius[theme.shapeRoles.pill]
        : s.borderRadius,
    backgroundColor: v.background,
    // B57：outline 描边兜底色
    borderWidth: variant === 'outline' ? 1 : 0,
    borderColor: (v as {borderColor?: string}).borderColor ?? 'transparent',
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: s.gap,
  };
  const label: TextStyle = {
    ...s.labelStyle,
    fontWeight: '600',
    color: v.foreground,
  };
  return StyleSheet.create({root, label});
};
