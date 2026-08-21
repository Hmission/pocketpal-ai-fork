import {Model} from '@nozbe/watermelondb';
import {field, text} from '@nozbe/watermelondb/decorators';

/**
 * ImageGenTask — 生图任务元数据（B28：对齐聊天存储架构落 WatermelonDB，
 * 自动获得 B14 整库快照保护）。业务唯一键 task_id（与 history 逻辑一致）。
 */
export default class ImageGenTask extends Model {
  static table = 'image_gen_tasks';

  @text('uri') uri!: string;
  @text('prompt') prompt!: string;
  @field('seed') seed!: number;
  @field('ts') ts!: number;
  @field('width') width!: number;
  @field('height') height!: number;
  @field('steps') steps!: number | null;
  @field('cfg') cfg!: number | null;
  @text('family') family!: string | null;
  @text('kind') kind!: string | null;
  @text('source_uri') sourceUri!: string | null;
  @field('duration_ms') durationMs!: number | null;
  @text('model_label') modelLabel!: string | null;
  @text('task_id') taskId!: string;
  @text('status') status!: string;
  @text('error_summary') errorSummary!: string | null;
  @text('error_detail') errorDetail!: string | null;
  @field('created_at') createdAt!: number;
}
