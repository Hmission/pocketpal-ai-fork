import * as React from 'react';
import {Modal, Text, TouchableOpacity, View} from 'react-native';

import {useTheme} from '../../../hooks/useTheme';
import {Actions, type ActionsProps} from './Actions';
import {createStyles} from './styles';

export type OverlayCardProps = {
  visible: boolean;
  onRequestClose?: () => void;
  /** 本地化遮罩关闭语义标签（l10n.common.dismiss 等）；缺省时按通用关闭处理 */
  dismissAccessibilityLabel?: string;
  title?: string;
  children?: React.ReactNode;
  /** 操作区：primary/secondary（ui/Button 体系），缺省不渲染 */
  actions?: ActionsProps;
  testID?: string;
  style?: React.ComponentProps<typeof View>['style'];
};

/**
 * DS OverlayCard — 居中卡弹窗唯一底座（DESIGN_SPEC §12.1）。
 *
 * 契约：遮罩 theme.colors.backdrop + surfaceElevated +
 * radius[shapeRoles.surface](xl 32) + elevation 8 + titleS 标题 + Actions 槽。
 * 内容区由调用方自由组合（滚动/列表/表单），底座不兜底。
 * 新增居中卡弹窗一律走本组件，禁止手写裸 RN Modal。
 */
export const OverlayCard: React.FC<OverlayCardProps> = ({
  visible,
  onRequestClose,
  dismissAccessibilityLabel,
  title,
  children,
  actions,
  testID = 'ui-overlay-card',
  style,
}) => {
  const theme = useTheme();
  const styles = createStyles(theme);
  if (!visible) {
    return null;
  }
  return (
    <Modal
      visible
      transparent
      animationType="fade"
      onRequestClose={onRequestClose}>
      <TouchableOpacity
        testID="ui-overlay-card-scrim"
        style={styles.overlay}
        activeOpacity={1}
        accessibilityLabel={dismissAccessibilityLabel}
        accessibilityRole="button"
        onPress={onRequestClose}>
        <TouchableOpacity
          testID={testID}
          style={[styles.card, style]}
          activeOpacity={1}
          onPress={() => {}}>
          {title ? <Text style={styles.title}>{title}</Text> : null}
          {children}
          {actions && <Actions {...actions} />}
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
};

export {Actions};
export type {ActionsProps, ActionConfig} from './Actions';
