import {StyleSheet} from 'react-native';

import {Theme} from '../../utils/types';

export const styles = ({theme}: {theme: Theme}) =>
  StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: theme.spacing.xxs,
    },
    label: {
      flexShrink: 1,
      // B56②：6→xs(4)（紧凑行内 gap）
      marginHorizontal: theme.spacing.xs,
      fontSize: theme.typography.uiS.fontSize, // B56③ fontSize→uiS
      color: theme.colors.textSecondary,
      opacity: 0.85,
    },
    count: {
      flexShrink: 0,
      // B56②：6→xs(4)（紧凑行内 gap）
      marginRight: theme.spacing.xs,
      fontSize: theme.typography.captionM.fontSize, // B56③ fontSize→captionM
      color: theme.colors.textSecondary,
      opacity: 0.85,
    },
  });

export const sheetStyles = ({theme}: {theme: Theme}) =>
  StyleSheet.create({
    container: {
      paddingHorizontal: theme.spacing.m,
      paddingTop: theme.spacing.s,
    },
    subtitle: {
      marginBottom: theme.spacing.sm,
      fontSize: theme.typography.bodyS.fontSize,
      color: theme.colors.onSurfaceVariant,
    },
    result: {
      marginBottom: theme.spacing.m,
    },
    title: {
      color: theme.colors.onSurface,
    },
    url: {
      marginTop: theme.spacing.xxs,
      fontSize: theme.typography.captionS.fontSize, // B56③ fontSize→captionS
      color: theme.colors.onSurfaceVariant,
    },
    snippet: {
      marginTop: theme.spacing.xs,
      fontSize: theme.typography.captionM.fontSize, // B56③ fontSize→captionM
      color: theme.colors.onSurface,
    },
    empty: {
      fontSize: theme.typography.captionM.fontSize, // B56③ fontSize→captionM
      color: theme.colors.onSurfaceVariant,
    },
    bottomSpacer: {
      height: 32,
    },
  });
