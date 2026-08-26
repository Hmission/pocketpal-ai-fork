/**
 * InfoDialog 命令式 API（与呈现层拆分）
 *
 * 拆分原因（2026-08-26 B58）：与 ConfirmDialog 同理——infoDialog 被工具层
 * 引用时不得拉呈现组件链（hooks → theme → react-native-paper）。
 * 本文件零 React 依赖；Host 经 register 挂接。
 */
export interface InfoDialogOptions {
  title: string;
  /** 正文，缺省仅标题（对齐 Alert.alert(title) 单参形态） */
  message?: string;
  /** 主按钮文案，缺省「知道了」 */
  buttonText?: string;
}

type Listener = (opts: InfoDialogOptions, resolve: () => void) => void;

let listener: Listener | null = null;

/** Host 挂接（App 根 InfoDialogHost 挂载时调用）；返回注销函数。 */
export function registerInfoDialogListener(fn: Listener): () => void {
  listener = fn;
  return () => {
    listener = null;
  };
}

/** 命令式信息弹窗。Host 未挂载时静默 resolve（fail-soft，信息无破坏性）。 */
export function infoDialog(opts: InfoDialogOptions): Promise<void> {
  return new Promise(resolve => {
    if (!listener) {
      console.warn('[InfoDialog] host not mounted, resolving silently');
      resolve();
      return;
    }
    listener(opts, resolve);
  });
}
