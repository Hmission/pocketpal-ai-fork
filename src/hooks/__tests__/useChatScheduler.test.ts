import {act, renderHook} from '@testing-library/react-native';

import {useChatScheduler} from '../useChatScheduler';
import {chatSessionStore, modelStore} from '../../store';
import {runInlineImageTask} from '../../services/chatImageTask';
import {findModelForTask} from '../../store/modelCapabilityRegistry';
import {promptWriter} from '../../services/promptWriter';
import {MessageType} from '../../utils/types';

jest.mock('../../services/chatImageTask', () => ({
  runInlineImageTask: jest.fn(),
}));
jest.mock('../../services/promptWriter', () => ({
  promptWriter: {
    isLoaded: false,
    chat: jest.fn(),
    writePrompt: jest.fn(),
    ensureLoaded: jest.fn(),
  },
}));
jest.mock('../../store/modelCapabilityRegistry', () => ({
  findModelForTask: jest.fn(),
}));

const mockRun = runInlineImageTask as jest.Mock;
const mockFind = findModelForTask as jest.Mock;
const mockPromptChat = promptWriter.chat as jest.Mock;

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
    mockRun.mockReset();
    mockFind.mockReset();
    (modelStore.selectModel as jest.Mock).mockReset();
    (promptWriter as any).isLoaded = false;
    (modelStore as any).engine = undefined;
  });

  it('前置画动词路由 image：插入用户消息+任务卡片，出图成功更新卡片', async () => {
    mockRun.mockResolvedValue({
      uri: 'file:///tmp/gen_1.png',
      error: null,
      manifest: null,
    });
    const {wrapped, handleSendPress} = setup();

    await act(async () => {
      await wrapped(msg('画一只猫'));
    });

    expect(mockRun).toHaveBeenCalledWith('一只猫');
    expect(chatSessionStore.addMessageToCurrentSession).toHaveBeenCalledTimes(
      2,
    );
    expect(chatSessionStore.updateMessage).toHaveBeenCalledWith(
      expect.anything(),
      'session-1',
      expect.objectContaining({text: expect.stringContaining('已为你生成')}),
    );
    expect(handleSendPress).not.toHaveBeenCalled();
  });

  it('image 任务失败：更新卡片为失败文案，不走常规聊天', async () => {
    mockRun.mockResolvedValue({
      uri: null,
      error: '引擎加载失败',
      manifest: null,
    });
    const {wrapped, handleSendPress} = setup();

    await act(async () => {
      await wrapped(msg('画一只猫'));
    });

    expect(chatSessionStore.updateMessage).toHaveBeenCalledWith(
      expect.anything(),
      'session-1',
      expect.objectContaining({text: expect.stringContaining('生图未完成')}),
    );
    expect(handleSendPress).not.toHaveBeenCalled();
  });

  it('chitchat 且管家就绪：管家直接回答，不触发常规发送', async () => {
    (promptWriter as any).isLoaded = true;
    mockPromptChat.mockResolvedValue('管家回复');
    const {wrapped, handleSendPress} = setup();

    await act(async () => {
      await wrapped(msg('你好呀'));
    });

    expect(mockPromptChat).toHaveBeenCalledWith('你好呀');
    expect(handleSendPress).not.toHaveBeenCalled();
  });

  it('chitchat 且管家未就绪：回退常规发送', async () => {
    const {wrapped, handleSendPress} = setup();

    await act(async () => {
      await wrapped(msg('你好呀'));
    });

    expect(mockPromptChat).not.toHaveBeenCalled();
    expect(handleSendPress).toHaveBeenCalledWith(msg('你好呀'));
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
    mockFind.mockReturnValue({id: 'm1', name: 'Test Model'});
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
