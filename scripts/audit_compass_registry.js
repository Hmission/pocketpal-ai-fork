#!/usr/bin/env node
/**
 * audit:compass — 指南针登记面与执行面强制对账
 *
 * 立项缘由（2026-09-07 全量排查，docs/POCKETPAL_CHAIN_AUDIT_20260907.md §4.1）：
 * `COMPASS_REGISTRY.md` §2 把 CP-APP-007..013 七条标为「✅ 已登记」，而
 * `src/debug/errorRegistry.ts` 的 ERROR_PATTERNS 里根本没有对应 triggerRegex——
 * `matchFirstError` 永远匹配不到。指南针的核心承诺（犯错现场即给修复指引）在
 * 7/17 的锚点上是空的，而文档看起来全绿。**这类病靠人记得去对账必然复发。**
 *
 * 三条铁律（对账方向的定义，缺一即 exit 1）：
 *   A. 文档 §2 登记的每个 cpId（CP-APP-000 哨兵除外）必须在 ERROR_PATTERNS 中有 regex 条目；
 *   B. 状态列写「已落地」者，代码侧必须真有该 cpId（禁止文档单方面宣称）；
 *   C. 代码里有、文档没登记的 cpId → 同样违规（双向闭合）。
 * 附加：可达性检查——文档与代码里「看起来完整」的路径指针必须存在（悬空指针是同类病的另一半）。
 *
 * 保守原则：闸门**宁可漏报不可误报**——含 `...`、`{a,b}` 简写、空格、中文括号的
 * 路径一律跳过；一旦误报，闸门会被人关掉，就白造了。
 *
 * 用法：node scripts/audit_compass_registry.js   （退出码 0=通过 / 1=有违规）
 */
const fs = require('fs');
const path = require('path');

const REGISTRY = 'docs/DebugRemoteControl/COMPASS_REGISTRY.md';
const ERROR_REGISTRY = 'src/debug/errorRegistry.ts';

const fail = msg => {
  console.error(`[audit:compass] ✗ ${msg}`);
  process.exit(1);
};

if (!fs.existsSync(REGISTRY)) {
  fail(`找不到登记表 ${REGISTRY}`);
}
if (!fs.existsSync(ERROR_REGISTRY)) {
  fail(`找不到执行面 ${ERROR_REGISTRY}`);
}

const read = p => fs.readFileSync(p, 'utf8').replace(/\r\n/g, '\n');

// ---------- 1) 解析文档 §2 表格（cpId / 状态 / 深入列） ----------
const regLines = read(REGISTRY).split('\n');
const h2 = regLines
  .map((l, i) => (/^## 2\./.test(l) ? i : -1))
  .filter(i => i >= 0);
if (h2.length !== 1) {
  fail(`§2 标题应唯一，实为 ${h2.length} 个——解析口径失效，先修文档`);
}
let h2End = regLines.findIndex((l, i) => i > h2[0] && /^## \d/.test(l));
if (h2End < 0) {
  h2End = regLines.length;
}
const docRows = [];
for (let i = h2[0] + 1; i < h2End; i++) {
  const cells = regLines[i]
    .split('|')
    .map(c => c.trim())
    .filter(Boolean);
  if (cells.length < 4 || !/^CP-APP-\d+$/.test(cells[0])) {
    continue; // 表头 / 分隔行 / 非编号行
  }
  docRows.push({
    cpId: cells[0],
    deepDive: cells[cells.length - 2],
    status: cells[cells.length - 1],
  });
}
if (docRows.length < 10) {
  fail(`§2 只解析到 ${docRows.length} 行编号，明显偏少——解析口径可能已失配`);
}

// ---------- 2) 解析代码 ERROR_PATTERNS 的 cpId ----------
const code = read(ERROR_REGISTRY);
const codeIds = [...code.matchAll(/cpId:\s*'([^']+)'/g)].map(m => m[1]);
if (codeIds.length < 5) {
  fail(`ERROR_PATTERNS 只解析到 ${codeIds.length} 条 cpId，解析口径失效`);
}
const codeSet = new Set(codeIds);
const SENTINEL = 'CP-APP-000'; // 未收录错误兜底，按设计无 regex

const problems = [];

// A. 文档登记 → 代码必须有
for (const r of docRows) {
  if (r.cpId === SENTINEL) {
    continue;
  }
  if (!codeSet.has(r.cpId)) {
    problems.push(
      `${r.cpId} 文档标「${r.status}」，但 errorRegistry 无 triggerRegex 条目 → matchFirstError 永不可命中`,
    );
  }
}

// B. 自称「已落地」→ 代码必须有（与 A 同集合，但单独判：防止状态列撒谎）
for (const r of docRows) {
  if (r.cpId === SENTINEL) {
    continue;
  }
  if (/已落地/.test(r.status) && !codeSet.has(r.cpId)) {
    problems.push(`${r.cpId} 状态列写「已落地」但代码无实现（文档单方面宣称）`);
  }
}

// C. 代码有 → 文档必须登记
const docSet = new Set(docRows.map(r => r.cpId));
for (const id of codeSet) {
  if (!docSet.has(id)) {
    problems.push(
      `${id} 代码有 triggerRegex，但 COMPASS_REGISTRY §2 未登记（反向缺口）`,
    );
  }
}

// ---------- 3) 路径可达性（登记面 + 执行面） ----------
/** 只校验"看起来完整"的路径，含省略/简写/中文的一律跳过——闸门不可误报。 */
const PATH_RE =
  /(?:docs|src|scripts|android|e2d?e|assets)\/[A-Za-z0-9_\-./]+\.(?:md|ts|tsx|js|jsx|kt|json)/g;

function collectPathTokens(text) {
  const out = [];
  for (const m of text.matchAll(PATH_RE)) {
    const p = m[0];
    if (p.includes('...') || p.includes('{') || p.includes('（')) {
      continue;
    }
    out.push(p);
  }
  return out;
}

const candidates = new Set();
for (const r of docRows) {
  collectPathTokens(r.deepDive).forEach(p => candidates.add(p));
}
// 代码侧 deepDive 数组内容
for (const m of code.matchAll(/deepDive:\s*\[([\s\S]*?)\]/g)) {
  collectPathTokens(m[1]).forEach(p => candidates.add(p));
}

let pathChecked = 0;
for (const p of candidates) {
  pathChecked++;
  if (!fs.existsSync(path.resolve(p))) {
    problems.push(`悬空指针（不存在）：${p}`);
  }
}

// ---------- 4) 输出 ----------
if (problems.length) {
  console.error(
    `[audit:compass] 违规 ${problems.length} 项（登记 ${docRows.length} 条 / 代码 ${codeSet.size} 条 / 路径校验 ${pathChecked} 个）：`,
  );
  for (const p of problems) {
    console.error(`  - ${p}`);
  }
  process.exit(1);
}
console.log(
  `[audit:compass] ✓ 登记 ${docRows.length} 条 × 代码 ${codeSet.size} 条双向闭合；路径校验 ${pathChecked} 个全部可达`,
);
