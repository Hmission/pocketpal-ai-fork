import {StyleSheet} from 'react-native';

import {Theme} from '../../utils/types';

export const createStyles = (theme: Theme) =>
  StyleSheet.create({
    container: {
      position: 'relative',
    },
    tooltip: {
      position: 'absolute',
      padding: theme.spacing.s,
      borderRadius: theme.radius.xs,
      backgroundColor: theme.colors.surface,
      elevation: 4,
      width: 120,
    },
    tooltipTitle: {
      color: theme.colors.primary,
      fontSize: theme.typography.uiS.fontSize, // B56③ fontSize→uiS
      fontWeight: 'bold',
      marginBottom: theme.spacing.xs,
    },
    tooltipText: {
      color: theme.colors.onSurface,
      fontSize: theme.typography.captionS.fontSize, // B56③ fontSize→captionS
      marginBottom: theme.spacing.xxs,
    },
  });
