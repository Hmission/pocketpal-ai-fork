/**
 * toyChest — 玩具箱（P8 玩具工坊，PLAY_SPEC v1/v1.6）
 *
 * render_html 成功产物（type='html' 且带 title）自动落盘 workspace/toys/：
 *   - index.json：条目清单 [{id, title, createdAt}]（≤ TOY_LIMIT 件，满则删最旧）
 *   - <id>.html：成品原稿（纯透传，不做任何改写）
 *
 * upsert 迭代语义（v1.6，2026-08-19 大王裁定）：title 即身份——同 title
 * 落盘 = 覆盖原文件（id 不变，条目置顶）= 同一件玩具的迭代版；新 title
 * = 新玩具新建条目。50 件滚动淘汰保留（名单与文件同生共死）。
 *
 * 消费端：KnowledgeScreen 第四 tab「玩具箱」列表 + HtmlPreviewBubble 重玩
 * + read_html 工具按 title 读回原文供模型迭代修改。
 * 与记忆提取钩子同模式：fire-and-forget，不阻塞主链（调用方负责容错）。
 */
import * as RNFS from '@dr.pogodin/react-native-fs';

import {AIOS_TOYS_DIR} from '../utils/paths';

export interface ToyEntry {
  id: string;
  title: string;
  createdAt: number;
}

export const TOY_LIMIT = 50;

const INDEX_FILE = `${AIOS_TOYS_DIR}/index.json`;

// 玩具 id 唯一性（v1.6 血证）：Date.now() 同毫秒撞车会让 upsert 的
// rest.filter(e => e.id !== entry.id) 误滤掉同 id 旧条目。进程内自增后缀
// 保证同毫秒多次落盘也唯一（旧数据为纯数字串，兼容）。
let toyIdSeq = 0;
function nextToyId(): string {
  toyIdSeq += 1;
  return `${Date.now()}-${toyIdSeq}`;
}

async function readIndex(): Promise<ToyEntry[]> {
  try {
    if (!(await RNFS.exists(INDEX_FILE))) {
      return [];
    }
    const raw = await RNFS.readFile(INDEX_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeIndex(entries: ToyEntry[]): Promise<void> {
  await RNFS.writeFile(INDEX_FILE, JSON.stringify(entries, null, 2), 'utf8');
}

/** 落盘一件玩具（upsert）：标题为空/写盘失败返回 null（显式失败，不静默）。
 * 同 title → 覆盖原文件（id 不变）并把条目置顶 = 迭代存档；新 title → 新建。 */
export async function saveToy(
  title: string,
  html: string,
): Promise<ToyEntry | null> {
  const trimmedTitle = title.trim();
  if (!trimmedTitle || !html) {
    return null;
  }
  const entries = await readIndex();
  // upsert 迭代（v1.6）：title 即身份，同 title 覆盖原 id（迭代版不堆条目）
  const existing = entries.find(e => e.title === trimmedTitle);
  const entry: ToyEntry = existing
    ? {...existing, createdAt: Date.now()}
    : {
        id: nextToyId(),
        title: trimmedTitle.slice(0, 40),
        createdAt: Date.now(),
      };
  try {
    const rest = entries.filter(e => e.id !== entry.id);
    const next = [entry, ...rest].slice(0, TOY_LIMIT);
    await RNFS.writeFile(`${AIOS_TOYS_DIR}/${entry.id}.html`, html, 'utf8');
    await writeIndex(next);
    // 滚动淘汰（PLAY-2 v1.1）：被裁出名单的最旧条目，文件同步清除——名单与文件同生共死。
    const evicted = rest.slice(TOY_LIMIT - 1);
    for (const old of evicted) {
      try {
        await RNFS.unlink(`${AIOS_TOYS_DIR}/${old.id}.html`);
      } catch (e) {
        console.warn(`[toyChest] evict file failed for ${old.id}:`, e);
      }
    }
    return entry;
  } catch (e) {
    console.warn('[toyChest] saveToy failed:', e);
    return null;
  }
}

/** 玩具清单（新→旧）。 */
export async function listToys(): Promise<ToyEntry[]> {
  return readIndex();
}

/** 读取玩具成品 html；缺失返回 null。 */
export async function readToy(id: string): Promise<string | null> {
  try {
    const path = `${AIOS_TOYS_DIR}/${id}.html`;
    if (!(await RNFS.exists(path))) {
      return null;
    }
    return await RNFS.readFile(path, 'utf8');
  } catch {
    return null;
  }
}
