/**
 * ModelSwitchDialog — 任务模型切换确认弹窗（SPEC §9.3 → §18.7 多候选）
 *
 * 写作/代码任务触发模型切换时显示：任务族候选列表（单选，默认推荐项，
 * 每个候选带一句话推荐说明——差异可决策，不是裸清单）
 * + [加载所选模型] / [继续当前模型]（场景 A）/ 取消。
 *
 * §18.7 复查（2026-08-20 大王复核）：加载在弹窗内完成——确认后弹窗保持
 * 遮罩（Modal 全屏模态 → 其他交互天然阻塞），按钮转「正在加载…」态，
 * 加载完成/失败才关闭并恢复。受影响的按钮（发送/切换入口）在加载期
 * 不可操作，符合移动端重量级操作最佳实践。
 *
 * 用法（命令式，Promise<ModelSwitchResult>）：
 *   const {choice, modelId} = await askModelSwitch({task, candidates, onLoad});
 *   // choice: 'load' | 'current' | 'cancel'；modelId: choice='load' 时存在
 *   // onLoad: 用户在弹窗内点「加载所选模型」后由 Host 调用；完成自动关，
 *   //         抛错则弹窗显示失败态（可取消/重试），不静默。
 *
 * 挂载：App 根挂载 <ModelSwitchDialogHost />（与 ConfirmDialogHost 同构）。
 * Host 未挂载时返回 {choice:'cancel'}（fail-fast，不执行加载）。
 *
 * 渲染底座：ui/OverlayCard（DESIGN_SPEC §12.1）；操作区走 ui/Button。
 */
import * as React from 'react';
import {
  Animated,
  ScrollView,
  TouchableOpacity,
  View,
  Text,
} from 'react-native';

import {useTheme} from '../../hooks';
import {useWaveDots} from '../../screens/ImageGenScreen/hooks/useWaveDots';
import {withOpacity} from '../../utils/colorUtils';
import {OverlayCard} from './OverlayCard';
import {Button} from './Button';
import {CheckMdIcon} from '../../assets/icons';

export type ModelSwitchChoice = 'load' | 'current' | 'cancel';

export interface ModelSwitchCandidate {
  id: string;
  /** 显示名 */
  name: string;
  /** 模型大小（bytes，GB 展示） */
  size?: number;
  /** §18.7 一句话推荐说明（MODEL_MATRIX 定位 / 大小档位） */
  note?: string;
}

export interface ModelSwitchOptions {
  task: 'write' | 'code' | 'play';
  /** 任务族候选列表（[0] = 推荐项，默认选中） */
  candidates: ModelSwitchCandidate[];
  /** 是否有当前模型可继续（场景 A 有 / 场景 B 无，隐藏死按钮） */
  canKeepCurrent?: boolean;
  /**
   * §18.7 弹窗内加载钩子：用户在弹窗内点「加载所选模型」后调用。
   * resolve 或 throw 均自动关闭弹窗并恢复交互；throw 前弹窗短暂显示失败态。
   */
  onLoad?: (modelId: string) => Promise<void>;
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
  // §18.7：加载中（弹窗内完成，遮罩保持阻塞）+ 失败态（可取消/重试）
  const [loading, setLoading] = React.useState(false);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  // 加载动效（与生图任务卡 ImageTaskProgress 同款）：三点波浪 + 底条，
  // 加载期跳动提示，用户能感知加载在进行而非卡死。
  const waveDots = useWaveDots(loading);

  React.useEffect(() => {
    listener = (opts, resolve) => {
      setPickIdx(0);
      setLoading(false);
      setLoadError(null);
      setPending({opts, resolve});
    };
    return () => {
      listener = null;
    };
  }, []);

  const close = (result: ModelSwitchResult) => {
    pending?.resolve(result);
    setPending(null);
    setLoading(false);
    setLoadError(null);
  };

  const candidates = pending?.opts.candidates ?? [];
  const canKeepCurrent = pending?.opts.canKeepCurrent ?? false;
  const picked = candidates[Math.min(pickIdx, Math.max(0, candidates.length - 1))];

  // §18.7：确认后在弹窗内加载——遮罩保持（其他交互阻塞），
  // 完成/失败自动关并恢复；失败显示原因，不静默。
  const handleLoad = async () => {
    if (!picked || !pending) {
      return;
    }
    setLoading(true);
    setLoadError(null);
    try {
      await pending.opts.onLoad?.(picked.id);
      close({choice: 'load', modelId: picked.id});
    } catch (e) {
      setLoadError(
        `加载失败：${(e as Error)?.message ?? '未知错误'}（可取消或重试）`,
      );
      setLoading(false);
    }
  };

  return (
    <OverlayCard
      visible={pending !== null}
      onRequestClose={() => {
        if (!loading) {
          close({choice: 'cancel'});
        }
      }}
      title={`${TASK_LABEL[pending?.opts.task ?? 'write']}任务选择模型`}>
      {loading ? (
        // §18.7 加载态：遮罩保持（交互阻塞），按钮全禁，完成后自动关。
        // 动效与生图任务卡统一（三点波浪 + 2% 底条）：模型加载无确定进度，
        // 跳动提示让用户感知加载在进行而非卡死。
        <View
          style={{
            alignItems: 'center',
            gap: theme.spacing.sm,
            paddingVertical: theme.spacing.m,
          }}
          testID="model-switch-loading">
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
              height: 24,
            }}>
            {waveDots.map((dot, i) => (
              <Animated.View
                key={i}
                style={[
                  {
                    width: 8,
                    height: 8,
                    borderRadius: 4,
                    backgroundColor: theme.colors.primary,
                  },
                  {
                    transform: [
                      {
                        translateY: dot.interpolate({
                          inputRange: [0, 1],
                          outputRange: [0, -6],
                        }),
                      },
                    ],
                    opacity: dot.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.45, 1],
                    }),
                  },
                ]}
              />
            ))}
          </View>
          <Text
            numberOfLines={1}
            ellipsizeMode="tail"
            style={{
              ...theme.typography.bodyS,
              color: theme.colors.onSurfaceVariant,
              paddingHorizontal: theme.spacing.m,
            }}>
            正在加载「{picked?.name}」…
          </Text>
          <View
            style={{
              width: '70%',
              height: 6,
              borderRadius: theme.radius.xxs,
              backgroundColor: withOpacity(theme.colors.shadow, 0.08),
              overflow: 'hidden',
            }}>
            <View
              style={{
                height: '100%',
                width: '2%',
                backgroundColor: theme.colors.primary,
                borderRadius: theme.radius.xxs,
              }}
            />
          </View>
          <Text
            style={{
              ...theme.typography.captionS,
              color: theme.colors.onSurfaceVariant,
            }}>
            切换会替换当前模型，请稍候
          </Text>
        </View>
      ) : (
        <>
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
                    <View style={{flex: 1}}>
                      <Text
                        style={{
                          ...theme.typography.uiM,
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
                      {/* §18.7 一句话推荐说明：差异可决策 */}
                      {c.note ? (
                        <Text
                          style={{
                            ...theme.typography.captionS,
                            color: theme.colors.onSurfaceVariant,
                            marginTop: 2,
                          }}
                          numberOfLines={1}>
                          {c.note}
                        </Text>
                      ) : null}
                    </View>
                    {selected && (
                      <CheckMdIcon
                        width={20}
                        height={20}
                        stroke={theme.colors.primary}
                      />
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          </ScrollView>

          {loadError ? (
            <Text
              style={{
                ...theme.typography.captionS,
                color: theme.colors.error,
              }}
              testID="model-switch-load-error">
              {loadError}
            </Text>
          ) : null}

          <View
            style={{
              flexDirection: 'row',
              gap: theme.spacing.s,
              marginTop: theme.spacing.xs,
            }}>
            {canKeepCurrent && (
              <Button
                variant="secondary"
                label="继续当前模型"
                onPress={() => close({choice: 'current'})}
                testID="model-switch-current"
                style={{flex: 1}}
              />
            )}
            <Button
              variant="primary"
              label="加载所选模型"
              onPress={handleLoad}
              testID="model-switch-load"
              style={{flex: 1}}
            />
          </View>
        </>
      )}
    </OverlayCard>
  );
};

ModelSwitchDialogHost.displayName = 'ModelSwitchDialogHost';
