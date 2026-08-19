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
      // task-6ad §20.2 圆角区分：用户右上直角、回答系左上直角（同族同步）。
      // 四角显式拆分（删 borderRadius 统一速记——其会覆盖顶部两角，使直角失效）。
      // 底部两角保持原 roundBorder 逻辑（组内连续直角）。overflow:hidden 已有。
      borderTopLeftRadius: currentUserIsAuthor ? theme.borders.messageBorderRadius : 0,
      borderTopRightRadius: currentUserIsAuthor ? 0 : theme.borders.messageBorderRadius,
      borderBottomLeftRadius:
        currentUserIsAuthor || roundBorder
          ? theme.borders.messageBorderRadius
          : 0,
      borderBottomRightRadius: currentUserIsAuthor
        ? roundBorder
          ? theme.borders.messageBorderRadius
          : 0
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
