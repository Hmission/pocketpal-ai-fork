/**
 * ModelSwitchDialog — 任务模型切换确认弹窗（SPEC §9.3 → §18.7 多候选升级）
 *
 * 写作/代码任务触发模型切换时显示：候选列表（单选，默认选中推荐项）
 * + [加载所选模型] / [继续当前模型]（场景 A）/ 取消。
 * 切换 = 卸载 + 重载高代价操作 → 弹窗确认 = 决策可见 + 用户主权。
 * 选择结果由调用方（useChatScheduler）写入会话偏好（会话级记住，不跨会话）。
 *
 * 用法（命令式，Promise<ModelSwitchResult>）：
 *   const {choice, modelId} = await askModelSwitch({task, candidates});
 *   // choice: 'load' | 'current' | 'cancel'；modelId: choice='load' 时存在
 *
 * 挂载：App 根挂载 <ModelSwitchDialogHost />（与 ConfirmDialogHost 同构）。
 * Host 未挂载时返回 {choice:'cancel'}（fail-fast，不执行加载）。
 */
import * as React from 'react';
import {Modal, ScrollView, TouchableOpacity, View, Text} from 'react-native';

import {useTheme} from '../../hooks';

export type ModelSwitchChoice = 'load' | 'current' | 'cancel';

export interface ModelSwitchCandidate {
  id: string;
  /** 显示名 */
  name: string;
  /** 模型大小（bytes，GB 展示） */
  size?: number;
}

export interface ModelSwitchOptions {
  task: 'write' | 'code' | 'play';
  /** 候选列表（[0] = 推荐项，默认选中） */
  candidates: ModelSwitchCandidate[];
  /** 是否有当前模型可继续（场景 A 有 / 场景 B 无，隐藏死按钮） */
  canKeepCurrent?: boolean;
}

export interface ModelSwitchResult {
  choice: ModelSwitchChoice;
  /** 用户选中的模型（choice='load' 时存在） */
  modelId?: string;
}

interface PendingSwitch {
  opts: ModelSwitchOptions;
  resolve: (result: ModelSwitchResult) => void;
}

type Listener = (
  opts: ModelSwitchOptions,
  resolve: (result: ModelSwitchResult) => void,
) => void;

let listener: Listener | null = null;

/** 命令式确认弹窗。Host 未挂载时返回 cancel（fail-fast，不执行加载）。 */
export function askModelSwitch(
  opts: ModelSwitchOptions,
): Promise<ModelSwitchResult> {
  return new Promise(resolve => {
    if (!listener) {
      console.warn('[ModelSwitchDialog] host not mounted, treating as cancelled');
      resolve({choice: 'cancel'});
      return;
    }
    listener(opts, resolve);
  });
}

const TASK_LABEL: Record<ModelSwitchOptions['task'], string> = {
  write: '写作',
  code: '代码',
  play: '玩具',
};

/**
 * ModelSwitchDialogHost — 挂到 App 根的单例宿主，渲染当前挂起弹窗。
 * 同一时刻只显示一个弹窗（串行调用方自行 await）。
 */
export const ModelSwitchDialogHost: React.FC = () => {
  const theme = useTheme();
  const [pending, setPending] = React.useState<PendingSwitch | null>(null);
  // 当前选中候选下标（默认 0 = 推荐项）；新弹窗挂起时复位
  const [pickIdx, setPickIdx] = React.useState(0);

  React.useEffect(() => {
    listener = (opts, resolve) => {
      setPickIdx(0);
      setPending({opts, resolve});
    };
    return () => {
      listener = null;
    };
  }, []);

  const close = (result: ModelSwitchResult) => {
    pending?.resolve(result);
    setPending(null);
  };

  const candidates = pending?.opts.candidates ?? [];
  const canKeepCurrent = pending?.opts.canKeepCurrent ?? false;
  const picked = candidates[Math.min(pickIdx, Math.max(0, candidates.length - 1))];

  return (
    <Modal
      visible={pending !== null}
      transparent
      animationType="fade"
      onRequestClose={() => close({choice: 'cancel'})}>
      <TouchableOpacity
        style={{
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.35)',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 32,
        }}
        activeOpacity={1}
        onPress={() => close({choice: 'cancel'})}>
        <View
          style={{
            width: '100%',
            maxHeight: '80%',
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
            {TASK_LABEL[pending?.opts.task ?? 'write']}任务选择模型
          </Text>
          <Text
            style={{
              ...theme.typography.bodyS,
              lineHeight: 20,
              color: theme.colors.onSurfaceVariant,
            }}>
            加载会替换当前模型（数秒等待）。默认推荐第一项。
          </Text>
          <ScrollView style={{maxHeight: 280}}>
            <View style={{gap: theme.spacing.xs}}>
              {candidates.map((c, i) => {
                const selected = i === pickIdx;
                const sizeText = c.size
                  ? ` · ${(c.size / 1024 ** 3).toFixed(1)} GB`
                  : '';
                return (
                  <TouchableOpacity
                    key={c.id}
                    testID={`model-switch-candidate-${c.id}`}
                    onPress={() => setPickIdx(i)}
                    activeOpacity={0.7}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      minHeight: 44,
                      borderRadius: theme.radius.s,
                      paddingHorizontal: theme.spacing.sm,
                      borderWidth: theme.stroke.sm,
                      borderColor: selected
                        ? theme.colors.primary
                        : theme.colors.outlineVariant,
                      backgroundColor: selected
                        ? theme.colors.primary + '1F' // 12% 主色底（同模型 chip 语言）
                        : 'transparent',
                    }}>
                    <Text
                      style={{
                        ...theme.typography.uiM,
                        flex: 1,
                        fontWeight: selected ? '600' : '400',
                        color: selected
                          ? theme.colors.primary
                          : theme.colors.onSurface,
                      }}
                      numberOfLines={1}>
                      {c.name}
                      <Text
                        style={{
                          ...theme.typography.captionS,
                          color: theme.colors.onSurfaceVariant,
                        }}>
                        {sizeText}
                        {i === 0 ? ' · 推荐' : ''}
                      </Text>
                    </Text>
                    {selected && (
                      <Text style={{color: theme.colors.primary}}>✓</Text>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          </ScrollView>
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
                onPress={() => close({choice: 'current'})}
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
              onPress={() =>
                close({choice: 'load', modelId: picked?.id})
              }
              testID="model-switch-load">
              <Text
                style={{
                  ...theme.typography.uiM,
                  color: theme.colors.onPrimary,
                  fontWeight: '600',
                }}>
                加载所选模型
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </TouchableOpacity>
    </Modal>
  );
};

ModelSwitchDialogHost.displayName = 'ModelSwitchDialogHost';
