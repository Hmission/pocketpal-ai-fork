/**
 * audioLevel 测试（PHONE_SPEC §14.2 / §14.3）。
 *
 * 三条契约：①真实振幅换算（RMS×增益截顶）并推给订阅者；
 * ②VAD **只观测不动作**——统计最长静音段与"假想断点"，但不触发任何停止行为；
 * ③订阅生命周期干净（end 解除订阅、无事件时诚实返 null）。
 */

jest.mock('react-native', () => {
  const holder: {listener: ((e: unknown) => void) | null} = {listener: null};
  (
    globalThis as unknown as {__audioLevelHolder: typeof holder}
  ).__audioLevelHolder = holder;
  return {
    NativeModules: {AudioRecord: {name: 'AudioRecord'}},
    NativeEventEmitter: jest.fn(() => ({
      addListener: (_evt: string, cb: (e: unknown) => void) => {
        holder.listener = cb;
        return {
          remove: () => {
            holder.listener = null;
          },
        };
      },
    })),
  };
});

import {
  audioLevel,
  LEVEL_GAIN,
  SILENCE_THRESHOLD,
  HYPOTHETICAL_STOP_SILENCE_MS,
} from '../audioLevel';

const holder = (
  globalThis as unknown as {
    __audioLevelHolder: {listener: ((e: unknown) => void) | null};
  }
).__audioLevelHolder;

/** 推一个电平事件（ts 为绝对毫秒） */
const feed = (level: number, ts: number) => {
  holder.listener?.({level, ts});
};

describe('audioLevel — 真实振幅通道 + VAD 观测', () => {
  beforeEach(() => {
    holder.listener = null;
    audioLevel.end(); // 清残留订阅与统计
  });

  it('begin 后建立订阅；电平按 RMS×增益换算并截顶到 0..1，推给订阅者', () => {
    const seen: number[] = [];
    audioLevel.begin();
    expect(holder.listener).not.toBeNull();
    const off = audioLevel.subscribe(l => seen.push(l));

    feed(SILENCE_THRESHOLD * 2, 1000); // 0.04 × 8 = 0.32
    feed(1, 1100); // 溢出保护 → 1

    expect(seen[0]).toBeCloseTo(SILENCE_THRESHOLD * 2 * LEVEL_GAIN, 5);
    expect(seen[1]).toBe(1);
    expect(audioLevel.last).toBe(1);
    off();
  });

  it('连续静音达门限 → 记录最长静音段与"假想断点"（不执行任何断句动作）', () => {
    audioLevel.begin();
    const t0 = 10_000;
    feed(0.001, t0); // 首帧静音不计（未开口）
    for (let i = 1; i <= 20; i++) {
      feed(0.001, t0 + i * 50); // 20 × 50ms = 1000ms 静音
    }
    const obs = audioLevel.end()!;
    expect(obs.samples).toBe(21);
    expect(obs.longestSilenceMs).toBeGreaterThanOrEqual(
      HYPOTHETICAL_STOP_SILENCE_MS,
    );
    expect(obs.hypotheticalStopAtMs).not.toBeNull();
    // 假想断点必须晚于首帧之后（首帧即静音不算）
    expect(obs.hypotheticalStopAtMs!).toBeGreaterThan(0);
  });

  it('说话中途正常停顿（未达门限）→ 无假想断点；峰值/均值取真实值', () => {
    audioLevel.begin();
    const t0 = 20_000;
    feed(0.08, t0);
    feed(0.001, t0 + 50);
    feed(0.001, t0 + 100); // 停顿 100ms << 900ms
    feed(0.12, t0 + 150); // 人声恢复，静音段清零
    const obs = audioLevel.end()!;
    expect(obs.hypotheticalStopAtMs).toBeNull();
    expect(obs.peak).toBeCloseTo(0.12, 6);
    expect(obs.avg).toBeGreaterThan(0);
    expect(obs.longestSilenceMs).toBeLessThan(HYPOTHETICAL_STOP_SILENCE_MS);
  });

  it('无事件即结束（录音未拿到能量）→ 诚实返 null，不编造统计', () => {
    audioLevel.begin();
    expect(audioLevel.end()).toBeNull();
  });

  it('end 解除订阅：后续事件不再进入统计', () => {
    audioLevel.begin();
    feed(0.05, 1000);
    audioLevel.end();
    expect(holder.listener).toBeNull();
    expect(() => feed(0.05, 1100)).not.toThrow();
    const again = audioLevel.end();
    expect(again).toBeNull();
  });
});
