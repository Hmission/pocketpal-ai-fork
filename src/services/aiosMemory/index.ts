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
import {promptWriter} from '../promptWriter';
import type {IntentKind} from './rituals';

export interface AiosMemory {
  id: string;
  type: 'fact' | 'episode' | 'insight';
  content: string;
  keywords?: string[];
  ts: number;
  /** 9D 轻量裁决：属性槽（fact 专属，规则提取，用于同属性新替旧） */
  attrSlot?: string;
  /** 9D 轻量裁决：被更新版本替代时记录新条目 id（supersede 链） */
  supersededBy?: string;
}

const FILE = `${AIOS_MEMORIES_DIR}/aios_memories.json`;
const MAX_MEMORIES = 200;
const INJECT_COUNT = 8;
/** 9D 裁决：episode 30 天 TTL（事实永存、事件淡忘） */
const EPISODE_TTL_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * 9D 轻量裁决——属性槽句法提取（规则化，4B 模型友好）。
 * 同属性的新 fact 到来时，旧 fact 标记 supersededBy，实现 supersede 链。
 * 例：「最喜欢杭州」→ slot=preference；改口「最喜欢上海」→ 旧条 supersede。
 */
export function extractAttrSlot(content: string): string | undefined {
  const c = content.trim();
  // 偏好类
  if (/喜欢|爱|偏好|最爱|最喜欢|钟爱/.test(c)) return 'preference';
  // 讨厌类
  if (/讨厌|不喜欢|反感|受不了/.test(c)) return 'dislike';
  // 正在做的事
  if (/在学|在做|在玩|在写|在读|在研究/.test(c)) return 'activity';
  // 身份
  if (/(?:^|是)一个|职业|身份|工作是|是一名/.test(c)) return 'identity';
  // 位置
  if (/住在|住在|家在|城市|通勤|上班/.test(c)) return 'location';
  return undefined;
}

let cache: AiosMemory[] | null = null;
let extracting = false;

// \u5bf9\u8bdd\u65e5\u5fd7\u8bed\u6599\u7f13\u5b58\uff08dateStr \u2192 content\uff09
let conversationCache: Map<string, string> = new Map();

export async function load(): Promise<AiosMemory[]> {
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

export async function save(memories: AiosMemory[]): Promise<void> {
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
  const newId = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
  // 9D 轻量裁决：fact 类型提取属性槽，同属性新替旧（supersede 链）
  let attrSlot: string | undefined;
  if (type === 'fact') {
    attrSlot = extractAttrSlot(trimmed);
    if (attrSlot) {
      // 同属性槽且未被替代过的旧 fact，标记为 supersededBy
      for (const m of memories) {
        if (
          m.type === 'fact' &&
          m.attrSlot === attrSlot &&
          !m.supersededBy
        ) {
          m.supersededBy = newId;
        }
      }
    }
  }
  memories.push({
    id: newId,
    type,
    content: trimmed.slice(0, 200),
    keywords: generateKeywords(trimmed),
    ts: Date.now(),
    ...(attrSlot ? {attrSlot} : {}),
  });
  await save(memories);
  console.log(
    '[aiosMemory] 记住了:',
    trimmed.slice(0, 40),
    attrSlot ? `(slot=${attrSlot})` : '',
  );
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
    // 9D 裁决：只聚合 supersede 链尾（未被替代的 fact），画像不自相矛盾
    const facts = memories.filter(m => m.type === 'fact' && !m.supersededBy);
    if (facts.length === 0) {
      return; // Don't overwrite if no facts yet
    }
    const lines = facts.map(f => `- ${f.content}`);
    const content = `# 大王画像\n\n由记忆系统从 fact 类记忆自动聚合（${new Date().toLocaleString()}）\n\n${lines.join('\n')}\n`;
    await RNFS.writeFile(AIOS_USER_FILE, content, 'utf8');
    console.log('[aiosMemory] USER.md refreshed with', facts.length, 'facts (chain tails only)');
  } catch (e) {
    console.warn('[aiosMemory] refreshUserMd failed:', e);
  }
}

export async function clearMemories(): Promise<void> {
  await save([]);
}

/** Testability: 重置模块缓存（测试间隔离用，生产代码不调用） */
export function _invalidateCache(): void {
  cache = null;
}

export async function listMemories(): Promise<AiosMemory[]> {
  return (await load()).slice().reverse();
}

/**
 * \u6784\u5efa\u6ce8\u5165 system prompt \u7684\u8bb0\u5fc6\u788e\u7247\uff08\u7531 useChatSession \u8c03\u7528\uff09\u3002
 * \u63a5\u6536\u5f53\u524d\u7528\u6237\u8f93\u5165\uff0c\u505a\u5173\u952e\u8bcd\u5339\u914d\u8fd4\u56de\u6700\u76f8\u5173\u7684 INJECT_COUNT \u6761\u8bb0\u5fc6\u3002
 */
/**
 * 意图引导装填（批次 9-3 · task_hint 式主动装填）
 *
 * 大王纲领：「用——治理好要用得上才有用」。
 * 根据 classifyIntent 四态调整注入策略，注入量减半（8→≤4）但更相关。
 */
export async function buildMemoryFragment(
  userText?: string,
  intent?: IntentKind,
): Promise<string> {
  try {
    const memories = await load();
    if (memories.length === 0) {
      return '';
    }
    // 9D 裁决：过滤被替代的记忆（supersede 链尾才注入） + episode 30 天 TTL
    const now = Date.now();
    const visible = memories.filter(m => {
      if (m.supersededBy) {
        return false; // 已被新 fact 替代，不再注入
      }
      if (m.type === 'episode' && now - m.ts > EPISODE_TTL_MS) {
        return false; // episode 30 天淡忘（事实永存、事件淡忘）
      }
      return true;
    });
    if (visible.length === 0) {
      return '';
    }
    // 意图引导：注入量减半（8→4），按意图调整选择策略
    const injectCount = intent ? Math.min(4, INJECT_COUNT) : INJECT_COUNT;
    let selected: AiosMemory[];
    if (userText && userText.trim()) {
      const scored = visible
        .map(m => ({m, score: scoreMatch(userText, m)}))
        .sort((a, b) => b.score - a.score);
      const matched = scored.filter(s => s.score > 0).slice(0, injectCount);
      if (matched.length > 0) {
        selected = matched.map(s => s.m);
      } else {
        // 无关键词命中时，按意图选默认集
        selected = selectByIntent(visible, intent, injectCount);
      }
    } else {
      selected = selectByIntent(visible, intent, injectCount);
    }
    const lines = selected.map(m => `- [${m.type}] ${m.content}`);
    return lines.length
      ? '【你对大王的记忆】(相关时自然用上，别全部复述):\n' +
          lines.join('\n')
      : '';
  } catch (e) {
    console.warn('[aiosMemory] fragment build failed:', e);
    return '';
  }
}

/**
 * 按意图选择默认记忆集（无关键词命中时的 fallback 策略）
 * - task：fact 优先（大王属性/偏好/正在做的事）
 * - vent：insight 优先（女妖对大王的感悟 + 关怀记忆）
 * - qa/chat：最近 episode + fact 混合
 */
function selectByIntent(
  visible: AiosMemory[],
  intent: IntentKind | undefined,
  count: number,
): AiosMemory[] {
  if (intent === 'task') {
    // fact 优先，不足补充最近 episode
    const facts = visible.filter(m => m.type === 'fact').slice(-count);
    if (facts.length >= count) return facts;
    const episodes = visible
      .filter(m => m.type === 'episode')
      .slice(-(count - facts.length));
    return [...facts, ...episodes];
  }
  if (intent === 'vent') {
    // insight 优先（女妖对大王的感悟），不足补充 fact
    const insights = visible.filter(m => m.type === 'insight').slice(-count);
    if (insights.length >= count) return insights;
    const facts = visible
      .filter(m => m.type === 'fact')
      .slice(-(count - insights.length));
    return [...insights, ...facts];
  }
  // qa / chat：最近混合
  return visible.slice(-count);
}

// search logic moved to searchEngine.ts (spec: independent file)
// FTS5 not available (WatermelonDB wraps SQLite), using pure JS full-text search
export {searchMemory, updateConversationCache, initIndex} from './searchEngine';
export {compactAndFlush, listSummaryDates, readSummary} from './compaction';
export {governMemories, rotateOldLogs} from './governance';
export type {GovernanceResult} from './governance';

// ---- \u7a33\u5b9a\u62bd\u53d6\uff08grammar \u7ea6\u675f + \u5f3a\u8bed\u4e49\u8fc7\u6ee4\uff09----

// P2 \u590d\u6d4b\uff082026-08-17 \u771f\u673a\uff09\uff1a\u65e7\u7248 prompt \u7ea6\u675f\u8fc7\u5f31 \u2192 fact \u7c7b\u578b\u6c61\u67d3
// \uff08\u5973\u5996\u81ea\u8ff0/\u4eba\u8bbe\u590d\u8ff0/\u7591\u95ee\u53e5/\u751f\u56fe\u63d0\u793a\u8bcd/\u82f1\u6587\u6b8b\u7559\u6df7\u5165 USER.md \u753b\u50cf\uff09\u3002
// v2 \u4fee\u590d\uff1a\u9650\u5b9a\u53ea\u4ece\u300c\u5927\u738b:\u300d\u4fa7\u63d0\u53d6 + \u4e09\u7c7b\u578b\u8bed\u4e49\u5b9a\u4e49 + \u663e\u5f0f\u6392\u9664\u6e05\u5355 + \u5b81\u7f3a\u52ff\u6ee5\u3002
const EXTRACTION_SYSTEM =
  '\u4f60\u662f\u8bb0\u5fc6\u63d0\u53d6\u52a9\u624b\u3002\u4e0b\u9762\u662f\u4e00\u6bb5\u771f\u5b9e\u5bf9\u8bdd\uff0c\u6bcf\u884c\u683c\u5f0f\u4e3a\u300c\u5927\u738b:\u300d\u6216\u300c\u5973\u5996:\u300d\u3002' +
  '\u53ea\u4ece\u300c\u5927\u738b:\u300d\u7684\u53d1\u8a00\u4e2d\u63d0\u53d6\u5173\u4e8e\u5927\u738b\u672c\u4eba\u7684\u3001\u7a33\u5b9a\u4e14\u503c\u5f97\u957f\u671f\u8bb0\u4f4f\u7684\u65b0\u4fe1\u606f\u3002' +
  '\u4e09\u7c7b\u8bb0\u5fc6\u5b9a\u4e49\uff1a' +
  '  fact: \u5927\u738b\u7684\u957f\u671f\u5c5e\u6027/\u504f\u597d/\u8eab\u4efd/\u6b63\u5728\u505a\u7684\u4e8b\uff08\u5982\u300c\u5927\u738b\u559c\u6b22\u9752\u8272\u300d\u300c\u5927\u738b\u5728\u5b66\u5409\u4ed6\u300d\uff09\uff1b' +
  '  episode: \u672c\u6b21\u5bf9\u8bdd\u4e2d\u53d1\u751f\u7684\u5177\u4f53\u4e8b\u4ef6\uff08\u5982\u300c\u5927\u738b\u4eca\u5929\u53bb\u897f\u6e56\u73a9\u4e86\u300d\uff09\uff1b' +
  '  insight: \u5973\u5996\u5bf9\u5927\u738b\u6216\u5bf9\u8bdd\u7684\u611f\u609f\uff08\u4ee5\u5973\u5996\u89c6\u89d2\uff0c\u5982\u300c\u5927\u738b\u5176\u5b9e\u5f88\u5728\u610f\u7ec6\u8282\u300d\uff09\u3002' +
  '\u4e25\u683c\u6392\u9664\uff08\u4e0d\u5f97\u63d0\u53d6\uff09\uff1a\u5973\u5996\u81ea\u5df1\u7684\u53d1\u8a00\u4e0e\u81ea\u8ff0\u3001\u4eba\u8bbe/\u7cfb\u7edf\u63d0\u793a\u8bcd\u590d\u8ff0\u3001\u7591\u95ee\u53e5\uff08\u542b\u5927\u738b\u7684\u53cd\u95ee\uff09\u3001' +
  '\u5bd2\u6696\u5ba2\u5957\u3001\u4e34\u65f6\u4efb\u52a1\u6307\u4ee4\uff08\u5199\u4f5c/\u751f\u56fe\u7b49\u8bf7\u6c42\uff09\u3001\u63d0\u793a\u8bcd\u5185\u5bb9\u3001\u82f1\u6587\u6b8b\u7559\u3001\u4e0e\u5df2\u6709\u8bb0\u5fc6\u91cd\u590d\u7684\u4fe1\u606f\u3002' +
  'content \u7528\u81ea\u5df1\u7684\u8bdd\u6982\u62ec\uff0c\u4e0d\u8d85\u8fc7 20 \u5b57\uff0c\u5fc5\u987b\u6765\u81ea\u5bf9\u8bdd\u771f\u5b9e\u5185\u5bb9\u3002' +
  '\u5b81\u7f3a\u52ff\u6ee5\uff1a\u6ca1\u6709\u65b0\u7684\u503c\u5f97\u8bb0\u7684\u4fe1\u606f\u5c31\u8f93\u51fa {"memories":[]}\u3002' +
  '\u8f93\u51fa\u4e25\u683c JSON: {"memories":[{"type":"fact|episode|insight","content":"..."}]}\u3002\u53ea\u8f93\u51faJSON\u3002';

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
  // 提取引擎：优先当前对话大模型；管家直答模式下（modelStore.engine 为空，
  // P1 新语义 chitchat 走管家）回退到管家引擎——否则记忆提取永不触发。
  // （P2 真机复测 2026-08-17 修复：提取小任务 1B 管家足以胜任）
  const engine = modelStore.engine ?? (promptWriter.isLoaded ? promptWriter : null);
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
