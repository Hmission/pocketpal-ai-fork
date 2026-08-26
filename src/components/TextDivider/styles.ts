import {StyleSheet} from 'react-native';

import {Theme} from '../../utils';

export const createStyles = (theme: Theme) =>
  StyleSheet.create({
    container: {
      flexDirection: 'row',
      alignItems: 'center',
      marginVertical: theme.spacing.sm,
    },
    line: {
      flex: 1,
      height: 1,
      backgroundColor: theme.colors.outline,
      opacity: 0.5,
    },
    text: {
      marginHorizontal: theme.spacing.sm,
      color: theme.colors.onSurfaceVariant,
      fontSize: theme.typography.uiM.fontSize, // B56③ fontSize→uiM
      fontWeight: '500',
    },
  });
