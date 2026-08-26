/**
 * chatTurnPerf — 聊天域按回合遥测（B40 §11.2 / B41 留存，PERF_BENCHMARK_DESIGN）
 *
 * 回合开始 1Hz 采样（NativeHardwareInfo 单通道），**逐点委托 perfRecorder
 * 增量落盘**（JSONL，进程被杀也留断点前完整轨迹）；回合结束冻结为本轮轨迹，
 * 附到消息 metadata.turnPerf → footer「▾ 图」展开层数据源，落盘轨迹则进
 * perfRecorder 统一历史（与生图跑分同库，PerfHistoryModal 可回看）。
 *
 * 采样失败诚实跳过该点，不编造不插值；失败回合 removeSession 不留残迹。
 * 与生图任务互斥（聊天/生图不并发），共享 perfRecorder 单活动会话安全。
 */
import NativeHardwareInfo from '../../specs/NativeHardwareInfo';
import {perfRecorder, type PerfPoint} from './perfRecorder';

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

/** 聊天回合落盘任务类型（与生图 'generated' 区分，同库可回看） */
export const CHAT_TURN_TASK_TYPE = 'chat-turn';

class ChatTurnPerf {
  private timer: ReturnType<typeof setInterval> | null = null;
  private points: PerfPoint[] = [];
  private startedAt = 0;
  private taskId: string | null = null;

  /** run_started：落盘 meta + 起 1Hz 采样（每点增量落盘）。
   *  调用方 fire-and-forget（内部自捕获异常，不抛给主链）。 */
  begin(meta: {taskId: string; modelLabel: string}): void {
    this.cancel();
    this.points = [];
    this.startedAt = Date.now();
    this.taskId = meta.taskId;
    // 落盘 meta（异步，失败仅内存态可用，不阻断采样）
    void perfRecorder
      .begin({
        taskId: meta.taskId,
        taskType: CHAT_TURN_TASK_TYPE,
        modelLabel: meta.modelLabel,
        startedAt: this.startedAt,
      })
      .catch(e => console.warn('[chatTurnPerf] persist begin failed:', e));
    const sample = async () => {
      try {
        const s = await NativeHardwareInfo.getPerfSnapshot();
        const pt: PerfPoint = {
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
        };
        this.points.push(pt);
        // 增量落盘（fire-and-forget，断点前轨迹可回看）
        void perfRecorder.append(pt).catch(() => undefined);
      } catch {
        // 本点采样失败：诚实跳过，不打断轨迹（稀疏好过造假）
      }
    };
    sample();
    this.timer = setInterval(sample, 1000);
  }

  /** run_finished：停采 + 落盘 summary + 冻结摘要；<2 点返 null（不画无米之炊） */
  finish(): ChatTurnPerfSummary | null {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    const points = this.points;
    this.points = [];
    this.taskId = null;
    // 落盘收尾（写 summary 行；被杀无 summary 时读侧由轨迹重算）
    void perfRecorder.finish('success').catch(() => undefined);
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
        cpus.length > 0 ? cpus.reduce((a, b) => a + b, 0) / cpus.length : -1,
      tempRiseC: temps.length >= 2 ? temps[temps.length - 1] - temps[0] : 0,
      durationMs: Date.now() - this.startedAt,
    };
  }

  /** run_failed/中止：停采 + 删落盘残迹（失败回合不留痕迹） */
  cancel(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.points = [];
    if (this.taskId) {
      const id = this.taskId;
      this.taskId = null;
      void perfRecorder.removeSession(id).catch(() => undefined);
    }
  }
}

export const chatTurnPerf = new ChatTurnPerf();
