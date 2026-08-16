import {act, renderHook} from '@testing-library/react-native';

import {useChatScheduler} from '../useChatScheduler';
import {chatSessionStore, modelStore} from '../../store';
import {
  runImageTaskCard,
  runEditImageTaskCard,
} from '../../services/chatImageTask';
import {findModelForTask} from '../../store/modelCapabilityRegistry';
import {promptWriter} from '../../services/promptWriter';
import {awaitEngineReady} from '../../utils/engineReady';
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
}));
jest.mock('../../utils/engineReady', () => ({
  awaitEngineReady: jest.fn(),
  engineIsBusy: jest.fn().mockReturnValue(false),
}));

const mockRunCard = runImageTaskCard as jest.Mock;
const mockRunEditCard = runEditImageTaskCard as jest.Mock;
const mockFind = findModelForTask as jest.Mock;
const mockPromptChat = promptWriter.chat as jest.Mock;
const mockAwaitReady = awaitEngineReady as jest.Mock;

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
    mockAwaitReady.mockResolvedValue(true);
    (modelStore.selectModel as jest.Mock).mockReset();
    (promptWriter as any).isLoaded = false;
    (modelStore as any).engine = undefined;
    (modelStore as any).lastUsedModelId = undefined;
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

  it('chitchat 管家就绪但有 lastUsedModel（生图后）：走懒切换恢复聊天模型', async () => {
    (promptWriter as any).isLoaded = true;
    (modelStore as any).lastUsedModelId = 'model-1';
    (modelStore.selectModel as jest.Mock).mockImplementation(() => {
      (modelStore as any).engine = {completion: jest.fn()};
    });
    const {wrapped, handleSendPress} = setup();

    await act(async () => {
      await wrapped(msg('你好呀'));
    });

    expect(mockPromptChat).not.toHaveBeenCalled();
    expect(modelStore.selectModel).toHaveBeenCalledWith(
      expect.objectContaining({id: 'model-1'}),
    );
    expect(handleSendPress).toHaveBeenCalled();
  });

  it('懒切换无候选（引擎未加载且无可恢复模型）：系统提示，不加载不发送', async () => {
    mockFind.mockReturnValue(null);
    const {wrapped, handleSendPress} = setup();

    await act(async () => {
      await wrapped(msg('你好呀'));
    });

    expect(chatSessionStore.addMessageToCurrentSession).toHaveBeenCalledWith(
      expect.objectContaining({metadata: {system: true}}),
    );
    expect(modelStore.selectModel).not.toHaveBeenCalled();
    expect(handleSendPress).not.toHaveBeenCalled();
  });

  it('懒切换有候选：加载完成+引擎就绪后才送消息（时差双保险）', async () => {
    mockFind.mockReturnValue({id: 'model-2', name: 'Test Model'});
    (modelStore.selectModel as jest.Mock).mockImplementation(() => {
      (modelStore as any).engine = {completion: jest.fn()};
    });
    const {wrapped, handleSendPress} = setup();

    await act(async () => {
      await wrapped(msg('你好呀'));
    });

    expect(modelStore.selectModel).toHaveBeenCalled();
    expect(mockAwaitReady).toHaveBeenCalled();
    expect(handleSendPress).toHaveBeenCalledWith(msg('你好呀'));
  });

  it('懒切换优先恢复 lastUsedModel（生图后切回聊天的懒恢复锚点）', async () => {
    (modelStore as any).lastUsedModelId = 'model-1';
    (modelStore.selectModel as jest.Mock).mockImplementation(() => {
      (modelStore as any).engine = {completion: jest.fn()};
    });
    const {wrapped, handleSendPress} = setup();

    await act(async () => {
      await wrapped(msg('你好呀'));
    });

    expect(modelStore.selectModel).toHaveBeenCalledWith(
      expect.objectContaining({id: 'model-1'}),
    );
    expect(mockFind).not.toHaveBeenCalled();
    expect(handleSendPress).toHaveBeenCalled();
  });

  it('懒切换引擎未就绪（awaitEngineReady 超时）：提示收尾中，不送消息', async () => {
    mockFind.mockReturnValue({id: 'model-2', name: 'Test Model'});
    mockAwaitReady.mockResolvedValue(false);
    (modelStore.selectModel as jest.Mock).mockImplementation(() => {
      (modelStore as any).engine = {completion: jest.fn()};
    });
    const {wrapped, handleSendPress} = setup();

    await act(async () => {
      await wrapped(msg('你好呀'));
    });

    expect(handleSendPress).not.toHaveBeenCalled();
    expect(chatSessionStore.addMessageToCurrentSession).toHaveBeenCalledWith(
      expect.objectContaining({
        text: expect.stringContaining('收尾'),
      }),
    );
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

  it('write 任务且引擎未加载且无候选：系统提示，不触发加载与发送', async () => {
    mockFind.mockReturnValue(null);
    const {wrapped, handleSendPress} = setup();

    await act(async () => {
      await wrapped(msg('帮我写一篇作文'));
    });

    expect(chatSessionStore.addMessageToCurrentSession).toHaveBeenCalledWith(
      expect.objectContaining({metadata: {system: true}}),
    );
    expect(modelStore.selectModel).not.toHaveBeenCalled();
    expect(handleSendPress).not.toHaveBeenCalled();
  });

  it('write 任务且引擎未加载且有候选：自动加载后走常规聊天', async () => {
    mockFind.mockReturnValue({id: 'model-1', name: 'Test Model'});
    (modelStore as any).engine = undefined;
    (modelStore.selectModel as jest.Mock).mockImplementation(() => {
      (modelStore as any).engine = {completion: jest.fn()};
    });
    const {wrapped, handleSendPress} = setup();

    await act(async () => {
      await wrapped(msg('帮我写一篇作文'));
    });

    expect(modelStore.selectModel).toHaveBeenCalled();
    expect(handleSendPress).toHaveBeenCalled();
  });
});
