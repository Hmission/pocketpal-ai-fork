import {StyleSheet} from 'react-native';

import type {Theme} from '../../utils/types';

export const createStyles = (theme: Theme) =>
  StyleSheet.create({
    container: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.s,
    },
    checkbox: {
      borderWidth: 2,
      borderRadius: theme.radius.xs,
      justifyContent: 'center',
      alignItems: 'center',
    },
    checkedBox: {
      borderColor: theme.colors.primary,
      backgroundColor: theme.colors.primary,
    },
    uncheckedBox: {
      borderColor: theme.colors.outline,
      backgroundColor: 'transparent',
    },
  });
