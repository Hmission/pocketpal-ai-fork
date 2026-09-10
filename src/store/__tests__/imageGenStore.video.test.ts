/**
 * imageGenStore 视频链单测（VIDEO_GEN_SPEC P2，§172 波）：
 * ①runGenTask 单点分派——快照带 videoFrames 走 genVideo，绝不触碰 txt2img；
 * ②C-4 守卫双向——视频 ctx 拦出图、图片 ctx 拦出片，均为显式失败非 native 未定义行为；
 * ③产物身份收口——uri=封面帧 + videoDir/frames/fps 经 finishTask 一次 patch 落列；
 * ④失败路径干净——genVideo reject → 任务落 failed，无假成功。
 */
jest.mock('../../repositories/ImageGenTaskRepository', () => {
  const patchByTaskId = jest.fn().mockResolvedValue(undefined);
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

jest.mock('../../repositories/ImageGenQueueRepository', () => ({
  imageGenQueueRepository: {
    loadAll: jest.fn().mockResolvedValue([]),
    // upsert 返权威行 id（项 46 契约）：固定值，否则 core 会把 item.id 采纳成 undefined
    upsert: jest.fn().mockResolvedValue('qrow_video'),
    removeByQueueId: jest.fn().mockResolvedValue(undefined),
    clearAll: jest.fn().mockResolvedValue(undefined),
  },
}));

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

// loadModel 路径会先确保提示词写手就绪；本套只验模态登记，不跑真引擎
jest.mock('../../services/promptWriter', () => ({
  promptWriter: {
    ensureLoaded: jest.fn().mockResolvedValue(undefined),
  },
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

// 视频/图片两条 native 路径的替身分明：genVideo/txt2img 各挂 spy，
// 断言「分派只命中其一」——静默丢任务与走错桥都在 spy 面暴露。
// 形制对齐 ghost 套：只给 NativeModules，不展开 requireActual 全量
//（展开会触发 RN 懒加载 getter → DevMenu TurboModule 在 node 环境不存在）。
jest.mock('react-native', () => {
  const ImageGenMock = {
    txt2img: jest.fn().mockResolvedValue('ERR_NOT_IN_TEST'),
    genVideo: jest.fn(),
    loadModel: jest.fn().mockResolvedValue(true),
    cancelTxt2img: jest.fn().mockResolvedValue(true),
    getGenSnapshot: jest.fn().mockResolvedValue({
      step: 0,
      steps: 0,
      time: 0,
    }),
  };
  return {
    NativeModules: {
      ImageGen: ImageGenMock,
      NightTask: {
        begin: jest.fn().mockResolvedValue(undefined),
        end: jest.fn().mockResolvedValue(undefined),
        start: jest.fn().mockResolvedValue(true),
        stop: jest.fn().mockResolvedValue(true),
        isIgnoringBatteryOptimizations: jest.fn().mockResolvedValue(true),
      },
    },
    AppState: {addEventListener: jest.fn(() => ({remove: jest.fn()}))},
    Platform: {OS: 'android', select: (o: any) => o.android},
  };
});

import {NativeModules} from 'react-native';

import {imageGenTaskRepository} from '../../repositories/ImageGenTaskRepository';
import {imageGenStore, VIDEO_DEFAULT_NEGATIVE_PROMPT} from '../imageGenStore';
import type {GenParamsSnapshot} from '../imageGenQueueCore';

const ImageGenMock = NativeModules.ImageGen as unknown as {
  txt2img: jest.Mock;
  genVideo: jest.Mock;
  loadModel: jest.Mock;
};

const WAN_SNAPSHOT: GenParamsSnapshot = {
  prompt: 'a running chick',
  negativePrompt: '',
  steps: 50,
  cfg: 5,
  width: 512,
  height: 512,
  ratio: '1:1',
  seed: 42,
  family: 'wan',
  modelId: 'wan21-t2v-13b-q4',
  loraEnabled: false,
  loraMultiplier: 1,
  mainPath: '/sdcard/Documents/AIOS/models/Wan2.1-T2V-1.3B-Q4_K_M.gguf',
  backend: 'OpenCL',
  videoFrames: 6,
  videoFps: 16,
};

/** 把 store 摆成「已驻留某模态 ctx」的形态（不触发真实 loadModel/native 链） */
const armCtx = (modality: 'image' | 'video') => {
  (imageGenStore as any).modelLoaded = true;
  (imageGenStore as any).loadedModelId =
    modality === 'video' ? WAN_SNAPSHOT.modelId : 'sd35-medium-q4';
  (imageGenStore as any).loadedModality = modality;
  (imageGenStore as any).outDir =
    '/data/user/0/com.pocketpalai/files/aios_images';
};

beforeEach(() => {
  jest.clearAllMocks();
  (imageGenTaskRepository.patchByTaskId as jest.Mock).mockResolvedValue(
    undefined,
  );
  (imageGenTaskRepository.create as jest.Mock).mockResolvedValue(undefined);
});

describe('runGenTask 视频分派（C-4 单点 + 产物身份）', () => {
  it('videoFrames 快照 → 只走 genVideo；uri=封面帧 + dir/frames/fps 落 patch', async () => {
    armCtx('video');
    ImageGenMock.genVideo.mockResolvedValueOnce(
      '/data/user/0/com.pocketpalai/files/aios_images/genvid_1_42|6|16',
    );
    const uri = await imageGenStore.runGenTask(WAN_SNAPSHOT);
    expect(uri).toBeTruthy();
    expect(ImageGenMock.genVideo).toHaveBeenCalledTimes(1);
    // txt2img 一枪不发：分派错误（走图片桥跑视频 ctx）当场暴露
    expect(ImageGenMock.txt2img).not.toHaveBeenCalled();
    // genVideo 入参契约：outDir 由 JS 构造（native 只 mkdir 不猜路径），帧数/fps 冻结值透传
    const params = ImageGenMock.genVideo.mock.calls[0][0];
    expect(params.videoFrames).toBe(6);
    expect(params.fps).toBe(16);
    expect(String(params.outDir)).toContain('/genvid_');
    // 落盘双写：begin（running，kind=video）→ finish（success + 产物身份 + 封面 uri）
    const patches = (imageGenTaskRepository.patchByTaskId as jest.Mock).mock
      .calls;
    const finish = patches[patches.length - 1]?.[1] as Record<string, unknown>;
    expect(finish?.status).toBe('success');
    expect(String(finish?.uri)).toMatch(/frame_0000\.png$/);
    expect(String(finish?.videoDir)).toContain('/genvid_');
    expect(finish?.videoFrames).toBe(6);
    expect(finish?.videoFps).toBe(16);
    const created = (imageGenTaskRepository.create as jest.Mock).mock
      .calls[0]?.[0] as Record<string, unknown>;
    expect(created?.status).toBe('running');
    const beginPatch = (imageGenTaskRepository.patchByTaskId as jest.Mock).mock
      .calls[0]?.[1] as Record<string, unknown>;
    // beginTask 内存先行 + DB create 后，无第二次 patch——首 patch 即 finishTask
    expect(beginPatch?.status).toBe('success');
  });

  it('genVideo 失败（Kotlin reject ERR_*）→ 任务落 failed，无假成功', async () => {
    armCtx('video');
    ImageGenMock.genVideo.mockRejectedValueOnce('ERR_GENERATE');
    const uri = await imageGenStore.runGenTask(WAN_SNAPSHOT);
    expect(uri).toBeNull();
    expect(ImageGenMock.txt2img).not.toHaveBeenCalled();
    const patches = (imageGenTaskRepository.patchByTaskId as jest.Mock).mock
      .calls;
    const last = patches[patches.length - 1]?.[1] as Record<string, unknown>;
    expect(last?.status).toBe('failed');
  });
});

describe('C-4 守卫双向（native 零防护由 JS 单点拦截）', () => {
  it('视频 ctx 上出图：generate() 显式失败，不发 txt2img', async () => {
    armCtx('video');
    const uri = await imageGenStore.generate('a cat', {
      steps: 4,
      cfg: 2,
      width: 512,
      height: 512,
    });
    expect(uri).toBeNull();
    expect(ImageGenMock.txt2img).not.toHaveBeenCalled();
    expect(imageGenStore.error).toContain('视频模型');
  });

  it('图片 ctx 上出片：generateVideo() 显式失败，不发 genVideo', async () => {
    armCtx('image');
    const v = await imageGenStore.generateVideo({
      prompt: 'a cat',
      steps: 50,
      cfg: 5,
      width: 512,
      height: 512,
      seed: 1,
      videoFrames: 6,
    });
    expect(v).toBeNull();
    expect(ImageGenMock.genVideo).not.toHaveBeenCalled();
    expect(imageGenStore.error).toContain('视频模型');
  });

  /**
   * 空负面词回归（§174.14 真机实测）：引擎里 T5 分块数 = tokens / chunk_len，空串会让
   * 那一次 conditioning 得到 0 块 → 返空 → conditioner.hpp 的 GGML_ASSERT 直接 abort
   * 进程（E0 十四秒即崩，点一次崩一次）。大王定的策略：没填→默认填充，填了→用用户的；
   * 而 store 是 UI / DRC / 队列的共用出口，所以收口只在这一处。
   */
  it('负面词为空/只空白 → 补默认负面词再进引擎（绝不把空串送进去）', async () => {
    armCtx('video');
    ImageGenMock.genVideo.mockResolvedValueOnce(
      '/data/user/0/com.pocketpalai/files/aios_images/genvid_9_1|1|16',
    );
    await imageGenStore.generateVideo({
      prompt: 'a cat',
      steps: 4,
      cfg: 5,
      width: 256,
      height: 256,
      seed: 1,
      videoFrames: 1,
      negativePrompt: '   ',
    });
    const params = ImageGenMock.genVideo.mock.calls[0][0] as {
      negativePrompt: string;
    };
    expect(params.negativePrompt.trim().length).toBeGreaterThan(0);
    expect(params.negativePrompt).toBe(VIDEO_DEFAULT_NEGATIVE_PROMPT);
  });

  it('用户填了负面词 → 原样透传，不得覆盖成默认', async () => {
    armCtx('video');
    ImageGenMock.genVideo.mockResolvedValueOnce(
      '/data/user/0/com.pocketpalai/files/aios_images/genvid_9_2|1|16',
    );
    await imageGenStore.generateVideo({
      prompt: 'a cat',
      steps: 4,
      cfg: 5,
      width: 256,
      height: 256,
      seed: 2,
      videoFrames: 1,
      negativePrompt: 'cartoon, low res',
    });
    const params = ImageGenMock.genVideo.mock.calls[0][0] as {
      negativePrompt: string;
    };
    expect(params.negativePrompt).toBe('cartoon, low res');
  });
});

/**
 * C-4 登记面回归（§173 真机首跑抓出的缺陷）：UI 的 loadModel 只传 backend 不传
 * modality，当时 store 盲信 extras → Wan 明明驻留却被自己的守卫拦下。
 * 现收归 store 按 manifest id 单点派生，故本例的 extras 形状故意与当时一致（无 modality）。
 */
describe('C-4 模态登记单点派生（不信任调用方透传）', () => {
  // 不取 WAN_SNAPSHOT.mainPath（快照字段可选）：本例要的是确定路径
  const wanMain = '/sdcard/Documents/AIOS/models/Wan2.1-T2V-1.3B-Q4_K_M.gguf';

  it('视频 id + 无 modality 的 extras → 仍登记为 video', async () => {
    const ok = await imageGenStore.loadModel(
      wanMain,
      {
        t5xxl: '/sdcard/Documents/AIOS/models/umt5-xxl-encoder-Q3_K_M.gguf',
        vae: '/sdcard/Documents/AIOS/models/wan_2.1_vae.safetensors',
        backend: 'OpenCL',
      },
      'wan21-t2v-13b-q4',
    );
    expect(ok).toBe(true);
    expect((imageGenStore as any).loadedModality).toBe('video');
  });

  it('图片 id → 登记为 image（视频字段不得污染存量面）', async () => {
    const ok = await imageGenStore.loadModel(
      '/sdcard/Documents/AIOS/models/sd35_medium_q4_k_m.gguf',
      {clipL: 'a', clipG: 'b', vae: 'c', backend: 'CPU', modality: 'video'},
      'sd35-medium-q4',
    );
    expect(ok).toBe(true);
    // manifest 派生胜过调用方透传：乱传 video 也不采纳
    expect((imageGenStore as any).loadedModality).toBe('image');
  });

  it('无 id（DRC 取证通道）→ 回落 extras.modality', async () => {
    const ok = await imageGenStore.loadModel(wanMain, {
      t5xxl: 'x',
      vae: 'y',
      backend: 'OpenCL',
      modality: 'video',
    });
    expect(ok).toBe(true);
    expect((imageGenStore as any).loadedModality).toBe('video');
  });
});
