import {StyleSheet} from 'react-native';
import type {EdgeInsets} from 'react-native-safe-area-context';

import {Theme} from '../../utils/types';

export const createStyles = (theme: Theme, insets: EdgeInsets) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.surface,
    },
    listContainer: {
      padding: theme.spacing.m,
      // R2：100 静态值 → insets.bottom + xl（BottomActionBar 文档流同屏栏，其自身已补偿 insets；
      // 完整布局分区（列表 z 区 + actionBar 区）列入下批）
      paddingBottom: insets.bottom + theme.spacing.xl,
    },
    row: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingHorizontal: 0,
    },
    emptyState: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      // R5 裁定：空态语义留白豁免（64 属居中空态设计意图，不改值登记）
      paddingVertical: 64,
      paddingHorizontal: theme.spacing.xl,
    },
    emptyStateText: {
      fontSize: theme.typography.bodyM.fontSize, // B56③ fontSize→bodyM
      color: theme.colors.onSurfaceVariant,
      textAlign: 'center',
      marginTop: theme.spacing.m,
      lineHeight: 24,
    },
  });
