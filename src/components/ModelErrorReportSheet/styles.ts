import {StyleSheet, Platform} from 'react-native';
import {Theme} from '../../utils/types';

export const createStyles = (theme: Theme) =>
  StyleSheet.create({
    container: {
      paddingHorizontal: theme.spacing.m,
      paddingTop: theme.spacing.s,
      gap: theme.spacing.sm,
    },
    privacyNote: {
      color: theme.colors.onSurfaceVariant,
      lineHeight: 18,
      backgroundColor: theme.colors.surface,
      // B56②：10→sm(12)（面板卡内边距）
      padding: theme.spacing.sm,
      borderRadius: theme.radius.s,
    },
    errorSection: {
      backgroundColor: theme.colors.errorContainer,
      // B56②：10→sm(12)（面板卡内边距）
      padding: theme.spacing.sm,
      borderRadius: theme.radius.s,
    },
    errorLabel: {
      color: theme.colors.onErrorContainer,
      marginBottom: theme.spacing.xs,
    },
    errorText: {
      color: theme.colors.onErrorContainer,
    },
    groupContainer: {
      backgroundColor: theme.colors.surface,
      borderRadius: theme.radius.s,
      overflow: 'hidden',
    },
    groupDisabled: {
      opacity: 0.5,
    },
    groupHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingRight: theme.spacing.sm,
    },
    groupTitle: {
      flex: 1,
      color: theme.colors.onSurface,
    },
    groupContent: {
      paddingHorizontal: theme.spacing.sm,
      // B56②：10→sm(12)（底部内容距）
      paddingBottom: theme.spacing.sm,
      gap: theme.spacing.xs,
    },
    fieldRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: theme.spacing.xxs,
    },
    fieldLabel: {
      color: theme.colors.onSurfaceVariant,
      flex: 1,
    },
    fieldValue: {
      color: theme.colors.onSurface,
      flex: 2,
      textAlign: 'right',
    },
    jsonText: {
      color: theme.colors.onSurface,
      fontSize: theme.typography.captionS.fontSize, // B56③ fontSize→captionS
      fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
      backgroundColor: theme.colors.surface,
      padding: theme.spacing.s,
      borderRadius: theme.radius.xs,
    },
    additionalSection: {
      // B56②：6→xs(4)（紧凑 stack gap）
      gap: theme.spacing.xs,
    },
    label: {
      color: theme.colors.onSurface,
    },
    textInput: {
      backgroundColor: theme.colors.surface,
      fontSize: theme.typography.bodyS.fontSize, // B56③ fontSize→bodyS
    },
    button: {},
    actionsContainer: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      width: '100%',
      paddingHorizontal: theme.spacing.m,
    },
  });
