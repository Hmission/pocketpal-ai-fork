import {StyleSheet} from 'react-native';

import {Theme} from '../../utils/types';

export const createStyles = (theme: Theme) =>
  StyleSheet.create({
    scrollviewContainer: {
      padding: theme.spacing.m,
    },
    secondaryButtons: {
      flexDirection: 'row',
      gap: theme.spacing.s,
    },
    actionsContainer: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      width: '100%',
    },
    resetWrapper: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    resetButton: {
      marginRight: 0,
    },
    resetButtonContent: {
      flexDirection: 'row-reverse',
    },
    rightButtons: {
      flexDirection: 'row',
      gap: theme.spacing.s,
      alignItems: 'center',
      maxWidth: '70%',
    },
    button: {
      flex: 1,
    },
    settingsSourceContainer: {
      marginBottom: theme.spacing.m,
      paddingHorizontal: theme.spacing.sm,
      borderRadius: theme.radius.s,
    },
    settingsSourceTitle: {
      marginBottom: theme.spacing.s,
      fontWeight: '500',
    },
  });
