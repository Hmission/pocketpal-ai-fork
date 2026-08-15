/**
 * B15 双轨模型目录管理（ADR-0004）：
 * - 默认目录 DEFAULT_MODELS_DIR（规范路径，零权限，HF 下载落点）
 * - 自定义目录列表（用户手动添加，默认注册 AIOS_MODELS_DIR 为第一项，
 *   共享存储、卸载不丢模型）
 *
 * 扫描范围 = 默认目录 ∪ 自定义目录，去重按文件名（见 ModelStore.scanLocalModels）。
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

import {AIOS_MODELS_DIR, DEFAULT_MODELS_DIR} from './paths';

const CUSTOM_MODEL_DIRS_KEY = 'aios.customModelDirs.v1';

/** 读取自定义目录列表；首次返回默认注册项（AIOS_MODELS_DIR）。 */
export async function getCustomModelDirs(): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(CUSTOM_MODEL_DIRS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as string[];
      if (Array.isArray(parsed) && parsed.every(p => typeof p === 'string')) {
        return parsed;
      }
    }
  } catch (e) {
    console.warn('[modelDirs] read custom dirs failed:', e);
  }
  return [AIOS_MODELS_DIR];
}

/** 持久化自定义目录列表（自动保留默认注册项）。 */
export async function setCustomModelDirs(dirs: string[]): Promise<void> {
  const unique = Array.from(new Set([AIOS_MODELS_DIR, ...dirs])).filter(
    d => d && d !== DEFAULT_MODELS_DIR,
  );
  try {
    await AsyncStorage.setItem(CUSTOM_MODEL_DIRS_KEY, JSON.stringify(unique));
  } catch (e) {
    console.warn('[modelDirs] persist custom dirs failed:', e);
  }
}

/** 添加自定义目录（去重，持久化）。 */
export async function addCustomModelDir(dir: string): Promise<string[]> {
  const dirs = await getCustomModelDirs();
  if (!dirs.includes(dir)) {
    dirs.push(dir);
    await setCustomModelDirs(dirs);
  }
  return dirs;
}

/** 移除自定义目录（持久化）。 */
export async function removeCustomModelDir(dir: string): Promise<string[]> {
  const dirs = await getCustomModelDirs();
  const next = dirs.filter(d => d !== dir);
  await setCustomModelDirs(next);
  return next;
}

/** 全部模型目录 = 默认目录 ∪ 自定义目录（去重）。 */
export async function getAllModelDirs(): Promise<string[]> {
  const custom = await getCustomModelDirs();
  const all = [DEFAULT_MODELS_DIR, ...custom];
  return Array.from(new Set(all));
}
