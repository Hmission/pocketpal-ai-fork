import {Platform, PermissionsAndroid, Alert, Linking} from 'react-native';
import * as RNFS from '@dr.pogodin/react-native-fs';

import {uiStore} from '../store';
import {getAllModelDirs} from './modelDirs';

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
    Alert.alert(
      l10n.components.exportUtils.permissionDenied,
      l10n.components.exportUtils.permissionDeniedMessage,
      [{text: 'OK'}],
    );
  }
  return granted;
}

/**
 * B13/B15 存储权限（2026-08-15 复盘修订）：
 * 正确设计 = 启动检测 → 缺失才弹 → 系统请求优先 → 永不阻塞扫描。
 *
 * 关键认知：PermissionsAndroid.check 对 MANAGE_EXTERNAL_STORAGE 这类
 * 特殊权限不可靠（可能误报 false）——因此判定用「目录实际可读」
 * （RNFS.exists），check 只用于触发请求。
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
  // ① 自定义目录（含默认注册的 AIOS 共享目录）任一可读 → 通过
  //    （RNFS.exists 对无权限路径返回 false，故对「不存在」用 mkdir 探测：
  //    无权限时抛 EACCES → 判定不可读，需要引导）
  const dirs = await getAllModelDirs();
  for (const d of dirs) {
    try {
      if (await RNFS.exists(d)) {
        return true;
      }
      await RNFS.mkdir(d);
      return true;
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
      // ④ 请求后复测实际可读性
      const dirs = await getAllModelDirs();
      for (const d of dirs) {
        try {
          if (await RNFS.exists(d)) {
            return true;
          }
        } catch {
          // 继续检查
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
 * B15：用户主动添加/读取自定义目录时调用——目录实际可读判定，
 * 不可读则引导「所有文件访问」（与启动检测同一契约，永不短路扫描）。
 */
export async function ensureCustomDirAccess(dir: string): Promise<boolean> {
  if (Platform.OS !== 'android') {
    return true;
  }
  try {
    if (await RNFS.exists(dir)) {
      return true;
    }
  } catch {
    // 落到引导
  }
  if (Platform.Version >= 30) {
    showManageAccessAlert();
    return false;
  }
  return ensureLegacyStoragePermission();
}

function showManageAccessAlert(): void {
  const l10n = uiStore.l10n;
  Alert.alert(
    l10n.components.exportUtils.permissionRequired,
    '小黄鸡需要「所有文件访问」权限才能读取模型目录。请在系统设置中允许后返回。',
    [
      {text: l10n.common.cancel, style: 'cancel'},
      {text: '去设置', onPress: () => Linking.openSettings()},
    ],
  );
}
