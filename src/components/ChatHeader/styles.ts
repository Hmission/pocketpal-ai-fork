import {StyleSheet} from 'react-native';
import {Theme} from '../../utils/types';
import {EdgeInsets} from 'react-native-safe-area-context';
import {withOpacity} from '../../utils/colorUtils';

export const createStyles = ({
  theme,
  insets,
  headerHeight,
}: {
  theme: Theme;
  insets: EdgeInsets;
  headerHeight: number;
}) =>
  StyleSheet.create({
    wrapper: {
      backgroundColor: theme.colors.background,
    },
    container: {
      height: headerHeight,
      paddingTop: insets.top,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      // B56②：10→sm(12)（水平性）
      gap: theme.spacing.sm,
    },
    leftSection: {
      flexDirection: 'row',
      alignItems: 'center',
      // B56②：10→sm(12)（水平性）
      gap: theme.spacing.sm,
      flexShrink: 1,
    },
    menuIcon: {
      height: 40,
      width: 40,
      justifyContent: 'center',
      alignItems: 'center',
    },
    headerWithoutDivider: {
      elevation: 0,
      shadowOpacity: 0,
      borderBottomWidth: 0,
      backgroundColor: theme.colors.background,
    },
    headerWithDivider: {
      backgroundColor: theme.colors.background,
    },
    rightSection: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.xxs,
    },
    modelPickerChip: {
      paddingHorizontal: theme.spacing.s,
      paddingVertical: theme.spacing.xs,
      borderRadius: theme.radius[theme.shapeRoles.pill],
      // 灰色治理（DESIGN_SPEC §1.8）：模型 chip 从 surfaceVariant 改为域彩 12% 底
      backgroundColor: withOpacity(theme.colors.primary, 0.12),
      // 标准橙黄描边：与抽屉搜索框聚焦态同一设计语言
      borderWidth: 1,
      borderColor: theme.colors.primary,
    },
  });
