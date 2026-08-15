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
}

export const SendButton = ({
  onPress,
  color,
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
      style={styles.sendButton(theme)}>
      {theme.icons?.sendButtonIcon?.() ?? (
        <SendIcon
          stroke={color ?? theme.colors.onPrimary}
          width={22}
          height={22}
        />
      )}
    </TouchableOpacity>
  );
};

// 品牌暖黄圆形主操作（DESIGN_SPEC §1.1：primary 为魂，onPrimary 深棕图标）。
// 禁用态由 ChatInput 外层 opacity 0.4 表达，容器本身保持品牌色。
const styles = {
  sendButton: (theme: any) => ({
    marginLeft: theme.spacing.m,
    minHeight: 44,
    minWidth: 44,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.primary,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
  }),
};
