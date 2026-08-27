import {Model} from '@nozbe/watermelondb';
import {field, text} from '@nozbe/watermelondb/decorators';

/**
 * ImageGenQueue — 生图队列条目（任务购物车，IMAGEGEN_QUEUE_SPEC v0.1）。
 * 对齐 ImageGenTask 模式落 WatermelonDB，自动获得 B14 整库快照保护。
 * 业务唯一键 id（队列条目 id，区别于画廊 task_id）；快照字段入队冻结。
 */
export default class ImageGenQueue extends Model {
  static table = 'image_gen_queue';

  @text('prompt') prompt!: string;
  @text('negative_prompt') negativePrompt!: string;
  @field('steps') steps!: number;
  @field('cfg') cfg!: number;
  @field('width') width!: number;
  @field('height') height!: number;
  @text('ratio') ratio!: string;
  @field('seed') seed!: number;
  @text('family') family!: string;
  @text('model_id') modelId!: string;
  @field('lora_enabled') loraEnabled!: boolean;
  @field('lora_multiplier') loraMultiplier!: number;
  /** SD 族执行指令（自包含快照，执行零外部依赖） */
  @text('main_path') mainPath!: string | null;
  @text('companion_paths') companionPaths!: string | null; // JSON
  @text('backend') backend!: string | null;
  @text('lora_path') loraPath!: string | null;
  /** 购物车抽数（相同快照去重累加） */
  @field('total') total!: number;
  /** 已完成抽数 */
  @field('done') done!: number;
  /** 失败抽数 */
  @field('failed') failed!: number;
  /** 'pending' | 'done' | 'failed'（done/failed = 条目整体终结） */
  @text('status') status!: string;
  @field('created_at') createdAt!: number;
  @field('updated_at') updatedAt!: number;
}
