import {
  addMemory,
  buildMemoryFragment,
  refreshUserMd,
  clearMemories,
  memoryDimension,
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
    (RNFS.readFile as jest.Mock).mockResolvedValue(JSON.stringify(allMemories));

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

    const userWrite = (RNFS.writeFile as jest.Mock).mock.calls.find(c =>
      String(c[0]).includes('USER.md'),
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

describe('9D 维度：派生视图而非落盘字段（§Wave C+ / CORE-5）', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    _invalidateCache();
    (RNFS.exists as jest.Mock).mockResolvedValue(false);
    (RNFS.readFile as jest.Mock).mockResolvedValue('[]');
    (RNFS.writeFile as jest.Mock).mockResolvedValue(undefined);
  });

  it('维度由 type 唯一确定：fact→D7、insight→D5、episode→通用', () => {
    expect(memoryDimension({type: 'fact'})).toBe('D7');
    expect(memoryDimension({type: 'insight'})).toBe('D5');
    expect(memoryDimension({type: 'episode'})).toBe('');
  });

  it('落库不含 dimension 字段（存了就是第二个可漂移的事实源）', async () => {
    await clearMemories();
    await addMemory('fact', '大王喜欢青色');
    const written = lastMemWriteOf();
    expect(written).toHaveLength(1);
    expect(Object.prototype.hasOwnProperty.call(written[0], 'dimension')).toBe(
      false,
    );
  });

  /** 取最后一次 aios_memories.json 写入内容 */
  function lastMemWriteOf(): AiosMemory[] {
    const calls = (RNFS.writeFile as jest.Mock).mock.calls;
    const mem = [...calls]
      .reverse()
      .find((c: any[]) => String(c[0]).includes('aios_memories'));
    return mem ? JSON.parse(mem[1]) : [];
  }

  it('同相关性时 D7 优先于 D5，即使 D5 更新（维度次键真的接进了排序）', async () => {
    const now = Date.now();
    const factOlder: AiosMemory = {
      id: 'f1',
      type: 'fact',
      content: '大王喜欢青色',
      keywords: ['青色'],
      ts: now - 10 * 86400000, // 旧
    };
    const insightNewer: AiosMemory = {
      id: 'i1',
      type: 'insight',
      content: '女妖觉得大王在意青色',
      keywords: ['青色'],
      ts: now, // 新
    };
    (RNFS.exists as jest.Mock).mockResolvedValue(true);
    (RNFS.readFile as jest.Mock).mockResolvedValue(
      JSON.stringify([factOlder, insightNewer]),
    );

    const fragment = await buildMemoryFragment('青色');
    const iFact = fragment.indexOf('大王喜欢青色');
    const iInsight = fragment.indexOf('女妖觉得大王在意青色');
    expect(iFact).toBeGreaterThanOrEqual(0);
    expect(iInsight).toBeGreaterThanOrEqual(0);
    // 两者 score 均为 1（都命中‘青色’）→ 进入次键：D7 优于 D5。
    // 旧实现无次键（同分保持数组原序），且那条「9D 按需注入」因 dimension 恒空
    // 只能给出「最新 3 条」——所以本断言对旧行为有真鉴别力。
    expect(iFact).toBeLessThan(iInsight);
  });

  it('同维度同分时新者优先（排序是全序，不因写盘顺序拖动注入集）', async () => {
    const now = Date.now();
    const older: AiosMemory = {
      id: 'f1',
      type: 'fact',
      content: '大王在学吉他',
      keywords: ['吉他'],
      ts: now - 5 * 86400000,
    };
    const newer: AiosMemory = {
      id: 'f2',
      type: 'fact',
      content: '大王在写歌',
      keywords: ['吉他'],
      ts: now,
    };
    (RNFS.exists as jest.Mock).mockResolvedValue(true);
    // 故意把旧的排在数组前面（load 原序）：若无末键，原序会直接泄进输出
    (RNFS.readFile as jest.Mock).mockResolvedValue(
      JSON.stringify([older, newer]),
    );

    const fragment = await buildMemoryFragment('吉他');
    expect(fragment.indexOf('大王在写歌')).toBeLessThan(
      fragment.indexOf('大王在学吉他'),
    );
  });
});
