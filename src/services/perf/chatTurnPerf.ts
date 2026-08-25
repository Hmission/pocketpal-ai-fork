/**
 * chatTurnPerf — 聊天域按回合遥测（B40 §11.2，PERF_BENCHMARK_DESIGN）
 *
 * 回合开始 1Hz 采样（NativeHardwareInfo 单通道），回合结束冻结为本轮轨迹，
 * 附到消息 metadata.turnPerf → footer「▾ 图」展开层的唯一数据源。
 * **内存态，不落盘不持久化**（与 perfRecorder 的生图落盘链路分工：
 * 聊天回合遥测是演出面，随消息生命周期即可，不造持久化债）。
 * 采样失败诚实跳过该点，不编造不插值。
 */
import NativeHardwareInfo from '../../specs/NativeHardwareInfo';
import type {PerfPoint} from './perfRecorder';

export interface ChatTurnPerfSummary {
  /** 本轮 1Hz 轨迹（≥2 点才出摘要，单点/无点诚实返 null 由调用方处理） */
  points: PerfPoint[];
  /** PSS 峰值 kb（与 HyperOS 硬杀同口径） */
  pssPeakKb: number;
  /** 平均 CPU%（-1 = 无有效采样） */
  avgCpuPct: number;
  /** 温升 ℃（尾-首；不足两点为 0） */
  tempRiseC: number;
  durationMs: number;
}

class ChatTurnPerf {
  private timer: ReturnType<typeof setInterval> | null = null;
  private points: PerfPoint[] = [];
  private startedAt = 0;

  /** run_started：清上一轮残迹 + 起采 */
  begin(): void {
    this.cancel();
    this.points = [];
    this.startedAt = Date.now();
    const sample = async () => {
      try {
        const s = await NativeHardwareInfo.getPerfSnapshot();
        this.points.push({
          ts: Date.now(),
          pssKb: s.pssKb,
          rssKb: s.rssKb,
          cpuPct: s.cpuPct,
          tempC: s.tempC,
          cpuFreqMhz: s.cpuFreqMhz ?? -1,
          gpuLoadPct: s.gpuLoadPct ?? -1,
          gpuFreqMhz: s.gpuFreqMhz ?? -1,
          tempCpuC: s.tempCpuC ?? -1,
          tempGpuC: s.tempGpuC ?? -1,
          powerMw: s.powerMw ?? -1,
          stepTime: 0,
          stage: 'chat-turn',
        });
      } catch {
        // 本点采样失败：诚实跳过，不打断轨迹（稀疏好过造假）
      }
    };
    sample();
    this.timer = setInterval(sample, 1000);
  }

  /** run_finished：停采 + 冻结摘要；<2 点返 null（不画无米之炊） */
  finish(): ChatTurnPerfSummary | null {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    const points = this.points;
    this.points = [];
    if (points.length < 2) {
      return null;
    }
    const pss = points.map(p => p.pssKb).filter(v => v > 0);
    const cpus = points.map(p => p.cpuPct).filter(v => v >= 0);
    const temps = points.map(p => p.tempC).filter(v => v > 0);
    return {
      points,
      pssPeakKb: pss.length > 0 ? Math.max(...pss) : 0,
      avgCpuPct:
        cpus.length > 0
          ? cpus.reduce((a, b) => a + b, 0) / cpus.length
          : -1,
      tempRiseC:
        temps.length >= 2 ? temps[temps.length - 1] - temps[0] : 0,
      durationMs: Date.now() - this.startedAt,
    };
  }

  /** run_failed/中止：停采丢弃（失败回合不留演出残迹） */
  cancel(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.points = [];
  }
}

export const chatTurnPerf = new ChatTurnPerf();
