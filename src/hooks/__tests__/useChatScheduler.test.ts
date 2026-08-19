import {act, renderHook} from '@testing-library/react-native';

import {useChatScheduler} from '../useChatScheduler';
import {chatSessionStore, modelStore} from '../../store';
import {
  runImageTaskCard,
  runEditImageTaskCard,
} from '../../services/chatImageTask';
import {
  findModelForTask,
  listModelsForTask,
} from '../../store/modelCapabilityRegistry';
import {promptWriter} from '../../services/promptWriter';
import {awaitEngineReady} from '../../utils/engineReady';
import {askModelSwitch} from '../../components/ui/ModelSwitchDialog';
import {extractAndSaveMemories} from '../../services/aiosMemory';
import {appendConversation} from '../../services/aiosMemory/conversationLog';
import {MessageType} from '../../utils/types';
import {user, assistant} from '../../utils/chat';

jest.mock('../../services/chatImageTask', () => ({
  runImageTaskCard: jest.fn(),
  runEditImageTaskCard: jest.fn(),
}));
jest.mock('../../services/promptWriter', () => ({
  promptWriter: {
    isLoaded: false,
    chat: jest.fn(),
    writePrompt: jest.fn(),
    ensureLoaded: jest.fn(),
  },
  isPrompterModelName: jest.fn().mockReturnValue(false),
}));
jest.mock('../../store/modelCapabilityRegistry', () => ({
  findModelForTask: jest.fn(),
  listModelsForTask: jest.fn(),
  candidateNote: jest.fn().mockReturnValue(''),
}));
jest.mock('../../utils/engineReady', () => ({
  awaitEngineReady: jest.fn(),
  engineIsBusy: jest.fn().mockReturnValue(false),
}));
jest.mock('../../components/ui/ModelSwitchDialog', () => ({
  askModelSwitch: jest.fn(),
}));
jest.mock('../../services/aiosMemory', () => ({
  extractAndSaveMemories: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../../services/aiosMemory/conversationLog', () => ({
  appendConversation: jest.fn().mockResolvedValue(undefined),
}));

const mockRunCard = runImageTaskCard as jest.Mock;
const mockRunEditCard = runEditImageTaskCard as jest.Mock;
const mockFind = findModelForTask as jest.Mock;
const mockList = listModelsForTask as jest.Mock;
const mockPromptChat = promptWriter.chat as jest.Mock;
const mockAwaitReady = awaitEngineReady as jest.Mock;
const mockAskSwitch = askModelSwitch as jest.Mock;
const mockExtract = extractAndSaveMemories as jest.Mock;
const mockAppendConv = appendConversation as jest.Mock;

const msg = (text: string): MessageType.PartialText =>
  ({text}) as MessageType.PartialText;

const setup = () => {
  const handleSendPress = jest.fn();
  const {result} = renderHook(() => useChatScheduler(handleSendPress));
  return {wrapped: result.current, handleSendPress};
};

describe('useChatScheduler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRunCard.mockReset();
    mockRunEditCard.mockReset();
    mockFind.mockReset();
    mockList.mockReset();
    mockAwaitReady.mockResolvedValue(true);
    mockAskSwitch.mockReset();
    // §18.7：多候选返回形 {choice, modelId}；默认模拟弹窗内加载（onLoad 成功）
    mockAskSwitch.mockImplementation(async (opts: any) => {
      try {
        await opts.onLoad?.(opts.candidates?.[0]?.id ?? '');
      } catch {
        // 弹窗内失败由 Host 承载（此处模拟用户取消收尾）
      }
      return {choice: 'load', modelId: opts.candidates?.[0]?.id};
    });
    (promptWriter.ensureLoaded as jest.Mock).mockResolvedValue(true);
    (modelStore.selectModel as jest.Mock).mockReset();
    (promptWriter as any).isLoaded = false;
    (modelStore as any).engine = undefined;
    (modelStore as any).lastUsedModelId = undefined;
    (chatSessionStore as any).taskModelChoice = {write: null, code: null};
  });

  it('前置画动词路由 image：插入用户消息后委托 runImageTaskCard 卡片闭环', async () => {
    const {wrapped, handleSendPress} = setup();

    await act(async () => {
      await wrapped(msg('画一只猫'));
    });

    expect(mockRunCard).toHaveBeenCalledWith('一只猫');
    // 用户消息由 scheduler 插入；任务卡片插入/回写归 runImageTaskCard（单链路）
    expect(chatSessionStore.addMessageToCurrentSession).toHaveBeenCalledTimes(
      1,
    );
    expect(handleSendPress).not.toHaveBeenCalled();
  });

  it('P5 编辑源图+指令：插用户消息（带图）→ 委托 runEditImageTaskCard，不触发生图路由', async () => {
    const {wrapped, handleSendPress} = setup();

    await act(async () => {
      await wrapped(msg('把背景改成海边'), 'file:///src.png');
    });

    expect(mockRunEditCard).toHaveBeenCalledWith(
      'file:///src.png',
      '把背景改成海边',
    );
    expect(mockRunCard).not.toHaveBeenCalled();
    // 用户消息（含编辑源图）由 scheduler 插入
    expect(chatSessionStore.addMessageToCurrentSession).toHaveBeenCalledWith(
      expect.objectContaining({
        author: user,
        text: '把背景改成海边',
        imageUris: ['file:///src.png'],
      }),
    );
    expect(handleSendPress).not.toHaveBeenCalled();
  });

  it('P5 编辑源图+预填前缀「图片编辑：」：剥离前缀后传纯指令', async () => {
    const {wrapped, handleSendPress} = setup();

    await act(async () => {
      await wrapped(msg('图片编辑：把背景改成海边'), 'file:///src.png');
    });

    expect(mockRunEditCard).toHaveBeenCalledWith(
      'file:///src.png',
      '把背景改成海边',
    );
    expect(handleSendPress).not.toHaveBeenCalled();
  });

  it('chitchat 且管家就绪且无历史聊天模型：管家直接回答，不触发常规发送', async () => {
    (promptWriter as any).isLoaded = true;
    mockPromptChat.mockResolvedValue('管家回复');
    const {wrapped, handleSendPress} = setup();

    await act(async () => {
      await wrapped(msg('你好呀'));
    });

    expect(mockPromptChat).toHaveBeenCalledWith('你好呀');
    expect(handleSendPress).not.toHaveBeenCalled();
  });

  it('chitchat 管家直答：补接记忆提取与对话日志（P2 修复：管家模式记忆落盘）', async () => {
    jest.useFakeTimers();
    (promptWriter as any).isLoaded = true;
    mockPromptChat.mockResolvedValue('管家回复');
    const {wrapped, handleSendPress} = setup();

    await act(async () => {
      await wrapped(msg('我喜欢喝茶，最爱龙井'));
    });

    // 1.2s 延迟后触发提取 + 对话日志（管家直答绕过 run_finished 钩子的补接）
    await act(async () => {
      jest.advanceTimersByTime(1300);
    });
    expect(mockExtract).toHaveBeenCalledWith('我喜欢喝茶，最爱龙井', '管家回复');
    expect(mockAppendConv).toHaveBeenCalledWith('我喜欢喝茶，最爱龙井', '管家回复');
    expect(handleSendPress).not.toHaveBeenCalled();
    jest.useRealTimers();
  });

  it('chitchat 管家就绪但有 lastUsedModel（生图后）：仍管家直答（SPEC §9.3 删补丁条件）', async () => {
    (promptWriter as any).isLoaded = true;
    (modelStore as any).lastUsedModelId = 'model-1';
    mockPromptChat.mockResolvedValue('管家回复');
    const {wrapped, handleSendPress} = setup();

    await act(async () => {
      await wrapped(msg('你好呀'));
    });

    expect(mockPromptChat).toHaveBeenCalledWith('你好呀');
    expect(modelStore.selectModel).not.toHaveBeenCalled();
    expect(handleSendPress).not.toHaveBeenCalled();
  });

  it('chitchat 管家未就绪且懒加载失败：TaskErrorCard no_model，不发送', async () => {
    mockFind.mockReturnValue(null);
    mockList.mockReturnValue([]);
    (promptWriter.ensureLoaded as jest.Mock).mockResolvedValue(false);
    const {wrapped, handleSendPress} = setup();

    await act(async () => {
      await wrapped(msg('你好呀'));
    });

    expect(chatSessionStore.addMessageToCurrentSession).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({
          taskError: expect.objectContaining({code: 'no_model', retryText: '你好呀'}),
        }),
      }),
    );
    expect(modelStore.selectModel).not.toHaveBeenCalled();
    expect(handleSendPress).not.toHaveBeenCalled();
  });

  it('write 弹窗确认加载：加载完成+引擎就绪后才送消息（决策可见+双保险）', async () => {
    mockList.mockReturnValue([{id: 'model-2', name: 'Test Model'}]);
    (modelStore.selectModel as jest.Mock).mockImplementation(() => {
      (modelStore as any).engine = {completion: jest.fn()};
    });
    const {wrapped, handleSendPress} = setup();

    await act(async () => {
      await wrapped(msg('帮我写一篇作文'));
    });

    expect(mockAskSwitch).toHaveBeenCalledWith(
      expect.objectContaining({
        task: 'write',
        candidates: expect.arrayContaining([
          expect.objectContaining({id: 'model-2', name: 'Test Model'}),
        ]),
      }),
    );
    expect(modelStore.selectModel).toHaveBeenCalledWith(
      expect.objectContaining({id: 'model-2'}),
    );
    expect(mockAwaitReady).toHaveBeenCalled();
    expect(handleSendPress).toHaveBeenCalledWith(msg('帮我写一篇作文'));
  });

  it('write 弹窗取消：不加载不发送（用户主权）', async () => {
    mockList.mockReturnValue([{id: 'model-2', name: 'Test Model'}]);
    mockAskSwitch.mockResolvedValue({choice: 'cancel'});
    const {wrapped, handleSendPress} = setup();

    await act(async () => {
      await wrapped(msg('帮我写一篇作文'));
    });

    expect(mockAskSwitch).toHaveBeenCalled();
    expect(modelStore.selectModel).not.toHaveBeenCalled();
    expect(handleSendPress).not.toHaveBeenCalled();
  });

  it('write 弹窗内加载但引擎未就绪（awaitEngineReady 超时）：onLoad 失败由弹窗承载，不插卡不发送（§18.7）', async () => {
    mockList.mockReturnValue([{id: 'model-2', name: 'Test Model'}]);
    mockAwaitReady.mockResolvedValue(false);
    (modelStore.selectModel as jest.Mock).mockImplementation(() => {
      (modelStore as any).engine = {completion: jest.fn()};
    });
    // 弹窗内加载失败 → 失败态由弹窗显示；模拟用户看到失败后取消（错误不再插聊天卡）
    mockAskSwitch.mockImplementation(async (opts: any) => {
      try {
        await opts.onLoad?.('model-2');
      } catch {
        return {choice: 'cancel'};
      }
      return {choice: 'load', modelId: 'model-2'};
    });
    const {wrapped, handleSendPress} = setup();

    await act(async () => {
      await wrapped(msg('帮我写一篇作文'));
    });

    expect(modelStore.selectModel).toHaveBeenCalled();
    expect(handleSendPress).not.toHaveBeenCalled();
    // 错误由弹窗承载，不再插 busy 错误卡（锋利不臃肿）
    expect(chatSessionStore.addMessageToCurrentSession).not.toHaveBeenCalled();
  });

  it('chitchat 但 chat 引擎已加载：常规发送优先（管家旁路）', async () => {
    (promptWriter as any).isLoaded = true;
    (modelStore as any).engine = {
      completion: jest.fn(),
      stopCompletion: jest.fn(),
    };
    const {wrapped, handleSendPress} = setup();

    await act(async () => {
      await wrapped(msg('你好呀'));
    });

    expect(mockPromptChat).not.toHaveBeenCalled();
    expect(handleSendPress).toHaveBeenCalled();
  });

  it('write 任务且引擎未加载且无候选：TaskErrorCard no_model，不触发加载与发送', async () => {
    mockFind.mockReturnValue(null);
    mockList.mockReturnValue([]);
    const {wrapped, handleSendPress} = setup();

    await act(async () => {
      await wrapped(msg('帮我写一篇作文'));
    });

    expect(chatSessionStore.addMessageToCurrentSession).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({
          taskError: expect.objectContaining({code: 'no_model'}),
        }),
      }),
    );
    expect(modelStore.selectModel).not.toHaveBeenCalled();
    expect(handleSendPress).not.toHaveBeenCalled();
  });

  it('write 任务且引擎未加载且有候选：弹窗确认后自动加载并走常规聊天', async () => {
    mockList.mockReturnValue([{id: 'model-1', name: 'Test Model'}]);
    (modelStore as any).engine = undefined;
    (modelStore.selectModel as jest.Mock).mockImplementation(() => {
      (modelStore as any).engine = {completion: jest.fn()};
    });
    const {wrapped, handleSendPress} = setup();

    await act(async () => {
      await wrapped(msg('帮我写一篇作文'));
    });

    expect(mockAskSwitch).toHaveBeenCalled();
    expect(modelStore.selectModel).toHaveBeenCalled();
    expect(handleSendPress).toHaveBeenCalled();
  });

  it('write 多候选：用户选中非推荐项 → 弹窗内加载所选并会话级记住（§18.7）', async () => {
    mockList.mockReturnValue([
      {id: 'model-1', name: '推荐小模型'},
      {id: 'model-9', name: '用户所选大模型'},
    ]);
    mockAskSwitch.mockImplementation(async (opts: any) => {
      await opts.onLoad?.('model-9');
      return {choice: 'load', modelId: 'model-9'};
    });
    (modelStore.selectModel as jest.Mock).mockImplementation(() => {
      (modelStore as any).engine = {completion: jest.fn()};
    });
    const {wrapped, handleSendPress} = setup();

    await act(async () => {
      await wrapped(msg('帮我写一篇作文'));
    });

    expect(modelStore.selectModel).toHaveBeenCalledWith(
      expect.objectContaining({id: 'model-9'}),
    );
    // mock store 的 setTaskModelChoice 不突变，断言调用即可
    expect(chatSessionStore.setTaskModelChoice).toHaveBeenCalledWith(
      'write',
      'model-9',
    );
    expect(handleSendPress).toHaveBeenCalled();
  });
});
