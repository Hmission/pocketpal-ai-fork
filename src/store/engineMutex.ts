/**
 * EngineMutex — 引擎互斥协调器（chat vs image）
 *
 * 端侧内存有限，llama.cpp（聊天）与 stable-diffusion.cpp（生图）不能同时常驻。
 * 任何引擎加载前 acquire：若对方引擎在用，先自动释放。
 *
 * 回调注入模式：各 store register 自己的 releaser，EngineMutex 不反向引用 store
 * → 无循环依赖。串行化防竞态。
 */
type EngineKind = 'chat' | 'image';
type Releaser = () => Promise<void>;

class EngineMutex {
  private current: EngineKind | null = null;
  private releasers: Partial<Record<EngineKind, Releaser>> = {};
  private acquiring: Promise<void> = Promise.resolve();

  /** 各引擎启动时注册自己的卸载器 */
  register(kind: EngineKind, releaser: Releaser) {
    this.releasers[kind] = releaser;
  }

  /** 获取引擎使用权：若对方在用，先释放。串行化，last-one-wins 由调用方自管。 */
  acquire(kind: EngineKind): Promise<void> {
    const prev = this.acquiring;
    this.acquiring = (async () => {
      await prev;
      const other: EngineKind = kind === 'chat' ? 'image' : 'chat';
      if (this.current === other) {
        const rel = this.releasers[other];
        if (rel) {
          await rel();
        }
        this.current = null;
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
