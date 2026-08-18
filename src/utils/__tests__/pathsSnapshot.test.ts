/**
 * B14/B17 快照机制单测：双模式私有库路径兼容（JSI=files/，async 回退=databases/）。
 * 2026-08-18 真机取证修正：release 包 JSI 不可用回退 async，旧硬编码 files/ 致快照静默失效。
 */
import {exportDbSnapshot, restoreDbSnapshot, AIOS_DB_DIR} from '../paths';

jest.mock('@dr.pogodin/react-native-fs', () => {
  const store: Record<string, boolean> = {};
  return {
    __store: store,
    DocumentDirectoryPath: '/data/data/com.pocketpalai/files',
    ExternalStorageDirectoryPath: '/sdcard',
    exists: jest.fn(async (p: string) => !!store[p]),
    copyFile: jest.fn(async (src: string, dst: string) => {
      store[dst] = true;
      store[src] = true;
    }),
    mkdir: jest.fn(async () => {}),
    writeFile: jest.fn(async () => {}),
    readDir: jest.fn(async () => []),
    unlink: jest.fn(async (p: string) => {
      delete store[p];
    }),
    stat: jest.fn(async (p: string) => ({path: p, isDirectory: () => false})),
  };
});

const RNFS = require('@dr.pogodin/react-native-fs');
const store = RNFS.__store as Record<string, boolean>;

const FILES_DB = '/data/data/com.pocketpalai/files/pocketpalai.db';
const DBS_DB = '/data/data/com.pocketpalai/databases/pocketpalai.db';
// watermelondb native 实际路径：getDatabasePath().replace("/databases","") → 私有根目录
const ROOT_DB = '/data/data/com.pocketpalai/pocketpalai.db';
const SHARED_DB = `${AIOS_DB_DIR}/pocketpalai.db`;

describe('db snapshot 双模式路径兼容', () => {
  beforeEach(() => {
    for (const k of Object.keys(store)) {
      delete store[k];
    }
    jest.clearAllMocks();
  });

  it('export：真机实际路径（私有根目录）存在 → 复制根目录库', async () => {
    store[ROOT_DB] = true;
    await exportDbSnapshot();
    const copied = (RNFS.copyFile as jest.Mock).mock.calls.map(c => c[0]);
    expect(copied).toContain(ROOT_DB);
  });

  it('export：JSI 模式（files/ 存在）→ 复制 files/ 到共享', async () => {
    store[FILES_DB] = true;
    await exportDbSnapshot();
    const copied = (RNFS.copyFile as jest.Mock).mock.calls.map(c => c[0]);
    expect(copied).toContain(FILES_DB);
  });

  it('export：async 回退（仅 databases/ 存在）→ 复制 databases/（旧硬编码漏网场景）', async () => {
    store[DBS_DB] = true;
    await exportDbSnapshot();
    const copied = (RNFS.copyFile as jest.Mock).mock.calls.map(c => c[0]);
    expect(copied).toContain(DBS_DB);
  });

  it('export：双候选均缺失 → 不复制（静默跳过）', async () => {
    await exportDbSnapshot();
    expect(RNFS.copyFile).not.toHaveBeenCalled();
  });

  it('restore：共享存在 + 私有候选均缺失 → 多写恢复', async () => {
    store[SHARED_DB] = true;
    await restoreDbSnapshot();
    expect(store[ROOT_DB]).toBe(true);
    expect(store[FILES_DB]).toBe(true);
    expect(store[DBS_DB]).toBe(true);
  });

  it('restore：私有库已存在 → 不覆盖', async () => {
    store[SHARED_DB] = true;
    store[FILES_DB] = true;
    await restoreDbSnapshot();
    expect(RNFS.copyFile).not.toHaveBeenCalled();
  });
});
