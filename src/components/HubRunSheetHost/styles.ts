import {StyleSheet} from 'react-native';

import {Theme} from '../../utils/types';

export const createStyles = (theme: Theme) =>
  StyleSheet.create({
    list: {
      flex: 1,
    },
    centered: {
      alignItems: 'center',
      paddingVertical: theme.spacing.l,
      paddingHorizontal: theme.spacing.l,
      gap: theme.spacing.m,
    },
    resolvingText: {
      fontSize: theme.typography.bodyS.fontSize, // B56③ fontSize→bodyS
      color: theme.colors.onSurface,
      textAlign: 'center',
    },
    repoId: {
      fontSize: theme.typography.bodyS.fontSize, // B56③ fontSize→bodyS
      color: theme.colors.onSurfaceVariant,
    },
    errorText: {
      fontSize: theme.typography.bodyS.fontSize, // B56③ fontSize→bodyS
      color: theme.colors.error,
      textAlign: 'center',
    },
    errorActions: {
      flexDirection: 'row',
      gap: theme.spacing.s,
    },
  });
