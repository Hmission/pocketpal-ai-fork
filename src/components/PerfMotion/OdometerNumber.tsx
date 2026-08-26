/**
 * OdometerNumber — 里程表翻滚数字（PERF_BENCHMARK_DESIGN §10.3）
 *
 * 关键大数字（综合分 / tok/s）逐位滚动：每位数字是 0-9 竖排条带，
 * translateY 随数值变化做 300ms ease-out 位移（机场翻牌器质感）。
 * 非数字字符（小数点/单位）原样渲染。N/A 显 '--'（诚实模式）。
 *
 * 纪律：Animated JS driver；overflow hidden 裁剪，零新依赖。
 */
import * as React from 'react';
import {
  Animated,
  Easing,
  StyleProp,
  StyleSheet,
  Text,
  TextStyle,
  View,
} from 'react-native';

const DIGITS = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];

/** 静态外观（字号/行高/颜色/位移随 props/动画动态注入） */
const styles = StyleSheet.create({
  rollerWrap: {
    overflow: 'hidden',
  },
  digitText: {
    textAlign: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});

interface DigitRollerProps {
  digit: number;
  fontSize: number;
  color?: string;
}

/** 单个数位：竖排 0-9 条带，首帧锚定目标位（不演假动画），后续变化翻滚 */
const DigitRoller: React.FC<DigitRollerProps> = ({digit, fontSize, color}) => {
  const lineHeight = Math.round(fontSize * 1.25);
  const translateY = React.useRef(
    new Animated.Value(-digit * lineHeight),
  ).current;
  // 动态部分（高/字号/色/位移）经组件体变量注入，静态外观走 styles
  const rollerStyle = {height: lineHeight};
  const digitStyle = {fontSize, lineHeight, color};

  React.useEffect(() => {
    const anim = Animated.timing(translateY, {
      toValue: -digit * lineHeight,
      duration: 300,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    });
    anim.start();
    return () => anim.stop();
  }, [digit, lineHeight, translateY]);

  return (
    <View style={[styles.rollerWrap, rollerStyle]}>
      <Animated.View style={{transform: [{translateY}]}}>
        {DIGITS.map(d => (
          <Text key={d} style={[styles.digitText, digitStyle]}>
            {d}
          </Text>
        ))}
      </Animated.View>
    </View>
  );
};

export interface OdometerNumberProps {
  /** 真实采集值；N/A 显 '--' */
  value: number | null | undefined;
  /** 数字 → 文本（默认整数） */
  format?: (n: number) => string;
  /** 字号（决定滚动条带行高） */
  fontSize?: number;
  color?: string;
  style?: StyleProp<TextStyle>;
  testID?: string;
}

export const OdometerNumber: React.FC<OdometerNumberProps> = ({
  value,
  format = n => String(Math.round(n)),
  fontSize = 16,
  color,
  style,
  testID,
}) => {
  const na = value === undefined || value === null || Number.isNaN(value);
  const text = na ? '--' : format(value);
  const lineHeight = Math.round(fontSize * 1.25);
  // 动态行高（基于 props 字号）经组件体变量注入
  const rowStyle = {height: lineHeight};

  return (
    <View style={[styles.row, rowStyle, style]} testID={testID}>
      {na
        ? text.split('').map((ch, i) => (
            <Text key={i} style={{fontSize, lineHeight, color}}>
              {ch}
            </Text>
          ))
        : text.split('').map((ch, i) =>
            ch >= '0' && ch <= '9' ? (
              <DigitRoller
                key={`${text.length}-${i}`}
                digit={ch.charCodeAt(0) - 48}
                fontSize={fontSize}
                color={color}
              />
            ) : (
              <Text key={i} style={{fontSize, lineHeight, color}}>
                {ch}
              </Text>
            ),
          )}
    </View>
  );
};
