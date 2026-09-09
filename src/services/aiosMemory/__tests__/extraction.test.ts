import {modelStore} from '../../../store';
import {extractAndSaveMemories, _invalidateCache} from '../index';
import {promptWriter} from '../../promptWriter';
import {emit} from '../../../debug/eventStream';
import * as RNFS from '@dr.pogodin/react-native-fs';

// P2 记忆复测（2026-08-17 真机）：旧版 EXTRACTION_SYSTEM 约束过弱 → fact 类型污染。
// 本套件锁定 v2/v3 语义（只从「大王:」侧提取 / 三类型定义 / 排除清单 / 宁缺勿滥）、
// 解析容错（BOS/围栏剥离、非法 type 兜底），以及 §Wave E-3 的引擎归属与 provenance 口径。
//
// ⚠ 结构约定（§七 CORE-11，本套件曾因违反它而假绿）：
// **断言一律写在 await 之后的测试体内**，mock 回调只做两件事——把收到的 params 存下来、
// 吐指定输出。旧写法把 12 条 toContain 塞进 mockImplementation 内部，而
// extractAndSaveMemories 末尾有 `catch (e) { console.warn(...) }`：断言抛出的异常被那个
// catch 整吞，测试恒不可红。实测证据：其中一条断言的字面量在源码里根本不存在，套件仍报
// 6 passed。每条用 params 的用例都先断言「回调真的跑过」，避免退化成空跑。

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

jest.mock('../../../debug/eventStream', () => ({
  emit: jest.fn(),
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
const mockEmit = emit as jest.Mock;

/** 引擎收到的 params（断言用）；null 表示回调根本没跑到 */
let seenParams: any = null;

const stubEngine = (output: string) => {
  mockCompletion.mockImplementation(
    async (params: any, onData: (d: {token: string}) => void) => {
      seenParams = params;
      for (const ch of output) {
        onData({token: ch});
      }
      return {timings: {predicted_per_second: 100}};
    },
  );
};

/** 提取记忆 JSON 的最近一次 writeFile 内容（排除 USER.md 聚合写入） */
const lastMemoriesWrite = (): any[] => {
  const calls = (RNFS.writeFile as jest.Mock).mock.calls;
  const mem = [...calls]
    .reverse()
    .find((c: any[]) => String(c[0]).includes('aios_memories'));
  if (!mem) {
    throw new Error('本轮没有写 aios_memories.json（提取未落库）');
  }
  return JSON.parse(mem[1]);
};

const USER = '大王：我喜欢青色';
const ASSISTANT = '好的，记住了。';

const runExtraction = async (
  output: string,
  user = USER,
  assistant = ASSISTANT,
) => {
  stubEngine(output);
  await extractAndSaveMemories(user, assistant);
  // 每条用例的前置：引擎回调确实执行过（否则下面的 params 断言全是空跑）
  expect(seenParams).not.toBeNull();
};

describe('aiosMemory 提取（P2 v2/v3 语义）', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    seenParams = null;
    _invalidateCache();
    (RNFS.exists as jest.Mock).mockResolvedValue(false);
    (RNFS.readFile as jest.Mock).mockResolvedValue('[]');
    (RNFS.writeFile as jest.Mock).mockResolvedValue(undefined);
    mockCompletion.mockReset();
  });

  it('EXTRACTION_SYSTEM 强约束：只从「大王:」侧提取 + 三类型定义 + 排除清单 + 宁缺勿滥', async () => {
    await runExtraction('{"memories":[]}');
    const system = seenParams.messages[0].content as string;
    expect(system).toContain('只从「大王:」的发言中提取');
    // v3（2026-08-23 三闸·闸1）：fact 定义收严为「长期稳定（跨天仍成立）」
    expect(system).toContain('fact: 大王的长期稳定属性');
    expect(system).toContain('episode: 本次对话中发生的具体事件');
    expect(system).toContain('insight: 女妖对大王或对话的感悟');
    expect(system).toContain('严格排除');
    expect(system).toContain('女妖自己的发言与自述');
    expect(system).toContain('宁缺勿滥');
    expect(system).toContain('瞬时状态');
    expect(system).toContain('时效内容');
    expect(system).toContain('失败记录');
    expect(system).toContain('跨天仍成立');
    // 对话必须按「大王:/女妖:」两侧喂入：提取侧只能看到带这两个前缀的真实发言
    const userTurn = seenParams.messages[1].content as string;
    expect(userTurn).toContain('大王: ');
    expect(userTurn).toContain('女妖: ');
    expect(userTurn).toContain(USER);
  });

  it('结构化输出约束真的传给引擎：response_format(json_schema) + temperature 0 + enable_thinking false', async () => {
    // response_format 是 llama.rn 转 grammar 的入口（本地 index.ts 把它转成
    // native json_schema→grammar），也是远端 openaiClient 的透传字段——两边共用
    // 同一个 schema 真源。它一旦被误删，本地就退回「小模型裸产 JSON + 扫大括号兜底」，
    // 而那正是 provenance 想度量的东西，所以必须锁在断言里而不是只写在注释里。
    await runExtraction('{"memories":[]}');
    expect(seenParams.response_format).toEqual({
      type: 'json_schema',
      json_schema: {
        strict: true,
        schema: expect.objectContaining({
          type: 'object',
          required: ['memories'],
        }),
      },
    });
    expect(seenParams.temperature).toBe(0);
    expect(seenParams.enable_thinking).toBe(false);
    expect(typeof seenParams.n_predict).toBe('number');
  });

  it('管家直答模式（modelStore.engine 为空）：提取回退到管家引擎（P2 修复）', async () => {
    expect(modelStore.engine).toBeUndefined(); // 前置：管家直答语义下大模型未加载
    await runExtraction(
      '{"memories":[{"type":"fact","content":"大王喜欢喝茶"}]}',
      '我喜欢喝茶，最爱龙井',
      '好的，记住了。',
    );
    expect(mockCompletion).toHaveBeenCalledTimes(1);
    expect(seenParams.messages[0].content).toContain('记忆提取助手');
    const written = lastMemoriesWrite();
    expect(written).toContainEqual(
      expect.objectContaining({type: 'fact', content: '大王喜欢喝茶'}),
    );
  });

  it('解析容错：剥离 BOS 前缀与围栏后入库', async () => {
    await runExtraction(
      '<s>```json\n{"memories":[{"type":"fact","content":"大王喜欢青色"}]}\n```</s>',
    );
    expect(lastMemoriesWrite()).toContainEqual(
      expect.objectContaining({type: 'fact', content: '大王喜欢青色'}),
    );
  });

  it('非法 type 兜底为 episode；空内容跳过', async () => {
    await runExtraction(
      '{"memories":[{"type":"bogus","content":"大王今天去了西湖"},{"type":"fact","content":"  "}]}',
    );
    const written = lastMemoriesWrite();
    expect(written).toContainEqual(
      expect.objectContaining({type: 'episode', content: '大王今天去了西湖'}),
    );
    expect(written.some((m: any) => m.content.trim() === '')).toBe(false);
  });

  it('无值得记的信息输出空数组：不入库（宁缺勿滥）', async () => {
    stubEngine('{"memories":[]}');
    await extractAndSaveMemories(USER, ASSISTANT);
    const memWrites = (RNFS.writeFile as jest.Mock).mock.calls.filter(
      (c: any[]) => String(c[0]).includes('aios_memories'),
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

describe('provenance 与可观测性（§Wave E-3 / CORE-6）', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    seenParams = null;
    _invalidateCache();
    (RNFS.exists as jest.Mock).mockResolvedValue(false);
    (RNFS.readFile as jest.Mock).mockResolvedValue('[]');
    mockCompletion.mockReset();
  });

  it('grammar 一次解出：provenance=local 并 emit memory.extracted', async () => {
    await runExtraction(
      '{"memories":[{"type":"fact","content":"大王喜欢青色"}]}',
    );
    expect(lastMemoriesWrite()[0]).toMatchObject({
      type: 'fact',
      provenance: 'local',
    });
    expect(mockEmit).toHaveBeenCalledWith(
      'app',
      'memory.extracted',
      expect.objectContaining({count: 1, proposed: 1, provenance: 'local'}),
    );
  });

  it('输出掺杂讯走扫括号兜底：provenance=local_fallback_parse（兜底率可数）', async () => {
    await runExtraction(
      '好的，我整理一下。 {"memories":[{"type":"fact","content":"大王住在杭州"}]} 以上。',
    );
    expect(lastMemoriesWrite()[0]).toMatchObject({
      content: '大王住在杭州',
      provenance: 'local_fallback_parse',
    });
    expect(mockEmit).toHaveBeenCalledWith(
      'app',
      'memory.extracted',
      expect.objectContaining({provenance: 'local_fallback_parse'}),
    );
  });

  it('抽取失败不再只 console.warn：emit memory.failed（静默 catch 必须留痕）', async () => {
    mockCompletion.mockRejectedValue(new Error('ctx busy'));
    await extractAndSaveMemories(USER, ASSISTANT);
    expect(mockEmit).toHaveBeenCalledWith(
      'app',
      'memory.failed',
      expect.objectContaining({error: 'ctx busy'}),
    );
  });

  it('不再接受第三个入参：引擎不由调用方注入（防开第二个引擎决策点）', async () => {
    // extractAndSaveMemories 的 arity 必须为 2。接回 opts 就等于允许调用方塞远端引擎，
    // 而抽取每轮都跑 → 等于把对话内容自动上行，违反 §2.1 隐私本地化（§Wave E-3）。
    expect(extractAndSaveMemories.length).toBe(2);
  });
});
