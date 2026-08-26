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
      borderRadius: theme.radius.xxs,
    },
    title: {
      fontSize: theme.typography.headlineH3.fontSize, // B56③ 20→headlineH3（补档归档，等值）
      fontWeight: '600',
      color: theme.colors.onSurface,
      textAlign: 'center',
      marginVertical: theme.spacing.m,
    },
    tabs: {
      flexDirection: 'row',
      paddingHorizontal: theme.spacing.m,
      alignItems: 'center',
      height: 50,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.outline,
    },
    tab: {
      paddingVertical: theme.spacing.s,
      paddingHorizontal: theme.spacing.m,
      marginRight: theme.spacing.s,
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
      padding: theme.spacing.m,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.outline,
    },
    activeListItem: {
      backgroundColor: theme.colors.tertiaryContainer,
      borderColor: theme.colors.primary,
    },
    itemContent: {
      flex: 1,
      marginLeft: theme.spacing.sm,
      justifyContent: 'space-between',
    },
    itemTextContent: {
      flex: 1,
    },
    settingsButton: {
      padding: theme.spacing.s,
      marginLeft: theme.spacing.s,
    },
    itemTitle: {
      fontSize: theme.typography.titleS.fontSize, // B56③ fontSize→titleS
      color: theme.colors.onSurface,
      marginBottom: theme.spacing.xs,
    },
    activeItemTitle: {
      color: theme.colors.onTertiaryContainer,
    },
    itemSubtitle: {
      fontSize: theme.typography.uiM.fontSize, // B56③ fontSize→uiM
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
    // B57：动作胶囊（加载/卸载）归 ui/Chip outline；以下样式键随迁删除
    actionDisabled: {
      ...theme.typography.uiS,
      color: theme.colors.onSurfaceVariant,
      paddingHorizontal: theme.spacing.sm,
      paddingVertical: theme.spacing.xxs,
    },
    // 加载中动效（B57：三点波浪 → ui/WaveDots；2% 底条 → ui/Progress）
    loadingWrap: {
      width: '100%',
    },
    loadingRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.xs,
    },
    sheetFootnote: {
      ...theme.typography.captionS,
      color: theme.colors.onSurfaceVariant,
      marginHorizontal: theme.spacing.default,
      marginTop: theme.spacing.default,
      marginBottom: theme.spacing.default,
    },
  });
