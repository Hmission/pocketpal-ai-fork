import {StyleSheet} from 'react-native';

import {Theme} from '../../utils/types';

export const styles = ({theme}: {theme: Theme}) =>
  StyleSheet.create({
    container: {
      flexDirection: 'row',
      alignItems: 'center',
      // 固定高度：复制 icon(16) 与 timing 文本(10) 统一基线，不随内容跳动
      height: 24,
      gap: 6,
      marginTop: 4,
      // 与正文同一水平缩进 token：按钮组对齐文本左缘，不再贴卡片边缘
      marginHorizontal: theme.insets.messageInsetsHorizontal,
      paddingBottom: 6,
    },
    // 重新生成禁用态（agent 运行中 / 无激活模型）
    actionDisabled: {
      opacity: 0.35,
    },
    timing: {
      color: theme.colors.textSecondary,
      fontSize: 10,
    },
    // 性能数字：品牌色强调（小黄鸡暖黄）
    timingValue: {
      color: theme.colors.brandAccent,
      fontWeight: '600',
    },
    // 标签：辅助灰，与数字区分
    timingSuffix: {
      color: theme.colors.textSecondary,
    },
    interruptedStatus: {
      color: theme.colors.error,
      fontSize: 10,
    },
  });
