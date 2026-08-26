import type {AgentEvent, AgentUiState} from './AgentRunner.types';

/**
 * Reducer over the `AgentEvent` stream. Drives
 * `chatSessionStore.agentUiState`.
 *
 * Returns the same `state` reference when no semantic change occurred;
 * the chat hook's call-site guard relies on this to skip redundant
 * MobX writes (load-bearing for streaming perf).
 *
 * Never clears `pendingTalentNames` on a content/reasoning `token` —
 * streamed text must not overwrite a tool-call hint already on the step.
 */
export function agentStateReducer(
  state: AgentUiState,
  event: AgentEvent,
): AgentUiState {
  switch (event.type) {
    case 'run_started':
      return {
        status: 'prefill',
        pendingTalentNames: [],
        hitMaxTurns: false,
        reasoningPhase: false,
      };
    case 'step_started':
      // Both initial and follow-up steps route through `prefill` so the
      // pending indicator covers the dead zone until the first token.
      return {
        ...state,
        status: 'prefill',
        pendingTalentNames: [],
        reasoningPhase: false,
      };
    case 'token': {
      const incomingToolCalls = event.delta.toolCalls;
      if (incomingToolCalls && incomingToolCalls.length > 0) {
        const names = incomingToolCalls
          .map(tc => tc.function?.name)
          .filter((n): n is string => !!n);
        const alreadyGenerating = state.status === 'generating_tool_call';
        // Carry names — later deltas sometimes drop the function name
        // once it's been emitted, leaving anonymous calls.
        const carryNames =
          alreadyGenerating && state.pendingTalentNames.length > 0
            ? state.pendingTalentNames
            : names;
        if (alreadyGenerating && carryNames === state.pendingTalentNames) {
          return state;
        }
        return {
          ...state,
          status: 'generating_tool_call',
          pendingTalentNames: carryNames,
        };
      }
      // First content/reasoning token flips out of prefill.
      const hasVisibleDelta =
        (event.delta.content && event.delta.content.length > 0) ||
        (event.delta.reasoningContent &&
          event.delta.reasoningContent.length > 0);
      if (state.status === 'prefill' && hasVisibleDelta) {
        // reasoningPhase 初始相位（B57）：reasoning-only 首 token → 思考期；
        // 含 content → 回复期。思考期跑分卡标签「正在思考…」与气泡思考
        // 流同屏（内容不重复，标签语义互补）。
        const reasoningPhase =
          !!event.delta.reasoningContent?.length &&
          !event.delta.content?.length;
        return {
          ...state,
          status: 'streaming_text',
          reasoningPhase,
        };
      }
      // streaming_text 期相位翻转：content delta 出现 → 回复期；纯
      // reasoning delta → 思考期；无可见 delta 保持。未变必须返回同一
      // 引用——调用方引用守卫依赖它抑制每 token 的 MobX 写入（流式性能）。
      if (state.status === 'streaming_text') {
        const hasContent = !!event.delta.content?.length;
        const hasReasoning = !!event.delta.reasoningContent?.length;
        const nextPhase = hasContent
          ? false
          : hasReasoning
            ? true
            : state.reasoningPhase;
        if (nextPhase !== state.reasoningPhase) {
          return {...state, reasoningPhase: nextPhase};
        }
      }
      return state;
    }
    case 'marker_seen':
      if (state.status === 'generating_tool_call') {
        return state;
      }
      return {
        ...state,
        status: 'generating_tool_call',
      };
    case 'tool_call_started':
      // B57：执行期保留工具名（不再清空）——联网搜索等工具执行需在
      // 跑分卡持续显示业务语义标签（web_search →「正在联网搜索…」）。
      // 取当前执行 call 的名字；名字缺失的旧事件回退保留原值。
      // step_started/run_finished 仍清空，无跨回合泄漏。
      return {
        ...state,
        status: 'executing_tool',
        pendingTalentNames: event.call?.function?.name
          ? [event.call.function.name]
          : state.pendingTalentNames,
      };
    case 'tool_call_finished':
    case 'step_finished':
      // Outcomes accumulate on the step; status flips on the next event.
      return state;
    case 'run_finished':
      return {
        status: 'done',
        pendingTalentNames: [],
        hitMaxTurns: !!event.result.hitMaxTurns,
        reasoningPhase: false,
      };
    case 'run_failed':
      return {
        ...state,
        status: 'failed',
        pendingTalentNames: [],
      };
    default: {
      const _exhaustive: never = event;
      return _exhaustive;
    }
  }
}
