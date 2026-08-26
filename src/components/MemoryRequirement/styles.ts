import {StyleSheet} from 'react-native';

import {Theme} from '../../utils/types';

export const createStyles = (theme: Theme) =>
  StyleSheet.create({
    container: {},
    row: {
      paddingHorizontal: theme.spacing.sm,
      // B56②：10→s(8)（行内垂直紧凑）
      paddingVertical: theme.spacing.s,
      borderRadius: theme.radius.ml,
      backgroundColor: theme.colors.surface,
    },
    text: {
      fontSize: theme.typography.bodyS.fontSize, // B56③ fontSize→bodyS
      color: theme.colors.onSurfaceVariant,
    },
  });
