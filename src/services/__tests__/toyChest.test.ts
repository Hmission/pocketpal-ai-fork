import * as RNFS from '@dr.pogodin/react-native-fs';

import {listToys, readToy, saveToy, TOY_LIMIT} from '../toyChest';
import {AIOS_TOYS_DIR} from '../../utils/paths';

jest.mock('@dr.pogodin/react-native-fs', () => {
  const mem = new Map<string, string>();
  const fsMock = {
    __mem: mem,
    exists: jest.fn(async (p: string) => mem.has(p)),
    mkdir: jest.fn(async () => undefined),
    writeFile: jest.fn(async (p: string, content: string) => {
      mem.set(p, content);
    }),
    readFile: jest.fn(async (p: string) => {
      if (!mem.has(p)) {
        throw new Error(`ENOENT: ${p}`);
      }
      return mem.get(p)!;
    }),
    copyFile: jest.fn(async () => undefined),
    unlink: jest.fn(async (p: string) => {
      mem.delete(p);
    }),
    ExternalStorageDirectoryPath: '/sdcard',
    DocumentDirectoryPath: '/data/user/0/com.pocketpalai/files',
    ExternalDirectoryPath: '/sdcard/Android/data/com.pocketpalai/files',
  };
  return fsMock;
});

describe('toyChest（P8 玩具工坊，PLAY_SPEC v1）', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (RNFS as any).__mem.clear();
  });

  it('saveToy 落盘 index.json + html 文件并返回条目', async () => {
    const entry = await saveToy('贪吃蛇', '<html><body>snake</body></html>');
    expect(entry).not.toBeNull();
    expect(entry!.title).toBe('贪吃蛇');
    expect(RNFS.writeFile).toHaveBeenCalledWith(
      `${AIOS_TOYS_DIR}/${entry!.id}.html`,
      '<html><body>snake</body></html>',
      'utf8',
    );
  });

  it('saveToy 标题为空返回 null（显式失败不静默）', async () => {
    expect(await saveToy('  ', '<html/>')).toBeNull();
    expect(await saveToy('', '')).toBeNull();
  });

  it('listToys 新→旧排序且含多条', async () => {
    await saveToy('A', '<a/>');
    await saveToy('B', '<b/>');
    const toys = await listToys();
    expect(toys.length).toBe(2);
    expect(toys[0].title).toBe('B'); // 最新在前
  });

  it('readToy 可读回成品；缺失返回 null', async () => {
    const entry = await saveToy('抽签器', '<html>draw</html>');
    expect(await readToy(entry!.id)).toBe('<html>draw</html>');
    expect(await readToy('nope')).toBeNull();
  });

  it('upsert 迭代（v1.6）：同 title 覆盖原 id 不堆条目，且条目置顶', async () => {
    const v1 = await saveToy('贪吃蛇', '<html>v1</html>');
    const other = await saveToy('抽签器', '<html>draw</html>');
    const v2 = await saveToy('贪吃蛇', '<html>v2</html>');

    expect(v2!.id).toBe(v1!.id); // 覆盖迭代 id 不变
    const toys = await listToys();
    expect(toys).toHaveLength(2); // 不堆重复条目
    expect(toys[0].title).toBe('贪吃蛇'); // 最新迭代置顶
    expect(toys[1].title).toBe('抽签器');
    expect(await readToy(v1!.id)).toBe('<html>v2</html>'); // 文件内容已覆盖
  });

  it('超过 TOY_LIMIT 滚动淘汰最旧', async () => {
    for (let i = 0; i < TOY_LIMIT + 5; i++) {
      await saveToy(`T${i}`, `<html>${i}</html>`);
    }
    const toys = await listToys();
    expect(toys.length).toBe(TOY_LIMIT);
    // 最旧的 5 件（T0..T4）已被淘汰
    expect(toys.some(t => t.title === 'T0')).toBe(false);
    expect(toys.some(t => t.title === `T${TOY_LIMIT + 4}`)).toBe(true);
  });

  it('滚动淘汰同步清除出局 html 文件（名单与文件同生共死，PLAY-2 v1.1）', async () => {
    const first: string[] = [];
    for (let i = 0; i < TOY_LIMIT; i++) {
      const entry = await saveToy(`T${i}`, `<html>${i}</html>`);
      first.push(entry!.id);
    }
    // 第 51 件触发淘汰：T0 文件应被 unlink
    await saveToy('T-LAST', '<html>last</html>');
    expect(RNFS.unlink).toHaveBeenCalledWith(
      `${AIOS_TOYS_DIR}/${first[0]}.html`,
    );
    // 文件级删除：被淘汰玩具的 html 不再可读
    expect(await readToy(first[0])).toBeNull();
    // 幸存玩具文件完好
    expect(await readToy(first[TOY_LIMIT - 1])).not.toBeNull();
  });
});
