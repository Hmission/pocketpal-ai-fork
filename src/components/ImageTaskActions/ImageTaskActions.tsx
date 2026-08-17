/**
 * ImageTaskActions — 生图任务卡片动作条（聊天内闭环的复用面，2026-08）
 *
 * 挂载于 ChatScreen renderBubble：生图任务卡片之下。
 *   成功卡（imageUris 已回写）：[再来一张] [编辑图片]
 *     - 再来一张：runImageTaskCard 同提示词再生成——引擎驻留时秒级出图
 *     - 编辑图片：imageGenStore.pendingEditSource 深链交接 → 生图页编辑槽预备态
 *   失败卡（metadata.imageTaskFailed）：[重试]——同一单链路重跑
 *   占位卡（生成中）：不渲染动作（imageUris/failed 均未回写）
 *
 * 锋利原则：动作全部走既有单链路（runImageTaskCard / pendingEditSource），
 * 不新建任何执行路径；生成/加载进行中禁用防连点。
 */
import * as React from 'react';
import {Text, TouchableOpacity, View, ViewStyle, TextStyle} from 'react-native';
import {observer} from 'mobx-react';
import {runInAction} from 'mobx';

import {useTheme} from '../../hooks';
import {imageGenStore} from '../../store/imageGenStore';
import {
  runImageTaskCard,
  runEditImageTaskCard,
} from '../../services/chatImageTask';
import {MessageType, Theme} from '../../utils/types';

interface ImageTaskMeta {
  imageTask?: boolean;
  imageTaskFailed?: boolean;
  imagePrompt?: string;
  /** 管家增强后的英文 SD 提示词（决策可见 v2.1：成功卡小字展示「管家优化为」） */
  imageEnhancedPrompt?: string;
  /** 管家就绪但增强失败（P0 净化：显式失败展示，不静默） */
  enhancedFailed?: boolean;
  /** 编辑任务卡（P5）：源图与指令留作「继续编辑/重试」锚点 */
  editTask?: boolean;
  editTaskFailed?: boolean;
  editSourceUri?: string;
  editInstruction?: string;
}

export const ImageTaskActions: React.FC<{message: MessageType.Text}> = observer(
  ({message}) => {
    const theme = useTheme();
    const [enhancedExpanded, setEnhancedExpanded] = React.useState(false);

    const meta = (message.metadata ?? {}) as ImageTaskMeta;
    const imageUris = message.imageUris;
    const succeeded = !!imageUris && imageUris.length > 0;
    const failed = !!meta.imageTaskFailed || !!meta.editTaskFailed;
    // 占位卡（生成中）两态均未回写 → 不出动作条
    if (!succeeded && !failed) {
      return null;
    }

    const prompt = meta.imagePrompt ?? '';
    const enhanced = meta.imageEnhancedPrompt;
    const busy = imageGenStore.generating || imageGenStore.loading;

    const chip = (label: string, testID: string, onPress: () => void) => (
      <TouchableOpacity
        testID={testID}
        disabled={busy}
        onPress={onPress}
        style={[
          styles.chip(theme),
          {
            borderColor: theme.colors.primary,
            opacity: busy ? 0.4 : 1,
          },
        ]}>
        <Text style={[styles.chipText(theme), {color: theme.colors.primary}]}>
          {label}
        </Text>
      </TouchableOpacity>
    );

    const handleRerun = () => {
      // 编辑卡重试：同一源图+指令重跑；生图卡重试：同一提示词再生成
      if (meta.editTask) {
        const src = meta.editSourceUri;
        const ins = meta.editInstruction;
        if (!src || !ins) {
          return;
        }
        runEditImageTaskCard(src, ins).catch(e =>
          console.error('[EditTask] rerun failed:', e),
        );
        return;
      }
      if (!prompt) {
        return;
      }
      runImageTaskCard(prompt).catch(e =>
        console.error('[ImageTask] rerun failed:', e),
      );
    };

    // P5 改道：任务卡「编辑图片」不再跳生图页——pendingEditSource 交接，
    // ChatScreen 消费后下沉输入框（聊天内编辑闭环，生图页编辑模式保留作深度工具）
    const handleEdit = () => {
      const uri = imageUris?.[0];
      if (!uri) {
        return;
      }
      runInAction(() => {
        imageGenStore.pendingEditSource = uri;
      });
    };

    // 编辑结果卡「继续编辑此图」（P5 递归闭环，豆包同款）：结果图下沉输入框再编辑
    const handleContinueEdit = () => {
      const uri = imageUris?.[0];
      if (!uri) {
        return;
      }
      runInAction(() => {
        imageGenStore.pendingEditSource = uri;
      });
    };

    return (
      <View style={styles.wrap} testID="image-task-actions">
        {/* 决策可见（v2.1）：管家增强提示词小字展示，点击展开/收起全文 */}
        {succeeded && enhanced && (
          <TouchableOpacity
            testID="image-enhanced-prompt"
            onPress={() => setEnhancedExpanded(v => !v)}
            style={styles.enhancedWrap}>
            <Text
              style={styles.enhancedText(theme)}
              numberOfLines={enhancedExpanded ? undefined : 2}>
              ✨ 管家优化为：{enhanced}
            </Text>
          </TouchableOpacity>
        )}
        {/* P0 净化：管家就绪但增强失败 → 显式展示（不静默），原图直接出图 */}
        {succeeded && !enhanced && meta.enhancedFailed && (
          <Text style={styles.enhancedText(theme)} testID="image-enhanced-failed">
            提示词未增强（管家不可用），已按原文出图
          </Text>
        )}
        <View style={styles.row}>
          {succeeded &&
            meta.editTask &&
            chip('继续编辑此图', 'image-task-edit', handleContinueEdit)}
          {succeeded &&
            !meta.editTask &&
            chip('再来一张', 'image-task-rerun', handleRerun)}
          {succeeded &&
            !meta.editTask &&
            chip('编辑图片', 'image-task-edit', handleEdit)}
          {failed && chip('重试', 'image-task-retry', handleRerun)}
        </View>
      </View>
    );
  },
);

const styles: {
  wrap: ViewStyle;
  enhancedWrap: ViewStyle;
  enhancedText: (theme: Theme) => TextStyle;
  row: ViewStyle;
  chip: (theme: Theme) => ViewStyle;
  chipText: (theme: Theme) => TextStyle;
} = {
  wrap: {
    marginTop: 6,
    marginLeft: 12,
  },
  enhancedWrap: {
    marginBottom: 6,
  },
  enhancedText: theme => ({
    ...theme.typography.captionM,
    color: theme.colors.textSecondary,
    lineHeight: 16,
  }),
  row: {
    flexDirection: 'row',
    gap: 8,
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
