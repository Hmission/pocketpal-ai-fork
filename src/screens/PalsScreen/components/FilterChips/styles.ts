import {StyleSheet} from 'react-native';
import {Theme} from '../../../../utils/types';

export const createStyles = (theme: Theme) =>
  StyleSheet.create({
    container: {
      backgroundColor: theme.colors.surface,
      paddingVertical: theme.spacing.s,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.colors.outline,
    },
    scrollContent: {
      paddingHorizontal: theme.spacing.m,
      gap: theme.spacing.s,
    },
    chip: {
      borderColor: theme.colors.outline,
      backgroundColor: theme.colors.surface,
      borderRadius: theme.radius.l,
      height: 32,
    },
    activeChip: {
      backgroundColor: theme.colors.primaryContainer,
      borderColor: theme.colors.primary,
    },
    chipText: {
      fontSize: theme.typography.uiS.fontSize, // B56③ fontSize→uiS
      fontWeight: '500',
      color: theme.colors.onSurfaceVariant,
    },
    activeChipText: {
      color: theme.colors.onPrimaryContainer,
      fontWeight: '600',
    },
  });
