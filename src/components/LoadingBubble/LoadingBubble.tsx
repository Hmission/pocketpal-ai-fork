import {View, Animated} from 'react-native';
import React, {useEffect, useRef} from 'react';

import {useTheme} from '../../hooks';

import {styles} from './styles';

import {Theme} from '../../utils/types';

interface LoadingDotProps {
  delay: number;
  theme: Theme;
}

const LoadingDot: React.FC<LoadingDotProps> = ({delay, theme}) => {
  const opacity = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    // 全局动画规范：Animated.loop 一律 JS driver。useNativeDriver:true 会在
    // 循环期间持续触发 TurboModule invokeJavaMethod → weak ref 累积至 51200
    // 溢出（tombstone_03/04 实锤）。本组件挂载窗口=首 token 前（秒~分钟级），
    // 历史无崩溃但收口规则先行；opacity 属性 JS driver 完全支持。
    const animation = Animated.sequence([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 500,
        delay,
        useNativeDriver: false,
      }),
      Animated.timing(opacity, {
        toValue: 0.3,
        duration: 500,
        useNativeDriver: false,
      }),
    ]);

    Animated.loop(animation).start();
  }, [opacity, delay]);

  return (
    <Animated.View
      style={[
        styles.dot,
        {
          backgroundColor: theme.colors.outline,
          opacity,
        },
      ]}
    />
  );
};

export const LoadingBubble: React.FC = () => {
  const theme = useTheme();

  return (
    <View
      style={[
        styles.container,
        {backgroundColor: theme.colors.surfaceVariant},
      ]}>
      <LoadingDot delay={0} theme={theme} />
      <LoadingDot delay={200} theme={theme} />
      <LoadingDot delay={400} theme={theme} />
    </View>
  );
};
