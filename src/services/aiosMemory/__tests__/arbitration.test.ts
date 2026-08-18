import {
  addMemory,
  buildMemoryFragment,
  refreshUserMd,
  extractAttrSlot,
  clearMemories,
  _invalidateCache,
  AiosMemory,
} from '../index';
import * as RNFS from '@dr.pogodin/react-native-fs';

// 9D 轻量裁决测试（批次 9-1）：supersede 链 + episode TTL + USER.md 链尾聚合
// 设计依据：dawangshanAIOS eng-9d-memory-bus（precedence/stale_after/supersedes/freshness）

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

describe('9D 轻量裁决（批次 9-1）', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    _invalidateCache();
    (RNFS.exists as jest.Mock).mockResolvedValue(false);
    (RNFS.readFile as jest.Mock).mockResolvedValue('[]');
    (RNFS.writeFile as jest.Mock).mockResolvedValue(undefined);
  });

  /** 从 writeFile 调用中提取最后一次 aios_memories.json 的内容 */
  const lastMemWrite = (): AiosMemory[] => {
    const calls = (RNFS.writeFile as jest.Mock).mock.calls;
    const mem = [...calls]
      .reverse()
      .find((c: any[]) => String(c[0]).includes('aios_memories'));
    return mem ? JSON.parse(mem![1]) : [];
  };

  it('同属性 fact 新替旧：改口后旧条被标记 supersededBy', async () => {
    await clearMemories();
    await addMemory('fact', '大王最喜欢杭州');
    await addMemory('fact', '大王最喜欢上海'); // 同 slot=preference → 旧条 supersede

    const written = lastMemWrite();
    const hangzhou = written.find(m => m.content === '大王最喜欢杭州');
    const shanghai = written.find(m => m.content === '大王最喜欢上海');

    expect(hangzhou?.supersededBy).toBeDefined();
    expect(hangzhou?.supersededBy).toBe(shanghai?.id);
    expect(shanghai?.supersededBy).toBeUndefined();
    expect(hangzhou?.attrSlot).toBe('preference');
    expect(shanghai?.attrSlot).toBe('preference');
  });

  it('不同属性槽不互相替代：偏好与活动并存', async () => {
    await clearMemories();
    await addMemory('fact', '大王喜欢喝茶'); // slot=preference
    await addMemory('fact', '大王在学吉他'); // slot=activity

    const written = lastMemWrite();
    const tea = written.find(m => m.content === '大王喜欢喝茶');
    const guitar = written.find(m => m.content === '大王在学吉他');

    // 不同属性槽，互不替代
    expect(tea?.supersededBy).toBeUndefined();
    expect(guitar?.supersededBy).toBeUndefined();
    expect(tea?.attrSlot).toBe('preference');
    expect(guitar?.attrSlot).toBe('activity');
  });

  it('buildMemoryFragment 过滤被替代的记忆 + episode 30 天 TTL', async () => {
    // 设置 mock 文件数据（不调用 addMemory 避免 cache 污染）
    const runningFact: AiosMemory = {
      id: 'fact-run',
      type: 'fact',
      content: '大王喜欢跑步',
      attrSlot: 'preference',
      keywords: ['跑步'],
      ts: Date.now(),
    };
    // 旧 episode（超过 30 天）
    const oldEpisode: AiosMemory = {
      id: 'old-ep-1',
      type: 'episode',
      content: '大王去了西湖',
      keywords: ['西湖'],
      ts: Date.now() - 35 * 24 * 60 * 60 * 1000, // 35 天前
    };
    // 新 episode（未过期）
    const newEpisode: AiosMemory = {
      id: 'new-ep-1',
      type: 'episode',
      content: '大王看了电影',
      keywords: ['电影'],
      ts: Date.now() - 3 * 24 * 60 * 60 * 1000, // 3 天前
    };
    // 被替代的旧 fact
    const oldFact: AiosMemory = {
      id: 'old-fact-1',
      type: 'fact',
      content: '大王喜欢杭州',
      attrSlot: 'preference',
      supersededBy: 'new-fact-1',
      keywords: ['杭州'],
      ts: Date.now() - 10 * 24 * 60 * 60 * 1000,
    };

    // 直接写入 mock 文件（绕过 addMemory，保持 cache 为 null 使 load() 读文件）
    const allMemories = [runningFact, oldEpisode, newEpisode, oldFact];
    (RNFS.exists as jest.Mock).mockResolvedValue(true);
    (RNFS.readFile as jest.Mock).mockResolvedValue(
      JSON.stringify(allMemories),
    );

    const fragment = await buildMemoryFragment('西湖');
    // 被替代的旧 fact 不出现
    expect(fragment).not.toContain('杭州');
    // 过期的 episode 不出现
    expect(fragment).not.toContain('西湖');
    // 新 episode 和新 fact 出现
    expect(fragment).toContain('跑步');
    expect(fragment).toContain('电影');
  });

  it('refreshUserMd 只聚合 supersede 链尾（画像不自相矛盾）', async () => {
    const oldFact: AiosMemory = {
      id: 'old-1',
      type: 'fact',
      content: '大王最喜欢杭州',
      attrSlot: 'preference',
      supersededBy: 'new-1',
      keywords: [],
      ts: Date.now() - 86400000,
    };
    const newFact: AiosMemory = {
      id: 'new-1',
      type: 'fact',
      content: '大王最喜欢上海',
      attrSlot: 'preference',
      keywords: [],
      ts: Date.now(),
    };
    const independent: AiosMemory = {
      id: 'fact-2',
      type: 'fact',
      content: '大王在学吉他',
      attrSlot: 'activity',
      keywords: [],
      ts: Date.now(),
    };

    (RNFS.exists as jest.Mock).mockResolvedValue(true);
    (RNFS.readFile as jest.Mock).mockResolvedValue(
      JSON.stringify([oldFact, newFact, independent]),
    );

    await refreshUserMd();

    const userWrite = (RNFS.writeFile as jest.Mock).mock.calls.find(
      c => String(c[0]).includes('USER.md'),
    );
    expect(userWrite).toBeDefined();
    const content = userWrite![1] as string;
    // 链尾（新 fact）出现
    expect(content).toContain('上海');
    // 被替代的旧 fact 不出现（不自相矛盾）
    expect(content).not.toContain('杭州');
    // 独立 fact 出现
    expect(content).toContain('吉他');
  });
});
