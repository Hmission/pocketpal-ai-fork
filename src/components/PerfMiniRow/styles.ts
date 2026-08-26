import {StyleSheet} from 'react-native';

import {withOpacity} from '../../utils/colorUtils';

import type {Theme} from '../../utils/types';

export const createStyles = (theme: Theme) =>
  StyleSheet.create({
    // 根容器：hairline 顶部分隔（与生图页 perfPanel 同一分隔语言，无灰底）
    root: {
      alignSelf: 'stretch',
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: theme.colors.outline,
      paddingTop: theme.spacing.xs,
      gap: theme.spacing.xs,
    },
    foldRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.xs,
    },
    foldTitle: {
      ...theme.typography.uiS,
      color: theme.colors.onSurfaceVariant,
      fontWeight: '600',
    },
    pssBig: {
      ...theme.typography.titleS,
      fontWeight: '700',
    },
    capsuleRow: {
      flexDirection: 'row',
      gap: theme.spacing.xs,
      flexShrink: 1,
    },
    capsule: {
      paddingHorizontal: theme.spacing.xs,
      paddingVertical: theme.spacing.xxs,
      borderRadius: theme.radius[theme.shapeRoles.pill],
      backgroundColor: withOpacity(theme.colors.onSurface, 0.06),
    },
    capsuleText: {
      ...theme.typography.captionS,
      color: theme.colors.onSurfaceVariant,
      fontSize: theme.typography.captionS.fontSize,
      lineHeight: 14,
    },
    chartWrap: {
      overflow: 'hidden',
    },
  });
