/**
 * EngineMutex — 引擎互斥协调器（prompter / chat / image 三槽）
 *
 * 端侧内存有限，引擎按 SPEC §9.2 三槽互斥矩阵调度：
 *   prompter（管家 1B）↔ chat（大模型）互斥  —— 同属 llama.rn 文本槽单实例
 *   chat ↔ image（生图）互斥                 —— 大模型与生图引擎不同时常驻
 *   prompter ↔ image 共存                    —— 生图扩写提示词必需（唯一价值共存）
 *
 * 回调注入模式：各引擎 register 自己的 releaser，EngineMutex 不反向引用 store
 * → 无循环依赖。串行化防竞态。
 */
type EngineKind = 'prompter' | 'chat' | 'image';
type Releaser = () => Promise<void>;

/** 互斥对（SPEC §9.2）：prompter↔chat 文本槽单实例；chat↔image 内存账本 */
const EXCLUSIVE_PAIRS: ReadonlyArray<readonly [EngineKind, EngineKind]> = [
  ['prompter', 'chat'],
  ['chat', 'image'],
];

/** 释放互斥引擎的超时（复查 2026-08-20）：
 * releaser 挂起（如 native 卸载卡死）时若无限等待，后续 acquire 永久阻塞——
 * 生图「点出图无反应」的运行时根因候选之一。超时显式失败，不静默。 */
const RELEASE_TIMEOUT_MS = 30_000;

function withTimeout<T>(p: Promise<T>, ms: number, msg: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(msg)), ms);
    p.then(
      v => {
        clearTimeout(t);
        resolve(v);
      },
      e => {
        clearTimeout(t);
        reject(e);
      },
    );
  });
}

class EngineMutex {
  private current: EngineKind | null = null;
  private releasers: Partial<Record<EngineKind, Releaser>> = {};
  private acquiring: Promise<void> = Promise.resolve();

  /** 各引擎启动时注册自己的卸载器 */
  register(kind: EngineKind, releaser: Releaser) {
    this.releasers[kind] = releaser;
  }

  /**
   * 获取引擎使用权：按互斥矩阵释放所有与目标互斥的引擎，然后占用目标。
   * 串行化，last-one-wins 由调用方自管。
   * 释放超时 → 置空闲并抛错给当前调用方（显式失败）；链自愈——
   * 前一个 acquire 的失败不阻塞后续（try/catch 吞 prev）。
   */
  acquire(kind: EngineKind): Promise<void> {
    const prev = this.acquiring;
    this.acquiring = (async () => {
      try {
        await prev;
      } catch {
        // 前一个 acquire 已失败（释放超时）：本 acquire 不继承错误，继续执行
      }
      for (const [a, b] of EXCLUSIVE_PAIRS) {
        const other = a === kind ? b : b === kind ? a : null;
        if (other && this.current === other) {
          const rel = this.releasers[other];
          if (rel) {
            try {
              await withTimeout(
                rel(),
                RELEASE_TIMEOUT_MS,
                `${other} 引擎释放超时（30s），请重启应用重试`,
              );
            } catch (e) {
              // 宁可显式失败也不永久挂起；置空闲避免下次 acquire 再卡
              this.current = null;
              throw e;
            }
          }
          this.current = null;
        }
      }
      this.current = kind;
    })();
    return this.acquiring;
  }

  /** 引擎主动卸载后调用，标记空闲 */
  release() {
    this.current = null;
  }

  get active(): EngineKind | null {
    return this.current;
  }
}

export const engineMutex = new EngineMutex();
