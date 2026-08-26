import {Platform} from 'react-native';

import * as RNFS from '@dr.pogodin/react-native-fs';
import Speech, {TTSEngine} from '@pocketpalai/react-native-speech';

import {
  KITTEN_MODEL_BASE_URL,
  KITTEN_MODEL_FILES,
  KITTEN_MODEL_SUBDIR,
  KITTEN_SHERPA_BASE_URL,
  KITTEN_SHERPA_ESPEAK_DIR,
  KITTEN_SHERPA_FILES,
  KITTEN_SHERPA_MODEL_ID,
  TTS_DICT_FILENAME,
  TTS_DICT_URL,
  TTS_PARENT_SUBDIR,
} from '../../constants';
import {fetchModelFilesDetails} from '../../../../api/hf';
import {ttsRuntime} from '../../runtime';
import {createEngineStreamingHandle} from '../../streamingHandle';
import type {Engine, StreamingHandle, Voice} from '../../types';
import {KITTEN_VOICES} from './voices';

export type KittenProgressCallback = (progress: number) => void;

/**
 * Kitten neural TTS engine (15M StyleTTS2, English only).
 *
 * Installation is two-phase (B37/§81): Phase 1 downloads the fork playback
 * chain (ONNX model + voices manifest + IPA dict) and is all-or-nothing —
 * on any failure the entire `tts/kitten/` directory is removed so a retry
 * starts clean. Phase 2 downloads the sherpa generation chain (official
 * v0.1 fp16 model + voices.bin + tokens.txt + the espeak-ng-data phonemizer
 * tree, enumerated live from the HF API). The two chains are file-format
 * incompatible (palshub 0.8 vs sherpa v0.1) and are kept under distinct
 * local filenames so they never collide. A Phase 2 failure only rolls back
 * the sherpa files — the playback chain stays usable — and the generation
 * chain then reports the honest "model not fully installed" state
 * (CP-APP-011) instead of marking the whole engine as an error.
 *
 * CPU-only execution is forced to match the other neural engines.
 */
export class KittenEngine implements Engine {
  readonly id = 'kitten' as const;

  private getParentDir(): string {
    const root =
      Platform.OS === 'ios'
        ? `${RNFS.LibraryDirectoryPath}/Application Support`
        : RNFS.DocumentDirectoryPath;
    return `${root}/${TTS_PARENT_SUBDIR}`;
  }

  getModelPath(): string {
    const root =
      Platform.OS === 'ios'
        ? `${RNFS.LibraryDirectoryPath}/Application Support`
        : RNFS.DocumentDirectoryPath;
    return `${root}/${KITTEN_MODEL_SUBDIR}`;
  }

  private getFilePath(filename: string): string {
    return `${this.getModelPath()}/${filename}`;
  }

  async isInstalled(): Promise<boolean> {
    try {
      for (const file of KITTEN_MODEL_FILES) {
        if (!(await RNFS.exists(this.getFilePath(file.name)))) {
          return false;
        }
      }
      return RNFS.exists(this.getFilePath(TTS_DICT_FILENAME));
    } catch (err) {
      console.warn('[KittenEngine] isInstalled check failed:', err);
      return false;
    }
  }

  async getVoices(): Promise<Voice[]> {
    return KITTEN_VOICES;
  }

  async downloadModel(onProgress?: KittenProgressCallback): Promise<void> {
    const parentDir = this.getParentDir();
    const modelDir = this.getModelPath();

    await RNFS.mkdir(parentDir, {NSURLIsExcludedFromBackupKey: true});
    await RNFS.mkdir(modelDir, {NSURLIsExcludedFromBackupKey: true});

    // Phase 1 — fork playback chain: all-or-nothing (existing behavior).
    // Progress maps to [0, 0.5].
    const phase1Files = [
      ...KITTEN_MODEL_FILES.map(f => ({
        name: f.name,
        url: `${KITTEN_MODEL_BASE_URL}/${f.urlPath}`,
      })),
      {name: TTS_DICT_FILENAME, url: TTS_DICT_URL},
    ];
    const phase1Progress = new Array(phase1Files.length).fill(0);
    const reportPhase1 = () => {
      if (!onProgress) {
        return;
      }
      const sum = phase1Progress.reduce((a, b) => a + b, 0);
      onProgress(Math.min(0.5, 0.5 * (sum / phase1Files.length)));
    };

    try {
      for (let i = 0; i < phase1Files.length; i++) {
        const file = phase1Files[i]!;
        const target = this.getFilePath(file.name);
        const result = await RNFS.downloadFile({
          fromUrl: file.url,
          toFile: target,
          background: false,
          discretionary: false,
          cacheable: false,
          progressInterval: 500,
          progress: res => {
            const contentLength = res.contentLength || 1;
            phase1Progress[i] = Math.min(1, res.bytesWritten / contentLength);
            reportPhase1();
          },
        }).promise;

        if (result.statusCode !== 200) {
          throw new Error(
            `Failed to download ${file.name}: HTTP ${result.statusCode}`,
          );
        }
        phase1Progress[i] = 1;
        reportPhase1();
      }
    } catch (err) {
      try {
        if (await RNFS.exists(modelDir)) {
          await RNFS.unlink(modelDir);
        }
      } catch (cleanupErr) {
        console.warn(
          '[KittenEngine] partial-download cleanup failed:',
          cleanupErr,
        );
      }
      throw err;
    }

    // Phase 2 — sherpa generation chain. A failure here must NOT mark the
    // engine as an error (the playback chain above is already usable): roll
    // back the sherpa files for a clean retry, warn, and let the generation
    // chain report "model not fully installed" (isTtsGenInstalled → false).
    try {
      await this.downloadSherpaGenerationChain(modelDir, frac => {
        if (onProgress) {
          onProgress(0.5 + 0.5 * frac);
        }
      });
    } catch (err) {
      await this.rollbackSherpaGenerationChain(modelDir);
      console.warn(
        '[KittenEngine] sherpa generation chain download failed ' +
          '(playback chain unaffected):',
        err,
      );
    }

    if (onProgress) {
      onProgress(1);
    }
  }

  /**
   * Phase 2 of the Kitten install: the sherpa generation chain.
   *
   * Three fixed files (official v0.1 fp16 model + voices.bin + tokens.txt)
   * plus the `espeak-ng-data/` phonemizer tree. The tree (~119 files with
   * nested `lang/` + `voices/` subdirectories) is enumerated live from the
   * HF tree API — never hardcoded — so the list tracks upstream additions.
   * Existing files are skipped, making re-runs after a partial Phase 2
   * incremental. Progress is reported as a fraction in [0, 1]; the caller
   * maps it onto the overall [0.5, 1] band.
   */
  private async downloadSherpaGenerationChain(
    modelDir: string,
    onProgress: (frac: number) => void,
  ): Promise<void> {
    const fixed = KITTEN_SHERPA_FILES.map(f => ({
      remotePath: f.urlPath,
      localName: f.name,
    }));

    // Enumerate the espeak tree; a tree fetch failure aborts Phase 2 (the
    // generation chain would be unusable without its phonemizer data).
    const tree = await fetchModelFilesDetails(KITTEN_SHERPA_MODEL_ID);
    const espeakFiles = tree
      .filter(
        f =>
          f.type === 'file' &&
          f.path.startsWith(`${KITTEN_SHERPA_ESPEAK_DIR}/`),
      )
      .map(f => ({remotePath: f.path, localName: f.path}));

    const all = [...fixed, ...espeakFiles];
    const total = all.length;
    if (total === 0) {
      throw new Error('Kitten sherpa 文件清单为空');
    }
    let done = 0;
    const bump = () => {
      done += 1;
      onProgress(Math.min(1, done / total));
    };

    for (const file of all) {
      const target = this.getFilePath(file.localName);
      // Incremental: skip already-present files (clean retry after rollback
      // still re-downloads the failed one, since rollback removes it).
      if (await RNFS.exists(target)) {
        bump();
        continue;
      }
      // RNFS mkdir is recursive on both platforms (Android File.mkdirs(),
      // iOS withIntermediateDirectories:YES), so nested espeak subdirs
      // (lang/, voices/en/) are created along with their parent.
      await RNFS.mkdir(target.substring(0, target.lastIndexOf('/')), {
        NSURLIsExcludedFromBackupKey: true,
      });
      const result = await RNFS.downloadFile({
        fromUrl: `${KITTEN_SHERPA_BASE_URL}/${file.remotePath}`,
        toFile: target,
        background: false,
        discretionary: false,
        cacheable: false,
      }).promise;

      if (result.statusCode !== 200) {
        throw new Error(
          `Failed to download ${file.localName}: HTTP ${result.statusCode}`,
        );
      }
      bump();
    }
  }

  /**
   * Remove only the sherpa generation-chain files (Phase 2), preserving the
   * fork playback chain (Phase 1) so the engine stays playable. Best-effort:
   * each removal is independent and a cleanup failure never masks the
   * original Phase 2 error.
   */
  private async rollbackSherpaGenerationChain(modelDir: string): Promise<void> {
    const targets = [
      ...KITTEN_SHERPA_FILES.map(f => `${modelDir}/${f.name}`),
      `${modelDir}/${KITTEN_SHERPA_ESPEAK_DIR}`,
    ];
    for (const target of targets) {
      try {
        if (await RNFS.exists(target)) {
          await RNFS.unlink(target);
        }
      } catch (cleanupErr) {
        console.warn(
          `[KittenEngine] sherpa rollback of ${target} failed:`,
          cleanupErr,
        );
      }
    }
  }

  async deleteModel(): Promise<void> {
    try {
      if (await RNFS.exists(this.getModelPath())) {
        await RNFS.unlink(this.getModelPath());
      }
    } catch (err) {
      console.warn('[KittenEngine] deleteModel failed:', err);
    }
  }

  async loadInto(): Promise<void> {
    const modelDir = this.getModelPath();
    await Speech.initialize({
      engine: TTSEngine.KITTEN,
      modelPath: `file://${modelDir}/kitten.onnx`,
      voicesPath: `file://${modelDir}/voices-manifest.json`,
      dictPath: `file://${modelDir}/${TTS_DICT_FILENAME}`,
      executionProviders: ['cpu'],
      maxChunkSize: 200,
      silentMode: 'obey',
      ducking: true,
    });
  }

  async play(text: string, voice: Voice): Promise<void> {
    if (!(await this.isInstalled())) {
      throw new Error('Kitten model is not installed');
    }
    await ttsRuntime.acquire(this, () => Speech.speak(text, voice.id));
  }

  playStreaming(voice: Voice, waitFor?: Promise<void>): StreamingHandle {
    return createEngineStreamingHandle(this, voice.id, undefined, waitFor);
  }

  async stop(): Promise<void> {
    await Speech.stop();
  }
}
