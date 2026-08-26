/**
 * docStore 分段读取原语测试（WORKSPACE_SPEC v1，2026-08-21）
 */
import {
  parseDoc,
  readSection,
  listSections,
  readWholeDoc,
  appendSection,
  updateSection,
  MAX_DOC_BYTES,
} from '../docStore';

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

const DOC = '/sdcard/Documents/AIOS/workspace/writing/我的小说/正文-第一章.md';

describe('parseDoc', () => {
  it('preamble 与节拆分', () => {
    const {preamble, sections} = parseDoc(
      '# 我的小说\n\n## 第一章\n第一段\n第二段\n\n## 第二章\n第三段\n',
    );
    expect(preamble).toBe('# 我的小说');
    expect(sections).toEqual([
      {section: '第一章', content: '第一段\n第二段'},
      {section: '第二章', content: '第三段'},
    ]);
  });
});

describe('appendSection', () => {
  it('节存在 → 节尾追加（新内容不插到节首）', async () => {
    mem[DOC] = '# 标题\n\n## 第一章\n旧第一段\n';
    const r = await appendSection(DOC, '第一章', '新第二段');
    expect(r.ok).toBe(true);
    expect(mem[DOC]).toBe('# 标题\n\n## 第一章\n旧第一段\n\n新第二段\n');
  });

  it('节不存在 → 文件尾新建节', async () => {
    mem[DOC] = '# 标题\n\n## 第一章\n旧第一段\n';
    await appendSection(DOC, '第二章', '开头');
    const sections = await listSections(DOC);
    expect(sections?.map(s => s.section)).toEqual(['第一章', '第二章']);
    expect(await readSection(DOC, '第二章')).toMatchObject({
      section: '第二章',
      content: '开头',
    });
  });

  it('空内容显式拒绝', async () => {
    const r = await appendSection(DOC, '第一章', '   ');
    expect(r.ok).toBe(false);
    expect(r.error).toBe('EMPTY_CONTENT');
  });

  it('超 20KB 显式拒绝且不改文件', async () => {
    mem[DOC] = '# 标题\n\n## 第一章\n开头\n';
    const big = '字'.repeat(MAX_DOC_BYTES);
    const r = await appendSection(DOC, '第一章', big);
    expect(r.ok).toBe(false);
    expect(r.error).toBe('DOC_TOO_LARGE');
    expect(await readSection(DOC, '第一章')).toMatchObject({
      content: '开头',
    });
  });

  it('文件不存在 → 创建含节文档', async () => {
    const r = await appendSection(DOC, '第一章', '开篇');
    expect(r.ok).toBe(true);
    expect(await readWholeDoc(DOC)).toBe('## 第一章\n开篇\n');
  });
});

describe('updateSection', () => {
  it('整节替换（标题保留）', async () => {
    mem[DOC] = '# 标题\n\n## 大纲\n旧大纲\n\n## 人设\n旧人设\n';
    await updateSection(DOC, '大纲', '新大纲');
    expect(mem[DOC]).toBe('# 标题\n\n## 大纲\n新大纲\n\n## 人设\n旧人设\n');
  });

  it('空内容 → 删除该节', async () => {
    mem[DOC] = '# 标题\n\n## 大纲\n旧大纲\n';
    await updateSection(DOC, '大纲', '');
    const sections = await listSections(DOC);
    expect(sections?.length ?? 0).toBe(0);
  });

  it('节不存在 → 新建', async () => {
    mem[DOC] = '# 标题\n\n## 大纲\n旧大纲\n';
    await updateSection(DOC, '角色卡', '新角色');
    expect(await readSection(DOC, '角色卡')).toMatchObject({
      content: '新角色',
    });
  });
});

describe('readSection / listSections', () => {
  it('文件不存在 → null（显式）', async () => {
    expect(await readSection(DOC, '第一章')).toBeNull();
    expect(await listSections(DOC)).toBeNull();
  });
  it('节名精确匹配', async () => {
    mem[DOC] = '## 第一章\n内容\n## 第二章\n内容2\n';
    expect(await readSection(DOC, '第一章')).toMatchObject({
      section: '第一章',
      content: '内容',
    });
    expect(await readSection(DOC, '不存在')).toBeNull();
  });
});
