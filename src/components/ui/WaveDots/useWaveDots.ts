import * as React from 'react';
import {Animated} from 'react-native';

/**
 * useWaveDots — 三点波浪动效（生成/加载中的进度指示），参数化版（B57）。
 *
 * 原实现位于 screens/ImageGenScreen/hooks（B57 归一迁移至 ui 域单一事实源）。
 * 三种波形由参数承载，不再复制实现：
 *   bounce（默认）：三点上下起伏（错峰 staggerMs、峰值 1）——原 useWaveDots 行为
 *   fade：三点闪烁（0.3↔1 opacity 语义，错峰 200ms）——原 PendingIndicator.Dot 行为
 * 值域恒为 0↔1，具体视觉映射由渲染侧（interpolate）决定。
 *
 * 全局动画规范：Animated.loop 一律 JS driver（07a47ed 收口规则）。
 * 本 hook 挂载窗口=分钟级生成全程，useNativeDriver:true 会持续触发
 * TurboModule invokeJavaMethod → weak ref 累积溢出（tombstone_03/04 实锤）。
 * translateY/opacity 由 transform 承载，JS driver 完全支持。
 */
export type WaveMode = 'bounce' | 'fade';

export interface WaveOptions {
  mode?: WaveMode;
  /** 单段时长（ms），bounce 默认 350；fade 默认 500 */
  durationMs?: number;
  /** 错峰（ms），bounce 默认 150；fade 默认 200 */
  staggerMs?: number;
}

const DEFAULT_OPTS: Required<WaveOptions> = {
  mode: 'bounce',
  durationMs: 350,
  staggerMs: 150,
};

export const useWaveDots = (
  active: boolean,
  opts?: WaveOptions,
): Animated.Value[] => {
  const {mode, durationMs, staggerMs} = {...DEFAULT_OPTS, ...opts};
  const dots = React.useRef([0, 1, 2].map(() => new Animated.Value(0))).current;

  React.useEffect(() => {
    if (!active) {
      dots.forEach(d => d.setValue(0));
      return;
    }
    const loops = dots.map((dot, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * staggerMs),
          Animated.timing(dot, {
            toValue: 1,
            duration: durationMs,
            useNativeDriver: false,
          }),
          Animated.timing(dot, {
            toValue: 0,
            duration: durationMs,
            useNativeDriver: false,
          }),
        ]),
      ),
    );
    loops.forEach(l => l.start());
    return () => loops.forEach(l => l.stop());
  }, [active, dots, mode, durationMs, staggerMs]);

  return dots;
};
