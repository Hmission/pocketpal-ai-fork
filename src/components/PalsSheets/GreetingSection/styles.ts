import {StyleSheet} from 'react-native';
import {Theme} from '../../../utils/types';

export const createStyles = (theme: Theme) =>
  StyleSheet.create({
    container: {
      gap: theme.spacing.default,
    },
    field: {
      gap: theme.spacing.xs,
    },
    label: {
      ...theme.fonts.titleMediumLight,
      color: theme.colors.onSurface,
    },
    sublabel: {
      ...theme.fonts.bodySmall,
      color: theme.colors.onSurfaceVariant,
    },
    promptList: {
      gap: theme.spacing.s,
    },
    promptRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.s,
    },
    promptInput: {
      flex: 1,
    },
    addButton: {
      alignSelf: 'flex-start',
      marginTop: theme.spacing.xs,
    },
  });
