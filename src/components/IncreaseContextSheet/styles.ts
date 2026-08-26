import {StyleSheet} from 'react-native';

import {Theme} from '../../utils/types';

export const createStyles = (theme: Theme) =>
  StyleSheet.create({
    container: {
      paddingHorizontal: theme.spacing.m,
      paddingVertical: theme.spacing.s,
      // B56②：14→m(16)（区块级 stack gap 取大档）
      gap: theme.spacing.m,
    },
    body: {
      color: theme.colors.onSurfaceVariant,
    },
    pickHead: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      marginTop: theme.spacing.xs,
    },
    pickVal: {
      color: theme.colors.onSurface,
      fontVariant: ['tabular-nums'],
    },
    pickUnit: {
      color: theme.colors.onSurfaceVariant,
    },
    pickSub: {
      color: theme.colors.onSurfaceVariant,
      marginTop: theme.spacing.xs,
    },
    fitChip: {
      // B56②：10→sm(12)（水平性）
      paddingHorizontal: theme.spacing.sm,
      paddingVertical: theme.spacing.xs,
      borderRadius: 999,
    },
    fitChipText: {
      fontSize: theme.typography.captionS.fontSize, // B56③ fontSize→captionS
      fontWeight: '700' as const,
      letterSpacing: 0.2,
    },
    sliderWrap: {
      marginTop: theme.spacing.xs,
    },
    slider: {
      width: '100%',
      height: theme.size.controlHeight,
    },
    sliderEnds: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingHorizontal: theme.spacing.xs,
    },
    sliderEndsText: {
      color: theme.colors.onSurfaceVariant,
      fontVariant: ['tabular-nums'],
    },
    statusLine: {
      paddingHorizontal: theme.spacing.sm,
      // B56②：10→s(8)（垂直紧凑）
      paddingVertical: theme.spacing.s,
      borderRadius: theme.radius.s,
      minHeight: 40,
      justifyContent: 'center',
    },
    statusText: {
      color: theme.colors.onSurfaceVariant,
    },
    hedge: {
      color: theme.colors.onSurfaceVariant,
      fontStyle: 'italic' as const,
    },
    advancedToggle: {
      // B56②：6→xs(4)（紧凑垂直内距）
      paddingVertical: theme.spacing.xs,
    },
    advancedToggleText: {
      color: theme.colors.onSurfaceVariant,
      fontWeight: '600' as const,
    },
    advancedBody: {
      color: theme.colors.onSurfaceVariant,
      lineHeight: 18,
    },
    noFitBody: {
      color: theme.colors.onSurfaceVariant,
      lineHeight: 20,
    },
    button: {
      flex: 1,
    },
  });
