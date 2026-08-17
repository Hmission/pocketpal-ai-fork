/**
 * modelStoreMethods/index — ModelStore 方法组聚合入口（models 域拆分 · 批次4 P3）
 *
 * ModelStore 肥组件（3671 行）按域分期拆分第一期：把自包含的方法组迁出
 * 到独立文件，constructor 在 makeAutoObservable 之前统一挂载（箭头函数实例
 * 属性，与原 class field 语义一致 → MobX action 标注行为不变，外部 API 零变化）。
 * 目录名用 modelStoreMethods 避开 Windows 大小写不敏感下与 ModelStore.ts 的解析冲突。
 *
 * 域划分（对齐 MASTER_LOG §13.2 四段拆分）：
 *   - projectionMethods：投影模型（multimodal mmproj）查询/绑定/清理 + vision 偏好
 *   - reasoningMethods：推理能力观察记录与手动覆盖
 *   后续：扫描/下载/加载/配置各段按同模式分期迁出。
 */
import type {modelStore as modelStoreInstance} from '../ModelStore';
import {applyProjectionMethods} from './projectionMethods';
import {applyReasoningMethods} from './reasoningMethods';

type ModelStore = typeof modelStoreInstance;

/** 挂载全部方法组（必须在 makeAutoObservable 之前调用） */
export function applyModelStoreMethodGroups(store: ModelStore): void {
  applyProjectionMethods(store);
  applyReasoningMethods(store);
}
