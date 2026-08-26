import {StyleSheet} from 'react-native';
import {Theme} from '../../utils/types';

export const createStyles = (theme: Theme) =>
  StyleSheet.create({
    scrollviewContainer: {
      paddingBottom: theme.spacing.m,
    },
    actionsContainer: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      width: '100%',
      alignItems: 'center',
      paddingHorizontal: theme.spacing.m,
      paddingVertical: theme.spacing.s,
    },
    rightButtons: {
      flexDirection: 'row',
      gap: theme.spacing.s,
    },
    button: {
      minWidth: 80,
    },
    resetButton: {
      minWidth: 80,
    },
    resetButtonContent: {
      flexDirection: 'row-reverse',
    },
    resetWrapper: {
      alignItems: 'flex-start',
    },
    settingsLevelIndicator: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: theme.spacing.m,
      paddingVertical: theme.spacing.s,
      backgroundColor: theme.colors.surface,
      borderRadius: theme.radius.s,
      marginBottom: theme.spacing.m,
    },
    settingsLevelText: {
      marginLeft: theme.spacing.s,
      color: theme.colors.onSurfaceVariant,
    },
    settingsLevelIcon: {
      color: theme.colors.primary,
    },
  });
