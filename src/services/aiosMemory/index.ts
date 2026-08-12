/**
 * AIOS \u53e3\u888b\u8bb0\u5fc6 \u2014\u2014 \u672c\u5730\u8bb0\u5fc6\u4f53\uff08\u5b8c\u5168\u79bb\u7ebf\uff09
 *
 * \u5b58\u50a8: AIOS_MEMORIES_DIR/aios_memories.json\uff08\u5171\u4eab\u76ee\u5f55\uff0c\u5378\u8f7d\u4e0d\u4e22\uff09
 * \u6ce8\u5165: buildMemoryFragment(userText) \u7531 useChatSession \u62fc\u8fdb system prompt
 * \u68c0\u7d22: searchMemory(query) \u6df7\u5408\u68c0\u7d22 conversations + memories\uff08\u7eaf JS\uff0c\u96f6\u4f9d\u8d56\uff09
 * \u63d0\u53d6: extractAndSaveMemories() \u7528 grammar \u7ea6\u675f JSON \u8f93\u51fa\uff08\u6839\u6cbb\u4e0d\u7a33\u5b9a\uff09
 * \u4eba\u8bbe: \u5df2\u79fb\u5165 AIOS Pal \u7684 systemPrompt\uff0c\u6b64\u5904\u53ea\u7ba1\u8bb0\u5fc6\u5b58\u53d6
 */
import * as RNFS from '@dr.pogodin/react-native-fs';
import {AIOS_MEMORIES_DIR, AIOS_CONVERSATIONS_DIR, AIOS_USER_FILE} from '../../utils/paths';
import {modelStore} from '../../store';

export interface AiosMemory {
  id: string;
  type: 'fact' | 'episode' | 'insight';
  content: string;
  keywords?: string[];
  ts: number;
}

const FILE = `${AIOS_MEMORIES_DIR}/aios_memories.json`;
const MAX_MEMORIES = 200;
const INJECT_COUNT = 8;

let cache: AiosMemory[] | null = null;
let extracting = false;

// \u5bf9\u8bdd\u65e5\u5fd7\u8bed\u6599\u7f13\u5b58\uff08dateStr \u2192 content\uff09
let conversationCache: Map<string, string> = new Map();

async function load(): Promise<AiosMemory[]> {
  if (cache) {
    return cache;
  }
  try {
    if (await RNFS.exists(FILE)) {
      const raw = await RNFS.readFile(FILE, 'utf8');
      cache = JSON.parse(raw) as AiosMemory[];
    } else {
      cache = [];
    }
  } catch (e) {
    console.warn('[aiosMemory] load failed, resetting:', e);
    cache = [];
  }
  return cache!;
}

async function save(memories: AiosMemory[]): Promise<void> {
  cache = memories.slice(-MAX_MEMORIES);
  try {
    await RNFS.writeFile(FILE, JSON.stringify(cache, null, 1), 'utf8');
  } catch (e) {
    console.warn('[aiosMemory] save failed:', e);
  }
}

/**
 * \u4ece\u6587\u672c\u751f\u6210\u5173\u952e\u8bcd\u7528\u4e8e\u68c0\u7d22\u5339\u914d\u3002
 * \u4e2d\u6587: 2-4\u5b57\u6ed1\u7a97\uff1b\u82f1\u6587: \u6309\u7a7a\u683c/\u6807\u70b9\u5206\u8bcd\u3002
 */
export function generateKeywords(text: string): string[] {
  const trimmed = text.trim();
  const keywords: string[] = [];
  for (let len = 2; len <= 4 && len <= trimmed.length; len++) {
    for (let i = 0; i <= trimmed.length - len; i++) {
      const slice = trimmed.slice(i, i + len);
      if (/[\u4e00-\u9fff]{2,}/.test(slice)) {
        keywords.push(slice);
      }
    }
  }
  const words = trimmed
    .split(/[\s,.\u3002.!?,;:!?\u3001]+/)
    .filter(w => w.length > 2);
  keywords.push(...words);
  return [...new Set(keywords)].slice(0, 50);
}

/** \u8ba1\u7b97\u8bb0\u5fc6\u4e0e\u5f53\u524d\u7528\u6237\u8f93\u5165\u7684\u5173\u952e\u8bcd\u5339\u914d\u5206\u6570 */
export function scoreMatch(userText: string, memory: AiosMemory): number {
  if (!memory.keywords || memory.keywords.length === 0) {
    return 0;
  }
  let score = 0;
  for (const kw of memory.keywords) {
    if (userText.includes(kw)) {
      score++;
    }
  }
  return score;
}

export async function addMemory(
  type: AiosMemory['type'],
  content: string,
): Promise<void> {
  const trimmed = content.trim();
  if (!trimmed) {
    return;
  }
  const memories = await load();
  if (memories.some(m => m.content === trimmed)) {
    return;
  }
  memories.push({
    id: `${Date.now()}-${Math.floor(Math.random() * 1e6)}`,
    type,
    content: trimmed.slice(0, 200),
    keywords: generateKeywords(trimmed),
    ts: Date.now(),
  });
  await save(memories);
  console.log('[aiosMemory] \u8bb0\u4f4f\u4e86:', trimmed.slice(0, 40));
}

export async function deleteMemory(id: string): Promise<void> {
  const memories = await load();
  await save(memories.filter(m => m.id !== id));
}

/** Update a memory's content (for MemoryScreen edit feature). */
export async function updateMemoryContent(id: string, content: string): Promise<void> {
  const trimmed = content.trim();
  if (!trimmed) {
    return;
  }
  const memories = await load();
  const idx = memories.findIndex(m => m.id === id);
  if (idx !== -1) {
    memories[idx].content = trimmed.slice(0, 200);
    memories[idx].keywords = generateKeywords(trimmed);
    await save(memories);
  }
}

/** Get the storage size of the memories JSON file (in bytes). */
export async function getMemoriesFileSize(): Promise<number> {
  try {
    const stat = await RNFS.stat(FILE);
    return Number(stat.size) || 0;
  } catch {
    return 0;
  }
}

/**
 * Aggregate fact-type memories into USER.md (大王画像).
 * Called periodically after memory extraction to keep the user profile fresh.
 * Spec: USER.md（由记忆系统从 fact 类记忆聚合，定期刷新）
 */
export async function refreshUserMd(): Promise<void> {
  try {
    const memories = await load();
    const facts = memories.filter(m => m.type === 'fact');
    if (facts.length === 0) {
      return; // Don't overwrite if no facts yet
    }
    const lines = facts.map(f => `- ${f.content}`);
    const content = `# 大王画像\n\n由记忆系统从 fact 类记忆自动聚合（${new Date().toLocaleString()}）\n\n${lines.join('\n')}\n`;
    await RNFS.writeFile(AIOS_USER_FILE, content, 'utf8');
    console.log('[aiosMemory] USER.md refreshed with', facts.length, 'facts');
  } catch (e) {
    console.warn('[aiosMemory] refreshUserMd failed:', e);
  }
}

export async function clearMemories(): Promise<void> {
  await save([]);
}

export async function listMemories(): Promise<AiosMemory[]> {
  return (await load()).slice().reverse();
}

/**
 * \u6784\u5efa\u6ce8\u5165 system prompt \u7684\u8bb0\u5fc6\u788e\u7247\uff08\u7531 useChatSession \u8c03\u7528\uff09\u3002
 * \u63a5\u6536\u5f53\u524d\u7528\u6237\u8f93\u5165\uff0c\u505a\u5173\u952e\u8bcd\u5339\u914d\u8fd4\u56de\u6700\u76f8\u5173\u7684 INJECT_COUNT \u6761\u8bb0\u5fc6\u3002
 */
export async function buildMemoryFragment(userText?: string): Promise<string> {
  try {
    const memories = await load();
    if (memories.length === 0) {
      return '';
    }
    let selected: AiosMemory[];
    if (userText && userText.trim()) {
      const scored = memories
        .map(m => ({m, score: scoreMatch(userText, m)}))
        .sort((a, b) => b.score - a.score);
      const matched = scored.filter(s => s.score > 0).slice(0, INJECT_COUNT);
      selected =
        matched.length > 0
          ? matched.map(s => s.m)
          : memories.slice(-INJECT_COUNT);
    } else {
      selected = memories.slice(-INJECT_COUNT);
    }
    const lines = selected.map(m => `- [${m.type}] ${m.content}`);
    return lines.length
      ? '\u3010\u4f60\u5bf9\u5927\u738b\u7684\u8bb0\u5fc6\u3011(\u76f8\u5173\u65f6\u81ea\u7136\u7528\u4e0a\uff0c\u522b\u5168\u90e8\u590d\u8ff0):\n' +
          lines.join('\n')
      : '';
  } catch (e) {
    console.warn('[aiosMemory] fragment build failed:', e);
    return '';
  }
}

// search logic moved to searchEngine.ts (spec: independent file)
// FTS5 not available (WatermelonDB wraps SQLite), using pure JS full-text search
export {searchMemory, updateConversationCache, initIndex} from './searchEngine';
export {compactAndFlush, listSummaryDates, readSummary} from './compaction';

// ---- \u7a33\u5b9a\u62bd\u53d6\uff08grammar \u7ea6\u675f\uff09 ----

const EXTRACTION_SYSTEM =
  '\u4f60\u662f\u8bb0\u5fc6\u63d0\u53d6\u52a9\u624b\u3002\u4e0b\u9762\u7ed9\u4f60\u4e00\u6bb5\u771f\u5b9e\u5bf9\u8bdd(\u5927\u738b\u4e0e\u5973\u5996)\u3002' +
  '\u4ece\u4e2d\u63d0\u53d6\u5173\u4e8e\u5927\u738b\u7684\u3001\u503c\u5f97\u957f\u671f\u8bb0\u4f4f\u7684\u65b0\u4fe1\u606f(\u559c\u597d/\u8eab\u4efd/\u6b63\u5728\u505a\u7684\u4e8b)\u3002' +
  'content \u5fc5\u987b\u662f\u5bf9\u8bdd\u91cc\u771f\u5b9e\u51fa\u73b0\u7684\u5185\u5bb9, \u7528\u81ea\u5df1\u7684\u8bdd\u6982\u62ec, \u4e0d\u8d85\u8fc720\u5b57, \u7981\u6b62\u7167\u6284\u672c\u63d0\u793a\u8bcd\u7684\u4efb\u4f55\u5b57\u3002' +
  '\u8f93\u51fa\u4e25\u683cJSON: {"memories":[{"type":"fact|episode|insight","content":"..."}]}\u3002' +
  '\u82e5\u5bf9\u8bdd\u6ca1\u6709\u503c\u5f97\u8bb0\u7684\u65b0\u4fe1\u606f, \u8f93\u51fa {"memories":[]}\u3002\u53ea\u8f93\u51faJSON\u3002';

/** JSON schema \u7ea6\u675f\uff08\u6839\u6cbb\u62bd\u53d6\u4e0d\u7a33\u5b9a\uff09 */
const EXTRACTION_SCHEMA = {
  type: 'json_schema' as const,
  json_schema: {
    strict: true,
    schema: {
      type: 'object',
      properties: {
        memories: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              type: {type: 'string', enum: ['fact', 'episode', 'insight']},
              content: {type: 'string'},
            },
            required: ['type', 'content'],
          },
        },
      },
      required: ['memories'],
    },
  },
};

/**
 * \u5bf9\u8bdd\u7ed3\u675f\u540e\u7528\u672c\u5730\u6a21\u578b\u63d0\u53d6\u8bb0\u5fc6\uff08fire-and-forget\uff0c\u4e0d\u963b\u585e UI\uff09\u3002
 * \u4f7f\u7528 grammar \u7ea6\u675f JSON \u8f93\u51fa\uff0c\u6839\u6cbb\u5c0f\u6a21\u578b\u4ea7 JSON \u4e0d\u7a33\u5b9a\u3002
 */
export async function extractAndSaveMemories(
  userText: string,
  assistantText: string,
): Promise<void> {
  if (extracting) {
    return;
  }
  if (!userText.trim() || assistantText.trim().length < 4) {
    return;
  }
  if (modelStore.inferencing) {
    return;
  }
  const engine = modelStore.engine;
  if (!engine) {
    return;
  }
  extracting = true;
  try {
    let output = '';
    await engine.completion(
      {
        messages: [
          {role: 'system', content: EXTRACTION_SYSTEM},
          {
            role: 'user',
            content: `\u5927\u738b: ${userText.slice(0, 300)}\n\u5973\u5996: ${assistantText.slice(0, 500)}`,
          },
        ],
        n_predict: 150,
        temperature: 0,
        response_format: EXTRACTION_SCHEMA,
        // Qwen 系模型开启 thinking 时 reasoning token 会混入流 → JSON 解析失败
        enable_thinking: false,
      } as any,
      (data: {token?: string; content?: string}) => {
        const piece = data?.token ?? data?.content ?? '';
        if (typeof piece === 'string') {
          output += piece;
        }
      },
    );
    // grammar 约束保证合法 JSON，直接解析（删除正则回退）
    // 2026-08-12 真机复测：本地 llama.rn 引擎不识别 OpenAI 式 response_format
    // json_schema，输出会带 <s> BOS 前缀/围栏 → 解析前剥离非 JSON 头尾。
    const jsonText = output.trim().replace(/^<s>\s*/i, '').replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/s, '');
    let parsed: any;
    try {
      parsed = JSON.parse(jsonText);
    } catch {
      // 兜底：从输出中提取第一个 { 到最后一个 } 的子串（BOS/围栏/推理杂讯剔除后仍不
      // 是纯 JSON 时使用）
      const first = jsonText.indexOf('{');
      const last = jsonText.lastIndexOf('}');
      if (first >= 0 && last > first) {
        parsed = JSON.parse(jsonText.slice(first, last + 1));
      } else {
        throw new Error('no JSON object found in extraction output');
      }
    }
    const items = Array.isArray(parsed.memories) ? parsed.memories : [];
    for (const item of items.slice(0, 3)) {
      if (item && typeof item.content === 'string' && item.content.trim()) {
        const type = ['fact', 'episode', 'insight'].includes(item.type)
          ? item.type
          : 'episode';
        await addMemory(type, item.content);
      }
    }
    // Refresh USER.md from fact memories after extraction
    await refreshUserMd();
  } catch (e) {
    console.warn('[aiosMemory] extraction failed:', e);
  } finally {
    extracting = false;
  }
}
