/**
 * modelStoreMethods/index — ModelStore 方法组聚合入口（models 域拆分 · R3）
 *
 * ModelStore 肥组件按域分期拆分：把自包含的方法组迁出到独立文件，constructor
 * 在 makeAutoObservable 之前统一挂载（箭头函数实例属性，与原 class field 语义
 * 一致 → MobX action 标注行为不变，外部 API 零变化）。
 * 目录名用 modelStoreMethods 避开 Windows 大小写不敏感下与 ModelStore.ts 的解析冲突。
 *
 * 域划分（对齐 POCKETPAL_UI_REMAINING_FIX_PLAN §四 R3）：
 *   - contextConfigMethods：上下文初始化参数 setter / n_ctx 策展三件套 / GPU 族
 *   - crudMethods：命中/删除/GGUF 元数据/卡片设置/重置族
 *   - downloadMethods：下载入口/取消/进度/HF 接入/哈希/重试
 *   - catalogScanMethods：catalog 单一事实源 preset 解析 / 生图套件 / reconcile/merge
 *   - localScanMethods：本地 GGUF 扫描注册 / 按路径移除 / 单文件注册
 *   - loadReleaseMethods：加载/释放生命周期（mutex/last-one-wins/Stop-Await-Release）
 *   - projectionMethods：投影模型（multimodal mmproj）查询/绑定/清理 + vision 偏好
 *   - reasoningMethods：推理能力观察记录与手动覆盖
 */
import type {modelStore as modelStoreInstance} from '../ModelStore';
import {applyContextConfigMethods} from './contextConfigMethods';
import {applyCrudMethods} from './crudMethods';
import {applyDownloadMethods} from './downloadMethods';
import {applyCatalogScanMethods} from './catalogScanMethods';
import {applyLocalScanMethods} from './localScanMethods';
import {applyLoadReleaseMethods} from './loadReleaseMethods';
import {applyProjectionMethods} from './projectionMethods';
import {applyReasoningMethods} from './reasoningMethods';

type ModelStore = typeof modelStoreInstance;

/** 挂载全部方法组（必须在 makeAutoObservable 之前调用） */
export function applyModelStoreMethodGroups(store: ModelStore): void {
  applyContextConfigMethods(store);
  applyCrudMethods(store);
  applyDownloadMethods(store);
  applyCatalogScanMethods(store);
  applyLocalScanMethods(store);
  applyLoadReleaseMethods(store);
  applyProjectionMethods(store);
  applyReasoningMethods(store);
}
