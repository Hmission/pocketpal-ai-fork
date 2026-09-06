#!/usr/bin/env node
/**
 * 异步定时器审查（§155 复发闸门）
 *
 * 抓的形态：setInterval 回调最终会执行 async 函数，而该函数**没有 try 收口**。
 * 这类点抛出的异常会逃逸成 unhandled rejection——不崩在原地，而被 jest / 运行时
 * 归给「当时正在跑」的上下文，表现成「每次报错位置都不同」的假 flake（§154 就是
 * 被这种形态误导了两轮）。
 *
 * ⚠ 本审查的核心规则（用一次事故换来的）：
 *   **只有 `try {` 才算收口；仅挂 `.catch(...)` 不算。**
 *   因为 `foo().catch(h)` 只能接住 foo 返回的 promise 的 rejection；当 `foo` 这个
 *   属性根本不存在时，抛出发生在**取 .catch 之前**，是同步 TypeError，catch 链碰不到。
 *   （实例：imageGenStore.pullSnapshot 里 `getPerfSnapshot().catch(() => null)`，
 *   全局 mock 缺该方法时它照样逃逸。）
 *
 * 用法：node scripts/audit-async-timers.js
 * 退出码：存在未收口点则 1（便于接门禁）。
 * 约定：异步轮询一律走 src/utils/safeInterval.ts，由它统一收口 + 防重入。
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

/** 从某行起做花括号配平，取函数体文本（含签名行） */
function bodyFrom(lines, startIdx) {
  let depth = 0;
  let begun = false;
  const buf = [];
  const end = Math.min(lines.length, startIdx + 120);
  for (let i = startIdx; i < end; i++) {
    const l = lines[i];
    buf.push(l);
    for (const ch of l) {
      if (ch === '{') {
        depth++;
        begun = true;
      } else if (ch === '}') depth--;
    }
    if (begun && depth <= 0) break;
  }
  return buf.join('\n');
}

/** 找名为 name 的函数定义行号（class method / const = async / function） */
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

const findings = [];

walk(SRC, []).forEach(file => {
  const lines = fs.readFileSync(file, 'utf8').split('\n');
  const rel = path.relative(ROOT, file).split(path.sep).join('/');

  lines.forEach((line, idx) => {
    const at = line.indexOf('setInterval(');
    if (at < 0) return;
    const after = line.slice(at + 'setInterval('.length);

    // 已走收口原语 = 安全（本审查的唯一口径）
    if (line.indexOf('safeInterval(') >= 0) {
      findings.push({
        file: rel,
        line: idx + 1,
        kind: 'via-safeInterval',
        guarded: true,
        code: line.trim().slice(0, 72),
      });
      return;
    }

    let kind = '';
    let body = '';

    if (/^\s*async\b/.test(after)) {
      // setInterval(async () => { ... })：体就在调用点
      kind = 'inline-async';
      body = bodyFrom(lines.slice(idx), 0);
    } else {
      // setInterval(() => this.foo(), ms) 或 setInterval(fn, ms)
      const inlineCall = after.match(
        /^\s*(?:\([^)]*\)|[A-Za-z_$][\w$]*)\s*=>\s*[\s\S]*?([A-Za-z_$][\w$]*)\s*\(/,
      );
      const namedDirect = after.match(/^\s*([A-Za-z_$][\w$]*)\s*[,)]/);
      const target = inlineCall
        ? inlineCall[1]
        : namedDirect
          ? namedDirect[1]
          : null;
      if (!target) return;
      const dl = defLineOf(lines, target);
      if (dl < 0) return; // 非 async 定义：视为同步回调，无逃逸风险
      kind = inlineCall ? 'arrow-calls-' + target : 'named:' + target;
      body = bodyFrom(lines, dl);
    }

    // 口径：没走 safeInterval 的异步轮询一律算未收口。
    // 故意不去猜「体内有没有 try」——行级检测无法证明危险那行被包住
    // （§154 真凶 pullSnapshot 体内就有 try，但 L361 那行在其范围外，照样逃逸）。
    const guarded = false;
    void body;
    findings.push({
      file: rel,
      line: idx + 1,
      kind,
      guarded,
      code: line.trim().slice(0, 72),
    });
  });
});

const risky = findings.filter(f => !f.guarded);
const safe = findings.filter(f => f.guarded);

console.log(
  '异步定时器 ' +
    findings.length +
    ' 处：未收口 ' +
    risky.length +
    '，已 try 收口 ' +
    safe.length,
);
if (risky.length) {
  console.log(
    '\n未收口（异常会逃逸成 unhandled rejection，须迁 safeInterval 或补 try）：',
  );
  risky.forEach(f =>
    console.log('  ' + f.file + ':' + f.line + '  [' + f.kind + ']  ' + f.code),
  );
}
if (safe.length) {
  console.log(
    '\n已 try 收口（建议统一迁 safeInterval，另得防重入与统一上报）：',
  );
  safe.forEach(f =>
    console.log('  ' + f.file + ':' + f.line + '  [' + f.kind + ']  ' + f.code),
  );
}
console.log('AUDIT_ASYNC_TIMERS risky=' + risky.length);
process.exit(risky.length ? 1 : 0);
