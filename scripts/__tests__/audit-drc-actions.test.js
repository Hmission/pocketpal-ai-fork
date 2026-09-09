/**
 * audit-drc-actions 闸门自检（AGENTS.md 纪律5：新闸门要拿探针自证它能报错）
 *
 * 为什么两类断言都要：
 *   - 只测「脏态判红」→ 一个永远返回红的坏闸门也能过（它会阻断所有提交，很快被人绕过）；
 *   - 只测「净态判绿」→ 一个什么都不检查的空转闸门必过，却给假安全感（本仓 CORE-11
 *     那批假绿正是这个形状）。
 * 所以：4 种脏态必须红 + 净态必须绿 + 真仓现状必须绿，三条齐全。
 */
const path = require('path');
const fs = require('fs');
const {
  audit,
  extractCodeActionIds,
  extractDocActionIds,
  extractDocCount,
} = require('../audit-drc-actions');

const CODE_CLEAN = [
  'const ACTIONS = {',
  "  'system.ping': {",
  "    id: 'system.ping',",
  '  },',
  "  'nav.go': {",
  "    id: 'nav.go',",
  '  },',
  '};',
].join('\n');

const docOf = (ids, count) =>
  [
    '## 5. 动作清单',
    '',
    '**当前注册数：' + count + ' 个**',
    '',
    '| actionId | 参数 | 说明 |',
    '| --- | --- | --- |',
    ...ids.map(id => '| ' + id + ' | - | x |'),
    '',
    '## 6. 门控',
  ].join('\n');

describe('audit-drc-actions 判据', () => {
  it('提取器口径：只取顶层动作 key，不双计内部 id 字段', () => {
    expect(extractCodeActionIds(CODE_CLEAN)).toEqual(['system.ping', 'nav.go']);
    expect(extractDocActionIds(docOf(['system.ping', 'nav.go'], 2))).toEqual([
      'system.ping',
      'nav.go',
    ]);
    expect(extractDocCount(docOf(['system.ping'], 2))).toBe(2);
    expect(extractDocCount('没有这行')).toBeNull();
  });

  it('净态判绿（同样的东西两边一致时不得报红）', () => {
    const res = audit(CODE_CLEAN, docOf(['system.ping', 'nav.go'], 2));
    expect(res.ok).toBe(true);
    expect(res.missing).toEqual([]);
    expect(res.stale).toEqual([]);
  });

  it('脏态①：代码新增动作未登记 → missing 判红', () => {
    const dirty = CODE_CLEAN.replace(
      '};',
      "  'memory.list': {\n    id: 'memory.list',\n  },\n};",
    );
    expect(extractCodeActionIds(dirty)).toHaveLength(3);
    const res = audit(dirty, docOf(['system.ping', 'nav.go'], 2));
    expect(res.ok).toBe(false);
    expect(res.missing).toEqual(['memory.list']);
  });

  it('脏态②：表里登记了但代码已删 → stale 判红（死登记）', () => {
    const res = audit(
      "const ACTIONS = {\n  'system.ping': {\n    id: 'system.ping',\n  },\n};",
      docOf(['system.ping', 'server.remove'], 2),
    );
    expect(res.ok).toBe(false);
    expect(res.stale).toEqual(['server.remove']);
  });

  it('脏态③：只手改表不改数 → 计数失真判红', () => {
    const res = audit(CODE_CLEAN, docOf(['system.ping', 'nav.go'], 26));
    expect(res.ok).toBe(false);
    expect(res.countLine).toBe(26);
    expect(res.missing).toEqual([]);
    expect(res.stale).toEqual([]);
    // 行与代码都对，只有计数错——仍必须红，否则「改数不改表」无人拦
    expect(res.code).toHaveLength(2);
    expect(res.doc).toHaveLength(2);
  });

  it('脏态④：§5 标题被改名 → 抛错判红（不得静默当作空表放行）', () => {
    const renamed = docOf(['system.ping', 'nav.go'], 2).replace(
      '## 5. 动作清单',
      '## 动作清单',
    );
    expect(() => audit(CODE_CLEAN, renamed)).toThrow(/未找到 §5/);
  });

  it('真仓现状必须绿（登记面 / 执行面 / 计数三者对齐）', () => {
    const root = path.join(__dirname, '..', '..');
    const res = audit(
      fs.readFileSync(path.join(root, 'src/debug/actionRegistry.ts'), 'utf8'),
      fs.readFileSync(
        path.join(root, 'docs/DebugRemoteControl/DRC_SPEC.md'),
        'utf8',
      ),
    );
    // 不把期望值写成从 res 里取出来的同一表达式（那只会断言自己）。
    expect(res.missing).toEqual([]);
    expect(res.stale).toEqual([]);
    expect(res.code.length).toBeGreaterThan(20);
    expect(res.doc.length).toBe(res.code.length);
    expect(res.countLine).toBe(res.code.length);
    expect(res.ok).toBe(true);
  });
});
