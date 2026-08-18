import {
  buildMemoryFragment,
  _invalidateCache,
  AiosMemory,
} from '../index';
import {
  trackSentiment,
  buildTodayState,
  maybeClosingSummary,
  listDiaries,
  readDiary,
} from '../rituals';
import * as RNFS from '@dr.pogodin/react-native-fs';

// 意图引导装填 + 情绪持久化测试（批次 9-3）
// 设计依据：dawangshanAIOS STARMAP_CONTEXT_FUNNEL_REFLEX_ARC_SSOT（潜意识装填）

jest.mock('../../../store', () => ({
  modelStore: {
    inferencing: false,
    engine: undefined as any,
  },
}));

jest.mock('../../promptWriter', () => ({
  promptWriter: {
    isLoaded: false,
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

describe('意图引导装填 + 情绪持久化（批次 9-3）', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    _invalidateCache();
    (RNFS.exists as jest.Mock).mockResolvedValue(false);
    (RNFS.readFile as jest.Mock).mockResolvedValue('[]');
    (RNFS.writeFile as jest.Mock).mockResolvedValue(undefined);
  });

  /** 生成混合类型记忆集 */
  const makeMixedMemories = (): AiosMemory[] => {
    const memories: AiosMemory[] = [];
    // 5 facts
    for (let i = 0; i < 5; i++) {
      memories.push({
        id: `fact-${i}`,
        type: 'fact',
        content: `大王喜欢事项${i}`,
        keywords: [`事项${i}`],
        ts: Date.now() - i * 1000,
      });
    }
    // 5 episodes
    for (let i = 0; i < 5; i++) {
      memories.push({
        id: `ep-${i}`,
        type: 'episode',
        content: `大王做了事件${i}`,
        keywords: [`事件${i}`],
        ts: Date.now() - i * 86400000,
      });
    }
    // 3 insights
    for (let i = 0; i < 3; i++) {
      memories.push({
        id: `ins-${i}`,
        type: 'insight',
        content: `大王其实很在意${i}`,
        keywords: [`在意${i}`],
        ts: Date.now() - i * 2000,
      });
    }
    return memories;
  };

  it('task 意图：注入量 ≤4 且 fact 优先', async () => {
    (RNFS.exists as jest.Mock).mockResolvedValue(true);
    (RNFS.readFile as jest.Mock).mockResolvedValue(
      JSON.stringify(makeMixedMemories()),
    );

    // 不传 userText（无关键词命中），测 fallback 策略
    const fragment = await buildMemoryFragment('', 'task');

    // 解析注入的条目数
    const lines = fragment.split('\n').filter(l => l.startsWith('- ['));
    expect(lines.length).toBeLessThanOrEqual(4);
    // fact 类型应占多数（task 意图 fact 优先）
    const factLines = lines.filter(l => l.includes('[fact]'));
    expect(factLines.length).toBeGreaterThan(0);
  });

  it('vent 意图：注入量 ≤4 且 insight 优先', async () => {
    (RNFS.exists as jest.Mock).mockResolvedValue(true);
    (RNFS.readFile as jest.Mock).mockResolvedValue(
      JSON.stringify(makeMixedMemories()),
    );

    const fragment = await buildMemoryFragment('', 'vent');

    const lines = fragment.split('\n').filter(l => l.startsWith('- ['));
    expect(lines.length).toBeLessThanOrEqual(4);
    // insight 类型应出现（vent 意图 insight 优先）
    const insightLines = lines.filter(l => l.includes('[insight]'));
    expect(insightLines.length).toBeGreaterThan(0);
  });

  it('情绪持久化：trackSentiment 落盘 + buildTodayState 读昨日情绪', async () => {
    // trackSentiment 应写入 sentiment.json
    (RNFS.writeFile as jest.Mock).mockResolvedValue(undefined);

    trackSentiment('今天好开心啊');

    // 验证 writeFile 被调用，写入 sentiment.json
    const sentimentWrite = (RNFS.writeFile as jest.Mock).mock.calls.find(
      c => String(c[0]).includes('sentiment.json'),
    );
    expect(sentimentWrite).toBeDefined();
    const record = JSON.parse(sentimentWrite![1]);
    expect(record.score).toBeGreaterThan(0);
    expect(record.label).toBe('愉悦');

    // buildTodayState 读昨日情绪
    (RNFS.exists as jest.Mock).mockImplementation(async (path: string) => {
      if (String(path).includes('sentiment.json')) return true;
      if (String(path).includes('memory')) return true;
      return false;
    });
    (RNFS.readFile as jest.Mock).mockImplementation(async (path: string) => {
      if (String(path).includes('sentiment.json')) {
        return JSON.stringify({score: -1, label: '低落', ts: '2026-08-17'});
      }
      if (String(path).endsWith('.md')) {
        return '# 2026-08-17 对话摘要\n\n大王聊了工作压力';
      }
      return '[]';
    });

    const state = await buildTodayState();

    // 应包含昨日情绪信息
    expect(state).toContain('上次大王情绪');
    expect(state).toContain('低落');
  });

  it('内心生活：buildTodayState 注入收尾预写的晨间独白（P9，INNERLIFE_SPEC）', async () => {
    (RNFS.exists as jest.Mock).mockImplementation(async (path: string) => {
      if (String(path).includes('opening/2026-08-18.md')) return true;
      return false;
    });
    (RNFS.readFile as jest.Mock).mockImplementation(async (path: string) => {
      if (String(path).includes('opening/')) {
        return '大王，昨晚我梦到咱们一起折纸飞机。今天要开心呀。';
      }
      return '';
    });

    const state = await buildTodayState();
    expect(state).toContain('【女妖晨间独白】');
    expect(state).toContain('折纸飞机');
  });

  it('内心生活：无独白文件时回退规则版问候（文件即过期，无兜底）', async () => {
    (RNFS.exists as jest.Mock).mockResolvedValue(false);
    const state = await buildTodayState();
    expect(state).toContain('开场请自然问候大王');
  });

  it('内心生活：收尾三件套②③——明日独白 + 当日日记落盘（P9）', async () => {
    const writeCalls: string[] = [];
    (RNFS.writeFile as jest.Mock).mockImplementation(async (p: string) => {
      writeCalls.push(String(p));
    });
    (RNFS.exists as jest.Mock).mockResolvedValue(false);

    // 模拟已加载引擎（completion 回调拼接输出）
    const mockEngine = {
      completion: jest.fn(
        async (
          params: any,
          cb: (d: {token?: string}) => void,
        ): Promise<void> => {
          if (String(params.messages[0].content).includes('明日清晨独白')) {
            cb({token: '大王，今天也要好好吃饭。'});
          } else if (
            String(params.messages[0].content).includes('当日日记')
          ) {
            cb({token: '今天大王和我聊了模型，他说玩具工坊真好玩。'});
          } else {
            cb({token: '今日小结：大王聊了工作与玩具，还聊了模型调度。女妖记住了玩具工坊很好玩。'});
          }
        },
      ),
    };
    // 重设 modelStore mock 的 engine
    const storeMock = require('../../../store');
    storeMock.modelStore.engine = mockEngine;
    storeMock.modelStore.inferencing = false;

    await maybeClosingSummary('帮我看看这个模型', '好的大王，这就来', 20);

    // 小结已写
    expect(writeCalls.some(p => p.includes('closing.md'))).toBe(true);
    // 明日独白 + 当日日记 fire-and-forget 异步：等待微任务
    await new Promise(r => setTimeout(r, 0));
    expect(writeCalls.some(p => p.includes('opening/'))).toBe(true);
    expect(writeCalls.some(p => p.includes('chick_diary/'))).toBe(true);
    storeMock.modelStore.engine = undefined;
  });

  it('内心生活：listDiaries/readDiary 读取日记（P9）', async () => {
    (RNFS.exists as jest.Mock).mockImplementation(async (path: string) => {
      if (String(path).includes('chick_diary')) return true;
      if (String(path).includes('chick_diary/2026-08-18.md')) return true;
      return false;
    });
    (RNFS.readDir as jest.Mock).mockResolvedValue([
      {name: '2026-08-17.md', path: '/d/2026-08-17.md'},
      {name: '2026-08-18.md', path: '/d/2026-08-18.md'},
    ]);
    (RNFS.readFile as jest.Mock).mockResolvedValue('# 2026-08-18 小鸡日记\n\n今天很开心');

    const diaries = await listDiaries();
    expect(diaries.length).toBe(2);
    expect(diaries[0].date).toBe('2026-08-18'); // 新→旧
    const content = await readDiary('2026-08-18');
    expect(content).toContain('小鸡日记');
  });
});
