import {StyleSheet} from 'react-native';

import {Theme} from '../../utils/types';

export const styles = ({theme}: {theme: Theme}) =>
  StyleSheet.create({
    container: {
      paddingHorizontal: theme.spacing.sm,
      paddingVertical: theme.spacing.xs,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    icon: {
      fontSize: theme.typography.bodyS.fontSize, // B56③ fontSize→bodyS
      // B56②：6→xs(4)（紧凑行内 gap）
      marginRight: theme.spacing.xs,
      color: theme.colors.error,
    },
    label: {
      fontSize: theme.typography.uiS.fontSize, // B56③ fontSize→uiS
      color: theme.colors.error,
    },
    message: {
      fontSize: theme.typography.captionS.fontSize, // B56③ fontSize→captionS
      marginTop: theme.spacing.xxs,
      marginLeft: theme.spacing.ml,
      color: theme.colors.onSurfaceVariant,
    },
  });
