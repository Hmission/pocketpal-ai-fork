import {StyleSheet} from 'react-native';

import {Theme} from '../../utils/types';

export const createStyles = (theme: Theme) =>
  StyleSheet.create({
    codeHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    codeLanguage: {
      color: theme.colors.onSurfaceVariant,
      fontSize: theme.typography.captionM.fontSize, // B56③ fontSize→captionM
    },
    iconTouchable: {
      padding: theme.spacing.xs,
      justifyContent: 'center',
      alignItems: 'center',
    },
  });
