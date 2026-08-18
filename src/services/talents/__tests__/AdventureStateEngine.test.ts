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

  it('ToolDefinition 只暴露 get/set/reset', () => {
    const def = engine.toToolDefinition();
    const enums = (def.function.parameters.properties.action as any).enum;
    expect(enums).toEqual(['get', 'set', 'reset']);
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
});
