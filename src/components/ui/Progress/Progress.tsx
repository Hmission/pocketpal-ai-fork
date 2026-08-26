import * as React from 'react';
import {StyleSheet, View, ViewStyle} from 'react-native';

import {useTheme} from '../../../hooks/useTheme';
import {withOpacity} from '../../../utils/colorUtils';

/**
 * Progress — 确定性进度条（B57 ui 域单一事实源）。
 *
 * 收敛自 6 套自绘 + 2 处 paper ProgressBar（B48 调研）：
 * 高度/轨道色/填充色参数化，radius = height/2（消灭裸数字圆角）。
 *
 * 语义：value 缺省/NaN → 不确定状态（wave 系 2% 底条惯例）；
 * value 0-100 → 确定进度的填充比。
 */
export interface ProgressProps {
  /** 0-100 确定进度；缺省/NaN = 不确定（2% 底条） */
  value?: number;
  /** 条高（px）：4（banner 契约）| 6（wave 系默认）| 8（卡片） */
  height?: 4 | 6 | 8;
  /** 填充色，默认 theme.colors.primary */
  color?: string;
  /** 轨道色，默认 shadow 8% */
  trackColor?: string;
  style?: ViewStyle;
  testID?: string;
}

export const Progress: React.FC<ProgressProps> = ({
  value,
  height = 6,
  color,
  trackColor,
  style,
  testID,
}) => {
  const theme = useTheme();
  const fillColor = color ?? theme.colors.primary;
  const ratio =
    value == null || Number.isNaN(value)
      ? 0.02
      : Math.max(0, Math.min(1, value / 100));

  return (
    <View
      testID={testID}
      style={[
        styles.track,
        {
          height,
          borderRadius: height / 2,
          backgroundColor: trackColor ?? withOpacity(theme.colors.shadow, 0.08),
        },
        style,
      ]}>
      <View
        style={[
          styles.fill,
          {
            width: `${ratio * 100}%`,
            borderRadius: height / 2,
            backgroundColor: fillColor,
          },
        ]}
      />
    </View>
  );
};

Progress.displayName = 'Progress';

const styles = StyleSheet.create({
  track: {
    overflow: 'hidden',
    width: '100%',
  },
  fill: {
    height: '100%',
  },
});
