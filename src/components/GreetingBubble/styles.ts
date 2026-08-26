import {StyleSheet} from 'react-native';

import {Theme} from '../../utils/types';

export const createStyles = (
  colors: {
    background: string;
    border: string;
    text: string;
    accent: string;
  },
  theme: Theme,
) =>
  StyleSheet.create({
    container: {
      marginVertical: theme.spacing.s,
      marginHorizontal: theme.spacing.sm,
      paddingVertical: theme.spacing.sm,
      // B56②：14→sm(12)（气泡行内紧凑边距）
      paddingHorizontal: theme.spacing.sm,
      borderRadius: theme.radius.m,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      borderLeftWidth: 3,
      borderLeftColor: colors.accent,
      backgroundColor: colors.background,
      flexDirection: 'row',
      alignItems: 'flex-start',
      // B56②：10→sm(12)（水平性 icon-text gap）
      gap: theme.spacing.sm,
    },
    icon: {
      fontSize: theme.typography.bodyM.fontSize, // B56③ fontSize→bodyM
      // B56②：1→xxs(2)（icon 对齐微距）
      marginTop: theme.spacing.xxs,
    },
    text: {
      flex: 1,
      fontStyle: 'italic',
      fontSize: theme.typography.bodyS.fontSize, // B56③ fontSize→bodyS
      lineHeight: 20,
      color: colors.text,
    },
  });
