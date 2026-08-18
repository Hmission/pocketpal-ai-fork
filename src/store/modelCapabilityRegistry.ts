/**
 * modelCapabilityRegistry — 任务→聊天模型选择（调度叙事的模型选型层）
 *
 * 任务触发时，从已下载本地模型中选出最合适的 chat 模型自动加载（write/code）。
 * 选型规则（SPEC §9.3，2026-08-17 大王钦定）：
 *   1. chitchat / image：直接返回 null——闲聊永远走管家（启动即就绪），
 *      生图走 image 引擎独立槽位，均不在此选型。
 *   2. write/code：已声明 capabilities 的模型优先（code→code；write→rewriting/creativity）
 *   3. 无声明：按 DEFAULT_MAP 文件名指纹推荐（MODEL_MATRIX 入选清单：
 *      code→Ministral-3-3B、write→Qwen3.5-2B/4B）
 *   4. 兜底（仅 write/code/play）：无声明无指纹时回退最大本地模型（越大越强）
 * 排除：管家模型（prompter 常驻槽）、projection 模型（availableModels 已过滤）。
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

export function findModelForTask(task: TaskKind): Model | null {
  if (task === 'image' || task === 'chitchat') {
    // 闲聊→管家（useChatScheduler 直答）；生图→image 引擎槽，均不走本选型
    return null;
  }
  // play（玩具匠）复用 code 选型（PLAY_SPEC §2.2：玩具匠=代码模型）
  const modelTask = task === 'play' ? 'code' : task;
  const candidates = modelStore.availableModels.filter(
    m =>
      m.origin !== ModelOrigin.REMOTE &&
      m.modelType !== ModelType.PROJECTION &&
      !isPrompterModelName(displayName(m)) &&
      !isPrompterModelName(m.filename ?? ''),
  );
  if (candidates.length === 0) {
    return null;
  }

  // 1) 已声明能力优先（write/code）
  const wanted =
    modelTask === 'code' ? ['code'] : ['rewriting', 'creativity', 'instructions'];
  const declared = candidates.find(m =>
    m.capabilities?.some(c => wanted.includes(c)),
  );
  if (declared) {
    return declared;
  }

  // 2) 默认映射（MODEL_MATRIX 定稿指纹：code→Ministral-3-3B，write→Qwen3.5 系）
  const re = DEFAULT_MAP[modelTask];
  const matched = candidates.find(
    m => re.test(displayName(m)) || re.test(m.filename ?? ''),
  );
  if (matched) {
    return matched;
  }

  // 3) 兜底（仅 write/code/play 无声明无指纹）：最大的本地模型（越大越强）
  return [...candidates].sort((a, b) => b.size - a.size)[0];
}
