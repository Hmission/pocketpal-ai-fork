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
    unlink: jest.fn(async () => undefined),
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
});
