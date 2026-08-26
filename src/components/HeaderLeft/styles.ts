import {StyleSheet} from 'react-native';

import {Theme} from '../../utils/types';

export const createStyles = (theme: Theme) =>
  StyleSheet.create({
    menuIcon: {
      // Minimum 44pt touch target for iOS accessibility guidelines
      height: theme.size.minTapTarget,
      width: theme.size.minTapTarget,
      marginHorizontal: 11,
      justifyContent: 'center',
      alignItems: 'center',
    },
  });
