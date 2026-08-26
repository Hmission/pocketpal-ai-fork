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
import {Text, View, ViewStyle, TextStyle} from 'react-native';
import {observer} from 'mobx-react';

import {useTheme} from '../../hooks/useTheme';
import {MessageType, Theme} from '../../utils/types';
import {withOpacity} from '../../utils/colorUtils';
import {L10nContext} from '../../utils';
import {Chip} from '../ui/Chip';

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
          {/* B57：动作胶囊收敛到 DS Chip outline（语义色归一：
          color=danger → theme.colors.error，描边/文本同色；
          size=s 对齐动作胶囊样板；无障碍 label 由 label 自动承载） */}
          {canRetry && (
            <Chip
              testID="task-error-retry"
              variant="outline"
              color={err.code === 'busy' ? 'danger' : 'primary'}
              size="s"
              label={l10n.common.retry}
              onPress={() => onRetry(err.retryText!)}
            />
          )}
          {canGoModels && (
            <Chip
              testID="task-error-go-models"
              variant="outline"
              color="primary"
              size="s"
              label={l10n.chat.goToModels}
              onPress={onGoModels}
            />
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
};
