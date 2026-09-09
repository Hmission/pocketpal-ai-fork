#!/usr/bin/env node
/**
 * 异步定时器审查（§155 复发闸门 / TEST_INFRA_SPEC 律 2 的自动执行面）
 *
 * 抓的形态：`setInterval` / `setTimeout` 的回调最终执行 async 逻辑，而该调用**没有走收口
 * 原语**。这类点抛出的异常会逃逸成 unhandled rejection——不崩在原地，而被 jest / 运行时
 * 归给「当时正在跑」的上下文，表现成「每次报错位置都不同」的假 flake（§154 就是被这种
 * 形态误导了两轮）。
 *
 * ⚠ 本审查的核心规则（用一次事故换来的）：
 *   **只有走 `safeInterval` / `safeTimeout` 才算收口；体内有 `try` 或有 `.catch` 都不算。**
 *   ① `foo().catch(h)` 只能接住 foo 返回的 promise 的 rejection；当 `foo` 这个属性根本不
 *      存在时，抛出发生在**取 .catch 之前**，是同步 TypeError，catch 链碰不到（实例：
 *      imageGenStore.pullSnapshot 里 `getPerfSnapshot().catch(() => null)`）。
 *   ② 行级 `try` 证明不了危险那一行被包住（§154 真凶体内就有 try，逃逸行在其范围外）。
 *   ③ 体内 `void X()` 是**主动丢弃 promise**，丢弃后原语外面套多少 try 都接不到它——所以
 *      `void X()` 本身就是命中条件之一，不要求 X 在本文件里被证明是 async。
 *
 * v2（2026-09-09，由 --selftest 探针实测后修掉的两处闸门自身缺陷）：
 *   ① **注释与字符串不参与扫描**。旧版逐行裸扫，结果 drcService 里一句「旧写法是
 *      setInterval(() => { void pollOnce(); })」的**解释性注释**被判成违规点（实测复现：
 *      闸门因文字说明而红）。闸门误报比漏报更糟——它会训练人去绕过闸门。
 *   ② **被调函数可以不在同一行**。旧版只在 `setInterval(` 所在行内找目标，而
 *      `setInterval(() => {\n void pollOnce();\n}, ms)` 这种多行箭头体完全漏报。
 *
 * v3（2026-09-09，CORE-14 事故后）：
 *   ① **纳入无主一次性延时 `setTimeout`**。旧版注释写着「纳入 setTimeout 会变噪音源，等有
 *      真实事故样本再定判据」——样本到了：两处 `setTimeout(() => { void a(); void b(); },
 *      1200)` 使全量 jest 溢出 74 条 `Cannot log after tests are done` 并令 worker 被强退，
 *      **352 套件全绿却 exit 1**。实测本判据在 src 内命中面极小（见 --verbose 计数）。
 *   ② **不再用固定行窗口猜回调体**，改为括号配对取第一实参——跨多行、嵌套箭头、体里再开
 *      定时器都能正确界定（行窗是 v2 的临时手法，本身也是一种猜）。
 *
 * 自检**每次跑闸门都先执行**（不另开手跑入口）：能单独跑的自检等于没有自检——
 * 它会在第一次被人省略后静默腐烂，而判据坏掉的闸门会绿给你看（AGENTS.md 纪律5）。
 * 夹具同时断言**净态**：逃逸形状必须全中、收口/注释/字符串/纯同步形状必须零命中——
 * 只会红的闸门与只会绿的闸门一样无用。
 *
 * 用法：node scripts/audit-async-timers.js [--verbose]
 * 退出码：自检不通过或存在未收口点则 1（便于接门禁）。
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'src');

function walk(dir, acc) {
  const out = acc || [];
  fs.readdirSync(dir).forEach(name => {
    const p = path.join(dir, name);
    if (fs.statSync(p).isDirectory()) {
      if (name !== '__tests__') walk(p, out);
    } else if (name.endsWith('.ts') || name.endsWith('.tsx')) out.push(p);
  });
  return out;
}

/**
 * 把注释替换为等长空白、字符串字面量内容替换为空格，保持行列号不变。
 * 目的：扫描面只留真实代码，注释里描述危险形状不再触发误报（v2 缺陷①）。
 * 已知边界：不解析正则字面量（本仓源码里没有含 setInterval/setTimeout 的正则；即便出现，
 * 也只会少报不会误报）；模板串 ${} 内嵌代码按真代码保留。
 */
function maskNonCode(text) {
  const out = [];
  const n = text.length;
  let i = 0;
  while (i < n) {
    const ch = text[i];
    const next = text[i + 1];
    if (ch === '/' && next === '/') {
      let j = i;
      while (j < n && text[j] !== '\n') j++;
      for (let k = i; k < j; k++) out.push(' ');
      i = j;
      continue;
    }
    if (ch === '/' && next === '*') {
      let j = i + 2;
      while (j < n && !(text[j] === '*' && text[j + 1] === '/')) j++;
      j = Math.min(n, j + 2);
      for (let k = i; k < j; k++) out.push(text[k] === '\n' ? '\n' : ' ');
      i = j;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') {
      out.push(ch);
      i++;
      while (i < n) {
        if (text[i] === '\\') {
          out.push(' ');
          out.push(text[i + 1] === '\n' ? '\n' : ' ');
          i += 2;
          continue;
        }
        if (text[i] === ch) break;
        if (ch === '`' && text[i] === '$' && text[i + 1] === '{') {
          // 模板插值：里面是真代码，原样保留到配平的 }
          let depth = 1;
          out.push('$', '{');
          i += 2;
          while (i < n && depth > 0) {
            if (text[i] === '{') depth++;
            else if (text[i] === '}') depth--;
            out.push(text[i]);
            i++;
          }
          continue;
        }
        out.push(text[i] === '\n' ? '\n' : ' ');
        i++;
      }
      if (i < n) {
        out.push(text[i]);
        i++;
      }
      continue;
    }
    out.push(ch);
    i++;
  }
  return out.join('');
}

/** 行号（1-based）：按偏移量数换行符。为保持报告可读，宁可 O(n) 也不另建索引结构。 */
function lineOf(offset, text) {
  let line = 1;
  for (let i = 0; i < offset; i++) {
    if (text[i] === '\n') line++;
  }
  return line;
}

/**
 * 从 `fn(` 的左括号之后取**第一个实参**文本（括号/引号配对，跨行安全）。
 * 返回 {arg, end} —— end 为该实参结束（顶层逗号或右括号）处的偏移。
 * 之所以只要第一个实参：回调永远是第一个，而 ms/依赖数组等后续实参里没有可逃逸的体。
 */
function firstArg(text, openIdx) {
  let i = openIdx + 1;
  let depth = 0;
  let start = i;
  while (i < text.length) {
    const c = text[i];
    if (c === '"' || c === "'" || c === '`') {
      // 实参里的字符串：整段跳过（内部括号不算）
      let j = i + 1;
      while (j < text.length) {
        if (text[j] === '\\') {
          j += 2;
          continue;
        }
        if (text[j] === c) break;
        j++;
      }
      i = Math.min(text.length, j + 1);
      continue;
    }
    if (c === '(' || c === '[' || c === '{') depth++;
    else if (c === ')' || c === ']' || c === '}') {
      if (depth === 0) return {arg: text.slice(start, i), end: i};
      depth--;
    } else if ((c === ',' || c === ';') && depth === 0) {
      return {arg: text.slice(start, i), end: i};
    }
    i++;
  }
  return {arg: text.slice(start), end: text.length};
}

/** 把 [from, to) 抹成空白（换行原样保留，以保持行列号与偏移量对齐）。 */
function blankRange(chars, from, to) {
  for (let i = from; i < to && i < chars.length; i++) {
    if (chars[i] !== '\n') chars[i] = ' ';
  }
}

/** 从 openIdx（左括号位置）扫到配平的右括号，返回其位置；找不到返回 -1。 */
function matchingParen(text, openIdx) {
  let depth = 0;
  let i = openIdx;
  while (i < text.length) {
    const c = text[i];
    if (c === '"' || c === "'" || c === '`') {
      let j = i + 1;
      while (j < text.length) {
        if (text[j] === '\\') {
          j += 2;
          continue;
        }
        if (text[j] === c) break;
        j++;
      }
      i = j + 1;
      continue;
    }
    if (c === '(' || c === '[' || c === '{') depth++;
    else if (c === ')' || c === ']' || c === '}') {
      depth--;
      if (depth === 0) return i;
    }
    i++;
  }
  return -1;
}

/** 标识符前缀判定：`x.setInterval(` / `asetInterval(` 这种不算裸调用。 */
function isBareCall(text, idx, needle) {
  const prev = text[idx - 1];
  if (prev && /[\w$.]/.test(prev)) return false;
  // 后面必须紧跟参数，且不能是 `safeXxx(` 的名字尾巴（needle 自身已含左括号，故无需再看）
  return idx + needle.length <= text.length;
}

/** 找名为 name 的 async 函数/方法定义行；找不到返回 -1（视为同步回调，无逃逸风险） */
function defLineOf(lines, name) {
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (l.indexOf(name + '(') < 0 && l.indexOf(name + ' =') < 0) continue;
    const isMethod = new RegExp('\\basync\\s+' + name + '\\s*\\(').test(l);
    const isAsyncFn =
      new RegExp('const\\s+' + name + '\\s*=\\s*async').test(l) ||
      new RegExp('async\\s+function\\s+' + name + '\\b').test(l);
    if (isMethod || isAsyncFn) return i;
  }
  return -1;
}

const CALL_RE = /([A-Za-z_$][\w$]*)\s*\(/g;

/** 列出文本内出现的所有被调用标识符 */
function callsIn(text) {
  const names = [];
  CALL_RE.lastIndex = 0;
  let m;
  while ((m = CALL_RE.exec(text))) names.push(m[1]);
  return names;
}

const PRIMITIVES = ['setInterval', 'setTimeout'];

/**
 * 扫描一份源码文本，返回命中列表。抽成纯函数是为了让自检能拿内联夹具直接喂。
 */
function collectFindings(rel, raw) {
  const local = [];
  const text = maskNonCode(raw);
  const rawLines = raw.split('\n');
  const GUARDS = ['safeInterval(', 'safeTimeout('];

  // 第一遍：定位**已收口**调用，整段抹平后再扫危险形状。
  // 为何必须抹：外层 `setInterval(() => { safeInterval("inner", () => { void p(); }, 50) })`
  // 的回调体里那句 void 完全在受保护范围内，抹之前会被当成外层的逃逸（自检夹具 18 行
  // 现行抓到过这个误报）。收口调用本身另列一条 guarded 记录，以免只剩「不报」而看不出原因。
  const chars = text.split('');
  GUARDS.forEach(guard => {
    let from = 0;
    for (;;) {
      const idx = text.indexOf(guard, from);
      if (idx < 0) break;
      from = idx + guard.length;
      const name = guard.slice(0, -1);
      if (idx > 0 && /[\w$.]/.test(text[idx - 1])) continue;
      // 声明不是调用：`export function safeInterval(` 记成收口点会把计数吹胖，
      // 更坑的是它的参数/函数体会被整段抹掉，从此本文件里的真风险点谁也扫不到。
      if (
        /\b(function|const|let|var)\s+$/.test(
          text.slice(Math.max(0, idx - 20), idx),
        )
      ) {
        continue;
      }
      const open = idx + guard.length - 1;
      const close = matchingParen(text, open);
      if (close < 0) continue;
      local.push({
        file: rel,
        line: lineOf(idx, text),
        kind: 'via-' + name,
        guarded: true,
        code: (rawLines[lineOf(idx, text) - 1] || '').trim().slice(0, 72),
      });
      blankRange(chars, idx, close + 1);
    }
  });

  const codeOnly = chars.join('');
  const lines = codeOnly.split('\n');

  PRIMITIVES.forEach(fn => {
    const needle = fn + '(';
    let from = 0;
    for (;;) {
      const idx = codeOnly.indexOf(needle, from);
      if (idx < 0) break;
      from = idx + needle.length;
      if (!isBareCall(codeOnly, idx, needle)) continue;

      const {arg} = firstArg(codeOnly, idx + needle.length - 1);
      const trimmed = arg.trim();
      let kind;

      if (/^async\b/.test(trimmed)) {
        // setTimeout(async () => { ... })：危险体就在调用点
        kind = 'inline-async';
      } else {
        const namedDirect = trimmed.match(/^([A-Za-z_$][\w$]*)\s*$/);
        if (namedDirect) {
          // setInterval(fn, ms)：目标已确定，只有它是 async 定义才算风险
          if (defLineOf(lines, namedDirect[1]) < 0) continue;
          kind = 'named:' + namedDirect[1];
        } else {
          // 箭头体：主动丢弃 promise（void X()）即命中，不必证明 X 是 async；
          // 否则退回到「本文件里确实定义成 async」的那条判定链。
          const voided = arg.match(/\bvoid\s+([A-Za-z_$][\w$.]*)\s*\(/);
          if (voided) {
            kind = 'arrow-drops-promise:' + voided[1];
          } else {
            const cand = callsIn(arg).find(nm => defLineOf(lines, nm) >= 0);
            if (!cand) continue;
            // 一次性延时的不对称口径（有意为之，不是为凑绿开的口子）：
            // 体内那句已挂 `.catch(` 时不算逃逸——rejection 当场被接住，且这类写法的
            // 句柄通常由调用方持有并 clear（本仓实例：paths.ts 的 10s debounce 快照）。
            // setInterval 不享有此例外：§154 的真凶正是 `getPerfSnapshot().catch(() => null)`
            // ——它接不住「方法根本不存在」的同步 TypeError，而且轮询是每轮都逃。
            if (fn === 'setTimeout' && arg.indexOf('.catch(') >= 0) continue;
            kind = 'arrow-calls-' + cand;
          }
        }
      }

      const ln = lineOf(idx, codeOnly);
      local.push({
        file: rel,
        line: ln,
        kind: fn + '/' + kind,
        guarded: false,
        code: (rawLines[ln - 1] || '').trim().slice(0, 72),
      });
    }
  });
  return local;
}

/**
 * 自检夹具。期望命中行 = [4, 7, 10, 12, 15, 16, 21, 24, 27]，期望收口行 = [19, 28, 31]。
 *   A(4)  跨行 void 调 async / B(7) 跨行直接调 async —— v1 漏报（缺陷②）
 *   C(10) 同行箭头体 / D(12) 传 async 引用 —— v1 就能抓，防回归
 *   E(13) 行注释 / F(14) 块注释 / G(17) 字符串 —— v1 误报（缺陷①），均不得命中
 *   H(15/16) 回调体里再开**裸** setTimeout：括号配对不得被内层截断，两层都是真风险
 *   I(21)/J(24)/K(27) setTimeout 的 void 体 / async 体 / 直传 async 引用 —— v2 全漏（v3 新增）
 *   L(18/19) 外层 setInterval 体内**只调已收口的 safeInterval** → 外层不得命中（否则就是
 *      把别人的安全当成自己的罪），内层记 guarded——旧的「行窗口」判据看不对这种嵌套
 *   M(29) sleep 助手（体为 `r`，无 async/void）/ N(30) 纯同步体 —— 均不得命中
 *   O(32) 一次性延时但体内当场 `.catch(` —— 不命中（一次性与轮询的不对称口径，理由见正文）
 *   P(33) `function safeInterval(` 声明 —— 不得记为收口点（否则既吹胖计数又抹掉本文件扫描面）
 */
const FIXTURE = [
  'async function pollOnce(): Promise<void> {', // 1
  '  await Promise.resolve();', // 2
  '}', // 3
  'export const a = setInterval(() => {', // 4  ← 命中
  '  void pollOnce();', // 5
  '}, 1000);', // 6
  'export const b = setInterval(() => {', // 7  ← 命中
  '  pollOnce();', // 8
  '}, 1000);', // 9
  'export const c = setInterval(() => pollOnce(), 1000);', // 10 ← 命中
  'async function tick(): Promise<void> {}', // 11
  'export const d = setInterval(tick, 1000);', // 12 ← 命中
  '// setInterval(() => pollOnce(), 1000) 行注释不得命中', // 13
  '/* setInterval(() => pollOnce(), 1000) 块注释不得命中 */', // 14
  'export const nested = setInterval(() => {', // 15 只记一次（16 行的内层 setTimeout 也算点）
  '  setTimeout(() => pollOnce(), 10);', // 16 ← 命中（内层箭头体调 async）
  "const s = 'setInterval(() => pollOnce(), 1000)';", // 17
  'export const reentrant = setInterval(() => {', // 18
  '  safeInterval("inner", () => { void pollOnce(); }, 50);', // 19
  '}, 1000);', // 20
  'export const f = setTimeout(() => {', // 21
  '  void pollOnce();', // 22
  '}, 1200);', // 23   ← 命中（行号 21：setTimeout 所在行）
  'export const g = setTimeout(async () => {', // 24  ← 命中
  '  await pollOnce();', // 25
  '}, 1200);', // 26
  'const h = setTimeout(tick, 1200);', // 27 ← 命中
  'export const i = safeTimeout("y", () => { void pollOnce(); }, 1200);', // 28 已收口
  'const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));', // 29 不命中
  'setTimeout(() => setVisible(false), 300);', // 30 纯同步不命中
  'export const j = safeInterval("x", () => { void pollOnce(); }, 1000);', // 31 已收口
  'setTimeout(() => { tick().catch(() => {}); }, 1200);', // 32 一次性且当场接住 rejection → 不命中
  'function safeInterval(name: string, tick: () => unknown, ms: number): () => void {', // 33 声明不得记为收口点
  '  return null as unknown as () => void;', // 34
  '}', // 35
].join('\n');

const EXPECTED_UNGUARDED = [4, 7, 10, 12, 15, 16, 21, 24, 27];
const EXPECTED_GUARDED = [19, 28, 31];

function runSelftest() {
  const hits = collectFindings('<selftest>', FIXTURE);
  const got = hits
    .filter(h => !h.guarded)
    .map(h => h.line)
    .sort((x, y) => x - y);
  const guarded = hits
    .filter(h => h.guarded)
    .map(h => h.line)
    .sort((x, y) => x - y);
  const ok =
    got.length === EXPECTED_UNGUARDED.length &&
    EXPECTED_UNGUARDED.every((n, i) => got[i] === n) &&
    guarded.length === EXPECTED_GUARDED.length &&
    EXPECTED_GUARDED.every((n, i) => guarded[i] === n);
  return {
    ok,
    got: got.join(',') || '(无)',
    want: EXPECTED_UNGUARDED.join(','),
    guarded: guarded.join(',') || '(无)',
    wantGuarded: EXPECTED_GUARDED.join(','),
  };
}

function main() {
  const verbose = process.argv.includes('--verbose');

  const st = runSelftest();
  if (!st.ok) {
    console.log(
      'AUDIT_ASYNC_TIMERS SELFTEST FAIL 逃逸命中=' +
        st.got +
        ' 期望=' +
        st.want,
    );
    console.log('  收口命中=' + st.guarded + ' 期望=' + st.wantGuarded);
    console.log(
      '闸门判据本身与预期不符（漏报或误报）——本轮绿色输出不可信，先修判据。',
    );
    process.exit(1);
  }
  console.log(
    'selftest OK（' +
      EXPECTED_UNGUARDED.length +
      ' 逃逸形状全命中，' +
      EXPECTED_GUARDED.length +
      ' 收口形状 + 注释/字符串/纯同步零误报）',
  );

  const findings = [];
  walk(SRC, []).forEach(file => {
    const rel = path.relative(ROOT, file).split(path.sep).join('/');
    findings.push(...collectFindings(rel, fs.readFileSync(file, 'utf8')));
  });

  const risky = findings.filter(f => !f.guarded);
  const safe = findings.filter(f => f.guarded);

  console.log(
    '异步定时器 ' +
      (risky.length + safe.length) +
      ' 处：未收口 ' +
      risky.length +
      '，已走收口原语 ' +
      safe.length,
  );
  if (risky.length) {
    console.log(
      '\n未收口（异常会逃逸成 unhandled rejection，须迁 safeInterval / safeTimeout）：',
    );
    risky.forEach(f =>
      console.log(
        '  ' + f.file + ':' + f.line + '  [' + f.kind + ']  ' + f.code,
      ),
    );
  }
  if (verbose && safe.length) {
    console.log('\n已走收口原语（收口 + 统一上报）：');
    safe.forEach(f =>
      console.log(
        '  ' + f.file + ':' + f.line + '  [' + f.kind + ']  ' + f.code,
      ),
    );
  }
  console.log('AUDIT_ASYNC_TIMERS risky=' + risky.length);
  process.exit(risky.length ? 1 : 0);
}

module.exports = {collectFindings, maskNonCode, runSelftest};

if (require.main === module) {
  main();
}
