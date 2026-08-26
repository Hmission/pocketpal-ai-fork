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
    configTextContainer: {
      gap: theme.spacing.xs,
      width: '100%',
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
    resultStd: {
      ...theme.typography.captionS,
      color: theme.colors.onSurfaceVariant,
    },
    deleteButton: {
      marginTop: -8,
      marginRight: -8,
    },
    footer: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingTop: theme.spacing.sm,
      borderTopWidth: 1,
      borderColor: theme.colors.surfaceVariant,
    },
    timestamp: {
      ...theme.typography.captionS,
      color: theme.colors.onSurfaceVariant,
    },
    submitButton: {
      borderColor: theme.colors.primary,
      borderRadius: theme.radius.ml,
    },
    errorText: {
      color: theme.colors.error,
      marginTop: theme.spacing.s,
      fontSize: theme.typography.captionM.fontSize, // B56③ fontSize→captionM
    },
    submittedText: {
      color: theme.colors.primary,
      fontSize: theme.typography.captionM.fontSize, // B56③ fontSize→captionM
    },
    tooltipContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.xs,
    },
    infoIcon: {
      fontSize: theme.typography.bodyS.fontSize, // B56③ fontSize→bodyS
      opacity: 0.6,
    },
    disabledText: {
      color: theme.colors.onSurfaceVariant,
      fontSize: theme.typography.captionM.fontSize, // B56③ fontSize→captionM
      fontStyle: 'italic',
    },
    shareContainer: {
      alignItems: 'center',
      gap: theme.spacing.s,
    },
    actionContainer: {
      flex: 1,
      alignItems: 'center',
      gap: theme.spacing.s,
    },
    shareTextContainer: {
      flex: 1,
      marginRight: theme.spacing.m,
    },
    sharePrompt: {
      color: theme.colors.primary,
      fontWeight: '500',
      marginBottom: theme.spacing.xxs,
    },
    shareSubtext: {
      color: theme.colors.onSurfaceVariant,
      fontSize: theme.typography.captionS.fontSize, // B56③ fontSize→captionS
    },
    leaderboardLink: {
      color: theme.colors.primary,
      textDecorationLine: 'underline',
    },
    errorContainer: {
      // B56②：10→sm(12)（外层距/卡内边距）/ radius 6→s(8)（小卡档）
      marginTop: theme.spacing.sm,
      padding: theme.spacing.sm,
      borderRadius: theme.radius.s,
      borderWidth: 1,
      backgroundColor: theme.colors.errorContainer,
      borderColor: theme.colors.error,
    },
    errorNetwork: {
      backgroundColor: theme.colors.errorContainer,
      borderColor: theme.colors.error,
    },
    errorAppCheck: {
      backgroundColor: theme.colors.errorContainer,
      borderColor: theme.colors.error,
    },
    errorServer: {
      backgroundColor: theme.colors.surfaceVariant,
      borderColor: theme.colors.onSurfaceVariant,
    },
    errorGeneric: {
      backgroundColor: theme.colors.errorContainer,
      borderColor: theme.colors.error,
    },
    retryButton: {
      // B56②：5→xs(4)（微距）
      marginTop: theme.spacing.xs,
      alignSelf: 'flex-end',
    },
  });
