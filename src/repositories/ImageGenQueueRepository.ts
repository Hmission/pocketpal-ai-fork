import {Q} from '@nozbe/watermelondb';

import {database} from '../database';
import {ImageGenQueue} from '../database';
import type {QueueItem} from '../store/imageGenQueueCore';
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

  /** 创建或更新条目（入队/编辑/抽数变化后调用；create 必须在 Writer 内） */
  async upsert(entry: QueueItem): Promise<void> {
    await this.ensureReady();
    try {
      const existing = await database.collections
        .get<ImageGenQueue>('image_gen_queue')
        .query(Q.where('id', entry.id))
        .fetch();
      await database.write(async () => {
        if (existing.length > 0) {
          // WatermelonDB 铁律：修改既有记录必须 record.update()（直接赋值抛
          // “Not allowed to change record”——2026-08-27 平板实机取证：
          // 队列计数从未真正落库，重启恢复会失效）
          await existing[0]!.update(record => applyEntry(record, entry));
        } else {
          await database.collections
            .get<ImageGenQueue>('image_gen_queue')
            .create(record => applyEntry(record, entry));
        }
      });
      scheduleDbSnapshot(); // 队列也触发 B14 快照（与画廊任务同等级保护）
    } catch (e) {
      console.error('[ImageGenQueueRepository] upsert failed:', e);
    }
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
      companionPaths: row.companionPaths
        ? (JSON.parse(row.companionPaths) as {
            clipL?: string;
            clipG?: string;
            llm?: string;
            vae?: string;
          })
        : undefined,
      backend: row.backend ?? undefined,
      loraPath: row.loraPath ?? undefined,
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
  record.total = e.total;
  record.done = e.done;
  record.failed = e.failed;
  record.status = e.status;
  record.createdAt = e.createdAt;
  record.updatedAt = e.updatedAt;
}
