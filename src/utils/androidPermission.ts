import {Platform, PermissionsAndroid, Alert, Linking} from 'react-native';
import {uiStore} from '../store';

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
 * B13 存储权限防护（2026-08-15 事故复盘）：
 * 卸载重装会清空运行时权限与 MANAGE_EXTERNAL_STORAGE appop，导致
 * scanLocalModels 读不到共享存储 → 模型列表空。App 启动时调用：
 *  - Android 11+ (API 30+)：检查「所有文件访问」，未授权弹引导去系统设置
 *  - Android 6-9 (API 23-28)：运行时 WRITE 请求（legacy 路径）
 * 返回值仅表示本次检查结果，不阻塞启动（模型页可后续重试）。
 */
export async function ensureStorageAccess(): Promise<boolean> {
  if (Platform.OS !== 'android') {
    return true;
  }
  if (Platform.Version >= 30) {
    // 先查 READ（targetSdk 36 下旧权限仍可读共享目录的场景，避免误弹）
    try {
      const readGranted = await PermissionsAndroid.check(
        PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE,
      );
      if (readGranted) {
        return true;
      }
    } catch {
      // 继续查 MANAGE
    }
    try {
      const granted = await PermissionsAndroid.check(
        // RN 类型不含 MANAGE_EXTERNAL_STORAGE（特殊权限，Android 11+）
        'android.permission.MANAGE_EXTERNAL_STORAGE' as never,
      );
      if (granted) {
        return true;
      }
    } catch {
      // 特殊权限 check 可能抛错：落到引导，不吞掉用户可见入口
    }
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
