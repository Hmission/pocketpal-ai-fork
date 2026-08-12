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
  AIOS_DB_DIR,
} from '../../utils/paths';
import {
  generateKeywords,
  scoreMatch,
  listMemories,
  AiosMemory,
} from './index';

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
async function fts5Search(query: string, topN: number): Promise<string[]> {
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
    return results.map(
      (r: any) => `[${r.source}] ${r.content?.slice(0, 500) ?? ''}`,
    );
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
    await executeSQL(
      'INSERT INTO conv_fts (content, source) VALUES (?, ?)',
      [content.slice(0, 1000), source],
    );
  } catch (e) {
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
 * \u6df7\u5408\u68c0\u7d22\uff1a\u5148\u5c1d\u8bd5 FTS5\uff0c\u5931\u8d25\u56de\u9000\u7eaf JS\u3002
 */
export async function searchMemory(
  query: string,
  topN = 5,
): Promise<string[]> {
  // Try FTS5 first
  if (fts5Available) {
    const ftsResults = await fts5Search(query, topN);
    if (ftsResults.length > 0) {
      return ftsResults;
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
  return fragments.slice(0, topN).map(f => `[${f.source}] ${f.content}`);
}
