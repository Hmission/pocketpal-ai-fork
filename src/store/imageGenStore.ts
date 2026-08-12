/**
 * ImageGenStore — 生图能力桥（P5.2）
 *
 * 单例引擎约束：与聊天模型互斥。generate() 前需已调用 loadModel()；
 * 聊天前需 unloadModel() 释放内存（SDXL Q4 ~2.5GB）。
 * UI 层（生图 Tab）通过此 store 驱动加载/出图/进度。
 */
import {makeAutoObservable, runInAction} from 'mobx';
import {NativeModules} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as RNFS from '@dr.pogodin/react-native-fs';
import {engineMutex} from './engineMutex';
import {engineStatus} from './engineStatus';

const ImageGen = NativeModules.ImageGen;
const HISTORY_KEY = '@imagegen_history_v1';

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
  /** 模型加载中 */
  loading = false;
  /** 加载开始时间戳 */
  loadingStartedAt = 0;
  /** 生成进度（0-100，-1 表示无进度） */
  progress = -1;
  /** 进度文本（step/steps） */
  progressText = '';
  /** 当前阶段（引擎日志最新行，已去 file:line 前缀） */
  stage = '';
  /** 最近引擎日志（新在前，最多 3 行） */
  logTail: string[] = [];
  /** 最近一次引擎事件时间戳（心跳判活） */
  lastEventAt = 0;
  /** 上一个采样步耗时（秒） */
  stepTime = 0;
  /** 本次出图开始时间戳 */
  genStartedAt = 0;
  /** 输出目录（App 私有 filesDir 下） */
  private outDir = '';

  constructor() {
    makeAutoObservable(this);
    // 互斥：chat 引擎加载前会调本 releaser 释放 sd 引擎
    engineMutex.register('image', async () => {
      await this.unloadModel();
    });
  }

  /** 进度快照轮询定时器（推拉反转：1Hz 单通道 pull，替代事件风暴） */
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private syncPoll() {
    const active = this.loading || this.generating;
    if (active && !this.pollTimer) {
      this.pollTimer = setInterval(() => this.pullSnapshot(), 1000);
    } else if (!active && this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }
  private async pullSnapshot() {
    try {
      const s = await ImageGen.getGenSnapshot();
      runInAction(() => {
        if (s.steps > 0) {
          this.progress = Math.round((s.step / s.steps) * 100);
          this.progressText = `${s.step}/${s.steps}`;
        }
        this.stepTime = s.time ?? 0;
        if (s.stage) {
          this.stage = s.stage.length > 120 ? s.stage.slice(0, 120) + '…' : s.stage;
        }
        if (s.lastEvent) {
          this.lastEventAt = s.lastEvent;
        }
      });
      engineStatus.setProgress('image', this.progress, `采样 ${this.progressText}`);
    } catch {
      /* 快照不可用时静默 */
    }
  }

  async init(): Promise<void> {
    try {
      this.outDir = `${RNFS.DocumentDirectoryPath}/aios_images`;
      await RNFS.mkdir(this.outDir);
    } catch (e) {
      console.warn('[ImageGenStore] init failed:', e);
    }
    // 历史持久化：重启后恢复（图片文件仍在磁盘，仅元数据落盘）
    try {
      const raw = await AsyncStorage.getItem(HISTORY_KEY);
      if (raw) {
        const list = JSON.parse(raw) as GeneratedImage[];
        runInAction(() => {
          this.history = Array.isArray(list) ? list : [];
        });
      }
    } catch (e) {
      console.warn('[ImageGenStore] load history failed:', e);
    }
  }

  /** 历史元数据落盘（fire-and-forget） */
  private persistHistory() {
    AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(this.history)).catch(() => {});
  }

  /** 删除单条历史（可选删文件） */
  async deleteHistory(uris: string[], removeFile = false): Promise<void> {
    runInAction(() => {
      this.history = this.history.filter(h => !uris.includes(h.uri));
    });
    this.persistHistory();
    if (removeFile) {
      for (const uri of uris) {
        try {
          await RNFS.unlink(uri.replace(/^file:\/\//, ''));
        } catch {
          /* 文件可能已不存在 */
        }
      }
    }
  }

  /** 存到系统相册（MediaStore → Pictures/AIOS） */
  async saveToAlbum(uri: string): Promise<boolean> {
    try {
      const path = uri.replace(/^file:\/\//, '');
      await ImageGen.saveToAlbum(path);
      return true;
    } catch (e) {
      runInAction(() => {
        this.error = `存相册失败: ${(e as any)?.message ?? e}`;
      });
      return false;
    }
  }

  /**
   * 加载生图模型。调用前应确保聊天模型已卸载（modelStore 释放），
   * 否则可能 OOM。返回加载是否成功。
   * extras：拆分式模型的伴侣文件（SD3.5 → clipL/clipG/vae；Z-Image → llm/vae），
   * 一体式模型（SDXL Turbo）不传。
   */
  async loadModel(
    modelPath: string,
    extras: {clipL?: string; clipG?: string; llm?: string; vae?: string} = {},
  ): Promise<boolean> {
    // 互斥：加载 sd 前确保 chat 引擎已释放（自动调 modelStore.releaseContext）
    await engineMutex.acquire('image');
    runInAction(() => {
      this.loading = true;
      this.error = null;
      this.stage = '';
      this.logTail = [];
      this.lastEventAt = Date.now();
      this.loadingStartedAt = Date.now();
    });
    this.syncPoll();
    engineStatus.setPhase('image', 'loading', '加载生图引擎…');
    try {
      const ok = await ImageGen.loadModel(modelPath, extras);
      runInAction(() => {
        this.modelLoaded = ok;
        this.loading = false;
        this.error = ok ? null : '模型加载失败';
      });
      this.syncPoll();
      engineStatus.setPhase('image', ok ? 'ready' : 'error', ok ? '' : '模型加载失败');
      return ok;
    } catch (e: any) {
      runInAction(() => {
        this.loading = false;
        this.error = `加载失败: ${e?.message ?? e}`;
      });
      this.syncPoll();
      engineStatus.setError('image', `加载失败: ${e?.message ?? e}`);
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
      this.loading = false;
    });
    this.syncPoll();
    engineStatus.setPhase('image', 'idle');
    engineMutex.release();
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
      engineStatus.setError('image', '生图模型未加载');
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
      this.stage = '';
      this.logTail = [];
      this.stepTime = 0;
      this.lastEventAt = Date.now();
      this.genStartedAt = Date.now();
    });
    this.syncPoll();
    engineStatus.setPhase('image', 'running', '准备出图…');
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
        engineStatus.setError('image', result);
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
      this.persistHistory();
      engineStatus.setPhase('image', 'ready');
      return `file://${outPath}`;
    } catch (e: any) {
      runInAction(() => {
        this.error = `出图失败: ${e?.message ?? e}`;
      });
      engineStatus.setError('image', `出图失败: ${e?.message ?? e}`);
      return null;
    } finally {
      runInAction(() => {
        this.generating = false;
        this.progress = -1;
        this.progressText = '';
      });
      this.syncPoll();
    }
  }
}

export const imageGenStore = new ImageGenStore();
