import React from 'react';
import {Animated, Pressable, StyleProp, ViewStyle} from 'react-native';

// scale 是 Animated.Value，必须挂 Animated 包装组件才会驱动更新
const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export interface PressableScaleProps {
  onPress?: () => void;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
  children?: React.ReactNode;
}

/**
 * PressableScale — 按压回弹反馈（DESIGN_SPEC §5，铁律内克制版）。
 * Animated.spring scale 1 → 0.97 → 1，一次性短动画、JS driver
 *（Animated.loop 一律 JS driver 的 07a47ed 收口规则延伸：按压虽非
 * loop，仍统一走 JS driver，避免任何 native 动画残留路径）。
 */
export const PressableScale: React.FC<PressableScaleProps> = ({
  onPress,
  disabled,
  style,
  testID,
  children,
}) => {
  const scale = React.useRef(new Animated.Value(1)).current;

  const animate = (toValue: number) => {
    Animated.spring(scale, {
      toValue,
      friction: 7,
      useNativeDriver: false,
    }).start();
  };

  return (
    <AnimatedPressable
      testID={testID}
      disabled={disabled}
      onPress={onPress}
      onPressIn={() => animate(0.97)}
      onPressOut={() => animate(1)}
      style={[style, {transform: [{scale}]}]}>
      {children}
    </AnimatedPressable>
  );
};
