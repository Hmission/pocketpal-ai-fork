import {StyleSheet} from 'react-native';

import {MessageType, Theme, User} from '../../utils/types';

const styles = ({
  aspectRatio,
  message,
  messageWidth,
  theme,
  user,
}: {
  aspectRatio: number;
  message: MessageType.Image;
  messageWidth: number;
  theme: Theme;
  user?: User;
}) =>
  StyleSheet.create({
    horizontalImage: {
      height: messageWidth / aspectRatio,
      maxHeight: messageWidth,
      width: messageWidth,
    },
    minimizedImage: {
      // 与气泡圆角同值（15）保持一致（DESIGN_SPEC §8 B1：radius token 化）
      borderRadius: theme.borders.messageBorderRadius,
      height: 64,
      marginLeft: theme.insets.messageInsetsVertical,
      marginRight: theme.spacing.m,
      marginVertical: theme.insets.messageInsetsVertical,
      width: 64,
    },
    minimizedImageContainer: {
      alignItems: 'center',
      backgroundColor:
        user?.id === message.author.id
          ? theme.colors.primary
          : theme.colors.secondary,
      flexDirection: 'row',
    },
    nameText: {
      // legacy fonts 双轨收口（DESIGN_SPEC §8 B1）
      ...theme.typography.bodyM,
    },
    sizeText: {
      ...theme.typography.captionM,
      marginTop: theme.spacing.xs,
    },
    textContainer: {
      flexShrink: 1,
      marginRight: theme.insets.messageInsetsHorizontal,
      marginVertical: theme.insets.messageInsetsVertical,
    },
    verticalImage: {
      height: messageWidth,
      minWidth: 170,
      width: messageWidth * aspectRatio,
    },
  });

export default styles;
