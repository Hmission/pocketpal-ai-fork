import {StyleSheet} from 'react-native';

import {MessageType, Theme} from '../../utils/types';

// Inter-block gap within a single AssistantTurn row.
export const turnBlockStyles = StyleSheet.create({
  blockSpacer: {marginTop: 4},
});

const styles = ({
  currentUserIsAuthor,
  message,
  messageWidth,
  roundBorder,
  theme,
}: {
  currentUserIsAuthor: boolean;
  message: MessageType.DerivedAny;
  messageWidth: number;
  roundBorder: boolean;
  theme: Theme;
}) =>
  StyleSheet.create({
    container: {
      alignItems: 'flex-end',
      alignSelf: currentUserIsAuthor ? 'flex-end' : 'flex-start',
      justifyContent: !currentUserIsAuthor ? 'flex-end' : 'flex-start',
      flex: 1,
      flexDirection: 'row',
      marginBottom: message.type === 'dateHeader' ? 0 : 4 + message.offset,
      marginLeft: 20,
    },
    contentContainer: {
      backgroundColor:
        !currentUserIsAuthor || message.type === 'image'
          ? theme.colors.secondary
          : theme.colors.primary,
      // 尾角下移（v4.3，与 Bubble 同构）：用户右下直角、回答系左下直角。
      // 四角显式拆分（删 borderRadius 统一速记——其会覆盖各角显式值，使直角失效）。
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
    dateHeader: {
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 32,
      marginTop: 16,
    },
    pressable: {
      maxWidth: messageWidth,
    },
  });

export default styles;
