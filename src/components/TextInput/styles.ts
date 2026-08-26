import {StyleSheet} from 'react-native';

import {Theme} from '../../utils/types';

export const createStyles = (theme: Theme) =>
  StyleSheet.create({
    container: {
      borderWidth: 1,
      borderColor: theme.colors.border,
      // B56②：10→m(12)（输入框圆角，三角同步）
      borderRadius: theme.radius.m,
      borderTopStartRadius: theme.radius.m,
      borderTopEndRadius: theme.radius.m,
      alignSelf: 'stretch',
      backgroundColor: 'transparent',
    },
    input: {
      backgroundColor: 'transparent',
    },
    placeholder: {
      opacity: 0.3,
    },
    divider: {
      width: 330,
      height: 0.33,
      backgroundColor: theme.colors.outlineVariant,
      marginLeft: theme.spacing.ml,
    },
  });
