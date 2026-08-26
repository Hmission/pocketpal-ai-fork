import {StyleSheet} from 'react-native';

import {Theme} from '../../../utils/types';

export const createStyles = (theme: Theme) =>
  StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: theme.spacing.s,
      paddingHorizontal: theme.spacing.m,
      borderRadius: theme.roundness,
      backgroundColor: theme.colors.surfaceVariant,
      marginBottom: theme.spacing.s,
    },
    rowText: {
      flex: 1,
      marginRight: theme.spacing.m,
    },
    rowTitle: {
      ...theme.typography.titleM,
      color: theme.colors.onSurface,
    },
    rowRole: {
      ...theme.typography.bodyS,
      color: theme.colors.onSurfaceVariant,
      marginTop: theme.spacing.xxs,
    },
    rowActions: {
      flexShrink: 0,
    },
    noSource: {
      ...theme.typography.uiS,
      color: theme.colors.onSurfaceVariant,
    },
  });
