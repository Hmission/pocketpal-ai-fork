/**
 * benchmarkOrchestrator — 基准测试总控编排（PERF_BENCHMARK_DESIGN §10.7/10.8，B39）
 *
 * 三用例真实负载状态机：推理速度（聊天页真实流式）→ 生图速度（DreamLite
 * 固定负载）→ 温控耐久（生图连跑 3 轮）。自动导航到赛道页让过程可见；
 * 发送复用 registerChatSender 完整调度链，生图复用 imageGenStore.generate，
 * 零新链路。随采 1Hz 轨迹（NativeHardwareInfo，与 HyperOS 硬杀同口径）。
 *
 * 红线：演出层不动数据层——用例失败即诚实报错复位（不留半态，CP-APP-012）；
 * 模型加载时长不入分（用例直跑当前已加载模型，未加载诚实引导）。
 */
import {v4 as uuidv4} from 'uuid';

import {benchmarkStore} from '../store/BenchmarkStore';
import {
  chatSessionStore,
  modelStore,
  defaultCompletionSettings,
} from '../store';
import {imageGenStore} from '../store';
import {getChatSender} from '../debug/actionRegistry';
import NativeHardwareInfo from '../specs/NativeHardwareInfo';
import {computePerfScore, type PerfScoreCard} from './perf/perfScore';
import type {PerfPoint} from './perf/perfRecorder';
import {ROUTES} from '../utils/navigationConstants';
import type {BenchmarkResult} from '../utils/types';

// ── 标准负载契约（§10.8，全链只读）──
export const BENCH_LLM_PROMPT = '用一段话介绍小黄鸡。';
export const BENCH_GEN_PROMPT = 'a cute baby chick on green grass, sunlight';
/** DreamLite 标准步数（与生图页默认同口径，§10.8 契约） */
export const BENCH_DREAM_STEPS = 4;
export const BENCH_ENDURANCE_ROUNDS = 3;
const LLM_CASE_TIMEOUT_MS = 600_000;
const POLL_MS = 500;
const SAMPLE_MS = 1000;

/** 最小导航面（编排器不依赖具体 navigation 类型） */
export interface BenchNav {
  navigate: (route: string) => void;
}

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

async function waitUntil(
  pred: () => boolean,
  timeoutMs: number,
  isAborted: () => boolean,
): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (isAborted()) {
      return false;
    }
    if (pred()) {
      return true;
    }
    await sleep(POLL_MS);
  }
  return pred();
}

class BenchmarkOrchestrator {
  private aborted = false;
  private sampling: ReturnType<typeof setInterval> | null = null;
  private points: PerfPoint[] = [];
  /** LLM 用例实测（真实流式时序链） */
  private llmResult: {tokAvg?: number; ttftMs?: number} = {};
  /** 生图用例实测（每轮步耗时均值） */
  private stepAvgs: number[] = [];
  private suiteStartedAt = 0;

  get isRunning(): boolean {
    return benchmarkStore.suiteRunning;
  }

  abort() {
    this.aborted = true;
  }

  // ── 随采：1Hz 轨迹（真实采集；-1 = N/A 原样保留）──
  private startSampling(stage: string) {
    this.stopSampling();
    this.sampling = setInterval(async () => {
      const s = await NativeHardwareInfo.getPerfSnapshot().catch(() => null);
      if (!s) {
        return;
      }
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
        stepTime: imageGenStore.stepTime || 0,
        stage,
      });
    }, SAMPLE_MS);
  }

  private stopSampling() {
    if (this.sampling) {
      clearInterval(this.sampling);
      this.sampling = null;
    }
  }

  // ── 用例 1：推理速度（聊天页真实流式）──
  private async runLlmCase(nav: BenchNav): Promise<void> {
    if (!modelStore.context) {
      throw new Error('聊天模型未加载——请先加载模型再跑分（加载时长不入分）');
    }
    benchmarkStore.setCase(0, 'llm');
    nav.navigate(ROUTES.CHAT);
    const sender = await (async () => {
      const deadline = Date.now() + 15_000;
      while (Date.now() < deadline && !this.aborted) {
        const s = getChatSender();
        if (s) {
          return s;
        }
        await sleep(POLL_MS);
      }
      return getChatSender();
    })();
    if (!sender) {
      throw new Error('聊天发送槽未就绪（聊天页未挂载）');
    }
    // 标准负载契约（§10.8，真机血证三条）：
    // ① LLM 用例在新会话跑——旧会话历史上下文不可控（实测 3595 tokens 致超时）；
    // ② 思考模式钉死关——同设备同模型思考开 >600s / 思考关 52s，跑分要可比基线；
    //   （override 不入会话参数，真机实证：必须显式 completionSettings 钉死）
    // ③ 生图走 DreamLite 同源入口（自带按需加载，与页面单通道）。
    const benchSettings = {
      ...defaultCompletionSettings,
      enable_thinking: false,
      reasoning: {
        ...(defaultCompletionSettings as {reasoning?: object}).reasoning,
        enabled: false,
      },
    };
    await chatSessionStore.createNewSession('基准测试', [], benchSettings);
    this.startSampling('bench-llm');
    const beforeCount = chatSessionStore.currentSessionMessages.length;
    console.log('[BenchSuite] llm 用例发送标准 prompt（新会话）');
    await sender({text: BENCH_LLM_PROMPT});
    // 完成判定：新助手消息带 timings（或 interrupted），且推理结束
    const done = await waitUntil(
      () => {
        const msgs = chatSessionStore.currentSessionMessages;
        if (msgs.length <= beforeCount) {
          return false;
        }
        const latest = msgs[0];
        const hasOutcome =
          latest.metadata?.timings != null ||
          latest.metadata?.interrupted === true;
        return hasOutcome && !modelStore.inferencing;
      },
      LLM_CASE_TIMEOUT_MS,
      () => this.aborted,
    );
    this.stopSampling();
    if (this.aborted) {
      throw new Error('用户终止');
    }
    if (!done) {
      throw new Error('推理用例超时（600s）');
    }
    console.log('[BenchSuite] llm 用例完成，读取时序链');
    const latest = chatSessionStore.currentSessionMessages[0];
    const timings = latest?.metadata?.timings;
    if (!timings?.predicted_per_second) {
      throw new Error('推理用例未产出时序数据（可能被打断）');
    }
    this.llmResult = {
      tokAvg: timings.predicted_per_second,
      ttftMs: timings.time_to_first_token_ms,
    };
  }

  // ── 用例 2/3：生图速度 / 温控耐久（DreamLite 单通道，与页面同源）──
  private async runGenRounds(nav: BenchNav, rounds: number): Promise<void> {
    benchmarkStore.setCase(
      rounds > 1 ? 2 : 1,
      rounds > 1 ? 'endurance' : 'gen',
    );
    nav.navigate(ROUTES.IMAGE_GEN);
    console.log(
      `[BenchSuite] 生图赛道（${rounds} 轮，DreamLite 入口自带按需加载）`,
    );
    for (let i = 0; i < rounds; i++) {
      if (this.aborted) {
        throw new Error('用户终止');
      }
      const roundStart = Date.now();
      this.startSampling(rounds > 1 ? `bench-endure-${i + 1}` : 'bench-gen');
      let uri: string | null = null;
      // 任务化与页面同源：beginTask → generateDreamLiteEntry → finish/fail
      const taskId = await imageGenStore.beginTask({
        uri: '',
        prompt: BENCH_GEN_PROMPT,
        seed: 0, // DreamLite flow matching 无显式 seed（页面同口径）
        ts: Date.now(),
        width: 512,
        height: 512,
        steps: BENCH_DREAM_STEPS,
        family: 'dreamlite',
        kind: 'generated',
        modelLabel: 'DreamLite',
      });
      try {
        uri = await imageGenStore.generateDreamLiteEntry(
          512,
          512,
          BENCH_DREAM_STEPS,
          BENCH_GEN_PROMPT,
        );
        if (uri) {
          await imageGenStore.finishTask(taskId, uri, {
            durationMs: Date.now() - roundStart,
          });
        } else {
          await imageGenStore.failTask(taskId, '生成失败', '基准套件生图用例');
        }
      } finally {
        this.stopSampling();
      }
      if (this.aborted) {
        throw new Error('用户终止');
      }
      if (!uri) {
        throw new Error(
          `生图用例失败（第 ${i + 1} 轮）：${imageGenStore.error ?? '未知错误'}`,
        );
      }
      // 步耗时均值：本轮窗口内 stepTime>0 采样点的均值（真实采集）；
      // 无采样点时退化为总时长/步数（不造假，口径可解释）
      const pts = this.points.filter(p => p.ts >= roundStart && p.stepTime > 0);
      const stepAvg =
        pts.length > 0
          ? pts.reduce((a, p) => a + p.stepTime, 0) / pts.length
          : (Date.now() - roundStart) / 1000 / BENCH_DREAM_STEPS;
      this.stepAvgs.push(stepAvg);
      console.log(
        `[BenchSuite] 生图第 ${i + 1}/${rounds} 轮完成：${(
          (Date.now() - roundStart) /
          1000
        ).toFixed(1)}s`,
      );
    }
  }

  // ── 汇总：跑分卡（口径 = perfScore §4.3，不造新公式）──
  private buildResult(score: PerfScoreCard): BenchmarkResult {
    const pssPeakKb = this.points.reduce((m, p) => Math.max(m, p.pssKb), 0);
    const temps = this.points.map(p => p.tempC).filter(t => t > 0);
    const tempRiseC =
      temps.length >= 2 ? temps[temps.length - 1] - temps[0] : 0;
    const stepAvg =
      this.stepAvgs.length > 0
        ? this.stepAvgs.reduce((a, b) => a + b, 0) / this.stepAvgs.length
        : undefined;
    return {
      // 旧协议字段占位（新协议不产合成负载数；卡片按 suiteCase 门控展示）
      config: {pp: 0, tg: 0, pl: 1, nr: 1, label: 'suite'},
      modelDesc: modelStore.activeModel?.name ?? '小黄鸡套件',
      modelSize: 0,
      modelNParams: 0,
      ppAvg: 0,
      ppStd: 0,
      tgAvg: 0,
      tgStd: 0,
      timestamp: new Date().toISOString(),
      modelId: modelStore.activeModel?.id ?? 'suite',
      modelName: modelStore.activeModel?.name ?? '小黄鸡套件',
      uuid: uuidv4(),
      wallTimeMs: Date.now() - this.suiteStartedAt,
      suiteCase: 'suite',
      suite: {
        tokAvg: this.llmResult.tokAvg,
        ttftMs: this.llmResult.ttftMs,
        stepAvg,
        pssPeakKb: pssPeakKb > 0 ? pssPeakKb : undefined,
        tempRiseC,
        score: {
          memory: score.memory,
          thermal: score.thermal,
          stability: score.stability,
          speed: score.speed,
          total: score.total,
        },
      },
    };
  }

  /** 一键跑分：三用例串行 + 自动导航 + 汇总落库（失败即诚实复位） */
  async start(nav: BenchNav): Promise<void> {
    if (benchmarkStore.suiteRunning) {
      return;
    }
    this.aborted = false;
    this.points = [];
    this.llmResult = {};
    this.stepAvgs = [];
    this.suiteStartedAt = Date.now();
    benchmarkStore.startSuite();
    try {
      await this.runLlmCase(nav);
      await this.runGenRounds(nav, 1);
      await this.runGenRounds(nav, BENCH_ENDURANCE_ROUNDS);
      // 分数口径 = perfScore（随采轨迹；无同模型基线时速度分项诚实为 null）
      const score = computePerfScore(this.points);
      benchmarkStore.addResult(this.buildResult(score));
      benchmarkStore.endSuite();
      nav.navigate(ROUTES.BENCHMARK);
    } catch (e) {
      this.stopSampling();
      benchmarkStore.failSuite(
        e instanceof Error ? e.message : '基准套件异常终止',
      );
      nav.navigate(ROUTES.BENCHMARK);
    }
  }
}

export const benchmarkOrchestrator = new BenchmarkOrchestrator();
