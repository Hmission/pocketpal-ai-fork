import {StyleSheet} from 'react-native';
import {Theme} from '../../utils';

export const createStyles = (theme: Theme) =>
  StyleSheet.create({
    container: {
      marginTop: theme.spacing.s,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: theme.spacing.sm,
      paddingHorizontal: theme.spacing.xs,
    },
    headerTitle: {
      fontSize: theme.typography.uiM.fontSize, // B56③ fontSize→uiM
      fontWeight: '600',
      color: theme.colors.primary,
    },
    chevronIcon: {
      marginLeft: theme.spacing.s,
    },
    content: {
      paddingTop: theme.spacing.s,
    },
    emptyState: {
      alignItems: 'center',
      paddingVertical: theme.spacing.m,
    },
    emptyText: {
      textAlign: 'center',
      color: theme.colors.onSurfaceVariant,
      fontSize: theme.typography.captionM.fontSize, // B56③ fontSize→captionM
      // B56②：6→xs(4)（紧凑）
      marginTop: theme.spacing.xs,
      fontStyle: 'italic',
    },
    modelsList: {
      gap: theme.spacing.s,
    },
    singleModelTitle: {
      fontSize: theme.typography.uiS.fontSize, // B56③ fontSize→uiS
      fontWeight: '600',
      color: theme.colors.primary,
      marginBottom: theme.spacing.s,
    },
    modelItem: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: theme.spacing.sm,
      paddingHorizontal: theme.spacing.sm,
      backgroundColor: theme.colors.surface + '20', // Very subtle background
      borderRadius: theme.radius.s,
      borderLeftWidth: 3,
      borderLeftColor: 'transparent',
    },
    selectedModelItem: {
      borderLeftColor: theme.colors.tertiary,
      backgroundColor: theme.colors.tertiaryContainer + '20',
    },
    modelInfo: {
      flex: 1,
      marginRight: theme.spacing.s, // Reduced from 12 to 8
    },
    modelName: {
      fontSize: theme.typography.uiM.fontSize, // B56③ fontSize→uiM
      fontWeight: '500',
      color: theme.colors.onSurface,
      marginBottom: theme.spacing.xxs, // Small gap between name and size
    },
    selectedModelName: {
      fontWeight: '600',
      color: theme.colors.tertiary,
    },
    modelSize: {
      fontSize: theme.typography.captionS.fontSize, // B56③ fontSize→captionS
      color: theme.colors.onSurfaceVariant,
    },
    modelActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.xs, // Tighter spacing between action buttons
    },
    downloadedActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.xs, // Reduced from 8 to 4
    },
    selectArea: {
      // B56②：6→xs(4)（icon 钮紧凑 padding）/ radius 6→s(8)（按钮档）
      padding: theme.spacing.xs, // More compact padding
      borderRadius: theme.radius.s,
      alignItems: 'center',
      justifyContent: 'center',
      minWidth: 32, // Reduced from 70 to 32 for icon-only
      minHeight: 32,
    },
    selectedArea: {
      backgroundColor: theme.colors.tertiaryContainer + '30',
    },
    selectText: {
      fontSize: theme.typography.uiS.fontSize, // B56③ fontSize→uiS
      fontWeight: '500',
      color: theme.colors.onSurfaceVariant,
      marginLeft: theme.spacing.xs,
    },
    deleteArea: {
      // B56②：6→xs(4)/radius 6→s(8)
      padding: theme.spacing.xs,
      borderRadius: theme.radius.s,
      backgroundColor: theme.colors.errorContainer + '20',
      alignItems: 'center',
      justifyContent: 'center',
      minWidth: 32,
      minHeight: 32,
    },
    downloadArea: {
      // B56②：6→xs(4)/radius 6→s(8)
      padding: theme.spacing.xs, // More compact, icon-only
      borderRadius: theme.radius.s,
      backgroundColor: theme.colors.primaryContainer + '20',
      alignItems: 'center',
      justifyContent: 'center',
      minWidth: 32,
      minHeight: 32,
    },
    downloadText: {
      fontSize: theme.typography.uiS.fontSize, // B56③ fontSize→uiS
      fontWeight: '500',
      color: theme.colors.primary,
      marginLeft: theme.spacing.xs,
    },
    downloadProgress: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: theme.spacing.xs,
      paddingHorizontal: theme.spacing.s,
      backgroundColor: theme.colors.primaryContainer + '30',
      // B56②：radius 6→s(8)（小卡档）
      borderRadius: theme.radius.s,
    },
    progressText: {
      // B56②：6→xs(4)（紧凑行内 gap）
      marginLeft: theme.spacing.xs,
      fontSize: theme.typography.captionS.fontSize, // B56③ fontSize→captionS
      fontWeight: '500',
      color: theme.colors.primary,
    },
  });
