import {StyleSheet} from 'react-native';
import {Theme} from '../../utils/types';

export const createStyles = (theme: Theme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    scrollView: {
      flex: 1,
    },
    card: {
      marginHorizontal: theme.spacing.m,
      marginVertical: theme.spacing.s,
      backgroundColor: theme.colors.surface,
    },
    title: {
      marginBottom: theme.spacing.m,
      color: theme.colors.onSurface,
    },
    description: {
      marginBottom: theme.spacing.m,
      color: theme.colors.onSurfaceVariant,
    },
    buttonContainer: {
      marginTop: theme.spacing.s,
      flexDirection: 'row',
      justifyContent: 'flex-end',
    },
    button: {
      marginLeft: theme.spacing.s,
    },
    divider: {
      marginVertical: theme.spacing.m,
    },
    warningText: {
      color: theme.colors.error,
      marginBottom: theme.spacing.m,
    },
  });
