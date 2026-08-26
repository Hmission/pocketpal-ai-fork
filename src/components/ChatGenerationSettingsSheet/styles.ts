import {StyleSheet} from 'react-native';

import {Theme} from '../../utils/types';

export const createStyles = (theme: Theme) =>
  StyleSheet.create({
    scrollviewContainer: {
      padding: 16,
    },
    secondaryButtons: {
      flexDirection: 'row',
      gap: 8,
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
      gap: 8,
      alignItems: 'center',
      maxWidth: '70%',
    },
    button: {
      flex: 1,
    },
    settingsSourceContainer: {
      marginBottom: 16,
      paddingHorizontal: 12,
      borderRadius: theme.radius.s,
    },
    settingsSourceTitle: {
      marginBottom: 8,
      fontWeight: '500',
    },
  });
