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
    // 2026-08-27 大王报障：内容超高天地戳出——加 maxHeight 限高不溢出遮罩
    card: {
      width: '100%',
      maxHeight: '90%',
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
