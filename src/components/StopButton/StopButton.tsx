import * as React from 'react';
import {
  GestureResponderEvent,
  StyleSheet,
  TouchableOpacity,
  TouchableOpacityProps,
} from 'react-native';

import {useTheme} from '../../hooks/useTheme';
import {StopIcon} from '../../assets/icons';

export interface StopButtonPropsAdditionalProps {
  touchableOpacityProps?: TouchableOpacityProps;
}

export interface StopButtonProps extends StopButtonPropsAdditionalProps {
  /** Callback for stop button tap event */
  onPress?: () => void;
  color?: string;
}

/**
 * §18.4 发送/停止同一按钮语言的时态切换（复查 2026-08-20 定稿）：
 * 与 SendButton 同规格——36px 触区 + 20px 图标 + 圆形衬底，
 * 仅语义色表达状态（停止=error 红，发送=primary 黄）。
 * 生成中出停止钮时，触区/图标尺寸不变，不跳不缩。
 */
export const StopButton = ({
  onPress,
  touchableOpacityProps,
  color,
}: StopButtonProps) => {
  const theme = useTheme();
  const handlePress = (event: GestureResponderEvent) => {
    if (onPress) {
      onPress();
    }
    touchableOpacityProps?.onPress?.(event);
  };

  return (
    <TouchableOpacity
      accessibilityRole="button"
      testID="stop-button"
      {...touchableOpacityProps}
      onPress={handlePress}
      style={styles.stopButton(theme)}>
      <StopIcon stroke={color ?? theme.colors.onError} width={20} height={20} />
    </TouchableOpacity>
  );
};

const styles = {
  stopButton: (theme: any) =>
    StyleSheet.create({
      stopButton: {
        // §18.4 与 SendButton 同基准：36px 触区、去 marginLeft（间距由容器 gap 控制）
        // R1：controlHeight 基线
        minHeight: theme.size.controlHeight,
        minWidth: theme.size.controlHeight,
        borderRadius: theme.radius.full,
        backgroundColor: theme.colors.error,
        justifyContent: 'center' as const,
        alignItems: 'center' as const,
      },
    }).stopButton,
};
