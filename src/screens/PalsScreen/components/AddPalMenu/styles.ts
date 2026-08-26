import {StyleSheet} from 'react-native';
import {Theme} from '../../../../utils/types';

export const createStyles = (theme: Theme) =>
  StyleSheet.create({
    addButton: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: theme.spacing.s,
      paddingHorizontal: theme.spacing.xs,
      borderRadius: theme.radius.m,
    },
    iconContainer: {
      marginBottom: theme.spacing.xs,
      padding: theme.spacing.xs,
    },
    actionLabel: {
      fontSize: theme.typography.captionS.fontSize, // B56③ fontSize→captionS
      fontWeight: '500',
      color: theme.colors.onSurfaceVariant,
      textAlign: 'center',
    },
  });
