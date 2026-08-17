import {modelStore} from '../../../store';
import {extractAndSaveMemories} from '../index';
import {promptWriter} from '../../promptWriter';
import * as RNFS from '@dr.pogodin/react-native-fs';

// P2 记忆复测（2026-08-17 真机）：旧版 EXTRACTION_SYSTEM 约束过弱 → fact 污染。
// 本套件锁定 v2 语义（只从「大王:」侧提取 / 三类型定义 / 排除清单 / 宁缺勿滥）
// 与解析容错（BOS/围栏剥离、非法 type 兜底），防回归。

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
  DocumentDirectoryPath: '/mock/documents',
  ExternalStorageDirectoryPath: '/mock/storage',
}));

const mockCompletion = promptWriter.completion as jest.Mock;

describe('aiosMemory 提取（P2 v2 语义）', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (RNFS.exists as jest.Mock).mockResolvedValue(false);
    (RNFS.writeFile as jest.Mock).mockResolvedValue(undefined);
    mockCompletion.mockReset();
  });

  /** 模拟引擎流式输出：逐 token 回调 */
  const runWithOutput = async (output: string, user = '大王：我喜欢青色', assistant = '好的，记住了。') => {
    mockCompletion.mockImplementation(
      async (_params: any, onData: (d: {token: string}) => void) => {
        for (const ch of output) {
          onData({token: ch});
        }
        return {timings: {predicted_per_second: 100}};
      },
    );
    await extractAndSaveMemories(user, assistant);
  };

  it('v2 EXTRACTION_SYSTEM 含强约束：只从「大王:」侧提取 + 三类型定义 + 排除清单 + 宁缺勿滥', () => {
    // 通过触发一次提取并捕获传给引擎的 system prompt 验证
    mockCompletion.mockImplementation(
      async (params: any, onData: (d: {token: string}) => void) => {
        const system = params.messages[0].content as string;
        expect(system).toContain('只从「大王:」的发言中提取');
        expect(system).toContain('fact: 大王的长期属性');
        expect(system).toContain('episode: 本次对话中发生的具体事件');
        expect(system).toContain('insight: 女妖对大王或对话的感悟');
        expect(system).toContain('严格排除');
        expect(system).toContain('女妖自己的发言与自述');
        expect(system).toContain('宁缺勿滥');
        onData({token: '{"memories":[]}'});
      },
    );
    return extractAndSaveMemories('大王：我喜欢青色', '好的，记住了。');
  });
  
  it('管家直答模式（modelStore.engine 为空）：提取回退到管家引擎（P2 修复）', async () => {
    expect(modelStore.engine).toBeUndefined(); // 前置：管家直答语义下大模型未加载
    mockCompletion.mockImplementation(
      async (params: any, onData: (d: {token: string}) => void) => {
        // 提取 prompt 传给管家
        expect(params.messages[0].content).toContain('记忆提取助手');
        onData({token: '{"memories":[{"type":"fact","content":"大王喜欢喝茶"}]}'});
      },
    );
    await extractAndSaveMemories('我喜欢喝茶，最爱龙井', '好的，记住了。');
    expect(mockCompletion).toHaveBeenCalledTimes(1);
    const written = lastMemoriesWrite();
    expect(written).toContainEqual(
      expect.objectContaining({type: 'fact', content: '大王喜欢喝茶'}),
    );
  });

  /** 提取记忆 JSON 的最近一次 writeFile 内容（排除 USER.md 聚合写入） */
  const lastMemoriesWrite = (): any[] => {
    const calls = (RNFS.writeFile as jest.Mock).mock.calls;
    const mem = [...calls].reverse().find((c: any[]) => String(c[0]).includes('aios_memories'));
    return JSON.parse(mem![1]);
  };

  it('解析容错：剥离 BOS 前缀与围栏后入库', async () => {
    await runWithOutput('<s>```json\n{"memories":[{"type":"fact","content":"大王喜欢青色"}]}\n```</s>');
    const written = lastMemoriesWrite();
    expect(written).toContainEqual(
      expect.objectContaining({type: 'fact', content: '大王喜欢青色'}),
    );
  });

  it('非法 type 兜底为 episode；空内容跳过', async () => {
    await runWithOutput(
      '{"memories":[{"type":"bogus","content":"大王今天去了西湖"},{"type":"fact","content":"  "}]}',
    );
    const written = lastMemoriesWrite();
    expect(written).toContainEqual(
      expect.objectContaining({type: 'episode', content: '大王今天去了西湖'}),
    );
    // 空 content 不入库
    expect(written.some((m: any) => m.content.trim() === '')).toBe(false);
  });

  it('无值得记的信息输出空数组：不入库（宁缺勿滥）', async () => {
    await runWithOutput('{"memories":[]}');
    // 提取为空 → memories JSON 不写（refreshUserMd 可能因历史 fact 写 USER.md，属预期）
    const calls = (RNFS.writeFile as jest.Mock).mock.calls;
    const memWrites = calls.filter((c: any[]) =>
      String(c[0]).includes('aios_memories'),
    );
    expect(memWrites).toHaveLength(0);
  });

  it('assistant 回复过短（<4 字）不触发提取', async () => {
    mockCompletion.mockImplementation(async () => {
      throw new Error('should not be called');
    });
    await extractAndSaveMemories('大王：你好', '好');
    expect(mockCompletion).not.toHaveBeenCalled();
  });
});
