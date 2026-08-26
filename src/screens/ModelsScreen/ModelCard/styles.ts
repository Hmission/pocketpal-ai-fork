import {StyleSheet} from 'react-native';

import {Theme} from '../../../utils/types';

export const createStyles = (theme: Theme) =>
  StyleSheet.create({
    card: {
      borderRadius: theme.radius.l, // B56① radius 不扩档（镜像 Figma 量表），原值 24 归 l 档（原注：匹配 rounded-3xl 24px）
      // B56②：6→s(8)（卡片间标准距）
      margin: theme.spacing.s,
      //overflow: 'hidden',
      backgroundColor: theme.colors.background,
      borderColor: theme.colors.outline,
      borderWidth: 1,
    },
    cardContent: {
      // B56②：6→xs(4)（紧凑内容底）
      paddingBottom: theme.spacing.xs,
      paddingTop: 0,
      //paddingHorizontal: 12,
    },
    downloadProgressContainer: {
      // B56②：18→m(16)（水平距）/ 6→xs(4)（紧凑）
      marginHorizontal: theme.spacing.m,
      marginTop: theme.spacing.xs,
      marginBottom: theme.spacing.sm,
    },
    // B57：progressBar 键随 paper ProgressBar 清零删除（ui/Progress 自带高度/圆角）
    downloadSpeed: {
      textAlign: 'right',
      fontSize: theme.typography.captionM.fontSize, // B56③ fontSize→captionM
      marginTop: theme.spacing.xs,
    },
    warningContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: theme.spacing.s,
      marginBottom: theme.spacing.sm,
    },
    warningContent: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
    },
    warningIcon: {
      margin: 0,
    },
    warningText: {
      color: theme.colors.error,
      fontSize: theme.typography.captionM.fontSize, // B56③ fontSize→captionM
      flex: 1,
      flexWrap: 'wrap',
    },
    visionToggleContainer: {
      backgroundColor: theme.colors.surface,
      borderRadius: theme.radius.ml,
      padding: theme.spacing.sm,
      gap: theme.spacing.s,
    },
    compactHeader: {
      // B56②：18→m(16)（水平距）
      paddingHorizontal: theme.spacing.m,
      paddingVertical: theme.spacing.sm,
    },
    headerContent: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    headerLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
      minWidth: 0,
      // B56②：10→sm(12)（水平性）
      gap: theme.spacing.sm,
    },
    headerRight: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.s,
    },
    modelTypeIcon: {
      flexShrink: 0,
    },
    compactModelName: {
      //fontSize: 16,
      //fontWeight: '600',
      color: theme.colors.onSurface,
      flex: 1,
    },
    sizeInfo: {
      flexDirection: 'row',
      alignItems: 'center',
      marginRight: theme.spacing.s,
    },
    sizeInfoText: {
      fontSize: theme.typography.captionM.fontSize, // B56③ fontSize→captionM
      color: theme.colors.onSurfaceVariant,
      marginLeft: theme.spacing.xs,
    },
    serverLink: {
      flexDirection: 'row',
      alignItems: 'center',
      marginRight: theme.spacing.s,
    },
    serverLinkText: {
      fontSize: theme.typography.captionM.fontSize, // B56③ fontSize→captionM
      color: theme.colors.primary,
      marginLeft: theme.spacing.xs,
      textDecorationLine: 'underline',
    },
    statusDot: {
      width: 8,
      height: 8,
      borderRadius: theme.radius.xs,
    },
    detailsContent: {
      // B56②：18→m(16)（水平距/底部距）
      paddingHorizontal: theme.spacing.m,
      paddingBottom: theme.spacing.m,
      gap: theme.spacing.sm,
    },
    descriptionContainer: {
      backgroundColor: theme.colors.surface,
      borderRadius: theme.radius.ml, // rounded-2xl
      padding: theme.spacing.sm,
    },
    descriptionText: {
      fontSize: theme.typography.bodyS.fontSize, // B56③ fontSize→bodyS
      color: theme.colors.onSurface,
      lineHeight: 20, // leading-relaxed
    },
    technicalDetailsGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      // B56②：10→sm(12)（网格水平性）
      gap: theme.spacing.sm,
    },
    technicalDetailCard: {
      backgroundColor: theme.colors.surface,
      borderRadius: theme.radius.ml, // rounded-2xl
      // B56②：10→sm(12)（卡内边距）
      padding: theme.spacing.sm,
      flex: 1,
      minWidth: '45%', // Approximate 2-column grid
    },
    technicalDetailLabel: {
      fontSize: theme.typography.uiS.fontSize, // B56③ fontSize→uiS
      color: theme.colors.onSurfaceVariant,
      // B56②：3→xs(4)（微距）
      marginBottom: theme.spacing.xs,
    },
    technicalDetailValue: {
      fontSize: theme.typography.uiM.fontSize, // B56③ fontSize→uiM
      fontWeight: '500',
      color: theme.colors.onSurface,
    },
    hfLinkButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: theme.spacing.sm,
      paddingHorizontal: theme.spacing.sm,
      backgroundColor: theme.colors.surface,
      borderRadius: theme.radius.ml, // rounded-2xl
      borderWidth: 2,
      borderColor: theme.colors.primaryContainer,
    },
    hfLinkContent: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    hfLinkText: {
      fontSize: theme.typography.captionM.fontSize, // B56③ fontSize→captionM
      color: theme.colors.primary,
      marginLeft: theme.spacing.s,
    },
    // Action buttons section
    actionButtonsContainer: {
      // B56②：18→m(16)（水平距）
      paddingHorizontal: theme.spacing.m,
      paddingBottom: theme.spacing.sm,
    },
    actionButtonsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.s, // gap-2 equivalent
    },
    primaryActionButton: {
      flex: 1,
      borderRadius: theme.radius.ml, // rounded-2xl
      borderWidth: 1,
      height: 40,
    },
    iconButton: {
      padding: theme.spacing.sm, // p-2.5 equivalent，B56②：10→sm(12)
      borderRadius: theme.radius.ml, // rounded-2xl
      backgroundColor: 'transparent',
      alignItems: 'center',
      justifyContent: 'center',
      minWidth: 40,
      minHeight: 40,
    },
    visionToggleHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    visionToggleLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.s,
      flex: 1,
    },
    visionToggleLabel: {
      fontSize: theme.typography.uiM.fontSize, // B56③ fontSize→uiM
      fontWeight: '500',
      color: theme.colors.onSurface,
    },
    visionHelpText: {
      fontSize: theme.typography.captionS.fontSize, // B56③ fontSize→captionS
      color: theme.colors.onSurfaceVariant,
      fontStyle: 'italic',
    },
    projectionModelsContainer: {
      backgroundColor: theme.colors.surface,
      borderRadius: theme.radius.ml,
      padding: theme.spacing.sm,
    },
    warningButton: {
      // B56②：6→xs(4)（紧凑垂直）/ radius 6→s(8)（按钮档）
      paddingVertical: theme.spacing.xs,
      paddingHorizontal: theme.spacing.s,
      backgroundColor: theme.colors.errorContainer,
      borderRadius: theme.radius.s,
      marginTop: theme.spacing.s,
    },
    warningButtonText: {
      fontSize: theme.typography.uiS.fontSize, // B56③ fontSize→uiS
      color: theme.colors.onErrorContainer,
      textAlign: 'center',
    },
    storageErrorText: {
      marginHorizontal: theme.spacing.ml,
    },
    fullModelNameContainer: {
      backgroundColor: theme.colors.surface,
      borderRadius: theme.radius.ml,
      padding: theme.spacing.sm,
    },
    fullModelNameLabel: {
      fontSize: theme.typography.uiS.fontSize, // B56③ fontSize→uiS
      color: theme.colors.onSurfaceVariant,
      marginBottom: theme.spacing.xs,
      fontWeight: '500',
    },
    fullModelNameText: {
      fontSize: theme.typography.uiM.fontSize, // B56③ fontSize→uiM
      color: theme.colors.onSurface,
      lineHeight: 20,
    },
  });
