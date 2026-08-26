import {StyleSheet} from 'react-native';

import {MessageType, Theme, User} from '../../utils/types';

export const styles = ({
  message,
  theme,
  user,
}: {
  message: MessageType.DerivedFile;
  theme: Theme;
  user?: User;
}) =>
  StyleSheet.create({
    container: {
      alignItems: 'center',
      flexDirection: 'row',
      padding: theme.insets.messageInsetsVertical,
      paddingRight: theme.insets.messageInsetsHorizontal,
    },
    icon: {
      tintColor:
        user?.id === message.author.id
          ? theme.colors.sentMessageDocumentIcon
          : theme.colors.receivedMessageDocumentIcon,
    },
    iconContainer: {
      alignItems: 'center',
      backgroundColor:
        user?.id === message.author.id
          ? `${String(theme.colors.sentMessageDocumentIcon)}33`
          : `${String(theme.colors.receivedMessageDocumentIcon)}33`,
      borderRadius: theme.radius[theme.shapeRoles.circle],
      height: 42,
      justifyContent: 'center',
      width: 42,
    },
    name: {
      // legacy fonts 双轨收口（DESIGN_SPEC §8 B1）
      ...theme.typography.bodyM,
    },
    size: {
      ...theme.typography.captionM,
      marginTop: theme.spacing.xs,
    },
    textContainer: {
      flexShrink: 1,
      marginLeft: theme.spacing.m,
    },
  });
