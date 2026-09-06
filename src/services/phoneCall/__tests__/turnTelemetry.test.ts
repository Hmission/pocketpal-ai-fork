import {PhoneTurnTelemetry} from '../turnTelemetry';

/**
 * 电话一轮分段遥测（PHONE_SPEC §19.2）。
 * 假时钟注入，钉死三段算式与「采不到就 n/a」的诚实性——
 * 这类观测代码最坏的错不是漏数，而是**把没采到的数编出来**。
 */

const makeClock = () => {
  let t = 1000;
  return {now: () => t, advance: (d: number) => (t += d)};
};

let log: string[];
let spy: jest.SpyInstance;

beforeEach(() => {
  log = [];
  spy = jest.spyOn(console, 'log').mockImplementation((...args: unknown[]) => {
    log.push(args.map(String).join(' '));
  });
});

afterEach(() => spy.mockRestore());

describe('PhoneTurnTelemetry — 三段口径', () => {
  it('完整一轮：asr / firstToken / turnTotal 各自独立计时', () => {
    const c = makeClock();
    const t = new PhoneTurnTelemetry(c.now);

    t.begin(); // 1000
    c.advance(812);
    t.markAsrDone(); // 1812 → asr=812
    c.advance(2340);
    t.markReplyStarted(); // 4152 → firstToken=4152-1812=2340
    c.advance(4968);
    const s = t.endAndReport(); // 9120 → turnTotal=8120

    expect(s).toEqual({asrMs: 812, firstTokenMs: 2340, turnTotalMs: 8120});
    expect(log[0]).toBe(
      '[phoneTurnPerf] asr=812ms firstToken=2340ms turnTotal=8120ms',
    );
  });

  it('firstToken 以「转写返回」为起点，不是以 begin 为起点（否则会把 ASR 算两遍）', () => {
    const c = makeClock();
    const t = new PhoneTurnTelemetry(c.now);
    t.begin();
    c.advance(500);
    t.markAsrDone();
    c.advance(60);
    t.markReplyStarted();
    c.advance(40);
    const s = t.endAndReport();
    expect(s?.firstTokenMs).toBe(60);
    expect(s?.turnTotalMs).toBe(600);
  });

  it('空文本轮次：只有 asr，firstToken 为 null（不编数）', () => {
    const c = makeClock();
    const t = new PhoneTurnTelemetry(c.now);
    t.begin();
    c.advance(300);
    t.markAsrDone();
    c.advance(5);
    const s = t.endAndReport();
    expect(s).toEqual({asrMs: 300, firstTokenMs: null, turnTotalMs: 305});
    expect(log[0]).toContain('firstToken=n/a');
  });

  it('转写都没回来就失败：asr 与 firstToken 均 null，只有整轮时长', () => {
    const t = new PhoneTurnTelemetry(makeClock().now);
    t.begin();
    const s = t.endAndReport();
    expect(s?.asrMs).toBeNull();
    expect(s?.firstTokenMs).toBeNull();
    expect(s?.turnTotalMs).toBe(0);
    expect(log[0]).toContain('asr=n/a');
  });

  it('未 begin 就 end → 返回 null 且不打日志（不报半截数字）', () => {
    const t = new PhoneTurnTelemetry(makeClock().now);
    expect(t.endAndReport()).toBeNull();
    expect(log).toHaveLength(0);
  });

  it('markAsrDone / markReplyStarted 幂等：重复打点不覆盖首值', () => {
    const c = makeClock();
    const t = new PhoneTurnTelemetry(c.now);
    t.begin();
    c.advance(100);
    t.markAsrDone();
    c.advance(900);
    t.markAsrDone(); // 迟到的第二次必须被忽略
    c.advance(50);
    t.markReplyStarted();
    c.advance(50);
    t.markReplyStarted();
    const s = t.endAndReport();
    // asr=100 证明首值未被迟到的第二次覆盖；firstToken=950 证明它的**起点**
    // 仍锚在首个 markAsrDone（2050-1100）——若实现错用 2000 做起点就会得 50。
    expect(s?.asrMs).toBe(100);
    expect(s?.firstTokenMs).toBe(950);
  });

  it('end 之后重复 end → null（一轮只报一次，防止双收口刷两条日志）', () => {
    const t = new PhoneTurnTelemetry(makeClock().now);
    t.begin();
    t.endAndReport();
    expect(t.endAndReport()).toBeNull();
    expect(log).toHaveLength(1);
  });

  it('reset（挂断路径）作废本轮：既不报错也不产出数字', () => {
    const t = new PhoneTurnTelemetry(makeClock().now);
    t.begin();
    t.markAsrDone();
    t.reset();
    expect(t.endAndReport()).toBeNull();
    expect(log).toHaveLength(0);
  });
});
