import React from 'react';

import {chatSessionStore, modelStore} from '../store';
import {routeTask, TaskKind} from '../store/taskRouter';
import {runImageTaskCard} from '../services/chatImageTask';
import {findModelForTask} from '../store/modelCapabilityRegistry';
import {engineStatus} from '../store/engineStatus';
import {promptWriter, isPrompterModelName} from '../services/promptWriter';
import {awaitEngineReady} from '../utils/engineReady';
import {user, assistant} from '../utils/chat';
import {Model, MessageType} from '../utils/types';

/**
 * useChatScheduler — 任务驱动调度（豆包式闭环，只判不执原则）：
 *   image   → 聊天内联闭环（runImageTaskCard：卡片→加载→出图→回写），不跳转页面；
 *             出图后引擎驻留不卸载，「再来一张/重试」秒级复用
 *   chitchat → chat 引擎未加载且管家就绪时，由常驻管家直接回答（启动即就绪）
 *   其余（含生图后切回聊天）→ 发送时懒切换：lastUsedModel → 能力选型 →
 *             await 加载完成 + 引擎就绪后才送消息（时差双保险，不提前送）
 * 返回 wrappedSendPress，供 ChatScreen 作为 ChatView onSendPress。
 */

/** 懒切换选模：优先恢复上次聊天模型（持久化），回退任务能力选型（chitchat 兼做最大模型回退）。 */
export function pickResumeModel(task: TaskKind): Model | null {
  const last = modelStore.lastUsedModel;
  if (
    last &&
    !isPrompterModelName(last.name ?? '') &&
    !isPrompterModelName(last.filename ?? '')
  ) {
    return last;
  }
  return findModelForTask(task);
}

export const useChatScheduler = (
  handleSendPress: (message: MessageType.PartialText) => void | Promise<void>,
) => {
  return React.useCallback(
    async (message: MessageType.PartialText) => {
      const text = message.text.trim();
      const signal = routeTask(text);
      console.info(
        `[Scheduler] task=${signal.task} engine=${modelStore.engine ? 'chat' : 'none'} butler=${promptWriter.isLoaded ? 'ready' : 'off'}`,
      );

      if (signal.task === 'image') {
        // 1. 记录用户消息（无会话时自动建会话）
        await chatSessionStore.addMessageToCurrentSession({
          id: `u-${Date.now()}`,
          author: user,
          createdAt: Date.now(),
          text,
          type: 'text',
        } as MessageType.Text);
        if (!chatSessionStore.activeSessionId) {
          return;
        }
        // 2. 卡片闭环（插卡→加载→出图→回写；驻留引擎时秒级出图）
        await runImageTaskCard(signal.payload);
        return;
      }

      // chitchat：chat 引擎未加载且管家就绪且从未有过聊天模型 → 常驻管家直答
      // （启动即就绪闭环）。lastUsedModel 存在（如生图挤占了 chat 槽）→
      // 落入下方懒切换，恢复上次聊天模型（大王裁定 2026-08）。
      if (
        signal.task === 'chitchat' &&
        !modelStore.engine &&
        promptWriter.isLoaded &&
        !modelStore.lastUsedModel
      ) {
        await chatSessionStore.addMessageToCurrentSession({
          id: `u-${Date.now()}`,
          author: user,
          createdAt: Date.now(),
          text,
          type: 'text',
        } as MessageType.Text);
        const sessionId = chatSessionStore.activeSessionId;
        if (!sessionId) {
          return;
        }
        const butlerCardMsg = {
          id: `butler-${Date.now()}`,
          author: assistant,
          createdAt: Date.now(),
          text: '🐤 小鸡思考中…',
          type: 'text',
          metadata: {butler: true, modelName: '管家小鸡'},
        } as MessageType.Text;
        await chatSessionStore.addMessageToCurrentSession(butlerCardMsg);
        // DB 可能覆写消息 id → 插入后读回真实 id，保证后续 update 命中
        const cardId =
          chatSessionStore.currentSessionMessages[0]?.id ?? butlerCardMsg.id;
        const reply = await promptWriter.chat(text);
        await chatSessionStore.updateMessage(cardId, sessionId, {
          text:
            reply ??
            '抱歉，小黄鸡暂时没想到怎么回答。可到模型页加载更强的对话模型。',
        });
        return;
      }

      // 发送时懒切换（大王裁定 2026-08）：chat 引擎未加载（如刚出完图，
      // 生图引擎挤占了 chat 槽）→ 加载恢复模型，加载完成+引擎就绪后才送消息。
      if (!modelStore.engine) {
        const candidate = pickResumeModel(signal.task);
        if (!candidate) {
          await chatSessionStore.addMessageToCurrentSession({
            id: `sys-${Date.now()}`,
            author: assistant,
            createdAt: Date.now(),
            text: '⚠️ 没有可用的对话模型，请先到模型页下载。',
            type: 'text',
            metadata: {system: true},
          } as MessageType.Text);
          return;
        }
        engineStatus.setPhase('chat', 'loading', `加载 ${candidate.name}…`);
        // selectModel 内部 engineMutex.acquire('chat') → 自动卸载驻留的生图引擎
        await modelStore.selectModel(candidate);
        if (!modelStore.engine) {
          engineStatus.setError('chat', '对话模型加载失败');
          await chatSessionStore.addMessageToCurrentSession({
            id: `sys-${Date.now()}`,
            author: assistant,
            createdAt: Date.now(),
            text: `⚠️ 模型「${candidate.name}」加载失败，可到模型页排查。`,
            type: 'text',
            metadata: {system: true},
          } as MessageType.Text);
          return;
        }
        // 时差双保险之一：native context 收尾轮询等待，避免撞 busy 报错
        const ready = await awaitEngineReady();
        if (!ready) {
          engineStatus.setError('chat', '引擎忙碌，请稍后重试');
          await chatSessionStore.addMessageToCurrentSession({
            id: `sys-${Date.now()}`,
            author: assistant,
            createdAt: Date.now(),
            text: '⚠️ 模型刚加载完仍在收尾，请稍后重新发送。',
            type: 'text',
            metadata: {system: true},
          } as MessageType.Text);
          return;
        }
        // 加载完成，状态归隐（避免残留；模型状态由 SessionStatusBar 既有区展示）
        engineStatus.setPhase('chat', 'idle');
      }

      handleSendPress(message);
    },
    [handleSendPress],
  );
};
