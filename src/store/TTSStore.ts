import {AppState, AppStateStatus} from 'react-native';

import {makeAutoObservable, reaction, runInAction} from 'mobx';
import {makePersistable} from 'mobx-persist-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import DeviceInfo from 'react-native-device-info';
import type {SupertonicLanguage} from '@pocketpalai/react-native-speech';

import {
  getEngine,
  getAllEngines,
  KittenEngine,
  KokoroEngine,
  SupertonicEngine,
  TTS_MIN_RAM_BYTES,
  TTS_PREVIEW_SAMPLE,
  SUPERTONIC_MODEL_ESTIMATED_BYTES,
  KOKORO_MODEL_ESTIMATED_BYTES,
  KITTEN_MODEL_ESTIMATED_BYTES,
  ttsRuntime,
  isVoiceMismatchedForText,
  pickDefaultVoice,
} from '../services/tts';
import type {
  EngineId,
  StreamingHandle,
  SupertonicSteps,
  Voice,
} from '../services/tts';
import {
  ThinkingStripper,
  pickThinkingPlaceholder,
} from '../services/tts/thinkingStripper';
import {chatSessionStore} from './ChatSessionStore';
import {nightTaskRegistry} from './nightTaskRegistry';

/**
 * Discriminated union describing what the store is currently doing.
 *
 * - `idle`: nothing playing, no streaming session active.
 * - `streaming`: an assistant message is still being produced; `handle`
 *   receives token deltas via `onAssistantMessageChunk`.
 * - `playing`: a full-text utterance is playing (replay path / fallback).
 */
export type TTSPlaybackState =
  | {mode: 'idle'}
  | {mode: 'streaming'; messageId: string; handle: StreamingHandle}
  | {mode: 'playing'; messageId: string};

/**
 * State machine for a neural-engine model download lifecycle.
 * Derived from the engine's `isInstalled()` on `init()` — never
 * persisted; the source of truth is the file system.
 */
export type NeuralDownloadState =
  | 'not_installed'
  | 'downloading'
  | 'ready'
  | 'error';

/** Alias preserved for external consumers that imported the v1.2 name. */
export type SupertonicDownloadState = NeuralDownloadState;

/** Neural engine ids managed by the store's download state machines. */
export type NeuralEngineId = 'supertonic' | 'kokoro' | 'kitten';

const DEFAULT_SUPERTONIC_STEPS: SupertonicSteps = 5;

/**
 * Default Supertonic synthesis language: `na` ("Auto"), the trained
 * language-agnostic tag in the v3 model. New and existing users start here
 * (existing users have no persisted key, so hydration leaves it at `na`).
 */
const DEFAULT_SUPERTONIC_LANGUAGE: SupertonicLanguage = 'na';

const previewMessageId = (voice: Voice): string =>
  `preview:${voice.engine}:${voice.id}`;

/**
 * 播报门拦路原因（单一口径）：`null` = 可播。UI 只读不改写；
 * 由它到可见文案的映射见 `components/PhoneCallOverlay/ttsStatusText.ts`。
 */
export type SpeakBlock = 'device' | 'noVoice' | 'engine' | null;

/** 运行期播报问题（尝试播了但出问题）：语种不匹配 / 播放失败。 */
export type SpeakIssue = 'lang' | 'failed' | null;

/**
 * Store that coordinates text-to-speech playback.
 *
 * ⚠ 注释指针勘误（2026-09-06 取证）：本文件历史上多处引用
 * `architecture/tts.md`（§1a / §4a / §4a.1 / §4a.5 / §4e），**该文件在本仓从未存在**
 * （悬空指针——按它找不到任何口径，只能读代码反推）。播报架构的单一事实源现为
 * `docs/POCKETPAL_TTS_SPEC.md`（事实位见 §1，stop 失败定性见 §2，串行链见 §3）；
 * 下方各处的 §号仅作历史出处标记，不再声称可达。
 *
 * Availability gate: `isTTSAvailable` is the single boolean every TTS-aware
 * surface reads. It is derived from `deviceMeetsMemory` (set once in `init()`
 * from `DeviceInfo.getTotalMemory()`) and `userTTSOverride` (a persisted user
 * choice). See architecture/tts.md §4a for the formula. The lifecycle hooks
 * registered in `init()` (AppState listener, session reaction, isInstalled
 * checks) run unconditionally so a low-memory user opting in mid-session has
 * a safe runtime — see architecture/tts.md §4e.
 *
 * Streaming: `useChatSession` calls three hooks as an assistant message is
 * produced — `onAssistantMessageStart`, `onAssistantMessageChunk`, and
 * `onAssistantMessageComplete`. The first creates a `StreamingHandle`, the
 * second feeds deltas into it, the third flushes the remaining buffer. If
 * `start` is missed (e.g., voice picked mid-message) `complete` falls back
 * to the full-text `play()` path.
 */
export class TTSStore {
  // Set once in init() from getTotalMemory() >= TTS_MIN_RAM_BYTES; never
  // re-checked. RAM doesn't change at runtime. See architecture/tts.md §1a.
  deviceMeetsMemory: boolean = false;
  // Tristate persisted user choice. null = not set (mirrors deviceMeetsMemory).
  // See architecture/tts.md §4a, D1.
  userTTSOverride: boolean | null = null;
  private initialized: boolean = false;

  /**
   * The TTS availability gate. Single boolean every TTS-aware surface reads.
   * Derived from `userTTSOverride` and `deviceMeetsMemory` per the formula
   * in architecture/tts.md §4a.1: an explicit user override wins; otherwise
   * the device-memory default applies.
   */
  get isTTSAvailable(): boolean {
    if (this.userTTSOverride === true) {
      return true;
    }
    if (this.userTTSOverride === false) {
      return false;
    }
    return this.deviceMeetsMemory;
  }

  /**
   * OS TTS 可用性探测结果（W1a「就绪同源」）：`null` = 尚未探测。
   * `system` 引擎不带模型文件，能不能播只能问 OS——HyperOS 上那颗小爱引擎
   * 需用户先在厂商协议页同意激活，未激活时给不出音色目录（真机 2026-09-05 实证）。
   */
  osTTSReady: boolean | null = null;

  /**
   * 引擎级就绪判定：能力位驱动，不散落 `!== 'system'` 特判——需要模型文件的
   * 取下载状态，OS 引擎取 `osTTSReady`。
   */
  engineIsReady(id: EngineId): boolean {
    if (!getEngine(id).requiresModelFile) {
      return this.osTTSReady === true;
    }
    return this.getDownloadState(id as NeuralEngineId) === 'ready';
  }

  /**
   * 播报门的**唯一**事实源（W1a 门合并）：「现在能不能播」一律读这里。
   *
   * 旧写法四处各拼一套（`isTTSAvailable` / `isTTSAvailable && currentVoice` /
   * `currentVoice == null → 引导 setup` / 通话页自己拼），口径互不相同，
   * 于是出现「UI 说就绪、实际播不出」。`null` = 可播；否则给出第一个拦路原因。
   * 与 `speakIssue` 分工：这里答「门为何不放行」（静态可派生），
   * `speakIssue` 答「尝试播了但出问题」（运行期事实）；两者合起来才是状态行。
   */
  voiceBlock(voice: Voice | null): SpeakBlock {
    if (!this.isTTSAvailable) {
      return 'device';
    }
    if (voice == null) {
      return 'noVoice';
    }
    return this.engineIsReady(voice.engine) ? null : 'engine';
  }

  /** 当前音色的播报门判定（调用方拿到 `null` 就可以播）。 */
  get speakBlock(): SpeakBlock {
    return this.voiceBlock(this.currentVoice);
  }

  /**
   * 类型谓词版播报门：`true` = 可播，且把 `voice` 收窄为非空。
   * 流式/回落入口用它，避开「门过了但类型还要再判一次」的重复写法。
   */
  canSpeakVoice(voice: Voice | null): voice is Voice {
    return this.voiceBlock(voice) === null;
  }

  get canSpeak(): boolean {
    return this.speakBlock === null;
  }

  /**
   * 播报**入口**该呈现什么（单一决策点：UI 只照着渲染，不再自己拼门）：
   * - `'speak'`：可播
   * - `'setup'`：只差选一颗音色 → 点击引导去 TTS 设置（这是看得见的行动召唤，
   *   不是静默兜底：最终播的仍是用户自己选的音色）
   * - `null`：其余拦路（设备内存不够 / 引擎不可用）→ 不显示入口，
   *   原因由设置页 / 通话页状态行说清楚
   */
  get speakEntry(): 'speak' | 'setup' | null {
    const block = this.speakBlock;
    if (block === null) {
      return 'speak';
    }
    return block === 'noVoice' ? 'setup' : null;
  }

  // Runtime playback state (discriminated union)
  playbackState: TTSPlaybackState = {mode: 'idle'};

  /**
   * 播报问题（W1a「不静默」）：`null` = 无已知问题。
   * - `'lang'`：中文文本 × 不读中文的音色（照播，但 UI 必须说出来并给换音色入口）
   * - `'failed'`：引擎实际抛错（如 HyperOS 语音引擎未激活 → `speech_error`）
   *
   * 旧行为是只 `console.warn`（真机 2026-09-05 实证：状态行一直显示「播报就绪」
   * 而实际无声）。判定只这一处，UI 只读不改写；**不自动替用户改选音色**。
   */
  speakIssue: SpeakIssue = null;

  // Persisted user preferences
  autoSpeakEnabled: boolean = false;
  currentVoice: Voice | null = null;
  /**
   * Supertonic diffusion-step count. Persisted so a user's quality
   * preference survives restart. Missing values default to 5 on first load.
   */
  supertonicSteps: SupertonicSteps = DEFAULT_SUPERTONIC_STEPS;
  /**
   * Supertonic synthesis language. Persisted so the user's choice survives
   * restart. Defaults to `na` ("Auto", language-agnostic). Read at every
   * Supertonic synthesis entry point and passed explicitly so the engine
   * default never governs. See architecture/tts.md §4a.
   */
  supertonicLanguage: SupertonicLanguage = DEFAULT_SUPERTONIC_LANGUAGE;

  // UI state
  isSetupSheetOpen: boolean = false;
  /** Free disk bytes, refreshed each time the setup sheet opens. */
  freeDiskBytes: number | null = null;

  // Per-engine model lifecycle — derived state, NOT persisted.
  supertonicDownloadState: NeuralDownloadState = 'not_installed';
  supertonicDownloadProgress: number = 0;
  supertonicDownloadError: string | null = null;

  kokoroDownloadState: NeuralDownloadState = 'not_installed';
  kokoroDownloadProgress: number = 0;
  kokoroDownloadError: string | null = null;

  kittenDownloadState: NeuralDownloadState = 'not_installed';
  kittenDownloadProgress: number = 0;
  kittenDownloadError: string | null = null;

  // Idempotency guard for the auto-speak path.
  lastSpokenMessageId: string | null = null;

  private appStateSubscription: {remove: () => void} | null = null;
  private sessionReactionDispose: (() => void) | null = null;
  /**
   * Voice id pending restore after a forced engine re-download (e.g. Kokoro
   * FP16 → FP32 migration). When `init()` finds a persisted voice whose
   * engine reports not-installed, the voice id is stashed here so the next
   * successful download of that engine can restore the user's selection
   * instead of falling back to `voices[0]`. Reset to null after restore.
   * Map keyed by engine id; only neural engines participate.
   */
  private pendingVoiceRestore: Partial<Record<NeuralEngineId, string>> = {};

  // Per-streaming-session state for stripping `<think>…</think>` markup.
  private streamStripper: ThinkingStripper | null = null;
  private streamPlaceholderEmitted: boolean = false;

  constructor() {
    makeAutoObservable(this, {}, {autoBind: true});
    makePersistable(this, {
      name: 'TTSStore',
      properties: [
        'autoSpeakEnabled',
        'currentVoice',
        'supertonicSteps',
        'supertonicLanguage',
        'userTTSOverride',
      ],
      storage: AsyncStorage,
    });
  }

  /**
   * Initialize the store. Idempotent — safe to call multiple times; only the
   * first call does work.
   */
  async init(): Promise<void> {
    if (this.initialized) {
      return;
    }
    this.initialized = true;

    let totalMemory = 0;
    try {
      totalMemory = await DeviceInfo.getTotalMemory();
    } catch (err) {
      console.warn('[TTSStore] getTotalMemory failed:', err);
      totalMemory = 0;
    }

    runInAction(() => {
      this.deviceMeetsMemory = totalMemory >= TTS_MIN_RAM_BYTES;
    });

    // Lifecycle hooks below run UNCONDITIONALLY — see architecture/tts.md §4e
    // and I8. A user on a low-memory device may flip `userTTSOverride = true`
    // mid-session, at which point the AppState listener and session reaction
    // must already be in place. The four call-site guards in `play`,
    // `preview`, `onAssistantMessageStart`, `onAssistantMessageComplete`
    // (plus component-level guards) remain the gate on user-visible work.

    // Derive every engine's readiness in parallel — **including the OS engine**
    // （W1a 就绪同源）：能力位决定结果落到哪——需模型文件的落下载状态，OS 引擎
    // 落 `osTTSReady`。旧写法只探三颗神经引擎，OS 那颗被 `isInstalled()` 硬编码
    // `true` 顶过，于是「播报就绪」与「实际能不能播」完全脱钩。
    const results = await Promise.all(
      getAllEngines().map(async engine => {
        try {
          return {engine, installed: await engine.isInstalled()};
        } catch (err) {
          console.warn(
            `[TTSStore] ${engine.id} isInstalled check failed:`,
            err,
          );
          return {engine, installed: false};
        }
      }),
    );
    runInAction(() => {
      for (const {engine, installed} of results) {
        if (engine.requiresModelFile) {
          this.setDownloadState(
            engine.id as NeuralEngineId,
            installed ? 'ready' : 'not_installed',
          );
        } else {
          this.osTTSReady = installed;
          // 推给 runtime（唯一写入点）：它需要这个事实才能给 stop 的失败定性。
          // 事实源头仍在 store，runtime 只拿镜像——见 TTS_SPEC §1/§2。
          ttsRuntime.setOsChannelReady(installed);
        }
      }
      // Reconcile persisted currentVoice: if the engine's model files
      // were deleted (app restore, manual cleanup) or the engine layout
      // changed (e.g. Kokoro FP16 → FP32 migration), clear the voice so
      // play/stream paths don't crash trying to init a missing engine.
      // Stash the voice id first so it can be restored after re-download
      // — otherwise users lose their selection across the forced upgrade.
      if (
        this.currentVoice != null &&
        getEngine(this.currentVoice.engine).requiresModelFile &&
        !this.engineIsReady(this.currentVoice.engine)
      ) {
        const engineId = this.currentVoice.engine as NeuralEngineId;
        this.pendingVoiceRestore[engineId] = this.currentVoice.id;
        this.currentVoice = null;
      }
    });

    this.appStateSubscription = AppState.addEventListener(
      'change',
      this.handleAppStateChange,
    );

    this.sessionReactionDispose = reaction(
      () => chatSessionStore.activeSessionId,
      () => {
        this.stop();
      },
    );
  }

  private handleAppStateChange = (nextAppState: AppStateStatus) => {
    if (nextAppState === 'background') {
      // 夜间长任务模式（§7.1）：生图/视频任务进行中不释放 TTS 引擎——
      // 避免长任务后台运行期间引擎反复 stop/release/reload 的 churn。
      if (nightTaskRegistry.isBusy) {
        console.log('[TTSStore] background: night task active, keep engine');
        return;
      }
      // Stop in-flight audio AND release the active engine's native
      // resources (200-450 MB depending on engine). Re-init is lazy on
      // the next play after foreground.
      // Only react to 'background' — 'inactive' fires for transient
      // interruptions (Control Center, incoming call sheet, notification
      // tap) that shouldn't tear down a 200+ MB engine.
      this.stop()
        .then(() => ttsRuntime.release())
        .catch(err => {
          console.warn('[TTSStore] background release failed:', err);
        });
    }
  };

  setAutoSpeak(on: boolean) {
    this.autoSpeakEnabled = on;
    if (!on) {
      // Turning auto-speak off frees the active neural engine's RAM
      // proactively — the user has signaled they don't want passive
      // playback. Re-init is lazy on the next preview / message replay.
      this.stop()
        .then(() => ttsRuntime.release())
        .catch(err => {
          console.warn('[TTSStore] release on auto-speak off failed:', err);
        });
    }
  }

  /**
   * Persist the user's explicit choice for the TTS availability gate.
   * `true` forces the gate open even on low-memory devices; `false` forces
   * it closed even on high-memory devices. Mirrors `setAutoSpeak(false)`'s
   * stop+release pattern when the gate transitions from open to closed,
   * to free engine RAM immediately. See architecture/tts.md §4a.5, I3, I6.
   */
  setUserTTSOverride(value: boolean): void {
    const wasAvailable = this.isTTSAvailable;
    this.userTTSOverride = value;
    if (wasAvailable && !value) {
      this.stop()
        .then(() => ttsRuntime.release())
        .catch(err => {
          console.warn('[TTSStore] release on TTS opt-out failed:', err);
        });
    }
  }

  setCurrentVoice(v: Voice | null) {
    this.currentVoice = v;
  }

  setSupertonicSteps(steps: SupertonicSteps) {
    this.supertonicSteps = steps;
  }

  /**
   * The sole explicit writer of `supertonicLanguage` (the language picker).
   * Takes effect on the next utterance; in-flight playback is not restarted.
   */
  setSupertonicLanguage(language: SupertonicLanguage) {
    this.supertonicLanguage = language;
  }

  openSetupSheet() {
    this.isSetupSheetOpen = true;
    this.refreshFreeDisk();
  }

  /** Re-read free disk space. Called on sheet open so the UI can
   *  disable Install buttons for engines that won't fit. */
  async refreshFreeDisk() {
    try {
      const bytes = await DeviceInfo.getFreeDiskStorage('important');
      runInAction(() => {
        this.freeDiskBytes = bytes;
      });
    } catch (err) {
      console.warn('[TTSStore] refreshFreeDisk failed:', err);
    }
  }

  closeSetupSheet() {
    this.isSetupSheetOpen = false;
  }

  // --- Per-engine state helpers ----------------------------------------

  private setDownloadState(id: NeuralEngineId, state: NeuralDownloadState) {
    if (id === 'supertonic') {
      this.supertonicDownloadState = state;
    } else if (id === 'kokoro') {
      this.kokoroDownloadState = state;
    } else {
      this.kittenDownloadState = state;
    }
  }

  private setDownloadProgress(id: NeuralEngineId, progress: number) {
    if (id === 'supertonic') {
      this.supertonicDownloadProgress = progress;
    } else if (id === 'kokoro') {
      this.kokoroDownloadProgress = progress;
    } else {
      this.kittenDownloadProgress = progress;
    }
  }

  private setDownloadError(id: NeuralEngineId, error: string | null) {
    if (id === 'supertonic') {
      this.supertonicDownloadError = error;
    } else if (id === 'kokoro') {
      this.kokoroDownloadError = error;
    } else {
      this.kittenDownloadError = error;
    }
  }

  private getDownloadState(id: NeuralEngineId): NeuralDownloadState {
    if (id === 'supertonic') {
      return this.supertonicDownloadState;
    }
    if (id === 'kokoro') {
      return this.kokoroDownloadState;
    }
    return this.kittenDownloadState;
  }

  /**
   * Stop any in-flight playback and reset state to idle.
   */
  async stop(): Promise<void> {
    const state = this.playbackState;
    runInAction(() => {
      this.playbackState = {mode: 'idle'};
    });
    this.streamStripper = null;
    this.streamPlaceholderEmitted = false;
    if (state.mode === 'streaming') {
      try {
        await state.handle.cancel();
      } catch (err) {
        console.warn('[TTSStore] streaming cancel failed:', err);
      }
      return;
    }
    // 停播一律走 runtime（W1a 噪音根治）：`Speech.stop()` 是**全局**调用，旧写法
    // `getEngine(voice.engine).stop()` 在没有任何引擎活跃时也照样打一次，
    // HyperOS 上就抛 `Failed to initialize TTS engine (speech_error)`（真机
    // 2026-09-05 实证：播报明明成功，日志里每次都带一条 stop 失败）。
    // `ttsRuntime.stop()` 无活跃引擎时 no-op，且与 acquire 串行。
    // 走到这里的异常已被 runtime 按 TTS_SPEC §2 定性为**真失败**
    // （系统合成器该停而没停下来）：不吞、保留显式报错可追溯；
    // 也不冒充 `speakIssue='failed'`——那个字段的语义是「尝试播但播不出」，
    // 与「停不下」不是一回事，串用会误导状态行文案。
    try {
      await ttsRuntime.stop();
    } catch (err) {
      console.warn('[TTSStore] native stop failed (classified real):', err);
    }
  }

  /**
   * Speak `text` as a single utterance (replay path).
   */
  async play(
    messageId: string,
    text: string,
    opts?: {hadReasoning?: boolean; voiceOverride?: Voice},
  ): Promise<void> {
    const voice = opts?.voiceOverride ?? this.currentVoice;
    // 门合并（W1a）：设备/音色/引擎三判一处（`canSpeakVoice`）。被挡住就**不播也不谎报**，
    // 原因由 UI 读同一个门说给用户（通话页状态行 / 消息页朗读入口），
    // 不再各调用点各拼一套。
    if (!this.canSpeakVoice(voice)) {
      return;
    }

    await this.stop();

    const {text: cleanText, hadNonEmptyThink} = ThinkingStripper.stripFinal(
      text,
      {hadReasoning: opts?.hadReasoning},
    );
    const spokenText = hadNonEmptyThink
      ? `${pickThinkingPlaceholder()} ${cleanText}`
      : cleanText;

    runInAction(() => {
      this.playbackState = {mode: 'playing', messageId};
      this.speakIssue = isVoiceMismatchedForText(text, voice) ? 'lang' : null;
    });

    try {
      const engine = getEngine(voice.engine);
      if (voice.engine === 'supertonic') {
        await (engine as SupertonicEngine).play(spokenText, voice, {
          language: this.supertonicLanguage,
          inferenceSteps: this.supertonicSteps,
        });
      } else {
        await engine.play(spokenText, voice);
      }
    } catch (err) {
      console.warn('[TTSStore] play failed:', err);
      // 失败必须可见（W1a）：上一版只留日志，UI 依旧报「播报就绪」。
      runInAction(() => {
        this.speakIssue = 'failed';
      });
    } finally {
      runInAction(() => {
        if (
          this.playbackState.mode === 'playing' &&
          this.playbackState.messageId === messageId
        ) {
          this.playbackState = {mode: 'idle'};
        }
      });
    }
  }

  /**
   * Audition path — speak `TTS_PREVIEW_SAMPLE` with `voice` and route
   * through the store so it interacts cleanly with any in-flight stream
   * or replay (no overlapping audio, no engine-swap races).
   *
   * Skips the thinking-stripper entirely — preview text is fixed and
   * known clean.
   *
   * messageId is engine-qualified (`preview:<engine>:<voiceId>`) so two
   * engines that share a voice id can't collide on the cleanup guard.
   */
  async preview(voice: Voice): Promise<void> {
    if (!this.canSpeakVoice(voice)) {
      return;
    }
    const messageId = previewMessageId(voice);
    await this.stop();
    runInAction(() => {
      this.playbackState = {mode: 'playing', messageId};
    });
    try {
      const engine = getEngine(voice.engine);
      if (voice.engine === 'supertonic') {
        await (engine as SupertonicEngine).play(TTS_PREVIEW_SAMPLE, voice, {
          language: this.supertonicLanguage,
          inferenceSteps: this.supertonicSteps,
        });
      } else {
        await engine.play(TTS_PREVIEW_SAMPLE, voice);
      }
    } catch (err) {
      console.warn('[TTSStore] preview failed:', err);
    } finally {
      runInAction(() => {
        if (
          this.playbackState.mode === 'playing' &&
          this.playbackState.messageId === messageId
        ) {
          this.playbackState = {mode: 'idle'};
        }
      });
    }
  }

  /**
   * `true` when a preview for `voice` is currently in flight. Components
   * use this to swap their play icon for stop while the engine loads
   * and speaks (Kokoro warm-up is ~4s — without this the user has no
   * feedback that their tap registered).
   */
  isPreviewingVoice(voice: Voice): boolean {
    return (
      this.playbackState.mode === 'playing' &&
      this.playbackState.messageId === previewMessageId(voice)
    );
  }

  /** First token / message creation. Opens a streaming session.
   *
   * `opts.forceSpeak`（PHONE_SPEC §11.3）：电话模式单轮强制播报——与用户
   * 「自动朗读」偏好正交（不修改开关）。门条件 = `autoSpeakEnabled ||
   * forceSpeak`；播报门（`canSpeakVoice`：设备/音色/引擎三判一处）与
   * idempotency 门不变。根治：v2.0 电话模式 useChatSession 已强制 tts.enabled，
   * 但本方法另有一道 autoSpeakEnabled 门 → 流式播报从未开流（听不到语音输出）。 */
  onAssistantMessageStart(
    messageId: string,
    opts?: {forceSpeak?: boolean},
  ): void {
    const voice = this.currentVoice;
    if (
      !this.canSpeakVoice(voice) ||
      !(opts?.forceSpeak || this.autoSpeakEnabled) ||
      messageId === this.lastSpokenMessageId
    ) {
      return;
    }
    // Stop ANY prior playback before opening the new session. The stop
    // promise is passed to the streaming handle so it waits for the old
    // `Speech.stop()` to complete before starting synthesis — prevents
    // the old stop flag from killing the new stream's first sentence.
    const stopDone = this.stop().catch(err => {
      console.warn('[TTSStore] stop before new stream failed:', err);
    });

    this.lastSpokenMessageId = messageId;
    this.streamStripper = new ThinkingStripper();
    this.streamPlaceholderEmitted = false;
    const engine = getEngine(voice.engine);
    const handle =
      voice.engine === 'supertonic'
        ? (engine as SupertonicEngine).playStreaming(voice, stopDone, {
            language: this.supertonicLanguage,
            inferenceSteps: this.supertonicSteps,
          })
        : engine.playStreaming(voice, stopDone);
    runInAction(() => {
      this.playbackState = {mode: 'streaming', messageId, handle};
    });
  }

  /** Delta chunk from the LLM stream. */
  onAssistantMessageChunk(
    messageId: string,
    chunkText: string,
    reasoningDelta?: string,
  ) {
    const state = this.playbackState;
    if (state.mode !== 'streaming' || state.messageId !== messageId) {
      return;
    }
    const stripper = this.streamStripper;
    if (stripper == null) {
      state.handle.appendText(chunkText);
      return;
    }
    if (reasoningDelta) {
      stripper.noteReasoning(reasoningDelta);
    }
    const cleaned = stripper.feed(chunkText);
    if (
      stripper.hadNonEmptyThink() &&
      !this.streamPlaceholderEmitted &&
      cleaned.length === 0
    ) {
      state.handle.appendText(`${pickThinkingPlaceholder()} `);
      this.streamPlaceholderEmitted = true;
      return;
    }
    if (cleaned.length > 0) {
      if (stripper.hadNonEmptyThink() && !this.streamPlaceholderEmitted) {
        state.handle.appendText(`${pickThinkingPlaceholder()} `);
        this.streamPlaceholderEmitted = true;
      }
      state.handle.appendText(cleaned);
    }
  }

  /** Final completion — flushes streaming or falls back to replay.
   * `opts.forceSpeak`：与 onAssistantMessageStart 同一门语义（PHONE_SPEC §11.3），
   * 回落播报分支也认同一条规则，不另设第二处判断。 */
  onAssistantMessageComplete(
    messageId: string,
    text: string,
    opts?: {hadReasoning?: boolean; forceSpeak?: boolean},
  ) {
    const state = this.playbackState;
    if (state.mode === 'streaming' && state.messageId === messageId) {
      // 流式主路也要判定语种（W1a）：文本到这里已完整，不在 chunk 热路径上重复判。
      if (isVoiceMismatchedForText(text, this.currentVoice)) {
        runInAction(() => {
          this.speakIssue = 'lang';
        });
      }
      const stripper = this.streamStripper;
      if (stripper != null) {
        const leftover = stripper.flush();
        if (leftover.length > 0) {
          if (stripper.hadNonEmptyThink() && !this.streamPlaceholderEmitted) {
            state.handle.appendText(`${pickThinkingPlaceholder()} `);
            this.streamPlaceholderEmitted = true;
          }
          state.handle.appendText(leftover);
        }
      }
      state.handle
        .finalize()
        .catch(err => {
          console.warn('[TTSStore] finalize failed:', err);
        })
        .finally(() => {
          runInAction(() => {
            if (
              this.playbackState.mode === 'streaming' &&
              this.playbackState.messageId === messageId
            ) {
              this.playbackState = {mode: 'idle'};
              // Only reset stripper if this message still owns it —
              // a new message may have already set its own stripper.
              this.streamStripper = null;
              this.streamPlaceholderEmitted = false;
            }
          });
        });
      return;
    }

    const completeVoice = this.currentVoice;
    if (
      !this.canSpeakVoice(completeVoice) ||
      !(opts?.forceSpeak || this.autoSpeakEnabled) ||
      messageId === this.lastSpokenMessageId
    ) {
      return;
    }
    this.lastSpokenMessageId = messageId;
    this.play(messageId, text, {hadReasoning: opts?.hadReasoning}).catch(() => {
      // play() already logs and recovers; swallow to satisfy no-floating-promises.
    });
  }

  // --- Per-engine download actions --------------------------------------

  private static readonly ENGINE_ESTIMATED_BYTES: Record<
    NeuralEngineId,
    number
  > = {
    supertonic: SUPERTONIC_MODEL_ESTIMATED_BYTES,
    kokoro: KOKORO_MODEL_ESTIMATED_BYTES,
    kitten: KITTEN_MODEL_ESTIMATED_BYTES,
  };

  private async downloadNeuralEngine(id: NeuralEngineId): Promise<void> {
    if (this.getDownloadState(id) === 'downloading') {
      return;
    }
    // Set downloading immediately so concurrent calls are blocked.
    runInAction(() => {
      this.setDownloadState(id, 'downloading');
      this.setDownloadProgress(id, 0);
      this.setDownloadError(id, null);
    });

    const engine = getEngine(id) as
      | SupertonicEngine
      | KokoroEngine
      | KittenEngine;

    // Reclaim engine-specific legacy files BEFORE the disk-space preflight,
    // so a borderline device upgrading from an older engine layout (e.g.
    // Kokoro FP16 → FP32) is not blocked by space the migration is about to
    // free. Idempotent; safe when there is nothing to reclaim.
    if (
      'reclaimLegacySpace' in engine &&
      typeof engine.reclaimLegacySpace === 'function'
    ) {
      try {
        await engine.reclaimLegacySpace();
      } catch (err) {
        console.warn(`[TTSStore] ${id} legacy reclaim failed:`, err);
      }
    }

    // Safety-net disk-space check. The UI already disables the Install
    // button when `freeDiskBytes` is too low, so this is a last resort
    // guard for race conditions (space changed between sheet open and tap).
    const estimatedBytes = TTSStore.ENGINE_ESTIMATED_BYTES[id];
    const requiredBytes = Math.ceil(estimatedBytes * 1.2);
    try {
      const freeBytes = await DeviceInfo.getFreeDiskStorage('important');
      if (freeBytes < requiredBytes) {
        runInAction(() => {
          this.setDownloadState(id, 'not_installed');
          this.freeDiskBytes = freeBytes;
        });
        return;
      }
    } catch (err) {
      console.warn('[TTSStore] disk-space preflight failed:', err);
    }
    try {
      await engine.downloadModel(progress => {
        runInAction(() => {
          this.setDownloadProgress(id, progress);
        });
      });
      // Auto-select a voice when none is set — so play and auto-speak work
      // immediately after install. If a previous selection for this engine
      // was stashed during init() (e.g. forced re-download after a model
      // layout migration), restore it when still valid; otherwise fall
      // back to the first voice.
      const voices = await engine.getVoices();
      runInAction(() => {
        this.setDownloadState(id, 'ready');
        this.setDownloadProgress(id, 1);
        if (this.currentVoice == null && voices.length > 0) {
          const pendingId = this.pendingVoiceRestore[id];
          const restored =
            pendingId != null ? voices.find(v => v.id === pendingId) : null;
          this.currentVoice = restored ?? pickDefaultVoice(voices);
        }
        delete this.pendingVoiceRestore[id];
      });
    } catch (err) {
      console.warn(`[TTSStore] ${id} download failed:`, err);
      const message = err instanceof Error ? err.message : String(err);
      runInAction(() => {
        this.setDownloadState(id, 'error');
        this.setDownloadError(id, message);
      });
    }
  }

  private async deleteNeuralEngine(id: NeuralEngineId): Promise<void> {
    // Defensive: refuse to delete while a download is writing into the
    // same directory. The UI never offers delete in this state, but the
    // store API is public — guard anyway. Mirrors `downloadNeuralEngine`'s
    // own early-return on duplicate downloads.
    if (this.getDownloadState(id) === 'downloading') {
      return;
    }
    const engine = getEngine(id) as
      | SupertonicEngine
      | KokoroEngine
      | KittenEngine;
    // If this engine is currently active, stop in-flight audio AND
    // release the native resources BEFORE unlinking files. Skipping
    // either step risks a native crash from the engine touching files
    // that have just been removed under it.
    if (ttsRuntime.getActiveEngineId() === id) {
      await this.stop();
      await ttsRuntime.release();
    }
    try {
      await engine.deleteModel();
    } catch (err) {
      console.warn(`[TTSStore] ${id} delete failed:`, err);
    }
    runInAction(() => {
      this.setDownloadState(id, 'not_installed');
      this.setDownloadProgress(id, 0);
      this.setDownloadError(id, null);
      if (this.currentVoice?.engine === id) {
        this.currentVoice = null;
      }
    });
  }

  async downloadSupertonic(): Promise<void> {
    return this.downloadNeuralEngine('supertonic');
  }

  async downloadKokoro(): Promise<void> {
    return this.downloadNeuralEngine('kokoro');
  }

  async downloadKitten(): Promise<void> {
    return this.downloadNeuralEngine('kitten');
  }

  /** Retry a failed Supertonic download (preserved for API compat). */
  async retryDownload(): Promise<void> {
    return this.downloadNeuralEngine('supertonic');
  }

  async retryKokoroDownload(): Promise<void> {
    return this.downloadNeuralEngine('kokoro');
  }

  async retryKittenDownload(): Promise<void> {
    return this.downloadNeuralEngine('kitten');
  }

  async deleteSupertonic(): Promise<void> {
    return this.deleteNeuralEngine('supertonic');
  }

  async deleteKokoro(): Promise<void> {
    return this.deleteNeuralEngine('kokoro');
  }

  async deleteKitten(): Promise<void> {
    return this.deleteNeuralEngine('kitten');
  }
}

export const ttsStore = new TTSStore();
