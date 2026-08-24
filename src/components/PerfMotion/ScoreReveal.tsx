/**
 * ScoreReveal — 分数揭幕（PERF_BENCHMARK_DESIGN §10.3）
 *
 * 跑分结束的三秒多巴胺：数字从 0 狂飙到最终值（ease-out 先快后慢），
 * 定住瞬间光圈脉冲 + 触觉反馈。挂载即演（结果页专用，非实时组件）。
 *
 * 纪律：Animated JS driver；haptic 复用 react-native-haptic-feedback
 * 既有依赖；零新依赖。
 */
import * as React from 'react';
import {
  Animated,
  Easing,
  StyleProp,
  View,
  ViewStyle,
} from 'react-native';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';

export interface ScoreRevealProps {
  /** 最终分数（真实计算值，演出只改节奏不改数） */
  value: number;
  format?: (n: number) => string;
  /** 狂飙时长（默认 1200ms） */
  durationMs?: number;
  /** 数字颜色（消费方传入，跑分金=theme brandAccent，不裸 hex） */
  color: string;
  fontSize?: number;
  /** 光圈颜色（默认同数字色） */
  ringColor?: string;
  /** 揭幕完成回调（结果页可接段位文案入场） */
  onComplete?: () => void;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export const ScoreReveal: React.FC<ScoreRevealProps> = ({
  value,
  format = n => String(Math.round(n)),
  durationMs = 1200,
  color,
  fontSize = 40,
  ringColor,
  onComplete,
  style,
  testID,
}) => {
  const [text, setText] = React.useState(() => format(0));
  const count = React.useRef(new Animated.Value(0)).current;
  const ringOpacity = React.useRef(new Animated.Value(0)).current;
  const ringScale = React.useRef(new Animated.Value(0.6)).current;
  const doneRef = React.useRef(false);

  React.useEffect(() => {
    const listener = count.addListener(({value: v}) => {
      setText(format(v));
    });
    const counter = Animated.timing(count, {
      toValue: value,
      duration: durationMs,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    });
    counter.start(({finished}) => {
      count.removeListener(listener);
      if (!finished) {
        return;
      }
      setText(format(value));
      if (!doneRef.current) {
        doneRef.current = true;
        ReactNativeHapticFeedback.trigger('impactMedium', {
          enableVibrateFallback: true,
          ignoreAndroidSystemSettings: false,
        });
        // 定住瞬间：光圈扩散脉冲（300ms）
        Animated.parallel([
          Animated.sequence([
            Animated.timing(ringOpacity, {
              toValue: 0.9,
              duration: 80,
              useNativeDriver: false,
            }),
            Animated.timing(ringOpacity, {
              toValue: 0,
              duration: 260,
              useNativeDriver: false,
            }),
          ]),
          Animated.timing(ringScale, {
            toValue: 1.5,
            duration: 340,
            easing: Easing.out(Easing.quad),
            useNativeDriver: false,
          }),
        ]).start();
        onComplete?.();
      }
    });
    return () => {
      counter.stop();
      count.removeListener(listener);
    };
    // 挂载即演一次：value 变化不重跑（结果页语义）
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View
      style={[{alignItems: 'center', justifyContent: 'center'}, style]}
      testID={testID}>
      <Animated.Text
        testID={testID ? `${testID}-value` : undefined}
        style={{fontSize, color, fontVariant: ['tabular-nums']}}>
        {text}
      </Animated.Text>
      <Animated.View
        pointerEvents="none"
        style={{
          position: 'absolute',
          width: fontSize * 3,
          height: fontSize * 3,
          borderRadius: fontSize * 1.5,
          borderWidth: 2,
          borderColor: ringColor ?? color,
          opacity: ringOpacity,
          transform: [{scale: ringScale}],
        }}
      />
    </View>
  );
};
