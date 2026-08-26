import {StyleSheet} from 'react-native';

import {Theme} from '../../utils/types';

// 生成进度监控卡（§18.9 v4.2 卡片化裁定）：外观对齐 assistant 卡片
// 设计语言——同底色（assistantBubbleBackground）同圆角
// （messageBorderRadius），与聊天流卡片同一视觉族；槽位不变
// （头部指示位，不插消息流）。
export const createStyles = (theme: Theme) =>
  StyleSheet.create({
    card: {
      alignSelf: 'flex-start',
      // B56②：6→xs(4)（紧凑卡距）
      marginTop: theme.spacing.xs,
      // Extra paddingBottom keeps the card from sitting flush against
      // the chat input — when the keyboard is closed, the FlatList's
      // header spacer collapses to height: 0 and the indicator is
      // otherwise the very last visible row above the input.
      marginBottom: theme.spacing.m,
      marginHorizontal: theme.spacing.sm,
      paddingHorizontal: theme.spacing.sm,
      // B56②：10→s(8)（垂直紧凑）
      paddingVertical: theme.spacing.s,
      maxWidth: '90%',
      backgroundColor: theme.colors.assistantBubbleBackground,
      // 尾角下移（v4.3）：生成进度卡属大模型系，左下直角（与思考卡/回答卡同族）
      borderTopLeftRadius: theme.borders.messageBorderRadius,
      borderTopRightRadius: theme.borders.messageBorderRadius,
      borderBottomLeftRadius: 0,
      borderBottomRightRadius: theme.borders.messageBorderRadius,
      overflow: 'hidden',
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.xs,
    },
    // 心跳微波形（B39）：5 根错峰小条，卡住时整体隐去（诚实）
    wave: {
      flexDirection: 'row',
      alignItems: 'center',
      // B56②：1.5→xxs(2)（心跳条细距）
      gap: theme.spacing.xxs,
      marginRight: theme.spacing.xs,
      height: 12,
    },
    dot: {
      width: 4,
      height: 4,
      borderRadius: theme.radius.xxs,
    },
    // 模型加载阶段行（B40）：「加载到哪一步」可见；样式仍用 perfRow
    //（B57：遥测展示已归一 PerfMiniRow，perfLabel/perfValue/perfSep/perfChartWrap 随迁删除）
    perfRow: {
      ...theme.typography.captionS,
      // B56②：6→xs(4)（紧凑）
      marginTop: theme.spacing.xs,
      color: theme.colors.textSecondary,
    },
  });

export const createCountStyle = (theme: Theme) =>
  StyleSheet.create({
    count: {
      marginLeft: theme.spacing.xs,
      fontSize: theme.typography.captionS.fontSize, // B56③ fontSize→captionS
      color: theme.colors.onSurfaceVariant,
      opacity: 0.75,
    },
  });
