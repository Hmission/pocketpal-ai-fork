import {StyleSheet} from 'react-native';
import {Theme} from '../../utils/types';

export const createStyles = (theme: Theme) =>
  StyleSheet.create({
    // B46 迁移：正文（原 paper bodyMedium → bodyS token）
    bodyText: {
      ...theme.typography.bodyS,
      lineHeight: 20,
      color: theme.colors.onSurfaceVariant,
    },
    // B46 迁移：viewOnHuggingFace 链接下沉 body（原动作槽 text 按钮）
    hfLink: {
      ...theme.typography.uiS,
      color: theme.colors.primary,
      fontWeight: '600',
      marginTop: theme.spacing.sm,
    },
    stepItem: {
      paddingVertical: theme.spacing.s,
      marginVertical: theme.spacing.xxs,
    },
    stepRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: theme.spacing.s,
    },
    textContainer: {
      flex: 1,
      marginLeft: theme.spacing.sm,
    },
    stepText: {
      fontSize: theme.typography.bodyS.fontSize, // B56③ fontSize→bodyS
    },
    errorDetails: {
      // B56②：10→sm(12)（外层距）
      marginTop: theme.spacing.sm,
      padding: theme.spacing.s,
      backgroundColor: theme.colors.errorContainer,
      borderRadius: theme.radius.xs,
    },
    errorText: {
      color: theme.colors.error,
      fontSize: theme.typography.bodyS.fontSize,
    },
    stepsContainer: {
      marginTop: theme.spacing.m,
    },
  });
