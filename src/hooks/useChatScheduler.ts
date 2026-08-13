import React from 'react';

import {chatSessionStore, modelStore} from '../store';
import {routeTask} from '../store/taskRouter';
import {runInlineImageTask} from '../services/chatImageTask';
import {findModelForTask} from '../store/modelCapabilityRegistry';
import {engineStatus} from '../store/engineStatus';
import {promptWriter} from '../services/promptWriter';
import {user, assistant} from '../utils/chat';
import {MessageType} from '../utils/types';

/**
 * useChatScheduler — 任务驱动调度（豆包式闭环，只判不执原则）：
 *   image   → 聊天内联闭环（加载引擎→出图→插入图片/错误卡片），不跳转页面
 *   write/code → chat 引擎未加载时按能力注册表自动选模型加载，再走常规聊天
 *   chitchat → chat 引擎未加载且管家就绪时，由常驻管家直接回答（启动即就绪）
 * 返回 wrappedSendPress，供 ChatScreen 作为 ChatView onSendPress。
 */
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
        const sessionId = chatSessionStore.activeSessionId;
        if (!sessionId) {
          return;
        }

        // 2. 任务卡片占位（实时进度由 ActiveTaskBanner 展示）
        const imgCardMsg = {
          id: `imgtask-${Date.now()}`,
          author: assistant,
          createdAt: Date.now(),
          text: `🎨 正在准备生成「${signal.payload}」…`,
          type: 'text',
          metadata: {imageTask: true, modelName: '生图引擎'},
        } as MessageType.Text;
        await chatSessionStore.addMessageToCurrentSession(imgCardMsg);
        // DB 可能覆写消息 id → 插入后读回真实 id，保证后续 update 命中
        const cardId =
          chatSessionStore.currentSessionMessages[0]?.id ?? imgCardMsg.id;

        // 3. 内联执行：加载引擎（如需）→ 出图
        const result = await runInlineImageTask(signal.payload);
        if (result.uri) {
          await chatSessionStore.updateMessage(cardId, sessionId, {
            text: `🎨 已为你生成：${signal.payload}`,
            imageUris: [result.uri],
          });
        } else {
          await chatSessionStore.updateMessage(cardId, sessionId, {
            text: `⚠️ 生图未完成：${result.error ?? '未知错误'}`,
          });
        }
        return;
      }

      // write/code：chat 引擎未加载 → 按能力注册表自动选模型加载（任务驱动）
      if (
        (signal.task === 'write' || signal.task === 'code') &&
        !modelStore.engine
      ) {
        const candidate = findModelForTask(signal.task);
        if (!candidate) {
          await chatSessionStore.addMessageToCurrentSession({
            id: `sys-${Date.now()}`,
            author: assistant,
            createdAt: Date.now(),
            text: '⚠️ 写作/代码任务需要更强的对话模型，但未找到可用模型。请先到模型页下载。',
            type: 'text',
            metadata: {system: true},
          } as MessageType.Text);
          return;
        }
        engineStatus.setPhase('chat', 'loading', `加载 ${candidate.name}…`);
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
        // 加载完成，状态归隐（避免残留；模型状态由 SessionStatusBar 既有区展示）
        engineStatus.setPhase('chat', 'idle');
      }

      // chitchat：chat 引擎未加载且管家就绪 → 常驻管家直接回答（启动即就绪闭环）
      if (
        signal.task === 'chitchat' &&
        !modelStore.engine &&
        promptWriter.isLoaded
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

      handleSendPress(message);
    },
    [handleSendPress],
  );
};
