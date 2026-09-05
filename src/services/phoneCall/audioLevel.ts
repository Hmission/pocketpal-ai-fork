/**
 * audioLevel — 录音能量单通道订阅 + VAD 观测统计（PHONE_SPEC §14.2 / §14.3）。
 *
 * 为什么存在：v2.2 的通话页声波柱是 900ms 循环相位（**不是音量**），因为原生只落盘
 * PCM、没把能量回传 JS。v2.4 起 `AudioRecordModule` 在写盘循环内算 RMS 并按
 * 50ms 节流发 `AudioLevel` 事件，本服务是 JS 侧唯一订阅点（单一事实源，
 * 不允许第二个组件各自 new NativeEventEmitter——重复订阅 = 事件翻倍）。
 *
 * VAD 边界（§14.3 红线）：**观测期只测不断**。本服务只累计统计与"假想断点"，
 * 不触发任何停止录音的动作；按住说话仍是唯一录音触发、松手仍是唯一提交口。
 * 数据不支持就不上免手。
 *
 * 降级诚实：原生模块缺失 / 事件未就绪（旧构建、iOS）→ 静默无数据，
 * UI 侧回退静态柱，**不用假波形冒充**。
 */
import {NativeEventEmitter, NativeModules} from 'react-native';

/** 与 AudioRecordModule.EVENT_AUDIO_LEVEL 同步 */
export const AUDIO_LEVEL_EVENT = 'AudioLevel';
/** 静音判定门限（RMS 归一化 0..1；语音正常发声通常 > 0.02） */
export const SILENCE_THRESHOLD = 0.02;
/** 假想断句门限：连续静音超过此时长即记为"若启用免手会在此刻断句" */
export const HYPOTHETICAL_STOP_SILENCE_MS = 900;
/** RMS→可视 0..1 增益（RMS 0.125 即满格；语音常见 0.01–0.1 区间） */
export const LEVEL_GAIN = 8;

export type AudioLevelListener = (level01: number) => void;

export type VadObservation = {
  /** 本次录音时长 ms（首末事件间隔） */
  durationMs: number;
  samples: number;
  /** 峰值 / 均值（原始 RMS，未乘增益） */
  peak: number;
  avg: number;
  /** 最长连续静音段 ms */
  longestSilenceMs: number;
  /** 假想免手断点（相对录音起点 ms）；未达门限则 null */
  hypotheticalStopAtMs: number | null;
};

class AudioLevelService {
  private emitter: NativeEventEmitter | null = null;
  private sub: {remove: () => void} | null = null;
  private listeners = new Set<AudioLevelListener>();
  /** 最近一次可视电平（0..1，已乘增益并截顶） */
  last = 0;

  private startedAt = 0;
  private lastTs = 0;
  private samples = 0;
  private peak = 0;
  private sum = 0;
  private silenceRunStart = 0;
  private longestSilenceMs = 0;
  private hypotheticalStopAtMs: number | null = null;

  /** 录音开始时调用：建立订阅并清零统计（重复调用幂等）。 */
  begin(): void {
    this.end();
    const mod = (NativeModules as unknown as {AudioRecord?: {name?: string}})
      .AudioRecord;
    if (!mod) {
      return; // 无原生通道：静默降级（UI 走静态柱）
    }
    try {
      this.emitter = new NativeEventEmitter(mod as never);
    } catch {
      this.emitter = null;
      return;
    }
    this.reset();
    this.sub = this.emitter.addListener(
      AUDIO_LEVEL_EVENT,
      (e: {level?: number; ts?: number}) => this.onLevel(e),
    );
  }

  /** 录音结束时调用：产出观测统计（logcat 取证），并解除订阅。 */
  end(): VadObservation | null {
    this.sub?.remove();
    this.sub = null;
    this.emitter = null;
    this.last = 0;
    if (this.samples === 0) {
      this.reset();
      return null;
    }
    const obs: VadObservation = {
      durationMs: Math.round(this.lastTs - this.startedAt),
      samples: this.samples,
      peak: this.peak,
      avg: this.samples > 0 ? this.sum / this.samples : 0,
      longestSilenceMs: Math.round(this.longestSilenceMs),
      hypotheticalStopAtMs: this.hypotheticalStopAtMs,
    };
    // release 构建 console.log 仍落 logcat（tag ReactNativeJS）——spike 取证出口
    console.log(
      `[VAD-obs] duration=${obs.durationMs}ms samples=${obs.samples} ` +
        `peak=${obs.peak.toFixed(4)} avg=${obs.avg.toFixed(4)} ` +
        `longestSilence=${obs.longestSilenceMs}ms ` +
        `hypotheticalStop=${
          obs.hypotheticalStopAtMs === null
            ? 'none'
            : `${obs.hypotheticalStopAtMs}ms`
        }`,
    );
    this.reset();
    return obs;
  }

  subscribe(cb: AudioLevelListener): () => void {
    this.listeners.add(cb);
    return () => {
      this.listeners.delete(cb);
    };
  }

  private onLevel(e: {level?: number; ts?: number}): void {
    const rms = typeof e.level === 'number' ? Math.max(0, e.level) : 0;
    const ts = typeof e.ts === 'number' ? e.ts : Date.now();
    if (this.startedAt === 0) {
      this.startedAt = ts;
    }
    this.lastTs = ts;
    this.samples += 1;
    this.sum += rms;
    if (rms > this.peak) {
      this.peak = rms;
    }
    this.last = Math.min(1, rms * LEVEL_GAIN);

    // 静音段与假想断点（只观测，不动作）
    if (rms < SILENCE_THRESHOLD) {
      if (this.silenceRunStart === 0) {
        this.silenceRunStart = ts;
      }
      const run = ts - this.silenceRunStart;
      if (run > this.longestSilenceMs) {
        this.longestSilenceMs = run;
      }
      if (
        this.hypotheticalStopAtMs === null &&
        run >= HYPOTHETICAL_STOP_SILENCE_MS &&
        this.samples > 4 // 首帧即静音不算（未开口）
      ) {
        this.hypotheticalStopAtMs = Math.round(ts - this.startedAt);
      }
    } else {
      this.silenceRunStart = 0;
    }

    this.listeners.forEach(cb => cb(this.last));
  }

  private reset(): void {
    this.startedAt = 0;
    this.lastTs = 0;
    this.samples = 0;
    this.peak = 0;
    this.sum = 0;
    this.silenceRunStart = 0;
    this.longestSilenceMs = 0;
    this.hypotheticalStopAtMs = null;
  }
}

export const audioLevel = new AudioLevelService();
