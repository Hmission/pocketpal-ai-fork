/**
 * imageGenQueueCore — 生图队列核心（任务购物车，IMAGEGEN_QUEUE_SPEC §四-§六）
 *
 * 纯逻辑、零 RN 依赖：状态机 / 入队幂等累加 / 编辑 / 删除 / 清空 /
 * 串行执行器（依赖注入 runDraw）。持久化经 QueuePersistence 接口注入，
 * 测试用内存实现即可全覆盖；真实实现 = imageGenQueueRepository +
 * imageGenStore.runGenTask（P0 下单模型执行，P1 上跨模型/cancel）。
 *
 * 状态机：idle(空) → planning(可编辑) → running(锁定) → stopping → planning | done
 */

export interface GenParamsSnapshot {
  prompt: string;
  negativePrompt: string;
  steps: number;
  cfg: number;
  /** 出图像素宽高（入队时由组件层解析最终值：Dream 画幅档 / SD 比例档） */
  width: number;
  height: number;
  ratio: string;
  /** 空→随机（入队时生成，保证多抽非重复） */
  seed: number;
  family: string;
  /** manifest id（加载/切换依据） */
  modelId: string;
  loraEnabled: boolean;
  loraMultiplier: number;
  /** SD 族：模型主文件绝对路径（入队时由组件层按 manifest 解析组装） */
  mainPath?: string;
  /** SD 族：伴侣文件路径（clipL/clipG/llm/vae） */
  companionPaths?: {clipL?: string; clipG?: string; llm?: string; vae?: string};
  /** SD 族：backend（manifest 单点决策，'CPU'|'OpenCL'|'Vulkan'） */
  backend?: string;
  /** SD 族：LoRA 文件绝对路径（loraEnabled 时） */
  loraPath?: string;
}

export interface QueueItem {
  /** 队列条目 id（区别于画廊 task_id） */
  id: string;
  snapshot: GenParamsSnapshot;
  /** 购物车抽数（相同快照去重累加） */
  total: number;
  /** 已完成抽数 */
  done: number;
  /** 失败抽数（含手动停止的未完成抽；文案层区分） */
  failed: number;
  /** pending=待执行/未终结（含被停止中断）；done/failed=整体终结 */
  status: 'pending' | 'done' | 'failed';
  createdAt: number;
  updatedAt: number;
}

export type QueueState = 'idle' | 'planning' | 'running' | 'stopping' | 'done';

/** 持久化接口（真实=WatermelonDB 仓库；测试=内存） */
export interface QueuePersistence {
  loadAll(): Promise<QueueItem[]>;
  upsert(item: QueueItem): Promise<void>;
  removeByQueueId(id: string): Promise<void>;
  clearAll(): Promise<void>;
}

/** 单抽执行依赖注入：真实=imageGenStore.runGenTask；测试=mock。
 *  返回 true=成功；false=失败（画廊侧已落 failTask，此处只计数）。 */
export type RunDrawFn = (
  snapshot: GenParamsSnapshot,
  queueItemId: string,
) => Promise<boolean>;

/** 执行钩子（UI 镜像同步点——2026-08-27 平板实机修正：
 *  镜像曾在每抽计数后停滞，面板进度不刷新） */
export interface QueueHooks {
  /** 条目切换 / 每抽计数后回调（store 注入 → syncQueueMirror） */
  onTick?: () => void;
}

const snapshotKey = (s: GenParamsSnapshot): string =>
  // 去重 key 归一 seed=0（“每次随机”语义）：多抽必须累加而非拆条。
  // 实机验收（2026-08-27 平板）修正：seed 随机曾导致同参数重复点击建独立条目。
  JSON.stringify({...s, seed: 0});

export class ImageGenQueueCore {
  items: QueueItem[] = [];
  state: QueueState = 'idle';
  /** 当前执行条目序号（0-based；无执行=-1） */
  position = -1;
  /** 队列累计完成抽数 */
  drawsDone = 0;
  /** 队列累计失败抽数（含手动停止） */
  drawsFailed = 0;
  /** 执行中停止请求（stop 置位，执行器每抽检查） */
  private stopRequested = false;
  private running = false;

  constructor(
    private persistence: QueuePersistence,
    private runDraw: RunDrawFn,
    private hooks: QueueHooks = {},
  ) {}

  /** 入队：相同快照（排除 seed 的全字段相等）→ 抽数累加；否则新条目（购物车语义） */
  enqueue(snapshot: GenParamsSnapshot): QueueItem {
    const key = snapshotKey(snapshot);
    const existing = this.items.find(
      it => it.status === 'pending' && snapshotKey(it.snapshot) === key,
    );
    if (existing) {
      existing.total++;
      existing.updatedAt = Date.now();
      void this.persist(existing);
      return existing;
    }
    const now = Date.now();
    const item: QueueItem = {
      id: `queue_${now}_${Math.floor(Math.random() * 1e6)}`,
      snapshot,
      total: 1,
      done: 0,
      failed: 0,
      status: 'pending',
      createdAt: now,
      updatedAt: now,
    };
    this.items.push(item);
    if (this.state === 'idle') {
      this.state = 'planning';
    }
    void this.persist(item);
    return item;
  }

  /** 编辑条目快照（仅 idle/planning/done 态；running/stopping 拒绝） */
  updateItem(id: string, snapshot: GenParamsSnapshot): boolean {
    if (this.state === 'running' || this.state === 'stopping') {
      return false;
    }
    const item = this.items.find(it => it.id === id);
    if (!item) {
      return false;
    }
    item.snapshot = snapshot;
    item.updatedAt = Date.now();
    if (this.state === 'done') {
      // 编辑终结条目 = 重新开放（回 planning 续跑/再抽）
      item.status = 'pending';
      this.state = 'planning';
    }
    void this.persist(item);
    return true;
  }

  /** 删除条目（仅 idle/planning/done 态；运行期拒绝——锋利：锁定即锁定） */
  async removeItem(id: string): Promise<void> {
    if (this.state === 'running' || this.state === 'stopping') {
      return;
    }
    const idx = this.items.findIndex(it => it.id === id);
    if (idx < 0) {
      return;
    }
    this.items.splice(idx, 1);
    if (this.items.length === 0) {
      this.state = 'idle';
    }
    await this.persistence.removeByQueueId(id);
  }

  /** 清空队列（仅 idle/planning/done 态） */
  async clear(): Promise<void> {
    if (this.state === 'running' || this.state === 'stopping') {
      return;
    }
    this.items = [];
    this.state = 'idle';
    this.drawsDone = 0;
    this.drawsFailed = 0;
    await this.persistence.clearAll();
  }

  /** 水合（app 启动）：loadAll → planning（state 不持久化，统一回可编辑） */
  async hydrate(): Promise<void> {
    const rows = await this.persistence.loadAll();
    this.items = rows;
    this.state = rows.length > 0 ? 'planning' : 'idle';
    this.drawsDone = rows.reduce((a, b) => a + b.done, 0);
    this.drawsFailed = rows.reduce((a, b) => a + b.failed, 0);
  }

  /** 队列累计总抽数（派生） */
  get totalDraws(): number {
    return this.items.reduce((a, b) => a + (b.total - b.done - b.failed), 0);
  }

  /** 汇总（队列完成后展示：成功/失败/总数） */
  get summary(): {success: number; failed: number; total: number} {
    return {
      success: this.drawsDone,
      failed: this.drawsFailed,
      total: this.drawsDone + this.drawsFailed,
    };
  }

  /** 开始执行：串行消费全部 pending 条目（防重入；空队列拒绝） */
  async start(): Promise<void> {
    if (this.running) {
      return;
    }
    if (this.items.every(it => it.status !== 'pending')) {
      return;
    }
    this.running = true;
    this.stopRequested = false;
    this.state = 'running';
    this.drawsDone = 0;
    this.drawsFailed = 0;
    try {
      for (let i = 0; i < this.items.length && this.running; i++) {
        const item = this.items[i]!;
        if (item.status !== 'pending') {
          continue;
        }
        this.position = i;
        this.hooks.onTick?.();
        // 条目内逐抽执行（支持中途 stop → 在途抽不计数，剩余抽数保留）
        while (
          item.done + item.failed < item.total &&
          this.running &&
          !this.stopRequested
        ) {
          const ok = await this.runDraw(item.snapshot, item.id);
          if (this.stopRequested) {
            break; // 停止：在途抽不计数（抽数保留，回 planning 续跑）
          }
          if (ok) {
            item.done++;
            this.drawsDone++;
          } else {
            item.failed++;
            this.drawsFailed++;
          }
          item.updatedAt = Date.now();
          void this.persist(item);
          this.hooks.onTick?.();
        }
        // 条目整体终结判定（停止中断的条目保持 pending 续跑）
        if (!this.stopRequested && item.done + item.failed >= item.total) {
          item.status = item.failed > 0 ? 'failed' : 'done';
          void this.persist(item);
        }
        if (this.stopRequested) {
          break; // 提前跳出外层：不再遍历后续条目
        }
      }
    } finally {
      this.running = false;
      this.position = -1;
      if (this.stopRequested) {
        this.stopRequested = false;
        this.state = 'planning';
      } else {
        this.state = 'done';
      }
    }
  }

  /** 停止：置位停止请求 → 在途 runDraw 应被 native cancel 快速返回 false；
   *  循环退出 → 回 planning（条目保持 pending，剩余抽数保留）。幂等。 */
  async stop(): Promise<void> {
    if (!this.running || this.state !== 'running') {
      return;
    }
    this.stopRequested = true;
    this.state = 'stopping';
    // 等待执行器循环退出（runDraw 在途被取消后本函数 resolve）
    while (this.running) {
      await new Promise(r => setTimeout(r, 50));
    }
  }

  private async persist(item: QueueItem): Promise<void> {
    try {
      await this.persistence.upsert(item);
    } catch (e) {
      console.warn('[ImageGenQueueCore] persist failed:', e);
    }
  }
}
