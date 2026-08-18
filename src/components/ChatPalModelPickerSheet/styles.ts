import {StyleSheet} from 'react-native';
import {Theme} from '../../utils/types';

export const createStyles = ({theme}: {theme: Theme}) =>
  StyleSheet.create({
    sheetContainer: {
      backgroundColor: theme.colors.surface,
      flex: 1,
    },
    handle: {
      backgroundColor: theme.colors.outline,
      width: 40,
      height: 4,
      borderRadius: 2,
    },
    title: {
      fontSize: 20,
      fontWeight: '600',
      color: theme.colors.onSurface,
      textAlign: 'center',
      marginVertical: 16,
    },
    tabs: {
      flexDirection: 'row',
      paddingHorizontal: 16,
      alignItems: 'center',
      height: 50,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.outline,
    },
    tab: {
      paddingVertical: 8,
      paddingHorizontal: 16,
      marginRight: 8,
      borderRadius: theme.radius.s,
    },
    activeTab: {
      backgroundColor: theme.colors.primaryContainer,
    },
    tabText: {
      color: theme.colors.onSurface,
    },
    activeTabText: {
      color: theme.colors.onPrimaryContainer,
    },
    listItem: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 16,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.outline,
    },
    activeListItem: {
      backgroundColor: theme.colors.tertiaryContainer,
      borderColor: theme.colors.primary,
    },
    itemContent: {
      flex: 1,
      marginLeft: 12,
      justifyContent: 'space-between',
    },
    itemTextContent: {
      flex: 1,
    },
    settingsButton: {
      padding: 8,
      marginLeft: 8,
    },
    itemTitle: {
      fontSize: 16,
      color: theme.colors.onSurface,
      marginBottom: 4,
    },
    activeItemTitle: {
      color: theme.colors.onTertiaryContainer,
    },
    itemSubtitle: {
      fontSize: 14,
      color: theme.colors.onSurfaceVariant,
    },
    activeItemSubtitle: {
      color: theme.colors.onTertiaryContainer,
    },
    scrollviewContainer: {
      paddingBottom: theme.spacing.default,
    },
    tabList: {
      flexGrow: 0,
    },
    // B18 §16.2 卡片化（生图页 ModelPickerPanel 同范式）
    card: {
      marginHorizontal: theme.spacing.default,
      marginTop: theme.spacing.default,
      padding: theme.spacing.default,
      borderRadius: theme.radius[theme.shapeRoles.card],
      backgroundColor: theme.colors.surfaceContainerLow,
      borderWidth: 1,
      borderColor: theme.colors.border,
      gap: theme.spacing.xs,
    },
    cardActive: {
      borderColor: theme.colors.primary,
      backgroundColor: theme.colors.primaryContainer,
    },
    cardTitleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.xs,
    },
    badgeLoaded: {
      ...theme.typography.captionS,
      fontWeight: '600',
      color: theme.colors.primary,
      borderWidth: 1,
      borderColor: theme.colors.primary,
      borderRadius: theme.radius[theme.shapeRoles.pill],
      paddingHorizontal: theme.spacing.xs,
      overflow: 'hidden',
    },
    badgeResident: {
      ...theme.typography.captionS,
      fontWeight: '600',
      color: theme.colors.brandAccent,
      borderWidth: 1,
      borderColor: theme.colors.brandAccent,
      borderRadius: theme.radius[theme.shapeRoles.pill],
      paddingHorizontal: theme.spacing.xs,
      overflow: 'hidden',
    },
    cardNote: {
      ...theme.typography.captionS,
      color: theme.colors.onSurfaceVariant,
    },
    cardActionRow: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
    },
    actionText: {
      ...theme.typography.uiS,
      fontWeight: '600',
      color: theme.colors.primary,
      paddingHorizontal: theme.spacing.sm,
      paddingVertical: theme.spacing.xxs,
      borderWidth: 1,
      borderColor: theme.colors.primary,
      borderRadius: theme.radius[theme.shapeRoles.pill],
      overflow: 'hidden',
    },
    actionTextUnload: {
      color: theme.colors.onSurfaceVariant,
      borderColor: theme.colors.outlineVariant,
    },
    actionDisabled: {
      ...theme.typography.uiS,
      color: theme.colors.onSurfaceVariant,
      paddingHorizontal: theme.spacing.sm,
      paddingVertical: theme.spacing.xxs,
    },
    sheetFootnote: {
      ...theme.typography.captionS,
      color: theme.colors.onSurfaceVariant,
      marginHorizontal: theme.spacing.default,
      marginTop: theme.spacing.default,
      marginBottom: theme.spacing.default,
    },
  });
