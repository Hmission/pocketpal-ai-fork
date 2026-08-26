/**
 * ConfirmDialog — 全局确认弹窗体系（替代系统 Alert.alert 确认框）
 *
 * 统一设计语言：居中卡片式（DESIGN_SPEC §12.1 OverlayCard 底座：
 * backdrop 遮罩 + surfaceElevated + xl 圆角 + elevation 8 + ui/Button 操作区），
 * 深浅色模式自适应，视觉与 App 卡片体系一致（禁用系统黑色半透明弹窗）。
 *
 * 命令式 API（confirmDialog）已拆至 ./ConfirmDialog/api（B58：零 React 依赖，
 * 工具层可安全 import）；Host 经 registerConfirmDialogListener 挂接。
 *
 * 挂载：App 根挂载 <ConfirmDialogHost />（自管 Modal，不依赖既有 provider 栈）。
 * Host 未挂载时 confirmDialog 返回 false（fail-fast，破坏性操作不执行）。
 */
import * as React from 'react';
import {StyleSheet, Text} from 'react-native';

import {useTheme} from '../../hooks/useTheme';
import type {Theme} from '../../utils/types';
import {OverlayCard} from './OverlayCard';
import {
  ConfirmDialogOptions,
  registerConfirmDialogListener,
} from './ConfirmDialog/api';

export {confirmDialog} from './ConfirmDialog/api';
export type {ConfirmDialogOptions} from './ConfirmDialog/api';

interface PendingDialog {
  opts: ConfirmDialogOptions;
  resolve: (confirmed: boolean) => void;
}

/**
 * ConfirmDialogHost — 挂到 App 根的单例宿主，渲染当前挂起弹窗。
 * 同一时刻只显示一个弹窗（串行调用方自行 await）。
 */
export const ConfirmDialogHost: React.FC = () => {
  const theme = useTheme();
  const styles = React.useMemo(() => createStyles(theme), [theme]);
  const [pending, setPending] = React.useState<PendingDialog | null>(null);

  React.useEffect(() => {
    const unregister = registerConfirmDialogListener((opts, resolve) =>
      setPending({opts, resolve}),
    );
    return unregister;
  }, []);

  const close = (confirmed: boolean) => {
    pending?.resolve(confirmed);
    setPending(null);
  };

  return (
    <OverlayCard
      visible={pending !== null}
      onRequestClose={() => close(false)}
      title={pending?.opts.title}
      actions={{
        secondary: {
          label: pending?.opts.cancelText ?? '取消',
          onPress: () => close(false),
        },
        primary: {
          label: pending?.opts.confirmText ?? '确认',
          destructive: pending?.opts.destructive ?? false,
          onPress: () => close(true),
        },
      }}>
      <Text style={styles.message}>{pending?.opts.message}</Text>
    </OverlayCard>
  );
};

ConfirmDialogHost.displayName = 'ConfirmDialogHost';

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    message: {
      ...theme.typography.bodyS,
      lineHeight: 20,
      color: theme.colors.onSurfaceVariant,
    },
  });
