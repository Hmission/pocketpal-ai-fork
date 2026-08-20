import React from 'react';
import {Text, TouchableOpacity, View} from 'react-native';

import {useTheme} from '../../hooks';

import {MessageType} from '../../utils/types';
import {getModelDisplayName} from '../../utils/modelDisplayNames';
import {withOpacity} from '../../utils/colorUtils';
import {user} from '../../utils/chat';
import {askIntentChoice} from '../ui/IntentPicker';
import {chatSessionStore} from '../../store';
import type {IntentKind} from '../../services/aiosMemory/rituals';

import {styles} from './styles';

// B18 §17：意图四色胶囊（作者标签行，与模型徽章同高）。
// 硬编码 hex 收口 DS token：闲聊=中性 / 倾诉=error / 问答=info / 任务=warning。
const INTENT_LABEL: Record<string, string> = {
  chat: '闲聊',
  vent: '倾诉',
  qa: '问答',
  task: '任务',
};

// §18.1 意图胶囊点按：会话级状态机的唯一用户写入口。
// 选择器初始值 = 会话实时意图（activeSessionIntent，与胶囊快照解耦——
// 会话中途切换后点旧消息胶囊，高亮的是当前会话状态而非过期快照）。
// 选择器取消（null）不改状态；Host 未挂载时 fail-fast 同样不改状态。
const handleIntentPress = async () => {
  const next = await askIntentChoice(chatSessionStore.activeSessionIntent);
  if (next) {
    await chatSessionStore.setSessionIntent(next);
  }
};

interface AssistantAuthorRowProps {
  /** 任意消息（assistant_turn / text 共用），内部从 metadata 提取徽章/意图 */
  message: MessageType.Any;
}

/**
 * 助手卡作者标签行（单一事实源）。
 *
 * 承载：① 模型徽章（metadata.modelName → 中文简称，brandAccent captionS）；
 *       ② 意图胶囊（metadata.turnMetrics.intent 四色 12% 底，点按切换会话级 intent）。
 *
 * 从 ChatScreen.renderBubble 内联逻辑抽离（task-6ad §20.1）：assistant_turn 与
 * text 消息复用同一组件，消除徽章逻辑双份维护与多块路径潜在重复渲染。
 * 无徽章且无意图时渲染 null（不占位）。
 */
export const AssistantAuthorRow: React.FC<AssistantAuthorRowProps> = ({
  message,
}) => {
  const theme = useTheme();

  // 非助手消息（用户/系统）不发徽章与意图：以真实 user.id 判定，
  // 不硬编码字面量（userId = 'y9d7f8pgn'，硬编码 'user' 会让用户消息恒判为助手）
  const isAssistant = message.author.id !== user.id;
  const modelName = isAssistant
    ? (message.metadata as {modelName?: string} | undefined)?.modelName
    : undefined;
  const intent = isAssistant
    ? (
        message.metadata as
          | {turnMetrics?: {intent?: IntentKind}}
          | undefined
      )?.turnMetrics?.intent
    : undefined;

  if (!modelName && !intent) {
    return null;
  }

  const intentColor =
    intent === 'vent'
      ? theme.colors.error
      : intent === 'qa'
        ? theme.colors.info
        : intent === 'task'
          ? theme.colors.warning
          : theme.colors.onSurfaceVariant;

  const s = styles({theme});

  return (
    <View style={s.row} testID="assistant-author-row">
      {modelName ? (
        <Text testID="assistant-model-badge" style={s.modelBadge}>
          {getModelDisplayName({name: modelName})}
        </Text>
      ) : null}
      {intent && INTENT_LABEL[intent] ? (
        <TouchableOpacity
          testID="assistant-intent-capsule"
          onPress={() => handleIntentPress()}
          activeOpacity={0.7}
          style={[
            s.intentCapsule,
            {backgroundColor: withOpacity(intentColor, 0.12)},
          ]}>
          <Text style={[s.intentLabel, {color: intentColor}]}>
            {INTENT_LABEL[intent]}
          </Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
};
