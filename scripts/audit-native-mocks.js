#!/usr/bin/env node
/**
 * 原生契约替身覆盖度审查（POCKETPAL_TEST_INFRA_SPEC 律 3，复发闸门）
 *
 * 治的病：给 TurboModule spec 加了方法，却忘了同步 jest 全局替身。
 * 后果不是「测试立刻红」，而是替身缺方法 → 消费方 `foo.bar().catch(...)` 抛**同步
 * TypeError**（.catch 接不到）→ 逃逸成 unhandled rejection → 被 jest 归给随机在跑的
 * 套件，伪装成「每次位置都不同的超时型 flake」。本仓 §154 就是被它骗了两轮，
 * 真凶正是 NativeHardwareInfo.getPerfSnapshot 从未进 mock。
 *
 * 口径：契约侧 = src/specs/*.ts 的 `interface Spec` 方法全集；
 *       实现侧 = jest/setup.ts 里对应 jest.mock 的 default 对象第一层键。
 *       只对「已经做了全局替身」的 spec 强校（没替身的另行登记，不混为一谈）。
 *
 * 用法：node scripts/audit-native-mocks.js      缺方法即 exit 1
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SETUP = path.join(ROOT, 'jest', 'setup.ts');
const SPECS_DIR = path.join(ROOT, 'src', 'specs');

const IDENT = /[A-Za-z_$]/;
const WORD = /[A-Za-z0-9_$]/;

/** 取 spec 文件里 Spec 接口声明的方法名（两空格缩进的 `name(` / `name?(` 行） */
function specMethods(text) {
  const at = text.indexOf('interface Spec');
  if (at < 0) return [];
  const names = [];
  text
    .slice(at, at + 4000)
    .split('\n')
    .forEach(line => {
      if (!/^ {2}\S/.test(line)) return;
      // 可选方法 `getChipset?(): Promise<string>;` 也要收——探针实验发现漏 `?` 会少认一个方法
      const m = line.match(/^ {2}([A-Za-z_$][A-Za-z0-9_$]*)\??\s*\(/);
      if (m) names.push(m[1]);
    });
  return names;
}

/** 取 jest.mock(mockPath) 块内 default 对象第一层的键集合 */
function mockKeysFor(setupText, mockPath) {
  const at = setupText.indexOf("jest.mock('" + mockPath + "'");
  if (at < 0) return null;
  const defAt = setupText.indexOf('default:', at);
  if (defAt < 0 || defAt - at > 4000) return [];
  let i = setupText.indexOf('{', defAt);
  if (i < 0) return [];

  let depth = 0;
  const keys = [];
  const end = setupText.length;
  for (; i < end; i++) {
    const ch = setupText[i];
    if (ch === '{') {
      depth++;
      continue;
    }
    if (ch === '}') {
      depth--;
      if (depth === 0) break; // default 对象结束
      continue;
    }
    if (depth !== 1 || !IDENT.test(ch)) continue;
    let j = i;
    while (j < end && WORD.test(setupText[j])) j++;
    const word = setupText.slice(i, j);
    // 后一个非空白字符是冒号 → 这是 key
    let k = j;
    while (k < end && /\s/.test(setupText[k])) k++;
    if (setupText[k] === ':' && keys.indexOf(word) < 0) keys.push(word);
    i = j - 1;
  }
  return keys;
}

const setupText = fs.readFileSync(SETUP, 'utf8');
const specFiles = fs
  .readdirSync(SPECS_DIR)
  .filter(n => n.endsWith('.ts') && !n.endsWith('.d.ts'));

let missing = 0;
let checked = 0;

specFiles.forEach(name => {
  const base = name.slice(0, -3);
  const methods = specMethods(
    fs.readFileSync(path.join(SPECS_DIR, name), 'utf8'),
  );
  if (!methods.length) return;

  const provided = mockKeysFor(setupText, '../src/specs/' + base);
  if (provided === null) {
    console.log(
      'SKIP  ' +
        base +
        '：spec 有 ' +
        methods.length +
        ' 个方法，jest/setup.ts 未做全局替身',
    );
    return;
  }
  checked++;
  const gaps = methods.filter(m => provided.indexOf(m) < 0);
  if (gaps.length) {
    missing += gaps.length;
    console.log(
      'MISS  ' + base + '：替身缺 ' + gaps.length + ' 个 -> ' + gaps.join(', '),
    );
  } else {
    console.log(
      'OK    ' + base + '：spec ' + methods.length + ' 个方法，替身全覆盖',
    );
  }
});

console.log('AUDIT_NATIVE_MOCKS specs=' + checked + ' missing=' + missing);
if (missing) {
  console.log(
    '补齐位置：jest/setup.ts 对应 jest.mock 的 default 对象；' +
      '取值口径见 docs/POCKETPAL_TEST_INFRA_SPEC.md 第 4.2 节（N/A 用真机同口径，禁编造）。',
  );
}
process.exit(missing ? 1 : 0);
