/**
 * imageGenStore 幽灵任务治理单测（2026-08-21 真机实证回归防线）：
 * app 强杀后 DB 遗留 status='running' 条目，水合时无推理进程——
 * ensureReadyImpl 必须统一置 failed（内存 + DB 双写），防永久卡死。
 */
jest.mock('../../repositories/ImageGenTaskRepository', () => {
  const patchByTaskId = jest.fn().mockResolvedValue(undefined);
  // 默认空水合：单例构造即触发首次 ensureReadyImpl，保证安全基线
  const loadAll = jest.fn().mockResolvedValue([]);
  return {
    imageGenTaskRepository: {
      loadAll,
      patchByTaskId,
      create: jest.fn().mockResolvedValue(undefined),
      createBatch: jest.fn().mockResolvedValue(undefined),
      removeByTaskId: jest.fn().mockResolvedValue(undefined),
      removeByUris: jest.fn().mockResolvedValue(undefined),
    },
  };
});

jest.mock('../../services/dreamLiteEngine', () => ({
  loadDreamLite: jest.fn(),
  unloadDreamLite: jest.fn(),
  generateDreamLite: jest.fn(),
  editDreamLite: jest.fn(),
  decodeImageToRgb: jest.fn(),
}));

jest.mock('../../services/superResEngine', () => ({
  ensureSuperResModels: jest.fn(),
  loadSuperRes: jest.fn(),
  unloadSuperRes: jest.fn(),
  upscaleImage: jest.fn(),
}));

jest.mock('../../services/captionEngine', () => ({
  runCaption: jest.fn(),
}));

jest.mock('../../debug/eventStream', () => ({emit: jest.fn()}));

jest.mock('../../store/engineMutex', () => ({
  engineMutex: {
    register: jest.fn(),
    acquire: jest.fn().mockResolvedValue(undefined),
    release: jest.fn(),
  },
}));

jest.mock('../../store/engineStatus', () => ({
  engineStatus: {
    setPhase: jest.fn(),
    setError: jest.fn(),
    setProgress: jest.fn(),
  },
}));

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn().mockResolvedValue(null),
    setItem: jest.fn().mockResolvedValue(undefined),
    removeItem: jest.fn().mockResolvedValue(undefined),
  },
}));

jest.mock('@dr.pogodin/react-native-fs', () => ({
  __esModule: true,
  default: {
    DocumentDirectoryPath: '/data/user/0/com.pocketpalai/files',
    exists: jest.fn().mockResolvedValue(true),
    mkdir: jest.fn().mockResolvedValue(undefined),
    unlink: jest.fn().mockResolvedValue(undefined),
    readDir: jest.fn().mockResolvedValue([]),
  },
}));

jest.mock('react-native', () => {
  const {NativeModules} = jest.requireActual('react-native');
  return {
    NativeModules: {...NativeModules, ImageGen: {}},
  };
});

import {imageGenTaskRepository} from '../../repositories/ImageGenTaskRepository';
import {imageGenStore} from '../imageGenStore';

const ghostEntry = {
  uri: '',
  prompt: '',
  seed: 0,
  ts: 1787290000000,
  width: 0,
  height: 0,
  taskId: 'task_ghost_1',
  status: 'running' as const,
};

const okEntry = {
  uri: 'file:///x.png',
  prompt: 'ok',
  seed: 1,
  ts: 1787290001000,
  width: 512,
  height: 512,
  taskId: 'task_ok_1',
  status: 'success' as const,
};

describe('imageGenStore 幽灵任务治理', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('水合含 running 遗留：统一置 failed（内存 + DB 双写），success 不受影响', async () => {
    (imageGenTaskRepository.loadAll as jest.Mock).mockResolvedValue([
      ghostEntry,
      okEntry,
    ]);

    await (imageGenStore as any).ensureReadyImpl();

    const ghost = imageGenStore.history.find(h => h.taskId === 'task_ghost_1');
    expect(ghost?.status).toBe('failed');
    expect(ghost?.errorSummary).toBe('生成中断');
    expect(ghost?.errorDetail).toContain('强制退出');

    const ok = imageGenStore.history.find(h => h.taskId === 'task_ok_1');
    expect(ok?.status).toBe('success');

    expect(imageGenTaskRepository.patchByTaskId).toHaveBeenCalledWith(
      'task_ghost_1',
      expect.objectContaining({status: 'failed'}),
    );
    // 仅幽灵条目触发 patch
    expect(imageGenTaskRepository.patchByTaskId).toHaveBeenCalledTimes(1);
  });

  it('水合无 running：零 patch（无幽灵不写盘）', async () => {
    (imageGenTaskRepository.loadAll as jest.Mock).mockResolvedValue([okEntry]);

    await (imageGenStore as any).ensureReadyImpl();

    expect(imageGenTaskRepository.patchByTaskId).not.toHaveBeenCalled();
    expect(imageGenStore.history).toHaveLength(1);
  });
});
