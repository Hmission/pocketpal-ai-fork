import {StyleSheet} from 'react-native';

import {Theme} from '../../utils/types';

export const createStyles = (theme: Theme) =>
  StyleSheet.create({
    sidebarContainer: {
      flex: 1,
      backgroundColor: theme.colors.surface,
    },
    contentWrapper: {
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
    },
    // 顶部固定区：搜索 + 新对话
    topSection: {
      paddingHorizontal: theme.spacing.sm,
      paddingTop: theme.spacing.s,
    },
    searchContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.s,
      // B56②：10→sm(12)（水平性）
      paddingHorizontal: theme.spacing.sm,
      // 灰色治理（DESIGN_SPEC §1.8）：搜索框不再用 surfaceVariant，改 surface + 描边；
      // 描边提为 1px 实线（hairline 太弱看不清），聚焦态橙黄由组件内联覆盖
      borderRadius: theme.radius[theme.shapeRoles.inputSmall],
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.outline,
    },
    searchInput: {
      flex: 1,
      paddingVertical: theme.spacing.s,
      fontSize: theme.typography.bodyS.fontSize, // B56③ fontSize→bodyS
      color: theme.colors.onSurface,
    },
    newChatRow: {
      flexDirection: 'row',
      alignItems: 'center',
      // B56②：10→sm(12)（水平性）
      gap: theme.spacing.sm,
      paddingVertical: theme.spacing.xxs,
      paddingHorizontal: theme.spacing.xxs,
    },
    newChatButton: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      // B56②：10→sm(12)（水平性）/ 10→s(8)（垂直紧凑）
      gap: theme.spacing.sm,
      paddingVertical: theme.spacing.s,
    },
    // 生图快捷入口：无底框文字按钮（与「+ 新对话」对称）。注：触区由行高 + padding(s) 构成，
    // 未配 hitSlop，实际不保证 44 基线（旧注释失实已修正）——如需达标建议补 hitSlop 或 minTapTarget（登记 Gap）
    newChatImageGenButton: {
      flexDirection: 'row',
      alignItems: 'center',
      // B56②：6→xs(4)（紧凑 gap）/ 10→s(8)（垂直紧凑）
      gap: theme.spacing.xs,
      paddingVertical: theme.spacing.s,
      paddingHorizontal: theme.spacing.s,
    },
    imageGenEntryText: {
      fontSize: theme.typography.uiM.fontSize, // B56③ fontSize→uiM
      fontWeight: '500',
      color: theme.colors.primary,
    },
    newChatText: {
      fontSize: theme.typography.uiM.fontSize, // B56③ fontSize→uiM
      fontWeight: '500',
      color: theme.colors.primary,
    },
    topDivider: {
      marginHorizontal: 0,
      backgroundColor: theme.colors.onSurfaceVariant,
      height: 1,
      opacity: 0.1,
    },
    sessionList: {
      flex: 1,
    },
    // 底部固定 footer：齿轮 + 设置
    drawerFooter: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.sm,
      paddingVertical: theme.spacing.sm,
      paddingHorizontal: theme.spacing.m,
      borderTopWidth: 1,
      borderTopColor: theme.colors.outline,
      opacity: 1,
    },
    footerText: {
      fontSize: theme.typography.uiM.fontSize, // B56③ fontSize→uiM
      fontWeight: '500',
      color: theme.colors.onSurface,
    },
    emptySearch: {
      paddingVertical: theme.spacing.l,
      alignItems: 'center',
    },
    emptySearchText: {
      fontSize: theme.typography.bodyS.fontSize,
      color: theme.colors.onSurfaceVariant,
    },
    sessionDrawerItem: {
      height: 40,
    },
    versionText: {
      color: theme.colors.onSurfaceVariant,
      opacity: 0.7,
      fontSize: theme.typography.uiS.fontSize, // B56③ fontSize→uiS
      fontWeight: '500',
    },
    drawerSection: {
      // B56②：10→sm(12)（外层距）
      marginTop: theme.spacing.sm,
    },
    dateLabel: {
      paddingLeft: theme.spacing.m,
      // B56②：10→s(8)（垂直紧凑）
      paddingVertical: theme.spacing.s,
    },
    scrollViewContent: {
      flexGrow: 1,
      minHeight: '100%',
    },
    mainContent: {
      flex: 1,
    },
    menu: {
      width: 170,
    },
    sessionItem: {
      position: 'relative',
    },
    sessionTouchable: {
      flex: 1,
    },
    // 行尾 ... 按钮：常驻入口，最小触区 40x40
    sessionMoreButton: {
      width: 40,
      height: 40,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: theme.spacing.xs,
    },
    // Selection mode styles
    selectionModeHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: theme.spacing.m,
      paddingVertical: theme.spacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.outline,
      backgroundColor: theme.colors.surface,
    },
    selectedCountText: {
      fontSize: theme.typography.titleS.fontSize, // B56③ fontSize→titleS
      fontWeight: '600',
      color: theme.colors.onSurface,
      flex: 1,
      textAlign: 'center',
    },
    sessionItemContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      position: 'relative',
    },
    sessionCheckbox: {
      marginLeft: theme.spacing.s,
      marginRight: theme.spacing.xs,
    },
    menuDivider: {
      marginVertical: theme.spacing.xs,
    },
    // Header action buttons (export, delete icons)
    headerActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.m,
    },
    headerActionButton: {
      padding: theme.spacing.xs,
    },
    headerActionButtonDisabled: {
      opacity: 0.4,
    },
    // Select all row
    selectAllRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: theme.spacing.sm,
      paddingHorizontal: theme.spacing.m,
      backgroundColor: theme.colors.surface,
    },
    selectAllCheckbox: {
      marginRight: theme.spacing.sm,
    },
    selectAllText: {
      fontSize: theme.typography.bodyM.fontSize, // B56③ fontSize→bodyM
      color: theme.colors.onSurface,
    },
    selectAllDivider: {
      backgroundColor: theme.colors.outline,
      opacity: 0.3,
    },
  });
