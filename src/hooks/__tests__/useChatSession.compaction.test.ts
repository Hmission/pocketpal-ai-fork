/**
 * B19 上下文压缩链路测试（批次 E）：发送前预算治理 → 压缩 → 组装重建全链。
 * 聚焦 prepareCompletion 内治理接线；摘要生成/编排本身由 services 层测试覆盖。
 */
import {LlamaContext} from 'llama.rn';
import {renderHook, act} from '@testing-library/react-native';
import {runInAction} from 'mobx';

import {textMessage} from '../../../jest/fixtures';
import {sessionFixtures} from '../../../jest/fixtures/chatSessions';
import {
  mockLlamaContextParams,
  modelsList,
} from '../../../jest/fixtures/models';

import {useChatSession} from '../useChatSession';
import {chatSessionStore, modelStore, palStore} from '../../store';
import {compactSessionAndMark} from '../../services/contextCompaction';

// AIOS 组装层 mock（避免 IO）
jest.mock('../../services/aiosMemory/contextAssembler', () => ({
  assembleContext: jest.fn(async () => ({
    systemPrompt: '',
    recalledFragments: [],
    recallCount: 0,
    dirtyEnvironment: false,
  })),
  getLastRecallInfo: jest.fn(() => ({count: 0, preview: []})),
  getLastIntentInfo: jest.fn(() => 'chat'),
}));

// 压缩编排 mock：本套件验证接线（决策→调用→重建），服务本身另有测试
jest.mock('../../services/contextCompaction', () => ({
  compactSessionAndMark: jest.fn(),
}));

// 扩窗可行性恒 true：测试聚焦决策链（ask 分支 = 可扩 → 询问），
// 真机判定由 fitStatus 自身测试覆盖。
jest.mock('../../components/IncreaseContextSheet/fitStatus', () => ({
  hasModelUpgradeFitting: jest.fn(() => true),
}));

const mockCompact = compactSessionAndMark as jest.Mock;
const mockAssistant = {id: 'h3o3lc5xj'};

const longUser = (i: number) => ({
  author: {id: 'y9d7f8pgn'},
  createdAt: Date.now() + i,
  id: `long-u${i}`,
  text: `用户${i}号消息`.repeat(100), // ≈600 token/条，内容唯一可断言
  type: 'text' as const,
});

const longAssistant = (i: number) => ({
  author: {id: 'h3o3lc5xj'},
  createdAt: Date.now() + i,
  id: `long-a${i}`,
  type: 'assistant_turn' as const,
  steps: [{content: `回复${i}号消息`.repeat(100)}],
});

// mock chatSessionStore 的 currentSessionMessages getter 固定返回 []，
// 测试需覆写为长会话以驱动预算估算。
const stubCurrentSessionMessages = (messages: unknown[]) => {
  Object.defineProperty(chatSessionStore, 'currentSessionMessages', {
    get: jest.fn(() => messages),
    configurable: true,
  });
};

beforeEach(() => {
  jest.clearAllMocks();

  // 重置 currentSessionMessages getter（避免跨用例残留 stub）
  Object.defineProperty(chatSessionStore, 'currentSessionMessages', {
    get: jest.fn(() => []),
    configurable: true,
  });

  // mock store 滞后于真实 store 的 agent 运行方法（本链路会触发 run_started）
  (chatSessionStore as any).markAgentRunStarted = jest.fn();
  (chatSessionStore as any).touchAgentRun = jest.fn();
  (chatSessionStore as any).clearAgentRun = jest.fn();

  palStore.pals = [] as any;
  chatSessionStore.sessions = sessionFixtures as any;
  chatSessionStore.activeSessionId = 'session-1';

  modelStore.models = modelsList as any;
  modelStore.activeModelId = 'model-1'; // PRESET 本地模型
  modelStore.inferencing = false;
  modelStore.isStreaming = false;
  chatSessionStore.isGenerating = false;
  chatSessionStore.isStopping = false;
  chatSessionStore.lastCompaction = null;
  chatSessionStore.lastCompletionResult = undefined;

  modelStore.context = new LlamaContext(mockLlamaContextParams);
  modelStore.engine = {
    completion: jest.fn((params, onData) =>
      modelStore.context!.completion(params, onData),
    ),
    stopCompletion: jest.fn(async () => {
      await modelStore.context?.stopCompletion();
    }),
  };

  runInAction(() => {
    (modelStore as any).perModelContextPolicy = {};
    (modelStore as any).perModelNCtx = {};
    (modelStore as any).contextAutoCompaction = true;
    (modelStore as any).activeContextSettings = {n_ctx: 4096};
  });
});

describe('useChatSession 上下文压缩链路（B19）', () => {
  it('策略 compact + 预算超阈值 → 发送前压缩并重建 messages（被压消息过滤、摘要注入）', async () => {
    const longMessages = [
      longUser(0),
      longAssistant(0),
      longUser(1),
      longAssistant(1),
      longUser(2),
      longAssistant(2),
      longUser(3),
      longAssistant(3),
    ];
    stubCurrentSessionMessages(longMessages);
    runInAction(() => {
      (chatSessionStore.sessions as any)[0].messages = longMessages;
      (modelStore as any).perModelContextPolicy = {'model-1': 'compact'};
    });
    mockCompact.mockImplementation(async () => {
      chatSessionStore.lastCompaction = {
        count: 6,
        summary: '【摘要】早期对话要点。',
        ts: Date.now(),
        sessionId: 'session-1',
      };
      return {
        compactedCount: 6,
        summary: '【摘要】早期对话要点。',
        compactedMessageIds: [
          'long-u0',
          'long-a0',
          'long-u1',
          'long-a1',
          'long-u2',
          'long-a2',
        ],
        anchorMessageId: 'long-u0',
      };
    });

    const {result} = renderHook(() =>
      useChatSession({current: null}, textMessage.author, mockAssistant),
    );
    await act(async () => {
      await result.current.handleSendPress(textMessage);
    });

    expect(mockCompact).toHaveBeenCalledTimes(1);
    expect(chatSessionStore.lastCompaction).not.toBeNull();

    // 重建后的 completion 消息：被压区间（long-u0..long-a2）过滤、
    // 保护消息（long-u3/long-a3）保留、摘要注入
    const completionParams = (modelStore.context!.completion as jest.Mock).mock
      .calls[0][0];
    const sentMessages = completionParams.messages ?? [];
    const sentText = JSON.stringify(sentMessages);
    expect(sentText).not.toContain('用户0号');
    expect(sentText).not.toContain('回复0号');
    expect(sentText).not.toContain('用户2号');
    expect(sentText).toContain('用户3号'); // 最近保护消息保留
    expect(sentText).toContain('【本会话已压缩的早期对话】');
    expect(sentText).toContain('【摘要】早期对话要点。');
  });

  it('预算未超阈值 → 不压缩照发（全量消息进 prompt）', async () => {
    runInAction(() => {
      (chatSessionStore.sessions as any)[0].messages = [
        {author: {id: 'y9d7f8pgn'}, id: 's1', text: '你好', type: 'text'},
      ];
      (modelStore as any).perModelContextPolicy = {'model-1': 'compact'};
    });

    const {result} = renderHook(() =>
      useChatSession({current: null}, textMessage.author, mockAssistant),
    );
    await act(async () => {
      await result.current.handleSendPress(textMessage);
    });

    expect(mockCompact).not.toHaveBeenCalled();
  });

  it('自动压缩开关关闭（contextAutoCompaction=false）→ 预算超阈值也不自动压缩', async () => {
    stubCurrentSessionMessages([
      longUser(0),
      longAssistant(0),
      longUser(1),
      longAssistant(1),
      longUser(2),
      longAssistant(2),
      longUser(3),
      longAssistant(3),
    ]);
    runInAction(() => {
      (chatSessionStore.sessions as any)[0].messages = [
        longUser(0),
        longAssistant(0),
        longUser(1),
        longAssistant(1),
        longUser(2),
        longAssistant(2),
        longUser(3),
        longAssistant(3),
      ];
      (modelStore as any).perModelContextPolicy = {'model-1': 'compact'};
      (modelStore as any).contextAutoCompaction = false;
    });

    const {result} = renderHook(() =>
      useChatSession({current: null}, textMessage.author, mockAssistant),
    );
    await act(async () => {
      await result.current.handleSendPress(textMessage);
    });

    // 开关关闭：策略即使 compact 也不自动压缩（banner 手动 CTA 仍可用）
    expect(mockCompact).not.toHaveBeenCalled();
  });

  it('ask 策略（默认）+ 预算超阈值 → 照发，不自动压缩（banner CTA 提供选择）', async () => {
    stubCurrentSessionMessages([
      longUser(0),
      longAssistant(0),
      longUser(1),
      longAssistant(1),
      longUser(2),
      longAssistant(2),
      longUser(3),
      longAssistant(3),
    ]);
    runInAction(() => {
      (chatSessionStore.sessions as any)[0].messages = [
        longUser(0),
        longAssistant(0),
        longUser(1),
        longAssistant(1),
        longUser(2),
        longAssistant(2),
        longUser(3),
        longAssistant(3),
      ];
      (modelStore as any).perModelContextPolicy = {};
    });

    const {result} = renderHook(() =>
      useChatSession({current: null}, textMessage.author, mockAssistant),
    );
    await act(async () => {
      await result.current.handleSendPress(textMessage);
    });

    expect(mockCompact).not.toHaveBeenCalled();
  });

  it('B19.1 满态跳过：上轮 contextFull 实测且水位仍满 → 不尝试压缩（死锁防御，走显式失败链路）', async () => {
    const longMessages = [
      longUser(0),
      longAssistant(0),
      longUser(1),
      longAssistant(1),
      longUser(2),
      longAssistant(2),
      longUser(3),
      longAssistant(3),
    ];
    stubCurrentSessionMessages(longMessages);
    runInAction(() => {
      (chatSessionStore.sessions as any)[0].messages = longMessages;
      (modelStore as any).perModelContextPolicy = {'model-1': 'compact'};
      // 上轮 native 实测：contextFull 且水位 = n_ctx（4096）
      (chatSessionStore as any).lastCompletionResult = {
        used: 4096,
        contextFull: true,
        isRemote: false,
      };
    });

    const {result} = renderHook(() =>
      useChatSession({current: null}, textMessage.author, mockAssistant),
    );
    await act(async () => {
      await result.current.handleSendPress(textMessage);
    });

    // 满态：摘要请求与主生成都会立即硬错，跳过压缩直接照发
    // （既有错误链路 + context-full banner 呈现，用户主权选择）
    expect(mockCompact).not.toHaveBeenCalled();
  });

  it('B19.1 水位实测校准：估算低于阈值但实测超阈 → 仍触发压缩（估算漂移被钉底）', async () => {
    // 估算側：短会话（远低于 0.8×4096 阈值）；实测側：上轮 native 实测已超阈
    stubCurrentSessionMessages([
      longUser(0),
      longAssistant(0),
      longUser(1),
      longAssistant(1),
      longUser(2),
      longAssistant(2),
      longUser(3),
      longAssistant(3),
    ]);
    runInAction(() => {
      (modelStore as any).perModelContextPolicy = {'model-1': 'compact'};
      // 实测水位 3900 + 预留 512 = 4412 ≥ 0.8×4096=3276.8 → 触发
      (chatSessionStore as any).lastCompletionResult = {
        used: 3900,
        contextFull: false,
        isRemote: false,
      };
    });
    mockCompact.mockResolvedValue(null);

    const {result} = renderHook(() =>
      useChatSession({current: null}, textMessage.author, mockAssistant),
    );
    await act(async () => {
      await result.current.handleSendPress(textMessage);
    });

    expect(mockCompact).toHaveBeenCalledTimes(1);
  });

  it('远程模型不触发压缩', async () => {
    stubCurrentSessionMessages([
      longUser(0),
      longAssistant(0),
      longUser(1),
      longAssistant(1),
      longUser(2),
      longAssistant(2),
      longUser(3),
      longAssistant(3),
    ]);
    runInAction(() => {
      (chatSessionStore.sessions as any)[0].messages = [
        longUser(0),
        longAssistant(0),
        longUser(1),
        longAssistant(1),
        longUser(2),
        longAssistant(2),
        longUser(3),
        longAssistant(3),
      ];
      (modelStore as any).perModelContextPolicy = {'model-1': 'compact'};
      // model-1 换成 REMOTE
      modelStore.models = [
        {
          ...(modelsList[0] as any),
          id: 'remote-1',
          origin: 'remote',
        },
      ];
      modelStore.activeModelId = 'remote-1';
    });

    const {result} = renderHook(() =>
      useChatSession({current: null}, textMessage.author, mockAssistant),
    );
    await act(async () => {
      await result.current.handleSendPress(textMessage);
    });

    expect(mockCompact).not.toHaveBeenCalled();
  });
});
