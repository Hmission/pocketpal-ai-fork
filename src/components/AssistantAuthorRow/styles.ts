import {StyleSheet} from 'react-native';

import {Theme} from '../../utils/types';

export const styles = ({theme}: {theme: Theme}) =>
  StyleSheet.create({
    // 作者标签行：模型徽章 + 意图胶囊（与旧 renderBubble 作者行同高同距）
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.xxs,
      marginLeft: theme.spacing.sm,
      marginBottom: theme.spacing.xs,
    },
    modelBadge: {
      ...theme.typography.captionS,
      fontWeight: '600',
      color: theme.colors.brandAccent,
    },
    intentCapsule: {
      borderRadius: theme.radius[theme.shapeRoles.pill],
      paddingHorizontal: theme.spacing.xs,
      // B56②：1→xxs(2)（胶囊细内边距）
      paddingVertical: theme.spacing.xxs,
    },
    intentLabel: {
      ...theme.typography.captionS,
      fontWeight: '500',
    },
  });
