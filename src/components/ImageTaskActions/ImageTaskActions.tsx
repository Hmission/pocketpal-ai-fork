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
import {useNavigation} from '@react-navigation/native';

import {useTheme} from '../../hooks';
import {imageGenStore} from '../../store/imageGenStore';
import {runImageTaskCard} from '../../services/chatImageTask';
import {MessageType, Theme} from '../../utils/types';
import {ROUTES} from '../../utils/navigationConstants';

interface ImageTaskMeta {
  imageTask?: boolean;
  imageTaskFailed?: boolean;
  imagePrompt?: string;
}

export const ImageTaskActions: React.FC<{message: MessageType.Text}> = observer(
  ({message}) => {
    const theme = useTheme();
    const navigation = useNavigation();

    const meta = (message.metadata ?? {}) as ImageTaskMeta;
    const imageUris = message.imageUris;
    const succeeded = !!imageUris && imageUris.length > 0;
    const failed = !!meta.imageTaskFailed;
    // 占位卡（生成中）两态均未回写 → 不出动作条
    if (!succeeded && !failed) {
      return null;
    }

    const prompt = meta.imagePrompt ?? '';
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
      if (!prompt) {
        return;
      }
      runImageTaskCard(prompt).catch(e =>
        console.error('[ImageTask] rerun failed:', e),
      );
    };

    const handleEdit = () => {
      const uri = imageUris?.[0];
      if (!uri) {
        return;
      }
      runInAction(() => {
        imageGenStore.pendingEditSource = uri;
      });
      navigation.navigate(ROUTES.IMAGE_GEN as never);
    };

    return (
      <View style={styles.row} testID="image-task-actions">
        {succeeded && chip('再来一张', 'image-task-rerun', handleRerun)}
        {succeeded && chip('编辑图片', 'image-task-edit', handleEdit)}
        {failed && chip('重试', 'image-task-retry', handleRerun)}
      </View>
    );
  },
);

const styles: {
  row: ViewStyle;
  chip: (theme: Theme) => ViewStyle;
  chipText: (theme: Theme) => TextStyle;
} = {
  row: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 6,
    marginLeft: 12,
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
