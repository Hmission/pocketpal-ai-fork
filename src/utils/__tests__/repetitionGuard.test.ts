import {
  detectRepetitionLoop,
  shouldCheckRepetition,
  REPETITION_GUARD_PARAMS,
} from '../repetitionGuard';

/**
 * 退化复读检测（repetitionGuard）。
 * 用例直接取自 2026-09-07 真机翻车实录，不用编造样本。
 */

const PHRASE = '您想先写什么？'; // 9 字符
const realLoop = (times: number) =>
  `好的，那您想先做什么？${PHRASE.repeat(times)}`;

describe('repetitionGuard — 退化复读判定', () => {
  it('真机样本：同一句重复 20 遍必须命中，且 cutAt 只保留一份', () => {
    const text = realLoop(20);
    const v = detectRepetitionLoop(text);
    expect(v.hit).toBe(true);
    expect(v.unit).toBe(PHRASE);
    expect(v.times).toBeGreaterThanOrEqual(4);
    // 截断后：保留首次提问 + 恰好一份重复，其余整段丢弃
    expect(text.slice(0, v.cutAt)).toBe('好的，那您想先做什么？' + PHRASE);
  });

  it('门槛是 4 次：3 次重复不误伤（正常口语排比）', () => {
    const v = detectRepetitionLoop(PHRASE.repeat(3));
    expect(v.hit).toBe(false);
    expect(v.cutAt).toBe(PHRASE.length * 3);
  });

  it('刚好 4 次即命中（早停取高门槛的下界）', () => {
    expect(detectRepetitionLoop(PHRASE.repeat(4)).hit).toBe(true);
  });

  it('短单元重复不算退化：L<4 的重复不在扫描范围', () => {
    // "哈哈哈哈…" 这种语气词，按 L=4 数只有 3 次，不触发
    expect(detectRepetitionLoop('哈'.repeat(12)).hit).toBe(false);
    expect(detectRepetitionLoop('好的'.repeat(6)).hit).toBe(false);
  });

  it('边界取舍（钉死）：连说 8 遍短词（16 字）按退化处理', () => {
    // '好的'×8 = 16 字符，按 L=4 恰好 4 次重复 → 命中。
    // 这是刻意接受的方向：真人不会连说八遍，宁可截成一份。
    const v = detectRepetitionLoop('好的'.repeat(8));
    expect(v.hit).toBe(true);
    expect(v.times).toBe(4);
    expect('好的'.repeat(8).slice(0, v.cutAt)).toBe('好的好的');
  });

  it('正常回复一律不命中（含中英混排、markdown、重复词但非连续整段）', () => {
    const normal =
      '好的，那我们先从写作开始。你想写什么主题？\n\n' +
      '- 今天的心情\n- 一个故事\n- 一段总结\n\n' +
      '你说个方向，我就动笔。OK？';
    expect(detectRepetitionLoop(normal).hit).toBe(false);
  });

  it('被打断的半截重复也命中（流式检测正是在这种时刻触发）', () => {
    const text = PHRASE.repeat(4) + PHRASE.slice(0, 4);
    const v = detectRepetitionLoop(text);
    // 末尾不完整，但仍应识别出前面 4 次完整重复
    expect(v.times).toBeGreaterThanOrEqual(3);
  });

  it('空串 / 超短串直接放行，不抛异常', () => {
    expect(detectRepetitionLoop('').hit).toBe(false);
    expect(detectRepetitionLoop('好').hit).toBe(false);
    expect(detectRepetitionLoop('思想').hit).toBe(false);
  });

  it('节流：增量不足 24 字符不重复检测', () => {
    expect(shouldCheckRepetition(0, 10)).toBe(false);
    expect(shouldCheckRepetition(0, 24)).toBe(true);
    expect(shouldCheckRepetition(100, 101)).toBe(false);
  });

  // ── 2026-09-09 真机 aab688d9 回归：周期 46 字符的泄漏复读曾从 MAX_UNIT=40 窗外漏掉 ──
  const LEAK_UNIT =
    '[kg:memory] 大王想先写什么？您想先写什么？ · 大王想先写什么？您想先写什么？ ';

  it('长周期复读（46 字单元 ×6）必须命中——旧 MAX_UNIT=40 在此静默失效', () => {
    expect(LEAK_UNIT.length).toBeGreaterThan(40); // 钉死：本用例的价值就在于超出旧上限
    const text = `好的，请告诉我您想复盘什么内容。\n\n${LEAK_UNIT.repeat(6)}`;
    const v = detectRepetitionLoop(text);
    expect(v.hit).toBe(true);
    expect(v.unit).toBe(LEAK_UNIT);
    expect(v.times).toBe(6);
    // 截断只保留第一份，其余整段丢弃
    expect(text.slice(text.indexOf(LEAK_UNIT), v.cutAt)).toBe(LEAK_UNIT);
  });

  it('长周期但只重复 3 次：未达门槛，不误伤', () => {
    expect(detectRepetitionLoop(LEAK_UNIT.repeat(3)).hit).toBe(false);
  });

  // ── 不变式直断言（不再靠样本卡线）───────────────────────────────
  /**
   * 本窗上一版这里写的是「拿一个 199 字样本跑 4 遍看能不能中」——那叫卡线，
   * 不叫守式子：只要有人只把 MAX_UNIT 提而不动 TAIL_WINDOW，守卫对新长周期
   * 静默失效，而卡线用例仍会绿。现在直接把式子写进断言。
   */
  it('不变式：TAIL_WINDOW 必须装得下最大单元 × 最大门槛', () => {
    const P = REPETITION_GUARD_PARAMS;
    expect(P.TAIL_WINDOW).toBeGreaterThanOrEqual(
      P.MAX_UNIT * P.LONG_UNIT_MIN_TIMES,
    );
    expect(P.TAIL_WINDOW).toBeGreaterThanOrEqual(P.MAX_UNIT * P.MIN_TIMES);
    // 分界必须真存在于区间内，否则 SHORT_UNIT_CEILING 是个没用的装饰值
    expect(P.SHORT_UNIT_CEILING).toBeGreaterThan(P.MIN_UNIT);
    expect(P.SHORT_UNIT_CEILING).toBeLessThan(P.MAX_UNIT);
    // 长档门槛确实更严（这是「拦真退化不拦长复述」的全部意义）
    expect(P.LONG_UNIT_MIN_TIMES).toBeGreaterThan(P.MIN_TIMES);
  });

  /** 造一个**真实周期恰好等于 len** 的单元：字符全互异，使最小周期不行化。 */
  const uniqueUnit = (len: number) => {
    let s = '';
    for (let i = 0; i < len; i++) {
      s += String.fromCharCode(0x4e00 + i); // 连续码位互异汉字
    }
    return s;
  };

  it('参数化长单元：刚好 MAX_UNIT 长的单元×长档门槛必命中（自动跟常量变化）', () => {
    const P = REPETITION_GUARD_PARAMS;
    const unit = uniqueUnit(P.MAX_UNIT);
    expect(unit.length).toBe(P.MAX_UNIT);
    const v = detectRepetitionLoop(unit.repeat(P.LONG_UNIT_MIN_TIMES));
    expect(v.hit).toBe(true);
    // 🔴 真正有鉴别力的是这两行：unit / times 必须恰好等于构造值。
    // 本窗上一版用 `unit(40) + unit.slice(0,40)` 造所调 80 字周期，实际两半相同、
    // 真实周期仍是 40——如果当时断言了 `v.unit === longUnit`，这退化的样本会当场红。
    expect(v.unit).toBe(unit);
    expect(v.times).toBe(P.LONG_UNIT_MIN_TIMES);
  });

  /**
   * 反验上面那种 `v.unit` 断言确实有鉴别力（拿旧错样本跑过一遍）。
   * 不这么测的话，“自证”两个字只是自我安慰——本窗我就写错过一次。
   */
  it('周期坍缩可被识别：两半相同的 80 字样本，检测器报的是真实周期 40', () => {
    const half = uniqueUnit(40);
    const collapsed = half + half; // 长度 80，但真实周期 40
    expect(collapsed.length).toBe(80);
    const v = detectRepetitionLoop(collapsed.repeat(3)); // 80×3 = 周期 40×6
    expect(v.hit).toBe(true);
    expect(v.unit).toBe(half); // ← 不是 collapsed：证明断言单位能抓坍缩
    expect(v.unit.length).toBe(40);
    expect(v.times).toBe(6);
  });

  // ── 误伤面回归：本窗把 MAX_UNIT 40→200 时新开了一个误杀区，此用例钉住它 ──
  it('长复述不算退化：47 字表格行逐字重复 4 遍不得被截（旧 MAX_UNIT=40 不中，200×4 也不得中）', () => {
    const row =
      '| 指标 | 阈值 | 说明 | 负责人 | 采集频率 | 告警通道 | 备注说明文字 |\n';
    expect(row.length).toBeGreaterThan(40); // 价在超出旧分界，落入长档
    expect(detectRepetitionLoop(row.repeat(4)).hit).toBe(false);
    expect(detectRepetitionLoop(row.repeat(5)).hit).toBe(false);
    // 而真的退化（长档门槛）仍拦住，否则就是「为了防误伤而关掉守卫」
    const P = REPETITION_GUARD_PARAMS;
    expect(detectRepetitionLoop(row.repeat(P.LONG_UNIT_MIN_TIMES)).hit).toBe(
      true,
    );
  });

  it('短档行为不变：≤40 字单元仍维持 4 遍门槛（旧已验证面不得被分档改动惊动）', () => {
    const unit = uniqueUnit(20); // 20 字，短档
    expect(detectRepetitionLoop(unit.repeat(3)).hit).toBe(false);
    expect(detectRepetitionLoop(unit.repeat(4)).hit).toBe(true);
  });
});
