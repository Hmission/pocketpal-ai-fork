import {StyleSheet} from 'react-native';

import {Theme} from '../../utils/types';

export const createStyles = (theme: Theme) =>
  StyleSheet.create({
    menu: {
      // B56②豁免：shadow token dark 绑定白不适配（登记评审）
      shadowColor: 'rgba(0, 0, 0, 0.05)',
      shadowRadius: 70,
      shadowOffset: {width: 0, height: 0},
      elevation: 5,
      borderRadius: theme.radius.m,
      maxWidth: '90%',
    },
    menuWithSubmenu: {
      elevation: 0,
      shadowOpacity: 0,
    },
    content: {
      paddingVertical: 0,
      backgroundColor: theme.colors.menuBackground,
      borderRadius: theme.radius.m,
      // overflow: 'hidden', This removes shadow
      // B56②：10→sm(12)（水平性）
      marginRight: theme.spacing.sm,
    },
    contentWithSubmenu: {
      backgroundColor: theme.colors.menuBackground,
    },
    groupSeparator: {
      height: 6,
      flexShrink: 0,
      backgroundColor: 'transparent',
    },
    separator: {
      backgroundColor: theme.colors.menuSeparator,
    },
  });
