import {StyleSheet, ViewStyle} from 'react-native';

import type {Theme} from '../../../utils/types';
import {withOpacity} from '../../../utils/colorUtils';

export type BannerVariant = 'neutral' | 'warning' | 'error' | 'info' | 'tools';

type BannerTint = ViewStyle & {fill: string};

// 语义色 → tint（12% wash 底 + 25% 边框）+ 进度填充色；neutral = 信息带
const tintFor = (theme: Theme, variant: BannerVariant): BannerTint => {
  switch (variant) {
    case 'warning':
      return {
        backgroundColor: withOpacity(theme.colors.warning, 0.12),
        borderColor: withOpacity(theme.colors.warning, 0.25),
        fill: theme.colors.warning,
      };
    case 'error':
      return {
        backgroundColor: withOpacity(theme.colors.error, 0.12),
        borderColor: withOpacity(theme.colors.error, 0.25),
        fill: theme.colors.error,
      };
    case 'info':
      return {
        backgroundColor: withOpacity(theme.colors.info, 0.12),
        borderColor: withOpacity(theme.colors.info, 0.25),
        fill: theme.colors.info,
      };
    // 工具域（DESIGN_SPEC §1.2：ActiveTaskBanner 归属 tools 域色）
    case 'tools':
      return {
        backgroundColor: withOpacity(theme.colors.domain.tools, 0.12),
        borderColor: withOpacity(theme.colors.domain.tools, 0.25),
        fill: theme.colors.domain.tools,
      };
    case 'neutral':
    default:
      return {
        backgroundColor: theme.colors.surfaceVariant,
        borderColor: theme.colors.outline,
        fill: theme.colors.primary,
      };
  }
};

export const createStyles = (theme: Theme) => {

  return StyleSheet.create({
    root: {
      paddingHorizontal: theme.spacing.sm,
      paddingVertical: theme.spacing.s,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderBottomWidth: StyleSheet.hairlineWidth,
      gap: theme.spacing.xs,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.xs,
    },
    text: {
      flex: 1,
      ...theme.typography.captionM,
      lineHeight: 17,
      color: theme.colors.onSurfaceVariant,
    },
    percent: {
      ...theme.typography.captionM,
      fontWeight: '600',
      fontVariant: ['tabular-nums'],
    },
    meter: {
      height: 4,
      borderRadius: theme.radius.xxs,
      backgroundColor: theme.colors.surfaceDisabled,
      overflow: 'hidden',
      alignSelf: 'stretch',
      width: '100%',
    },
    meterFill: {
      height: 4,
      borderRadius: theme.radius.xxs,
      // 填充色由 tint(variant).fill 动态注入（语义色随变体）
    },
    actions: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      justifyContent: 'flex-end',
      gap: theme.spacing.s,
    },
    action: {
      paddingHorizontal: theme.spacing.xs,
      paddingVertical: theme.spacing.xxs,
    },
    actionText: {
      ...theme.typography.uiS,
      fontWeight: '600',
      color: theme.colors.primary,
    },
  });
};

export {tintFor};
