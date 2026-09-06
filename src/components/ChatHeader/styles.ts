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
      // 真机像素复量（截图 1200px / 密度 2.75）：未补偿时 电话↔加号 墨迹间距 66px=24.0dp，
      // 而 胶囊↔电话 34px=12.4dp、加号↔三点 40px=14.5dp——大王报的「间距过大」成立。
      // 根因：电话按钮插在已按 §20.3 校准好的 HeaderRight 之前，两侧 36dp 触区的
      // 居中留白与 rightSection gap 叠加。补偿沿用 §20.3 同族手法（compactBtnLeft
      // 的 marginLeft:-6），不另造间距体系。
      // 两轮实测迭代：-6 时降到 54px（图标同时由 m→s 又加回 ~5.5px 居中留白），
      // 目标 40px 与加号↔三点 对齐 → 取 -11。预期重叠部分落在电话图标自身
      // 右留白(10dp) 内不遮墨迹，但**该预期尚待装机后复量 + 点击复验确认**。
      marginRight: -11,
    },
    phoneButtonDisabled: {
      opacity: 0.4,
    },
  });
