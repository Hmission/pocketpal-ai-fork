/**
 * ConfirmDialog 命令式 API（与呈现层拆分）
 *
 * 拆分原因（2026-08-26 B58）：命令式弹窗函数（confirmDialog）被工具层
 * （utils/exportUtils、utils/androidPermission 等）引用；若与呈现组件
 * （ConfirmDialogHost → hooks → theme → react-native-paper）同文件，
 * utils 的纯 Jest 环境在 import 期即拉爆呈现链（Platform.select 缺失崩溃）。
 * — 本文件零 React 依赖，任意层可安全 import；Host 经 register 挂接。
 */
export interface ConfirmDialogOptions {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  /** 破坏性操作：确认按钮用警示红 */
  destructive?: boolean;
}

type Listener = (
  opts: ConfirmDialogOptions,
  resolve: (confirmed: boolean) => void,
) => void;

let listener: Listener | null = null;

/** Host 挂接（App 根 ConfirmDialogHost 挂载时调用）；返回注销函数。 */
export function registerConfirmDialogListener(fn: Listener): () => void {
  listener = fn;
  return () => {
    listener = null;
  };
}

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
