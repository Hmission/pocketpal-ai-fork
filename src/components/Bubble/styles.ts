import {StyleSheet} from 'react-native';

import {MessageType, Theme} from '../../utils/types';

export const styles = ({
  currentUserIsAuthor,
  message,
  roundBorder,
  theme,
}: {
  currentUserIsAuthor: boolean;
  message: MessageType.Any;
  roundBorder: boolean;
  theme: Theme;
}) => {
  return StyleSheet.create({
    contentContainer: {
      // assistant 输出卡片化：语义点缀色背景（低饱和暖蓝，深浅双模式）
      backgroundColor: currentUserIsAuthor
        ? theme.colors.authorBubbleBackground
        : theme.colors.assistantBubbleBackground,
      // 尾角下移（v4.3 同族同步）：用户右下直角、回答系左下直角。
      // 四角显式拆分（删 borderRadius 统一速记——其会覆盖各角显式值，使直角失效）。
      // 顶部同侧角保持原 roundBorder 逻辑（组内最后一条形成同侧全直边）。overflow:hidden 已有。
      borderTopLeftRadius: currentUserIsAuthor
        ? theme.borders.messageBorderRadius
        : roundBorder
          ? theme.borders.messageBorderRadius
          : 0,
      borderTopRightRadius: currentUserIsAuthor
        ? roundBorder
          ? theme.borders.messageBorderRadius
          : 0
        : theme.borders.messageBorderRadius,
      borderBottomLeftRadius: currentUserIsAuthor
        ? theme.borders.messageBorderRadius
        : 0,
      borderBottomRightRadius: currentUserIsAuthor
        ? 0
        : theme.borders.messageBorderRadius,
      borderColor: 'transparent',
      overflow: 'hidden',
    },
    dateHeader0: {
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 32,
      marginTop: 16,
    },
    dateHeaderContainer: {
      textAlign: 'right',
      paddingBottom: 12,
      marginTop: -8,
      marginLeft: 20,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    dateHeader: {
      //textAlign: 'right',
      color: theme.colors.textSecondary,
      fontSize: 10,
    },
    iconContainer: {
      color: theme.colors.textSecondary,
      fontSize: 16,
    },
  });
};
