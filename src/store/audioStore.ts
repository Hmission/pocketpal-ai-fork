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
import {getAllEngines, Voice} from '../services/tts';
import {
  downloadSenseVoice,
  isSenseVoiceInstalled,
  transcribeFile,
} from '../services/asrEngine';

/** ASR 模型下载状态机（与 TTS 下载状态机同构） */
export type AsrDownloadState = 'not_installed' | 'downloading' | 'ready' | 'error';

class AudioStore {
  /** 转写进行中（结果区动效驱动） */
  transcribing = false;
  /** 转写阶段文本（加载语音模型 → 转写中 → 标点恢复） */
  transcribeStage = '';
  /** ASR 模型状态 */
  asrState: AsrDownloadState = 'not_installed';
  /** ASR 下载进度（0-100） */
  asrProgress = 0;
  /** 朗读中文本（结果区展示） */
  speakingText = '';

  constructor() {
    makeAutoObservable(this);
    void this.refreshAsrState();
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
   * （prompt=转写文本，uri 空）／ failTask 报错页。
   * 返回转写文本（成功）或 null（失败）。
   */
  async transcribeTask(audioPath: string): Promise<string | null> {
    const startTs = Date.now();
    const taskId = await imageGenStore.beginTask({
      uri: '',
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
      await imageGenStore.finishTask(taskId, '', {
        prompt: trimmed,
        durationMs: Date.now() - startTs,
      });
      console.info('[AudioStore] transcribe ok:', trimmed);
      return trimmed;
    } catch (e: any) {
      const msg = `转写失败：${e?.message ?? e}`;
      console.info('[AudioStore] transcribeTask failed:', e);
      await imageGenStore.failTask(taskId, '转写失败', msg);
      return null;
    } finally {
      runInAction(() => {
        this.transcribing = false;
        this.transcribeStage = '';
      });
    }
  }

  // ---- TTS 视图编排（复用 TTSStore，仅镜像状态供 UI 读取）----

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
}

export const audioStore = new AudioStore();
