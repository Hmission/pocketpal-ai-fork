/**
 * ImageGenStore — 生图能力桥（P5.2）
 *
 * 单例引擎约束：与聊天模型互斥。generate() 前需已调用 loadModel()；
 * 聊天前需 unloadModel() 释放内存（SDXL Q4 ~2.5GB）。
 * UI 层（生图 Tab）通过此 store 驱动加载/出图/进度。
 */
import {makeAutoObservable, runInAction} from 'mobx';
import {NativeModules, NativeEventEmitter} from 'react-native';
import * as RNFS from '@dr.pogodin/react-native-fs';

const ImageGen = NativeModules.ImageGen;

// 进度事件源（JNI sd_set_progress_callback → Kotlin → RN）
const emitter = ImageGen ? new NativeEventEmitter(ImageGen) : null;

export interface GeneratedImage {
  uri: string;
  prompt: string;
  seed: number;
  ts: number;
  width: number;
  height: number;
}

class ImageGenStore {
  /** 引擎是否已加载（SD 模型常驻标记） */
  modelLoaded = false;
  /** 出图任务是否进行中 */
  generating = false;
  /** 最近一次错误信息 */
  error: string | null = null;
  /** 生成历史（内存态，不持久化） */
  history: GeneratedImage[] = [];
  /** 聊天意图路由带入的待生成提示词（M6 豆包化） */
  pendingPrompt: string | null = null;
  /** 生成进度（0-100，-1 表示无进度） */
  progress = -1;
  /** 进度文本（step/steps） */
  progressText = '';
  /** 输出目录（App 私有 filesDir 下） */
  private outDir = '';

  constructor() {
    makeAutoObservable(this);
    // 订阅原生进度事件
    if (emitter) {
      emitter.addListener(
        'ImageGenProgress',
        (e: {step: number; steps: number}) => {
          runInAction(() => {
            this.progress =
              e.steps > 0 ? Math.round((e.step / e.steps) * 100) : -1;
            this.progressText = `${e.step}/${e.steps}`;
          });
        },
      );
    }
  }

  async init(): Promise<void> {
    try {
      this.outDir = `${RNFS.DocumentDirectoryPath}/aios_images`;
      await RNFS.mkdir(this.outDir);
    } catch (e) {
      console.warn('[ImageGenStore] init failed:', e);
    }
  }

  /**
   * 加载生图模型。调用前应确保聊天模型已卸载（modelStore 释放），
   * 否则可能 OOM。返回加载是否成功。
   */
  async loadModel(modelPath: string): Promise<boolean> {
    try {
      const ok = await ImageGen.loadModel(modelPath);
      runInAction(() => {
        this.modelLoaded = ok;
        this.error = ok ? null : '模型加载失败';
      });
      return ok;
    } catch (e: any) {
      runInAction(() => {
        this.error = `加载失败: ${e?.message ?? e}`;
      });
      return false;
    }
  }

  /** 卸载生图模型（把内存还给聊天模型） */
  async unloadModel(): Promise<void> {
    try {
      await ImageGen.unloadModel();
    } catch (e) {
      console.warn('[ImageGenStore] unload failed:', e);
    }
    runInAction(() => {
      this.modelLoaded = false;
    });
  }

  /**
   * 文生图。成功后返回图片本地 URI。
   * @param prompt 提示词
   * @param opts 步数/CFG/尺寸/种子
   */
  async generate(
    prompt: string,
    opts: {
      steps?: number;
      cfg?: number;
      width?: number;
      height?: number;
      seed?: number;
      negativePrompt?: string;
    } = {},
  ): Promise<string | null> {
    if (!this.modelLoaded) {
      runInAction(() => {
        this.error = '生图模型未加载';
      });
      return null;
    }
    if (!this.outDir) {
      await this.init();
    }
    const seed = opts.seed ?? Math.floor(Math.random() * 2 ** 31);
    const fileName = `gen_${Date.now()}_${seed}.png`;
    const outPath = `${this.outDir}/${fileName}`;
    runInAction(() => {
      this.generating = true;
      this.error = null;
      this.progress = -1;
      this.progressText = '';
    });
    try {
      const result = await ImageGen.txt2img({
        prompt,
        negativePrompt: opts.negativePrompt ?? '',
        seed,
        steps: opts.steps ?? 2,
        cfg: opts.cfg ?? 2.0,
        width: opts.width ?? 512,
        height: opts.height ?? 512,
        outPath,
      });
      if (typeof result === 'string' && result.startsWith('ERR_')) {
        runInAction(() => {
          this.error = result;
        });
        return null;
      }
      runInAction(() => {
        this.history.unshift({
          uri: `file://${outPath}`,
          prompt,
          seed,
          ts: Date.now(),
          width: opts.width ?? 512,
          height: opts.height ?? 512,
        });
        if (this.history.length > 50) {
          this.history = this.history.slice(0, 50);
        }
      });
      return `file://${outPath}`;
    } catch (e: any) {
      runInAction(() => {
        this.error = `出图失败: ${e?.message ?? e}`;
      });
      return null;
    } finally {
      runInAction(() => {
        this.generating = false;
        this.progress = -1;
        this.progressText = '';
      });
    }
  }
}

export const imageGenStore = new ImageGenStore();
