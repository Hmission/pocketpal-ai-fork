/**
 * modelCapabilityRegistry — 任务→聊天模型选择（调度叙事的模型选型层）
 *
 * 任务触发时，从已下载本地模型中选出合适的 chat 模型候选（write/code/play）。
 * 选型排序（MODEL_MATRIX §1.1，用户标签 > 指纹 > 兜底）：
 *   1. chitchat / image：返回空——闲聊永远走管家（启动即就绪），
 *      生图走 image 引擎独立槽位，均不在此选型。
 *   2. 用户用途标签命中（§18.7：设置页打的 capabilities 标签，最高优先）
 *   3. DEFAULT_MAP 文件名指纹（MODEL_MATRIX 入选清单：
 *      code→Ministral-3-3B、write→Qwen3.5-2B/4B）
 *   4. 其余本地模型按大小降序兜底（越大越强）
 * 组内一律按 size 降序。排除：管家模型（prompter 常驻槽）、projection 模型。
 * play（P8 玩具工坊）：玩具匠=代码模型，选型复用 code（PLAY_SPEC §2.2）。
 */
import {Model, ModelOrigin, ModelType} from '../utils/types';
import {modelStore} from './index';
import {isPrompterModelName} from '../services/promptWriter';
import type {TaskKind} from './taskRouter';

const displayName = (m: Model): string =>
  m.name || m.filename || m.fullPath || '';

/** 默认映射（MODEL_MATRIX 入选清单文件名指纹）：声明缺失时的推荐 */
const DEFAULT_MAP: Record<'write' | 'code', RegExp> = {
  write: /qwen3\.5[-_ ]?[24]b/i,
  code: /ministral[-_ ]?3[-_ ]?3b/i,
};

const bySizeDesc = (a: Model, b: Model) => b.size - a.size;

/**
 * 任务候选列表（§18.7 弹窗多候选）：[0] = 推荐项。
 * 空数组 = 无可用本地模型（调用方各自显式失败，不兜底）。
 */
export function listModelsForTask(task: TaskKind): Model[] {
  if (task === 'image' || task === 'chitchat') {
    // 闲聊→管家（useChatScheduler 直答）；生图→image 引擎槽，均不走本选型
    return [];
  }
  // play（玩具匠）复用 code 选型；adventure（城主）复用 write 选型
  const modelTask: 'write' | 'code' =
    task === 'play' ? 'code' : task === 'adventure' ? 'write' : task;
  const candidates = modelStore.availableModels.filter(
    m =>
      m.origin !== ModelOrigin.REMOTE &&
      m.modelType !== ModelType.PROJECTION &&
      !isPrompterModelName(displayName(m)) &&
      !isPrompterModelName(m.filename ?? ''),
  );
  if (candidates.length === 0) {
    return [];
  }

  // 1) 用户用途标签命中（最高优先；write 同义键 creativity/instructions 延续旧语义）
  const wanted =
    modelTask === 'code' ? ['code'] : ['rewriting', 'creativity', 'instructions'];
  const tagged = candidates
    .filter(m => m.capabilities?.some(c => wanted.includes(c)))
    .sort(bySizeDesc);

  // 2) DEFAULT_MAP 指纹（排除已入标签组的，避免重复）
  const re = DEFAULT_MAP[modelTask];
  const fingerprint = candidates
    .filter(
      m =>
        !tagged.includes(m) &&
        (re.test(displayName(m)) || re.test(m.filename ?? '')),
    )
    .sort(bySizeDesc);

  // 3) 其余按大小降序兜底
  const rest = candidates
    .filter(m => !tagged.includes(m) && !fingerprint.includes(m))
    .sort(bySizeDesc);

  return [...tagged, ...fingerprint, ...rest];
}

/** 单候选兼容面：推荐项 = 候选列表首项；无候选返回 null。 */
export function findModelForTask(task: TaskKind): Model | null {
  return listModelsForTask(task)[0] ?? null;
}
