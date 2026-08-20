import {StyleSheet} from 'react-native';

import type {Theme} from '../../../utils/types';

export const createStyles = (theme: Theme) =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: theme.colors.backdrop,
      alignItems: 'center',
      justifyContent: 'center',
      padding: theme.spacing.ml,
    },
    // 浮层表面角色（DESIGN_SPEC §4）：xl(32)；层级 8（§5.x Modal/弹窗）
    card: {
      width: '100%',
      backgroundColor: theme.colors.surfaceElevated,
      borderRadius: theme.radius[theme.shapeRoles.surface],
      padding: theme.spacing.ml,
      gap: theme.spacing.sm,
      elevation: 8,
    },
    title: {
      ...theme.typography.titleS,
      fontWeight: '600',
      color: theme.colors.onSurface,
    },
    actionsRoot: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      gap: theme.spacing.s,
      marginTop: theme.spacing.xs,
    },
  });
