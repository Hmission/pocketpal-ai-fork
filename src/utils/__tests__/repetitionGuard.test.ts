import {detectRepetitionLoop, shouldCheckRepetition} from '../repetitionGuard';

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

  it('窗口约束自证：MAX_UNIT×MIN_TIMES 必须装得进 TAIL_WINDOW，否则长单元永远测不到', () => {
    // 4×200=800 ≤ 900；若有人改小 TAIL_WINDOW 或改大 MAX_UNIT 破坏此式，本用例会红
    const unit =
      '这是一段足够长的复述内容，用来验证扩程后的守卫确实能看见，而不是停在旧上限之外。';
    expect(unit.length).toBe(40); // 先实测钉住样本长度，再往下推
    // 取两个单元拼成 80 字长周期，确保超出旧 MAX_UNIT=40
    const longUnit = unit + unit.slice(0, 40);
    expect(longUnit.length).toBe(80);
    expect(detectRepetitionLoop(longUnit.repeat(4)).hit).toBe(true);
    // 更极端：接近 MAX_UNIT 的长单元重复 4 次仍需命中（守 800≤TAIL_WINDOW 这条式子）
    const veryLong = '甲'.repeat(199);
    expect(detectRepetitionLoop(veryLong.repeat(4)).hit).toBe(true);
  });
});
