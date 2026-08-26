/**
 * ReadHtmlEngine — read_html 工具测试（PLAY_SPEC v1.6 玩具迭代闭环）。
 */
import {ReadHtmlEngine} from '../ReadHtmlEngine';
import * as RNFS from '@dr.pogodin/react-native-fs';

jest.mock('@dr.pogodin/react-native-fs', () => {
  const mem = new Map<string, string>();
  return {
    __mem: mem,
    exists: jest.fn(async (p: string) => mem.has(p)),
    readFile: jest.fn(async (p: string) => mem.get(p)),
    writeFile: jest.fn(async (p: string, c: string) => {
      mem.set(p, c);
    }),
    unlink: jest.fn(async (p: string) => {
      mem.delete(p);
    }),
    mkdir: jest.fn(async () => {}),
    ExternalStorageDirectoryPath: '/sdcard',
    DocumentDirectoryPath: '/data/user/0/com.pocketpalai/files',
    ExternalDirectoryPath: '/sdcard/Android/data/com.pocketpalai/files',
  };
});

import {saveToy} from '../../toyChest';

const engine = new ReadHtmlEngine();

describe('ReadHtmlEngine（read_html 玩具迭代读回）', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (RNFS as any).__mem.clear();
  });

  it('按 title 命中读回原文（summary 含引导语 + 全文）', async () => {
    const html = '<html><body>snake v1</body></html>';
    await saveToy('贪吃蛇', html);

    const result = await engine.execute({title: '贪吃蛇'});

    expect(result.type).toBe('text');
    const text = result as {type: 'text'; summary: string};
    expect(text.summary).toContain('已读回「贪吃蛇」成品原文');
    expect(text.summary).toContain('同名覆盖存档 = 迭代');
    expect(text.summary).toContain(html); // 原文全文可消费
  });

  it('同名取最新（先存旧版再存新版 → 读回新版）', async () => {
    const e1 = await saveToy('贪吃蛇', '<html>v1</html>');
    const e2 = await saveToy('贪吃蛇', '<html>v2</html>');
    expect(e1!.id).toBe(e2!.id); // upsert 覆盖 id 不变

    const result = (await engine.execute({title: '贪吃蛇'})) as {
      type: 'text';
      summary: string;
    };
    expect(result.summary).toContain('<html>v2</html>');
  });

  it('未命中返回错误 + 候选清单（不静默）', async () => {
    await saveToy('贪吃蛇', '<html/>');
    await saveToy('抽签器', '<html/>');

    const result = await engine.execute({title: '不存在的玩具'});

    expect(result.type).toBe('error');
    const err = result as {
      type: 'error';
      summary: string;
      errorMessage: string;
    };
    expect(err.errorMessage).toBe('TOY_NOT_FOUND');
    expect(err.summary).toContain('贪吃蛇');
    expect(err.summary).toContain('抽签器');
  });

  it('缺 title 参数返回 MISSING_TITLE', async () => {
    const result = await engine.execute({});
    expect(result.type).toBe('error');
    expect((result as {errorMessage: string}).errorMessage).toBe(
      'MISSING_TITLE',
    );
  });

  it('toToolDefinition 契约：name/required 齐备', () => {
    const def = engine.toToolDefinition();
    expect(def.function.name).toBe('read_html');
    expect(def.function.parameters.required).toContain('title');
    expect(def.function.description).toContain('MUST');
  });

  it('systemPromptFragment 注入迭代令（先读回再改，同名覆盖）', () => {
    const frag = engine.systemPromptFragment!({
      now: new Date(),
      maxToolTurns: 5,
      activeTalents: new Set(['read_html']),
    });
    expect(frag).toContain('read_html');
    expect(frag).toContain('SAME title');
    expect(frag).toContain('Never rewrite');
  });
});
