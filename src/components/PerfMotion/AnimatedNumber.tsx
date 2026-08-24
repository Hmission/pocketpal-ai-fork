/**
 * AnimatedNumber — 追式缓动数字（PERF_BENCHMARK_DESIGN §10.3，B39 演出层）
 *
 * 新快照到达后数值「追」向真实值（300ms ease-out）；中途新值到达即从
 * 当前显示值重新定向——真实毛刺自然保留（抖动=活着，不平滑抹抖）。
 * 首帧直接显示目标值（不演假动画）；N/A（null/undefined/NaN）显占位符。
 *
 * 纪律：Animated JS driver（全局规范）；零新依赖；演出层不动数据层。
 */
import * as React from 'react';
import {Animated, Easing, StyleProp, Text, TextStyle} from 'react-native';

const isNA = (v: number | null | undefined): v is null | undefined =>
  v === undefined || v === null || Number.isNaN(v);

export interface AnimatedNumberProps {
  /** 真实采集值；N/A 显 placeholder（诚实，不编造） */
  value: number | null | undefined;
  /** 数字 → 文本（默认四舍五入整数） */
  format?: (n: number) => string;
  /** N/A 占位（默认 '--'，与跑分面板诚实模式同语义） */
  placeholder?: string;
  /** 追赶时长（默认 300ms） */
  chaseMs?: number;
  style?: StyleProp<TextStyle>;
  testID?: string;
}

export const AnimatedNumber: React.FC<AnimatedNumberProps> = ({
  value,
  format = n => String(Math.round(n)),
  placeholder = '--',
  chaseMs = 300,
  style,
  testID,
}) => {
  const [text, setText] = React.useState(() =>
    isNA(value) ? placeholder : format(value),
  );
  const animValue = React.useRef(new Animated.Value(0)).current;
  // 首帧锚定目标值：不演假动画；后续从当前显示值追赶
  const primedRef = React.useRef(false);
  const formatRef = React.useRef(format);
  formatRef.current = format;

  React.useEffect(() => {
    if (isNA(value)) {
      primedRef.current = false;
      setText(placeholder);
      return;
    }
    const target = value;
    const fmt = formatRef.current;
    if (!primedRef.current) {
      primedRef.current = true;
      animValue.setValue(target);
      setText(fmt(target));
      return;
    }
    const listener = animValue.addListener(({value: v}) => {
      const next = fmt(v);
      setText(prev => (prev === next ? prev : next));
    });
    const anim = Animated.timing(animValue, {
      toValue: target,
      duration: chaseMs,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    });
    anim.start(({finished}) => {
      if (finished) {
        setText(fmt(target));
      }
    });
    return () => {
      anim.stop();
      animValue.removeListener(listener);
    };
  }, [value, chaseMs, placeholder, animValue]);

  return (
    <Text style={style} testID={testID}>
      {text}
    </Text>
  );
};
