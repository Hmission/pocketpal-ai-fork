import {StyleSheet} from 'react-native';
import type {EdgeInsets} from 'react-native-safe-area-context';
import {Theme} from '../../utils/types';

export const createStyles = (theme: Theme, insets: EdgeInsets) =>
  StyleSheet.create({
    safeArea: {
      flex: 1,
    },
    container: {
      flex: 1,
      padding: theme.spacing.xxs,
      backgroundColor: theme.colors.surface,
    },
    listContainer: {
      // R2：150 静态值 → insets.bottom + xxl + xl（FAB 收拢态高 56 + 底距 + 手势条；
      // 宁多勿少——内容被遮是功能问题，多留白是几何问题；展开态由 FABGroup backdrop 覆盖）
      paddingBottom: insets.bottom + theme.spacing.xxl + theme.spacing.xl,
    },
    header: {
      paddingVertical: theme.spacing.sm,
      paddingHorizontal: theme.spacing.m,
      flexDirection: 'row',
      justifyContent: 'flex-end',
      alignItems: 'center',
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.outlineVariant,
    },
    filterContainer: {
      flexDirection: 'row',
      padding: theme.spacing.xs,
      // B56②：1→xxs(2)（icon 组细距）
      gap: theme.spacing.xxs,
      justifyContent: 'flex-end',
    },
    filterIcon: {
      borderRadius: theme.radius.s,
      marginHorizontal: theme.spacing.xxs,
    },
    imageGenSection: {
      marginTop: theme.spacing.m,
      paddingHorizontal: theme.spacing.m,
      paddingBottom: theme.spacing.xl,
    },
    imageGenTitle: {
      ...theme.typography.titleM,
      color: theme.colors.onSurfaceVariant,
      marginBottom: theme.spacing.s,
    },
    // B55②：文件冲突三选一动作行（Sheet 内嵌）
    conflictMessage: {
      ...theme.typography.bodyS,
      color: theme.colors.onSurfaceVariant,
      marginBottom: theme.spacing.m,
    },
    conflictRow: {
      paddingVertical: theme.spacing.m,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.colors.outlineVariant,
    },
    conflictRowLabel: {
      ...theme.typography.bodyM,
      color: theme.colors.onSurface,
    },
    conflictRowLabelDanger: {
      ...theme.typography.bodyM,
      fontWeight: '600',
      color: theme.colors.error,
    },
  });
