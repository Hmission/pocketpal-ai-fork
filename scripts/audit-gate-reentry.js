#!/usr/bin/env node
/**
 * 就绪门禁重入审计（项 42 / CHAIN_AUDIT_20260908_C §六 P0-2，§168 死锁的根治闸）
 *
 * 抓的形态：构造即发起的「水合链」在闭包内 await 了自身的就绪门禁——
 * `this.readyPromise = this.ensureReadyImpl()` 发起的那次执行**尚未 settle**，链上
 * 任何一跳出现 `await this.readyPromise`（直接或经 ensureReady() 等包装中转）就是
 * 等自己把自己解套 → 永久自锁（§168 实例：水合内 `await this.init()`，正门
 * applyTaskPatch 躲开了、侧门 init() 又撞回去；真机表现为整条写路径无声挂起）。
 *
 * 判据（项 42 验收原文）：从 `this.readyPromise = this.<root>()` 出发，沿 `this.X(`
 * 做方法体闭包展开（**花括号配平取精确方法体**，形制同 audit-async-timers.js 的
 * bodyFrom()），闭包内任何方法是门禁等待者即 violation → exit 1。
 *
 * 口径说明：
 * - 先剥注释再分析（保持行列）——imageGenStore 的 docblock 大量引用
 *   「await this.ensureReady()」字样作反面教材，不剥必假阳（原型 §170 的区域启发式
 *   正是这样把 pullSnapshot 误列成等待者的，本闸以配平取体根治）；
 * - 等待者做闭包迭代：A 等 readyPromise，B `await this.A()`，则 B 也是等待者。
 * - 局限（与同族闸同级）：正则级口径，不解析 AST；箭头函数属性方法
 *   （`foo = async () => {}`）不参与展开——本仓水合链均为 class 方法。
 *
 * 用法：node scripts/audit-gate-reentry.js
 * 退出码：存在自锁风险点则 1（便于接门禁）。
 * 两态自证（AGENTS.md 验证纪律：新闸必须拿探针证明它能报错）：
 *   red   —— 在 adoptFinishedTasks 临时塞 `await this.init()` → 本闸 exit 1；
 *   green —— 当前 HEAD → violations=0，exit 0。
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'src');

const GATE_FIELD = 'readyPromise';
// 门禁字段的直接 await = 等待者种子（ensureReady 体内就是它；包装者由迭代收网）
const DIRECT_AWAIT = new RegExp('await\\s+this\\.' + GATE_FIELD + '\\b');

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

/** 剥掉注释内容但保持行列不变（docblock 里的示例代码不得参与判定） */
function blankComments(src) {
  const out = src.split('');
  let state = 'code';
  let quote = '';
  let i = 0;
  while (i < out.length) {
    const ch = out[i];
    const next = out[i + 1];
    if (state === 'code') {
      if (ch === '/' && next === '/') {
        state = 'line';
        out[i] = ' ';
        out[i + 1] = ' ';
        i += 2;
      } else if (ch === '/' && next === '*') {
        state = 'block';
        out[i] = ' ';
        out[i + 1] = ' ';
        i += 2;
      } else if (ch === "'" || ch === '"' || ch === '`') {
        state = 'string';
        quote = ch;
        i++;
      } else {
        i++;
      }
    } else if (state === 'line') {
      if (ch === '\n') state = 'code';
      else out[i] = ' ';
      i++;
    } else if (state === 'block') {
      if (ch === '*' && next === '/') {
        out[i] = ' ';
        out[i + 1] = ' ';
        state = 'code';
        i += 2;
      } else {
        if (ch !== '\n') out[i] = ' ';
        i++;
      }
    } else if (ch === '\\') {
      i += 2;
    } else {
      if (ch === quote) {
        state = 'code';
        quote = '';
      }
      i++;
    }
  }
  return out.join('');
}

const RESERVED = new Set([
  'if',
  'for',
  'while',
  'switch',
  'catch',
  'return',
  'await',
  'function',
  'new',
  'else',
  'do',
  'try',
]);

/** 从 openIdx（指向 '{'）起做花括号配平，返回 {body, startLine, endIdx} */
function balanceBody(code, openIdx) {
  let depth = 0;
  for (let i = openIdx; i < code.length; i++) {
    const ch = code[i];
    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) {
        return {
          body: code.slice(openIdx + 1, i),
          startLine: code.slice(0, openIdx).split('\n').length,
          endIdx: i,
        };
      }
    }
  }
  return null;
}

/** 收集 class 方法定义（签名允许 prettier 多行折行；按出现序，同名首个生效） */
function collectMethods(code) {
  const defRe =
    /^ {2}(?:(?:private|public|protected|readonly|static|override|abstract) )*(?:async )?([A-Za-z_]\w*)[^\S\n]*\([^)]*\)[^{]*\{/gm;
  const defs = [];
  let m;
  while ((m = defRe.exec(code))) {
    const name = m[1];
    if (RESERVED.has(name)) continue;
    const openIdx = m.index + m[0].length - 1;
    const bal = balanceBody(code, openIdx);
    if (bal) defs.push({name, ...bal});
  }
  return defs;
}

const findings = [];

walk(SRC, []).forEach(file => {
  const raw = fs.readFileSync(file, 'utf8');
  if (raw.indexOf(GATE_FIELD) < 0) {
    return; // 无门禁字段 = 与本闸无关
  }
  const rel = path.relative(ROOT, file).split(path.sep).join('/');
  const code = blankComments(raw);
  const defs = collectMethods(code);
  const byName = new Map();
  defs.forEach(d => {
    if (!byName.has(d.name)) byName.set(d.name, d);
  });

  // 等待者闭包迭代：直接 await 门禁字段者入网；await「等待者 this 调用」者并入
  const waiters = new Set();
  defs.forEach(d => {
    if (DIRECT_AWAIT.test(d.body)) waiters.add(d.name);
  });
  let grew = true;
  while (grew) {
    grew = false;
    defs.forEach(d => {
      if (waiters.has(d.name)) return;
      for (const w of waiters) {
        if (new RegExp('await\\s+this\\.' + w + '\\s*\\(').test(d.body)) {
          waiters.add(d.name);
          grew = true;
          return;
        }
      }
    });
  }

  // 就绪链根：this.readyPromise = this.<impl>(  （构造即发起才有自锁形态；
  // 懒初始化 `= prepareSharedStorage().then(...)` 不在此列，形制对齐项 42 原文）
  const rootRe = new RegExp(
    'this\\.' + GATE_FIELD + '\\s*=\\s*this\\.([A-Za-z_]\\w*)\\s*\\(',
    'g',
  );
  const roots = [];
  let rm;
  while ((rm = rootRe.exec(code))) roots.push(rm[1]);
  if (!roots.length) return;

  roots.forEach(root => {
    const seen = new Set();
    const queue = [root];
    const order = [];
    const hits = [];
    while (queue.length) {
      const cur = queue.shift();
      if (seen.has(cur)) continue;
      seen.add(cur);
      const def = byName.get(cur);
      if (!def) continue;
      order.push(cur + '@' + def.startLine);
      if (waiters.has(cur)) hits.push(def);
      const callRe = /this\.([A-Za-z_]\w*)\s*\(/g;
      let cm;
      while ((cm = callRe.exec(def.body))) {
        if (!seen.has(cm[1])) queue.push(cm[1]);
      }
    }
    if (hits.length) {
      findings.push({
        file: rel,
        kind: 'self-lock',
        detail:
          '水合链 ' +
          root +
          '() 闭包 [' +
          order.join(' → ') +
          '] 内出现门禁等待者：' +
          hits.map(h => h.name + '()@L' + h.startLine).join('、') +
          '（链上 await 自身门禁 = 永久自锁；收口走无门禁原语如 applyTaskPatch）',
      });
    }
  });
});

console.log(
  '就绪门禁重入审计：' +
    (findings.length === 0
      ? '水合闭包无自锁（violations=0）'
      : '发现 ' + findings.length + ' 处自锁风险'),
);
findings.forEach(f =>
  console.log('  ❌ ' + f.file + '  [' + f.kind + ']  ' + f.detail),
);
console.log('AUDIT_GATE_REENTRY violations=' + findings.length);
process.exit(findings.length ? 1 : 0);
