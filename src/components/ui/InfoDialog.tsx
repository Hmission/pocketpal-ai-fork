/**
 * InfoDialog — 全局信息弹窗体系（替代系统 Alert.alert 单按钮信息框）
 *
 * 统一设计语言：与 ConfirmDialog 同构（DESIGN_SPEC §12.1 OverlayCard 底座：
 * backdrop 遮罩 + surfaceElevated + xl 圆角 + elevation 8 + ui/Button 操作区），
 * 深浅色模式自适应，视觉与 App 卡片体系一致（禁用系统黑色半透明弹窗）。
 *
 * 命令式 API（infoDialog）已拆至 ./InfoDialog/api（B58：零 React 依赖，
 * 工具层可安全 import）；Host 经 registerInfoDialogListener 挂接。
 *
 * 挂载：App 根挂载 <InfoDialogHost />（自管 Modal，不依赖既有 provider 栈）。
 * Host 未挂载时静默 resolve（信息型无破坏性，fail-soft）。
 */
import * as React from 'react';
import {StyleSheet, Text} from 'react-native';

import {useTheme} from '../../hooks/useTheme';
import type {Theme} from '../../utils/types';
import {OverlayCard} from './OverlayCard';
import {InfoDialogOptions, registerInfoDialogListener} from './InfoDialog/api';

export {infoDialog} from './InfoDialog/api';
export type {InfoDialogOptions} from './InfoDialog/api';

interface PendingDialog {
  opts: InfoDialogOptions;
  resolve: () => void;
}

/**
 * InfoDialogHost — 挂到 App 根的单例宿主，渲染当前挂起弹窗。
 * 同一时刻只显示一个弹窗（与 ConfirmDialogHost 串行语义一致）。
 */
export const InfoDialogHost: React.FC = () => {
  const theme = useTheme();
  const styles = React.useMemo(() => createStyles(theme), [theme]);
  const [pending, setPending] = React.useState<PendingDialog | null>(null);

  React.useEffect(() => {
    const unregister = registerInfoDialogListener((opts, resolve) =>
      setPending({opts, resolve}),
    );
    return unregister;
  }, []);

  const close = () => {
    pending?.resolve();
    setPending(null);
  };

  return (
    <OverlayCard
      visible={pending !== null}
      onRequestClose={close}
      title={pending?.opts.title}
      actions={{
        primary: {
          label: pending?.opts.buttonText ?? '知道了',
          onPress: close,
        },
      }}>
      {pending?.opts.message ? (
        <Text style={styles.message}>{pending?.opts.message}</Text>
      ) : null}
    </OverlayCard>
  );
};

InfoDialogHost.displayName = 'InfoDialogHost';

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    message: {
      ...theme.typography.bodyS,
      lineHeight: 20,
      color: theme.colors.onSurfaceVariant,
    },
  });
