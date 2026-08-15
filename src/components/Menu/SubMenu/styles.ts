import {StyleSheet} from 'react-native';

import {Theme} from '../../../utils/types';

export const createStyles = (theme: Theme) =>
  StyleSheet.create({
    menu: {
      maxWidth: '90%',
      marginTop: 0,
      marginLeft: 0,
    },
    content: {
      paddingVertical: 0,
      backgroundColor: theme.colors.menuBackground,
      borderRadius: theme.radius.m,
      //overflow: 'hidden', This removes shadow
    },
  });
