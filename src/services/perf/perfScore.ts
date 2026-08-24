/**
 * 跑分卡分数体系（PERF_BENCHMARK_DESIGN §4.3 / IMAGEGEN_UI_SPEC §9.1）
 *
 * 分项（0-100，越高越好）：
 *  - memory   内存安全：(6GB - PSS峰值)/6GB×100，距 HyperOS 硬杀线余量
 *  - thermal  温控：100 - 温升率(°C/min)×10
 *  - stability 稳定性：PSS均值/PSS峰值×100（峰均比反向，3DMark 式）
 *  - speed    速度：baseline/平均步耗时×100（无基线时 null，不计权）
 * 综合分：有 speed 四项加权（35/25/25/15），无 speed 三项（40/30/30）。
 */
import type {PerfPoint} from './perfRecorder';

/** PSS 硬杀线（HyperOS 实测 6291456kb）——内存安全分项满量程 */
export const PSS_DANGER_KB = 6 * 1024 * 1024;

export interface PerfScoreCard {
  memory: number;
  thermal: number;
  stability: number;
  /** 无同模型速度基线时不参与综合分 */
  speed: number | null;
  total: number;
}

const clamp = (v: number, lo = 0, hi = 100): number =>
  Math.min(hi, Math.max(lo, v));

/**
 * 从落盘轨迹计算跑分卡。点不足 2 个视为无意义样本，返回全零卡。
 * @param points 任务轨迹点（需有 ts，append 时打戳）
 * @param baselineStepTime 同模型历史平均步耗时（秒）；缺省则速度分项不计
 */
export function computePerfScore(
  points: PerfPoint[],
  baselineStepTime?: number,
): PerfScoreCard {
  if (points.length < 2) {
    return {memory: 0, thermal: 0, stability: 0, speed: null, total: 0};
  }
  const pssList = points.map(p => p.pssKb).filter(v => v > 0);
  const peak = Math.max(...pssList);
  const mean = pssList.reduce((a, b) => a + b, 0) / pssList.length;

  // 内存安全：峰值距硬杀线余量（负值=超限归 0）
  const memory = clamp(((PSS_DANGER_KB - peak) / PSS_DANGER_KB) * 100);

  // 温控：首尾温度差 / 时长(分钟) → 爬升率；无效温度退化为 0 影响
  let thermal = 100;
  const temps = points.map(p => p.tempC).filter(t => t > 0);
  if (temps.length >= 2) {
    const durationMin = (points[points.length - 1].ts - points[0].ts) / 60000;
    if (durationMin > 0) {
      const riseRate = (temps[temps.length - 1] - temps[0]) / durationMin;
      thermal = clamp(100 - riseRate * 10);
    }
  }

  // 稳定性：峰均比反向（3DMark 式，越平稳越高分）
  const stability = peak > 0 ? clamp((mean / peak) * 100) : 0;

  // 速度：同模型基线归一（基线步耗时/本次平均步耗时），无基线不计
  let speed: number | null = null;
  const steps = points.map(p => p.stepTime).filter(t => t > 0);
  if (steps.length > 0 && baselineStepTime && baselineStepTime > 0) {
    const avgStep = steps.reduce((a, b) => a + b, 0) / steps.length;
    speed = clamp((baselineStepTime / avgStep) * 100);
  }

  const total =
    speed !== null
      ? memory * 0.35 + thermal * 0.25 + stability * 0.25 + speed * 0.15
      : memory * 0.4 + thermal * 0.3 + stability * 0.3;

  return {
    memory: Math.round(memory),
    thermal: Math.round(thermal),
    stability: Math.round(stability),
    speed: speed !== null ? Math.round(speed) : null,
    total: Math.round(total),
  };
}
