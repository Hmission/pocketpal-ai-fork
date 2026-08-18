import {governMemories, rotateOldLogs} from '../governance';
import {_invalidateCache, AiosMemory} from '../index';
import {modelStore} from '../../../store';
import {promptWriter} from '../../promptWriter';
import * as RNFS from '@dr.pogodin/react-native-fs';

// 记忆治理测试（批次 9-2）：蒸馏结构化 + 日志轮转
// 设计依据：dawangshanAIOS AIOS_EVOLUTION_DIGESTION（演化消化范式）

jest.mock('../../../store', () => ({
  modelStore: {
    inferencing: false,
    engine: undefined as any,
  },
}));

jest.mock('../../promptWriter', () => ({
  promptWriter: {
    isLoaded: true,
    completion: jest.fn(),
  },
}));

jest.mock('@dr.pogodin/react-native-fs', () => ({
  exists: jest.fn().mockResolvedValue(false),
  readFile: jest.fn().mockResolvedValue('[]'),
  writeFile: jest.fn().mockResolvedValue(undefined),
  unlink: jest.fn().mockResolvedValue(undefined),
  readDir: jest.fn().mockResolvedValue([]),
  stat: jest.fn().mockResolvedValue({size: 0}),
  mkdir: jest.fn().mockResolvedValue(undefined),
  DocumentDirectoryPath: '/mock/documents',
  ExternalStorageDirectoryPath: '/mock/storage',
}));

const mockCompletion = promptWriter.completion as jest.Mock;

describe('记忆治理（批次 9-2）', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    _invalidateCache();
    (RNFS.exists as jest.Mock).mockResolvedValue(false);
    (RNFS.readFile as jest.Mock).mockResolvedValue('[]');
    (RNFS.writeFile as jest.Mock).mockResolvedValue(undefined);
    (RNFS.unlink as jest.Mock).mockResolvedValue(undefined);
    mockCompletion.mockReset();
  });

  /** 生成 N 条 mock 记忆 */
  const makeMemories = (n: number): AiosMemory[] => {
    const memories: AiosMemory[] = [];
    for (let i = 0; i < n; i++) {
      memories.push({
        id: `mem-${i}`,
        type: i % 3 === 0 ? 'fact' : i % 3 === 1 ? 'episode' : 'insight',
        content: `大王的事项 ${i}`,
        keywords: [`事项${i}`],
        ts: Date.now() - i * 86400000,
      });
    }
    return memories;
  };

  it('蒸馏成功：15 条 → 精简为 5 条', async () => {
    // 设置 mock 文件含 15 条记忆
    (RNFS.exists as jest.Mock).mockResolvedValue(true);
    (RNFS.readFile as jest.Mock).mockResolvedValue(
      JSON.stringify(makeMemories(15)),
    );

    // mock 引擎输出蒸馏后 5 条
    mockCompletion.mockImplementation(
      async (_params: any, onData: (d: {token: string}) => void) => {
        const distilled = [
          {type: 'fact', content: '大王是程序员'},
          {type: 'fact', content: '大王喜欢喝茶'},
          {type: 'fact', content: '大王在学吉他'},
          {type: 'episode', content: '大王去了西湖'},
          {type: 'insight', content: '大王注重细节'},
        ];
        const json = JSON.stringify(distilled);
        for (const ch of json) {
          onData({token: ch});
        }
        return {timings: {predicted_per_second: 100}};
      },
    );

    const result = await governMemories();

    expect(result.distilled).toBe(true);
    expect(result.before).toBe(15);
    expect(result.after).toBe(5);

    // 验证 save 写入了蒸馏后的记忆
    const memWrite = (RNFS.writeFile as jest.Mock).mock.calls.find(
      c => String(c[0]).includes('aios_memories'),
    );
    expect(memWrite).toBeDefined();
    const saved = JSON.parse(memWrite![1]);
    expect(saved).toHaveLength(5);
    expect(saved[0].content).toBe('大王是程序员');
    expect(saved[0].keywords).toBeDefined();
    expect(saved[0].keywords.length).toBeGreaterThan(0);
  });

  it('记忆不足 10 条时跳过蒸馏', async () => {
    (RNFS.exists as jest.Mock).mockResolvedValue(true);
    (RNFS.readFile as jest.Mock).mockResolvedValue(
      JSON.stringify(makeMemories(5)),
    );

    const result = await governMemories();

    expect(result.distilled).toBe(false);
    expect(result.error).toContain('不足');
    expect(mockCompletion).not.toHaveBeenCalled();
  });

  it('日志轮转：删除 90 天前的对话日志', async () => {
    const oldDate = new Date(Date.now() - 100 * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);
    const newDate = new Date().toISOString().slice(0, 10);

    (RNFS.exists as jest.Mock).mockResolvedValue(true);
    (RNFS.readDir as jest.Mock).mockResolvedValue([
      {name: `${oldDate}.md`, path: `/mock/conv/${oldDate}.md`},
      {name: `${newDate}.md`, path: `/mock/conv/${newDate}.md`},
      {name: 'invalid-name.txt', path: '/mock/conv/invalid-name.txt'},
    ]);

    const deleted = await rotateOldLogs();

    // 旧文件被删除，新文件保留
    expect(deleted).toBe(1);
    expect(RNFS.unlink).toHaveBeenCalledTimes(1);
    expect((RNFS.unlink as jest.Mock).mock.calls[0][0]).toContain(oldDate);
  });
});
