import {Platform, PermissionsAndroid, Linking} from 'react-native';
import * as RNFS from '@dr.pogodin/react-native-fs';

import {uiStore} from '../store';
import {confirmDialog} from '../components/ui/ConfirmDialog/api';
import {getCustomModelDirs} from './modelDirs';
import {infoDialog} from '../components/ui/InfoDialog/api';

export async function ensureLegacyStoragePermission() {
  // Skip everything on iOS or any Android 11+ device (API 29+)
  if (Platform.OS !== 'android' || Platform.Version >= 29) {
    return true;
  }

  // Ask for storage permission on API 23‑28 (Android 6-9)
  const needed = PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE;

  // Already granted? → done
  const already = await PermissionsAndroid.check(needed);
  if (already) {
    return true;
  }

  const l10n = uiStore.l10n;

  // Optional rationale dialog
  const rationale = {
    title: l10n.components.exportUtils.permissionRequired,
    message: l10n.components.exportUtils.permissionMessage,
    buttonPositive: l10n.components.exportUtils.continue,
    buttonNegative: l10n.common.cancel,
  };

  // Show the system prompt
  const results = await PermissionsAndroid.request(needed, rationale);

  const granted = results === PermissionsAndroid.RESULTS.GRANTED;

  if (!granted) {
    infoDialog({
      title: l10n.components.exportUtils.permissionDenied,
      message: l10n.components.exportUtils.permissionDeniedMessage,
      buttonText: 'OK',
    });
  }
  return granted;
}

/**
 * B13/B15 存储权限（2026-08-15 复盘修订；2026-08-20 readDir 探针升级）：
 * 正确设计 = 启动检测 → 缺失才弹 → 系统请求优先 → 永不阻塞扫描。
 *
 * 关键认知：PermissionsAndroid.check 对 MANAGE_EXTERNAL_STORAGE 这类
 * 特殊权限不可靠（可能误报 false）——因此判定用「目录实际可读」。
 *
 * 2026-08-20 探针升级（task-7c3e 根因修复）：可读判定从 RNFS.exists 改为
 * readDir 探针——Android 11+ scoped storage 下 exists 对无权限目录可能返回
 * true（目录元数据可见但内容不可读），导致新装不弹引导、列表空。
 * exists 通过但 readDir 失败必须落入弹窗分支。
 *
 * B15 双轨（ADR-0004）：默认目录（getExternalFilesDir/models）零权限，
 * 恒可读、永不弹窗；自定义目录（含默认注册的 AIOS 共享目录）才需要
 * MANAGE——启动时若自定义目录全不可读则引导一次（存量模型在那）。
 *
 * 返回值仅表示权限是否就绪，调用方**不得**因 false 短路扫描
 * （scanLocalModels 自身 try/catch 兜底，读不到自然为空）。
 */
export async function ensureStorageAccess(): Promise<boolean> {
  if (Platform.OS !== 'android') {
    return true;
  }
  // ① 只探测自定义目录（含默认注册的 AIOS 共享目录）：默认目录
  //    getExternalFilesDir 零权限恒可读，混入会致判定恒真、引导永不弹
  //    （2026-08-18 真机取证修正）。无自定义目录 = 纯零权限闭环，无需引导。
  const dirs = await getCustomModelDirs();
  if (dirs.length === 0) {
    return true;
  }
  for (const d of dirs) {
    try {
      if (await isDirReadable(d)) {
        return true;
      }
      await RNFS.mkdir(d);
      // mkdir 成功后必须再次 readDir 验证（目录已建但无权限时 mkdir 静默
      // 成功/失败不定，readDir 才是真实可读性判据）
      if (await isDirReadable(d)) {
        return true;
      }
    } catch {
      // 无权限或父目录缺失，继续检查下一个
    }
  }

  if (Platform.Version >= 30) {
    // ③ 系统请求运行时权限（直接弹系统框，与主流 App 一致）
    try {
      await PermissionsAndroid.requestMultiple([
        PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE,
        PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE,
      ]);
      // ④ 请求后复测实际可读性（同样只测自定义目录）
      const dirsAfter = await getCustomModelDirs();
      for (const d of dirsAfter) {
        if (await isDirReadable(d)) {
          return true;
        }
      }
    } catch {
      // 请求异常，落到引导
    }
    // ⑤ 仍未就绪 → 引导「所有文件访问」（MANAGE 是特殊权限，
    //    系统不支持 request，只能跳设置页，这是 Android 平台限制）
    showManageAccessAlert();
    return false;
  }
  return ensureLegacyStoragePermission();
}

/**
 * readDir 探针：目录真实可读判定（区别于 RNFS.exists 的元数据可见性）。
 * readDir 成功且返回数组 = 可读；抛错/非数组 = 不可读（权限缺失）。
 */
async function isDirReadable(dir: string): Promise<boolean> {
  try {
    const entries = await RNFS.readDir(dir);
    return Array.isArray(entries);
  } catch {
    return false;
  }
}

/**
 * B15：用户主动添加/读取自定义目录时调用——目录实际可读判定，
 * 不可读则引导「所有文件访问」（与启动检测同一契约，永不短路扫描）。
 */
export async function ensureCustomDirAccess(dir: string): Promise<boolean> {
  if (Platform.OS !== 'android') {
    return true;
  }
  if (await isDirReadable(dir)) {
    return true;
  }
  if (Platform.Version >= 30) {
    showManageAccessAlert();
    return false;
  }
  return ensureLegacyStoragePermission();
}

function showManageAccessAlert(): void {
  const l10n = uiStore.l10n;
  // B55：信息+动作 → confirmDialog（去设置为主动作，取消=关闭）
  void confirmDialog({
    title: l10n.components.exportUtils.permissionRequired,
    message:
      '小黄鸡需要「所有文件访问」权限才能读取模型目录。请在系统设置中允许后返回。',
    confirmText: '去设置',
    cancelText: l10n.common.cancel,
  }).then(ok => {
    if (ok) {
      Linking.openSettings();
    }
  });
}
