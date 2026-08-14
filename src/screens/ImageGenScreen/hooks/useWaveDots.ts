import * as React from 'react';
import {Animated} from 'react-native';

/**
 * useWaveDots — 三点波浪动效（生成/加载中的进度指示）。
 *
 * 三个圆点依次上下起伏（错峰 150ms），纯 Animated + useNativeDriver，
 * 替代旧圆形 orb 缩放动画，与卡片浅色设计语言统一。
 * active 为 false 时归零；为 true 时循环起伏。
 */
export const useWaveDots = (active: boolean): Animated.Value[] => {
  const dots = React.useRef([0, 1, 2].map(() => new Animated.Value(0))).current;

  React.useEffect(() => {
    if (!active) {
      dots.forEach(d => d.setValue(0));
      return;
    }
    const loops = dots.map((dot, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 150),
          Animated.timing(dot, {
            toValue: 1,
            duration: 350,
            useNativeDriver: true,
          }),
          Animated.timing(dot, {
            toValue: 0,
            duration: 350,
            useNativeDriver: true,
          }),
        ]),
      ),
    );
    loops.forEach(l => l.start());
    return () => loops.forEach(l => l.stop());
  }, [active, dots]);

  return dots;
};
