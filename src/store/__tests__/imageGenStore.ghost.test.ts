/**
 * imageGenStore 幽灵任务治理单测（2026-08-21 真机实证回归防线；2026-09-08 §168 按
 * IMAGEGEN_QUEUE_SPEC §9.1–§9.4 重写）：水合时 status='running' 不再一律判死——
 * native 写盘通道先查**产物落盘证据**，严格唯一才收编；JS 写盘通道不可能有产物，
 * 必走失败分支但文案不得说谎（旧文案「被强制退出」与真机 pidof 不变相矛盾）。
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

// 2026-08-27：任务购物车（IMAGEGEN_QUEUE_SPEC）——队列仓库同款 mock 边界
// （幽灵治理测试局部替换 react-native，真实仓库链会触碰 paths/Platform）
jest.mock('../../repositories/ImageGenQueueRepository', () => ({
  imageGenQueueRepository: {
    loadAll: jest.fn().mockResolvedValue([]),
    // upsert 返权威行 id（项 46 契约）：给个固定值，否则 core 会把 item.id 采纳成 undefined
    upsert: jest.fn().mockResolvedValue('qrow_ghost'),
    removeByQueueId: jest.fn().mockResolvedValue(undefined),
    clearAll: jest.fn().mockResolvedValue(undefined),
  },
}));

// runGenTask 任务化（IMAGEGEN_QUEUE_SPEC §六）引入 buildErrorReport——
// errorReport.ts 依赖 react-native Platform，幽灵测试环境需同款 mock 边界
jest.mock('../../utils/errorReport', () => ({
  buildErrorReport: jest
    .fn()
    .mockResolvedValue({summary: '生成失败', detail: 'detail'}),
  copyAndSaveErrorReport: jest.fn().mockResolvedValue(''),
}));

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

// 注意调用形态：store 用 `import * as RNFS` + `RNFS.readDir(...)`（命名空间直调），
// 旧 mock 只挂在 default 上→ readDir 为 undefined，收养分支会被 try/catch 静默吞掉而测不出来；
// 此处顶层与 default 各挂同一实现。
jest.mock('@dr.pogodin/react-native-fs', () => {
  const impl = {
    DocumentDirectoryPath: '/data/user/0/com.pocketpalai/files',
    exists: jest.fn().mockResolvedValue(true),
    mkdir: jest.fn().mockResolvedValue(undefined),
    unlink: jest.fn().mockResolvedValue(undefined),
    readDir: jest.fn().mockResolvedValue([]),
  };
  return {...impl, __esModule: true, default: impl};
});

jest.mock('react-native', () => {
  const {NativeModules} = jest.requireActual('react-native');
  return {
    NativeModules: {...NativeModules, ImageGen: {}},
  };
});

import {imageGenTaskRepository} from '../../repositories/ImageGenTaskRepository';
import * as RNFS from '@dr.pogodin/react-native-fs';
import {imageGenStore, isNativeProductTask} from '../imageGenStore';

const T0 = 1787290000000;
const OUT_DIR = '/data/user/0/com.pocketpalai/files/aios_images';

/** native 写盘通道（txt2img）：kind='generated' 且 family 非 dreamlite */
const nativeGhost = {
  uri: '',
  prompt: 'a cat',
  seed: 7,
  ts: T0,
  width: 512,
  height: 512,
  family: 'sd35',
  kind: 'generated' as const,
  taskId: 'task_native_1',
  status: 'running' as const,
};

/** JS 写盘通道（DreamLite）：续体随运行时一同销毁，不可能有产物 */
const jsGhost = {
  ...nativeGhost,
  family: 'dreamlite',
  taskId: 'task_js_1',
};

const okEntry = {
  uri: 'file:///x.png',
  prompt: 'ok',
  seed: 1,
  ts: T0 + 1000,
  width: 512,
  height: 512,
  taskId: 'task_ok_1',
  status: 'success' as const,
};

const pngFile = (name: string, mtimeMs: number | null, size = 4096) => ({
  name,
  path: `${OUT_DIR}/${name}`,
  size,
  mtime: mtimeMs === null ? null : new Date(mtimeMs),
  isFile: () => true,
  isDirectory: () => false,
});

const readDirMock = () => RNFS.readDir as unknown as jest.Mock;

describe('imageGenStore 幽灵任务治理（产物证据收编）', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    readDirMock().mockResolvedValue([]);
  });

  it('isNativeProductTask 归属判定：仅 txt2img 通道为真（§9.1 单点）', () => {
    expect(isNativeProductTask(nativeGhost as never)).toBe(true);
    expect(isNativeProductTask(jsGhost as never)).toBe(false);
    expect(
      isNativeProductTask({...nativeGhost, kind: 'upscaled'} as never),
    ).toBe(false);
    expect(
      isNativeProductTask({...nativeGhost, family: undefined} as never),
    ).toBe(false);
  });

  it('native 幽灵 + 恰好 1 个产物 → 收编为 success（uri/durationMs 按落盘时刻实测）', async () => {
    (imageGenTaskRepository.loadAll as jest.Mock).mockResolvedValue([
      nativeGhost,
      okEntry,
    ]);
    readDirMock().mockResolvedValue([
      pngFile('gen_a.png', T0 + 5000),
      pngFile('dreamlite_b.png', T0 + 6000), // JS 通道产物不得参与归属
    ]);

    await (imageGenStore as any).ensureReadyImpl();

    const g = imageGenStore.history.find(h => h.taskId === 'task_native_1');
    expect(g?.status).toBe('success');
    expect(g?.uri).toBe(`file://${OUT_DIR}/gen_a.png`);
    expect(g?.durationMs).toBe(5000);
    expect(imageGenTaskRepository.patchByTaskId).toHaveBeenCalledWith(
      'task_native_1',
      expect.objectContaining({status: 'success', durationMs: 5000}),
    );
    // success 条目不受影响且不反复 patch
    expect(
      imageGenStore.history.find(h => h.taskId === 'task_ok_1')?.status,
    ).toBe('success');
    expect(imageGenTaskRepository.patchByTaskId).toHaveBeenCalledTimes(1);
  });

  it('native 幽灵但无产物 → failed，文案说「未找到产物文件」且不得称强制退出', async () => {
    (imageGenTaskRepository.loadAll as jest.Mock).mockResolvedValue([
      nativeGhost,
    ]);

    await (imageGenStore as any).ensureReadyImpl();

    const g = imageGenStore.history.find(h => h.taskId === 'task_native_1');
    expect(g?.status).toBe('failed');
    expect(g?.errorSummary).toBe('生成中断');
    expect(g?.errorDetail).toContain('未找到产物文件');
    expect(g?.errorDetail).not.toContain('强制退出');
  });

  it('产物早于任务创建时刻 → 不属于本任务，不收养', async () => {
    (imageGenTaskRepository.loadAll as jest.Mock).mockResolvedValue([
      nativeGhost,
    ]);
    readDirMock().mockResolvedValue([pngFile('gen_old.png', T0 - 1000)]);

    await (imageGenStore as any).ensureReadyImpl();

    expect(
      imageGenStore.history.find(h => h.taskId === 'task_native_1')?.status,
    ).toBe('failed');
  });

  it('多候选（归属不可判定）→ 宁可不收，一律标失败', async () => {
    (imageGenTaskRepository.loadAll as jest.Mock).mockResolvedValue([
      nativeGhost,
    ]);
    readDirMock().mockResolvedValue([
      pngFile('gen_a.png', T0 + 5000),
      pngFile('gen_b.png', T0 + 6000),
    ]);

    await (imageGenStore as any).ensureReadyImpl();

    const g = imageGenStore.history.find(h => h.taskId === 'task_native_1');
    expect(g?.status).toBe('failed');
    expect(g?.uri).toBe('');
  });

  it('JS 写盘通道（DreamLite）→ 不去扫盘也不造假收编，文案说「无法落盘」', async () => {
    (imageGenTaskRepository.loadAll as jest.Mock).mockResolvedValue([jsGhost]);

    await (imageGenStore as any).ensureReadyImpl();

    expect(readDirMock()).not.toHaveBeenCalled();
    const g = imageGenStore.history.find(h => h.taskId === 'task_js_1');
    expect(g?.status).toBe('failed');
    expect(g?.errorDetail).toContain('无法落盘');
  });

  it('两条 running 同时存在 → 零扫盘零收养（严格唯一），均标失败', async () => {
    (imageGenTaskRepository.loadAll as jest.Mock).mockResolvedValue([
      nativeGhost,
      {...nativeGhost, taskId: 'task_native_2'},
    ]);
    readDirMock().mockResolvedValue([pngFile('gen_a.png', T0 + 5000)]);

    await (imageGenStore as any).ensureReadyImpl();

    expect(readDirMock()).not.toHaveBeenCalled();
    expect(
      imageGenStore.history.filter(h => h.status === 'failed').length,
    ).toBe(2);
  });

  it('mtime 不可得（库类型 Date | null）→ 不作证据，不收养', async () => {
    (imageGenTaskRepository.loadAll as jest.Mock).mockResolvedValue([
      nativeGhost,
    ]);
    readDirMock().mockResolvedValue([pngFile('gen_nomtime.png', null)]);

    await (imageGenStore as any).ensureReadyImpl();

    const g = imageGenStore.history.find(h => h.taskId === 'task_native_1');
    expect(g?.status).toBe('failed');
    expect(g?.uri).toBe('');
  });

  it('水合无 running：零 patch、零扫盘（无幽灵不写盘不读盘）', async () => {
    (imageGenTaskRepository.loadAll as jest.Mock).mockResolvedValue([okEntry]);

    await (imageGenStore as any).ensureReadyImpl();

    expect(imageGenTaskRepository.patchByTaskId).not.toHaveBeenCalled();
    expect(readDirMock()).not.toHaveBeenCalled();
    expect(imageGenStore.history).toHaveLength(1);
  });

  // 以本条收尾：它会改写单例的 readyPromise（模拟生产形态），不放到其它用例前。
  it('§169 死锁回归：按生产形态接 readyPromise 时，native 幽灵水合必须 settle', async () => {
    (imageGenTaskRepository.loadAll as jest.Mock).mockResolvedValue([
      nativeGhost,
    ]);
    readDirMock().mockResolvedValue([pngFile('gen_a.png', T0 + 5000)]);

    // 生产形态：readyPromise 就是这一次尚未 settle 的 ensureReadyImpl。
    // 旧写法在水合内调 init()，而 init() 末尾 await ensureReady() → 自锁；
    // 上面那些用例直接调 ensureReadyImpl() 不接门禁，所以抱不住这个 bug。
    // outDir 显式置空：单例被前面用例跑过会残留非空值，不重置则本用例失去鉴别力（§169 实测）。
    (imageGenStore as any).outDir = '';
    const impl = (imageGenStore as any).ensureReadyImpl();
    (imageGenStore as any).readyPromise = impl;

    const settled = await Promise.race([
      impl.then(() => 'SETTLED').catch(() => 'SETTLED'),
      new Promise(res => setTimeout(() => res('TIMEOUT'), 1500)),
    ]);
    expect(settled).toBe('SETTLED');

    // 且收编结果真的落地（不是靠门禁报错提前结束）
    const g = imageGenStore.history.find(h => h.taskId === 'task_native_1');
    expect(g?.status).toBe('success');
    expect(g?.uri).toBe(`file://${OUT_DIR}/gen_a.png`);
  });
});
