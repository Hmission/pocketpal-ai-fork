/**
 * TaskErrorCard — 调度错误卡片（2026-08-17 P0 净化：SPEC §3.3 error 叙事统一落地）
 *
 * 挂载于 ChatScreen renderTextMessage actions 槽（与 ImageTaskActions 同构）：
 * 懒切换加载模型失败的三种错误（无候选模型 / 加载失败 / 引擎忙碌）从
 * 零散 system 文本消息收敛为统一 danger 卡片 + 动作：
 *   [重试]     → onRetry(retryText)：重新走调度（输入框已清空，重发闭环）
 *   [去模型页] → code=no_model / load_failed 时的排查引导
 *
 * 锋利原则：卡片只读 metadata 渲染 + 回调透传，不直接驱动任何 store/native。
 * l10n 收口（2026-08-21）：title/detail 按 code 渲染端单点生成（L3），
 * 调度层只存 code/retryText/可选模型名，不再传文案。
 */
import * as React from 'react';
import {Text, TouchableOpacity, View, ViewStyle, TextStyle} from 'react-native';
import {observer} from 'mobx-react';

import {useTheme} from '../../hooks';
import {MessageType, Theme} from '../../utils/types';
import {withOpacity} from '../../utils/colorUtils';
import {L10nContext} from '../../utils';

export type TaskErrorCode = 'no_model' | 'load_failed' | 'busy';

export interface TaskErrorMeta {
  taskError?: {
    code: TaskErrorCode;
    /** 用户原始消息（重试 = 重新走调度发送） */
    retryText?: string;
    /** 加载失败的模型名（detail 插值用） */
    modelName?: string;
  };
}

export const TaskErrorCard: React.FC<{
  message: MessageType.Text;
  onRetry?: (text: string) => void;
  onGoModels?: () => void;
}> = observer(({message, onRetry, onGoModels}) => {
  const theme = useTheme();
  const l10n = React.useContext(L10nContext);
  const meta = (message.metadata ?? {}) as TaskErrorMeta;
  const err = meta.taskError;
  if (!err) {
    return null;
  }
  const canRetry = !!err.retryText && !!onRetry;
  const canGoModels =
    !!onGoModels && (err.code === 'no_model' || err.code === 'load_failed');
  // 渲染端按 code 单点生成（L3 收口：调度层零文案）
  const title = l10n.chat.taskErrorTitle;
  const detail =
    err.code === 'no_model'
      ? l10n.chat.taskErrorNoModelDetail
      : err.code === 'load_failed'
        ? l10n.chat.taskErrorLoadFailedDetail.replace(
            '{{name}}',
            err.modelName ?? '',
          )
        : l10n.chat.taskErrorBusyDetail;

  return (
    <View style={styles.wrap} testID="task-error-card">
      <View style={styles.card(theme)}>
        <Text style={styles.title(theme)}>{title}</Text>
        <Text style={styles.detail(theme)}>{detail}</Text>
      </View>
      {(canRetry || canGoModels) && (
        <View style={styles.row}>
          {canRetry && (
            <TouchableOpacity
              testID="task-error-retry"
              onPress={() => onRetry(err.retryText!)}
              style={[styles.chip(theme), {borderColor: theme.colors.danger}]}>
              <Text style={[styles.chipText(theme), {color: theme.colors.danger}]}>
                {l10n.common.retry}
              </Text>
            </TouchableOpacity>
          )}
          {canGoModels && (
            <TouchableOpacity
              testID="task-error-go-models"
              onPress={onGoModels}
              style={[
                styles.chip(theme),
                {borderColor: theme.colors.primary},
              ]}>
              <Text
                style={[styles.chipText(theme), {color: theme.colors.primary}]}>
                {l10n.chat.goToModels}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );
});

const styles: {
  wrap: ViewStyle;
  card: (theme: Theme) => ViewStyle;
  title: (theme: Theme) => TextStyle;
  detail: (theme: Theme) => TextStyle;
  row: ViewStyle;
  chip: (theme: Theme) => ViewStyle;
  chipText: (theme: Theme) => TextStyle;
} = {
  wrap: {
    marginTop: 6,
    marginLeft: 12,
  },
  card: theme => ({
    backgroundColor: withOpacity(theme.colors.danger, 0.08),
    borderRadius: theme.radius.m,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    borderLeftWidth: 3,
    borderLeftColor: theme.colors.danger,
  }),
  title: theme => ({
    ...theme.typography.captionM,
    fontWeight: '600',
    color: theme.colors.danger,
  }),
  detail: theme => ({
    ...theme.typography.captionM,
    color: theme.colors.textSecondary,
    lineHeight: 16,
    marginTop: 2,
  }),
  row: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 6,
  },
  chip: theme => ({
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xxs + 1,
    borderRadius: theme.radius.full,
    borderWidth: 1,
  }),
  chipText: theme => ({
    ...theme.typography.captionM,
    fontWeight: '600',
  }),
};
