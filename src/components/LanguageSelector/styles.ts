import {StyleSheet} from 'react-native';

import {Theme} from '../../utils/types';

export const createStyles = (theme: Theme) =>
  StyleSheet.create({
    // Content-sized: no width, so a long endonym is never clipped.
    trigger: {
      flexDirection: 'row',
      alignItems: 'center',
      flexShrink: 1,
      gap: theme.spacing.s,
      minHeight: theme.size.minTapTarget,
      // B56②：14→sm(12)（触发器行内内边距）
      paddingHorizontal: theme.spacing.sm,
      borderRadius: theme.radius.m,
      borderWidth: 1,
      borderColor: theme.colors.outlineVariant,
      backgroundColor: theme.colors.surface,
    },
    triggerLabel: {
      flexShrink: 1,
      color: theme.colors.onSurface,
      fontSize: theme.typography.titleS.fontSize, // B56③ fontSize→titleS
    },
  });
