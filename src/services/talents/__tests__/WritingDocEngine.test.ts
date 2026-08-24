/**
 * WritingDocEngine 测试（WORKSPACE_SPEC v1，2026-08-21）
 */
import {WritingDocEngine} from '../WritingDocEngine';
import {AIOS_WRITING_DIR} from '../../../utils/paths';

jest.mock('@dr.pogodin/react-native-fs', () => ({
  exists: jest.fn(async (p: string) => p in mem),
  mkdir: jest.fn(async () => undefined),
  writeFile: jest.fn(async (p: string, content: string) => {
    mem[p] = content;
  }),
  appendFile: jest.fn(async () => undefined),
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

jest.mock('../../aiosMemory', () => ({
  addMemory: jest.fn(async () => undefined),
}));

const mem: Record<string, string> = {};
beforeEach(() => {
  Object.keys(mem).forEach(k => delete mem[k]);
});

const engine = new WritingDocEngine();
const PROJECT_DIR = `${AIOS_WRITING_DIR}/我的小说`;

const errMsg = (result: any): string => {
  if (result.type !== 'error') {
    throw new Error('expected error result, got ' + result.type);
  }
  return result.errorMessage as string;
};

describe('WritingDocEngine（WORKSPACE_SPEC v1）', () => {
  it('init：建三件套骨架 + 索引 + 记忆', async () => {
    const r = await engine.execute({action: 'init', title: '我的小说', genre: '科幻'});
    expect(r.type).toBe('text');
    if (r.type === 'text') {
      expect(r.summary).toContain('我的小说');
    }
    expect(mem[`${PROJECT_DIR}/大纲.md`]).toContain('## 主线');
    expect(mem[`${PROJECT_DIR}/人设.md`]).toContain('## 主要角色');
    expect(mem[`${PROJECT_DIR}/正文-第一章.md`]).toContain('## 第一章');
    expect(mem[`${AIOS_WRITING_DIR}/index.json`]).toContain('我的小说');
    expect(require('../../aiosMemory').addMemory).toHaveBeenCalledWith(
      'fact',
      expect.stringContaining('我的小说'),
    );
  });

  it('init 空标题显式拒绝', async () => {
    expect(errMsg(await engine.execute({action: 'init', title: ' '}))).toBe(
      'EMPTY_TITLE',
    );
  });

  it('append：正文落盘 + 回执含字数', async () => {
    await engine.execute({action: 'init', title: '我的小说'});
    const r = await engine.execute({
      action: 'append',
      project: '我的小说',
      doc: '正文-第一章',
      section: '第一章',
      content: '夜色降临，城市亮起。',
    });
    expect(r.type).toBe('text');
    if (r.type === 'text') {
      expect(r.summary).toContain('已写入');
      expect(r.summary).toContain('第一章');
    }
    expect(mem[`${PROJECT_DIR}/正文-第一章.md`]).toContain('夜色降临');
    // 索引（域根）被 touch 置顶
    expect(mem[`${AIOS_WRITING_DIR}/index.json`]).toContain('我的小说');
  });

  it('append 超 20KB 显式拒绝（提示开新章）', async () => {
    await engine.execute({action: 'init', title: '我的小说'});
    const big = '字'.repeat(21 * 1024);
    const r = await engine.execute({
      action: 'append',
      project: '我的小说',
      doc: '正文-第一章',
      section: '第一章',
      content: big,
    });
    expect(errMsg(r)).toBe('DOC_TOO_LARGE');
    // WORKSPACE_TOOL_ERROR_FEEDBACK_SPEC §3.4：超限带 new_chapter 导航
    expect((r as any).guide).toContain('new_chapter');
  });

  it('new_chapter：开新章 + 重复章节拒绝', async () => {
    await engine.execute({action: 'init', title: '我的小说'});
    const r = await engine.execute({
      action: 'new_chapter',
      project: '我的小说',
      chapter: '第二章',
    });
    expect(r.type).toBe('text');
    expect(mem[`${PROJECT_DIR}/正文-第二章.md`]).toContain('## 第二章');
    const dup = await engine.execute({
      action: 'new_chapter',
      project: '我的小说',
      chapter: '第二章',
    });
    expect(errMsg(dup)).toBe('CHAPTER_EXISTS');
  });

  it('read_section：按节读取；节不存在显式失败', async () => {
    await engine.execute({action: 'init', title: '我的小说'});
    await engine.execute({
      action: 'append',
      project: '我的小说',
      doc: '正文-第一章',
      section: '第一章',
      content: '第一段',
    });
    const r = await engine.execute({
      action: 'read_section',
      project: '我的小说',
      doc: '正文-第一章',
      section: '第一章',
    });
    expect(r.type).toBe('text');
    if (r.type === 'text') {
      expect(r.summary).toContain('第一段');
    }
    const miss = await engine.execute({
      action: 'read_section',
      project: '我的小说',
      doc: '正文-第一章',
      section: '不存在的节',
    });
    expect(errMsg(miss)).toBe('NO_SECTION');
  });

  it('update_outline / update_persona：框架整节替换', async () => {
    await engine.execute({action: 'init', title: '我的小说'});
    await engine.execute({
      action: 'update_outline',
      project: '我的小说',
      content: '主线：少年寻星之旅。',
    });
    await engine.execute({
      action: 'update_persona',
      project: '我的小说',
      content: '主角：阿星，倔强少年。',
    });
    expect(mem[`${PROJECT_DIR}/大纲.md`]).toContain('少年寻星之旅');
    expect(mem[`${PROJECT_DIR}/人设.md`]).toContain('阿星');
  });

  it('list：init 后返回项目清单', async () => {
    await engine.execute({action: 'init', title: '我的小说'});
    const r = await engine.execute({action: 'list'});
    expect(r.type).toBe('text');
    if (r.type === 'text') {
      expect(r.summary).toContain('我的小说');
    }
  });

  it('未知动作显式失败', async () => {
    expect(errMsg(await engine.execute({action: 'fly'}))).toBe(
      'Unknown action: fly',
    );
  });

  it('未 init 直接写：PROJECT_NOT_FOUND + init 导航（非兜底）', async () => {
    const r = await engine.execute({
      action: 'append',
      project: '不存在的项目',
      doc: '正文-第一章',
      section: '第一章',
      content: '正文',
    });
    expect(r.type).toBe('error');
    if (r.type === 'error') {
      expect(r.errorMessage).toBe('PROJECT_NOT_FOUND');
      // WORKSPACE_TOOL_ERROR_FEEDBACK_SPEC §3.5：导航给 init 正确调用示例
      expect(r.guide).toContain('init');
      expect(r.guide).toContain('"title"');
    }
    // 未 init 不产生任何文件（无隐式建目录，协议非兜底）
    expect(Object.keys(mem)).toHaveLength(0);
    // 同样拦截 update_outline / update_persona / new_chapter
    expect(
      errMsg(await engine.execute({action: 'update_outline', project: '不存在的项目', content: 'x'})),
    ).toBe('PROJECT_NOT_FOUND');
    expect(
      errMsg(await engine.execute({action: 'update_persona', project: '不存在的项目', content: 'x'})),
    ).toBe('PROJECT_NOT_FOUND');
    expect(
      errMsg(await engine.execute({action: 'new_chapter', project: '不存在的项目', chapter: '第一章'})),
    ).toBe('PROJECT_NOT_FOUND');
    // 读动作同样拦截（真机实证：NO_DOC/NO_SECTION 无导航会让模型烧光 maxTurns）
    expect(
      errMsg(await engine.execute({action: 'read_section', project: '不存在的项目', doc: '正文-第一章', section: '第一章'})),
    ).toBe('PROJECT_NOT_FOUND');
    expect(
      errMsg(await engine.execute({action: 'read_all', project: '不存在的项目', doc: '大纲'})),
    ).toBe('PROJECT_NOT_FOUND');
    expect(
      errMsg(await engine.execute({action: 'list_sections', project: '不存在的项目', doc: '大纲'})),
    ).toBe('PROJECT_NOT_FOUND');
  });

  it('未知动作带 guide：枚举 + JSON 示例', async () => {
    const r = await engine.execute({action: 'fly'});
    if (r.type === 'error') {
      expect(r.guide).toContain('init');
      expect(r.guide).toContain('"action":"list"');
    }
  });

  it('toToolDefinition 契约：name/参数/required', () => {
    const def = engine.toToolDefinition();
    expect(def.function.name).toBe('writing_doc');
    expect(def.function.parameters.required).toEqual(['action']);
    expect(def.function.parameters.properties.action.enum).toContain('append');
  });
});
