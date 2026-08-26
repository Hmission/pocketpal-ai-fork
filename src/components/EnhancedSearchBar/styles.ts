import {StyleSheet} from 'react-native';
import {Theme} from '../../utils/types';

export const createStyles = (theme: Theme) =>
  StyleSheet.create({
    container: {
      paddingHorizontal: theme.spacing.m,
      paddingVertical: theme.spacing.sm,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.colors.outline,
      minHeight: 60,
    },
    searchBarContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.sm,
      marginBottom: theme.spacing.s,
    },
    searchInputContainer: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.colors.surface,
      borderRadius: theme.radius.l,
      paddingHorizontal: theme.spacing.m,
      // B56②：6→xs(4)（紧凑搜索条）
      paddingVertical: theme.spacing.xs,
      height: 40,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.dark
        ? theme.colors.outline + '50'
        : theme.colors.outline + '30',
    },
    searchIcon: {
      marginRight: theme.spacing.s,
    },
    searchInput: {
      flex: 1,
      fontSize: theme.typography.bodyM.fontSize, // B56③ fontSize→bodyM
      backgroundColor: 'transparent',
      paddingHorizontal: 0,
      paddingVertical: 0,
      height: theme.size.controlHeight,
      color: theme.colors.onSurface,
    },
    clearButton: {
      position: 'absolute',
      right: theme.spacing.s,
      top: '50%',
      transform: [{translateY: -12}],
      padding: theme.spacing.xs,
      zIndex: 100,
    },
    filterToggleButton: {
      width: 40,
      height: 40,
      borderRadius: theme.radius.l,
      backgroundColor: theme.colors.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.colors.outline,
      alignItems: 'center',
      justifyContent: 'center',
      position: 'relative',
    },
    filterToggleButtonActive: {
      backgroundColor: theme.colors.primaryContainer,
      borderColor: theme.colors.primary,
    },
    activeFilterIndicator: {
      position: 'absolute',
      top: 6,
      right: 6,
      width: 8,
      height: 8,
      borderRadius: theme.radius.xs,
      backgroundColor: theme.colors.primary,
    },
    filterDropdownContainer: {
      marginBottom: theme.spacing.s,
    },
    filterDropdownContent: {
      paddingRight: theme.spacing.m,
      gap: theme.spacing.s,
    },
    filterDropdownButton: {
      flexDirection: 'row',
      alignItems: 'center',
      // backgroundColor: theme.colors.surface,
      borderRadius: theme.radius.l,
      paddingHorizontal: theme.spacing.sm,
      // B56②：6→xs(4)（紧凑过滤器钮）
      paddingVertical: theme.spacing.xs,
      marginRight: theme.spacing.s,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.colors.primary,
      gap: theme.spacing.xs,
    },
    filterDropdownButtonActive: {
      backgroundColor: theme.colors.btnPrimaryBg,
      borderWidth: 0,
    },
    filterDropdownText: {
      color: theme.colors.onSurfaceVariant,
    },
    filterDropdownTextActive: {
      color: theme.colors.secondary,
      fontWeight: '600',
    },
    expandedFiltersContainer: {
      backgroundColor: theme.colors.surface,
      borderRadius: theme.radius.m,
      padding: theme.spacing.m,
      marginTop: theme.spacing.s,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.colors.outline,
    },
    authorInputContainer: {
      //position: 'relative',
      // marginTop: 16,
      // marginBottom: 40,
      // marginHorizontal: 16,
    },
    authorInput: {
      backgroundColor: theme.colors.surface,
      fontSize: theme.typography.bodyS.fontSize, // B56③ fontSize→bodyS
      borderRadius: theme.radius.s,
      borderWidth: 1,
      borderColor: theme.colors.outline,
      paddingHorizontal: theme.spacing.sm,
      // R1：清除钮让位（44 触区基线）
      paddingRight: theme.size.minTapTarget,
      minHeight: 40,
      color: theme.colors.onSurface,
    },
    sheetScrollContent: {
      paddingHorizontal: theme.spacing.m,
      // R2 保守归一：66 静态底缘 → xxl+l（40+24=64 等值，spacing 表达式）
      paddingBottom: theme.spacing.xxl + theme.spacing.l,
    },
    selectorContainer: {
      flex: 1,
    },
    selectorButton: {
      backgroundColor: theme.colors.surface,
      borderRadius: theme.radius.s,
      borderColor: theme.colors.outline,
    },

    filterSheetContent: {
      // R1：与上方控件/触区对齐（44 触区基线）
      paddingTop: theme.size.minTapTarget,
      // R2 保守归一：100 静态底缘 → xxl+xl（72，Sheet 底缘无遮挡物；完整分区列入下批）
      paddingBottom: theme.spacing.xxl + theme.spacing.xl,
      paddingHorizontal: theme.spacing.m,
      // B56②：1→xxs(2)（选项组细距）
      gap: theme.spacing.xxs,
    },
    filterOption: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: theme.spacing.m,
      paddingHorizontal: theme.spacing.m,
      borderRadius: theme.radius.m,
      backgroundColor: 'transparent',
      minHeight: 56,
    },
    filterOptionSelected: {
      backgroundColor: theme.colors.primaryContainer,
    },
    filterOptionLast: {
      borderBottomWidth: 0,
    },
    filterOptionText: {
      fontSize: theme.typography.bodyM.fontSize, // B56③ fontSize→bodyM
      color: theme.colors.onSurface,
      fontWeight: '400',
    },
    filterOptionTextSelected: {
      color: theme.colors.primary,
      fontWeight: '600',
    },
  });
