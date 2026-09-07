/**
 * #711 kg | CP=CORE-1 | ST=running | 测试: __tests__/kg.test.ts
 *   SSOT: docs/POCKETPAL_AIOS_CORE_SPEC.md Wave C | 铁律: 先问谱后 grep
 *   入口: buildKg（冷启动 initIndex 后）/ recallKg（searchMemory 谱优先层）
 *   角色: 端侧轻量洋葱图——记忆条目/会话两实体，关键词共现建边。
 *        与母仓 85K KG 同协议不同规模：「只搬协议不搬代码」（埋头表规模）。
 *
 * 实体边语义：
 *   memory ↔ conv（co_occurrence 共现 ≥2 关键词）——问某记忆拉同语境会话；
 *   memory → memory（supersedes 替代链，9D 轻量裁决 supersededBy 落图）。
 * 工具事件实体暂不接线：无消费方不建边（锋利原则，有消费方再补）。
 */
import * as RNFS from '@dr.pogodin/react-native-fs';
import {emit} from '../../debug/eventStream';
import {HANZI_BMP_CHAR_RE} from '../../utils/cjk';
import {AIOS_CONVERSATIONS_DIR, AIOS_DB_DIR} from '../../utils/paths';
import {listMemories} from '../aiosMemory';

export interface KgNode {
  id: string;
  type: 'memory' | 'conv';
  label: string;
  snippet: string;
  keywords: string[];
  ts: number;
}

export interface KgEdge {
  from: string;
  to: string;
  rel: 'co_occurrence' | 'supersedes';
  weight: number;
}

interface KgStore {
  nodes: KgNode[];
  edges: KgEdge[];
}

export interface KgHit {
  id: string;
  type: 'memory' | 'conv';
  label: string;
  snippet: string;
  /** direct=查询命中节点本身；neighbor=经一跳边扩张命中 */
  via: 'direct' | 'neighbor';
}

const KG_FILE = `${AIOS_DB_DIR}/kg.json`;
/** 规模上限：手机端图谱宁小勿滥，超出按 ts 裁旧（文件即过期公理） */
const MAX_NODES = 600;
const MAX_EDGES = 1200;
/** 每节点最大连边数（防团伙节点爆炸） */
const MAX_EDGES_PER_NODE = 6;
/** 共现建边阈值：≥2 个共享关键词才认「同语境」 */
const CO_OCCUR_MIN_SHARED = 2;
/** 中文等无空格语言：CJK 二元组兜底提取（附加 ASCII 词）。
 *  只认 BMP 常用区的口径与理由见 `utils/cjk`（`HANZI_BMP_CHAR_RE`）。 */
const STOP_WORDS = new Set([
  '我们',
  '你们',
  '他们',
  '这个',
  '那个',
  '一个',
  '什么',
  '怎么',
  '自己',
  '可以',
  '没有',
  '就是',
  '不是',
  '知道',
  '觉得',
  '时候',
  '今天',
  '明天',
  '昨天',
  '然后',
  '因为',
  '所以',
  '但是',
  '如果',
]);

let store: KgStore | null = null;

function emptyStore(): KgStore {
  return {nodes: [], edges: []};
}

/** 关键词提取：ASCII 词 + CJK 二元组，词频过滤 + 停用词剔除。 */
export function extractKeywords(text: string, max = 12): string[] {
  const raw = String(text ?? '');
  if (!raw.trim()) {
    return [];
  }
  const freq = new Map<string, number>();
  const bump = (kw: string) => {
    if (kw.length >= 2 && !STOP_WORDS.has(kw)) {
      freq.set(kw, (freq.get(kw) ?? 0) + 1);
    }
  };
  for (const m of raw.match(/[a-zA-Z0-9_]{2,}/g) ?? []) {
    bump(m.toLowerCase());
  }
  for (let i = 0; i < raw.length - 1; i++) {
    if (HANZI_BMP_CHAR_RE.test(raw[i]) && HANZI_BMP_CHAR_RE.test(raw[i + 1])) {
      bump(raw.slice(i, i + 2));
    }
  }
  return [...freq.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, max)
    .map(([kw]) => kw);
}

function containsKeywords(text: string, kws: string[]): number {
  if (!text) {
    return 0;
  }
  return kws.filter(kw => text.includes(kw)).length;
}

async function loadStore(): Promise<KgStore> {
  if (store) {
    return store;
  }
  try {
    if (await RNFS.exists(KG_FILE)) {
      const raw = await RNFS.readFile(KG_FILE, 'utf8');
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.nodes)) {
        store = parsed as KgStore;
        return store;
      }
    }
  } catch {
    // 图谱为观测器官：文件损坏静默重建，不阻断主链
  }
  store = emptyStore();
  return store;
}

async function persist(): Promise<void> {
  try {
    await RNFS.mkdir(AIOS_DB_DIR);
    await RNFS.writeFile(KG_FILE, JSON.stringify(store), 'utf8');
  } catch {
    // 图谱写失败静默降级（BT07）：观测不为 SPOF
  }
}

function prune(): void {
  if (!store) {
    return;
  }
  if (store.nodes.length > MAX_NODES) {
    store.nodes.sort((a, b) => b.ts - a.ts);
    const keep = new Set(store.nodes.slice(0, MAX_NODES).map(n => n.id));
    store.nodes = store.nodes.filter(n => keep.has(n.id));
    store.edges = store.edges.filter(e => keep.has(e.from) && keep.has(e.to));
  }
  if (store.edges.length > MAX_EDGES) {
    store.edges.sort((a, b) => b.weight - a.weight);
    store.edges = store.edges.slice(0, MAX_EDGES);
  }
}

function upsertNode(node: KgNode): void {
  if (!store) {
    return;
  }
  const idx = store.nodes.findIndex(n => n.id === node.id);
  if (idx >= 0) {
    store.nodes[idx] = node;
  } else {
    store.nodes.push(node);
  }
}

function link(from: string, to: string, rel: KgEdge['rel']): void {
  const s = store;
  if (!s || from === to) {
    return;
  }
  const degree = (id: string) =>
    s.edges.filter(e => e.from === id || e.to === id).length;
  if (degree(from) >= MAX_EDGES_PER_NODE || degree(to) >= MAX_EDGES_PER_NODE) {
    return;
  }
  const existing = s.edges.find(
    e => (e.from === from && e.to === to) || (e.from === to && e.to === from),
  );
  if (existing) {
    existing.rel = rel;
    existing.weight += 1;
    return;
  }
  s.edges.push({from, to, rel, weight: 1});
}

/**
 * 构建/刷新图谱：记忆条目 + 会话文件两源。
 * 幂等：重复调用按 id 覆写节点、按共现重建边（旧边随节点裁剪）。
 * 失败静默（图谱是观测器官，不阻断冷启动主链）。
 */
export async function buildKg(): Promise<void> {
  try {
    const now = Date.now();
    await loadStore();
    if (!store) {
      return;
    }
    // 1. 记忆节点（keywords 优先用条目自带，缺省内容提取）
    const memories = await listMemories();
    for (const m of memories) {
      const keywords =
        m.keywords && m.keywords.length > 0
          ? m.keywords.slice(0, 12)
          : extractKeywords(m.content);
      upsertNode({
        id: `memory:${m.id}`,
        type: 'memory',
        label: `[${m.type}] ${m.content.slice(0, 18)}`,
        snippet: m.content.slice(0, 200),
        keywords,
        ts: m.ts || now,
      });
      // supersede 链落图：新替旧（沿 supersededBy 指向）
      if (m.supersededBy) {
        link(`memory:${m.id}`, `memory:${m.supersededBy}`, 'supersedes');
      }
    }
    // 2. 会话节点（工作区会话/日期 .md 文件，含晨间独白/日记语境）
    let convFiles: string[] = [];
    try {
      convFiles = (await RNFS.readDir(AIOS_CONVERSATIONS_DIR))
        .filter(f => f.name.endsWith('.md'))
        .map(f => f.name);
    } catch {
      convFiles = [];
    }
    for (const name of convFiles) {
      const text = await RNFS.readFile(
        `${AIOS_CONVERSATIONS_DIR}/${name}`,
        'utf8',
      );
      upsertNode({
        id: `conv:${name}`,
        type: 'conv',
        label: name,
        snippet: text.slice(0, 200),
        keywords: extractKeywords(text),
        ts: now,
      });
    }
    // 3. 共现建边：记忆 ↔ 会话（≥2 共享关键词）
    const convNodes = store.nodes.filter(n => n.type === 'conv');
    for (const mNode of store.nodes.filter(x => x.type === 'memory')) {
      for (const c of convNodes) {
        const shared = mNode.keywords.filter(kw =>
          containsKeywords(c.snippet, [kw]),
        ).length;
        if (shared >= CO_OCCUR_MIN_SHARED) {
          link(mNode.id, c.id, 'co_occurrence');
        }
      }
    }
    prune();
    await persist();
    emit('app', 'kg.built', {
      nodes: store.nodes.length,
      edges: store.edges.length,
    });
  } catch {
    // 图谱构建失败静默：下次冷启动再试（观测面留痕）
    emit('app', 'kg.build_failed', {});
  }
}

/**
 * 问谱（recall）：查询关键词命中节点 → 一跳边扩张。
 * 返回排序命中（direct 优先，邻居补位）。未命中返回空数组——
 * 调用方走既有全文链路（先问谱后 grep）。
 */
export async function recallKg(query: string, topN = 3): Promise<KgHit[]> {
  try {
    await loadStore();
    if (!store || store.nodes.length === 0) {
      return [];
    }
    const qkws = extractKeywords(query, 8);
    if (qkws.length === 0) {
      return [];
    }
    const scored = store.nodes
      .map(n => ({
        node: n,
        score:
          containsKeywords(n.snippet, qkws) + containsKeywords(n.label, qkws),
      }))
      .filter(x => x.score > 0)
      .sort((a, b) => b.score - a.score || b.node.ts - a.node.ts);
    if (scored.length === 0) {
      return [];
    }
    const direct = new Map<string, KgHit>();
    for (const s of scored.slice(0, topN)) {
      direct.set(s.node.id, {
        id: s.node.id,
        type: s.node.type,
        label: s.node.label,
        snippet: s.node.snippet,
        via: 'direct',
      });
    }
    // 一跳扩张：direct 节点的邻居，按边权重排序补位
    const neighborHits: KgHit[] = [];
    for (const s of scored.slice(0, topN)) {
      const edges = store.edges.filter(
        e => e.from === s.node.id || e.to === s.node.id,
      );
      edges.sort((a, b) => b.weight - a.weight);
      for (const e of edges) {
        const nid = e.from === s.node.id ? e.to : e.from;
        if (direct.has(nid)) {
          continue;
        }
        const node = store.nodes.find(n => n.id === nid);
        if (node) {
          neighborHits.push({
            id: node.id,
            type: node.type,
            label: node.label,
            snippet: node.snippet,
            via: 'neighbor',
          });
        }
        if (neighborHits.length >= topN) {
          break;
        }
      }
    }
    const hits = [...direct.values(), ...neighborHits.slice(0, topN)];
    return hits.slice(0, topN * 2);
  } catch {
    return [];
  }
}

/** 测试/调试辅助：内存态快照（缺省不落盘语义保持单源）。 */
export function kgSnapshot(): {nodes: number; edges: number} {
  return store
    ? {nodes: store.nodes.length, edges: store.edges.length}
    : {nodes: 0, edges: 0};
}

/** 测试辅助：重置内存态（不落盘）。 */
export function resetKgCache(): void {
  store = null;
}
