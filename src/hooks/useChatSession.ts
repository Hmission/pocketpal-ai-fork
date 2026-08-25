import React, {useRef} from 'react';

import {toJS, runInAction} from 'mobx';
import type {JinjaFormattedChatResult} from 'llama.rn';

import {chatSessionRepository} from '../repositories/ChatSessionRepository';

import {randId} from '../utils';
import {L10nContext} from '../utils';
import {
  chatSessionStore,
  modelStore,
  palStore,
  serverStore,
  ttsStore,
  uiStore,
} from '../store';
import {resolveReasoningCapability} from '../utils/reasoningCapability';

import {MessageType, ModelOrigin, User} from '../utils/types';
import {createMultimodalWarning} from '../utils/errors';
import {
  assembleMessages,
  resolveSystemMessages,
} from '../utils/systemPromptResolver';
import {extractAndSaveMemories} from '../services/aiosMemory';
import {RECALL_DISCLAIMER} from '../services/aiosMemory/searchEngine';
import {assembleContext} from '../services/aiosMemory/contextAssembler';
import {getLastRecallInfo} from '../services/aiosMemory/contextAssembler';
import {getLastWriteTime} from '../services/aiosMemory/conversationLog';
import {
  getLastSentiment,
  classifyIntent,
} from '../services/aiosMemory/rituals';
import {awaitEngineReady, engineIsBusy} from '../utils/engineReady';
import {appendConversation} from '../services/aiosMemory/conversationLog';
import {compactAndFlush} from '../services/aiosMemory/compaction';
import {maybeClosingSummary, selfCheck} from '../services/aiosMemory/rituals';
import {saveToy} from '../services/toyChest';
import {chatTurnPerf} from '../services/perf/chatTurnPerf';
import {compactSessionAndMark} from '../services/contextCompaction';
import {consumePendingWorkspaceContext} from '../services/workspace/recovery';
import {
  estimateMessagesTokens,
  resolveWatermark,
  GENERATION_RESERVE,
} from '../services/contextCompaction/budget';
import {decideContextAction} from '../services/contextCompaction/decision';
import {hasModelUpgradeFitting} from '../components/IncreaseContextSheet/fitStatus';
import {
  convertToChatMessages,
  removeThinkingParts,
  stripReasoningContent,
} from '../utils/chat';
import {activateKeepAwake, deactivateKeepAwake} from '../utils/keepAwake';
import {buildErrorReport} from '../utils/errorReport';
import {emit} from '../debug/eventStream';
import {showErrorReport} from '../components/ui/ErrorReportDialog';
import {
  toApiCompletionParams,
  ApiCompletionParams,
  CompletionParams,
  CompletionResult,
  CompletionResultSnapshot,
} from '../utils/completionTypes';
import {
  collectSystemPromptFragments,
  seedReadUrlAllowlist,
  talentRegistry,
} from '../services/talents';
import type {ToolDefinition} from '../services/talents/types';
import {
  agentStateReducer,
  createTriggerMarkerCache,
  DEFAULT_MAX_TURNS,
  initialAgentUiState,
  runAgent,
  type AgentEvent,
  type AgentUiState,
} from '../services/agent';
// Helper function to prepare completion parameters using OpenAI-compatible
// messages API. Creates the empty `assistant_turn` row up-front so the
// active-vs-persisted predicate sees the right "last message" before the
// run flips to `preparing`.
const prepareCompletion = async ({
  imageUris,
  message,
  systemMessages,
  contextId,
  assistant,
  conversationIdRef,
  isMultimodalEnabled,
  l10n,
  currentMessages,
}: {
  imageUris: string[];
  message: MessageType.PartialText;
  systemMessages: Array<{role: 'system'; content: string}>;
  contextId: string;
  assistant: User;
  conversationIdRef: string;
  isMultimodalEnabled: boolean;
  l10n: any;
  currentMessages: MessageType.Any[];
}) => {
  const sessionCompletionSettings =
    await chatSessionStore.getCurrentCompletionSettings();
  const stopWords = toJS(modelStore.activeModel?.stopWords);

  // Check if we have images and if multimodal is enabled
  const hasImages = imageUris && imageUris.length > 0;

  // Create user message content - use array format only for multimodal,
  // string for text-only.
  let userMessageContent: any;

  if (hasImages && isMultimodalEnabled) {
    userMessageContent = [
      {
        type: 'text',
        text: message.text,
      },
      ...imageUris.map(path => ({
        type: 'image_url',
        image_url: {url: path},
      })),
    ];
  } else {
    userMessageContent = message.text;

    if (hasImages && !isMultimodalEnabled) {
      uiStore.setChatWarning(
        createMultimodalWarning(l10n.chat.multimodalNotEnabled),
      );
    }
  }

  // Convert chat session messages to llama.rn format. Filtering
  // image-typed messages happens here (multimodal user messages carry
  // their images via imageUris on the Text row, not a separate Image
  // message). AssistantTurn rows pass through to convertToChatMessages,
  // which expands each step into assistant + tool API messages.
  let chatMessages = convertToChatMessages(
    currentMessages.filter(msg => msg.type !== 'image'),
    isMultimodalEnabled,
  );

  // Strip thinking parts from assistant context if the user opted out.
  const includeThinkingInContext =
    (sessionCompletionSettings as CompletionParams)
      ?.include_thinking_in_context !== false;
  if (!includeThinkingInContext) {
    chatMessages = chatMessages.map(msg => {
      if (msg.role === 'assistant' && typeof msg.content === 'string') {
        return {
          ...msg,
          content: removeThinkingParts(msg.content),
        };
      }
      return msg;
    });
  }

  // Reasoning 回灌探针（2026-08-19 K90 血证）：模板能生成 reasoning 未必能
  // 回灌——Ministral 对携带 reasoning_content 的历史 assistant 消息重格式化
  // 即 Jinja 拒收（'Only text chunks'），会话永久卡死。探针标记 false 时
  // 历史剥离该字段；undefined（未探测/远程）不动。
  if (modelStore.activeModel?.reasoningReinject === false) {
    chatMessages = stripReasoningContent(chatMessages);
  }

  // Talent-contributed system-prompt fragments (e.g. search grounding). Kept on
  // the initial messages array so they persist across every follow-up tool turn.
  const sessionToolNames = (
    (sessionCompletionSettings?.tools as ToolDefinition[] | undefined) ?? []
  ).map(tool => tool.function?.name ?? '');
  const systemPromptFragments = collectSystemPromptFragments(sessionToolNames, {
    now: new Date(),
    maxToolTurns: DEFAULT_MAX_TURNS,
  });

  // AIOS 动态上下文组装: SOUL+AGENTS+记忆 + 召回相关历史片段
  // §18.1 会话级意图状态机：首轮 classifyIntent 定值并落库，之后永远沿用
  // 会话 intent（唯一写入口 = 用户点按意图胶囊），不再每轮规则重判。
  let sessionIntent = chatSessionStore.activeSessionIntent;
  if (!sessionIntent) {
    sessionIntent = classifyIntent(message.text);
    await chatSessionStore.setSessionIntent(sessionIntent);
  }
  const assembled = await assembleContext(
    message.text,
    chatMessages.length,
    5,
    sessionIntent,
    // WORKSPACE_SPEC（2026-08-21）：写作恢复框架注入（单次消费，组装即清）
    consumePendingWorkspaceContext()?.frameworkText,
  );
  const recalledFragment = assembled.recalledFragments.length
    ? '\n' +
      RECALL_DISCLAIMER +
      '\n' +
      assembled.recalledFragments.join('\n---\n')
    : '';
  const effectiveSystem = assembled.systemPrompt
    ? [{role: 'system' as const, content: assembled.systemPrompt}]
    : systemMessages;
  let messages = assembleMessages(
    effectiveSystem,
    [...systemPromptFragments, recalledFragment],
    [...chatMessages, {role: 'user', content: userMessageContent}],
  );

  // B19 上下文预算治理（2026-08-19 大王裁定 + 行业验证）：
  // 本地模型 + 组装预算 ≥ 0.8×n_ctx（WARNING_THRESHOLD）时，策略驱动发送前
  // 自动压缩最旧消息（无感，提示条可见）；'ask'/'expand' 照发，banner CTA
  // 提供选择与策略记忆（扩窗可行性单事实源 hasModelUpgradeFitting）；已到
  // 扩窗天花板 → 直接压缩。压缩失败走既有 banner 链路，不新增兜底。
  let compactedCount = 0;
  const activeNCtx = modelStore.activeContextSettings?.n_ctx;
  const activeModelForBudget = modelStore.activeModel;
  // DRC 诊断：追踪治理决策各分量（B19 真机验证）
  emit('chat', 'chat.budget_diag', {
    activeNCtx: activeNCtx ?? null,
    modelId: activeModelForBudget?.id ?? null,
    origin: activeModelForBudget?.origin ?? null,
    autoCompact: modelStore.contextAutoCompaction,
    policy: activeModelForBudget?.id
      ? modelStore.getContextPolicy(activeModelForBudget.id)
      : null,
    msgCount: messages.length,
  });
  if (
    activeNCtx &&
    activeNCtx > 0 &&
    activeModelForBudget &&
    activeModelForBudget.origin !== ModelOrigin.REMOTE &&
    // 自动压缩总开关（生成设置页）：关闭则发送前不自动压缩，banner 手动 CTA 仍可用
    modelStore.contextAutoCompaction !== false
  ) {
    const projectionModel = modelStore.models.find(
      m => m.id === modelStore.activeProjectionModelId,
    );
    const canExpand = hasModelUpgradeFitting(
      activeModelForBudget,
      projectionModel,
      modelStore.getModelNCtx(activeModelForBudget.id),
      modelStore.contextInitParams,
      Math.max(
        modelStore.largestSuccessfulLoad ?? 0,
        modelStore.availableMemoryCeiling ?? 0,
      ),
    );
    // B19.1 水位实测校准：字符估算对英文/符号系统性低估，用上一轮 native
    // 实测（tokens_evaluated + tokens_predicted）钉底，双源取大者。
    const lastMeasured = chatSessionStore.lastCompletionResult?.used;
    const used = resolveWatermark(estimateMessagesTokens(messages), lastMeasured);
    // B19.1 满态跳过（死锁防御）：上轮实测 contextFull 且水位仍满 → 压缩
    // 的摘要请求与主生成都会立即硬错（llama.rn ctx_shift=false），属预防
    // 失灵的异常态——跳过压缩直接照发，由既有错误链路 + context-full
    // banner 呈现，用户主权选择（增大上下文/新会话），不静默不换引擎。
    const contextSaturated =
      chatSessionStore.lastCompletionResult?.contextFull === true &&
      used >= activeNCtx;
    if (contextSaturated) {
      emit('chat', 'chat.budget_decision', {
        used,
        nCtx: activeNCtx,
        saturated: true,
        action: 'send-saturated',
      });
    } else {
    const action = decideContextAction({
      used,
      nCtx: activeNCtx,
      canExpand,
      generationReserve: GENERATION_RESERVE,
      policy: modelStore.getContextPolicy(modelStore.activeModelId),
    });
    // DRC 诊断：治理决策结果（B19.1 含水位/实测基线/预留）
    emit('chat', 'chat.budget_decision', {
      used,
      lastMeasured: lastMeasured ?? null,
      nCtx: activeNCtx,
      reserve: GENERATION_RESERVE,
      threshold: used / activeNCtx,
      canExpand,
      policy: modelStore.getContextPolicy(modelStore.activeModelId),
      action,
    });
    if (action === 'compact') {
      const result = await compactSessionAndMark(
        chatSessionStore.activeSessionId ?? '',
        currentMessages,
        {
          targetReleaseTokens: Math.max(1, used - activeNCtx * 0.7),
          nCtx: activeNCtx,
          // B19.1：显式传入引擎 = 调度链路已裁决引擎可用（summarizer 防抢
          // 检查对本流程 inferencing=true 免检；手动 CTA 不传仍受保护）
          engine: modelStore.engine,
        },
      );
      if (result) {
        compactedCount = result.compactedCount;
        emit('chat', 'chat.context_compacted', {
          sessionId: chatSessionStore.activeSessionId,
          compactedCount: result.compactedCount,
        });
        // 重建组装：被压消息按 id 集合过滤出 prompt（快照过滤，不依赖
        // store 标记状态；快照不含刚发送的用户消息，无重复），
        // 摘要作 system fragment 注入（与召回层同路，不破坏角色交替）。
        const compactedIds = new Set(result.compactedMessageIds);
        const filteredHistory = convertToChatMessages(
          currentMessages.filter(
            m => m.type !== 'image' && !compactedIds.has(m.id),
          ),
          isMultimodalEnabled,
        );
        messages = assembleMessages(
          effectiveSystem,
          [
            ...systemPromptFragments,
            recalledFragment,
            `【本会话已压缩的早期对话】\n${result.summary}`,
          ],
          [...filteredHistory, {role: 'user', content: userMessageContent}],
        );
      } else {
        // DRC 诊断：压缩返回 null（选片/释放校验/摘要失败），照发走既有失败链路
        emit('chat', 'chat.compact_stage', {stage: 'compact-null-send-as-is'});
      }
    }
    } // else（非满态）结束
  }

  // Reseed the read_url exfiltration allowlist for this run; the trust policy
  // (which sources count) lives in the talents module.
  seedReadUrlAllowlist(messages, currentMessages);

  const completionParamsWithAppProps = {
    ...sessionCompletionSettings,
    messages,
    stop: stopWords,
  };

  const cleanCompletionParams = toApiCompletionParams(
    completionParamsWithAppProps as CompletionParams,
  );

  // reasoning_format is always 'auto' for the local (llama.rn) path: a no-op for
  // non-reasoning models and the value that extracts reasoning into
  // reasoning_content instead of leaking raw channel/think markers into content
  // (e.g. gemma-4 emits an empty <|channel>thought block even when thinking is
  // off). On/off is carried solely by enable_thinking. "Off" stays a best-effort
  // hint — it never strips reasoning the model still returns (rendered by
  // ReasoningBlock); separate from include_thinking_in_context, which only
  // governs what prior <think> we SEND.
  const isReasoningCapable =
    resolveReasoningCapability(
      modelStore.activeModel,
      serverStore.remoteReasoning,
    ).isReasoning !== 'no';
  cleanCompletionParams.reasoning_format = 'auto';
  // The enable_thinking:false hint only matters for reasoning-capable models;
  // a non-reasoning model would just ignore it.
  if (isReasoningCapable && !cleanCompletionParams.enable_thinking) {
    cleanCompletionParams.chat_template_kwargs = {
      ...cleanCompletionParams.chat_template_kwargs,
      enable_thinking: false,
    };
  }
  // Graded effort (gpt-oss-style): carried by the resolver-populated intent.
  const reasoningEffort = cleanCompletionParams.reasoning?.effort;
  if (reasoningEffort) {
    cleanCompletionParams.chat_template_kwargs = {
      ...cleanCompletionParams.chat_template_kwargs,
      reasoning_effort: reasoningEffort,
    };
  }

  // Create the empty AssistantTurn row in the store BEFORE the run
  // flips agentUiState.status to `preparing` so the active-vs-persisted
  // predicate (last message AND status in active set) sees a coherent
  // state from the very first frame.
  const createdAt = Date.now();
  const emptyTurn: MessageType.AssistantTurn = {
    author: assistant,
    createdAt,
    id: '', // populated by addMessageToCurrentSession
    type: 'assistant_turn',
    steps: [],
    metadata: {
      contextId,
      conversationId: conversationIdRef,
      // copyable is intentionally absent here: the turn footer's copy
      // button renders iff metadata.copyable is set, and at this point
      // the turn has nothing worth copying yet. It is set later at
      // run_finished (success/maxTurns) or at the abort catch path with
      // partial content.
      multimodal: hasImages,
      // 模型归属：聊天流卡片标签展示本轮由哪个模型发出
      modelName: modelStore.activeModel?.name,
    },
  };

  await chatSessionStore.addMessageToCurrentSession(emptyTurn);

  const messageInfo = {
    createdAt,
    id: emptyTurn.id, // set by addMessageToCurrentSession
    sessionId: chatSessionStore.activeSessionId!,
  };

  return {cleanCompletionParams, messageInfo, compactedCount};
};

// Per-run TTS streaming state. The runner emits CUMULATIVE content/
// reasoning on each `token` event (mirroring llama.rn's callback
// semantics); the TTS streaming hooks expect per-call deltas, so we
// diff cumulative against `prev*` and forward only the new substring.
// Carried in ctx so a single run keeps a coherent audio stream.
type TtsRunState = {
  // Snapshot of autoSpeakEnabled at run start; gates the per-chunk
  // TTS hook. Per-run so mid-stream toggles don't flicker audio.
  enabled: boolean;
  started: boolean;
  prevContent: string;
  prevReasoning: string;
};

// Normalise a finished turn's result into the snapshot the banner reads.
// `contextFull` is frozen here as the OR of the native full/truncated flags
// and (remote only) a 'length' finish reason derived from `stopped_limit`.
function deriveSnapshotFromResult(
  result: CompletionResult,
  effectiveNCtx: number | undefined,
  isRemote: boolean,
): CompletionResultSnapshot {
  const used = (result.tokens_evaluated ?? 0) + (result.tokens_predicted ?? 0);
  // Local turns set context_full/truncated directly; finishReason only bridges
  // the remote engine's signal (stopped_limit) into the OR predicate below, so
  // it is intentionally remote-only.
  const finishReason =
    isRemote && result.stopped_limit === 1 ? 'length' : undefined;
  const contextFull =
    result.context_full === true ||
    result.truncated === true ||
    finishReason === 'length';
  return {
    content: result.content,
    reasoning_content: result.reasoning_content,
    used,
    contextFull,
    tokensPredicted: result.tokens_predicted,
    finishReason,
    isRemote,
  };
}

/**
 * Map a single AgentEvent into the corresponding store mutation(s).
 * Free of business logic — every event maps to a known action surface
 * on `chatSessionStore`. This is the only place inside the run
 * lifecycle that writes to the store. The reducer
 * (`agentStateReducer`) updates `agentUiState` separately.
 */
async function applyEventToStore(
  event: AgentEvent,
  ctx: {
    messageId: string;
    sessionId: string;
    userText: string;
    completionStartTime: number;
    timeToFirstTokenMs: {value: number | null};
    hasImages: boolean;
    isMultimodalEnabled: boolean;
    tts: TtsRunState;
    // B19：本回合发送前压缩的消息条数（turnMetrics 指标）
    compactedCount: number;
  },
): Promise<void> {
  switch (event.type) {
    case 'run_started':
      // Status flip happens in the reducer; the empty AssistantTurn
      // already exists (created in prepareCompletion). Nothing else to
      // persist here — the message was added before the run started.
      // 生成进度监控卡：总耗时起算 + 心跳归位（§18.9）。
      chatSessionStore.markAgentRunStarted();
      // B40 §11.2：回合遥测起采（1Hz，内存态）。
      chatTurnPerf.begin();
      return;
    case 'step_started':
      await chatSessionStore.pushAgentStep(ctx.messageId, ctx.sessionId, {
        partial: true,
      });
      return;
    case 'token': {
      // Capture time-to-first-token on the first content/reasoning token.
      if (
        ctx.timeToFirstTokenMs.value === null &&
        (event.delta.content || event.delta.reasoningContent)
      ) {
        ctx.timeToFirstTokenMs.value = Date.now() - ctx.completionStartTime;
      }
      if (!modelStore.isStreaming) {
        modelStore.setIsStreaming(true);
      }
      // Learn-from-stream: the first time a model emits reasoning while the
      // resolver does not already know it reasons, persist the learned flag so
      // the pill becomes reachable on the next render. The store writer is
      // idempotent and never downgrades a user/learned 'yes'.
      if (
        event.delta.reasoningContent &&
        event.delta.reasoningContent.length > 0
      ) {
        const activeModel = modelStore.activeModel;
        if (
          activeModel &&
          resolveReasoningCapability(activeModel, serverStore.remoteReasoning)
            .isReasoning !== 'yes'
        ) {
          modelStore.recordReasoningObserved(activeModel.id);
        }
      }
      // TTS streaming hooks. Open a StreamingHandle on the first token
      // that carries content OR reasoning, then forward each new
      // substring via onAssistantMessageChunk. Wrapped defensively so a
      // UI-path failure cannot kill the completion stream. Skipped
      // when auto-speak is off — ttsStore calls would early-return
      // anyway, but the slice math is the residual per-token cost.
      if (ctx.tts.enabled) {
        try {
          const cumulativeContent = event.delta.content ?? ctx.tts.prevContent;
          const cumulativeReasoning =
            event.delta.reasoningContent ?? ctx.tts.prevReasoning;
          if (
            !ctx.tts.started &&
            (event.delta.content || event.delta.reasoningContent)
          ) {
            ctx.tts.started = true;
            ttsStore.onAssistantMessageStart(ctx.messageId);
          }
          const contentDelta =
            cumulativeContent.length > ctx.tts.prevContent.length
              ? cumulativeContent.slice(ctx.tts.prevContent.length)
              : '';
          const reasoningDelta =
            cumulativeReasoning.length > ctx.tts.prevReasoning.length
              ? cumulativeReasoning.slice(ctx.tts.prevReasoning.length)
              : '';
          if (contentDelta || reasoningDelta) {
            ctx.tts.prevContent = cumulativeContent;
            ctx.tts.prevReasoning = cumulativeReasoning;
            ttsStore.onAssistantMessageChunk(
              ctx.messageId,
              contentDelta,
              reasoningDelta || undefined,
            );
          }
        } catch (ttsErr) {
          console.warn('[useChatSession] TTS stream hook failed:', ttsErr);
        }
      }
      // Per-token writes go through the throttled streaming path so
      // they coalesce. Only forward fields that were actually present in
      // this delta to avoid clobbering existing content with empty.
      // toolCalls are not written here — the reducer still consumes
      // `event.delta.toolCalls` for pendingTalentNames, but the
      // canonical step.toolCalls write happens after step_finished via
      // appendToolCall so ids match outcomes by construction.
      const partial: Partial<MessageType.AssistantTurn['steps'][number]> = {};
      if (event.delta.content) {
        partial.content = event.delta.content.replace(/^\s+/, '');
      }
      if (event.delta.reasoningContent) {
        partial.reasoningContent = event.delta.reasoningContent;
      }
      if (Object.keys(partial).length > 0) {
        chatSessionStore.updateActiveStepStreaming(
          ctx.messageId,
          ctx.sessionId,
          partial,
        );
      }
      // 生成进度监控卡：心跳更新 + 思考流尾部（§18.9）。
      chatSessionStore.touchAgentRun(
        (event.delta.reasoningContent as string | undefined) ?? undefined,
      );
      return;
    }
    case 'marker_seen':
      // Reducer handles status flip; no per-step persistence needed.
      // 心跳：工具调用 token 阶段同样算活（§18.9）。
      chatSessionStore.touchAgentRun();
      return;
    case 'tool_call_started':
      // Reducer handles status flip; the call payload is already on
      // the active step from the preceding `token` event with toolCalls.
      // 心跳：工具执行期算活（§18.9）。
      chatSessionStore.touchAgentRun();
      return;
    case 'tool_call_finished':
      await chatSessionStore.appendToolOutcome(
        ctx.messageId,
        ctx.sessionId,
        event.outcome,
      );
      // 玩具工坊（P8，PLAY_SPEC §3）：render_html 成功成品（type='html' + title）
      // 自动进玩具箱——fire-and-forget，与记忆提取钩子同模式，不阻塞主链。
      if (event.outcome.toolName === 'render_html') {
        const r = event.outcome.result;
        if (r.type === 'html' && r.html) {
          try {
            void saveToy(r.title ?? '', r.html);
          } catch (toyErr) {
            console.warn('[useChatSession] toy chest save failed:', toyErr);
          }
        }
      }
      return;
    case 'step_finished':
      // Land step.toolCalls AFTER step_finished with the runner's
      // authoritative normalized ids so they match outcomes' callIds by
      // construction. Skipped for text-only and final-of-chain steps
      // (no payload attached).
      if (event.toolCalls && event.toolCalls.length > 0) {
        await chatSessionStore.appendToolCall(
          ctx.messageId,
          ctx.sessionId,
          event.toolCalls,
        );
      }
      await chatSessionStore.finalizeActiveStep(ctx.messageId, ctx.sessionId);
      return;
    case 'run_failed':
      // 生成进度监控卡：失败也是收尾——字段复位，进度卡立即退出
      // （否则永久转圈 = 「在干活」误报，2026-08-19 K90 血证）。
      // 状态翻转见 agentStateReducer run_failed → done。
      chatSessionStore.clearAgentRun();
      // B40：失败回合丢弃遥测残迹。
      chatTurnPerf.cancel();
      return;
    case 'run_finished': {
      // 生成进度监控卡：字段复位（§18.9）。
      chatSessionStore.clearAgentRun();
      // B40 §11.2：冻结本轮遥测摘要（≥2 点才有，否则 null 不画）。
      const turnPerf = chatTurnPerf.finish();
      // Final timings + observability for hit-max-turns. Kept here
      // (not in the runner) because timings are an observability
      // concern of the hook, not the runner.
      const finalResult = event.result.finalResult;
      const snapshot = deriveSnapshotFromResult(
        finalResult,
        modelStore.activeContextSettings?.n_ctx,
        modelStore.activeModel?.origin === ModelOrigin.REMOTE,
      );
      await chatSessionStore.updateMessage(ctx.messageId, ctx.sessionId, {
        metadata: {
          timings: {
            ...(finalResult.timings ?? {}),
            time_to_first_token_ms: ctx.timeToFirstTokenMs.value,
          },
          copyable: true,
          multimodal: ctx.hasImages && ctx.isMultimodalEnabled,
          completionResult: snapshot,
          // B18 §17：每输出指标行快照（上下文余量/落盘/召回/情绪/意图），
          // 助手卡底部各记各的；老消息无快照=不渲染（锋利不兜底）。
          turnMetrics: (() => {
            const nCtx = modelStore.activeContextSettings?.n_ctx;
            const used = snapshot?.used ?? 0;
            const recall = getLastRecallInfo();
            return {
              ctxPct: nCtx
                ? Math.min(100, Math.round((used / nCtx) * 100))
                : 0,
              writeTime: getLastWriteTime() ?? Date.now(),
              recallCount: recall.count,
              recallPreview: recall.preview ?? [],
              sentimentLabel: getLastSentiment().label,
              // B19：本回合发送前压缩的消息条数（0 = 未压缩）
              compactedCount: ctx.compactedCount,
              // §18.1：快照读会话 intent（与胶囊同源），不再读已删的模块变量
              intent: chatSessionStore.activeSessionIntent ?? 'chat',
            };
          })(),
          // B40 §11.2：回合遥测附到消息（内存态，随消息生命周期），
          // 供 footer 「▾ 图」展开层；无轨迹的旧消息诚实不渲染。
          ...(turnPerf ? {turnPerf} : {}),
          ...(event.result.hitMaxTurns ? {hitMaxTurns: true} : {}),
        },
      });
      chatSessionStore.recordCompletionSnapshot(snapshot);
      // DRC 事件流：回合完成（chat.turn_done）
      emit('chat', 'chat.turn_done', {
        sessionId: ctx.sessionId,
        messageId: ctx.messageId,
        hitMaxTurns: !!event.result.hitMaxTurns,
        tokensPredicted: snapshot?.tokensPredicted ?? 0,
        contextFull: !!snapshot?.contextFull,
      });
      if (event.result.hitMaxTurns) {
        console.warn(
          '[useChatSession] agent run hit maxTurns; surfacing last available content',
        );
      }
      // Fire TTS auto-speak after the final text is observable. Store
      // enforces auto-speak / voice / idempotency gating internally.
      // Wrapped defensively — UI-path errors must not bubble.
      try {
        ttsStore.onAssistantMessageComplete(
          ctx.messageId,
          finalResult.text ?? '',
          {hadReasoning: !!finalResult.reasoning_content?.trim()},
        );
      } catch (ttsErr) {
        console.warn('[useChatSession] TTS complete hook failed:', ttsErr);
      }
      // AIOS 口袋记忆: 本轮对话结束后提取记忆 (fire-and-forget)
      try {
        const memUserText = ctx.userText;
        const memAssistantText = finalResult.text ?? '';
        setTimeout(() => {
          // P4 自检：开启时对回复跑一遍自检修正，修正版用于落盘
          const persistText = uiStore.selfCheckEnabled
            ? selfCheck(memAssistantText)
            : Promise.resolve(memAssistantText);
          void persistText.then(corrected => {
            void extractAndSaveMemories(memUserText, corrected);
            void appendConversation(memUserText, corrected);
          });
          void compactAndFlush();
          // P4 收尾协议：当日对话超阈值后触发今日小结
          void maybeClosingSummary(
            memUserText,
            memAssistantText,
            chatSessionStore.currentSessionMessages.length,
          );
        }, 1200);
      } catch (memErr) {
        console.warn('[useChatSession] memory extraction hook failed:', memErr);
      }
      return;
    }
    case 'run_failed':
      // Failure handled by the surrounding try/catch in the hook.
      return;
    default: {
      const _exhaustive: never = event;
      return _exhaustive;
    }
  }
}

export const useChatSession = (
  currentMessageInfo: React.MutableRefObject<{
    createdAt: number;
    id: string;
    sessionId: string;
  } | null>,
  user: User,
  assistant: User,
) => {
  const l10n = React.useContext(L10nContext);
  const conversationIdRef = useRef<string>(randId());
  // Trigger-marker cache lifetime is scoped to the hook (useRef). No
  // module-level mutable state — see triggerMarkers.ts contract.
  // Resolved before each runAgent call; the resulting string[] is
  // passed into AgentRunOptions.triggerMarkers so the runner has no
  // direct dependency on the cache, modelStore, or getFormattedChat.
  const triggerCacheRef = useRef(createTriggerMarkerCache());
  // AbortController for the active run. Replaced per run; signal is
  // forwarded to runAgent for stop-mid-tool semantics.
  const abortRef = useRef<AbortController | null>(null);

  const addMessage = async (message: MessageType.Any) => {
    await chatSessionStore.addMessageToCurrentSession(message);
  };

  const addSystemMessage = async (text: string, metadata = {}) => {
    const textMessage: MessageType.Text = {
      author: assistant,
      createdAt: Date.now(),
      id: randId(),
      text,
      type: 'text',
      metadata: {system: true, ...metadata},
    };
    await addMessage(textMessage);
  };

  const handleSendPress = async (message: MessageType.PartialText) => {
    const engine = modelStore.engine;
    if (!engine) {
      await addSystemMessage(l10n.chat.modelNotLoaded);
      return;
    }

    const contextId = modelStore.contextId;
    if (!contextId) {
      await addSystemMessage(l10n.chat.modelNotLoaded);
      return;
    }

    // 就绪门控：上一条还在收尾（推理/流式/停止清理）时等待引擎就绪，
    // 避免新请求撞 busy context。等待状态用户可见，超时显式提示不静默。
    if (engineIsBusy()) {
      uiStore.setChatWarning({
        code: 'unknown',
        message: l10n.chat.enginePreparing,
        context: 'chat',
        recoverable: true,
        severity: 'warning',
      });
      const ready = await awaitEngineReady();
      uiStore.clearChatWarning();
      if (!ready) {
        await addSystemMessage(l10n.chat.engineBusyTimeout);
        return;
      }
    }

    const imageUris = message.imageUris;
    const hasImages = !!(imageUris && imageUris.length > 0);

    const isMultimodalEnabled = modelStore.activeModelCaps.visionActive;

    const currentMessages = toJS(chatSessionStore.currentSessionMessages);

    const textMessage: MessageType.Text = {
      author: user,
      createdAt: Date.now(),
      id: '',
      text: message.text,
      type: 'text',
      imageUris: hasImages ? imageUris : undefined,
      metadata: {
        contextId,
        conversationId: conversationIdRef.current,
        copyable: true,
        multimodal: hasImages,
      },
    };
    await addMessage(textMessage);
    modelStore.setInferencing(true);
    modelStore.setIsStreaming(false);
    chatSessionStore.setIsGenerating(true);

    try {
      activateKeepAwake();
    } catch (error) {
      console.error('Failed to activate keep awake during chat:', error);
    }

    const activeSession = chatSessionStore.sessions.find(
      s => s.id === chatSessionStore.activeSessionId,
    );
    const pal = activeSession?.activePalId
      ? palStore.pals.find(p => p.id === activeSession.activePalId)
      : (palStore.getAiosPal() ?? null);

    const systemMessages = resolveSystemMessages({
      pal,
      model: modelStore.activeModel,
    });

    const {cleanCompletionParams, messageInfo, compactedCount: turnCompactedCount} =
      await prepareCompletion({
        imageUris: imageUris || [],
        message,
        systemMessages,
        contextId,
        assistant,
        conversationIdRef: conversationIdRef.current,
        isMultimodalEnabled,
        l10n,
        currentMessages,
      });

    currentMessageInfo.current = messageInfo;

    // Allowed talent names for this Pal. The runner rejects any
    // tool call whose function.name isn't in this list.
    const palTalents = (pal?.pact?.talents ?? []).map(t => t.name);

    abortRef.current = new AbortController();
    const completionStartTime = Date.now();
    const timeToFirstTokenMs: {value: number | null} = {value: null};
    const tts: TtsRunState = {
      enabled: ttsStore.autoSpeakEnabled,
      started: false,
      prevContent: '',
      prevReasoning: '',
    };
    let uiState: AgentUiState = initialAgentUiState;

    // Precompute trigger markers via the per-hook cache. We use the
    // CLOSURE form of `getFormattedChat` (NOT `.bind(...)`) because the
    // method is multi-arg and requires `params: {tools, jinja: true}`
    // to populate `grammar_triggers`. A bare bind would call the
    // method with no arguments and silently return empty markers,
    // defeating marker detection. Failure is non-fatal: we fall back
    // to `[]` and let `tool_call_started` drive the UX flip (one beat
    // later) instead of `marker_seen`.
    const tools =
      (cleanCompletionParams.tools as ToolDefinition[] | undefined) ?? [];
    let triggerMarkers: string[] = [];
    // Marker detection reads `grammar_triggers` from a local Jinja
    // `getFormattedChat` call — only meaningful when a local llama.rn
    // context exists. In server mode (`modelStore.context` undefined)
    // the remote llama.cpp parser handles tool-call detection on its
    // own, so this whole step is skipped. Without the guard the
    // non-null assertion below throws TypeError on every server-mode
    // turn (caught + warned, but noisy).
    const localContext = modelStore.context;
    if (localContext) {
      try {
        triggerMarkers = await triggerCacheRef.current.getMarkers(
          String(localContext.id),
          tools,
          () =>
            localContext.getFormattedChat(
              cleanCompletionParams.messages ?? [],
              undefined,
              {tools: cleanCompletionParams.tools, jinja: true},
            ) as Promise<JinjaFormattedChatResult>,
        );
      } catch (e) {
        console.warn('[chat] trigger marker compute failed; falling back', e);
      }
    }

    try {
      const events = runAgent({
        engine,
        initialParams: cleanCompletionParams as ApiCompletionParams,
        allowedTalentNames: palTalents,
        talentLookup: name => talentRegistry.get(name),
        triggerMarkers,
        messageId: messageInfo.id,
        signal: abortRef.current.signal,
      });

      // The chunk-cycle would otherwise run entirely via microtask
      // resumption from queue.next(), starving the macrotask queue
      // where touch events ride — Stop taps could sit for tens of
      // seconds during long streams. A setTimeout(_, 0) yield every
      // YIELD_INTERVAL_MS lets touches dispatch. The yield also
      // decouples native production from consumption, so a backlog
      // can grow on fast models; the abort guard below drops queued
      // token events on stop while lifecycle events still run.
      let lastYieldTs = performance.now();
      const YIELD_INTERVAL_MS = 100;

      // Bucket the tool-token counter: PendingIndicator hides counts
      // below 10, so publish every increment up to 10, then only on
      // bucket boundaries. Drops the indicator's re-render rate by
      // ~10× without visible loss.
      let toolCallTokensRaw = 0;
      const TOOL_TOKEN_BUCKET = 10;

      for await (const event of events) {
        if (abortRef.current?.signal.aborted && event.type === 'token') {
          continue;
        }

        // Reference guard before MobX write: deep observables wrap
        // values in a proxy, so equality inside the setter can't see
        // "same object". The reducer returns the input ref when nothing
        // changed; without this guard every event still publishes.
        const nextUiState = agentStateReducer(uiState, event);
        if (nextUiState !== uiState) {
          uiState = nextUiState;
          chatSessionStore.setAgentUiState(nextUiState);
        }

        switch (event.type) {
          case 'run_started':
          case 'step_started':
          case 'tool_call_started':
          case 'run_finished':
          case 'run_failed':
            toolCallTokensRaw = 0;
            chatSessionStore.setToolCallTokenCount(0);
            break;
          case 'token':
            if (event.delta.toolCalls && event.delta.toolCalls.length > 0) {
              toolCallTokensRaw += 1;
              if (
                toolCallTokensRaw < TOOL_TOKEN_BUCKET ||
                toolCallTokensRaw % TOOL_TOKEN_BUCKET === 0
              ) {
                chatSessionStore.setToolCallTokenCount(toolCallTokensRaw);
              }
            }
            break;
          default:
            break;
        }

        await applyEventToStore(event, {
          messageId: messageInfo.id,
          sessionId: messageInfo.sessionId,
          userText: message.text,
          completionStartTime,
          timeToFirstTokenMs,
          hasImages,
          isMultimodalEnabled,
          tts,
          compactedCount: turnCompactedCount,
        });

        if (performance.now() - lastYieldTs >= YIELD_INTERVAL_MS) {
          await new Promise(resolve => setTimeout(resolve, 0));
          lastYieldTs = performance.now();
        }

        if (event.type === 'run_failed') {
          throw event.error;
        }
      }

      modelStore.setInferencing(false);
      modelStore.setIsStreaming(false);
      chatSessionStore.setIsGenerating(false);
      chatSessionStore.setIsStopping(false);
    } catch (error) {
      console.error('Completion error:', error);
      modelStore.setInferencing(false);
      modelStore.setIsStreaming(false);
      chatSessionStore.setIsGenerating(false);
      chatSessionStore.setIsStopping(false);
      // Reset agentUiState back to idle so renderers don't get
      // stuck in a failed state across the next user message.
      chatSessionStore.setAgentUiState(initialAgentUiState);
      chatSessionStore.setToolCallTokenCount(0);

      // Stop any in-flight TTS — the completion errored, so buffered
      // audio should not keep playing.
      ttsStore.stop().catch(ttsErr => {
        console.warn('[useChatSession] TTS stop on error failed:', ttsErr);
      });

      const errorMessage = (error as Error).message;
      // Native tool-call parser throws on truncated JSON when the model
      // ran out of context mid-args (most often `render_html` with a
      // long string). Detect by error shape and route through the
      // turn's metadata so the footer can show a friendlier hint
      // instead of a multi-KB raw error dump.
      const isToolArgsParseError =
        /Failed to parse tool call arguments as JSON/i.test(errorMessage);
      // Prompt-processing overflow: when the prompt itself exceeds n_ctx
      // (ctx_shift is off — the llama.rn default), the native layer throws
      // "Context is full" before any token is generated, so it never reaches
      // run_finished. Treat it as an n_ctx-exhaustion signal so the banner
      // surfaces instead of a raw error dump.
      // LLAMARN-DEP: string-coupled to the native throw in RNLlamaJSI.cpp.
      // No typed flag exists yet; a llama.rn reword would silently stop the
      // prompt-overflow banner. Re-verify on upgrade; prefer a typed
      // CompletionResult flag upstream when available.
      const isContextFullError = /context is full/i.test(errorMessage);
      const treatAsContextFull = isToolArgsParseError || isContextFullError;

      // 开发者预览版诊断面：任何完成失败都弹报错弹窗（一键复制完整报告）。
      // 会话内的 interrupted footer / banner / system message 保留作记录，
      // 弹窗是增量诊断面，不阻断回滚链。
      void (async () => {
        try {
          const report = await buildErrorReport({
            scope: 'chat',
            summary: `${l10n.chat.completionFailed}${
              errorMessage ? errorMessage.slice(0, 120) : ''
            }`,
            error,
            extra: {
              模型: modelStore.activeModel?.name,
              n_ctx: modelStore.activeContextSettings?.n_ctx,
              会话: chatSessionStore.activeSessionId ?? undefined,
            },
          });
          showErrorReport({
            title: l10n.errorReport.chatTitle,
            summary: report.summary,
            detail: report.detail,
          });
        } catch (reportErr) {
          console.warn('[useChatSession] error report failed:', reportErr);
        }
      })();

      // Error rollback path. The empty/in-flight AssistantTurn row
      // already exists; preserve any partial steps and tag with
      // {interrupted, copyable} (plus {truncationLikely} on the
      // tool-call parse case). The store widening from step 2 ensures
      // this metadata write does not silently no-op on assistant_turn
      // rows and does not clobber metadata.steps.
      let turnAbsorbedError = false;
      if (currentMessageInfo.current) {
        const session = chatSessionStore.sessions.find(
          s => s.id === currentMessageInfo.current!.sessionId,
        );
        const currentMsg = session?.messages.find(
          msg => msg.id === currentMessageInfo.current!.id,
        );

        const hasAnyStepContent =
          currentMsg?.type === 'assistant_turn' &&
          ((currentMsg as MessageType.AssistantTurn).steps ?? []).some(
            s => (s.content?.length ?? 0) > 0 || (s.toolCalls?.length ?? 0) > 0,
          );
        const hasLegacyText =
          currentMsg?.type === 'text' &&
          !!(currentMsg as MessageType.Text).text;
        const hasPartialContent = hasAnyStepContent || hasLegacyText;

        if (hasPartialContent) {
          // No finalResult on the abort path. truncationLikely is the
          // n_ctx-exhaustion signal; when set, treat the turn as full and
          // pin `used` to the loaded n_ctx so the sticky banner's freshness
          // gate holds.
          const isRemote =
            modelStore.activeModel?.origin === ModelOrigin.REMOTE;
          const effectiveNCtx = modelStore.activeContextSettings?.n_ctx;
          const abortSnapshot: CompletionResultSnapshot = {
            used: treatAsContextFull ? (effectiveNCtx ?? 0) : 0,
            contextFull: treatAsContextFull,
            isRemote,
          };
          await chatSessionStore.updateMessage(
            currentMessageInfo.current.id,
            currentMessageInfo.current.sessionId,
            {
              metadata: {
                interrupted: true,
                copyable: true,
                completionResult: abortSnapshot,
                ...(isToolArgsParseError ? {truncationLikely: true} : {}),
              },
            },
          );
          chatSessionStore.recordCompletionSnapshot(abortSnapshot);
          // The turn now carries the failure context; suppress the
          // duplicate `Completion failed: …` system message dump.
          turnAbsorbedError = true;
        } else {
          // A prompt that overflows n_ctx throws before any token, so there
          // is no content to keep — but still record the snapshot so the
          // banner surfaces the full state. The empty turn is cleaned up
          // below; the store snapshot drives the banner independently.
          // Per-process for this draft: with no message persisted, the banner
          // does not rehydrate after a session switch / restart (it re-fires
          // on the next overflowing send).
          if (isContextFullError) {
            const isRemote =
              modelStore.activeModel?.origin === ModelOrigin.REMOTE;
            const effectiveNCtx = modelStore.activeContextSettings?.n_ctx;
            chatSessionStore.recordCompletionSnapshot({
              used: effectiveNCtx ?? 0,
              contextFull: true,
              isRemote,
            });
            turnAbsorbedError = true;
          }
          try {
            await chatSessionRepository.deleteMessage(
              currentMessageInfo.current.id,
            );
            if (session) {
              runInAction(() => {
                session.messages = session.messages.filter(
                  msg => msg.id !== currentMessageInfo.current!.id,
                );
              });
            }
          } catch (cleanupError) {
            console.error(
              'Failed to clean up empty message after error:',
              cleanupError,
            );
          }
        }
      }

      if (turnAbsorbedError) {
        // Footer already surfaces interrupted / truncationLikely; nothing
        // more to add to chat.
      } else if (errorMessage.includes('network')) {
        await addSystemMessage(l10n.common.networkError);
      } else if (isToolArgsParseError) {
        // No turn content to attach the hint to — fall back to a
        // friendly system message instead of the raw native error dump.
        await addSystemMessage(l10n.chat.toolCallTruncated);
      } else if (isContextFullError) {
        // No turn to attach to; surface the banner via a store snapshot
        // rather than dumping the raw "Context is full" native error.
        chatSessionStore.recordCompletionSnapshot({
          used: modelStore.activeContextSettings?.n_ctx ?? 0,
          contextFull: true,
          isRemote: modelStore.activeModel?.origin === ModelOrigin.REMOTE,
        });
      } else {
        await addSystemMessage(`${l10n.chat.completionFailed}${errorMessage}`);
      }
    } finally {
      try {
        deactivateKeepAwake();
      } catch (error) {
        console.error('Failed to deactivate keep awake after chat:', error);
      }
    }
  };

  const handleResetConversation = async () => {
    conversationIdRef.current = randId();
    await addSystemMessage(l10n.chat.conversationReset);
  };

  const handleStopPress = async () => {
    // Enter the `stopping` state IMMEDIATELY: the user gets visible
    // feedback ("Stopping…") and the send button is gated off so a
    // new completion can't try to use the still-busy native context.
    // We do NOT touch `inferencing` / `isGenerating` here — those get
    // cleared by the for-await cleanup in handleSendPress once the
    // runner has actually exited (native llama.rn has returned from
    // its current llama_decode chunk; see ChatSessionStore.isStopping
    // for the rationale).
    chatSessionStore.setIsStopping(true);
    // The runner's abort listener owns engine.stopCompletion — this
    // signal is the single source of stop intent.
    abortRef.current?.abort();
    // Stop any in-flight TTS so buffered audio doesn't keep playing
    // after the user tapped Stop. Inferencing/isStreaming/isGenerating
    // flags are NOT cleared here — those get cleared by the for-await
    // cleanup in handleSendPress once the runner has actually exited.
    ttsStore.stop().catch(err => {
      console.warn('[useChatSession] TTS stop on user-stop failed:', err);
    });

    // Note: deactivateKeepAwake intentionally stays here so the device
    // can sleep as soon as the user signals stop, even if native is
    // still finishing the current chunk.
    try {
      deactivateKeepAwake();
    } catch (error) {
      console.error(
        'Failed to deactivate keep awake after stopping chat:',
        error,
      );
    }
  };

  return {
    handleSendPress,
    handleResetConversation,
    handleStopPress,
  };
};
