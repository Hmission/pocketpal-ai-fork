import {StyleSheet} from 'react-native';

import {Theme} from '../../utils/types';

export const createStyles = (theme: Theme) =>
  StyleSheet.create({
  container: {
    flexDirection: 'row',
    padding: 8,
    borderRadius: theme.radius.ml,
    alignSelf: 'flex-start',
    marginVertical: 8,
    marginHorizontal: 12,
    gap: 4,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
});
