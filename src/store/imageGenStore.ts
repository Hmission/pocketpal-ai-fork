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
import {
  loadDreamLite,
  unloadDreamLite,
  generateDreamLite,
  editDreamLite,
  decodeImageToRgb,
} from '../services/dreamLiteEngine';
import {
  ensureSuperResModels,
  loadSuperRes,
  unloadSuperRes,
  upscaleImage,
  SRStyle,
} from '../services/superResEngine';
import {runCaption, CaptionStage} from '../services/captionEngine';
import {imageGenTaskRepository} from '../repositories/ImageGenTaskRepository';
import {engineMutex} from './engineMutex';
import {engineStatus} from './engineStatus';
import {emit} from '../debug/eventStream';

const ImageGen = NativeModules.ImageGen;
const HISTORY_KEY = '@imagegen_history_v1';
/** B28：B27 时代 mobx-persist-store 存储 key（存量迁移源） */
const B28_STORAGE_KEY = 'ImageGenStore';

export interface GeneratedImage {
  uri: string;
  prompt: string;
  seed: number;
  ts: number;
  width: number;
  height: number;
  steps?: number;
  cfg?: number;
  family?: string;
  /** 来源：生图结果 or 用户上传（用于编辑的本地图） or 高清放大结果 or 反推任务 or 转写任务 */
  kind?: 'generated' | 'upload' | 'upscaled' | 'caption' | 'transcribe';
  /** 放大任务：源图 URI（running 页背景展示原图 + 半透明进度） */
  sourceUri?: string;
  /** 生成耗时（ms）与模型标签：预览卡顶部信息条展示 */
  durationMs?: number;
  modelLabel?: string;
  /** 任务唯一 id（FlatList key 单一事实源；running/failed 任务无图也有条目） */
  taskId: string;
  /** 任务状态：running=进行中（空白预览页+进度）｜success=已回填图｜failed=保留报错页 */
  status: 'running' | 'success' | 'failed';
  /** 失败任务：一句话摘要（预览页展示） */
  errorSummary?: string;
  /** 失败任务：完整报错报告（errorReport 格式，一键复制） */
  errorDetail?: string;
}

class ImageGenStore {
  /** 引擎是否已加载（SD 模型常驻标记） */
  modelLoaded = false;
  /** 当前驻留的 SD 模型 id（下拉行内按钮状态：加载/卸载） */
  loadedModelId: string | null = null;
  /** DreamLite 引擎是否已加载 */
  dreamliteLoaded = false;
  /** 出图任务是否进行中 */
  generating = false;
  /** 高清放大任务进行中（UpscalePanel 执行态/防重复触发） */
  upscaleBusy = false;
  /** 最近一次错误信息 */
  error: string | null = null;
  /** 生成历史（内存态；B28 起由 WatermelonDB image_gen_tasks 表持久化） */
  history: GeneratedImage[] = [];
  /** B28：就绪链（快照恢复 + DB 水合 + 存量迁移）；写路径先 await 保证写在水合后 */
  private readyPromise: Promise<void> = Promise.resolve();
  /** 聊天意图路由带入的待生成提示词（M6 豆包化） */
  pendingPrompt: string | null = null;
  /** 聊天图片卡片「编辑图片」带入的待编辑源图 URI（2026-08 闭环扩展） */
  pendingEditSource: string | null = null;
  /** 聊天内联生图任务进行中（ActiveTaskBanner 借此在聊天生图时隐藏顶部横幅） */
  chatInlineGenerating = false;
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
  /** 当前引擎后端（manifest 透传：'CPU' | 'OpenCL' | 'Vulkan'；空走引擎默认 CPU） */
  backend: string | null = null;
  /** 08-18：GPU renderer（设备兼容性分级：requiresHighGpu 模型在 740 级灰置） */
  gpuRenderer = '';

  constructor() {
    makeAutoObservable(this);
    // 互斥：chat 引擎加载前会调本 releaser 释放 sd/dreamlite 双引擎；
    // P6-6 复查：超分引擎也纳入（放大中切聊天 → 释放超分防内存叠加/并发）
    engineMutex.register('image', async () => {
      await this.unloadModel();
      if (this.dreamliteLoaded) {
        runInAction(() => {
          this.dreamliteLoaded = false;
        });
        try {
          await unloadDreamLite();
        } catch {
          /* releaser 内静默：卸载失败不影响 chat 引擎加载 */
        }
      }
      try {
        await unloadSuperRes();
      } catch {
        /* releaser 内静默 */
      }
    });
    // B28：生图元数据落 WatermelonDB（对齐聊天存储架构，自动获得 B14 整库快照保护）。
    // 构造即发起就绪链：prepareSharedStorage（快照恢复）→ DB 全量水合 → AsyncStorage 存量迁移。
    // 写路径先 await ensureReady()——水合/迁移完成后才允许写（2026-08-21 覆盖事故终态根治）
    this.readyPromise = this.ensureReadyImpl();
  }

  /** B28 就绪门禁：所有写持久化路径先 await 本方法 */
  private async ensureReady(): Promise<void> {
    await this.readyPromise;
  }

  private async ensureReadyImpl(): Promise<void> {
    try {
      // 快照恢复门 + DB 全量水合
      const rows = await imageGenTaskRepository.loadAll();
      runInAction(() => {
        this.history = rows;
      });
      await this.migrateAsyncStorageToDb();
      // 幽灵任务治理（2026-08-21 真机实证）：app 强杀/异常退出后，DB 中
      // status='running' 的遗留条目水合回来时并无推理进程——原样恢复会
      // 永久卡在 running 页（空白预览 + 进度卡 + genStartedAt=0 荒谬耗时）。
      // 锋利哲学：显式失败不静默——统一置 failed（报错页可复制/重试/删除），
      // 放在迁移之后以覆盖存量源合入的 running 条目。
      const ghost = this.history.filter(h => h.status === 'running');
      if (ghost.length > 0) {
        const patch = {
          status: 'failed' as const,
          errorSummary: '生成中断',
          errorDetail:
            '应用在上次生成中被强制退出，任务未完成（恢复时标记中断）',
        };
        runInAction(() => {
          this.history = this.history.map(h =>
            h.status === 'running' ? {...h, ...patch} : h,
          );
        });
        for (const g of ghost) {
          await imageGenTaskRepository.patchByTaskId(g.taskId, patch);
        }
        console.info(
          `[ImageGenStore] ghost running tasks marked failed: ${ghost.length}`,
        );
      }
    } catch (e) {
      console.warn('[ImageGenStore] ready failed (history stays empty):', e);
    }
  }

  /** B28：AsyncStorage 存量一次性迁移（ImageGenStore key + 旧 @imagegen_history_v1）→ DB → 删 key */
  private async migrateAsyncStorageToDb(): Promise<void> {
    try {
      const sources: GeneratedImage[] = [];
      for (const key of [B28_STORAGE_KEY, HISTORY_KEY]) {
        const raw = await AsyncStorage.getItem(key);
        if (!raw) {
          continue;
        }
        try {
          const parsed = JSON.parse(raw);
          const list: GeneratedImage[] = Array.isArray(parsed)
            ? parsed
            : Array.isArray(parsed?.history)
            ? parsed.history
            : [];
          sources.push(...list);
        } catch {
          /* 单 key 解析失败跳过 */
        }
      }
      if (sources.length === 0) {
        return;
      }
      const seen = new Set(this.history.map(h => h.taskId || h.uri));
      const added = sources.filter(h => !seen.has(h.taskId || h.uri));
      if (added.length > 0) {
        await imageGenTaskRepository.createBatch(added);
        runInAction(() => {
          this.history = [...added, ...this.history];
        });
        console.info(`[ImageGenStore] AsyncStorage history migrated to DB: +${added.length}`);
      }
      await AsyncStorage.removeItem(B28_STORAGE_KEY);
      await AsyncStorage.removeItem(HISTORY_KEY);
    } catch (e) {
      console.warn('[ImageGenStore] AsyncStorage migration failed:', e);
    }
  }

  /** 聊天内联生图标志（runImageTaskCard 单链路设置/复位；仅渲染层消费） */
  setChatInlineGenerating = (v: boolean) => {
    runInAction(() => {
      this.chatInlineGenerating = v;
    });
  };

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
      // 干净失败：生成中 120s 无引擎事件（心跳停）→ 判定 native 采样 hang。
      // 锋利哲学：明确报错+停任务，不静默回退不重试（无兑底）。
      // 6.16 修正：CPU 后端全链路含 VAE 解码（无心跳阶段），120s 会误判；
      // OpenCL 首次运行含 kernel 编译（无事件期）同样需放宽。
      // CPU/OpenCL 用 600s（10 分钟），仅 Vulkan 保持 120s 快速兜底。
      const timeoutMs = this.backend === 'Vulkan' ? 120_000 : 600_000;
      if (
        this.generating &&
        this.lastEventAt > 0 &&
        Date.now() - this.lastEventAt > timeoutMs
      ) {
        runInAction(() => {
          this.generating = false;
          this.error = '采样超时（引擎无响应），请重启应用后重试';
        });
        engineStatus.setError(
          'image',
          '采样超时（引擎无响应），请重启应用后重试',
        );
        this.syncPoll();
        return;
      }
      runInAction(() => {
        if (s.steps > 0) {
          this.progress = Math.round((s.step / s.steps) * 100);
          this.progressText = `${s.step}/${s.steps}`;
        }
        this.stepTime = s.time ?? 0;
        if (s.stage) {
          this.stage =
            s.stage.length > 120 ? s.stage.slice(0, 120) + '…' : s.stage;
        }
        if (s.lastEvent) {
          this.lastEventAt = s.lastEvent;
        }
      });
      engineStatus.setProgress(
        'image',
        this.progress,
        `采样 ${this.progressText}`,
      );
      // DRC 事件流：生图进度（1Hz 轮询即节流，throttleKey 防冗余）
      emit(
        'imagegen',
        'imagegen.stage',
        {
          progress: this.progress,
          stage: this.stage,
          stepTime: this.stepTime,
        },
        'imagegen.stage',
      );
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
    // 08-18：GPU 探测（设备分级，失败留空=不灰置任何模型，锋利不兖底）
    try {
      const r = await ImageGen.getGpuRenderer();
      runInAction(() => {
        this.gpuRenderer = typeof r === 'string' ? r : '';
      });
    } catch {
      /* GPU 探测失败静默 */
    }
    // B28：history 水合/存量迁移由 WatermelonDB 就绪链（构造即发起）接管，
    // 不再依赖本 init（UI 挂载时序）——2026-08-21 覆盖事故终态根治
    await this.ensureReady();
  }

  private newTaskId(): string {
    return `task_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
  }

  /**
   * 任务化单一入口：新建 running 任务（无图，预览区空白页+进度），
   * 返回 taskId；成功 finishTask 回填图，失败 failTask 回填报错。
   * B28：内存先行（UI 即时反馈）+ DB 落盘（await 保证写在水合后）。
   */
  async beginTask(base: Omit<GeneratedImage, 'taskId' | 'status'>): Promise<string> {
    await this.ensureReady();
    const taskId = this.newTaskId();
    const entry: GeneratedImage = {...base, taskId, status: 'running'};
    runInAction(() => {
      this.history.unshift(entry);
      if (this.history.length > 50) {
        this.history = this.history.slice(0, 50);
      }
    });
    await imageGenTaskRepository.create(entry);
    return taskId;
  }

  private async patchTask(
    taskId: string,
    patch: Partial<GeneratedImage>,
  ): Promise<void> {
    await this.ensureReady();
    runInAction(() => {
      const idx = this.history.findIndex(h => h.taskId === taskId);
      if (idx >= 0) {
        this.history[idx] = {...this.history[idx], ...patch};
      }
    });
    await imageGenTaskRepository.patchByTaskId(taskId, patch);
  }

  /** 任务成功：回填图片 URI（+ 可选 durationMs 等补充字段） */
  async finishTask(
    taskId: string,
    uri: string,
    patch?: Partial<GeneratedImage>,
  ): Promise<void> {
    await this.patchTask(taskId, {uri, status: 'success', ...patch});
  }

  /** 任务失败：回填报错摘要/详情，页面保留（测试员可一键复制） */
  async failTask(
    taskId: string,
    errorSummary: string,
    errorDetail: string,
  ): Promise<void> {
    await this.patchTask(taskId, {status: 'failed', errorSummary, errorDetail});
  }

  /** 非生成类错误（加载失败/缺伴侣文件/解码失败）直接落 failed 任务条目 */
  async pushFailedTask(
    base: Omit<GeneratedImage, 'taskId' | 'status'>,
    errorSummary: string,
    errorDetail: string,
  ): Promise<string> {
    await this.ensureReady();
    const taskId = this.newTaskId();
    const entry: GeneratedImage = {
      ...base,
      taskId,
      status: 'failed',
      errorSummary,
      errorDetail,
    };
    runInAction(() => {
      this.history.unshift(entry);
      if (this.history.length > 50) {
        this.history = this.history.slice(0, 50);
      }
    });
    await imageGenTaskRepository.create(entry);
    return taskId;
  }

  /**
   * runCaptionTask — 图像反推任务化（创作工坊 P1，IMAGEGEN_UI_SPEC §7.2）
   * 入画廊与生图任务同管理：beginTask(running) → 反推 → finishTask 回填
   * （prompt=反推提示词，uri=原图）／ failTask 报错页。
   * 返回反推文本（成功）或 null（失败，error 已写 store.error）。
   */
  async runCaptionTask(imageUri: string): Promise<string | null> {
    const path = imageUri.replace('file://', '');
    const startTs = Date.now();
    const taskId = await this.beginTask({
      uri: imageUri,
      prompt: '',
      seed: 0,
      ts: startTs,
      width: 0,
      height: 0,
      family: 'dreamlite',
      kind: 'caption',
      modelLabel: '反推 VLM',
    });
    runInAction(() => {
      this.generating = true;
      this.genStartedAt = startTs;
      this.progress = -1;
      this.progressText = '';
      this.stepTime = 0;
      this.error = null;
      this.stage = '查找视觉模型…';
    });
    const stageText: Record<CaptionStage, string> = {
      find: '查找视觉模型…',
      load: '加载视觉模型…',
      encode: '编码图片…',
      generate: '生成描述…',
      done: '反推完成',
    };
    try {
      const r = await runCaption(path, s => {
        runInAction(() => {
          this.stage = stageText[s];
        });
      });
      if (!r.text) {
        const msg = r.error ?? '反推失败';
        runInAction(() => {
          this.error = msg;
        });
        await this.failTask(taskId, '反推失败', msg);
        return null;
      }
      await this.finishTask(taskId, imageUri, {
        prompt: r.text,
        durationMs: Date.now() - startTs,
      });
      return r.text;
    } catch (e: any) {
      const msg = `反推异常: ${e?.message ?? e}`;
      runInAction(() => {
        this.error = msg;
      });
      await this.failTask(taskId, '反推失败', msg);
      return null;
    } finally {
      runInAction(() => {
        this.generating = false;
        this.progress = -1;
        this.progressText = '';
        this.stage = '';
      });
    }
  }

  /** 删除单条任务（无文件条目跳过删文件）；B28：DB + 内存 + 文件三删 */
  async deleteTask(taskId: string): Promise<void> {
    await this.ensureReady();
    const target = this.history.find(h => h.taskId === taskId);
    runInAction(() => {
      this.history = this.history.filter(h => h.taskId !== taskId);
    });
    await imageGenTaskRepository.removeByTaskId(taskId);
    if (target?.uri) {
      RNFS.unlink(target.uri.replace(/^file:\/\//, '')).catch(() => {});
    }
  }

  /** 推入历史（DreamLite/通用），供结果轮播回填参数；B28：DB + 内存双写 */
  async pushHistory(entry: GeneratedImage): Promise<void> {
    await this.ensureReady();
    runInAction(() => {
      this.history.unshift(entry);
      if (this.history.length > 50) {
        this.history = this.history.slice(0, 50);
      }
    });
    await imageGenTaskRepository.create(entry);
  }

  /** 删除单条历史（可选删文件；无 uri 条目自动跳过删文件）；B28：DB + 内存 + 文件三删 */
  async deleteHistory(uris: string[], removeFile = false): Promise<void> {
    await this.ensureReady();
    runInAction(() => {
      this.history = this.history.filter(h => !uris.includes(h.uri));
    });
    await imageGenTaskRepository.removeByUris(uris);
    if (removeFile) {
      for (const uri of uris) {
        if (!uri) {
          continue;
        }
        try {
          await RNFS.unlink(uri.replace(/^file:\/\//, ''));
        } catch {
          /* 文件可能已不存在 */
        }
      }
    }
  }

  /** B27：相册记录一次性恢复（DRC imagegen.recoverHistory 调用）——扫描磁盘图文件重建
   * legacy 条目并与现有 history 合并去重（uri 唯一）。开发工具性质，非产品兜底机制。 */
  async recoverHistoryFromDisk(): Promise<number> {
    await this.ensureReady();
    const dir = `${RNFS.DocumentDirectoryPath}/aios_images`;
    const root = RNFS.DocumentDirectoryPath;
    const entries: GeneratedImage[] = [];
    const scan = async (path: string) => {
      let names: string[] = [];
      try {
        names = (await RNFS.readDir(path)).map(f => f.name);
      } catch {
        return; // 目录不存在静默
      }
      for (const name of names) {
        const m = name.match(/^(gen|upscaled|dreamlite)_(\d{13})(?:_(\d+))?\.png$/);
        if (!m) {
          continue;
        }
        const ts = parseInt(m[2], 10);
        const kind: 'generated' | 'upscaled' =
          m[1] === 'upscaled' ? 'upscaled' : 'generated';
        entries.push({
          uri: `file://${path}/${name}`,
          prompt: kind === 'upscaled' ? '高清放大（恢复条目）' : '历史生成（恢复条目）',
          seed: m[3] ? parseInt(m[3], 10) : ts % 1e9,
          ts,
          width: 0,
          height: 0,
          modelLabel: kind === 'upscaled' ? 'RealESRGAN' : undefined,
          kind,
          taskId: `legacy_${ts}_${name.slice(0, 24)}`,
          status: 'success' as const,
        });
      }
    };
    await scan(dir); // aios_images/gen_* + upscaled_*
    await scan(root); // files 根目录 dreamlite_*（旧路径兼容）
    const seen = new Set(this.history.map(h => h.uri));
    const fresh = entries.filter(e => !seen.has(e.uri));
    if (fresh.length > 0) {
      await imageGenTaskRepository.createBatch(fresh);
      runInAction(() => {
        this.history = [...fresh, ...this.history].slice(0, 200);
      });
    }
    return fresh.length;
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
   * extras：拆分式模型的伴侣文件（SD3.5 → clipL/clipG/vae；Z-Image → llm/vae）+ backend
   * （manifest defaults 单点决策，'CPU'|'Vulkan'；一体式模型如 SDXL Turbo 只传 backend）。
   */
  async loadModel(
    modelPath: string,
    extras: {
      clipL?: string;
      clipG?: string;
      llm?: string;
      vae?: string;
      backend?: string;
    } = {},
    id?: string,
  ): Promise<boolean> {
    // 同槽互斥：加载 sd 前释放 DreamLite（双驻留会 OOM）
    if (this.dreamliteLoaded) {
      runInAction(() => {
        this.dreamliteLoaded = false;
      });
      try {
        await unloadDreamLite();
      } catch (e) {
        console.warn('[DreamLite] unload before sd load failed:', e);
      }
    }
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
      // 单后端铁律（锋利哲学）：backend 由 manifest 单点决策，加载失败=干净失败
      // （明确报错+释放），禁自动回退重试——回退会让 this.backend 与真实后端
      // 脱钩（超时窗口误判），且违「无 fallback 链」声明。
      const ok = await ImageGen.loadModel(modelPath, extras);
      runInAction(() => {
        this.modelLoaded = ok;
        this.loadedModelId = ok ? (id ?? null) : null;
        // 6.16：保存 backend 供超时窗口动态调整（CPU 后端 VAE 解码慢，需放宽）
        this.backend = ok ? (extras.backend ?? 'CPU') : null;
        this.loading = false;
        this.error = ok ? null : '模型加载失败';
      });
      this.syncPoll();
      engineStatus.setPhase(
        'image',
        ok ? 'ready' : 'error',
        ok ? '' : '模型加载失败',
      );
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
      this.loadedModelId = null;
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
      loraPath?: string;
      loraMultiplier?: number;
      modelLabel?: string;
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
    emit('imagegen', 'imagegen.start', {
      prompt,
      seed,
      steps: opts.steps ?? 2,
      cfg: opts.cfg ?? 2.0,
      width: opts.width ?? 512,
      height: opts.height ?? 512,
      modelLabel: opts.modelLabel ?? null,
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
        loraPath: opts.loraPath ?? '',
        loraMultiplier: opts.loraMultiplier ?? 1,
        outPath,
      });
      if (typeof result === 'string' && result.startsWith('ERR_')) {
        runInAction(() => {
          this.error = result;
        });
        engineStatus.setError('image', result);
        emit('imagegen', 'imagegen.failed', {error: result, seed, prompt});
        return null;
      }
      // 历史落盘归编排层任务链（beginTask/finishTask）统一管理，
      // 本方法只负责引擎调用并返回结果 URI。
      engineStatus.setPhase('image', 'ready');
      emit('imagegen', 'imagegen.done', {
        uri: `file://${outPath}`,
        seed,
        prompt,
        durationMs: Date.now() - this.genStartedAt,
      });
      return `file://${outPath}`;
    } catch (e: any) {
      runInAction(() => {
        this.error = `出图失败: ${e?.message ?? e}`;
      });
      engineStatus.setError('image', `出图失败: ${e?.message ?? e}`);
      emit('imagegen', 'imagegen.failed', {
        error: `出图失败: ${e?.message ?? e}`,
        seed,
        prompt,
      });
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

  // ===== DreamLite 单通道（收编：Screen 只调 store，engine 层仅供 store 引用）=====

  /**
   * 加载 DreamLite（同槽互斥 + 单状态机）。
   * 同槽互斥：加载前释放 sd 引擎（双驻留会 OOM）；与 chat 引擎经 engineMutex 互斥。
   */
  async loadDreamLiteEntry(): Promise<boolean> {
    if (this.modelLoaded) {
      try {
        await this.unloadModel(); // 释放 SD（内部 engineMutex.release()）
      } catch (e) {
        console.warn('[DreamLite] unload SD failed:', e);
      }
    }
    // 互斥获取（复查 2026-08-20）：释放超时/失败 → 显式失败（落 error），
    // 不再无限挂起——此前 acquire 在 try 外，reject 会穿透到 handleGenerate
    // 造成「无失败卡 + taskKind 卡死」的静默断链。
    try {
      await engineMutex.acquire('image');
    } catch (e: any) {
      const msg = `引擎互斥超时: ${e?.message ?? e}`;
      console.error('[DreamLite] acquire failed:', e);
      runInAction(() => {
        this.loading = false;
        this.error = msg;
      });
      engineStatus.setError('image', msg);
      return false;
    }
    runInAction(() => {
      this.loading = true;
      this.error = null;
      this.loadingStartedAt = Date.now();
      this.stage = '';
    });
    this.syncPoll();
    engineStatus.setPhase('image', 'loading', '加载 DreamLite 引擎…');
    try {
      await loadDreamLite();
      runInAction(() => {
        this.dreamliteLoaded = true;
        this.loading = false;
      });
      this.syncPoll();
      engineStatus.setPhase('image', 'ready', '');
      return true;
    } catch (e: any) {
      runInAction(() => {
        this.loading = false;
        this.error = `DreamLite: ${e?.message ?? e}`;
      });
      this.syncPoll();
      engineStatus.setError('image', `DreamLite: ${e?.message ?? e}`);
      return false;
    }
  }

  /** 卸载 DreamLite（内存归还；标记引擎空闲） */
  async unloadDreamLiteEntry(): Promise<void> {
    runInAction(() => {
      this.dreamliteLoaded = false;
    });
    try {
      await unloadDreamLite();
    } catch (e) {
      console.warn('[DreamLite] unload failed:', e);
    }
    engineStatus.setPhase('image', 'idle');
    engineMutex.release();
  }

  /**
   * DreamLite 文生图（单通道）：内部确保引擎已加载；进度写本 store 单状态机。
   * 成功返回图片 URI，失败返回 null（error 已写入 store）。
   */
  async generateDreamLiteEntry(
    width: number,
    height: number,
    steps: number,
    prompt: string,
  ): Promise<string | null> {
    console.info(
      `[DreamLite] generateDreamLiteEntry(${width}x${height}, steps=${steps}) prompt=${prompt.slice(0, 20)}…`,
    );
    if (!this.dreamliteLoaded) {
      const ok = await this.loadDreamLiteEntry();
      if (!ok) {
        return null;
      }
    }
    runInAction(() => {
      this.generating = true;
      this.genStartedAt = Date.now();
      this.progress = 0;
      this.progressText = '';
      this.stage = 'TE 编码/准备…';
      this.error = null;
    });
    emit('imagegen', 'imagegen.start', {
      prompt,
      width,
      height,
      steps,
      engine: 'dreamlite',
    });
    try {
      const uri = await generateDreamLite(
        width,
        height,
        steps,
        prompt,
        (st, tot) => {
          runInAction(() => {
            this.progress = Math.round((st / tot) * 100);
            this.progressText = `${st}/${tot}`;
            this.stage = `采样 ${st}/${tot}`;
          });
          emit(
            'imagegen',
            'imagegen.stage',
            {
              progress: Math.round((st / tot) * 100),
              stage: `采样 ${st}/${tot}`,
            },
            'imagegen.stage',
          );
        },
      );
      emit('imagegen', 'imagegen.done', {
        uri,
        prompt,
        width,
        height,
        steps,
        engine: 'dreamlite',
        durationMs: Date.now() - this.genStartedAt,
      });
      return uri;
    } catch (e: any) {
      runInAction(() => {
        this.error = `DreamLite: ${e?.message ?? e}`;
      });
      emit('imagegen', 'imagegen.failed', {
        error: `DreamLite: ${e?.message ?? e}`,
        prompt,
      });
      return null;
    } finally {
      runInAction(() => {
        this.generating = false;
      });
    }
  }

  /**
   * DreamLite 图像编辑（单通道）：内部确保引擎已加载；进度写本 store 单状态机。
   * visRgb 为 512² 源图 [-1,1]（TE 视觉通道条件，与 sourceRgb 双解码同源）。
   * 成功返回图片 URI，失败返回 null（error 已写入 store）。
   */
  async editDreamLiteEntry(
    sourceRgb: Float32Array,
    width: number,
    height: number,
    steps: number,
    instruction: string,
    visRgb?: Float32Array,
  ): Promise<string | null> {
    if (!this.dreamliteLoaded) {
      const ok = await this.loadDreamLiteEntry();
      if (!ok) {
        return null;
      }
    }
    runInAction(() => {
      this.generating = true;
      this.genStartedAt = Date.now();
      this.progress = 0;
      this.stage = '编辑: 准备…';
    });
    try {
      const uri = await editDreamLite(
        sourceRgb,
        width,
        height,
        steps,
        (st, tot) => {
          runInAction(() => {
            this.progress = Math.round((st / tot) * 100);
            this.stage = `编辑 采样 ${st}/${tot}`;
          });
        },
        instruction,
        visRgb,
      );
      return uri;
    } catch (e: any) {
      runInAction(() => {
        this.error = `DreamLite编辑: ${e?.message ?? e}`;
      });
      return null;
    } finally {
      runInAction(() => {
        this.generating = false;
      });
    }
  }

  /** 解码上传图（编辑源图 RGB）：engine 层纯工具函数的 store 包装（单通道约束） */
  async decodeEditImage(path: string, size: number): Promise<Float32Array> {
    return decodeImageToRgb(path, size);
  }

  /**
   * 高清放大（P6-6 独立通用能力）：内存互斥（先 await 释放 DreamLite/SD）→ 加载超分模型
   * → tiled 放大 → 新 history 条目（kind='upscaled'）。进度写本 store 单状态机。
   * 成功返回放大图 URI，失败返回 null（error 已写入 store）。
   */
  async upscaleImageEntry(
    uri: string,
    scale: 2 | 4,
    style: SRStyle,
  ): Promise<string | null> {
    // 防重入：放大进行中重复触发直接拒绝（防线在 store，不依赖 UI 层门禁）
    if (this.upscaleBusy) {
      return null;
    }
    // B28 就绪门禁 + init 守卫：DRC/外部直调时先等 DB 水合/存量迁移完成，
    // 再确保 outDir 就绪——2026-08-21 覆盖事故终态根治
    await this.ensureReady();
    if (!this.outDir) {
      await this.init();
    }
    // 内存互斥：超分独占内存，放大前释放 DreamLite/SD（await 等待 native 归还）
    if (this.dreamliteLoaded) {
      try {
        await this.unloadDreamLiteEntry();
      } catch (e) {
        console.warn('[SuperRes] unload DreamLite failed:', e);
      }
    }
    if (this.modelLoaded) {
      try {
        await this.unloadModel();
      } catch (e) {
        console.warn('[SuperRes] unload SD failed:', e);
      }
    }
    const styleLabel =
      style === 'anime'
        ? '动漫高清'
        : style === 'anime_fast'
          ? '动漫快速'
          : '通用写实';
    const taskId = await this.beginTask({
      uri: '',
      prompt: `高清放大 ${scale}×（${styleLabel}）`,
      seed: 0,
      ts: Date.now(),
      width: 0,
      height: 0,
      modelLabel: 'RealESRGAN',
      kind: 'upscaled',
      sourceUri: uri,
    });
    runInAction(() => {
      this.upscaleBusy = true;
      this.generating = true;
      this.genStartedAt = Date.now();
      this.progress = 0;
      this.progressText = '';
      this.stepTime = 0;
      this.stage = '放大: 解码 + 计算中（CPU 较慢，请稍候）';
      this.error = null;
    });
    try {
      await ensureSuperResModels();
      await loadSuperRes(style);
      const r = await upscaleImage(uri, scale, style, pct => {
        runInAction(() => {
          this.progress = pct;
          this.progressText = `${pct}%`;
          this.stage = `放大 ${pct}%`;
        });
      });
      await this.finishTask(taskId, r.uri, {
        width: r.w,
        height: r.h,
        durationMs: Date.now() - this.genStartedAt,
      });
      return r.uri;
    } catch (e: any) {
      const msg = `放大失败: ${e?.message ?? e}`;
      runInAction(() => {
        this.error = msg;
      });
      await this.failTask(taskId, '放大失败', msg);
      return null;
    } finally {
      runInAction(() => {
        this.upscaleBusy = false;
        this.generating = false;
        this.progress = -1;
        this.progressText = '';
        this.stage = '';
      });
      try {
        await unloadSuperRes();
      } catch {
        /* 释放失败静默 */
      }
    }
  }
}

export const imageGenStore = new ImageGenStore();
