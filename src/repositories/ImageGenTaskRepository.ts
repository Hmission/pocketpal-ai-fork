import {Q} from '@nozbe/watermelondb';

import {database} from '../database';
import {ImageGenTask} from '../database';
import type {GeneratedImage} from '../store';
import {prepareSharedStorage, scheduleDbSnapshot} from '../utils/paths';

/** 项41/§180 订正文案：§9.4 通用口径（旧行通道未知，不带括号原因——带原因即断言） */
const RECTIFIED_FAILURE_DETAIL = '本次生成未完成，请重试';

/**
 * ImageGenTaskRepository — 生图任务元数据仓库（B28）。
 * 对齐 ChatSessionRepository 模式：ensureReady 先过 prepareSharedStorage
 * （私有库首次打开前恢复共享快照，否则空库先建使 B14 恢复失效）。
 */
class ImageGenTaskRepository {
  private ready: Promise<void> | null = null;

  ensureReady(): Promise<void> {
    if (!this.ready) {
      this.ready = prepareSharedStorage();
    }
    return this.ready;
  }

  /** 全量读取（内存 history 水合源；ts 倒序与相册展示一致） */
  async loadAll(): Promise<GeneratedImage[]> {
    await this.ensureReady();
    const rows = await database.collections
      .get<ImageGenTask>('image_gen_tasks')
      .query()
      .fetch();
    return rows.map(row => toEntry(row)).sort((a, b) => b.ts - a.ts);
  }

  /** 创建任务条目（beginTask/pushFailedTask/recover 共用）；create 必须在 Writer 内 */
  async create(entry: GeneratedImage): Promise<void> {
    await this.ensureReady();
    try {
      await database.write(async () => {
        await database.collections
          .get<ImageGenTask>('image_gen_tasks')
          .create(record => applyEntry(record, entry));
      });
      scheduleDbSnapshot(); // B28：生图写入也触发 B14 快照（与聊天同等级保护）
    } catch (e) {
      console.error('[ImageGenTaskRepository] create failed:', e);
    }
  }

  /** 批量创建（recoverHistoryFromDisk/存量迁移；单次 write 事务） */
  async createBatch(entries: GeneratedImage[]): Promise<void> {
    if (entries.length === 0) {
      return;
    }
    await this.ensureReady();
    try {
      await database.write(async () => {
        for (const entry of entries) {
          await database.collections
            .get<ImageGenTask>('image_gen_tasks')
            .create(record => applyEntry(record, entry));
        }
      });
      scheduleDbSnapshot();
    } catch (e) {
      console.error('[ImageGenTaskRepository] createBatch failed:', e);
    }
  }

  /** 按业务 taskId 局部更新（finishTask/failTask）；update 必须在 Writer 内 */
  async patchByTaskId(
    taskId: string,
    patch: Partial<GeneratedImage>,
  ): Promise<void> {
    await this.ensureReady();
    try {
      const rows = await database.collections
        .get<ImageGenTask>('image_gen_tasks')
        .query(Q.where('task_id', taskId))
        .fetch();
      await database.write(async () => {
        for (const row of rows) {
          await row.update(record =>
            applyEntry(record, {...toEntry(row), ...patch}),
          );
        }
      });
      scheduleDbSnapshot();
    } catch (e) {
      console.error('[ImageGenTaskRepository] patch failed:', e);
    }
  }

  /**
   * 水合期一次性订正（项 41，§180）：历史旧失败文案「被强制退出」与 §9.4
   * 「只写可观察事实」相矛盾（§169：与 pidof 不变相矛盾）。订正为 §9.4
   * 通用口径「本次生成未完成，请重试」——旧行通道未知，带括号原因即断言。
   * 幂等：订正后不再匹配「强制退出」，二次运行 0 命中即跳过；无常驻迁移。
   * 回滚痕迹：每条订正前原值入日志（taskId + before → after），不落常驻表。
   * 返回订正条数（0 = 无存量）。
   */
  async rectifyLegacyFailureText(): Promise<number> {
    await this.ensureReady();
    try {
      const rows = await database.collections
        .get<ImageGenTask>('image_gen_tasks')
        .query()
        .fetch();
      const victims = rows.filter(r =>
        (r.errorDetail ?? '').includes('强制退出'),
      );
      if (victims.length === 0) {
        return 0;
      }
      await database.write(async () => {
        for (const row of victims) {
          const before = row.errorDetail ?? '';
          await row.update(record => {
            record.errorDetail = RECTIFIED_FAILURE_DETAIL;
          });
          console.info(
            `[ImageGenTaskRepository] rectify ${row.taskId}: ${JSON.stringify(before)} → ${JSON.stringify(RECTIFIED_FAILURE_DETAIL)}`,
          );
        }
      });
      scheduleDbSnapshot();
      return victims.length;
    } catch (e) {
      console.error('[ImageGenTaskRepository] rectify failed:', e);
      return 0;
    }
  }

  /** 按 uri 批量删除（deleteHistory） */
  async removeByUris(uris: string[]): Promise<void> {
    if (uris.length === 0) {
      return;
    }
    await this.ensureReady();
    try {
      const rows = await database.collections
        .get<ImageGenTask>('image_gen_tasks')
        .query(Q.where('uri', Q.oneOf(uris)))
        .fetch();
      await database.write(async () => {
        for (const row of rows) {
          await row.destroyPermanently();
        }
      });
      scheduleDbSnapshot();
    } catch (e) {
      console.error('[ImageGenTaskRepository] removeByUris failed:', e);
    }
  }

  /** 按 taskId 删除（deleteTask） */
  async removeByTaskId(taskId: string): Promise<void> {
    await this.ensureReady();
    try {
      const rows = await database.collections
        .get<ImageGenTask>('image_gen_tasks')
        .query(Q.where('task_id', taskId))
        .fetch();
      await database.write(async () => {
        for (const row of rows) {
          await row.destroyPermanently();
        }
      });
      scheduleDbSnapshot();
    } catch (e) {
      console.error('[ImageGenTaskRepository] removeByTaskId failed:', e);
    }
  }
}

function toEntry(row: ImageGenTask): GeneratedImage {
  return {
    uri: row.uri,
    prompt: row.prompt,
    seed: row.seed,
    ts: row.ts,
    width: row.width,
    height: row.height,
    steps: row.steps ?? undefined,
    cfg: row.cfg ?? undefined,
    family: row.family ?? undefined,
    kind: (row.kind as GeneratedImage['kind']) ?? undefined,
    sourceUri: row.sourceUri ?? undefined,
    durationMs: row.durationMs ?? undefined,
    modelLabel: row.modelLabel ?? undefined,
    taskId: row.taskId,
    status: (row.status as GeneratedImage['status']) ?? 'success',
    errorSummary: row.errorSummary ?? undefined,
    errorDetail: row.errorDetail ?? undefined,
    // 视频产物身份（kind='video'）：uri 存封面帧，目录/帧数/fps 单独列——预览与时长角标的真值源
    videoDir: row.videoDir ?? undefined,
    videoFrames: row.videoFrames ?? undefined,
    videoFps: row.videoFps ?? undefined,
  };
}

function applyEntry(record: ImageGenTask, e: GeneratedImage): void {
  record.uri = e.uri;
  record.prompt = e.prompt;
  record.seed = e.seed;
  record.ts = e.ts;
  record.width = e.width;
  record.height = e.height;
  record.steps = e.steps ?? null;
  record.cfg = e.cfg ?? null;
  record.family = e.family ?? null;
  record.kind = e.kind ?? null;
  record.sourceUri = e.sourceUri ?? null;
  record.durationMs = e.durationMs ?? null;
  record.modelLabel = e.modelLabel ?? null;
  record.taskId = e.taskId;
  record.status = e.status;
  record.errorSummary = e.errorSummary ?? null;
  record.errorDetail = e.errorDetail ?? null;
  record.videoDir = e.videoDir ?? null;
  record.videoFrames = e.videoFrames ?? null;
  record.videoFps = e.videoFps ?? null;
  record.createdAt = e.ts;
}

export const imageGenTaskRepository = new ImageGenTaskRepository();
