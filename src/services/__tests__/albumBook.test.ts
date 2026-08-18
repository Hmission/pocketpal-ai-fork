import {createWeeklyAlbum, listAlbums, readAlbum, weekKeyOf} from '../albumBook';
import {listMemories} from '../aiosMemory';
import {listDiaries, readDiary} from '../aiosMemory/rituals';
import {promptWriter} from '../promptWriter';
import {modelStore} from '../../store';
import {imageGenStore} from '../../store/imageGenStore';
import {AIOS_ALBUM_DIR} from '../../utils/paths';
import * as RNFS from '@dr.pogodin/react-native-fs';

jest.mock('../aiosMemory', () => ({
  listMemories: jest.fn(),
}));
jest.mock('../aiosMemory/rituals', () => ({
  listDiaries: jest.fn(),
  readDiary: jest.fn(),
}));
jest.mock('../promptWriter', () => ({
  promptWriter: {
    isLoaded: false,
    writePrompt: jest.fn(),
    completion: jest.fn(),
  },
}));
jest.mock('../../store', () => ({
  modelStore: {engine: undefined as any},
}));
jest.mock('../../store/imageGenStore', () => ({
  imageGenStore: {
    generateDreamLiteEntry: jest.fn(),
    error: null,
  },
}));
jest.mock('@dr.pogodin/react-native-fs', () => {
  const mem = new Map<string, string>();
  const dirs = new Set<string>();
  return {
    __mem: mem,
    __dirs: dirs,
    exists: jest.fn(async (p: string) => mem.has(p) || dirs.has(p)),
    mkdir: jest.fn(async (p: string) => {
      dirs.add(p);
    }),
    readDir: jest.fn(async () => []),
    writeFile: jest.fn(async (p: string, c: string) => {
      mem.set(p, c);
    }),
    readFile: jest.fn(async (p: string) => {
      if (!mem.has(p)) {
        throw new Error(`ENOENT: ${p}`);
      }
      return mem.get(p)!;
    }),
    copyFile: jest.fn(async () => undefined),
    unlink: jest.fn(async () => undefined),
    DocumentDirectoryPath: '/data/user/0/com.pocketpalai/files',
    ExternalStorageDirectoryPath: '/sdcard',
    ExternalDirectoryPath: '/sdcard/Android/data/com.pocketpalai/files',
  };
});

describe('albumBook（P10 记忆绘本，ALBUM_SPEC v1）', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (RNFS as any).__mem.clear();
    (RNFS as any).__dirs.clear();
    (imageGenStore as any).error = null;
    modelStore.engine = undefined;
    (promptWriter as any).isLoaded = false;
  });

  it('weekKeyOf 生成 ISO 周键 YYYY-Www', () => {
    expect(weekKeyOf(new Date('2026-08-18T00:00:00'))).toMatch(/^\d{4}-W\d{2}$/);
  });

  it('素材为空 → 显式错误（不静默）', async () => {
    (listMemories as jest.Mock).mockResolvedValue([]);
    (listDiaries as jest.Mock).mockResolvedValue([]);
    const result = await createWeeklyAlbum();
    expect(result.ok).toBe(false);
    expect(result.error).toContain('还没有记忆');
  });

  it('本周已存在 → 显式错误（周文件即幂等）', async () => {
    (listMemories as jest.Mock).mockResolvedValue([
      {id: '1', type: 'episode', content: '大王今天修好了生图', ts: Date.now(), keywords: []},
    ]);
    (listDiaries as jest.Mock).mockResolvedValue([]);
    const week = weekKeyOf(new Date());
    (RNFS as any).__dirs.add(`${AIOS_ALBUM_DIR}/${week}`);
    const result = await createWeeklyAlbum();
    expect(result.ok).toBe(false);
    expect(result.error).toContain('已生成过');
  });

  it('完整链路：故事 + 管家增强 + DreamLite 封面 + 落盘', async () => {
    (listMemories as jest.Mock).mockResolvedValue([
      {id: '1', type: 'episode', content: '大王今天修好了生图', ts: Date.now(), keywords: []},
      {id: '2', type: 'fact', content: '大王喜欢蓝色', ts: Date.now(), keywords: []},
    ]);
    (listDiaries as jest.Mock).mockResolvedValue([
      {date: '2026-08-17', path: '/d/2026-08-17.md'},
    ]);
    (readDiary as jest.Mock).mockResolvedValue('# 2026-08-17 小鸡日记\n\n今天和大王聊了模型');

    // 故事由管家 completion 生成
    (promptWriter as any).completion.mockImplementation(
      async (_p: any, cb: (d: {token?: string}) => void) => {
        cb({token: '这一周，大王把生图修好了。我们一起做了好多玩具，他说蓝色最好看。'});
      },
    );
    // 封面提示词增强 + 出图
    (promptWriter as any).isLoaded = true;
    (promptWriter as any).writePrompt.mockResolvedValue(
      'a blue-toned illustration of a week of tinkering with AI toys',
    );
    (imageGenStore as any).generateDreamLiteEntry.mockResolvedValue(
      'file:///tmp/gen_album.png',
    );

    const result = await createWeeklyAlbum();

    expect(result.ok).toBe(true);
    expect(result.album).toBeDefined();
    expect(result.album!.story).toContain('生图');
    // 封面拷贝到共享存储 album 目录
    expect(RNFS.copyFile).toHaveBeenCalledWith(
      '/tmp/gen_album.png',
      expect.stringContaining('cover.png'),
    );
    // story.md 落盘
    expect(RNFS.writeFile).toHaveBeenCalledWith(
      expect.stringContaining('story.md'),
      expect.stringContaining('本周故事'),
      'utf8',
    );
    // DreamLite 固定 1024×1024·4 步
    expect(imageGenStore.generateDreamLiteEntry).toHaveBeenCalledWith(
      1024,
      1024,
      4,
      'a blue-toned illustration of a week of tinkering with AI toys',
    );
  });

  it('出图失败 → 复用 imageGenStore.error 显式返回', async () => {
    (listMemories as jest.Mock).mockResolvedValue([
      {id: '1', type: 'fact', content: '大王喜欢蓝色', ts: Date.now(), keywords: []},
    ]);
    (listDiaries as jest.Mock).mockResolvedValue([]);
    (promptWriter as any).completion.mockImplementation(
      async (_p: any, cb: (d: {token?: string}) => void) => {
        cb({token: '这一周的故事内容足够长，超过了二十个字符的阈值要求。'});
      },
    );
    (imageGenStore as any).generateDreamLiteEntry.mockResolvedValue(null);
    (imageGenStore as any).error = 'DreamLite 加载失败';

    const result = await createWeeklyAlbum();
    expect(result.ok).toBe(false);
    expect(result.error).toContain('DreamLite 加载失败');
  });

  it('listAlbums 读取已落盘绘本（故事 + 封面路径）', async () => {
    const week = weekKeyOf(new Date());
    const dir = `${AIOS_ALBUM_DIR}/${week}`;
    (RNFS as any).__dirs.add(AIOS_ALBUM_DIR);
    (RNFS as any).__dirs.add(dir);
    (RNFS as any).__mem.set(`${dir}/story.md`, `# ${week} 本周故事\n\n这周很开心`);
    (RNFS.readDir as jest.Mock).mockResolvedValue([
      {name: week, path: dir, isDirectory: () => true},
    ]);

    const albums = await listAlbums();
    expect(albums.length).toBe(1);
    expect(albums[0].week).toBe(week);
    expect(albums[0].coverUri).toBe(`${dir}/cover.png`);
  });

  it('readAlbum 读取单周绘本；缺失返回 null（ALBUM_SPEC §五，v1.1）', async () => {
    const week = weekKeyOf(new Date());
    const dir = `${AIOS_ALBUM_DIR}/${week}`;
    (RNFS as any).__dirs.add(dir);
    (RNFS as any).__mem.set(
      `${dir}/story.md`,
      `# ${week} 本周故事\n\n这一周很开心`,
    );

    const album = await readAlbum(week);
    expect(album).not.toBeNull();
    expect(album!.week).toBe(week);
    expect(album!.story).toContain('很开心');
    expect(album!.coverUri).toBe(`${dir}/cover.png`);

    expect(await readAlbum('2020-W00')).toBeNull();
  });
});
