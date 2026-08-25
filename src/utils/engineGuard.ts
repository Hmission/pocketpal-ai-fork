/**
 * EngineGuard — 推理串行化 + 冷却窗 + 重试（Exception in HostFunction 根治机制）
 *
 * llama.rn 原生 decode 按 context 单飞：上一次 completion 刚结束、
 * threadpool/KV 尚未收尾时立即发起下一次 → 抛 Exception in HostFunction
 * （即大王观察到的"冷却时间报错"）。
 *
 * 最佳实践（收敛于引擎单一出口，全 App 受益）：
 *   1. Promise 链串行化 —— 同 context 永不并发
 *   2. 完成后冷却窗（默认 400ms），期间横幅可见"引擎回温中…"
 *   3. HostFunction 异常退避 600ms 自动重试一次
 *   4. 仍失败则错误原样上抛，由卡片/横幅显示给用户（不静默）
 */
import {engineStatus, EngineKind} from '../store/engineStatus';

export const isCooldownError = (e: unknown): boolean =>
  /HostFunction/i.test(String((e as {message?: string})?.message ?? e));

const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms));

class EngineGuard {
  private chain: Promise<unknown> = Promise.resolve();
  private lastDoneAt = 0;

  constructor(
    private kind: EngineKind,
    private cooldownMs = 400,
  ) {}

  async run<T>(fn: () => Promise<T>): Promise<T> {
    const prev = this.chain;
    let release!: () => void;
    this.chain = new Promise<void>(r => (release = r));
    try {
      await prev.catch(() => {});
      // 冷却窗：距上次完成不足 cooldownMs 则等待，状态对用户可见
      const wait = this.lastDoneAt + this.cooldownMs - Date.now();
      if (wait > 0) {
        engineStatus.setPhase(this.kind, 'running', '引擎回温中…');
        await sleep(wait);
        engineStatus.setPhase(this.kind, 'idle');
      }
      try {
        return await fn();
      } catch (e) {
        if (isCooldownError(e)) {
          engineStatus.setPhase(this.kind, 'running', '引擎恢复中，重试…');
          await sleep(600);
          engineStatus.setPhase(this.kind, 'idle');
          return await fn();
        }
        throw e;
      }
    } finally {
      this.lastDoneAt = Date.now();
      release();
    }
  }
}

/** chat 大模型出口（LocalCompletionEngine / startImageCompletion 共用） */
export const chatEngineGuard = new EngineGuard('chat');
/** 管家模型出口（promptWriter 专用） */
export const prompterGuard = new EngineGuard('prompter');
