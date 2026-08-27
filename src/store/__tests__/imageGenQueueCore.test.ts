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

  async upsert(item: QueueItem): Promise<void> {
    this.rows.set(item.id, {...item, snapshot: {...item.snapshot}});
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
});
