/**
 * PerfRecorder — 任务级性能轨迹落盘（PERF_BENCHMARK_DESIGN §4.2）
 *
 * 每次生图任务落一个 JSONL 文件：`DocumentDirectory/perf/perf_<taskId>.jsonl`
 *  - 首行 meta（taskId/类型/模型/开始时间）
 *  - 每点一行（1Hz，append；进程被杀也不丢已写轨迹）
 *  - 结束补 summary（结果/时长/峰值/平均步耗时/跑分卡；被杀后由读侧重算兜底）
 * 保留最近 50 条（超出删旧）。全部 RNFS，fire-and-forget 不阻塞主链路。
 */
import * as RNFS from '@dr.pogodin/react-native-fs';

import {computePerfScore, type PerfScoreCard} from './perfScore';

/** 轨迹点（1Hz）：ts 在 append 时打戳；-1 = 原生侧 N/A */
export interface PerfPoint {
  ts: number;
  pssKb: number;
  rssKb: number;
  cpuPct: number;
  tempC: number;
  cpuFreqMhz: number;
  gpuLoadPct: number;
  gpuFreqMhz: number;
  tempCpuC: number;
  tempGpuC: number;
  powerMw: number;
  stepTime: number;
  stage: string;
}

export interface PerfMeta {
  taskId: string;
  /** 任务类型：generated/upscaled/caption/transcribe/tts 等（GeneratedImage.kind） */
  taskType: string;
  modelLabel?: string;
  startedAt: number;
}

export interface PerfSession {
  meta: PerfMeta;
  points: PerfPoint[];
  finishedAt?: number;
  result?: 'success' | 'failed';
  score?: PerfScoreCard;
}

const DIR = `${RNFS.DocumentDirectoryPath}/perf`;
/** 保留上限（超出删最旧） */
const KEEP = 50;
const FILE_PREFIX = 'perf_';

type JsonlLine =
  | {kind: 'meta'; meta: PerfMeta}
  | {kind: 'pt'; pt: PerfPoint}
  | {kind: 'summary'; summary: {
      finishedAt: number;
      result: 'success' | 'failed';
      durationMs: number;
      pssPeakKb: number;
      avgStepTime: number;
      score: PerfScoreCard;
    }};

class PerfRecorder {
  private activeId: string | null = null;
  private activeMeta: PerfMeta | null = null;
  /** 内存态轨迹（同会话内免读盘；进程被杀时文件里是断点前的完整轨迹） */
  private activePoints: PerfPoint[] = [];

  get isActive(): boolean {
    return this.activeId !== null;
  }

  private pathFor(taskId: string): string {
    return `${DIR}/${FILE_PREFIX}${taskId}.jsonl`;
  }

  /** 任务开始：建文件写 meta 行（异常静默，不阻断生图） */
  async begin(meta: PerfMeta): Promise<void> {
    if (this.activeId) {
      // 理论上单任务链不会重入；防御：先收尾旧会话
      await this.finish('failed');
    }
    try {
      await RNFS.mkdir(DIR);
      const line: JsonlLine = {kind: 'meta', meta};
      await RNFS.writeFile(this.pathFor(meta.taskId), JSON.stringify(line) + '\n', 'utf8');
      this.activeId = meta.taskId;
      this.activeMeta = meta;
      this.activePoints = [];
      this.cleanup();
    } catch (e) {
      console.warn('[PerfRecorder] begin failed:', e);
      this.activeId = null;
    }
  }

  /** 1Hz 追加轨迹点（由 imageGenStore.pullSnapshot 驱动） */
  async append(pt: PerfPoint): Promise<void> {
    if (!this.activeId) {
      return;
    }
    this.activePoints.push(pt);
    try {
      const line: JsonlLine = {kind: 'pt', pt};
      await RNFS.appendFile(this.pathFor(this.activeId), JSON.stringify(line) + '\n', 'utf8');
    } catch (e) {
      console.warn('[PerfRecorder] append failed:', e);
    }
  }

  /** 任务结束：算跑分卡 + 写 summary 行（被杀无 summary 时读侧重算） */
  async finish(result: 'success' | 'failed'): Promise<void> {
    const taskId = this.activeId;
    if (!taskId || !this.activeMeta) {
      return;
    }
    try {
      const points = this.activePoints;
      // v1 无同模型速度基线（speed 分项不计）；后续可按 modelLabel 聚合历史步耗时接入
      const score = computePerfScore(points);
      const steps = points.map(p => p.stepTime).filter(t => t > 0);
      const summary: Extract<JsonlLine, {kind: 'summary'}>['summary'] = {
        finishedAt: Date.now(),
        result,
        durationMs: points.length > 1 ? points[points.length - 1].ts - points[0].ts : 0,
        pssPeakKb: points.reduce((m, p) => Math.max(m, p.pssKb), 0),
        avgStepTime: steps.length > 0 ? steps.reduce((a, b) => a + b, 0) / steps.length : 0,
        score,
      };
      const line: JsonlLine = {kind: 'summary', summary};
      await RNFS.appendFile(this.pathFor(taskId), JSON.stringify(line) + '\n', 'utf8');
    } catch (e) {
      console.warn('[PerfRecorder] finish failed:', e);
    } finally {
      this.activeId = null;
      this.activeMeta = null;
      this.activePoints = [];
    }
  }

  /** 历史会话列表（只读各文件首行 meta，轻量）；按开始时间倒序 */
  async listSessions(): Promise<PerfMeta[]> {
    try {
      const files = await RNFS.readDir(DIR);
      const metas: PerfMeta[] = [];
      for (const f of files) {
        if (!f.name.startsWith(FILE_PREFIX) || !f.name.endsWith('.jsonl')) {
          continue;
        }
        try {
          const content = await RNFS.readFile(f.path, 'utf8');
          const first = content.split('\n', 1)[0];
          const line = JSON.parse(first) as JsonlLine;
          if (line.kind === 'meta') {
            metas.push(line.meta);
          }
        } catch {
          /* 单文件损坏跳过 */
        }
      }
      return metas.sort((a, b) => b.startedAt - a.startedAt);
    } catch {
      return [];
    }
  }

  /** 读完整会话：点数组 + summary；被杀无 summary 时由点重算跑分卡 */
  async readSession(taskId: string): Promise<PerfSession | null> {
    try {
      const content = await RNFS.readFile(this.pathFor(taskId), 'utf8');
      const session: PerfSession = {meta: null as never, points: []};
      let summary: Extract<JsonlLine, {kind: 'summary'}>['summary'] | null = null;
      for (const raw of content.split('\n')) {
        if (!raw.trim()) {
          continue;
        }
        try {
          const line = JSON.parse(raw) as JsonlLine;
          if (line.kind === 'meta') {
            session.meta = line.meta;
          } else if (line.kind === 'pt') {
            session.points.push(line.pt);
          } else {
            summary = line.summary;
          }
        } catch {
          /* 行损坏跳过 */
        }
      }
      if (!session.meta) {
        return null;
      }
      if (summary) {
        session.finishedAt = summary.finishedAt;
        session.result = summary.result;
        session.score = summary.score;
      } else if (session.points.length >= 2) {
        // 进程被杀：用落盘轨迹重算（断点前的部分轨迹）
        session.score = computePerfScore(session.points);
      }
      return session;
    } catch {
      return null;
    }
  }

  /** 删除单条会话记录 */
  async removeSession(taskId: string): Promise<void> {
    try {
      await RNFS.unlink(this.pathFor(taskId));
    } catch {
      /* 不存在即成功 */
    }
  }

  /** 保留最近 KEEP 条，超出删最旧（begin 时顺带触发） */
  private async cleanup(): Promise<void> {
    try {
      const files = (await RNFS.readDir(DIR)).filter(
        f => f.name.startsWith(FILE_PREFIX) && f.name.endsWith('.jsonl'),
      );
      if (files.length <= KEEP) {
        return;
      }
      // mtime 兼容 Date/number 两种返回形态（不同 RNFS 版本）
      const mtimeOf = (f: {mtime?: Date | number | null}): number =>
        f.mtime instanceof Date ? f.mtime.getTime() : Number(f.mtime ?? 0);
      const sorted = files.sort((a, b) => mtimeOf(a) - mtimeOf(b));
      for (const f of sorted.slice(0, files.length - KEEP)) {
        await RNFS.unlink(f.path);
      }
    } catch {
      /* 清理失败不影响主链路 */
    }
  }

  /** 测试钩子：重置内存态 */
  _reset(): void {
    this.activeId = null;
    this.activeMeta = null;
    this.activePoints = [];
  }
}

export const perfRecorder = new PerfRecorder();
