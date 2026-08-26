import {AdventureStateEngine} from '../AdventureStateEngine';
import {AIOS_ADVENTURE_DIR} from '../../../utils/paths';
import * as RNFS from '@dr.pogodin/react-native-fs';

jest.mock('@dr.pogodin/react-native-fs', () => {
  const mem = new Map<string, string>();
  return {
    __mem: mem,
    exists: jest.fn(async (p: string) => mem.has(p)),
    writeFile: jest.fn(async (p: string, c: string) => {
      mem.set(p, c);
    }),
    readFile: jest.fn(async (p: string) => {
      if (!mem.has(p)) {
        throw new Error(`ENOENT: ${p}`);
      }
      return mem.get(p)!;
    }),
    unlink: jest.fn(async (p: string) => {
      mem.delete(p);
    }),
    appendFile: jest.fn(async () => undefined),
    mkdir: jest.fn(async () => undefined),
    DocumentDirectoryPath: '/data/user/0/com.pocketpalai/files',
    ExternalStorageDirectoryPath: '/sdcard',
    ExternalDirectoryPath: '/sdcard/Android/data/com.pocketpalai/files',
  };
});

describe('AdventureStateEngine（P12 TRPG 城主，ADVENTURE_SPEC v1）', () => {
  const engine = new AdventureStateEngine();
  const STATE_FILE = `${AIOS_ADVENTURE_DIR}/state.json`;

  /** 收窄为 error 结果并取 errorMessage */
  const errMsg = (result: any): string => {
    if (result.type !== 'error') {
      throw new Error('expected error result');
    }
    return result.errorMessage as string;
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (RNFS as any).__mem.clear();
  });

  it('get 未开档：显式返回「尚未开档」（不静默）', async () => {
    const result = await engine.execute({action: 'get'});
    expect(result.type).toBe('error');
    expect(errMsg(result)).toBe('NO_ADVENTURE_YET');
  });

  it('set 合并写入：状态落盘 + 返回更新后状态', async () => {
    const r1 = await engine.execute({
      action: 'set',
      state: {hp: 10, 位置: '新手村', 背包: ['木剑']},
    });
    expect(r1.type).toBe('text');
    expect(r1.summary).toContain('新手村');

    const r2 = await engine.execute({
      action: 'set',
      state: {hp: 8, 事件: '遇到狼群'},
    });
    expect(r2.type).toBe('text');
    expect(r2.summary).toContain('"hp": 8'); // 合并保留旧字段
    expect(r2.summary).toContain('"位置"'); // 旧字段仍在

    const raw = await RNFS.readFile(STATE_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    expect(parsed.hp).toBe(8);
    expect(parsed.背包).toEqual(['木剑']);
    expect(parsed['位置']).toBe('新手村');
  });

  it('get 读回已存档状态（重启不丢）', async () => {
    await engine.execute({action: 'set', state: {hp: 6, 位置: '黑森林'}});
    const result = await engine.execute({action: 'get'});
    expect(result.type).toBe('text');
    expect(result.summary).toContain('黑森林');
  });

  it('reset 清档：删文件 + 返回开新档提示', async () => {
    await engine.execute({action: 'set', state: {hp: 1}});
    const result = await engine.execute({action: 'reset'});
    expect(result.type).toBe('text');
    expect(result.summary).toContain('清档');
    expect(await RNFS.exists(STATE_FILE)).toBe(false);
  });

  it('set 非法参数：显式错误', async () => {
    const result = await engine.execute({action: 'set'});
    expect(result.type).toBe('error');
    expect(errMsg(result)).toBe('INVALID_STATE');
  });

  it('未知动作：显式错误', async () => {
    const result = await engine.execute({action: 'cheat'});
    expect(result.type).toBe('error');
    expect(errMsg(result)).toContain('Unknown action');
  });

  it('ToolDefinition 暴露 get/set/reset/read/append', () => {
    const def = engine.toToolDefinition();
    const enums = (def.function.parameters.properties.action as any).enum;
    expect(enums).toEqual(['get', 'set', 'reset', 'read', 'append']);
  });

  it('systemPromptFragment 注入城主人设（不破坏叙事）', () => {
    const frag = engine.systemPromptFragment!({
      now: new Date(),
      maxToolTurns: 5,
      activeTalents: new Set(['adventure_state']),
    });
    expect(frag).toContain('dungeon master');
    expect(frag).toContain('Never break the fiction');
  });

  describe('多文档世界档案（WORKSPACE_SPEC v1 read/append）', () => {
    const DOC = `${AIOS_ADVENTURE_DIR}/世界设定.md`;

    it('append 落盘 + 返回字数回执（不重复正文）', async () => {
      const result = await engine.execute({
        action: 'append',
        doc: '世界设定',
        section: '黑森林',
        content: '黑森林常年笼罩迷雾，传说深处有黄金鹿。',
      });
      expect(result.type).toBe('text');
      expect(result.summary).toContain('黑森林');
      expect(result.summary).toContain('已写入');

      const raw = await RNFS.readFile(DOC, 'utf8');
      expect(raw).toContain('## 黑森林');
      expect(raw).toContain('黄金鹿');
    });

    it('append 同节二次追加：节尾续写不覆盖', async () => {
      await engine.execute({
        action: 'append',
        doc: '剧情',
        section: '第一章',
        content: '阿岚走进酒馆。',
      });
      await engine.execute({
        action: 'append',
        doc: '剧情',
        section: '第一章',
        content: '酒馆老板递来一封旧信。',
      });
      const raw = await RNFS.readFile(`${AIOS_ADVENTURE_DIR}/剧情.md`, 'utf8');
      expect(raw.indexOf('酒馆老板递来一封旧信')).toBeGreaterThan(
        raw.indexOf('阿岚走进酒馆'),
      );
      expect(raw.match(/## 第一章/g)).toHaveLength(1);
    });

    it('read 命中节：只读目标段', async () => {
      await engine.execute({
        action: 'append',
        doc: '世界设定',
        section: '黑森林',
        content: '迷雾深处有黄金鹿。',
      });
      const result = await engine.execute({
        action: 'read',
        doc: '世界设定',
        section: '黑森林',
      });
      expect(result.type).toBe('text');
      expect(result.summary).toContain('黄金鹿');
    });

    it('read 节未命中：显式 NO_SECTION（不静默）', async () => {
      const result = await engine.execute({
        action: 'read',
        doc: '角色卡',
        section: '不存在的人',
      });
      expect(result.type).toBe('error');
      expect(errMsg(result)).toBe('NO_SECTION');
    });

    it('read/append 白名单外 doc：显式 UNKNOWN_DOC（防任意路径写盘）', async () => {
      for (const action of ['read', 'append'] as const) {
        const result = await engine.execute({
          action,
          doc: '../../../etc/passwd',
          section: 'x',
          content: 'y',
        });
        expect(result.type).toBe('error');
        expect(errMsg(result)).toBe('UNKNOWN_DOC');
      }
      expect((RNFS as any).__mem.has('/etc/passwd')).toBe(false);
    });

    it('append 缺 section/content：显式 EMPTY_CONTENT', async () => {
      const r1 = await engine.execute({
        action: 'append',
        doc: '剧情',
        section: '第一章',
      });
      expect(errMsg(r1)).toBe('EMPTY_CONTENT');
      const r2 = await engine.execute({
        action: 'append',
        doc: '剧情',
        content: 'x',
      });
      expect(errMsg(r2)).toBe('EMPTY_CONTENT');
    });

    it('read 缺 section：显式 EMPTY_SECTION', async () => {
      const result = await engine.execute({action: 'read', doc: '剧情'});
      expect(result.type).toBe('error');
      expect(errMsg(result)).toBe('EMPTY_SECTION');
    });

    it('append 超 20KB 显式拒绝：DOC_TOO_LARGE 不落盘', async () => {
      const result = await engine.execute({
        action: 'append',
        doc: '剧情',
        section: '超长节',
        content: '字'.repeat(21 * 1024),
      });
      expect(result.type).toBe('error');
      expect(errMsg(result)).toBe('DOC_TOO_LARGE');
      expect((RNFS as any).__mem.has(`${AIOS_ADVENTURE_DIR}/剧情.md`)).toBe(
        false,
      );
    });
  });
});
