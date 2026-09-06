/**
 * phoneCall/turnTelemetry — 电话一轮的分段耗时遥测（PHONE_SPEC §19）。
 *
 * 为什么要有它：仓内此前只有**整链**耗时（「回复 8201ms/212 字」这类）与分段
 * 负载数据（PSS/CPU/温度），**没有** ASR 纯耗时与首 token 延迟。缺这三段数字，
 * 任何「要不要上流式 ASR / 端到端是否值得 / 该不该换更快的管家模型」的判断
 * 都只能靠感觉——W3 评估就是因为拿不到它们，只能给「收益尚未被证明」。
 *
 * 三条纪律：
 * 1. 纯 TS、零 RN 依赖、时钟可注入 → 单测用假时钟钉死算式。
 * 2. **只观测不改行为**：任何一段没采到就输出 null，绝不猜、不补默认值。
 * 3. 播报启动延迟（回复就绪 → 真正出声）**不在本模块**：那需要 TTS 层插桩点，
 *    为凑指标去 ttsStore 里加跨域回调会污染单一链路，已登记为待办（§19.3）。
 */

export interface PhoneTurnSample {
  /** 录音停止 → 转写返回：ASR 纯耗时 */
  asrMs: number | null;
  /** 进入 awaiting_reply → 首个内容 token 到达：首 token 延迟 */
  firstTokenMs: number | null;
  /** 录音停止 → 本轮收口：整轮耗时 */
  turnTotalMs: number | null;
}

export class PhoneTurnTelemetry {
  private readonly now: () => number;
  private turnStartAt = 0;
  private asrDoneAt = 0;
  private replyStartedAt = 0;
  private open = false;

  constructor(now: () => number = () => Date.now()) {
    this.now = now;
  }

  /** 一轮开始（= 松手停止录音，进入转写）。重入安全：直接覆盖上一轮。 */
  begin(): void {
    this.turnStartAt = this.now();
    this.asrDoneAt = 0;
    this.replyStartedAt = 0;
    this.open = true;
  }

  /** 转写返回（无论成功/空文本/失败都可打点，耗时本身是事实）。 */
  markAsrDone(): void {
    if (this.open && this.asrDoneAt === 0) {
      this.asrDoneAt = this.now();
    }
  }

  /** 首个内容 token 到达 / 落流回复开始。 */
  markReplyStarted(): void {
    if (this.open && this.replyStartedAt === 0) {
      this.replyStartedAt = this.now();
    }
  }

  /**
   * 一轮收口 → 输出一条结构化日志。
   * 未 begin、或已被下一轮覆盖时静默返回，不打半截数字。
   */
  endAndReport(): PhoneTurnSample | null {
    if (!this.open || this.turnStartAt === 0) {
      this.open = false;
      return null;
    }
    const end = this.now();
    const sample: PhoneTurnSample = {
      asrMs: this.asrDoneAt > 0 ? this.asrDoneAt - this.turnStartAt : null,
      firstTokenMs:
        this.replyStartedAt > 0 && this.asrDoneAt > 0
          ? this.replyStartedAt - this.asrDoneAt
          : null,
      turnTotalMs: end - this.turnStartAt,
    };
    this.open = false;
    console.log(
      `[phoneTurnPerf] asr=${fmt(sample.asrMs)} firstToken=${fmt(
        sample.firstTokenMs,
      )} turnTotal=${fmt(sample.turnTotalMs)}`,
    );
    return sample;
  }

  /** 挂断/作废时清态，避免把上一轮数字串到下一轮。 */
  reset(): void {
    this.open = false;
    this.turnStartAt = 0;
    this.asrDoneAt = 0;
    this.replyStartedAt = 0;
  }
}

const fmt = (ms: number | null): string => (ms === null ? 'n/a' : `${ms}ms`);

export const phoneTurnTelemetry = new PhoneTurnTelemetry();
