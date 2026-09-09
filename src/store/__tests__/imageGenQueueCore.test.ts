import {
  GenParamsSnapshot,
  ImageGenQueueCore,
  QueueItem,
  QueuePersistence,
} from '../imageGenQueueCore';

/** 内存持久化（测试注入；真实=WatermelonDB 仓库） */
class MemoryPersistence implements QueuePersistence {
  rows = new Map<string, QueueItem>();

  async loadAll(): Promise<QueueItem[]> {
    return [...this.rows.values()].sort((a, b) => a.createdAt - b.createdAt);
  }

  async upsert(item: QueueItem): Promise<string> {
    this.rows.set(item.id, {...item, snapshot: {...item.snapshot}});
    return item.id;
  }

  async removeByQueueId(id: string): Promise<void> {
    this.rows.delete(id);
  }

  async clearAll(): Promise<void> {
    this.rows.clear();
  }
}

function makeSnapshot(
  overrides: Partial<GenParamsSnapshot> = {},
): GenParamsSnapshot {
  return {
    prompt: '一只猫',
    negativePrompt: '',
    steps: 4,
    cfg: 1,
    width: 1024,
    height: 1024,
    ratio: '1:1',
    seed: 42,
    family: 'dreamlite',
    modelId: 'dreamlite',
    loraEnabled: false,
    loraMultiplier: 1,
    ...overrides,
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}

describe('ImageGenQueueCore', () => {
  it('入队：不同快照 → 独立条目；相同快照 → 抽数累加（购物车语义）', () => {
    const core = new ImageGenQueueCore(
      new MemoryPersistence(),
      async () => true,
    );
    core.enqueue(makeSnapshot({prompt: '猫'}));
    core.enqueue(makeSnapshot({prompt: '猫'})); // 相同（全字段相等）
    core.enqueue(makeSnapshot({prompt: '狗', seed: 7}));
    // 2026-08-27 实机验收修正：仅 seed 不同的快照视为同一任务（seed=0 语义
    // “每次随机”——多抽必须累加而非拆条，执行时单抽随机化）
    core.enqueue(makeSnapshot({prompt: '狗', seed: 888}));

    expect(core.items).toHaveLength(2);
    expect(core.items[0]!.total).toBe(2);
    expect(core.items[1]!.total).toBe(2); // 狗条目不因 seed 不同拆条
    expect(core.state).toBe('planning');
  });

  it('入队后空队列回升 planning；删光回 idle', async () => {
    const core = new ImageGenQueueCore(
      new MemoryPersistence(),
      async () => true,
    );
    expect(core.state).toBe('idle');
    const item = core.enqueue(makeSnapshot());
    expect(core.state).toBe('planning');
    await core.removeItem(item.id);
    expect(core.items).toHaveLength(0);
    expect(core.state).toBe('idle');
  });

  it('编辑：planning 态可改快照；运行态拒绝', async () => {
    const core = new ImageGenQueueCore(
      new MemoryPersistence(),
      async () => true,
    );
    const item = core.enqueue(makeSnapshot());
    const ok = core.updateItem(item.id, makeSnapshot({prompt: '改过的'}));
    expect(ok).toBe(true);
    expect(core.items[0]!.snapshot.prompt).toBe('改过的');

    // 运行态拒绝编辑
    let release!: () => void;
    const gate = new Promise<void>(r => (release = r));
    const core2 = new ImageGenQueueCore(new MemoryPersistence(), async () => {
      await gate;
      return true;
    });
    const item2 = core2.enqueue(makeSnapshot());
    const runP = core2.start();
    await sleep(10); // 确保进入 running
    expect(core2.state).toBe('running');
    expect(core2.updateItem(item2.id, makeSnapshot({prompt: 'x'}))).toBe(false);
    release();
    await runP;
  });

  it('编辑已终结条目 → 回 planning 再开放', () => {
    const core = new ImageGenQueueCore(
      new MemoryPersistence(),
      async () => true,
    );
    const item = core.enqueue(makeSnapshot());
    // 直接置为终结态模拟 done（编辑回开放语义）
    item.status = 'done';
    item.done = item.total;
    core.state = 'done';
    const ok = core.updateItem(item.id, makeSnapshot({prompt: '再抽'}));
    expect(ok).toBe(true);
    expect(core.state).toBe('planning');
    expect(core.items[0]!.status).toBe('pending');
  });

  it('执行器：全部成功 → done 汇总正确', async () => {
    const calls: string[] = [];
    const core = new ImageGenQueueCore(new MemoryPersistence(), async s => {
      calls.push(s.prompt);
      return true;
    });
    core.enqueue(makeSnapshot({prompt: 'A'}));
    core.enqueue(makeSnapshot({prompt: 'B'}));
    core.enqueue(makeSnapshot({prompt: 'A'})); // 累加到 A → A:2 B:1

    await core.start();

    expect(calls).toEqual(['A', 'A', 'B']);
    expect(core.state).toBe('done');
    expect(core.items.map(i => i.status)).toEqual(['done', 'done']);
    expect(core.summary).toEqual({success: 3, failed: 0, total: 3});
  });

  it('执行器：失败继续（队列原子语义，不重试不中止）', async () => {
    const core = new ImageGenQueueCore(
      new MemoryPersistence(),
      async s => s.prompt !== '坏', // true=成功；'坏' 失败
    );
    core.enqueue(makeSnapshot({prompt: '好'}));
    core.enqueue(makeSnapshot({prompt: '坏'}));
    core.enqueue(makeSnapshot({prompt: '好2', seed: 9}));

    await core.start();

    expect(core.state).toBe('done');
    expect(core.items[0]!.status).toBe('done');
    expect(core.items[1]!.status).toBe('failed'); // 有失败痕迹
    expect(core.items[1]!.failed).toBe(1);
    expect(core.items[2]!.status).toBe('done');
    expect(core.summary).toEqual({success: 2, failed: 1, total: 3});
  });

  it('停止：在途抽不计数（抽数保留）、条目保持 pending、回 planning 可续跑', async () => {
    let release!: () => void;
    const gate = new Promise<void>(r => (release = r));
    let callCount = 0;
    let firstCall = true;
    const core = new ImageGenQueueCore(new MemoryPersistence(), async () => {
      callCount++;
      if (firstCall) {
        firstCall = false;
        await gate; // 仅第一抽卡住直到停止
        return false; // 取消语义：native cancel 后 generate 返回 null → false
      }
      return true; // 续跑全部成功
    });
    core.enqueue(makeSnapshot({prompt: 'A'}));
    core.enqueue(makeSnapshot({prompt: 'B'}));

    const runP = core.start();
    await sleep(10);
    expect(core.state).toBe('running');

    const stopP = core.stop();
    expect(core.state).toBe('stopping');
    release(); // 在途抽被取消返回
    await Promise.all([runP, stopP]);

    expect(callCount).toBe(1); // 停止后不再执行任何抽（含后续条目）
    expect(core.state).toBe('planning');
    expect(core.items[0]!.status).toBe('pending'); // 未终结，可续跑
    expect(core.items[0]!.done).toBe(0);
    expect(core.items[0]!.failed).toBe(0); // 在途抽不消耗抽数
    expect(core.items[1]!.status).toBe('pending'); // 后续条目原封不动
    // 续跑验证：重新 start 完整消费
    await core.start();
    expect(core.state).toBe('done');
    expect(core.summary.success).toBe(2);
  });

  it('停止幂等：非 running 态 stop 无副作用', async () => {
    const core = new ImageGenQueueCore(
      new MemoryPersistence(),
      async () => true,
    );
    await core.stop();
    expect(core.state).toBe('idle');
  });

  it('空队列 start 拒绝；running 期 start 防重入', async () => {
    const core = new ImageGenQueueCore(
      new MemoryPersistence(),
      async () => true,
    );
    await core.start();
    expect(core.state).toBe('idle'); // 空队列不进入 running

    let release!: () => void;
    const gate = new Promise<void>(r => (release = r));
    const core2 = new ImageGenQueueCore(new MemoryPersistence(), async () => {
      await gate;
      return true;
    });
    core2.enqueue(makeSnapshot());
    const p1 = core2.start();
    await sleep(10);
    await core2.start(); // 重入被忽略
    release();
    await p1;
    expect(core2.state).toBe('done');
  });

  it('水合：loadAll → planning，抽数汇总恢复', async () => {
    const mem = new MemoryPersistence();
    const seed = new ImageGenQueueCore(mem, async () => true);
    const item = seed.enqueue(makeSnapshot());
    item.done = 1;
    item.total = 3;
    item.status = 'pending';
    await mem.upsert(item);

    const core = new ImageGenQueueCore(mem, async () => true);
    await core.hydrate();
    expect(core.items).toHaveLength(1);
    expect(core.state).toBe('planning');
    expect(core.drawsDone).toBe(1);
    expect(core.totalDraws).toBe(2); // 剩余 3-1 抽
  });

  it('清空：条目与汇总归零', async () => {
    const mem = new MemoryPersistence();
    const core = new ImageGenQueueCore(mem, async () => true);
    core.enqueue(makeSnapshot());
    core.enqueue(makeSnapshot({prompt: 'B', seed: 3}));
    await core.clear();
    expect(core.items).toHaveLength(0);
    expect(core.state).toBe('idle');
    expect(await mem.loadAll()).toHaveLength(0);
  });

  /**
   * 2026-09-07 全量排查收口（W1）：stop() 旧写法是 `while (running) await
   * setTimeout(50)` 忙等——既费 CPU，又把「native 不返回」变成永久挂起的
   * 静默故障。现改由执行器 finally 唤醒。这两例钉的是「何时才允许说已停止」。
   */
  it('stop() 由执行器出口唤醒：在途抽未返回前不得假称已停止', async () => {
    let release!: () => void;
    const core = new ImageGenQueueCore(new MemoryPersistence(), async () => {
      await new Promise<void>(r => {
        release = r;
      });
      return true;
    });
    core.enqueue(makeSnapshot());
    const startP = core.start();
    await sleep(5);
    expect(core.state).toBe('running');

    const stopP = core.stop();
    let stopSettled = false;
    void stopP.then(() => {
      stopSettled = true;
    });
    await sleep(10);
    expect(core.state).toBe('stopping');
    expect(stopSettled).toBe(false); // 引擎还没交出控制权，不能说「已停止」

    release();
    await stopP;
    expect(stopSettled).toBe(true);
    expect(core.state).toBe('planning');
    await startP;
  });

  it('执行器已结束后调 stop()：立即返回，不留永不唤醒的 waiter', async () => {
    const core = new ImageGenQueueCore(
      new MemoryPersistence(),
      async () => true,
    );
    core.enqueue(makeSnapshot());
    await core.start();
    expect(core.state).toBe('done');
    // 走到 stop() 的 `!running` 前置分支；若此处去登记 waiter 就永远没人唤醒。
    await core.stop();
    expect(core.state).toBe('done');
  });
});

/**
 * 真实 WatermelonDB 仓库的形态：新建行会拿到**它自己的 id**（前端给的 id 不被沿用，
 * 因为 `Model.id` 只有 getter）。项 46 的克隆缺陷正是这个事实 + 旧契约返回 void
 * 的组合：调用方拿着幽灵 id 再查→查不到→又 create。本替身就是为了把该事实
 * 钉进测试，防止有人改回“id 我说了算”的假想契约。
 */
class WmLikePersistence implements QueuePersistence {
  rows = new Map<string, QueueItem>();
  creates = 0;
  updates = 0;

  async loadAll(): Promise<QueueItem[]> {
    return [...this.rows.values()].sort((a, b) => a.createdAt - b.createdAt);
  }

  async upsert(item: QueueItem): Promise<string> {
    if (this.rows.has(item.id)) {
      this.updates += 1;
      this.rows.set(item.id, {...item, snapshot: {...item.snapshot}});
      return item.id;
    }
    this.creates += 1;
    const rowId = `wm_${this.creates}`;
    this.rows.set(rowId, {
      ...item,
      id: rowId,
      snapshot: {...item.snapshot},
    });
    return rowId;
  }

  async removeByQueueId(id: string): Promise<void> {
    this.rows.delete(id);
  }

  async clearAll(): Promise<void> {
    this.rows.clear();
  }
}

describe('项 46 回归：队条目持久层身份契约（不克隆）', () => {
  /**
   * 真机现场（§174.3）：连点 60 次“＋排队”→ 库里 59 行 `total=1..59` 克隆；
   * 执行 30 抽→又多 30 行 `total=60` 克隆。本例走同一个形状：同步连点三次。
   */
  it('同快照连点三次：持久层只落 1 行（1 次 create + 2 次 update）', async () => {
    const p = new WmLikePersistence();
    const core = new ImageGenQueueCore(p, async () => true);

    core.enqueue(makeSnapshot());
    core.enqueue(makeSnapshot());
    core.enqueue(makeSnapshot());
    // persist() 是 fire-and-forget（UI 不为此加 await）；链尾已覆盖前面所有笔
    await (core as unknown as {persistTail: Promise<void>}).persistTail;

    expect(core.items).toHaveLength(1);
    expect(core.items[0]!.total).toBe(3);
    expect(p.creates).toBe(1);
    expect(p.updates).toBe(2);
    expect(p.rows.size).toBe(1);
    // 采纳的是落库方给的真实行 id，不是前端自造的幽灵 id
    expect(core.items[0]!.id).toBe([...p.rows.keys()][0]);
    expect(core.items[0]!.id).not.toMatch(/^queue_/);
  });

  it('重启水合：仍是一行一项，不会被克隆复活', async () => {
    const p = new WmLikePersistence();
    const first = new ImageGenQueueCore(p, async () => true);
    first.enqueue(makeSnapshot());
    first.enqueue(makeSnapshot());
    first.enqueue(makeSnapshot());
    await (first as unknown as {persistTail: Promise<void>}).persistTail;

    // 杀进程重启：同一个持久层新建 core 并水合
    const revived = new ImageGenQueueCore(p, async () => true);
    await revived.hydrate();

    expect(revived.items).toHaveLength(1);
    expect(revived.items[0]!.total).toBe(3);
    expect(revived.totalDraws).toBe(3);
  });

  it('进度更新也不克隆：一抽完成后行数仍为 1', async () => {
    const p = new WmLikePersistence();
    const core = new ImageGenQueueCore(p, async () => true);
    core.enqueue(makeSnapshot());
    await (core as unknown as {persistTail: Promise<void>}).persistTail;
    expect(p.rows.size).toBe(1);

    await core.start();
    await (core as unknown as {persistTail: Promise<void>}).persistTail;

    expect(p.rows.size).toBe(1);
    expect(core.drawsDone).toBe(1);
  });
});
