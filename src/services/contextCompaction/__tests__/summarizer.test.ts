/**
 * 会话摘要生成测试（批次 B：摘要执行 + B19.1 预算裁剪）。
 */
import {
  CHARS_PER_TOKEN_CONSERVATIVE,
  summarizeConversation,
  tokenBudgetToMaxChars,
} from '../summarizer';
import {modelStore} from '../../../store';
import {promptWriter} from '../../promptWriter';

jest.mock('../../../store', () => ({
  modelStore: {inferencing: false, engine: undefined as any},
}));

jest.mock('../../promptWriter', () => ({
  promptWriter: {isLoaded: false, completion: jest.fn()},
}));

const streamEngine = (output: string) => {
  // 按 token 流式吐字，模拟 completion 回调
  let idx = 0;
  return {
    completion: jest.fn(async (_params: any, cb?: (d: any) => void) => {
      while (idx < output.length) {
        cb?.({token: output[idx++]});
      }
      return {content: output, text: output};
    }),
    stopCompletion: jest.fn(),
  } as any;
};

describe('summarizeConversation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (modelStore as any).inferencing = false;
    (modelStore as any).engine = undefined;
    (promptWriter as any).isLoaded = false;
  });

  it('注入引擎时用注入引擎生成摘要（去除思考前缀）', async () => {
    const engine = streamEngine('【摘要】大王喜欢本地 AI 玩具。');
    const out = await summarizeConversation(
      {dialogueText: '大王: 你好\n女妖: 嗨'},
      engine,
    );
    expect(out).toBe('【摘要】大王喜欢本地 AI 玩具。');
    expect(engine.completion).toHaveBeenCalledTimes(1);
    const params = engine.completion.mock.calls[0][0];
    expect(params.temperature).toBe(0.3);
    expect(params.n_predict).toBe(220);
  });

  it('摘要过短（<8 字）视为失败返回 null', async () => {
    const out = await summarizeConversation(
      {dialogueText: '短对话'},
      streamEngine('太短'),
    );
    expect(out).toBeNull();
  });

  it('completion 抛错返回 null（容量约束前置，不靠运行时回退）', async () => {
    const engine = {
      completion: jest.fn().mockRejectedValue(new Error('boom')),
      stopCompletion: jest.fn(),
    } as any;
    expect(await summarizeConversation({dialogueText: 'x'}, engine)).toBeNull();
  });

  it('B19.1 maxInputChars 预算裁剪：输入超预算被截断', async () => {
    const engine = streamEngine('这是一段足够长的摘要内容');
    const longDialogue = '大'.repeat(9999);
    await summarizeConversation(
      {dialogueText: longDialogue, maxInputChars: 100},
      engine,
    );
    const userContent = engine.completion.mock.calls[0][0].messages[1].content;
    expect(userContent.length).toBe(100);
  });

  it('B19.1 预算缺省回退 6000 字符', async () => {
    const engine = streamEngine('这是一段足够长的摘要内容');
    await summarizeConversation(
      {dialogueText: '大'.repeat(9999)},
      engine,
    );
    const userContent = engine.completion.mock.calls[0][0].messages[1].content;
    expect(userContent.length).toBe(6000);
  });

  it('推理中返回 null（不抢引擎）', async () => {
    (modelStore as any).inferencing = true;
    const out = await summarizeConversation(
      {dialogueText: 'x'},
      streamEngine('这是一段摘要'),
    );
    expect(out).toBeNull();
  });

  it('无引擎（当前模型与管家均不可用）返回 null', async () => {
    expect(await summarizeConversation({dialogueText: 'x'})).toBeNull();
  });

  it('增量压缩：priorSummary 拼进用户侧', async () => {
    const engine = streamEngine('这是一段足够长的摘要内容');
    await summarizeConversation(
      {dialogueText: '新增对话', priorSummary: '旧摘要'},
      engine,
    );
    const userContent = engine.completion.mock.calls[0][0].messages[1].content;
    expect(userContent).toContain('旧摘要');
    expect(userContent).toContain('新增对话');
  });
});

describe('B19.1 tokenBudgetToMaxChars 保守折算', () => {
  it('1:1 折算（中文最坏 1 字符 = 1 token，宁少勿溢）', () => {
    expect(CHARS_PER_TOKEN_CONSERVATIVE).toBe(1);
    expect(tokenBudgetToMaxChars(7792)).toBe(7792);
    expect(tokenBudgetToMaxChars(0)).toBe(0);
  });
});
