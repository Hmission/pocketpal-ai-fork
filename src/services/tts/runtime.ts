import Speech from '@pocketpalai/react-native-speech';

import {ttsStopFailureIsReal} from './stopOutcome';
import type {Engine, EngineId} from './types';

/**
 * Single-slot coordinator for the TTS native runtime.
 *
 * The fork's `Speech` module is global — only one neural engine has its
 * model loaded at a time. The previous design tracked initialization
 * per-engine-wrapper, which lied: a wrapper said `initialized=true`
 * even after another engine had silently swapped it out at the native
 * layer.
 *
 * `TTSRuntime` owns the truth ("which engine is currently loaded in
 * native land") and serializes all engine swaps and initialization
 * calls. Engine wrappers route their `play()` / `playStreaming()`
 * through `acquire()`, which guarantees the requested engine is the
 * active one before invoking the work fn.
 */
class TTSRuntime {
  /** id of the engine currently loaded in native land, null if released. */
  private activeEngineId: EngineId | null = null;
  /**
   * OS 合成器是否可用——**镜像值**，唯一写入点是 `setOsChannelReady()`
   * （由 TTSStore 探测 `osTTSReady` 后推入）。runtime 需要它才能给 stop 的
   * 失败定性，而事实的源头始终在 store，不在这里造第二份判定。
   * 规范：docs/POCKETPAL_TTS_SPEC.md §2。
   */
  private osChannelReady: boolean | null = null;
  /** FIFO chain of pending operations — guarantees no concurrent swaps. */
  private opMutex: Promise<unknown> = Promise.resolve();

  /** TTSStore 探测完 OS 引擎后推入（唯一写入点）。 */
  setOsChannelReady(ready: boolean | null): void {
    this.osChannelReady = ready;
  }

  /**
   * Run `fn` with `engineId` guaranteed to be the active native engine.
   * Releases the previous engine (if neural) and loads the new one when
   * the active id doesn't match.
   *
   * Calls are serialized — concurrent acquires queue rather than racing.
   */
  async acquire<T>(engine: Engine, fn: () => Promise<T>): Promise<T> {
    return this.serialize(async () => {
      if (this.activeEngineId !== engine.id) {
        if (this.activeEngineId !== null) {
          await this.releaseInternal();
        }
        await engine.loadInto();
        this.activeEngineId = engine.id;
      }
      return fn();
    });
  }

  /**
   * Release the active engine's native resources. Safe to call when no
   * engine is active (no-op). Serialized with `acquire`.
   */
  async release(): Promise<void> {
    await this.serialize(async () => {
      await this.releaseInternal();
    });
  }

  /**
   * Stop any in-flight native playback. Serialized with `acquire` so a
   * subsequent `acquire()` queued on the same mutex runs AFTER the stop
   * completes — this is the only reason to prefer this over calling
   * `Speech.stop()` directly. Without serialization, a fire-and-forget
   * stop can cancel a newly-started utterance that was ordered later in
   * JS but reached native first.
   *
   * No-op when no engine is active.
   *
   * 失败不再无差别吞掉也不再无差别报警：`Speech.stop()` 是合体 API
   * （同步置 neural 停止标志 + `await TurboSpeech.stop()`），而本仓拿不到
   * 「只停 neural」的出口。真机取证（TTS_SPEC §5）：HyperOS 上
   * `tts_current_engine = null`，OS 合成器从未就绪，于是每一次 stop 都会
   * 现场 new 一颗 TextToSpeech、重试耗尽后回 `Failed to initialize TTS engine`
   * ——那是**假失败**（neural 已停，本仓意图已达成）。现在只把真失败抛出，
   * 由调用方决定怎么显示；假失败不再产生任何信号。
   */
  async stop(): Promise<void> {
    await this.serialize(async () => {
      const active = this.activeEngineId;
      if (active === null) {
        return;
      }
      try {
        await Speech.stop();
      } catch (err) {
        if (!ttsStopFailureIsReal(active, this.osChannelReady)) {
          return;
        }
        throw err;
      }
    });
  }

  /**
   * 把一个**必须与引擎换入换出互斥**的外部原生操作排进同一条串行链。
   * 存在理由：流式 `stream.cancel()` 内部会打 `Speech.stop()`（lib 在建流时
   * 就把 stop 绑进了 stream），但它不属于本仓任何方法——不排进来就是绕过
   * 串行链的第二出口。注意只包「执行」，不拿它替换 cancel 本身：
   * cancel 内部的清缓冲 / 释放 stopSignal / 等 loopPromise / 清理进度订阅
   * 一个都不能少（TTS_SPEC §3）。
   */
  serializeNative<T>(fn: () => Promise<T>): Promise<T> {
    return this.serialize(fn);
  }

  /** Read-only view of which engine is currently loaded. Test/diagnostic use. */
  getActiveEngineId(): EngineId | null {
    return this.activeEngineId;
  }

  /**
   * Test-only synchronous reset. Clears the active id and resets the
   * mutex chain to a fresh resolved promise so a singleton runtime can
   * be used across isolated test cases without inter-test leakage.
   */
  _resetForTests(): void {
    this.activeEngineId = null;
    this.osChannelReady = null;
    this.opMutex = Promise.resolve();
  }

  private async releaseInternal(): Promise<void> {
    const prev = this.activeEngineId;
    if (prev === null) {
      return;
    }
    // System engine doesn't hold neural resources — nothing to release.
    if (prev !== 'system') {
      try {
        await Speech.release();
      } catch (err) {
        console.warn(`[ttsRuntime] release failed for ${prev}:`, err);
      }
    }
    this.activeEngineId = null;
  }

  private serialize<T>(fn: () => Promise<T>): Promise<T> {
    const next = this.opMutex.then(fn, fn);
    // Keep the chain alive even if `fn` rejects. Swallow only here; the
    // returned promise still propagates the original rejection to the
    // caller.
    this.opMutex = next.catch(() => undefined);
    return next;
  }
}

export const ttsRuntime = new TTSRuntime();
