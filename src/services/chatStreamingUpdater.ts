/**
 * chatStreamingUpdater — ChatSession 流式更新节流器（R3-P2 抽取）
 *
 * 自 ChatSessionStore 原样迁出（行为零变化）：scheduleStreamingUpdate /
 * flushStreamingUpdate / updateMessageStreaming / updateActiveStepStreaming /
 * applyStreamingUpdate。timer/pending/lastUpdate 槽驻留本 service 闭包
 * （本就非观察字段，天然可外置）；ChatSessionStore 保留同名薄委托
 * （外部 API 零变化），并在 pushAgentStep / finalizeActiveStep 前调用
 * `flush()`（时序语义原文照搬，见 flushStreamingUpdate 注释）。
 */
import {runInAction} from 'mobx';

import {AgentStep, MessageType} from '../utils/types';
import {chatSessionRepository} from '../repositories/ChatSessionRepository';
import {emit} from '../debug/eventStream';
import {derivedText} from '../utils/chat';
import type {SessionMetaData} from '../store/ChatSessionStore';

/**
 * Update payload accepted by `updateMessage` / `updateMessageStreaming`.
 * Covers both `Text` updates (timings, copyable) and `AssistantTurn`
 * updates which carry top-level `steps` plus arbitrary metadata fields
 * (interrupted, copyable, etc.).
 */
export type MessageUpdate =
  | Partial<MessageType.Text>
  | Partial<Omit<MessageType.AssistantTurn, 'type' | 'id' | 'author'>>;

// Coalesce per-token writes into batched UI flushes (~33 Hz).
const STREAMING_THROTTLE_MS = 30;

/** ChatSessionStore 最小注入面：运行期只读 activeSessionId / sessions */
export interface ChatStreamingUpdaterStoreLike {
  activeSessionId: string | null;
  sessions: SessionMetaData[];
}

/** createChatStreamingUpdater 返回面（store 薄委托与 flush 调用点） */
export interface ChatStreamingUpdater {
  updateMessageStreaming(
    id: string,
    sessionId: string,
    update: MessageUpdate,
  ): void;
  updateActiveStepStreaming(
    id: string,
    sessionId: string,
    partial: Partial<AgentStep>,
  ): void;
  flush(): void;
}

/**
 * 创建流式更新节流器。timer/pending/lastUpdate 槽驻留闭包，跨调用共存；
 * store 侧以 createChatStreamingUpdater(store) 注入运行期读取面。
 */
export function createChatStreamingUpdater(
  store: ChatStreamingUpdaterStoreLike,
): ChatStreamingUpdater {
  let streamingThrottleTimer: NodeJS.Timeout | null = null;
  /**
   * Pending throttled update. Discriminated so the same throttle slot
   * can serve both legacy `Text` updates (`kind: 'text'`) and the new
   * AssistantTurn active-step updates (`kind: 'step'`). Per-token writes
   * coalesce — they don't stack — because each call overwrites this slot.
   */
  let pendingStreamingUpdate:
    | {
        kind: 'text';
        id: string;
        sessionId: string;
        update: Partial<MessageType.Text>;
      }
    | {
        kind: 'step';
        id: string;
        sessionId: string;
        partial: Partial<AgentStep>;
      }
    | null = null;
  let lastStreamingUpdateTime: number = 0;

  /**
   * Schedule a throttled update through the shared throttle slot. The
   * scheduling logic is identical for both `text` and `step` shapes; only
   * the eventual `applyStreamingUpdate` dispatch differs.
   */
  function scheduleStreamingUpdate(): void {
    if (streamingThrottleTimer) {
      return;
    }

    const now = Date.now();
    const timeSinceLastUpdate = now - lastStreamingUpdateTime;

    if (timeSinceLastUpdate >= STREAMING_THROTTLE_MS) {
      applyStreamingUpdate();
      lastStreamingUpdateTime = Date.now();
      return;
    }

    const remainingTime = STREAMING_THROTTLE_MS - timeSinceLastUpdate;
    streamingThrottleTimer = setTimeout(() => {
      streamingThrottleTimer = null;
      if (pendingStreamingUpdate) {
        applyStreamingUpdate();
        lastStreamingUpdateTime = Date.now();
      }
    }, remainingTime);
  }

  /**
   * Drain the throttled streaming slot synchronously. Call before any
   * structural change to `turn.steps` (e.g. pushAgentStep or
   * finalizeActiveStep) so a pending update scheduled for the previous
   * `lastIdx` lands on the step it was intended for, not on a freshly
   * pushed step that happens to be `lastIdx` when the timer fires.
   *
   * Without this, the regression sequence is: final `token` for step 0
   * schedules the throttle (fires in 150ms) → step_finished + tool_call
   * events run synchronously → step_started(1) pushes step 1 → throttle
   * timer fires → applies step 0's pending content to step 1, briefly
   * showing step 0's text duplicated under the talent block until the
   * follow-up step's first real token replaces it.
   */
  function flushStreamingUpdate(): void {
    if (streamingThrottleTimer) {
      clearTimeout(streamingThrottleTimer);
      streamingThrottleTimer = null;
    }
    if (pendingStreamingUpdate) {
      applyStreamingUpdate();
      lastStreamingUpdateTime = Date.now();
    }
  }

  // Update message during streaming - no database write, triggers reactivity
  // Throttled to avoid excessive re-renders. Accepts either a Text-shaped
  // partial (legacy path) or an AssistantTurn-shaped partial (new
  // pipeline). The hook should prefer `updateActiveStepStreaming` for
  // assistant_turn rows; this remains for the legacy code path.
  function updateMessageStreaming(
    id: string,
    sessionId: string,
    update: MessageUpdate,
  ): void {
    pendingStreamingUpdate = {
      kind: 'text',
      id,
      sessionId,
      update: update as Partial<MessageType.Text>,
    };
    scheduleStreamingUpdate();
  }

  /**
   * Throttled streaming update for an `assistant_turn` row's active
   * (last) step. Reuses the same `streamingThrottleTimer` slot as
   * `updateMessageStreaming` so per-token writes coalesce and do not
   * stack across the two paths.
   */
  function updateActiveStepStreaming(
    id: string,
    sessionId: string,
    partial: Partial<AgentStep>,
  ): void {
    pendingStreamingUpdate = {kind: 'step', id, sessionId, partial};
    scheduleStreamingUpdate();
  }

  function applyStreamingUpdate(): void {
    if (!pendingStreamingUpdate) {
      return;
    }

    const pending = pendingStreamingUpdate;
    pendingStreamingUpdate = null;

    const targetSessionId = pending.sessionId || store.activeSessionId;
    if (!targetSessionId) {
      return;
    }

    const session = store.sessions.find(s => s.id === targetSessionId);
    if (!session) {
      return;
    }

    const message = session.messages.find(msg => msg.id === pending.id);
    if (!message) {
      return;
    }

    if (pending.kind === 'text') {
      // Legacy text path. Gate widened to also accept assistant_turn so
      // ad-hoc metadata writes (e.g. error rollback) don't silently no-op
      // on the new shape.
      if (message.type !== 'text' && message.type !== 'assistant_turn') {
        return;
      }
      const update = pending.update;
      runInAction(() => {
        if (message.type === 'text' && update.text !== undefined) {
          (message as MessageType.Text).text = update.text;
        }
        if (update.metadata !== undefined) {
          message.metadata = {
            ...(message.metadata || {}),
            ...update.metadata,
          };
        }
      });
      chatSessionRepository
        .updateMessage(pending.id, update)
        .catch(error =>
          console.error('Failed to persist streaming update to DB:', error),
        );
      return;
    }

    // pending.kind === 'step'
    if (message.type !== 'assistant_turn') {
      return;
    }
    const turn = message as MessageType.AssistantTurn;
    if (!turn.steps || turn.steps.length === 0) {
      return;
    }
    const partial = pending.partial;
    runInAction(() => {
      const lastIdx = turn.steps.length - 1;
      const last = turn.steps[lastIdx];
      // Shallow merge of step fields. `pushAgentStep` adds new steps;
      // this only mutates the active (last) one in place.
      turn.steps[lastIdx] = {
        ...last,
        ...partial,
      };
    });
    // DRC 事件流（观测不为 SPOF）：assistant_turn 流式路径增量（节流
    // key=messageId）——agent 环 token 在涨就必须有进度可见，否则开发侧
    // 误判卡死（2026-08-19 K90 血证，DRC_SPEC v1.1）。text=步骤累计内容。
    const streamedText = derivedText(turn) || '';
    if (typeof streamedText === 'string' && streamedText.length > 0) {
      emit(
        'chat',
        'chat.assistant_delta',
        {
          sessionId: targetSessionId,
          messageId: pending.id,
          text: streamedText,
        },
        `delta:${pending.id}`,
      );
    }
    chatSessionRepository
      .updateMessage(pending.id, {steps: turn.steps})
      .catch(error =>
        console.error('Failed to persist streaming step update to DB:', error),
      );
  }

  return {
    updateMessageStreaming,
    updateActiveStepStreaming,
    flush: flushStreamingUpdate,
  };
}
