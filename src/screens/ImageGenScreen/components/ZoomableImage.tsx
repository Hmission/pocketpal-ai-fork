import * as React from 'react';
import {StyleSheet, Text} from 'react-native';
import {
  Gesture,
  GestureDetector,
  GestureHandlerRootView,
} from 'react-native-gesture-handler';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';

import {useTheme} from '../../../hooks';

interface ZoomableImageProps {
  uri: string | null;
  onClose: () => void;
}

/**
 * ZoomableImage — 全屏图片查看器（P6-6 增补）：
 * 双指捏合缩放（1-4×）+ 双指/单指拖动平移（放大后）+ 单击关闭；
 * 浅色 surface 遮罩（主题表面色 ~94% 不透明，非纯黑）。
 * 手势组合：Exclusive(单击关闭, Simultaneous(捏合, 平移))——
 * 轻点触发 tap；任何移动/双指则 composed 接管。
 * 注意：本组件渲染在 RN <Modal> 内——Android Modal 是独立原生窗口，
 * App 根的 GestureHandlerRootView 覆盖不到，必须在 Modal 内部重新 root，
 * 否则手势全部失效（2026-08-19 真机实锤：单击/缩放/拖动全无响应）。
 */
export const ZoomableImage: React.FC<ZoomableImageProps> = ({uri, onClose}) => {
  const theme = useTheme();
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const savedTx = useSharedValue(0);
  const savedTy = useSharedValue(0);

  // 手势回调被 reanimated 插件自动 worklet 化（跑 UI 线程）：
  // 回调内只能写共享值/内联运算，禁止调普通 JS 函数（否则 Worklets 红屏，
  // 2026-08-19 真机实锤：tap.onEnd 调 onClose 抛 non-worklet 错误）；
  // 需回 JS 线程的回调显式 runOnJS(true)。
  const pinch = Gesture.Pinch()
    .onUpdate(e => {
      'worklet';
      scale.value = Math.max(1, Math.min(4, savedScale.value * e.scale));
    })
    .onEnd(() => {
      'worklet';
      savedScale.value = scale.value;
    });

  const pan = Gesture.Pan()
    .onUpdate(e => {
      'worklet';
      // 未放大时不平移（保持原始布局）；放大后可拖动查看
      if (scale.value <= 1.001) {
        return;
      }
      tx.value = savedTx.value + e.translationX;
      ty.value = savedTy.value + e.translationY;
    })
    .onEnd(() => {
      'worklet';
      savedTx.value = tx.value;
      savedTy.value = ty.value;
    });

  const tap = Gesture.Tap()
    .runOnJS(true)
    .onEnd(() => onClose());

  const composed = Gesture.Simultaneous(pinch, pan);
  const gesture = Gesture.Exclusive(tap, composed);

  const imgStyle = useAnimatedStyle(() => ({
    transform: [
      {translateX: tx.value},
      {translateY: ty.value},
      {scale: scale.value},
    ],
  }));

  return (
    <GestureHandlerRootView
      style={[styles.root, {backgroundColor: theme.colors.surface + 'F0'}]}>
      {uri ? (
        <GestureDetector gesture={gesture}>
          <Animated.View style={styles.touchArea}>
            <Animated.Image
              source={{uri}}
              style={[styles.img, imgStyle]}
              resizeMode="contain"
            />
          </Animated.View>
        </GestureDetector>
      ) : null}
      <Text style={[styles.hint, {color: theme.colors.onSurfaceVariant}]}>
        双指缩放 · 拖动移动 · 单击关闭
      </Text>
    </GestureHandlerRootView>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    // 浅色遮罩：主题 surface ~94% 不透明（动态着色，见组件内联样式），非纯黑
    justifyContent: 'center',
    alignItems: 'center',
  },
  touchArea: {
    flex: 1,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  img: {
    width: '100%',
    height: '100%',
  },
  hint: {
    position: 'absolute',
    bottom: 24,
    alignSelf: 'center',
    fontSize: 12,
  },
});
