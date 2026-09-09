/**
 * AIOS \u6df7\u5408\u68c0\u7d22\u5f15\u64ce\uff08FTS5 + \u7eaf JS \u56de\u9000\uff09
 *
 * Spec \u8981\u6c42 FTS5 \u5168\u6587\u68c0\u7d22\u3002\u4f7f\u7528 WatermelonDB \u7684 SQLiteAdapter
 * \u7684 unsafeExecute \u6267\u884c raw SQL\uff0c\u521b\u5efa FTS5 \u865a\u62df\u8868\u3002
 * \u5982\u679c FTS5 \u4e0d\u53ef\u7528\uff08\u5e93\u672a\u7f16\u8bd1 FTS5 / adapter \u5931\u8d25\uff09\uff0c
 * \u56de\u9000\u5230\u7eaf JS \u5168\u6587\u68c0\u7d22\u3002
 *
 * \u7d22\u6750\u6765\u6e90\uff1aconversations/\u65e5\u671f.md + aios_memories.json
 * FTS5 \u7d22\u5f15\uff1aaios_search.db\uff08\u72ec\u7acb\u4e8e pocketpalai.db\uff09
 */
import * as RNFS from '@dr.pogodin/react-native-fs';
import {
  AIOS_CONVERSATIONS_DIR,
  AIOS_WORKSPACE_MEMORY_DIR,
} from '../../utils/paths';
import {generateKeywords, scoreMatch, listMemories} from './index';
// AIOS_CORE_SPEC Wave C：先问谱后 grep（图谱命中优先层）
import {recallKg} from '../aiosCore/kg';

// ---- 召回免责前缀（2026-08-23 三闸·闸2）----
// 历史片段注入统一语义：可能已过时，仅作背景参考，防模型把旧记忆当当前事实。
// 消费方：useChatSession + butlerContext（同构收口，防分叉）。
// 依据：.qoder/specs/记忆时效性三闸治理方案_task-3g4.md 闸2
export const RECALL_DISCLAIMER =
  '【召回的历史片段】(以下是历史记录，可能已过时，仅作背景参考，不得当作当前事实):';

/**
 * 一条召回命中：内容与溯源**分离**。
 *
 * 为什么必须分离（2026-09-09 真机 aab688d9 血证）：旧形态是单个字符串，把
 * `[kg:memory] label · snippet` 这类内部标记直接拼进正文，于是同一根字符串被两个
 * 互不相容的用途共用——注入 prompt（标记成为小模型可续写的字面量，退化时整段
 * `[kg:memory] …` 复读 6 遍泄漏进用户可见回复）与知识库列表展示（标记原样渲染）。
 * 现在：`text` 是唯一可进模型面的字段，`source` 只供 UI/诊断。
 */
export interface RecallHit {
  /** 纯内容，无任何标记前缀——可直接进 prompt 或 UI 正文 */
  text: string;
  /** 溯源标签，仅 UI/诊断用：`kg:memory` / `kg:conv` / `conversation:<日期>` / `memory:<类型>` */
  source: string;
}

/** kg 命中里 label 与 snippet 常同文，拼成 `X · X` 正是小模型复读的触发器：只保一份。 */
function kgHitText(label: string, snippet: string): string {
  const snip = snippet.slice(0, 80).trim();
  const lab = label.trim();
  if (!snip) {
    return lab;
  }
  if (!lab || snip.includes(lab)) {
    return snip;
  }
  return `${lab}：${snip}`;
}

// ---- FTS5 \u5c42 ----
let fts5Available = false;
let searchAdapter: any = null;

/**
 * \u521d\u59cb\u5316 FTS5 \u7d22\u5f15\u3002\u5c1d\u8bd5\u521b\u5efa FTS5 \u865a\u62df\u8868\uff0c\u5931\u8d25\u5219\u6807\u8bb0\u4e3a\u4e0d\u53ef\u7528\u3002
 */
async function initFTS5(): Promise<void> {
  try {
    const SQLiteAdapter = (await import('@nozbe/watermelondb/adapters/sqlite'))
      .default;
    searchAdapter = new SQLiteAdapter({
      schema: {tables: [], lastModified: 1} as any,
      dbName: 'aios_search',
      jsi: true,
    });
    // Create FTS5 virtual table
    await executeSQL(
      'CREATE VIRTUAL TABLE IF NOT EXISTS conv_fts USING fts5(content, source)',
    );
    fts5Available = true;
    console.log('[searchEngine] FTS5 initialized');
  } catch (e) {
    console.warn('[searchEngine] FTS5 not available, using pure JS:', e);
    fts5Available = false;
  }
}

/**
 * \u6267\u884c raw SQL\uff08\u5305\u88c5 callback \u4e3a Promise\uff09
 */
function executeSQL(sql: string, args: any[] = []): Promise<any> {
  return new Promise((resolve, reject) => {
    if (!searchAdapter) {
      reject(new Error('searchAdapter not initialized'));
      return;
    }
    try {
      searchAdapter.unsafeExecute([{sql, args}], (result: any) => {
        resolve(result);
      });
    } catch (e) {
      reject(e);
    }
  });
}

/**
 * FTS5 \u68c0\u7d22\u3002\u8fd4\u56de\u76f8\u5173\u7247\u6bb5\u3002
 */
async function fts5Search(query: string, topN: number): Promise<RecallHit[]> {
  if (!fts5Available) {
    return [];
  }
  try {
    // FTS5 MATCH query
    const results = await executeSQL(
      `SELECT content, source FROM conv_fts WHERE conv_fts MATCH ? ORDER BY rank LIMIT ?`,
      [query.slice(0, 100), topN],
    );
    if (!Array.isArray(results)) {
      return [];
    }
    return results.map((r: any) => ({
      text: String(r.content?.slice(0, 500) ?? ''),
      source: String(r.source ?? ''),
    }));
  } catch (e) {
    console.warn('[searchEngine] FTS5 search failed:', e);
    return [];
  }
}

/**
 * \u5411 FTS5 \u7d22\u5f15\u63d2\u5165\u4e00\u6761\u7247\u6bb5\u3002
 */
async function fts5Insert(content: string, source: string): Promise<void> {
  if (!fts5Available) {
    return;
  }
  try {
    await executeSQL('INSERT INTO conv_fts (content, source) VALUES (?, ?)', [
      content.slice(0, 1000),
      source,
    ]);
  } catch {
    // silent
  }
}

// ---- \u7eaf JS \u56de\u9000\u5c42 ----
let conversationCache: Map<string, string> = new Map();

async function loadConversations(): Promise<void> {
  // Scan conversations/ + memory/ (daily summaries) into the search cache.
  // Keys: conversation:<date> for logs, memory:<date> for summaries (matches
  // compaction.ts updateConversationCache convention).
  const sources: [string, string][] = [
    [AIOS_CONVERSATIONS_DIR, 'conversation'],
    [AIOS_WORKSPACE_MEMORY_DIR, 'memory'],
  ];
  for (const [dir, prefix] of sources) {
    try {
      const files = await RNFS.readDir(dir);
      for (const f of files) {
        const dateStr = f.name.replace('.md', '');
        const key = `${prefix}:${dateStr}`;
        if (f.name.endsWith('.md') && !conversationCache.has(key)) {
          const content = await RNFS.readFile(f.path, 'utf8');
          conversationCache.set(key, content);
          if (fts5Available) {
            const segs = content
              .split(/\n## /)
              .filter(s => s.trim().length > 20);
            for (const seg of segs) {
              await fts5Insert(seg, `${prefix}:${dateStr}`);
            }
          }
        }
      }
    } catch (e) {
      console.warn(`[searchEngine] load ${dir} failed:`, e);
    }
  }
}

export function updateConversationCache(key: string, content: string): void {
  conversationCache.set(key, content);
  // Also insert into FTS5 if available
  if (fts5Available) {
    const segs = content.split(/\n## /).filter(s => s.trim().length > 20);
    for (const seg of segs) {
      void fts5Insert(seg, key);
    }
  }
}

function splitIntoFragments(content: string): string[] {
  return content.split(/\n## /).filter(s => s.trim().length > 20);
}

/**
 * \u542f\u52a8\u65f6\u521d\u59cb\u5316\u7d22\u5f15\uff1a\u5c1d\u8bd5 FTS5 + \u52a0\u8f7d\u5bf9\u8bdd\u65e5\u5fd7\u3002
 */
export async function initIndex(): Promise<void> {
  await initFTS5();
  await loadConversations();
  console.log(
    `[searchEngine] index initialized: ${conversationCache.size} conversation days, FTS5=${fts5Available}`,
  );
}

/**
 * \u6df7\u5408\u68c0\u7d22\uff1a\u5148\u95ee\u8c31\u540e grep\uff08AIOS_CORE_SPEC Wave C\uff09\u2014\u2014kg.recall\u547d\u4e2d\u5148\u8fd4\uff0c
 * \u4e0d\u8db3\u989d\u5ea6\u518d\u8d70 FTS5/\u7eaf JS \u5168\u6587\u8865\u4f4d\uff08\u540c\u6e90\u7247\u6bb5\u6309\u5185\u5bb9\u524d\u7f00\u53bb\u91cd\uff09\u3002
 */
export async function searchMemory(
  query: string,
  topN = 5,
): Promise<RecallHit[]> {
  // 问谱优先层：图谱命中即先返（记忆↔会话关联语境），失败/未命中静默降级
  let kgHits: RecallHit[] = [];
  try {
    const hits = await recallKg(query, 2);
    kgHits = hits.map(h => ({
      text: kgHitText(h.label, h.snippet),
      source: `kg:${h.type}`,
    }));
  } catch {
    kgHits = [];
  }
  const remaining = Math.max(topN - kgHits.length, 0);
  if (remaining === 0) {
    return kgHits;
  }

  // Try FTS5 first
  if (fts5Available) {
    const ftsResults = await fts5Search(query, remaining);
    if (ftsResults.length > 0) {
      return dedupeByContent([...kgHits, ...ftsResults], topN);
    }
  }

  // Pure JS fallback
  if (conversationCache.size === 0) {
    await loadConversations();
  }
  const memories = await listMemories();
  const queryKeywords = generateKeywords(query);
  const fragments: {source: string; content: string; score: number}[] = [];

  for (const [key, content] of conversationCache) {
    const segs = splitIntoFragments(content);
    for (const seg of segs) {
      let score = 0;
      for (const kw of queryKeywords) {
        if (seg.includes(kw)) {
          score++;
        }
      }
      if (score > 0) {
        fragments.push({
          source: key, // conversation:<date> or memory:<date>
          content: seg.slice(0, 500),
          score,
        });
      }
    }
  }

  for (const m of memories) {
    const score = scoreMatch(query, m);
    if (score > 0) {
      fragments.push({
        source: `memory:${m.type}`,
        content: m.content,
        score,
      });
    }
  }

  fragments.sort((a, b) => b.score - a.score);
  return dedupeByContent(
    [
      ...kgHits,
      ...fragments
        .slice(0, remaining)
        .map(f => ({text: f.content, source: f.source})),
    ],
    topN,
  );
}

/** 片段去重（按内容前 24 字符）：kg 与全文可能命中同一内容，避免重复注入。 */
function dedupeByContent(items: RecallHit[], limit: number): RecallHit[] {
  const seen = new Set<string>();
  const out: RecallHit[] = [];
  for (const it of items) {
    const key = it.text.slice(0, 24);
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    out.push(it);
    if (out.length >= limit) {
      break;
    }
  }
  return out;
}
