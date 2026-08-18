import * as React from 'react';
import {Animated} from 'react-native';

/**
 * useToast — 轻量滚动信息条（替代弹窗）：不打断操作，2.5s 后自动淡出。
 */
export const useToast = () => {
  const [toast, setToast] = React.useState<string | null>(null);
  const toastOpacity = React.useRef(new Animated.Value(0)).current;
  const toastTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = React.useCallback(
    (msg: string) => {
      setToast(msg);
      if (toastTimer.current) {
        clearTimeout(toastTimer.current);
      }
      Animated.timing(toastOpacity, {
        toValue: 1,
        duration: 200,
        useNativeDriver: false,
      }).start();
      toastTimer.current = setTimeout(() => {
        Animated.timing(toastOpacity, {
          toValue: 0,
          duration: 400,
          useNativeDriver: false,
        }).start(() => setToast(null));
      }, 2500);
    },
    [toastOpacity],
  );

  return {toast, toastOpacity, showToast};
};
