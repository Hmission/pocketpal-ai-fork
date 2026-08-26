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
      marginTop: 12,
    },
    stepItem: {
      paddingVertical: 8,
      marginVertical: 2,
    },
    stepRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 8,
    },
    textContainer: {
      flex: 1,
      marginLeft: 12,
    },
    stepText: {
      fontSize: 14,
    },
    errorDetails: {
      marginTop: 10,
      padding: 8,
      backgroundColor: theme.colors.errorContainer,
      borderRadius: 4,
    },
    errorText: {
      color: theme.colors.error,
      fontSize: 13,
    },
    stepsContainer: {
      marginTop: 16,
    },
  });
