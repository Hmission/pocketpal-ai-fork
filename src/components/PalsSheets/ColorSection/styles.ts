import {StyleSheet} from 'react-native';
import {Theme} from '../../../utils/types';

export const createStyles = (theme: Theme) =>
  StyleSheet.create({
    pickerContainer: {
      flexDirection: 'row',
      paddingVertical: theme.spacing.s,
      gap: theme.spacing.sm,
    },
    colorButtonContainer: {
      width: 28,
      height: 28,
      // B56②：28px 圆钮 100 → full（同 icon 钮裁定）
      borderRadius: theme.radius.full,
      borderWidth: 1,
      borderColor: '#222222',
      // B56②：1→xxs(2)（swatch 微内距）
      padding: theme.spacing.xxs,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: 'white',
    },
    colorButton: {
      width: 24,
      height: 24,
      borderRadius: theme.radius.m,
      overflow: 'hidden',
      flexDirection: 'row',
      transform: [{rotate: '45deg'}],
    },
    colorHalf: {
      width: '50%',
      height: '100%',
    },
    rightHalf: {
      borderLeftWidth: 0.5,
      borderLeftColor: '#E0E0E0',
    },
    selectedColorButtonContainer: {
      width: 30,
      height: 30,
      borderColor: theme.colors.onBackground,
      borderWidth: 2.5,
      shadowColor: theme.colors.onBackground,
      shadowOffset: {width: 0, height: 1},
      shadowOpacity: 0.3,
      shadowRadius: 2,
      elevation: 3,
    },
  });
