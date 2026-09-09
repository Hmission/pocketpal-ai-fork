/**
 * AIOS 口袋记忆 —— 本地记忆体（完全离线）
 *
 * 存储: AIOS_MEMORIES_DIR/aios_memories.json（共享目录，卸载不丢）
 * 注入: buildMemoryFragment(userText) 由 useChatSession 拼进 system prompt
 * 检索: searchMemory(query) 混合检索 conversations + memories（纯 JS，零依赖）
 * 提取: extractAndSaveMemories() 用 grammar 约束 JSON 输出（根治不稳定）
 * 人设: 已移入 AIOS Pal 的 systemPrompt，此处只管记忆存取
 */
import * as RNFS from '@dr.pogodin/react-native-fs';
import {AIOS_MEMORIES_DIR, AIOS_USER_FILE} from '../../utils/paths';
import {modelStore} from '../../store';
import {emit} from '../../debug/eventStream';
import {resolveLoadedLocalEngine} from '../../utils/localEngine';
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
  /**
   * 抽取来源留痕（§Wave E-3 / CORE-6 收口后的二值口径）。
   * local=本地引擎直出（grammar 约束的 JSON 一次解析成功）；
   * local_fallback_parse=本地引擎输出非法 JSON、靠扫大括号兜底才解出来。
   *
   * 已删的两个值及理由（不留空枚举位＝假留痕）：
   *  - 'limb'：抽取引擎**永远本地**（每轮都跑，自动上行等于把对话内容送去付费远端，
   *    违反 §2.1 隐私本地化），所以「义肢产的记忆」这个来源在本架构下不存在。旧写法
   *    把它等同于「本轮回答用了义肢」——那是**回答**的来源、不是**记忆**的来源，属谎报。
   *  - 'limb_offline_local'：降级路径产出的记忆与直接本地产出毫无差异，为零差异的值
   *    保留枚举位没有信息量。
   * 手工/工具写入（笔记、建写作项目）不传本字段＝undefined，在 memory.list 里落
   * 'unknown' 桶，与「抽取产」天然分流；兜底率 = fallback / (local + fallback)。
   */
  provenance?: 'local' | 'local_fallback_parse';
}

/**
 * 9D 记忆维度：是 `type` 的**派生视图**，不是落盘字段（§Wave C+ 改判，纠正 G3-1 假闭环）。
 *
 * 旧实现在 AiosMemory 上存 `dimension?: string`，注释宣称「对齐母仓 12 维总线」，实际：
 * 全仓零写入方 → 唯一读方 nineDInjector 的 `dimension ?? ''` 让 11 个维度桶恒空，
 * 只剩兜底 '' 桶命中，「按维度优先级注入」退化成「按时间倒序取最新 3 条」。
 *
 * 母仓 ADR-0227 明确只有 D4/D5/D7/D8 可持久化，D1/D2/D3/D6/D9 明令不入记忆；而旧
 * DIM_ORDER 里的 D_CONT / D_GOV 在母仓体系无对应物，属本仓另造词面——一并删。
 * 事实由 type 唯一确定（fact→D7 大王锚定、insight→D5 链路上文），存字段就是造第二个
 * 可漂移的事实源。D4(伤疤)/D8(演化) 目前无生产者，按 §七 CORE-5 挂账，不先建空桶。
 */
export type MemoryDimension = 'D7' | 'D5' | '';

export function memoryDimension(m: Pick<AiosMemory, 'type'>): MemoryDimension {
  if (m.type === 'fact') {
    return 'D7';
  }
  if (m.type === 'insight') {
    return 'D5';
  }
  return '';
}

/** 注入排序的次级键：同相关性时大王锚定优先，其次链路上文，最后事件/通用。 */
const DIMENSION_PRIORITY: Record<MemoryDimension, number> = {
  D7: 0,
  D5: 1,
  '': 2,
};

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
 * 从文本生成关键词用于检索匹配。
 * 中文: 2-4字滑窗；英文: 按空格/标点分词。
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

/** 计算记忆与当前用户输入的关键词匹配分数 */
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
  provenance?: AiosMemory['provenance'],
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
        if (m.type === 'fact' && m.attrSlot === attrSlot && !m.supersededBy) {
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
    ...(provenance ? {provenance} : {}),
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
export async function updateMemoryContent(
  id: string,
  content: string,
): Promise<void> {
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
    console.log(
      '[aiosMemory] USER.md refreshed with',
      facts.length,
      'facts (chain tails only)',
    );
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
 * 构建注入 system prompt 的记忆碎片（由 useChatSession 调用）。
 * 接收当前用户输入，做关键词匹配返回最相关的 INJECT_COUNT 条记忆。
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
        // §Wave C+：相关性为主键 → 维度优先级为次键（由 memoryDimension 派生，非落盘
        // 字段）→ 时间新者为末键。末键同时把排序定成全序：旧写法同分时依赖数组原序，
        // 而原序会随 supersede 写盘变动，注入集会无因抖动。
        .sort(
          (a, b) =>
            b.score - a.score ||
            DIMENSION_PRIORITY[memoryDimension(a.m)] -
              DIMENSION_PRIORITY[memoryDimension(b.m)] ||
            b.m.ts - a.m.ts,
        );
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
      ? '【你对大王的记忆】(相关时自然用上，别全部复述):\n' + lines.join('\n')
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
export type {RecallHit} from './searchEngine';
export {compactAndFlush, listSummaryDates, readSummary} from './compaction';
export {governMemories, rotateOldLogs} from './governance';
export type {GovernanceResult} from './governance';

// ---- 稳定抽取（grammar 约束 + 强语义过滤）----

// P2 复测（2026-08-17 真机）：旧版 prompt 约束过弱 → fact 类型污染
// （女妖自述/人设复述/疑问句/生图提示词/英文残留混入 USER.md 画像）。
// v3 修复（2026-08-23 真机事故复盘）：排除清单新增三类——瞬时状态（等待X/工具不可用/一次性需求）、
// 时效内容（新闻/天气/价格）、失败记录（工具调用失败/错误信息）；fact 定义收严为「长期稳定（跨天仍成立）」。
// 依据：记忆时效性三闸治理方案 闸1（原文在 `.qoder/specs/记忆时效性三闸治理方案_task-3g4.md`，
// 该目录被 `.gitignore` 排除**不入库**——所以上述三行排除清单就是本仓的唯一可读依据，
// 不得改为只指向本地路径。新读者读不到 spec 时，结论仍须自足）。
const EXTRACTION_SYSTEM =
  '你是记忆提取助手。下面是一段真实对话，每行格式为「大王:」或「女妖:」。' +
  '只从「大王:」的发言中提取关于大王本人的、稳定且值得长期记住的新信息。' +
  '三类记忆定义：' +
  '  fact: 大王的长期稳定属性/偏好/身份/正在做的事（跨天仍成立，如「大王喜欢青色」「大王在学吉他」）；' +
  '  episode: 本次对话中发生的具体事件（如「大王今天去西湖玩了」）；' +
  '  insight: 女妖对大王或对话的感悟（以女妖视角，如「大王其实很在意细节」）。' +
  '严格排除（不得提取）：女妖自己的发言与自述、人设/系统提示词复述、疑问句（含大王的反问）、' +
  '寒暄客套、临时任务指令（写作/生图等请求）、提示词内容、英文残留、与已有记忆重复的信息、' +
  '瞬时状态（正在等待X/工具不可用/今天的一次性需求）、时效内容（新闻/天气/价格等此刻才成立的事实）、失败记录（工具调用失败/错误信息）。' +
  'content 用自己的话概括，不超过 20 字，必须来自对话真实内容。' +
  '宁缺勿滥：没有新的值得记的信息就输出 {"memories":[]}。' +
  '输出严格 JSON: {"memories":[{"type":"fact|episode|insight","content":"..."}]}。只输出JSON。';

/** JSON schema 约束（根治抽取不稳定） */
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
 * 对话结束后用本地模型提取记忆（fire-and-forget，不阻塞 UI）。
 *
 * 引擎归属（§Wave E-3）：抽取**永远走本地引擎**，由 `resolveLoadedLocalEngine()`
 * 单点裁决（当前对话大模型优先，管家直答模式落常驻管家，都没加载则短路）。
 * 本函数**不接收任何引擎入参**，也不读 `modelStore.activeRemoteBinding`：
 * 抽取每轮都跑，若自动上行义肢就等于把对话内容送去付费远端，违反 §2.1 隐私本地化；
 * 而旧 `ExtractOpts` 的两个字段均无信息增量（engine 零调用方传递，provenance 在
 * 本地架构下只能取两个值）——参数越多，调用点与函数体越容易各自算一份不同的结论。
 *
 * 输出稳定性：靠 `response_format` 让 llama.rn 把它转成 grammar 约束采样（本地与
 * 远端两条路共用同一个 schema 真源），解析仍留一层扫大括号兜底——但走了兜底就会
 * 把 provenance 记为 `local_fallback_parse` 并 emit，兜底率可数（§七 CORE-6）。
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
    // 真丢了一轮记忆（推理还占着 → 本轮不重试 → 永久丢失），必须可观测。
    emit('app', 'memory.skipped', {reason: 'inferencing'});
    return;
  }
  // 本地引擎唯一裁决点（同文件内不得再写第二份回退表达式）。
  const engine = resolveLoadedLocalEngine();
  if (!engine) {
    emit('app', 'memory.skipped', {reason: 'no_local_engine'});
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
            content: `大王: ${userText.slice(0, 300)}\n女妖: ${assistantText.slice(0, 500)}`,
          },
        ],
        n_predict: 150,
        temperature: 0,
        response_format: EXTRACTION_SCHEMA,
        // Qwen 系模型开启 thinking 时 reasoning token 会混入流 → JSON 解析失败
        enable_thinking: false,
      },
      (data: {token?: string; content?: string}) => {
        const piece = data?.token ?? data?.content ?? '';
        if (typeof piece === 'string') {
          output += piece;
        }
      },
    );
    // 上面的 response_format 在本地由 llama.rn 转 grammar、在远端由 openaiClient
    // 透传，两边同一个 schema 真源。仍先剥非 JSON 头尾是因为 grammar 不管 BOS：
    // 本地输出可能带 `<s>` 前缀，个别模板会包围栏。
    const jsonText = output
      .trim()
      .replace(/^<s>\s*/i, '')
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/```\s*$/s, '');
    let parsed: any;
    // G4-2：追踪是否走了正则兜底，影响最终 provenance 值
    let usedFallbackParse = false;
    try {
      parsed = JSON.parse(jsonText);
    } catch {
      // 兜底：从输出中提取第一个 { 到最后一个 } 的子串（BOS/围栏/推理杂讯剔除后仍不
      // 是纯 JSON 时使用）
      const first = jsonText.indexOf('{');
      const last = jsonText.lastIndexOf('}');
      if (first >= 0 && last > first) {
        parsed = JSON.parse(jsonText.slice(first, last + 1));
        usedFallbackParse = true;
      } else {
        throw new Error('no JSON object found in extraction output');
      }
    }
    // provenance 终裁（§Wave E-3）：引擎固定本地，所以唯一有信息量的区分是
    // 「grammar 约束一次解出」还是「靠扫大括号兜底」——它直接衡量小模型产 JSON 的稳定性。
    const provenance: AiosMemory['provenance'] = usedFallbackParse
      ? 'local_fallback_parse'
      : 'local';
    const items = Array.isArray(parsed.memories) ? parsed.memories : [];
    let saved = 0;
    for (const item of items.slice(0, 3)) {
      if (item && typeof item.content === 'string' && item.content.trim()) {
        const type = ['fact', 'episode', 'insight'].includes(item.type)
          ? item.type
          : 'episode';
        await addMemory(type, item.content, provenance);
        saved++;
      }
    }
    // Refresh USER.md from fact memories after extraction
    await refreshUserMd();
    // 可观测面（§七 CORE-6）：provenance 写了就得有人能查，否则只是穿了件留痕外衣。
    // 域走 'app'——与 growth.* / kg.* / starmap.* / wake.check 同一归集口径。
    emit('app', 'memory.extracted', {
      count: saved,
      proposed: items.length,
      provenance,
    });
  } catch (e) {
    // 兜底可以留（fire-and-forget 不得砸坏聊天主链路），但失败必须可观测：
    // 旧写法只 console.warn，导致两个后果——① 抽取长期失败无人知晓；
    // ② 写在引擎回调里的单测断言被这个 catch 吞掉，测试恒不可红（§七 CORE-11）。
    console.warn('[aiosMemory] extraction failed:', e);
    emit('app', 'memory.failed', {
      error: e instanceof Error ? e.message : String(e),
    });
  } finally {
    extracting = false;
  }
}
