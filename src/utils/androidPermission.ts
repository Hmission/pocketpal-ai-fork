import {Platform, PermissionsAndroid, Alert, Linking} from 'react-native';
import {uiStore} from '../store';

/**
 * Android 11+ 直接路径访问 AIOS 共享目录（/sdcard/Documents/AIOS）需要
 * 「所有文件访问」（MANAGE_EXTERNAL_STORAGE）。未授予时 FUSE 层拒绝读取，
 * 表现为 EACCES (error 13)。启动时检测一次，未授予则引导跳转设置页。
 */
export async function ensureAllFilesAccess(): Promise<boolean> {
  if (Platform.OS !== 'android' || Platform.Version < 30) {
    return true;
  }
  try {
    // RN 类型声明未收录 MANAGE_EXTERNAL_STORAGE（运行时 Android 11+ 支持）
    const MANAGE_EXTERNAL_STORAGE =
      'android.permission.MANAGE_EXTERNAL_STORAGE' as any;
    const granted = await PermissionsAndroid.check(MANAGE_EXTERNAL_STORAGE);
    if (granted) {
      return true;
    }
    const l10n = uiStore.l10n;
    Alert.alert(
      l10n.components.exportUtils.allFilesAccessTitle,
      l10n.components.exportUtils.allFilesAccessMessage,
      [
        {text: l10n.components.exportUtils.cancel, style: 'cancel'},
        {
          text: l10n.components.exportUtils.allFilesAccessAction,
          onPress: () => Linking.openSettings(),
        },
      ],
    );
    return false;
  } catch {
    return false;
  }
}

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
