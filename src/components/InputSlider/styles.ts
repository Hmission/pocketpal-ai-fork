import {StyleSheet} from 'react-native';

import {Theme} from '../../utils/types';

export const createStyles = (theme: Theme) =>
  StyleSheet.create({
    container: {},
    label: {
      color: theme.colors.onSurface,
    },
    description: {
      fontSize: theme.typography.captionM.fontSize, // B56③ fontSize→captionM
      color: theme.colors.textSecondary,
      marginTop: theme.spacing.xxs,
      marginBottom: theme.spacing.s,
    },
    controlRow: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    sliderContainer: {
      flex: 1,
      marginRight: theme.spacing.s,
    },
    slider: {},
    textInput: {},
    disabledTextInput: {
      opacity: 0.7,
      backgroundColor: theme.colors.surfaceDisabled,
    },
    rangeContainer: {
      flexDirection: 'row',
      justifyContent: 'space-between',
    },
    rangeLabel: {
      ...theme.fonts.bodySmall,
      color: theme.colors.onSurfaceVariant,
    },
    disabledText: {
      color: theme.colors.onSurfaceDisabled,
    },
  });
