#!/usr/bin/env node
/**
 * DRC 动作登记面 / 执行面对账闸（docs/DebugRemoteControl/DRC_SPEC.md §10）
 *
 * 抓的账目偏差（本窗实测撞到两类）：
 *   ① 代码注册了动作但 §5 表未登记（BT05 违规：未登记即不得被测试脚本消费）；
 *   ② §5 表登记了但代码已无此动作（死登记，下游照表发命令必然「动作不存在」）；
 *   ③ 表头「当前注册数：N 个」与实际行数/代码数不符（只手改表不改数——本窗我自己
 *      就写错过一次：加了 memory.list 变 27 行，计数仍留 26）。
 *
 * 出口单行：AUDIT_DRC_ACTIONS doc=N code=M missing=[…] stale=[…] countLine=K
 * 红时行为：**非零退出阻断提交**。不兼容「警告后放行」——警告等于没有。
 *
 * 用法：node scripts/audit-drc-actions.js
 * 自测：jest scripts/__tests__/auditDrcActions.test.js（脏态必须红、净态必须绿）
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const CODE_FILE = path.join(ROOT, 'src/debug/actionRegistry.ts');
const DOC_FILE = path.join(ROOT, 'docs/DebugRemoteControl/DRC_SPEC.md');

/**
 * 代码侧：actionRegistry 顶层动作 key，形如
 *   'system.ping': {
 * 只认「两空格缩进 + 引号内 domain.verb + ': {'」——它同时排除了对象内部的
 * `id: m.id` / `id: 'system.ping'` 这类字段行（同一 id 数两遍会双计）。
 */
function extractCodeActionIds(tsText) {
  const re = /^ {2}'([a-z][\w]*\.[A-Za-z][\w]*)':\s*\{/gm;
  const ids = [];
  let m;
  while ((m = re.exec(tsText))) ids.push(m[1]);
  return [...new Set(ids)];
}

/** 文档侧：只取 §5 那一节的表格首列，避免把其它章节的表当动作清单。 */
function extractDocActionIds(mdText) {
  const lines = mdText.split('\n');
  const start = lines.findIndex(l => /^##\s+5[.\s]/.test(l));
  if (start < 0) {
    throw new Error(
      'DRC_SPEC 未找到 §5 标题，登记表无法解析（判红，不静默放行）',
    );
  }
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) {
    if (/^##\s/.test(lines[i])) {
      end = i;
      break;
    }
  }
  const ids = [];
  for (let i = start; i < end; i++) {
    const m = lines[i].match(/^\|\s*([a-z][\w]*\.[A-Za-z][\w]*)\s*\|/);
    if (m) ids.push(m[1]);
  }
  return [...new Set(ids)];
}

/** 表头声明的注册数（缺行或不匹配由调用方判红）。 */
function extractDocCount(mdText) {
  const m = mdText.match(/当前注册数[：:]\s*(\d+)\s*个/);
  return m ? Number(m[1]) : null;
}

function diff(a, b) {
  return a.filter(x => !b.includes(x));
}

/**
 * 纯函数：给定两侧文本给出结论（可被单测直接喂脏态）。
 */
function audit(codeText, docText) {
  const code = extractCodeActionIds(codeText);
  const doc = extractDocActionIds(docText);
  const countLine = extractDocCount(docText);
  const missing = diff(code, doc).sort(); // 代码有、表里没有
  const stale = diff(doc, code).sort(); // 表里有、代码已无
  const ok =
    missing.length === 0 &&
    stale.length === 0 &&
    countLine !== null &&
    countLine === code.length &&
    code.length === doc.length;
  return {code, doc, missing, stale, countLine, ok};
}

function main() {
  const res = audit(
    fs.readFileSync(CODE_FILE, 'utf8'),
    fs.readFileSync(DOC_FILE, 'utf8'),
  );
  console.log(
    'AUDIT_DRC_ACTIONS doc=' +
      res.doc.length +
      ' code=' +
      res.code.length +
      ' missing=[' +
      res.missing.join(',') +
      '] stale=[' +
      res.stale.join(',') +
      '] countLine=' +
      res.countLine,
  );
  if (res.missing.length) {
    console.log(
      '\n未登记（BT05：先写进 DRC_SPEC §5 再消费；测试脚本不得依赖未登记动作）：',
    );
    res.missing.forEach(id => console.log('  + ' + id));
  }
  if (res.stale.length) {
    console.log('\n死登记（表里有但代码已无，下游按表发命令必失败）：');
    res.stale.forEach(id => console.log('  - ' + id));
  }
  if (res.countLine === null) {
    console.log('\n计数行缺失：§5 需保留「当前注册数：N 个」一行供对账。');
  } else if (res.countLine !== res.code.length) {
    console.log(
      '\n计数失真：表头写 ' +
        res.countLine +
        ' 个，代码实际 ' +
        res.code.length +
        ' 个（本数由闸门校验，不得手工改数不改表）。',
    );
  }
  if (!res.ok) {
    console.log('\n修复：对齐 §5 表行与计数行（或删除代码侧动作），再重跑。');
    process.exit(1);
  }
  console.log('OK（登记面与执行面一致）');
}

module.exports = {
  audit,
  extractCodeActionIds,
  extractDocActionIds,
  extractDocCount,
};

if (require.main === module) {
  main();
}
