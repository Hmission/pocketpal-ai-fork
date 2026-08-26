import * as React from 'react';
import {Animated, StyleSheet, View} from 'react-native';

import {useTheme} from '../../../hooks/useTheme';
import {useWaveDots, WaveMode, WaveOptions} from './useWaveDots';

/**
 * WaveDots — 三点波浪动效渲染组件（B57 ui 域单一事实源）。
 *
 * 收敛自 5 处重复渲染样板（ImageTaskProgress/ResultPreview/
 * AudioWorkshopTab/ChatPalModelPickerSheet/ModelSwitchDialog）：
 * 统一 dot 尺寸/gap/颜色/振幅参数，interpolate 由组件内部承载。
 *
 * bounce 语义：点上下起伏（translateY 0→-peak）+ 透明度轻微变化；
 * fade 语义：点闪烁（opacity 0.3→1，PendingIndicator.Dot 参数）。
 * 动画一律 JS driver（见 useWaveDots 头注释：weak ref 累积溢出红线）。
 */
export interface WaveDotsProps {
  /** 动画激活；false 时全部归零（透明/原位） */
  active?: boolean;
  /** 点径（px），默认 8 */
  size?: number;
  /** 点间距（px），默认 6 */
  gap?: number;
  /** 颜色，默认 theme.colors.primary */
  color?: string;
  /** 波形：bounce（默认，起伏）/ fade（闪烁） */
  mode?: WaveMode;
  /** bounce 振幅（px），默认 6 */
  translateY?: number;
  /** 透传 hook 参数（duration/stagger） */
  animation?: WaveOptions;
}

export const WaveDots: React.FC<WaveDotsProps> = ({
  active = true,
  size = 8,
  gap = 6,
  color,
  mode = 'bounce',
  translateY = 6,
  animation,
  ...rest
}) => {
  const theme = useTheme();
  const dots = useWaveDots(active, animation);
  const dotColor = color ?? theme.colors.primary;
  const fade = mode === 'fade';

  return (
    <View
      {...rest}
      style={[styles.row, {gap}]}
      accessible={false}
      importantForAccessibility="no-hide-descendants">
      {dots.map((dot, i) => (
        <Animated.View
          key={i}
          style={[
            styles.dot,
            {
              width: size,
              height: size,
              borderRadius: size / 2,
              backgroundColor: dotColor,
              opacity: dot.interpolate({
                inputRange: [0, 1],
                outputRange: fade ? [0.3, 1] : [0.45, 1],
              }),
              transform: fade
                ? []
                : [
                    {
                      translateY: dot.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0, -translateY],
                      }),
                    },
                  ],
            },
          ]}
        />
      ))}
    </View>
  );
};

WaveDots.displayName = 'WaveDots';

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dot: {
    // 尺寸/圆角/颜色由 props 注入（见上），此处仅含布局常量
  },
});
