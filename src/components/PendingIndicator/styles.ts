import {StyleSheet} from 'react-native';

import {Theme} from '../../utils/types';

export const styles = StyleSheet.create({
  container: {
    alignSelf: 'flex-start',
    paddingTop: 6,
    // Extra paddingBottom keeps the dot-row from sitting flush against
    // the chat input — when the keyboard is closed, the FlatList's
    // header spacer collapses to height: 0 and the indicator is
    // otherwise the very last visible row above the input.
    paddingBottom: 16,
    paddingHorizontal: 12,
    maxWidth: '90%',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  dot: {
    width: 4,
    height: 4,
    borderRadius: 2,
  },
  // 思考流预览（生成进度监控卡 §18.9）：TTFT 期模型内心戏 2 行尾随
  reasoning: {
    marginTop: 6,
    marginLeft: 1,
    fontSize: 11,
    lineHeight: 15,
    color: '#8a8f98',
    opacity: 0.8,
  },
});

export const createCountStyle = (theme: Theme) =>
  StyleSheet.create({
    count: {
      marginLeft: 4,
      fontSize: 11,
      color: theme.colors.onSurfaceVariant,
      opacity: 0.75,
    },
  });
