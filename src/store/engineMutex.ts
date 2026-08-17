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
   */
  acquire(kind: EngineKind): Promise<void> {
    const prev = this.acquiring;
    this.acquiring = (async () => {
      await prev;
      for (const [a, b] of EXCLUSIVE_PAIRS) {
        const other = a === kind ? b : b === kind ? a : null;
        if (other && this.current === other) {
          const rel = this.releasers[other];
          if (rel) {
            await rel();
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
