import {StyleSheet} from 'react-native';

import {getUserAvatarNameColor} from '../../utils';
import {MessageType, Theme, User} from '../../utils/types';

export const styles = ({
  message,
  theme,
  user,
}: {
  message: MessageType.Text | MessageType.AssistantTurn;
  theme: Theme;
  user?: User;
}) =>
  StyleSheet.create({
    descriptionText: {
      ...(user?.id === message.author.id
        ? theme.fonts.sentMessageLinkDescriptionTextStyle
        : theme.fonts.receivedMessageLinkDescriptionTextStyle),
      marginTop: 4,
    },
    headerText: {
      ...theme.fonts.userNameTextStyle,
      color: getUserAvatarNameColor(
        message.author,
        theme.colors.userAvatarNameColors,
      ),
      marginBottom: 6,
    },
    titleText: {
      ...(user?.id === message.author.id
        ? theme.fonts.sentMessageLinkTitleTextStyle
        : theme.fonts.receivedMessageLinkTitleTextStyle),
    },
    text: {
      // legacy fonts 双轨收口（DESIGN_SPEC §8 B1）：消息正文改用 theme.typography.bodyM
      ...theme.typography.bodyM,
    },
    textContainer: {
      // 左右缩进：助手消息与用户消息同规格（≈2 字符当量），文本不贴气泡边缘
      marginHorizontal: theme.insets.messageInsetsHorizontal,
      marginVertical: theme.insets.messageInsetsVertical,
    },
    imageContainer: {
      marginBottom: 8,
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    // 气泡内动作槽（ADR-0003 同构）：hairline 分隔，动作胶囊贴卡片底部
    actionsSlot: {
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: theme.colors.outline,
      opacity: 0.9,
      marginHorizontal: theme.insets.messageInsetsHorizontal,
      paddingTop: 8,
      paddingBottom: 4,
    },
    imageThumbnail: {
      width: 80,
      height: 80,
      borderRadius: theme.radius.s,
      overflow: 'hidden',
      backgroundColor: theme.colors.surfaceVariant,
    },
    // 单图撑满卡片宽度（生图任务卡等）：方图框 + contain，与生图页预览同视觉；
    // 多图仍走上方 80×80 缩略图网格。
    imageThumbnailWide: {
      width: '100%',
      aspectRatio: 1,
    },
    imageContent: {
      width: '100%',
      height: '100%',
    },
    imagePreviewModal: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.9)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    imagePreviewCloseButton: {
      position: 'absolute',
      top: 50,
      right: 20,
      zIndex: 1,
    },
    imagePreviewContent: {
      width: '100%',
      height: '80%',
    },
    imagePreviewSaveButton: {
      position: 'absolute',
      bottom: 56,
      alignSelf: 'center',
      paddingHorizontal: 28,
      paddingVertical: 10,
      borderRadius: theme.radius[theme.shapeRoles.pill],
      backgroundColor: theme.colors.primary,
      zIndex: 1,
    },
    imagePreviewSaveText: {
      color: theme.colors.onPrimary,
      fontSize: 15,
      fontWeight: '600',
    },
  });
