import {StyleSheet} from 'react-native';

import type {Theme} from '../../utils/types';

export const overlayStyles = (theme: Theme, topInset: number) =>
  StyleSheet.create({
    root: {
      position: 'absolute',
      top: topInset - 4,
      // B58：左右对称化（原 left:50/right:45 右偏 2.5px），归 spacing.xxl 档
      left: theme.spacing.xxl,
      right: theme.spacing.xxl,
      zIndex: 100,
    },
  });
