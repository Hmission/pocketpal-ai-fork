/**
 * kg 单测（AIOS_CORE_SPEC Wave C）：轻量图谱构建 + 问谱（先问谱后 grep）
 */
import * as RNFS from '@dr.pogodin/react-native-fs';
import {
  buildKg,
  recallKg,
  extractKeywords,
  kgSnapshot,
  resetKgCache,
} from '../kg';
import {AIOS_CONVERSATIONS_DIR, AIOS_DB_DIR} from '../../../utils/paths';

jest.mock('@dr.pogodin/react-native-fs', () => ({
  exists: jest.fn().mockResolvedValue(false),
  readFile: jest.fn().mockResolvedValue(''),
  writeFile: jest.fn().mockResolvedValue(undefined),
  appendFile: jest.fn().mockResolvedValue(undefined),
  mkdir: jest.fn().mockResolvedValue(undefined),
  readDir: jest.fn().mockResolvedValue([]),
  DocumentDirectoryPath: '/mock/documents',
  ExternalStorageDirectoryPath: '/mock/storage',
}));

jest.mock('../../../debug/eventStream', () => ({
  emit: jest.fn(),
}));

jest.mock('../../aiosMemory', () => ({
  listMemories: jest.fn(),
}));

import {listMemories} from '../../aiosMemory';
const mockListMemories = listMemories as jest.Mock;

const CONV_CONTENT =
  '## 2026-09-04\n我们一起做了苹果派，苹果派很甜，她喜欢烘焙的味道。\n';

describe('kg（AIOS_CORE_SPEC Wave C）', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetKgCache();
    (RNFS.exists as jest.Mock).mockResolvedValue(false);
    mockListMemories.mockResolvedValue([
      {
        id: 'm1',
        type: 'insight',
        content: '她喜欢吃苹果派，苹果派是甜的，烘焙让她安心。',
        keywords: ['苹果派', '甜', '烘焙'],
        ts: 1,
        supersededBy: 'm2',
      },
      {
        id: 'm2',
        type: 'insight',
        content: '苹果派烘焙是她的安心仪式。',
        keywords: ['苹果派', '烘焙'],
        ts: 2,
      },
    ]);
    (RNFS.readDir as jest.Mock).mockResolvedValue([
      {name: '2026-09-04.md', isFile: () => true, isDirectory: () => false},
    ]);
    (RNFS.readFile as jest.Mock).mockImplementation((path: string) =>
      Promise.resolve(
        String(path).includes(AIOS_CONVERSATIONS_DIR) ? CONV_CONTENT : '',
      ),
    );
  });

  it('extractKeywords：CJK 二元组 + ASCII 词，剔除停用词', () => {
    const kws = extractKeywords(
      '今天天气不错，我们一起做苹果派吧 apple pie',
      12,
    );
    expect(kws).toContain('苹果');
    expect(kws).toContain('果派');
    expect(kws).not.toContain('今天');
    expect(kws).toContain('apple');
    expect(kws.length).toBeLessThanOrEqual(12);
  });

  it('buildKg：记忆+会话节点落图，共现建边，持久化 kg.json', async () => {
    await buildKg();

    const snap = kgSnapshot();
    expect(snap.nodes).toBeGreaterThanOrEqual(3); // m1 + m2 + conv
    expect(snap.edges).toBeGreaterThanOrEqual(2); // supersede m1→m2 + 共现 conv 边

    // 持久化：写 kg.json（AIOS_DB_DIR 下）
    const writeCall = (RNFS.writeFile as jest.Mock).mock.calls.find(c =>
      String(c[0]).startsWith(`${AIOS_DB_DIR}/kg.json`),
    );
    expect(writeCall).toBeTruthy();
    const payload = JSON.parse(String(writeCall![1]));
    expect(payload.nodes.some((n: any) => n.id === 'memory:m1')).toBe(true);
    expect(payload.nodes.some((n: any) => n.id === 'conv:2026-09-04.md')).toBe(
      true,
    );
    expect(
      payload.edges.some(
        (e: any) =>
          e.rel === 'supersedes' &&
          e.from === 'memory:m1' &&
          e.to === 'memory:m2',
      ),
    ).toBe(true);
  });

  it('recallKg：关键词直达命中（direct）', async () => {
    await buildKg();
    const hits = await recallKg('苹果派', 3);
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0].label).toContain('苹果派');
    expect(hits[0].via).toBe('direct');
  });

  it('recallKg：一跳边扩张拉同语境会话（neighbor）', async () => {
    await buildKg();
    const hits = await recallKg('安心仪式', 4);
    // 记忆 m1/m2 直接命中；2026-09-04 会话经共现边 neighbor 补位
    expect(hits.some(h => h.type === 'memory')).toBe(true);
    expect(hits.some(h => h.via === 'neighbor' && h.type === 'conv')).toBe(
      true,
    );
  });

  it('recallKg：无命中返回空数组（调用方走全文降级链）', async () => {
    await buildKg();
    const hits = await recallKg('量子力学费曼图', 3);
    expect(hits).toEqual([]);
  });

  it('recallKg：既有 kg.json 从磁盘加载（不重建）', async () => {
    (RNFS.exists as jest.Mock).mockResolvedValue(true);
    (RNFS.readFile as jest.Mock).mockResolvedValue(
      JSON.stringify({
        nodes: [
          {
            id: 'memory:x1',
            type: 'memory',
            label: '[insight] 旧图谱节点',
            snippet: '旧图谱内容',
            keywords: ['旧图谱'],
            ts: 1,
          },
        ],
        edges: [],
      }),
    );
    const hits = await recallKg('旧图谱', 3);
    expect(hits).toHaveLength(1);
    expect(hits[0].id).toBe('memory:x1');
  });
});
