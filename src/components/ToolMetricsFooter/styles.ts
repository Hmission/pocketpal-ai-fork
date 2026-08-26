import {StyleSheet} from 'react-native';

import {Theme} from '../../utils/types';

export const styles = ({theme}: {theme: Theme}) =>
  StyleSheet.create({
    container: {
      paddingTop: theme.spacing.xs,
      paddingBottom: theme.spacing.s,
      // No horizontal padding — aligns with the AI text / footer / chip
      // at the assistant row's marginLeft (single shared gutter).
    },
    text: {
      color: theme.colors.textSecondary,
      fontSize: theme.typography.captionS.fontSize, // B56③ fontSize→captionS
    },
  });
