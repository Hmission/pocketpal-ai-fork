import {StyleSheet} from 'react-native';

import {Theme} from '../../../utils/types';

export const createStyles = (theme: Theme) =>
  StyleSheet.create({
    content: {
      paddingHorizontal: theme.spacing.m,
      paddingTop: theme.spacing.s,
    },
    input: {
      marginBottom: theme.spacing.s,
    },
    lookupButton: {
      marginBottom: theme.spacing.s,
    },
    error: {
      ...theme.typography.bodyS,
      color: theme.colors.error,
      marginBottom: theme.spacing.s,
    },
    modelTitle: {
      ...theme.typography.titleM,
      color: theme.colors.onSurface,
      marginBottom: theme.spacing.xs,
    },
    sectionTitle: {
      ...theme.typography.titleS,
      color: theme.colors.onSurfaceVariant,
      marginTop: theme.spacing.s,
      marginBottom: theme.spacing.xs,
    },
    list: {
      paddingHorizontal: theme.spacing.m,
      // R2：120 静态底缘 → xxl + xl（72）。Sheet 70% 底部按钮区无遮挡物，bottomOffset=100 键盘补偿管键盘场景（完整分区列入下批）
      paddingBottom: theme.spacing.xxl + theme.spacing.xl,
    },
    fileRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: theme.spacing.s,
      paddingHorizontal: theme.spacing.m,
      borderRadius: theme.roundness,
      backgroundColor: theme.colors.surfaceVariant,
      marginBottom: theme.spacing.s,
    },
    fileText: {
      flex: 1,
      marginRight: theme.spacing.m,
    },
    fileName: {
      ...theme.typography.bodyM,
      color: theme.colors.onSurface,
    },
    fileSize: {
      ...theme.typography.bodyS,
      color: theme.colors.onSurfaceVariant,
      marginTop: theme.spacing.xxs,
    },
  });
