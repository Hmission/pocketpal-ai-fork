import * as React from 'react';
import {Animated} from 'react-native';

/**
 * useStaggerEntry — 列表/分组错峰入场（DESIGN_SPEC §5，引力场思路克制版）。
 *
 * 行级 opacity 0→1 + translateY 8→0，按 index × delayStep 错峰启动，
 * 仅挂载时一次性执行、不循环（规避长挂载窗口的 weak-ref 风险）。
 * JS driver 铁律延伸：一次性短动画仍统一走 JS driver。
 *
 * @param index 当前行序号（从 0 起）
 * @param delayStep 每行错峰毫秒数（默认 30）
 */
export function useStaggerEntry(index: number, delayStep = 30) {
  const anim = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    const timer = setTimeout(() => {
      Animated.timing(anim, {
        toValue: 1,
        duration: 220,
        useNativeDriver: false,
      }).start();
    }, index * delayStep);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    opacity: anim,
    transform: [
      {translateY: anim.interpolate({inputRange: [0, 1], outputRange: [8, 0]})},
    ],
  };
}
