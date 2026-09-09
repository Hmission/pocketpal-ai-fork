import {Q} from '@nozbe/watermelondb';

import {database} from '../database';
import {ImageGenQueue} from '../database';
import type {QueueItem, GenParamsSnapshot} from '../store/imageGenQueueCore';
import {prepareSharedStorage, scheduleDbSnapshot} from '../utils/paths';

/**
 * ImageGenQueueRepository — 生图队列条目仓库（任务购物车，IMAGEGEN_QUEUE_SPEC §九）。
 * 对齐 ImageGenTaskRepository 模式：ensureReady 先过 prepareSharedStorage
 * （私有库首次打开前恢复共享快照，保证 B14 恢复不失效）。
 */
class ImageGenQueueRepository {
  private ready: Promise<void> | null = null;

  ensureReady(): Promise<void> {
    if (!this.ready) {
      this.ready = prepareSharedStorage();
    }
    return this.ready;
  }

  /** 全量读取（水合源；队列顺序 = 入队序） */
  async loadAll(): Promise<QueueItem[]> {
    await this.ensureReady();
    const rows = await database.collections
      .get<ImageGenQueue>('image_gen_queue')
      .query(Q.sortBy('created_at', Q.asc))
      .fetch();
    return rows.map(toEntry);
  }

  /** 创建或更新条目，**返回权威行 id**（入队/编辑/抽数变化后调用；create 必须在 Writer 内）。
   *
   * 为何返回值是契约的一部分（§174.3 / 项 46）：WatermelonDB 不给前端自造 id—
   * `Model.id` 只有 getter，无 setter；自定义 id 只能走 `_setRaw` / dirtyRaw 这类内部
   * 口子。旧实现返回 void，调用方拿不到真实行 id → 永远按幽灵 id 查不到 →
   * 每次 persist 都 create 一行（实机：91 抽跑出 120 行，重启即复活）。
   *
   * 失败一律外抛，由 `ImageGenQueueCore.persist()` 统一收口（以前本层自吞，
   * 与上层那层 catch 叠成两层——只会把克隆拖得更久，不会发现问题）。
   */
  async upsert(entry: QueueItem): Promise<string> {
    await this.ensureReady();
    const coll = database.collections.get<ImageGenQueue>('image_gen_queue');
    const existing = await coll.query(Q.where('id', entry.id)).fetch();
    let rowId = entry.id;
    await database.write(async () => {
      if (existing.length > 0) {
        // WatermelonDB 铁律：修改既有记录必须 record.update()（直接赋值抛
        // “Not allowed to change record”——2026-08-27 平板实机取证：
        // 队列计数从未真正落库，重启恢复会失效）
        await existing[0]!.update(record => applyEntry(record, entry));
        rowId = existing[0]!.id;
      } else {
        const created = await coll.create(record => applyEntry(record, entry));
        // WM 自生成的行 id：以前这个值被丢掉，就是克隆缺陷的根（项 46）
        rowId = created.id;
      }
    });
    scheduleDbSnapshot(); // 队列也触发 B14 快照（与画廊任务同等级保护）
    return rowId;
  }

  /** 按队列条目 id 删除（removeItem） */
  async removeByQueueId(queueId: string): Promise<void> {
    await this.ensureReady();
    try {
      const rows = await database.collections
        .get<ImageGenQueue>('image_gen_queue')
        .query(Q.where('id', queueId))
        .fetch();
      await database.write(async () => {
        for (const row of rows) {
          await row.destroyPermanently();
        }
      });
      scheduleDbSnapshot();
    } catch (e) {
      console.error('[ImageGenQueueRepository] removeByQueueId failed:', e);
    }
  }

  /** 清空全表（clear 队列） */
  async clearAll(): Promise<void> {
    await this.ensureReady();
    try {
      const rows = await database.collections
        .get<ImageGenQueue>('image_gen_queue')
        .query()
        .fetch();
      await database.write(async () => {
        for (const row of rows) {
          await row.destroyPermanently();
        }
      });
      scheduleDbSnapshot();
    } catch (e) {
      console.error('[ImageGenQueueRepository] clearAll failed:', e);
    }
  }
}

export const imageGenQueueRepository = new ImageGenQueueRepository();

function toEntry(row: ImageGenQueue): QueueItem {
  return {
    id: row.id,
    snapshot: {
      prompt: row.prompt,
      negativePrompt: row.negativePrompt,
      steps: row.steps,
      cfg: row.cfg,
      width: row.width,
      height: row.height,
      ratio: row.ratio,
      seed: row.seed,
      family: row.family,
      modelId: row.modelId,
      loraEnabled: row.loraEnabled,
      loraMultiplier: row.loraMultiplier,
      mainPath: row.mainPath ?? undefined,
      // 类型取自队列核心（单点）：不再在本文件重复内联字段表——
      // 历史上新增一个槽位要同步 manifest/store/queueCore/本处四处内联类型。
      companionPaths: row.companionPaths
        ? (JSON.parse(row.companionPaths) as NonNullable<
            GenParamsSnapshot['companionPaths']
          >)
        : undefined,
      backend: row.backend ?? undefined,
      loraPath: row.loraPath ?? undefined,
      // 视频族执行参数（缺省 = 图片任务；自包含快照铁律同 mainPath/backend）
      videoFrames: row.videoFrames ?? undefined,
      videoFps: row.videoFps ?? undefined,
    },
    total: row.total,
    done: row.done,
    failed: row.failed,
    status: (row.status as QueueItem['status']) ?? 'pending',
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function applyEntry(record: ImageGenQueue, e: QueueItem): void {
  record.prompt = e.snapshot.prompt;
  record.negativePrompt = e.snapshot.negativePrompt;
  record.steps = e.snapshot.steps;
  record.cfg = e.snapshot.cfg;
  record.width = e.snapshot.width;
  record.height = e.snapshot.height;
  record.ratio = e.snapshot.ratio;
  record.seed = e.snapshot.seed;
  record.family = e.snapshot.family;
  record.modelId = e.snapshot.modelId;
  record.loraEnabled = e.snapshot.loraEnabled;
  record.loraMultiplier = e.snapshot.loraMultiplier;
  record.mainPath = e.snapshot.mainPath ?? null;
  record.companionPaths = e.snapshot.companionPaths
    ? JSON.stringify(e.snapshot.companionPaths)
    : null;
  record.backend = e.snapshot.backend ?? null;
  record.loraPath = e.snapshot.loraPath ?? null;
  record.videoFrames = e.snapshot.videoFrames ?? null;
  record.videoFps = e.snapshot.videoFps ?? null;
  record.total = e.total;
  record.done = e.done;
  record.failed = e.failed;
  record.status = e.status;
  record.createdAt = e.createdAt;
  record.updatedAt = e.updatedAt;
}
