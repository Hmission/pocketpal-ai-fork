import {StyleSheet} from 'react-native';

import {useTheme} from '../../hooks/useTheme';

export const createStyles = (theme: ReturnType<typeof useTheme>) =>
  StyleSheet.create({
    scrollContent: {
      paddingHorizontal: theme.spacing.sm,
      paddingVertical: theme.spacing.s,
      gap: theme.spacing.s,
    },
    chip: {
      maxWidth: 260,
      paddingHorizontal: theme.spacing.sm,
      // B56②：6→xs(4)（chip 紧凑垂直内距）
      paddingVertical: theme.spacing.xs,
      borderRadius: theme.radius.ml,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.colors.outline,
      // Opaque so chips read cleanly over content scrolling beneath them.
      backgroundColor: theme.colors.surface,
    },
    chipPressed: {
      opacity: 0.6,
    },
    chipDisabled: {
      opacity: 0.4,
    },
    chipText: {
      fontSize: theme.typography.bodyS.fontSize,
      color: theme.colors.onSurface,
    },
  });
