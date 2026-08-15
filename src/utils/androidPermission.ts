import {Platform, PermissionsAndroid, Alert, Linking} from 'react-native';
import * as RNFS from '@dr.pogodin/react-native-fs';

import {uiStore} from '../store';
import {AIOS_MODELS_DIR} from './paths';

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
 * B13 存储权限（2026-08-15 复盘修订）：
 * 正确设计 = 启动检测 → 缺失才弹 → 系统请求优先 → 永不阻塞扫描。
 *
 * 关键认知：PermissionsAndroid.check 对 MANAGE_EXTERNAL_STORAGE 这类
 * 特殊权限不可靠（可能误报 false）——因此判定用「目录实际可读」
 * （RNFS.exists(AIOS_MODELS_DIR)），check 只用于触发请求。
 *
 * 返回值仅表示权限是否就绪，调用方**不得**因 false 短路扫描
 * （scanLocalModels 自身 try/catch 兜底，读不到自然为空）。
 */
export async function ensureStorageAccess(): Promise<boolean> {
  if (Platform.OS !== 'android') {
    return true;
  }
  // 已可读（用户授过任何有效权限：MANAGE / READ / WRITE）→ 直接通过
  try {
    if (await RNFS.exists(AIOS_MODELS_DIR)) {
      return true;
    }
  } catch {
    // 继续请求流程
  }

  if (Platform.Version >= 30) {
    // ① 系统请求运行时权限（直接弹系统框，与主流 App 一致）
    try {
      await PermissionsAndroid.requestMultiple([
        PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE,
        PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE,
      ]);
      // ② 请求后复测实际可读性
      try {
        if (await RNFS.exists(AIOS_MODELS_DIR)) {
          return true;
        }
      } catch {
        // 落到引导
      }
    } catch {
      // 请求异常，落到引导
    }
    // ③ 仍未就绪 → 引导「所有文件访问」（MANAGE 是特殊权限，
    //    系统不支持 request，只能跳设置页，这是 Android 平台限制）
    const l10n = uiStore.l10n;
    Alert.alert(
      l10n.components.exportUtils.permissionRequired,
      '小黄鸡需要「所有文件访问」权限才能读取模型目录。请在系统设置中允许后返回。',
      [
        {text: l10n.common.cancel, style: 'cancel'},
        {text: '去设置', onPress: () => Linking.openSettings()},
      ],
    );
    return false;
  }
  return ensureLegacyStoragePermission();
}
