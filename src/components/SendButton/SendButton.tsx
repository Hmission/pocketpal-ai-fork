import * as React from 'react';
import {
  GestureResponderEvent,
  TouchableOpacity,
  TouchableOpacityProps,
} from 'react-native';

import {useTheme} from '../../hooks';

import {L10nContext} from '../../utils';
import {SendIcon} from '../../assets/icons';

export interface SendButtonPropsAdditionalProps {
  touchableOpacityProps?: TouchableOpacityProps;
  color?: string;
}

export interface SendButtonProps extends SendButtonPropsAdditionalProps {
  /** Callback for send button tap event */
  onPress: () => void;
  /**
   * §18.4 双态描边统一：可用 = primary 实心圆 + onPrimary 图标；
   * 不可用 = 透明底 + outlineVariant 圆形描边 + 灰图标。
   * 状态表达收进组件内部（ChatInput 不再包 opacity 层）。
   */
  enabled?: boolean;
}

export const SendButton = ({
  onPress,
  color,
  enabled = true,
  touchableOpacityProps,
}: SendButtonProps) => {
  const l10n = React.useContext(L10nContext);
  const theme = useTheme();
  const handlePress = (event: GestureResponderEvent) => {
    onPress();
    touchableOpacityProps?.onPress?.(event);
  };

  return (
    <TouchableOpacity
      accessibilityLabel={l10n.components.sendButton.accessibilityLabel}
      accessibilityRole="button"
      testID="send-button"
      {...touchableOpacityProps}
      onPress={handlePress}
      style={styles.sendButton(theme, enabled)}>
      {theme.icons?.sendButtonIcon?.() ?? (
        <SendIcon
          stroke={
            enabled
              ? (color ?? theme.colors.onPrimary)
              : theme.colors.onSurfaceVariant
          }
          // §18.4 复查：图标 22→20 与 controlBar 快捷图标钮同尺寸（视觉高度一致），
          // 不再靠实心圆衬底撑大视觉权重
          width={20}
          height={20}
        />
      )}
    </TouchableOpacity>
  );
};

// 品牌暖黄圆形主操作（DESIGN_SPEC §1.1：primary 为魂，onPrimary 深棕图标）。
// §18.4：不可用态 = 透明底 + outlineVariant 描边（圆形轮廓恒在，状态统一）。
// 36px 触区与快捷图标钮/语音钮同基准（2026-08 大王裁定）；图标 20px 同行同尺寸。
const styles = {
  sendButton: (theme: any, enabled: boolean) => ({
    minHeight: 36,
    minWidth: 36,
    borderRadius: theme.radius.full,
    backgroundColor: enabled ? theme.colors.primary : 'transparent',
    borderWidth: theme.stroke.sm,
    borderColor: enabled ? theme.colors.primary : theme.colors.outlineVariant,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
  }),
};
