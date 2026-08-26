/**
 * AudioStore — 音频工坊桥（P2，AUDIO_UI_SPEC）
 *
 * 双能力收编（Screen 层零直连原生）：
 *  - 转写（ASR）：transcribeTask 任务化入 imageGenStore.history（kind='transcribe'，
 *    与生图/反推任务同画廊同管理：running/success/failed + 持久化）
 *  - 朗读（TTS）：复用既有 TTSStore（isTTSAvailable 门 + 三引擎 + 流式），
 *    此 store 只做视图编排（语音选择/试听/朗读/状态镜像）
 *
 * 调度：音频模型 <400MB 不入 engineMutex 互斥矩阵（可共存）；ASR 按需加载。
 */
import {makeAutoObservable, runInAction} from 'mobx';

import {imageGenStore} from './imageGenStore';
import {ttsStore} from './TTSStore';
import {promptWriter} from '../services/promptWriter';
import {getAllEngines, Voice} from '../services/tts';
import {
  downloadSenseVoice,
  isSenseVoiceInstalled,
  transcribeFile,
} from '../services/asrEngine';
import {
  playTtsFile,
  pausePlayFile,
  resumePlayFile,
  seekPlayFile,
  stopTtsPlay,
  synthesizeToFile,
  TtsGenEngineId,
  TtsSynthOptions,
} from '../services/ttsEngine';

/** ASR 模型下载状态机（与 TTS 下载状态机同构） */
export type AsrDownloadState =
  | 'not_installed'
  | 'downloading'
  | 'ready'
  | 'error';

class AudioStore {
  /** 生成引擎选择（顶栏胶囊 + 生成段共享，B35：模型只在顶栏） */
  genEngine: TtsGenEngineId = 'kokoro';
  /** 转写进行中（结果区动效驱动） */
  transcribing = false;
  /** 转写阶段文本（加载语音模型 → 转写中 → 标点恢复） */
  transcribeStage = '';
  /** ASR 模型状态 */
  asrState: AsrDownloadState = 'not_installed';
  /** ASR 下载进度（0-100） */
  asrProgress = 0;
  /** 最近一次转写/生成失败原因（DRC 取证与诊断） */
  asrError: string | null = null;
  ttsError: string | null = null;
  /** 朗读中文本（结果区展示） */
  speakingText = '';

  constructor() {
    makeAutoObservable(this);
    void this.refreshAsrState();
  }

  /** 切换生成引擎（顶栏胶囊选中即生效） */
  setGenEngine(engine: TtsGenEngineId): void {
    this.genEngine = engine;
  }

  /** ASR 模型状态刷新（文件系统为事实源） */
  async refreshAsrState(): Promise<void> {
    const installed = await isSenseVoiceInstalled();
    runInAction(() => {
      this.asrState = installed ? 'ready' : 'not_installed';
    });
  }

  /** 下载 SenseVoice（进度写状态机；失败置 error 显式可见） */
  async downloadAsrModel(): Promise<void> {
    if (this.asrState === 'downloading' || this.asrState === 'ready') {
      return;
    }
    runInAction(() => {
      this.asrState = 'downloading';
      this.asrProgress = 0;
    });
    try {
      await downloadSenseVoice(pct => {
        runInAction(() => {
          this.asrProgress = pct;
        });
      });
      runInAction(() => {
        this.asrState = 'ready';
        this.asrProgress = 100;
      });
    } catch (e) {
      runInAction(() => {
        this.asrState = 'error';
      });
      throw new Error(`语音模型下载失败：${(e as Error)?.message ?? e}`);
    }
  }

  /**
   * 转写任务化（入画廊）：beginTask(running) → 转写 → finishTask
   * （prompt=转写文本）／ failTask 报错页。
   * B36：源音频路径存入 uri 字段（failed 页重试可复用同源重发）。
   * 返回转写文本（成功）或 null（失败）。
   */
  async transcribeTask(audioPath: string): Promise<string | null> {
    const startTs = Date.now();
    const taskId = await imageGenStore.beginTask({
      uri: audioPath,
      prompt: '',
      seed: 0,
      ts: startTs,
      width: 0,
      height: 0,
      kind: 'transcribe',
      modelLabel: 'SenseVoice',
    });
    runInAction(() => {
      this.transcribing = true;
      this.transcribeStage = '加载语音模型…';
    });
    try {
      const text = await transcribeFile(audioPath, stage => {
        runInAction(() => {
          this.transcribeStage = stage;
        });
      });
      const trimmed = text.trim();
      if (!trimmed) {
        throw new Error('转写无输出');
      }
      await imageGenStore.finishTask(taskId, audioPath, {
        prompt: trimmed,
        durationMs: Date.now() - startTs,
      });
      console.info('[AudioStore] transcribe ok:', trimmed);
      return trimmed;
    } catch (e: any) {
      const msg = `转写失败：${e?.message ?? e}`;
      console.info('[AudioStore] transcribeTask failed:', e);
      runInAction(() => {
        this.asrError = msg;
      });
      await imageGenStore.failTask(taskId, '转写失败', msg);
      return null;
    } finally {
      runInAction(() => {
        this.transcribing = false;
        this.transcribeStage = '';
      });
    }
  }

  // ---- TTS 视图编排（复用 TTSStore，仅镜像状态供 UI 读取）+ 生成任务化 ----

  /** 生成进行中（结果区动效驱动） */
  ttsGenerating = false;
  /** 生成阶段文本 */
  ttsStage = '';

  // ---- B38 播放器预览窗口状态机（MediaPlayer + JS 500ms 轮询） ----

  /** 当前播放产物 uri（null = 无播放） */
  playingUri: string | null = null;
  /** 播放位置 ms（时间轴轮询写入） */
  playPosition = 0;
  /** 总时长 ms（playFile resolve） */
  playDuration = 0;
  /** 播放中（暂停/停止/播完 = false） */
  isPlaying = false;

  /** 播放/暂停切换（同一 uri 暂停续播；不同 uri 切源重播） */
  async togglePlay(uri: string): Promise<void> {
    if (this.playingUri === uri && this.isPlaying) {
      await pausePlayFile();
      runInAction(() => {
        this.isPlaying = false;
      });
      return;
    }
    if (this.playingUri === uri && !this.isPlaying) {
      await resumePlayFile();
      runInAction(() => {
        this.isPlaying = true;
      });
      return;
    }
    await stopTtsPlay();
    const duration = await playTtsFile(uri);
    runInAction(() => {
      this.playingUri = uri;
      this.playPosition = 0;
      this.playDuration = duration;
      this.isPlaying = true;
    });
  }

  /** 时间轴拖动跳播（ms） */
  async seekTo(ms: number): Promise<void> {
    await seekPlayFile(ms);
    runInAction(() => {
      this.playPosition = ms;
    });
  }

  /** 停止并复位播放器 */
  async stopPlayback(): Promise<void> {
    await stopTtsPlay();
    runInAction(() => {
      this.playingUri = null;
      this.playPosition = 0;
      this.playDuration = 0;
      this.isPlaying = false;
    });
  }

  /** 引擎列表（含安装态；UI 模型管理行） */
  get engines() {
    return getAllEngines();
  }

  get isTTSAvailable() {
    return ttsStore.isTTSAvailable;
  }

  get playbackState() {
    return ttsStore.playbackState;
  }

  get currentVoice() {
    return ttsStore.currentVoice;
  }

  get autoSpeakEnabled() {
    return ttsStore.autoSpeakEnabled;
  }

  /** 语音清单（按引擎分组，供语音选择行；引擎就绪才拉取） */
  async loadVoices(): Promise<Voice[]> {
    const all: Voice[] = [];
    for (const e of this.engines) {
      try {
        if (await e.isInstalled()) {
          all.push(...(await e.getVoices()));
        }
      } catch {
        // 单个引擎读取失败跳过（不阻断整体语音清单）
      }
    }
    return all;
  }

  async speak(text: string, voice: Voice | null): Promise<void> {
    if (!text.trim() || !this.isTTSAvailable) {
      return;
    }
    runInAction(() => {
      this.speakingText = text.trim();
    });
    await ttsStore.play(`audio:${Date.now()}`, text.trim(), {
      voiceOverride: voice ?? undefined,
    });
  }

  async previewVoice(voice: Voice): Promise<void> {
    await ttsStore.preview(voice);
  }

  async stopSpeak(): Promise<void> {
    await ttsStore.stop();
    runInAction(() => {
      this.speakingText = '';
    });
  }

  /**
   * 生成音频文件任务（kind='tts' 入画廊，与转写同构：running/success/failed）。
   * 产物 = AIOS/audio/output/tts_{ts}.wav（共享存储，用户可见）。
   *
   * @returns 产物绝对路径（成功）或 null（失败，任务已置 failed）
   */
  async generateTask(
    engine: TtsGenEngineId,
    text: string,
    voice: Voice,
    opts: TtsSynthOptions = {},
  ): Promise<string | null> {
    const trimmed = text.trim();
    if (!trimmed) {
      return null;
    }
    // B34：生成前释放管家模型（promptWriter）腾内存——kokoro fp32 加载峰值
    // 与管家同驻会超 HyperOS 单应用配额被系统杀进程（K90/小米13 双机血证）；
    // 聊天调度链路会自动 ensureLoaded 懒加载恢复，无感。
    await promptWriter.release();
    const startTs = Date.now();
    const taskId = await imageGenStore.beginTask({
      uri: '',
      prompt: trimmed,
      seed: 0,
      ts: startTs,
      width: 0,
      height: 0,
      family: 'tts',
      kind: 'tts',
      modelLabel:
        engine === 'kokoro'
          ? 'Kokoro'
          : engine === 'supertonic'
            ? 'Supertonic'
            : 'Kitten',
    });
    runInAction(() => {
      this.ttsGenerating = true;
      this.ttsStage = `正在合成（${voice.name}）…`;
    });
    try {
      const outPath = await synthesizeToFile(engine, trimmed, voice.id, {
        ...opts,
        onStage: stage => {
          runInAction(() => {
            this.ttsStage = stage;
          });
        },
      });
      await imageGenStore.finishTask(taskId, outPath, {
        prompt: trimmed,
        durationMs: Date.now() - startTs,
      });
      console.info('[AudioStore] tts generate ok:', outPath);
      return outPath;
    } catch (e: any) {
      const msg = `生成失败：${e?.message ?? e}`;
      console.info('[AudioStore] generateTask failed:', e);
      runInAction(() => {
        this.ttsError = msg;
      });
      await imageGenStore.failTask(taskId, '生成失败', msg);
      return null;
    } finally {
      runInAction(() => {
        this.ttsGenerating = false;
        this.ttsStage = '';
      });
    }
  }
}

export const audioStore = new AudioStore();
