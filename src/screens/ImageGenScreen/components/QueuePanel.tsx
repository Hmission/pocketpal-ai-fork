/**
 * QueuePanel — 任务购物车队列面板（IMAGEGEN_QUEUE_SPEC §七）
 * OverlayCard 唯一底座；条目行 = prompt 摘要 + 模型族徽章 + 抽数/状态徽标。
 * 全只读 props 渲染（编排层注入）；执行期锁定编辑/删除（锋利：锁定即锁定）。
 */
import * as React from 'react';
import {ScrollView, Text, TouchableOpacity, View} from 'react-native';

import {useTheme} from '../../../hooks';
import {OverlayCard} from '../../../components/ui/OverlayCard';
import {QueueItem, QueueState} from '../../../store/imageGenQueueCore';

export interface QueuePanelProps {
  visible: boolean;
  onRequestClose: () => void;
  items: QueueItem[];
  state: QueueState;
  position: number;
  totalDraws: number;
  drawsDone: number;
  drawsFailed: number;
  /** 单通道占用（loading/generating）——开始按钮禁用 */
  busy: boolean;
  onStart: () => void;
  onStop: () => void;
  onClear: () => void;
  onRemove: (id: string) => void;
  onEdit: (item: QueueItem) => void;
}

/** 模型族徽章语义色（与生图页下拉同源约定） */
const FAMILY_COLORS: Record<string, string> = {
  dreamlite: '#4CAF50',
  sd3: '#9C27B0',
  zimage: '#00BCD4',
  classic: '#FF9800',
};

const STATE_LABEL: Record<QueueState, string> = {
  idle: '空队列',
  planning: '规划中',
  running: '执行中',
  stopping: '停止中…',
  done: '已完成',
};

export const QueuePanel: React.FC<QueuePanelProps> = ({
  visible,
  onRequestClose,
  items,
  state,
  position,
  totalDraws: _totalDraws,
  drawsDone,
  drawsFailed,
  busy,
  onStart,
  onStop,
  onClear,
  onRemove,
  onEdit,
}) => {
  const theme = useTheme();
  const s = createStyles(theme);
  const locked = state === 'running' || state === 'stopping';
  const stopping = state === 'stopping';
  const remainingDraws = items.reduce(
    (a, b) => a + (b.total - b.done - b.failed),
    0,
  );

  return (
    <OverlayCard
      visible={visible}
      onRequestClose={onRequestClose}
      title={`任务购物车 · ${STATE_LABEL[state]}`}
      testID="imagegen-queue-panel"
      actions={
        state === 'running' || stopping
          ? {
              primary: {
                label: stopping ? '停止中…' : '停止队列',
                onPress: onStop,
                disabled: stopping,
                destructive: true,
                testID: 'queue-stop',
              },
            }
          : state === 'done'
            ? {
                primary: {
                  label: '关闭',
                  onPress: onRequestClose,
                  testID: 'queue-close',
                },
                secondary: {
                  label: '清空队列',
                  onPress: onClear,
                  testID: 'queue-clear',
                },
              }
            : {
                primary: {
                  label: `开始队列（${items.length} 项 · ${remainingDraws} 抽）`,
                  onPress: onStart,
                  disabled: busy || items.length === 0,
                  testID: 'queue-start',
                },
              }
      }>
      {items.length === 0 ? (
        <Text style={s.emptyText}>队列为空——点「➕」把当前参数加入队列</Text>
      ) : (
        <View style={s.listWrap}>
          {locked || state === 'done' ? (
            <Text style={s.progressText}>
              已完成 {drawsDone} 成功 · {drawsFailed} 失败
              {state === 'running' && items[position]
                ? `｜第 ${position + 1}/${items.length} 项`
                : ''}
            </Text>
          ) : null}
          <ScrollView>
            {items.map((item, i) => {
              const doneAll = item.done + item.failed >= item.total;
              const remaining = item.total - item.done - item.failed;
              return (
                <TouchableOpacity
                  key={item.id}
                  disabled={locked}
                  onPress={() => onEdit(item)}
                  style={[
                    s.itemRow,
                    doneAll && item.status !== 'pending' ? s.itemRowDone : null,
                  ]}
                  testID={`queue-item-${i}`}>
                  <View style={s.itemBody}>
                    <Text numberOfLines={1} style={s.itemPrompt}>
                      {item.snapshot.prompt || '（空提示词）'}
                    </Text>
                    <Text numberOfLines={1} style={s.itemMeta}>
                      {item.snapshot.modelId} · {item.snapshot.width}×
                      {item.snapshot.height}
                      {item.snapshot.steps
                        ? ` · ${item.snapshot.steps} 步`
                        : ''}
                    </Text>
                  </View>
                  <View
                    style={[
                      s.badge,
                      {
                        backgroundColor:
                          FAMILY_COLORS[item.snapshot.family] ??
                          theme.colors.info,
                      },
                    ]}>
                    <Text style={s.badgeText}>{item.snapshot.family}</Text>
                  </View>
                  <Text style={s.draws}>{doneAll ? '✓' : `${remaining}×`}</Text>
                  {!locked && (
                    <TouchableOpacity
                      onPress={() => onRemove(item.id)}
                      hitSlop={{top: 8, bottom: 8, left: 8, right: 8}}
                      testID={`queue-remove-${i}`}>
                      <Text style={s.remove}>✕</Text>
                    </TouchableOpacity>
                  )}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      )}
    </OverlayCard>
  );
};

/** 队列面板样式（theme 驱动；跟随项目 createStyles 模式，禁止 inline style） */
function createStyles(theme: ReturnType<typeof useTheme>) {
  return {
    emptyText: {
      paddingVertical: 24,
      textAlign: 'center' as const,
      color: theme.colors.textSecondary,
    },
    listWrap: {
      maxHeight: 360,
    },
    progressText: {
      paddingBottom: 8,
      fontSize: 12,
      color: theme.colors.textSecondary,
    },
    itemRow: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      paddingVertical: 10,
      paddingHorizontal: 4,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    itemRowDone: {
      opacity: 0.6,
    },
    itemBody: {
      flex: 1,
      marginRight: 8,
    },
    itemPrompt: {
      fontSize: 14,
    },
    itemMeta: {
      fontSize: 11,
      color: theme.colors.textSecondary,
      marginTop: 2,
    },
    badge: {
      marginRight: 6,
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 4,
    },
    badgeText: {
      fontSize: 10,
      color: '#FFFFFF',
    },
    draws: {
      minWidth: 28,
      textAlign: 'center' as const,
      fontSize: 13,
      fontWeight: '700' as const,
      color: theme.colors.onSurface,
    },
    remove: {
      fontSize: 14,
      color: theme.colors.error,
      paddingHorizontal: 8,
    },
  };
}
