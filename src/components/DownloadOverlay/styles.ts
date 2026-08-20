import {StyleSheet} from 'react-native';

import type {Theme} from '../../utils/types';

export const overlayStyles = (theme: Theme, topInset: number) =>
  StyleSheet.create({
    root: {
      position: 'absolute',
      top: topInset - 4,
      left: 50,
      right: 45,
      zIndex: 100,
    },
  });
