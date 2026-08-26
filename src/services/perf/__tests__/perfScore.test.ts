/**
 * perfScore 跑分卡分数体系测试（PERF_BENCHMARK_DESIGN §4.3 / IMAGEGEN_UI_SPEC §9.1）
 */
import {computePerfScore, PSS_DANGER_KB} from '../perfScore';
import type {PerfPoint} from '../perfRecorder';

const GB = 1024 * 1024;

/** 构造轨迹点工厂：默认 10 分钟、3GB PSS、恒温 */
const mkPoint = (i: number, over: Partial<PerfPoint> = {}): PerfPoint => ({
  ts: i * 1000,
  pssKb: 3 * GB,
  rssKb: 2.5 * GB,
  cpuPct: 80,
  tempC: 40,
  cpuFreqMhz: 3200,
  gpuLoadPct: 70,
  gpuFreqMhz: 840,
  tempCpuC: 41,
  tempGpuC: 39,
  powerMw: 5000,
  stepTime: 0,
  stage: '',
  ...over,
});

describe('perfScore 分数体系', () => {
  it('点不足 2 个返回全零卡', () => {
    const card = computePerfScore([mkPoint(0)]);
    expect(card).toEqual({
      memory: 0,
      thermal: 0,
      stability: 0,
      speed: null,
      total: 0,
    });
  });

  it('内存安全 = (6GB-峰值)/6GB×100（3GB 峰值 → 50 分）', () => {
    const points = [mkPoint(0), mkPoint(1), mkPoint(2)];
    const card = computePerfScore(points);
    expect(card.memory).toBe(50);
  });

  it('内存安全负值归 0（峰值超硬杀线）', () => {
    const points = [mkPoint(0, {pssKb: 7 * GB}), mkPoint(1, {pssKb: 7 * GB})];
    expect(computePerfScore(points).memory).toBe(0);
  });

  it('温控：温度不爬升 → 100 分', () => {
    const points = Array.from({length: 61}, (_, i) => mkPoint(i * 60));
    expect(computePerfScore(points).thermal).toBe(100);
  });

  it('温控：爬升 5°C/min → 50 分（100 - 5×10）', () => {
    // 10 分钟从 40 → 90：爬升率 5
    const points = Array.from({length: 11}, (_, i) =>
      mkPoint(i * 60, {tempC: 40 + i * 5}),
    );
    expect(computePerfScore(points).thermal).toBe(50);
  });

  it('稳定性 = 均值/峰值×100（恒定 3GB → 100）', () => {
    const points = [mkPoint(0), mkPoint(1)];
    expect(computePerfScore(points).stability).toBe(100);
  });

  it('稳定性：有尖峰时低于 100（均值<峰值）', () => {
    const points = [mkPoint(0, {pssKb: 2 * GB}), mkPoint(1, {pssKb: 4 * GB})];
    const card = computePerfScore(points);
    expect(card.stability).toBe(75); // 均值 3GB / 峰值 4GB
  });

  it('速度：无基线时不计分（null），综合分按三项加权', () => {
    const points = [mkPoint(0), mkPoint(1)];
    const card = computePerfScore(points);
    expect(card.speed).toBeNull();
    // 三项：memory50×0.4 + thermal100×0.3 + stability100×0.3 = 80
    expect(card.total).toBe(80);
  });

  it('速度：有基线时四项加权，快于基线 → 速度满分', () => {
    const points = [mkPoint(0, {stepTime: 1}), mkPoint(1, {stepTime: 1})];
    const card = computePerfScore(points, 2); // 基线 2s，本次 1s → 200→clamp 100
    expect(card.speed).toBe(100);
    // memory50×0.35 + thermal100×0.25 + stability100×0.25 + speed100×0.15 = 82.5 → 83
    expect(card.total).toBe(83);
  });

  it('PSS_DANGER_KB 与 HyperOS 硬杀线口径一致（6GB）', () => {
    expect(PSS_DANGER_KB).toBe(6 * 1024 * 1024);
  });
});
