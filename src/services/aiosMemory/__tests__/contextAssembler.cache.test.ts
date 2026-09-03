/**
 * contextAssembler 静态文件缓存测试（B2，2026-08-31）：
 * SOUL/USER/AGENTS 人设静态文件按 mtime 缓存——第二次组装（mtime 未变）
 * 不得再次 readFile；MEMORY 与召回每轮重读。mtime 变化 → 缓存失效重读。
 */
import {assembleContext} from '../contextAssembler';

// 可控 RNFS：文件表驱动 exists/stat/readFile；计数暴露给断言（jest.mock
// factory 闭包内维护状态，测试经 jest.requireMock 访问）
jest.mock('@dr.pogodin/react-native-fs', () => {
  const files = new Map<string, {mtimeMs: number; content: string}>();
  const readCount = new Map<string, number>();
  return {
    files,
    readCount,
    exists: jest.fn(async (p: string) => files.has(p)),
    stat: jest.fn(async (p: string) => ({
      mtime: new Date(files.get(p)?.mtimeMs ?? 0),
    })),
    readFile: jest.fn(async (p: string) => {
      readCount.set(p, (readCount.get(p) ?? 0) + 1);
      return files.get(p)?.content ?? '';
    }),
    readDir: jest.fn(async () => []),
    writeFile: jest.fn(async () => undefined),
    appendFile: jest.fn(async () => undefined),
    unlink: jest.fn(async () => undefined),
    mkdir: jest.fn(async () => undefined),
    DocumentDirectoryPath: '/mock/docs',
    ExternalDirectoryPath: '/mock/external',
  };
});

jest.mock('../index', () => ({
  buildMemoryFragment: jest.fn(async () => '记忆碎片片段'),
}));
jest.mock('../searchEngine', () => ({
  searchMemory: jest.fn(async () => []),
}));
jest.mock('../rituals', () => ({
  buildTodayState: jest.fn(async () => ''),
  intentGuidance: jest.fn(() => ''),
  trackSentiment: jest.fn(),
}));
jest.mock('../conversationLog', () => ({
  getLastWriteTime: jest.fn(() => undefined),
}));

import {
  AIOS_SOUL_FILE,
  AIOS_USER_FILE,
  AIOS_AGENTS_FILE,
  AIOS_MEMORY_FILE,
} from '../../../utils/paths';

const SOUL = '## 女妖人设';
const USER = '## 大王画像';
const AGENTS = '## 协作规范';
const MEMORY = '## 记忆文档';

const runs = (count = 2) =>
  Promise.all(
    Array.from({length: count}, () =>
      assembleContext('你好', 0, 5, 'chat' as never),
    ),
  );

describe('assembleContext 静态文件缓存（B2）', () => {
  let fs: {
    files: Map<string, {mtimeMs: number; content: string}>;
    readCount: Map<string, number>;
  };
  // 每用例递增基址：模块级静态缓存的 mtime 与文件表天然错开，
  // 首读必然 miss（缓存跨用例残留不污染断言）
  let base = 0;

  beforeEach(() => {
    base += 100000;
    fs = jest.requireMock(
      '@dr.pogodin/react-native-fs',
    ) as unknown as typeof fs;
    fs.files.clear();
    fs.readCount.clear();
    fs.files.set(AIOS_SOUL_FILE, {mtimeMs: base + 1, content: SOUL});
    fs.files.set(AIOS_USER_FILE, {mtimeMs: base + 2, content: USER});
    fs.files.set(AIOS_AGENTS_FILE, {mtimeMs: base + 3, content: AGENTS});
    fs.files.set(AIOS_MEMORY_FILE, {mtimeMs: base + 4, content: MEMORY});
  });

  const readCountOf = (path: string): number => fs.readCount.get(path) ?? 0;

  it('首次组装读静态文件各一次；mtime 未变时二次组装不再读（命中缓存）', async () => {
    await runs(2);
    // SOUL/USER/AGENTS 只读一次（第二次命中 mtime 缓存）
    expect(readCountOf(AIOS_SOUL_FILE)).toBe(1);
    expect(readCountOf(AIOS_USER_FILE)).toBe(1);
    expect(readCountOf(AIOS_AGENTS_FILE)).toBe(1);
    // MEMORY 每轮重读（内容随记忆写盘变化，不缓存）
    expect(readCountOf(AIOS_MEMORY_FILE)).toBe(2);
  });

  it('静态文件 mtime 变化（用户编辑）→ 缓存失效重读', async () => {
    await runs(1);
    expect(readCountOf(AIOS_SOUL_FILE)).toBe(1);
    fs.files.set(AIOS_SOUL_FILE, {
      mtimeMs: base + 99999,
      content: `${SOUL}新版`,
    });
    await runs(1);
    expect(readCountOf(AIOS_SOUL_FILE)).toBe(2);
    // 未变化的文件仍命中缓存
    expect(readCountOf(AIOS_USER_FILE)).toBe(1);
  });

  it('组装结果携带静态层内容，缓存命中不丢 content', async () => {
    const [first, second] = await runs(2);
    expect(first.systemPrompt).toContain(SOUL);
    expect(first.systemPrompt).toContain(USER);
    expect(first.systemPrompt).toContain(AGENTS);
    expect(second.systemPrompt).toContain(SOUL);
  });

  it('conversations 目录缺失（dirty env）→ 召回跳过且不抛错', async () => {
    // AIOS_CONVERSATIONS_DIR 不在文件表 → exists=false
    const result = await assembleContext('你好', 0, 5, 'chat' as never);
    expect(result.recalledFragments).toEqual([]);
    expect(result.dirtyEnvironment).toBe(true);
  });
});
