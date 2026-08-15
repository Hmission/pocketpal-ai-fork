/**
 * ConfirmDialog — 全局确认弹窗体系（替代系统 Alert.alert 确认框）
 *
 * 统一设计语言：居中卡片式（surface 底色、圆角 12、主色/警示色按钮），
 * 深浅色模式自适应，视觉与 App 卡片体系一致（禁用系统黑色半透明弹窗）。
 *
 * 用法（命令式，Promise<boolean>，true=确认）：
 *   const ok = await confirmDialog({title, message, destructive: true});
 *   if (ok) { ... }
 *
 * 挂载：App 根挂载 <ConfirmDialogHost />（自管 Modal，不依赖既有 provider 栈）。
 * Host 未挂载时 confirmDialog 返回 false（fail-fast，破坏性操作不执行）。
 */
import * as React from 'react';
import {Modal, TouchableOpacity, View, Text} from 'react-native';

import {useTheme} from '../../hooks';

export interface ConfirmDialogOptions {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  /** 破坏性操作：确认按钮用警示红 */
  destructive?: boolean;
}

interface PendingDialog {
  opts: ConfirmDialogOptions;
  resolve: (confirmed: boolean) => void;
}

type Listener = (
  opts: ConfirmDialogOptions,
  resolve: (confirmed: boolean) => void,
) => void;

let listener: Listener | null = null;

/** 命令式确认弹窗。Host 未挂载时返回 false（按取消处理，fail-fast）。 */
export function confirmDialog(opts: ConfirmDialogOptions): Promise<boolean> {
  return new Promise(resolve => {
    if (!listener) {
      console.warn('[ConfirmDialog] host not mounted, treating as cancelled');
      resolve(false);
      return;
    }
    listener(opts, resolve);
  });
}

/**
 * ConfirmDialogHost — 挂到 App 根的单例宿主，渲染当前挂起弹窗。
 * 同一时刻只显示一个弹窗（串行调用方自行 await）。
 */
export const ConfirmDialogHost: React.FC = () => {
  const theme = useTheme();
  const [pending, setPending] = React.useState<PendingDialog | null>(null);

  React.useEffect(() => {
    listener = (opts, resolve) => setPending({opts, resolve});
    return () => {
      listener = null;
    };
  }, []);

  const close = (confirmed: boolean) => {
    pending?.resolve(confirmed);
    setPending(null);
  };

  const destructive = pending?.opts.destructive ?? false;
  const confirmColor = destructive ? theme.colors.error : theme.colors.primary;
  const onConfirmColor = destructive
    ? theme.colors.onError
    : theme.colors.onPrimary;

  return (
    <Modal
      visible={pending !== null}
      transparent
      animationType="fade"
      onRequestClose={() => close(false)}>
      <TouchableOpacity
        style={{
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.35)',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 32,
        }}
        activeOpacity={1}
        onPress={() => close(false)}>
        <View
          style={{
            width: '100%',
            backgroundColor: theme.colors.surfaceElevated,
            borderRadius: theme.radius.ml,
            padding: theme.spacing.ml,
            gap: theme.spacing.sm,
            elevation: 4,
          }}>
          <Text
            style={{
              ...theme.typography.titleS,
              fontWeight: '600',
              color: theme.colors.onSurface,
            }}>
            {pending?.opts.title}
          </Text>
          <Text
            style={{
              ...theme.typography.bodyS,
              lineHeight: 20,
              color: theme.colors.onSurfaceVariant,
            }}>
            {pending?.opts.message}
          </Text>
          <View
            style={{
              flexDirection: 'row',
              gap: theme.spacing.s,
              marginTop: theme.spacing.xs,
            }}>
            <TouchableOpacity
              style={{
                flex: 1,
                height: 44,
                borderRadius: theme.radius.s,
                borderWidth: theme.stroke.sm,
                borderColor: theme.colors.outline,
                alignItems: 'center',
                justifyContent: 'center',
              }}
              onPress={() => close(false)}
              testID="confirm-dialog-cancel">
              <Text
                style={{
                  ...theme.typography.uiM,
                  color: theme.colors.onSurface,
                }}>
                {pending?.opts.cancelText ?? '取消'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={{
                flex: 1,
                height: 44,
                borderRadius: theme.radius.s,
                backgroundColor: confirmColor,
                alignItems: 'center',
                justifyContent: 'center',
              }}
              onPress={() => close(true)}
              testID="confirm-dialog-confirm">
              <Text
                style={{
                  ...theme.typography.uiM,
                  color: onConfirmColor,
                  fontWeight: '600',
                }}>
                {pending?.opts.confirmText ?? '确认'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </TouchableOpacity>
    </Modal>
  );
};

ConfirmDialogHost.displayName = 'ConfirmDialogHost';
