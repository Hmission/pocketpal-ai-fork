/**
 * downloadGuard — 下载前置守卫链（守卫 hook 指南针）
 *
 * 顺序守卫，任一失败显式返回原因（不兜底、不静默跳过）：
 *   1. 权限守卫：AIOS 共享目录实际可读（readDir 探针；不可读引导「所有文件访问」）
 *   2. 源守卫：条目存在可用的下载 URL
 *   3. 状态守卫：已下载 / 下载中 → 幂等拒绝
 *   4. 存储守卫：剩余空间足够（含套件总量）
 *
 * 调用方拿到 {ok:false, reason} 后自行映射文案，守卫本身不弹 UI（权限引导除外——
 * 那是 ensureStorageAccess 的既有契约：检测 → 缺失才弹 → 永不阻塞扫描）。
 */

import {downloadManager} from '../services/downloads';
import {ensureStorageAccess} from './androidPermission';
import {hasEnoughSpace} from './index';
import {Model} from './types';

export type DownloadGuardReason =
  | 'permission'
  | 'no-source'
  | 'downloaded'
  | 'downloading'
  | 'storage';

export type DownloadGuardResult =
  | {ok: true}
  | {ok: false; reason: DownloadGuardReason};

export async function guardBeforeDownload(
  model: Model,
): Promise<DownloadGuardResult> {
  // 1. 权限守卫：自定义目录（含 AIOS 共享目录）不可读 → 引导授权，本次拒绝
  const permOk = await ensureStorageAccess();
  if (!permOk) {
    return {ok: false, reason: 'permission'};
  }

  // 2. 源守卫：无下载 URL（无在线源条目）→ 不给假下载
  if (!model.downloadUrl) {
    return {ok: false, reason: 'no-source'};
  }

  // 3. 状态守卫：幂等拒绝
  if (model.isDownloaded) {
    return {ok: false, reason: 'downloaded'};
  }
  if (downloadManager.isDownloading(model.id)) {
    return {ok: false, reason: 'downloading'};
  }

  // 4. 存储守卫：套件按 Model.size（含 extras 已并入 stub）计
  const enough = await hasEnoughSpace(model);
  if (!enough) {
    return {ok: false, reason: 'storage'};
  }

  return {ok: true};
}
