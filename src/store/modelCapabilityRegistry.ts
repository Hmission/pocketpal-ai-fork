/**
 * modelCapabilityRegistry — 任务→聊天模型选择（调度叙事的模型选型层）
 *
 * 任务触发时，从已下载本地模型中选出最合适的 chat 模型自动加载。
 * 选型规则（锋利、无兜底兜圈子）：
 *   1. write/code：已声明 capabilities 的模型优先（code→code；write→rewriting/creativity）
 *   2. 无声明/chitchat（生图后懒切换回聊天）回退“非管家的最大本地模型”（越大越强）
 * 排除：管家模型（prompter 常驻槽）、projection 模型（availableModels 已过滤）。
 */
import {Model, ModelOrigin, ModelType} from '../utils/types';
import {modelStore} from './index';
import {isPrompterModelName} from '../services/promptWriter';
import type {TaskKind} from './taskRouter';

const displayName = (m: Model): string =>
  m.name || m.filename || m.fullPath || '';

export function findModelForTask(task: TaskKind): Model | null {
  if (task === 'image') {
    return null;
  }
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

  // 1) 已声明能力优先（仅 write/code；chitchat 无能力偏好直落最大模型回退）
  if (task === 'write' || task === 'code') {
    const wanted =
      task === 'code' ? ['code'] : ['rewriting', 'creativity', 'instructions'];
    const declared = candidates.find(m =>
      m.capabilities?.some(c => wanted.includes(c)),
    );
    if (declared) {
      return declared;
    }
  }

  // 2) 回退：最大的本地模型（越大越强）
  return [...candidates].sort((a, b) => b.size - a.size)[0];
}
