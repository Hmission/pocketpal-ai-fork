import {StyleSheet} from 'react-native';
import {Theme} from '../../../../utils/types';
import {EdgeInsets} from 'react-native-safe-area-context';

export const createStyles = (theme: Theme, insets: EdgeInsets) =>
  StyleSheet.create({
    container: {
      backgroundColor: theme.colors.surface,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: theme.colors.outline,
    },
    actionBar: {
      flexDirection: 'row',
      paddingHorizontal: theme.spacing.s,
      paddingVertical: theme.spacing.s,
      paddingBottom: Math.max(insets.bottom, 12),
      justifyContent: 'space-around',
      alignItems: 'center',
      minHeight: 70,
    },
    actionButton: {
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
