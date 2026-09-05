import Speech, {TTSEngine} from '@pocketpalai/react-native-speech';

import {ttsRuntime} from '../../runtime';
import {createEngineStreamingHandle} from '../../streamingHandle';
import type {Engine, StreamingHandle, Voice} from '../../types';
import {getSystemVoices} from './voices';

/**
 * Thin wrapper around the OS native TTS path exposed by
 * `@pocketpalai/react-native-speech`.
 *
 * **不假定“系统引擎永远可用”**（2026-09-05 K90 实证推翻）：HyperOS 的 OS 语音引擎
 * 是 `com.xiaomi.mibrain.speech`（小爱），**需用户先在厂商协议页同意激活**；未激活时
 * speak/stop 直接抛 `Failed to initialize TTS engine (code: speech_error)`。
 * 旧写法 `isInstalled()` 硬编码 `return true` 就是「UI 显示播报就绪、实际播不出」的
 * 直接根因——就绪态与实际可播不同源。
 */
export class SystemEngine implements Engine {
  readonly id = 'system' as const;

  /** OS 提供，无端侧模型文件——就绪与否只看「系统真给出音色目录」的探测结果。 */
  readonly requiresModelFile = false;

  /**
   * 就绪 = 系统真的给出音色目录。拿不到（未激活 / 无引擎 / 探测抛错）一律算不可用，
   * 由上层给出可见提示，不假装就绪。
   */
  async isInstalled(): Promise<boolean> {
    try {
      return (await getSystemVoices()).length > 0;
    } catch {
      return false;
    }
  }

  getVoices(): Promise<Voice[]> {
    return getSystemVoices();
  }

  /**
   * The fork still requires `Speech.initialize({engine: OS_NATIVE})` when
   * switching from a neural engine — needed so playback routes through the
   * OS native path instead of staying on the previously-active neural
   * engine. The runtime calls this whenever System becomes the active
   * engine; switching back to a neural engine triggers its own loadInto.
   */
  async loadInto(): Promise<void> {
    await Speech.initialize({engine: TTSEngine.OS_NATIVE});
  }

  async play(text: string, voice: Voice): Promise<void> {
    await ttsRuntime.acquire(this, () => Speech.speak(text, voice.id));
  }

  /**
   * Streaming path. The library's stream degrades to roughly per-sentence
   * speaks on OS engine (native `speak()` resolves on dispatch, so the
   * stream's underrun guard fires immediately), but the OS native queue
   * handles the chaining — behavior is equivalent to the prior JS-side
   * `onFinish` loop and we inherit the library's CJK sentence handling.
   */
  playStreaming(voice: Voice, waitFor?: Promise<void>): StreamingHandle {
    return createEngineStreamingHandle(this, voice.id, undefined, waitFor);
  }
}
