import {StyleSheet} from 'react-native';

import {Theme} from '../../../utils/types';

export const createStyles = (theme: Theme) =>
  StyleSheet.create({
    content: {
      paddingHorizontal: theme.spacing.m,
      paddingBottom: theme.spacing.l,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: theme.spacing.m,
      paddingHorizontal: theme.spacing.m,
      borderRadius: theme.roundness,
      backgroundColor: theme.colors.surfaceVariant,
      marginBottom: theme.spacing.s,
    },
    rowText: {
      flex: 1,
    },
    rowLabel: {
      ...theme.typography.titleM,
      color: theme.colors.onSurface,
    },
    rowDescription: {
      ...theme.typography.bodyS,
      color: theme.colors.onSurfaceVariant,
      marginTop: 2,
    },
  });
