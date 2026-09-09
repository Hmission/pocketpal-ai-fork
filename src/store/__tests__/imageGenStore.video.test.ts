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
    upsert: jest.fn().mockResolvedValue(undefined),
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
import {imageGenStore} from '../imageGenStore';
import type {GenParamsSnapshot} from '../imageGenQueueCore';

const ImageGenMock = NativeModules.ImageGen as unknown as {
  txt2img: jest.Mock;
  genVideo: jest.Mock;
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
    modality === 'video' ? WAN_SNAPSHOT.modelId : 'sd35-medium';
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
});
