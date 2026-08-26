/**
 * albumBook — 记忆绘本（P10，ALBUM_SPEC v1）
 *
 * 把记忆从「数据库」升格为「成长相册」：周度故事（写作模型现编）+ DreamLite 封面插画。
 * 素材只来自真实记忆与日记；手动触发（MemoryScreen 按钮），不自动不打断。
 *
 * 流程：素材聚合 → 故事生成（modelStore.engine ?? promptWriter，与记忆提取同款回退）
 *       → 管家增强英文提示词 → DreamLite 出图 → 落盘 memories/album/YYYY-Www/
 */
import * as RNFS from '@dr.pogodin/react-native-fs';

import {AIOS_ALBUM_DIR} from '../utils/paths';
import {listMemories} from './aiosMemory';
import {listDiaries, readDiary} from './aiosMemory/rituals';
import {promptWriter} from './promptWriter';
import {modelStore} from '../store';
import {imageGenStore} from '../store/imageGenStore';

const WEEK_MS = 7 * 86400000;
const COVER_SIZE = 1024;
const COVER_STEPS = 4;

/** ISO 周键：YYYY-Www（绘本目录名） */
export function weekKeyOf(date: Date): string {
  const d = new Date(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()),
  );
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(
    ((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7,
  );
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

export interface Album {
  /** YYYY-Www */
  week: string;
  story: string;
  /** 封面图绝对路径 */
  coverUri: string;
}

export interface AlbumResult {
  ok: boolean;
  album?: Album;
  error?: string;
}

const STORY_SYSTEM =
  '你是女妖，AIOS 硅基生命体，大王的口袋管家。下面是大王最近一周的记忆和日记。' +
  '请以女妖第一人称写一篇 200-400 字的「本周故事」：回顾本周与大王发生的事，' +
  '像老友叙旧，温柔有细节，可以有小小的感慨。必须基于给定素材，不编造。' +
  '不要标题，直接写正文。';

/** 用当前引擎或管家跑一次 completion（与记忆提取同款回退模式） */
async function runStoryCompletion(
  system: string,
  user: string,
  nPredict: number,
): Promise<string> {
  const params = {
    messages: [
      {role: 'system' as const, content: system},
      {role: 'user' as const, content: user.slice(0, 2000)},
    ],
    n_predict: nPredict,
    temperature: 0.8,
    enable_thinking: false,
  };
  let out = '';
  const cb = (data: {token?: string; content?: string}) => {
    const piece = data?.token ?? data?.content ?? '';
    if (typeof piece === 'string') {
      out += piece;
    }
  };
  try {
    const engine = modelStore.engine;
    if (engine) {
      await engine.completion(params as any, cb);
    } else {
      await promptWriter.completion(params as any, cb);
    }
  } catch (e) {
    console.warn('[albumBook] story completion failed:', e);
    return '';
  }
  return out.trim();
}

/**
 * 生成本周绘本（手动触发，ALBUM_SPEC §2.1）：
 * 素材空 → 显式错误；本周已存在 → 显式错误（周文件即幂等）；任一环节失败不静默。
 */
export async function createWeeklyAlbum(): Promise<AlbumResult> {
  try {
    // ① 素材聚合：近 7 天记忆 + 日记
    const now = Date.now();
    const memories = (await listMemories()).filter(m => now - m.ts < WEEK_MS);
    const diaryDates = (await listDiaries())
      .filter(d => now - new Date(d.date).getTime() < WEEK_MS)
      .slice(0, 7);
    if (memories.length === 0 && diaryDates.length === 0) {
      return {ok: false, error: '本周还没有记忆和日记，先多聊聊天再写绘本吧。'};
    }

    const week = weekKeyOf(new Date());
    const weekDir = `${AIOS_ALBUM_DIR}/${week}`;
    if (await RNFS.exists(weekDir)) {
      return {ok: false, error: '本周绘本已生成过，去相册看看吧。'};
    }

    // 素材文本（记忆 + 日记内容）
    const memLines = memories
      .slice(0, 15)
      .map(m => `- [${m.type}] ${m.content}`);
    const diaryLines: string[] = [];
    for (const d of diaryDates) {
      const content = await readDiary(d.date);
      if (content) {
        diaryLines.push(
          `- ${d.date}: ${content.replace(/^#.*\n?/, '').slice(0, 120)}`,
        );
      }
    }
    const material = [
      '【记忆】',
      ...memLines,
      '【小鸡日记】',
      ...diaryLines,
    ].join('\n');

    // ② 故事生成（写作模型现编）
    const story = await runStoryCompletion(STORY_SYSTEM, material, 400);
    if (story.length < 20) {
      return {ok: false, error: '故事生成失败（模型不可用），请稍后再试。'};
    }

    // ③ 封面提示词：管家增强（未就绪则用故事首段原文，不标记失败——封面可放宽）
    let sdPrompt = story.slice(0, 300);
    try {
      if (promptWriter.isLoaded) {
        const enhanced = await promptWriter.writePrompt(story.slice(0, 200));
        if (enhanced) {
          sdPrompt = enhanced;
        }
      }
    } catch (e) {
      console.warn('[albumBook] prompt enhance failed, using raw story:', e);
    }

    // ④ 出图（DreamLite 单通道，engineMutex 内部处理）
    const uri = await imageGenStore.generateDreamLiteEntry(
      COVER_SIZE,
      COVER_SIZE,
      COVER_STEPS,
      sdPrompt,
    );
    if (!uri) {
      return {
        ok: false,
        error: imageGenStore.error ?? '封面生成失败，请到生图页排查。',
      };
    }

    // ⑤ 落盘（共享存储，卸载不丢）
    await RNFS.mkdir(weekDir);
    await RNFS.writeFile(
      `${weekDir}/story.md`,
      `# ${week} 本周故事\n\n${story}\n`,
      'utf8',
    );
    const coverPath = `${weekDir}/cover.png`;
    await RNFS.copyFile(uri.replace(/^file:\/\//, ''), coverPath);

    const album: Album = {week, story, coverUri: coverPath};
    console.log('[albumBook] album flushed:', weekDir);
    return {ok: true, album};
  } catch (e) {
    console.warn('[albumBook] createWeeklyAlbum failed:', e);
    return {ok: false, error: '绘本生成失败，请稍后再试。'};
  }
}

/** 绘本周列表（新→旧） */
export async function listAlbums(): Promise<Album[]> {
  try {
    if (!(await RNFS.exists(AIOS_ALBUM_DIR))) {
      return [];
    }
    const dirs = (await RNFS.readDir(AIOS_ALBUM_DIR))
      .filter(d => d.isDirectory())
      .sort((a, b) => (a.name < b.name ? 1 : -1));
    const albums: Album[] = [];
    for (const d of dirs) {
      const album = await readAlbum(d.name);
      if (album) {
        albums.push(album);
      }
    }
    return albums;
  } catch {
    return [];
  }
}

/** 读取单周绘本；缺失返回 null（ALBUM_SPEC §五 readAlbum 契约，v1.1）。 */
export async function readAlbum(weekKey: string): Promise<Album | null> {
  try {
    const storyPath = `${AIOS_ALBUM_DIR}/${weekKey}/story.md`;
    if (!(await RNFS.exists(storyPath))) {
      return null;
    }
    const story = await RNFS.readFile(storyPath, 'utf8');
    return {
      week: weekKey,
      story,
      coverUri: `${AIOS_ALBUM_DIR}/${weekKey}/cover.png`,
    };
  } catch {
    return null;
  }
}
