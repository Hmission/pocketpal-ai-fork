/**
 * ModelSwitchDialog — 任务模型切换确认弹窗（SPEC §9.3，2026-08-17 大王钦定）
 *
 * 写作/代码任务触发模型切换时显示：[加载推荐模型] / [继续当前模型] / 取消。
 * 切换 = 卸载 + 重载 3GB 高代价操作 → 弹窗确认 = 决策可见 + 用户主权。
 * 选择结果由调用方（useChatScheduler）写入会话偏好（会话级记住，不跨会话）。
 *
 * 用法（命令式，Promise<ModelSwitchChoice>）：
 *   const choice = await askModelSwitch({task, candidateName});
 *   // 'load' | 'current' | 'cancel'
 *
 * 挂载：App 根挂载 <ModelSwitchDialogHost />（与 ConfirmDialogHost 同构）。
 * Host 未挂载时返回 'cancel'（fail-fast，不执行加载）。
 */
import * as React from 'react';
import {Modal, TouchableOpacity, View, Text} from 'react-native';

import {useTheme} from '../../hooks';

export type ModelSwitchChoice = 'load' | 'current' | 'cancel';

export interface ModelSwitchOptions {
  task: 'write' | 'code';
  /** 推荐模型显示名 */
  candidateName: string;
  /** 推荐模型大小（GB 展示） */
  candidateSize?: number;
  /** 是否有当前模型可继续（场景 A 有 / 场景 B 无，隐藏死按钮） */
  canKeepCurrent?: boolean;
}

interface PendingSwitch {
  opts: ModelSwitchOptions;
  resolve: (choice: ModelSwitchChoice) => void;
}

type Listener = (
  opts: ModelSwitchOptions,
  resolve: (choice: ModelSwitchChoice) => void,
) => void;

let listener: Listener | null = null;

/** 命令式确认弹窗。Host 未挂载时返回 'cancel'（fail-fast，不执行加载）。 */
export function askModelSwitch(opts: ModelSwitchOptions): Promise<ModelSwitchChoice> {
  return new Promise(resolve => {
    if (!listener) {
      console.warn('[ModelSwitchDialog] host not mounted, treating as cancelled');
      resolve('cancel');
      return;
    }
    listener(opts, resolve);
  });
}

const TASK_LABEL: Record<ModelSwitchOptions['task'], string> = {
  write: '写作',
  code: '代码',
};

/**
 * ModelSwitchDialogHost — 挂到 App 根的单例宿主，渲染当前挂起弹窗。
 * 同一时刻只显示一个弹窗（串行调用方自行 await）。
 */
export const ModelSwitchDialogHost: React.FC = () => {
  const theme = useTheme();
  const [pending, setPending] = React.useState<PendingSwitch | null>(null);

  React.useEffect(() => {
    listener = (opts, resolve) => setPending({opts, resolve});
    return () => {
      listener = null;
    };
  }, []);

  const close = (choice: ModelSwitchChoice) => {
    pending?.resolve(choice);
    setPending(null);
  };

  const sizeText = pending?.opts.candidateSize
    ? `（${(pending.opts.candidateSize / 1024 ** 3).toFixed(1)} GB）`
    : '';
  const canKeepCurrent = pending?.opts.canKeepCurrent ?? false;

  return (
    <Modal
      visible={pending !== null}
      transparent
      animationType="fade"
      onRequestClose={() => close('cancel')}>
      <TouchableOpacity
        style={{
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.35)',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 32,
        }}
        activeOpacity={1}
        onPress={() => close('cancel')}>
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
            {TASK_LABEL[pending?.opts.task ?? 'write']}任务推荐模型
          </Text>
          <Text
            style={{
              ...theme.typography.bodyS,
              lineHeight: 20,
              color: theme.colors.onSurfaceVariant,
            }}>
            推荐使用「{pending?.opts.candidateName}」{sizeText}，加载它会替换当前模型（数秒等待）。
          </Text>
          <View
            style={{
              flexDirection: 'row',
              gap: theme.spacing.s,
              marginTop: theme.spacing.xs,
            }}>
            {canKeepCurrent && (
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
                onPress={() => close('current')}
                testID="model-switch-current">
                <Text
                  style={{
                    ...theme.typography.uiM,
                    color: theme.colors.onSurface,
                  }}>
                  继续当前模型
                </Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={{
                flex: 1,
                height: 44,
                borderRadius: theme.radius.s,
                backgroundColor: theme.colors.primary,
                alignItems: 'center',
                justifyContent: 'center',
              }}
              onPress={() => close('load')}
              testID="model-switch-load">
              <Text
                style={{
                  ...theme.typography.uiM,
                  color: theme.colors.onPrimary,
                  fontWeight: '600',
                }}>
                加载推荐模型
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </TouchableOpacity>
    </Modal>
  );
};

ModelSwitchDialogHost.displayName = 'ModelSwitchDialogHost';
