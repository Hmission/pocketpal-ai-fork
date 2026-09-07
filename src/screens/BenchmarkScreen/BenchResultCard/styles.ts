import {StyleSheet} from 'react-native';
import type {Theme} from '../../../utils/types';

export const createStyles = (theme: Theme) =>
  StyleSheet.create({
    resultCard: {
      backgroundColor: theme.colors.surface,
      borderRadius: theme.radius.ml,
      borderWidth: 1,
      borderColor: theme.colors.surfaceVariant,
    },
    resultHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: theme.spacing.m,
    },
    headerLeft: {
      flex: 1,
      marginRight: theme.spacing.m,
    },
    modelName: {
      color: theme.colors.onSurface,
      marginBottom: theme.spacing.xs,
      //fontSize: 18,
      //fontWeight: '500',
    },
    modelMeta: {
      fontSize: theme.typography.captionM.fontSize, // B56③ fontSize→captionM
      color: theme.colors.onSurfaceVariant,
    },
    configContainer: {
      borderTopWidth: 1,
      borderBottomWidth: 1,
      borderColor: theme.colors.surfaceVariant,
      marginVertical: theme.spacing.s,
      paddingHorizontal: theme.spacing.sm,
    },
    configBar: {
      flexDirection: 'column',
      alignItems: 'flex-start',
      paddingVertical: theme.spacing.s,
      gap: theme.spacing.xs,
    },
    configText: {
      fontSize: theme.typography.captionM.fontSize, // B56③ fontSize→captionM
      color: theme.colors.onSurfaceVariant,
      flex: 1,
    },
    resultsContainer: {
      marginBottom: theme.spacing.m,
      backgroundColor: theme.colors.surfaceVariant,
      borderRadius: theme.radius.m,
      padding: theme.spacing.m,
    },
    resultRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'stretch',
      marginBottom: theme.spacing.m,
    },
    resultItem: {
      flex: 1,
      paddingHorizontal: theme.spacing.s,
    },
    resultValue: {
      // 数字强调（DESIGN_SPEC §2.1 numericM：等宽字体，基准数据专用）
      ...theme.typography.numericM,
      color: theme.colors.onSurface,
      marginBottom: theme.spacing.xxs,
    },
    resultUnit: {
      ...theme.typography.bodyS,
      color: theme.colors.onSurfaceVariant,
      fontWeight: 'normal',
    },
    resultLabel: {
      ...theme.typography.captionS,
      color: theme.colors.onSurfaceVariant,
      marginBottom: theme.spacing.xxs,
      letterSpacing: 0.1,
    },
    deleteButton: {
      marginTop: -8,
      marginRight: -8,
    },
    timestamp: {
      ...theme.typography.captionS,
      color: theme.colors.onSurfaceVariant,
    },
  });
