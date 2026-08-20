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
      marginTop: 6,
      // Extra paddingBottom keeps the card from sitting flush against
      // the chat input — when the keyboard is closed, the FlatList's
      // header spacer collapses to height: 0 and the indicator is
      // otherwise the very last visible row above the input.
      marginBottom: 16,
      marginHorizontal: 12,
      paddingHorizontal: 12,
      paddingVertical: 10,
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
      gap: 4,
    },
    dot: {
      width: 4,
      height: 4,
      borderRadius: 2,
    },
    // 思考流预览（§18.9）：TTFT 期模型内心戏 2 行尾随，卡内次级文本
    reasoning: {
      marginTop: 6,
      fontSize: 11,
      lineHeight: 15,
      color: theme.colors.textSecondary,
      opacity: 0.85,
    },
  });

export const createCountStyle = (theme: Theme) =>
  StyleSheet.create({
    count: {
      marginLeft: 4,
      fontSize: 11,
      color: theme.colors.onSurfaceVariant,
      opacity: 0.75,
    },
  });
