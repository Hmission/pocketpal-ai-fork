import {
  buildMemoryFragment,
  _invalidateCache,
  AiosMemory,
} from '../index';
import {trackSentiment, buildTodayState} from '../rituals';
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
});
