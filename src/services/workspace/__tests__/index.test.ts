/**
 * workspace 索引/目录协议测试（WORKSPACE_SPEC v1，2026-08-21）
 */
import {
  sanitizeProjectName,
  ensureProject,
  touchProject,
  findProject,
  listProjects,
  projectDir,
  domainRoot,
} from '../index';

jest.mock('@dr.pogodin/react-native-fs', () => ({
  exists: jest.fn(async (p: string) => p in mem),
  mkdir: jest.fn(async () => undefined),
  writeFile: jest.fn(async (p: string, content: string) => {
    mem[p] = content;
  }),
  readFile: jest.fn(async (p: string) => {
    if (!(p in mem)) {
      throw new Error('not found');
    }
    return mem[p];
  }),
  DocumentDirectoryPath: '/data/user/0/com.pocketpalai/files',
  ExternalStorageDirectoryPath: '/sdcard',
  ExternalDirectoryPath: '/sdcard/Android/data/com.pocketpalai/files',
}));

const mem: Record<string, string> = {};
beforeEach(() => {
  Object.keys(mem).forEach(k => delete mem[k]);
});

describe('sanitizeProjectName', () => {
  it('去除路径分隔符与危险字符', () => {
    expect(sanitizeProjectName('a/b\\c:d*e?f"g<h>i|j')).toBe('abcdefghij');
  });
  it('空白折叠 + trim', () => {
    expect(sanitizeProjectName('  我的  小说   ')).toBe('我的 小说');
  });
  it('空名/纯空白返回 null', () => {
    expect(sanitizeProjectName('')).toBeNull();
    expect(sanitizeProjectName('   ')).toBeNull();
  });
});

describe('ensureProject / touchProject / findProject', () => {
  it('ensureProject 建目录 + 索引条目，幂等', async () => {
    const dir = await ensureProject('writing', '我的小说');
    expect(dir).toBe(`${domainRoot('writing')}/我的小说`);
    expect(findProject('writing', '我的小说')).resolves.toMatchObject({
      name: '我的小说',
    });
    // 二次 ensure 不炸（幂等）
    await expect(
      ensureProject('writing', '我的小说'),
    ).resolves.toBe(dir);
  });

  it('touchProject 写后置顶 + 可选 progress 更新', async () => {
    await ensureProject('writing', '旧项目');
    await ensureProject('writing', '新项目');
    await touchProject('writing', '旧项目', '已写完第一章');
    const list = await listProjects('writing');
    expect(list.map(p => p.name)).toEqual(['旧项目', '新项目']);
    expect(list[0].progress).toBe('已写完第一章');
  });

  it('findProject 未命中返回 null', async () => {
    expect(await findProject('adventure', '不存在的冒险')).toBeNull();
  });
});
