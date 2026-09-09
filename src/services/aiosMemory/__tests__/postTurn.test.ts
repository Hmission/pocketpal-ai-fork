/**
 * scheduleMemoryPostTurn 契约测试（§Wave C+ / CORE-14）。
 *
 * 钉住的四件事：
 * 1. 延后到推理让出设备后才动手，且**只动手一次**；
 * 2. `correct` 修正文本必须同时喂给抽取与对话日志（旧写法只有 extract 走 corrected，
 *    落盘的对话日志用原文，两份事实源）；
 * 3. `parallel`（压缩 / 今日小结）不得排在 correct 后面——并行是原语义；
 * 4. 子任务失败必须**上抛**给 safeTimeout 单点上报，而不是被本模块静默吞掉。
 */
import {scheduleMemoryPostTurn} from '../postTurn';
import {extractAndSaveMemories} from '../index';
import {appendConversation} from '../conversationLog';
import {emit} from '../../../debug/eventStream';

jest.mock('../index', () => ({
  extractAndSaveMemories: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../conversationLog', () => ({
  appendConversation: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../../../debug/eventStream', () => ({
  emit: jest.fn(() => false),
}));

const mockExtract = extractAndSaveMemories as unknown as jest.Mock;
const mockAppend = appendConversation as unknown as jest.Mock;
const emitMock = emit as unknown as jest.Mock;

/** 推进假时间并把微任务跑干净（同步 advance 会让 async 链停在半途） */
async function advance(ms: number) {
  await jest.advanceTimersByTimeAsync(ms);
}

beforeEach(() => {
  jest.useFakeTimers();
  mockExtract.mockClear();
  mockAppend.mockClear();
  emitMock.mockClear();
});

afterEach(() => {
  jest.useRealTimers();
});

describe('scheduleMemoryPostTurn', () => {
  it('1.2s 内不动手；到点后抽取与对话日志同时落盘', async () => {
    scheduleMemoryPostTurn('大王喜欢青色', '是呀', 'chat');

    await advance(1199);
    expect(mockExtract).not.toHaveBeenCalled();

    await advance(2);
    expect(mockExtract).toHaveBeenCalledWith('大王喜欢青色', '是呀');
    expect(mockAppend).toHaveBeenCalledWith('大王喜欢青色', '是呀');
  });

  it('correct 的修正文本必须同时用于抽取与对话日志（不留两份事实）', async () => {
    scheduleMemoryPostTurn('原问', '原答', 'butler', {
      correct: async () => '修正答',
    });

    await advance(1300);
    expect(mockExtract).toHaveBeenCalledWith('原问', '修正答');
    expect(mockAppend).toHaveBeenCalledWith('原问', '修正答');
    // 原文不得出现在任何落盘调用里
    const allArgs = [...mockExtract.mock.calls, ...mockAppend.mock.calls]
      .flat()
      .join('|');
    expect(allArgs).not.toContain('原答');
  });

  it('parallel 与 correct 并行启动，不被自检耗时堵住', async () => {
    let releaseCorrect: (t: string) => void = () => {};
    const correct = new Promise<string>(resolve => {
      releaseCorrect = resolve;
    });
    const parallel = jest.fn(() => [Promise.resolve('flushed')]);

    scheduleMemoryPostTurn('q', 'a', 'chat', {
      correct: () => correct,
      parallel,
    });

    await advance(1300);
    // correct 尚未 resolve，parallel 就必须已经跑过
    expect(parallel).toHaveBeenCalledTimes(1);
    expect(mockExtract).not.toHaveBeenCalled();

    releaseCorrect('a2');
    await advance(0);
    expect(mockExtract).toHaveBeenCalledWith('q', 'a2');
  });

  it('子任务失败上抛给 safeTimeout 单点上报（本模块不得自带 catch 静默）', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    mockExtract.mockRejectedValueOnce(new Error('engine offline'));

    scheduleMemoryPostTurn('q', 'a', 'butler');
    await advance(1300);

    expect(emitMock).toHaveBeenCalledWith(
      'system',
      'safeTimeout.failed',
      expect.objectContaining({name: 'aios_memory_post_turn_butler'}),
    );
    warn.mockRestore();
  });

  it('origin 进定时器名：聊天与管家两条路径的失败日志可辨', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    scheduleMemoryPostTurn('q', 'a', 'chat');
    scheduleMemoryPostTurn('q', 'a', 'butler');
    mockExtract.mockRejectedValue(new Error('boom'));

    await advance(1300);
    const names = emitMock.mock.calls
      .filter(c => c[1] === 'safeTimeout.failed')
      .map(c => c[2].name);
    expect(names).toContain('aios_memory_post_turn_chat');
    expect(names).toContain('aios_memory_post_turn_butler');
    warn.mockRestore();
  });
});
