import * as React from 'react';
import {Animated} from 'react-native';

/**
 * usePulse — 生成/编辑动效脉冲（呼吸缩放）。
 * active 为 false 时归零；为 true 时循环 900ms 呼吸。
 */
export const usePulse = (active: boolean) => {
  const pulse = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    if (!active) {
      pulse.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 900,
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 900,
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [active, pulse]);

  return pulse;
};
