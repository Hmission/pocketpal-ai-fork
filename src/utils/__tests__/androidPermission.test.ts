/**
 * androidPermission 门禁测试（task-7c3e 第 5 项补锁）：
 * 「exists 通过但 readDir 失败」的判定契约——readDir 探针失败必须落入弹窗
 * 引导分支，禁止静默 return true（否则新装不弹引导、模型列表空）。
 * 2026-08-20 readDir 探针升级后补测（§57）。
 */
import {Platform, PermissionsAndroid, Alert, Linking} from 'react-native';

import {ensureStorageAccess, ensureCustomDirAccess} from '../androidPermission';
import {getCustomModelDirs} from '../modelDirs';

jest.mock('../../store', () => ({
  uiStore: {
    l10n: {
      common: {cancel: 'Cancel'},
      components: {
        exportUtils: {
          permissionRequired: 'Permission Required',
          permissionMessage: 'msg',
          continue: 'Continue',
          permissionDenied: 'Denied',
          permissionDeniedMessage: 'denied msg',
        },
      },
    },
  },
}));

jest.mock('../modelDirs', () => ({
  getCustomModelDirs: jest.fn(),
}));

// RNFS 探针（readDir/mkdir）以 mock 前缀变量注入，工厂内可引用
const mockReadDir = jest.fn();
const mockMkdir = jest.fn();
jest.mock('@dr.pogodin/react-native-fs', () => ({
  readDir: (...args: unknown[]) => mockReadDir(...args),
  mkdir: (...args: unknown[]) => mockMkdir(...args),
}));

const AIOS_DIR = '/sdcard/Documents/AIOS/models';

const setAndroid = (version: number) => {
  Platform.OS = 'android';
  // Platform.Version 为只读 getter：spyOn 'get' 访问器 mock 返回值
  jest.spyOn(Platform, 'Version', 'get').mockReturnValue(version);
};

afterEach(() => {
  jest.restoreAllMocks(); // 恢复 Platform.Version getter 与 PermissionsAndroid spies
});

beforeEach(() => {
  jest.clearAllMocks();
  mockReadDir.mockResolvedValue([]);
  mockMkdir.mockResolvedValue(undefined);
  (getCustomModelDirs as jest.Mock).mockResolvedValue([AIOS_DIR]);
  jest
    .spyOn(PermissionsAndroid, 'requestMultiple')
    .mockResolvedValue({});
  jest.spyOn(PermissionsAndroid, 'check').mockResolvedValue(true);
  jest
    .spyOn(PermissionsAndroid, 'request')
    .mockResolvedValue(PermissionsAndroid.RESULTS.GRANTED);
});

describe('ensureStorageAccess — readDir 探针判定契约（task-7c3e）', () => {
  it('目录真实可读 → 返回 true，不弹引导', async () => {
    setAndroid(34);
    const alertSpy = jest.spyOn(Alert, 'alert');
    await expect(ensureStorageAccess()).resolves.toBe(true);
    expect(alertSpy).not.toHaveBeenCalled();
    expect(mockReadDir).toHaveBeenCalledWith(AIOS_DIR);
  });

  it('readDir 探针失败（exists 可能通过）→ 请求后复测仍失败 → 弹引导 + 返回 false（核心契约）', async () => {
    setAndroid(34);
    mockReadDir.mockRejectedValue(new Error('EACCES'));
    const alertSpy = jest.spyOn(Alert, 'alert');
    await expect(ensureStorageAccess()).resolves.toBe(false);
    // mkdir 后必须二次 readDir 验证，仍失败才落引导
    expect(mockMkdir).toHaveBeenCalledWith(AIOS_DIR);
    expect(mockReadDir).toHaveBeenCalledTimes(3); // 初探 + mkdir 后复探 + 请求后复探
    expect(alertSpy).toHaveBeenCalled();
  });

  it('mkdir 后二次 readDir 成功 → 返回 true（目录可建即视为可写）', async () => {
    setAndroid(34);
    mockReadDir
      .mockRejectedValueOnce(new Error('EACCES'))
      .mockResolvedValueOnce([]);
    await expect(ensureStorageAccess()).resolves.toBe(true);
  });

  it('无自定义目录 → 返回 true 不引导（纯零权限闭环）', async () => {
    setAndroid(34);
    (getCustomModelDirs as jest.Mock).mockResolvedValue([]);
    const alertSpy = jest.spyOn(Alert, 'alert');
    await expect(ensureStorageAccess()).resolves.toBe(true);
    expect(alertSpy).not.toHaveBeenCalled();
  });

  it('非 Android 平台恒 true', async () => {
    Platform.OS = 'ios';
    await expect(ensureStorageAccess()).resolves.toBe(true);
  });

  it('Android 10-（API<30）走 legacy 运行时权限请求', async () => {
    setAndroid(28);
    mockReadDir.mockRejectedValue(new Error('EACCES'));
    await expect(ensureStorageAccess()).resolves.toBe(true);
    expect(PermissionsAndroid.check).toHaveBeenCalledWith(
      PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE,
    );
  });
});

describe('ensureCustomDirAccess — 用户主动添加目录', () => {
  it('目录可读 → true 不引导', async () => {
    setAndroid(34);
    const alertSpy = jest.spyOn(Alert, 'alert');
    await expect(ensureCustomDirAccess(AIOS_DIR)).resolves.toBe(true);
    expect(alertSpy).not.toHaveBeenCalled();
  });

  it('目录不可读 → 弹「所有文件访问」引导 + 返回 false', async () => {
    setAndroid(34);
    mockReadDir.mockRejectedValue(new Error('EACCES'));
    const alertSpy = jest.spyOn(Alert, 'alert');
    await expect(ensureCustomDirAccess(AIOS_DIR)).resolves.toBe(false);
    expect(alertSpy).toHaveBeenCalled();
  });
});
