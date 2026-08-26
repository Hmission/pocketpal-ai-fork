import {StyleSheet} from 'react-native';
import {Theme} from '../../../utils';

export const createStyles = (theme: Theme) =>
  StyleSheet.create({
    accordion: {
      height: 55,
      backgroundColor: theme.colors.surface,
    },
    accordionTitle: {
      fontSize: theme.typography.uiM.fontSize, // B56③ fontSize→uiM
    },
    accordionDescription: {
      fontSize: theme.typography.captionM.fontSize, // B56③ fontSize→captionM
      // B56②：10→s(8)（垂直紧凑）
      paddingBottom: theme.spacing.s,
    },
  });
