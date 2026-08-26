jest.unmock('../ChatSessionStore');

import {chatSessionStore, defaultCompletionSettings} from '../ChatSessionStore';
import {chatSessionRepository} from '../../repositories/ChatSessionRepository';
import {AgentStep, AgentToolOutcome, MessageType} from '../../utils/types';
import {initialAgentUiState} from '../../services/agent';
import * as eventStream from '../../debug/eventStream';
import {createChatStreamingUpdater} from '../../services/chatStreamingUpdater';

jest.spyOn(chatSessionRepository, 'updateMessage');
jest.spyOn(chatSessionRepository, 'updateSessionTitle');

const author = {id: 'assistant'};

function makeAssistantTurn(
  steps: AgentStep[] = [],
  overrides: Partial<MessageType.AssistantTurn> = {},
): MessageType.AssistantTurn {
  return {
    id: 'turn-1',
    type: 'assistant_turn',
    author,
    createdAt: 1700000000000,
    steps,
    metadata: {copyable: true},
    ...overrides,
  };
}

describe('ChatSessionStore — AssistantTurn extensions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    chatSessionStore.sessions = [];
    chatSessionStore.activeSessionId = null;
    chatSessionStore.agentUiState = {...initialAgentUiState};
    (chatSessionRepository.updateMessage as jest.Mock).mockResolvedValue(true);
    (chatSessionRepository.updateSessionTitle as jest.Mock).mockResolvedValue(
      undefined,
    );
  });

  // ---------- 生成进度监控卡数据（§18.9） ----------

  describe('生成进度监控卡字段（markAgentRunStarted/touchAgentRun/clearAgentRun）', () => {
    beforeEach(() => {
      (chatSessionStore as any).agentRunStartedAt = null;
      (chatSessionStore as any).lastAgentEventAt = null;
    });

    it('markAgentRunStarted 起算耗时 + 心跳归位', () => {
      chatSessionStore.markAgentRunStarted();
      expect(chatSessionStore.agentRunStartedAt).not.toBeNull();
      expect(chatSessionStore.lastAgentEventAt).not.toBeNull();
    });

    it('touchAgentRun 只更新心跳（B57：思考尾部已移交气泡，不再持有）', () => {
      (chatSessionStore as any).lastAgentEventAt = null;
      chatSessionStore.touchAgentRun();
      expect(chatSessionStore.lastAgentEventAt).not.toBeNull();
    });

    it('clearAgentRun 全部复位（run_failed/run_finished 收尾）', () => {
      chatSessionStore.markAgentRunStarted();
      chatSessionStore.touchAgentRun();
      chatSessionStore.clearAgentRun();
      expect(chatSessionStore.agentRunStartedAt).toBeNull();
      expect(chatSessionStore.lastAgentEventAt).toBeNull();
    });
  });

  // ---------- agentUiState + isGeneratingToolCall computed ----------

  describe('agentUiState + isGeneratingToolCall (@computed)', () => {
    it('isGeneratingToolCall is computed from agentUiState.status', () => {
      chatSessionStore.setAgentUiState({
        status: 'generating_tool_call',
        pendingTalentNames: ['calculate'],
        hitMaxTurns: false,
        reasoningPhase: false,
      });
      expect(chatSessionStore.isGeneratingToolCall).toBe(true);

      chatSessionStore.setAgentUiState({
        status: 'streaming_text',
        pendingTalentNames: [],
        hitMaxTurns: false,
        reasoningPhase: false,
      });
      expect(chatSessionStore.isGeneratingToolCall).toBe(false);
    });

    it('setAgentUiState replaces the whole state object', () => {
      const next = {
        status: 'executing_tool' as const,
        pendingTalentNames: ['render_html'],
        hitMaxTurns: false,
        reasoningPhase: false,
      };
      chatSessionStore.setAgentUiState(next);
      expect(chatSessionStore.agentUiState).toEqual(next);
    });
  });

  // ---------- pushAgentStep / appendToolOutcome / finalizeActiveStep ----------

  describe('pushAgentStep', () => {
    it('appends a new step to an assistant_turn message and persists steps wholesale', async () => {
      const turn = makeAssistantTurn([{content: 'first'}]);
      chatSessionStore.sessions = [
        {
          id: 'session1',
          title: 'Session',
          date: new Date().toISOString(),
          messages: [turn],
          completionSettings: defaultCompletionSettings,
          settingsSource: 'pal',
        },
      ];
      chatSessionStore.activeSessionId = 'session1';

      const newStep: AgentStep = {partial: true};
      await chatSessionStore.pushAgentStep(turn.id, 'session1', newStep);

      const updated = chatSessionStore.sessions[0]
        .messages[0] as MessageType.AssistantTurn;
      expect(updated.steps).toHaveLength(2);
      expect(updated.steps[1]).toEqual(newStep);

      expect(chatSessionRepository.updateMessage).toHaveBeenCalledWith(
        turn.id,
        {steps: updated.steps},
      );
    });

    it('is a no-op when the message is not an assistant_turn', async () => {
      const textMsg: MessageType.Text = {
        id: 'm1',
        type: 'text',
        text: 'hi',
        author,
        createdAt: 1,
      };
      chatSessionStore.sessions = [
        {
          id: 'session1',
          title: 'Session',
          date: '',
          messages: [textMsg],
          completionSettings: defaultCompletionSettings,
          settingsSource: 'pal',
        },
      ];
      chatSessionStore.activeSessionId = 'session1';

      await chatSessionStore.pushAgentStep('m1', 'session1', {partial: true});
      expect(chatSessionRepository.updateMessage).not.toHaveBeenCalled();
    });

    it('flushes any pending streaming update onto the OLD lastIdx before adding the new step (regression: stale throttle leaked step-0 content into step-1)', async () => {
      // Simulates: final token for step 0 schedules a throttled write,
      // step_finished + tool events run synchronously, step_started(1)
      // pushes a new step. Without the flush, the timer fires later
      // and applies step 0's pending content to step 1 (which is now
      // lastIdx) — producing the duplicate-text-after-preview regression.
      jest.useFakeTimers();
      const dateNowSpy = jest.spyOn(Date, 'now').mockReturnValue(2_000_000);
      try {
        // The throttle slot now lives in the streamingUpdater service
        // closure (R3-P2). Start from a fresh updater (state reset) and
        // drive the timer path through the public API: the first call
        // applies inline (coalescing clock starts), the second call
        // falls into the setTimeout path — equivalent to the previous
        // white-box lastStreamingUpdateTime hack.
        (chatSessionStore as any).streamingUpdater =
          createChatStreamingUpdater(chatSessionStore);

        const turn = makeAssistantTurn([
          {content: "I'll generate the page", partial: true},
        ]);
        chatSessionStore.sessions = [
          {
            id: 'session1',
            title: '',
            date: '',
            messages: [turn],
            completionSettings: defaultCompletionSettings,
            settingsSource: 'pal',
          },
        ];
        chatSessionStore.activeSessionId = 'session1';

        // Schedule a pending streaming update for step 0. The warm-up
        // call applies inline; the real call lands in the throttled slot
        // and must NOT be visible on the step until the flush below.
        chatSessionStore.updateActiveStepStreaming(turn.id, 'session1', {
          content: 'warm-up',
        });
        chatSessionStore.updateActiveStepStreaming(turn.id, 'session1', {
          content: "I'll generate the page",
        });
        // Pending write not yet applied: step 0 still shows warm-up.
        expect(
          (
            chatSessionStore.sessions[0]
              .messages[0] as MessageType.AssistantTurn
          ).steps[0].content,
        ).toBe('warm-up');

        // Now push step 1 BEFORE the throttle fires. The flush must
        // drain the pending write onto step 0 first.
        await chatSessionStore.pushAgentStep(turn.id, 'session1', {
          partial: true,
        });

        const updated = chatSessionStore.sessions[0]
          .messages[0] as MessageType.AssistantTurn;
        expect(updated.steps).toHaveLength(2);
        // Step 0 keeps its content (flushed onto the right step).
        expect(updated.steps[0].content).toBe("I'll generate the page");
        // Step 1 is empty (NOT polluted with step 0's content).
        expect(updated.steps[1].content).toBeUndefined();
      } finally {
        dateNowSpy.mockRestore();
        jest.useRealTimers();
      }
    });
  });

  describe('appendToolOutcome', () => {
    it('#6 appends outcome onto the active (last) step of an assistant_turn', async () => {
      const initialStep: AgentStep = {
        content: 'thinking',
        toolCalls: [{id: 'c0', function: {name: 'calculate', arguments: '{}'}}],
      };
      const turn = makeAssistantTurn([{content: 'preamble'}, initialStep]);
      chatSessionStore.sessions = [
        {
          id: 'session1',
          title: 'Session',
          date: '',
          messages: [turn],
          completionSettings: defaultCompletionSettings,
          settingsSource: 'pal',
        },
      ];
      chatSessionStore.activeSessionId = 'session1';

      const outcome: AgentToolOutcome = {
        callId: 'c0',
        toolName: 'calculate',
        result: {type: 'text', summary: '42'},
        responseContent: '42',
      };
      await chatSessionStore.appendToolOutcome(turn.id, 'session1', outcome);

      const updated = chatSessionStore.sessions[0]
        .messages[0] as MessageType.AssistantTurn;
      // Earlier step untouched.
      expect(updated.steps[0]).toEqual({content: 'preamble'});
      // Last step gets the outcome appended.
      expect(updated.steps[1].toolOutcomes).toEqual([outcome]);
      expect(chatSessionRepository.updateMessage).toHaveBeenCalledWith(
        turn.id,
        {steps: updated.steps},
      );
    });

    it('returns silently when there are no steps yet', async () => {
      const turn = makeAssistantTurn([]);
      chatSessionStore.sessions = [
        {
          id: 'session1',
          title: '',
          date: '',
          messages: [turn],
          completionSettings: defaultCompletionSettings,
          settingsSource: 'pal',
        },
      ];
      chatSessionStore.activeSessionId = 'session1';

      await chatSessionStore.appendToolOutcome(turn.id, 'session1', {
        callId: 'c0',
        toolName: 'calculate',
        result: {type: 'text', summary: '0'},
        responseContent: '0',
      });
      expect(chatSessionRepository.updateMessage).not.toHaveBeenCalled();
    });
  });

  describe('appendToolCall', () => {
    it('writes step.toolCalls with ids that match outcomes appended afterwards', async () => {
      const turn = makeAssistantTurn([
        {content: 'preamble'},
        {content: 'thinking', partial: true},
      ]);
      chatSessionStore.sessions = [
        {
          id: 'session1',
          title: 'Session',
          date: '',
          messages: [turn],
          completionSettings: defaultCompletionSettings,
          settingsSource: 'pal',
        },
      ];
      chatSessionStore.activeSessionId = 'session1';

      // Runner-normalized calls (synthetic ids reconciled).
      const calls = [
        {
          id: 'call_seed_0',
          type: 'function' as const,
          function: {name: 'calculate', arguments: '{}'},
        },
      ];
      await chatSessionStore.appendToolCall(turn.id, 'session1', calls);

      // Outcome arrives with the same id (runner uses the same
      // normalized id for both events).
      const outcome: AgentToolOutcome = {
        callId: 'call_seed_0',
        toolName: 'calculate',
        result: {type: 'text', summary: '42'},
        responseContent: '42',
      };
      await chatSessionStore.appendToolOutcome(turn.id, 'session1', outcome);

      const updated = chatSessionStore.sessions[0]
        .messages[0] as MessageType.AssistantTurn;
      // Earlier step untouched.
      expect(updated.steps[0]).toEqual({content: 'preamble'});
      // Last step has both toolCalls and the outcome with matching id.
      const lastStep = updated.steps[1];
      expect(lastStep.toolCalls).toEqual(calls);
      expect(lastStep.toolOutcomes).toEqual([outcome]);
      // Single-writer invariant: ids match by construction.
      expect(lastStep.toolCalls?.[0].id).toBe(
        lastStep.toolOutcomes?.[0].callId,
      );
    });

    it('replaces (does not merge) the active step toolCalls', async () => {
      // Even if a stale toolCalls array somehow exists on the active
      // step, appendToolCall replaces it wholesale with the runner's
      // authoritative list.
      const stale = [
        {
          id: 'stale',
          type: 'function' as const,
          function: {name: 'old', arguments: '{}'},
        },
      ];
      const turn = makeAssistantTurn([
        {content: 'thinking', partial: true, toolCalls: stale},
      ]);
      chatSessionStore.sessions = [
        {
          id: 'session1',
          title: '',
          date: '',
          messages: [turn],
          completionSettings: defaultCompletionSettings,
          settingsSource: 'pal',
        },
      ];
      chatSessionStore.activeSessionId = 'session1';

      const fresh = [
        {
          id: 'call_fresh_0',
          type: 'function' as const,
          function: {name: 'calculate', arguments: '{}'},
        },
      ];
      await chatSessionStore.appendToolCall(turn.id, 'session1', fresh);

      const updated = chatSessionStore.sessions[0]
        .messages[0] as MessageType.AssistantTurn;
      expect(updated.steps[0].toolCalls).toEqual(fresh);
    });

    it('returns silently when there are no steps yet', async () => {
      const turn = makeAssistantTurn([]);
      chatSessionStore.sessions = [
        {
          id: 'session1',
          title: '',
          date: '',
          messages: [turn],
          completionSettings: defaultCompletionSettings,
          settingsSource: 'pal',
        },
      ];
      chatSessionStore.activeSessionId = 'session1';

      await chatSessionStore.appendToolCall(turn.id, 'session1', [
        {
          id: 'c0',
          type: 'function',
          function: {name: 'calculate', arguments: '{}'},
        },
      ]);
      expect(chatSessionRepository.updateMessage).not.toHaveBeenCalled();
    });
  });

  describe('finalizeActiveStep', () => {
    it('marks the last step as partial=false and persists wholesale', async () => {
      const turn = makeAssistantTurn([
        {content: 'preamble'},
        {content: 'final', partial: true},
      ]);
      chatSessionStore.sessions = [
        {
          id: 'session1',
          title: '',
          date: '',
          messages: [turn],
          completionSettings: defaultCompletionSettings,
          settingsSource: 'pal',
        },
      ];
      chatSessionStore.activeSessionId = 'session1';

      await chatSessionStore.finalizeActiveStep(turn.id, 'session1');

      const updated = chatSessionStore.sessions[0]
        .messages[0] as MessageType.AssistantTurn;
      expect(updated.steps[0]).toEqual({content: 'preamble'});
      expect(updated.steps[1].partial).toBe(false);
      expect(chatSessionRepository.updateMessage).toHaveBeenCalledWith(
        turn.id,
        {steps: updated.steps},
      );
    });
  });

  // ---------- updateActiveStepStreaming + throttle-share ----------

  describe('updateActiveStepStreaming', () => {
    let mockTime: number;
    let dateNowSpy: jest.SpyInstance;

    beforeEach(() => {
      mockTime = 2000000;
      dateNowSpy = jest.spyOn(Date, 'now').mockImplementation(() => mockTime);
      jest.useFakeTimers();
      // Reset the streamingUpdater service's throttled slot — clock/
      // timer/pending now live in its closure (R3-P2); recreate it so
      // the first per-test call applies inline.
      (chatSessionStore as any).streamingUpdater =
        createChatStreamingUpdater(chatSessionStore);
    });

    afterEach(() => {
      jest.useRealTimers();
      dateNowSpy.mockRestore();
    });

    it('#5 merges into steps[steps.length - 1] only; earlier steps untouched', () => {
      const turn = makeAssistantTurn([
        {content: 'first', partial: false},
        {content: '', partial: true},
      ]);
      chatSessionStore.sessions = [
        {
          id: 'session1',
          title: '',
          date: '',
          messages: [turn],
          completionSettings: defaultCompletionSettings,
          settingsSource: 'pal',
        },
      ];
      chatSessionStore.activeSessionId = 'session1';

      chatSessionStore.updateActiveStepStreaming(turn.id, 'session1', {
        content: 'streaming text',
      });
      const updated = chatSessionStore.sessions[0]
        .messages[0] as MessageType.AssistantTurn;
      // Earlier step untouched.
      expect(updated.steps[0]).toEqual({content: 'first', partial: false});
      // Active step has streaming content.
      expect(updated.steps[1].content).toBe('streaming text');
      expect(updated.steps[1].partial).toBe(true);
    });

    it('#7 reuses the same throttle slot as updateMessageStreaming (per-token writes coalesce, not stack)', () => {
      const turn = makeAssistantTurn([{content: '', partial: true}]);
      chatSessionStore.sessions = [
        {
          id: 'session1',
          title: '',
          date: '',
          messages: [turn],
          completionSettings: defaultCompletionSettings,
          settingsSource: 'pal',
        },
      ];
      chatSessionStore.activeSessionId = 'session1';

      // First call: applies immediately (no throttle active).
      chatSessionStore.updateActiveStepStreaming(turn.id, 'session1', {
        content: 'a',
      });
      expect(
        (chatSessionStore.sessions[0].messages[0] as MessageType.AssistantTurn)
          .steps[0].content,
      ).toBe('a');

      // Subsequent calls within the throttle window: coalesce into the
      // single slot. The pendingStreamingUpdate is overwritten — never
      // appended to a queue.
      chatSessionStore.updateActiveStepStreaming(turn.id, 'session1', {
        content: 'a-b',
      });
      chatSessionStore.updateActiveStepStreaming(turn.id, 'session1', {
        content: 'a-b-c',
      });
      // 'a-b'/'a-b-c' coalesced into the throttled slot — the step still
      // shows 'a' from the inline first call (verified above).

      // Mixing in a legacy text update overwrites the same slot — confirms
      // the throttle slot is shared across paths, not per-shape. Draining
      // applies exactly ONE write: the legacy text update wins (no queue)
      // — the legacy path never touches `content` on an assistant_turn row,
      // so the step keeps 'a' and the freshest payload reaches the repo.
      chatSessionStore.updateMessageStreaming(turn.id, 'session1', {
        text: 'legacy',
      });
      (chatSessionStore as any).streamingUpdater.flush();
      expect(
        (chatSessionStore.sessions[0].messages[0] as MessageType.AssistantTurn)
          .steps[0].content,
      ).toBe('a');
      expect(chatSessionRepository.updateMessage).toHaveBeenCalledTimes(2);
      expect(chatSessionRepository.updateMessage).toHaveBeenLastCalledWith(
        turn.id,
        {text: 'legacy'},
      );
    });

    it('emits chat.assistant_delta with accumulated step text (DRC_SPEC v1.1 streaming progress)', () => {
      const emitSpy = jest.spyOn(eventStream, 'emit');
      const turn = makeAssistantTurn([{content: ''}]);
      chatSessionStore.sessions = [
        {
          id: 'session1',
          title: '',
          date: '',
          messages: [turn],
          completionSettings: defaultCompletionSettings,
          settingsSource: 'pal',
          activePalId: undefined,
          messagesLoaded: true,
        } as any,
      ];
      chatSessionStore.activeSessionId = 'session1';

      chatSessionStore.updateActiveStepStreaming(turn.id, 'session1', {
        content: '正在生成……',
      });

      expect(emitSpy).toHaveBeenCalledWith(
        'chat',
        'chat.assistant_delta',
        expect.objectContaining({
          sessionId: 'session1',
          messageId: turn.id,
          text: '正在生成……',
        }),
        `delta:${turn.id}`,
      );
      emitSpy.mockRestore();
    });
  });

  // ---------- updateMessage on assistant_turn ----------

  describe('updateMessage on assistant_turn (#8)', () => {
    it('writes {metadata: {interrupted: true}} without losing steps (regression guard for error rollback)', async () => {
      const steps: AgentStep[] = [
        {content: 'preamble', partial: false},
        {
          content: 'partial answer',
          partial: false,
          toolCalls: [
            {id: 'c0', function: {name: 'calculate', arguments: '{}'}},
          ],
        },
      ];
      const turn = makeAssistantTurn(steps, {
        metadata: {copyable: true, contextId: 'ctx-1'},
      });
      chatSessionStore.sessions = [
        {
          id: 'session1',
          title: '',
          date: '',
          messages: [turn],
          completionSettings: defaultCompletionSettings,
          settingsSource: 'pal',
        },
      ];
      chatSessionStore.activeSessionId = 'session1';

      await chatSessionStore.updateMessage(turn.id, 'session1', {
        metadata: {interrupted: true, copyable: true},
      });

      const updated = chatSessionStore.sessions[0]
        .messages[0] as MessageType.AssistantTurn;
      // Type unchanged.
      expect(updated.type).toBe('assistant_turn');
      // Steps preserved (unaffected by the metadata-only update).
      expect(updated.steps).toEqual(steps);
      // metadata merged with existing fields.
      expect(updated.metadata?.contextId).toBe('ctx-1');
      expect(updated.metadata?.copyable).toBe(true);
      expect(updated.metadata?.interrupted).toBe(true);
      // Repository called with the metadata-only update.
      expect(chatSessionRepository.updateMessage).toHaveBeenCalledWith(
        turn.id,
        {metadata: {interrupted: true, copyable: true}},
      );
    });

    it('updates assistant_turn steps top-level via updateMessage', async () => {
      const turn = makeAssistantTurn([{content: 'old'}]);
      chatSessionStore.sessions = [
        {
          id: 'session1',
          title: '',
          date: '',
          messages: [turn],
          completionSettings: defaultCompletionSettings,
          settingsSource: 'pal',
        },
      ];
      chatSessionStore.activeSessionId = 'session1';

      const newSteps: AgentStep[] = [{content: 'new', partial: false}];
      await chatSessionStore.updateMessage(turn.id, 'session1', {
        steps: newSteps,
      });

      const updated = chatSessionStore.sessions[0]
        .messages[0] as MessageType.AssistantTurn;
      expect(updated.steps).toEqual(newSteps);
    });
  });

  // ---------- updateSessionTitle on a session ending in assistant_turn (#9) ----------

  describe('updateSessionTitle on assistant_turn-ending sessions (#9)', () => {
    it('derives title from derivedText(message), not empty, when last message is assistant_turn', async () => {
      const turn = makeAssistantTurn([{content: 'Hello there, friend'}]);
      const session = {
        id: 'session1',
        title: 'New Session',
        date: new Date().toISOString(),
        messages: [turn],
        completionSettings: defaultCompletionSettings,
        settingsSource: 'pal' as const,
      };

      await chatSessionStore.updateSessionTitle(session);
      expect(chatSessionRepository.updateSessionTitle).toHaveBeenCalledWith(
        session.id,
        'Hello there, friend',
      );
      expect(session.title).toBe('Hello there, friend');
    });

    it('multi-step turn: title joins step.content with blank line, then truncates if needed', async () => {
      const turn = makeAssistantTurn([
        {content: 'Let me look that up'},
        {content: 'The answer is 42'},
      ]);
      const session = {
        id: 'session1',
        title: 'New Session',
        date: '',
        messages: [turn],
        completionSettings: defaultCompletionSettings,
        settingsSource: 'pal' as const,
      };
      await chatSessionStore.updateSessionTitle(session);
      // 'Let me look that up\n\nThe answer is 42' is 39 chars — under 40, so
      // no truncation.
      expect(session.title).toBe('Let me look that up\n\nThe answer is 42');
    });

    it('skips when steps yield no derived text', async () => {
      const turn = makeAssistantTurn([
        {
          toolCalls: [
            {id: 'c0', function: {name: 'calculate', arguments: '{}'}},
          ],
        },
      ]);
      const session = {
        id: 'session1',
        title: 'New Session',
        date: '',
        messages: [turn],
        completionSettings: defaultCompletionSettings,
        settingsSource: 'pal' as const,
      };
      await chatSessionStore.updateSessionTitle(session);
      expect(chatSessionRepository.updateSessionTitle).not.toHaveBeenCalled();
      expect(session.title).toBe('New Session');
    });
  });
});
