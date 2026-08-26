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
    // B57：ui/Progress 宽度契约（Meter 迁移后由 track width:100% + 此覆盖
    // 维持 BannerRow 对 banner-meter 的 alignSelf:'stretch' 断言）
    meter: {
      alignSelf: 'stretch',
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
