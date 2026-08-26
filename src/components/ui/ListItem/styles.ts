import {StyleSheet} from 'react-native';

import {Theme} from '../../../utils/types';

export const createStyles = (theme: Theme) =>
  StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      // 行高 56（DESIGN_SPEC §4b：IconTile 40 + padding 8×2）
      paddingVertical: theme.spacing.s,
      paddingHorizontal: theme.spacing.s,
      gap: theme.spacing.s,
    },
    textWrap: {flex: 1, gap: theme.spacing.xxs},
    title: {
      ...theme.typography.bodyM,
      color: theme.colors.onSurface,
    },
    subtitle: {
      ...theme.typography.captionM,
      color: theme.colors.onSurfaceVariant,
    },
  });
