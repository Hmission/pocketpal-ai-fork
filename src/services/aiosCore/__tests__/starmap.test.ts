/**
 * starmap 单测（AIOS_CORE_SPEC Wave C）：三维快照采集
 */
import * as RNFS from '@dr.pogodin/react-native-fs';
import {
  collectCapabilities,
  captureStarmap,
  readStarmap,
  registerHealthProvider,
} from '../starmap';
import {
  AIOS_STARMAP_SNAPSHOT,
  AIOS_WORKSPACE_DIR,
  AIOS_GROWTH_DIR,
} from '../../../utils/paths';

jest.mock('@dr.pogodin/react-native-fs', () => ({
  exists: jest.fn().mockResolvedValue(false),
  readFile: jest.fn().mockResolvedValue(''),
  writeFile: jest.fn().mockResolvedValue(undefined),
  appendFile: jest.fn().mockResolvedValue(undefined),
  mkdir: jest.fn().mockResolvedValue(undefined),
  readDir: jest.fn().mockResolvedValue([]),
  DocumentDirectoryPath: '/mock/documents',
  ExternalStorageDirectoryPath: '/mock/storage',
}));

jest.mock('../../../debug/eventStream', () => ({
  emit: jest.fn(),
}));

describe('starmap（AIOS_CORE_SPEC Wave C）', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (RNFS.exists as jest.Mock).mockResolvedValue(false);
    (RNFS.readDir as jest.Mock).mockResolvedValue([]);
    (RNFS.readFile as jest.Mock).mockResolvedValue('');
  });

  it('collectCapabilities 引擎名排序 + 计数', () => {
    const caps = collectCapabilities([
      'web_search',
      'memory_search',
      'render_html',
    ]);
    expect(caps.count).toBe(3);
    expect(caps.engines).toEqual([
      'memory_search',
      'render_html',
      'web_search',
    ]);
  });

  it('captureStarmap 写快照文件并返回三面结构', async () => {
    registerHealthProvider({
      getEngines: () => ({chat: {phase: 'ready'}, image: {phase: 'idle'}}),
      getModelCount: () => 5,
    });
    const snap = await captureStarmap(['web_search']);
    expect(snap).toBeTruthy();
    expect(snap!.capabilities.engines).toEqual(['web_search']);
    expect(snap!.health.engines.chat).toBe('ready');
    expect(snap!.health.models).toBe(5);
    const call = (RNFS.writeFile as jest.Mock).mock.calls.find(
      c => c[0] === AIOS_STARMAP_SNAPSHOT,
    );
    expect(call).toBeTruthy();
  });

  it('captureStarmap 数据面统计 workspace 子目录文件数', async () => {
    (RNFS.exists as jest.Mock).mockImplementation(
      async (p: string) =>
        p === AIOS_WORKSPACE_DIR ||
        p === AIOS_GROWTH_DIR ||
        p === `${AIOS_WORKSPACE_DIR}/chick_diary`,
    );
    (RNFS.readDir as jest.Mock).mockImplementation(async (p: string) => {
      if (p === AIOS_WORKSPACE_DIR) {
        return [
          {
            name: 'chick_diary',
            isDirectory: () => true,
            isFile: () => false,
            path: `${p}/chick_diary`,
          },
          {
            name: 'stray.md',
            isDirectory: () => false,
            isFile: () => true,
            path: `${p}/stray.md`,
          },
        ];
      }
      if (p === `${AIOS_WORKSPACE_DIR}/chick_diary`) {
        return [
          {name: '2026-09-04.md', isDirectory: () => false, isFile: () => true},
          {name: '2026-09-05.md', isDirectory: () => false, isFile: () => true},
        ];
      }
      return [];
    });
    const snap = await captureStarmap([]);
    expect(snap!.data.workspaceDirs).toEqual({chick_diary: 2});
  });

  it('readStarmap 缺失返回 null（文件即过期公理）', async () => {
    (RNFS.exists as jest.Mock).mockResolvedValue(false);
    await expect(readStarmap()).resolves.toBeNull();
  });

  it('readStarmap 有文件解析返回', async () => {
    (RNFS.exists as jest.Mock).mockResolvedValue(true);
    (RNFS.readFile as jest.Mock).mockResolvedValue(
      JSON.stringify({
        ts: 'x',
        capabilities: {engines: [], count: 0},
        data: {workspaceDirs: {}, growthEntries: 0},
        health: {engines: {}, models: 0},
      }),
    );
    const snap = await readStarmap();
    expect(snap).toBeTruthy();
    expect(snap!.ts).toBe('x');
  });
});
