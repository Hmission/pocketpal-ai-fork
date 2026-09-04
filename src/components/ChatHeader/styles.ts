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
    // CHAT_UI_SPEC §21 v5.1 + PHONE_SPEC §11.1：电话入口触区——与
    // HeaderRight.styles.compactBtn 同族（controlHeight 36 透明触区，无底衬无描边）。
    // v2.0 的 triggerPill 胶囊化已撤销：底衬+描边与左右图标按钮不同族，
    // 真机报「圆圈过大、跟左右图标高度不一致」；图标本身不可见的真因是
    // 误传 `color=`（见 DESIGN_SPEC §3 svgr 传参红线），不是缺底衬。
    phoneButton: {
      width: theme.size.controlHeight,
      height: theme.size.controlHeight,
      alignItems: 'center',
      justifyContent: 'center',
    },
    phoneButtonDisabled: {
      opacity: 0.4,
    },
  });
