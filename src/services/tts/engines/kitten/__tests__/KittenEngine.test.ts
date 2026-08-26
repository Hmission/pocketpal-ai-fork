/**
 * Tests for KittenEngine (two-phase install: Phase 1 fork playback chain
 * all-or-nothing + Phase 2 sherpa generation chain with targeted rollback).
 */

import {Platform} from 'react-native';
import * as RNFS from '@dr.pogodin/react-native-fs';
import Speech, {TTSEngine} from '@pocketpalai/react-native-speech';

jest.mock('../../../../../api/hf', () => ({
  fetchModelFilesDetails: jest.fn(),
}));

import {KittenEngine} from '..';
import {fetchModelFilesDetails} from '../../../../../api/hf';
import {
  KITTEN_MODEL_BASE_URL,
  KITTEN_MODEL_FILES,
  KITTEN_SHERPA_BASE_URL,
  KITTEN_SHERPA_ESPEAK_DIR,
  KITTEN_SHERPA_FILES,
  KITTEN_SHERPA_MODEL_ID,
  TTS_DICT_FILENAME,
  TTS_DICT_URL,
} from '../../../constants';
import {KITTEN_VOICES} from '../voices';

const mockFetchModelFilesDetails = fetchModelFilesDetails as jest.Mock;

const setPlatform = (os: 'ios' | 'android') => {
  Object.defineProperty(Platform, 'OS', {
    configurable: true,
    get: () => os,
  });
};

describe('KittenEngine', () => {
  const anyVoice = KITTEN_VOICES[0]!;

  beforeEach(() => {
    jest.clearAllMocks();
    (RNFS as any).__resetMockState?.();
    setPlatform('ios');
    (RNFS.exists as jest.Mock).mockResolvedValue(false);
    (RNFS.mkdir as jest.Mock).mockResolvedValue(undefined);
    (RNFS.writeFile as jest.Mock).mockResolvedValue(undefined);
    (RNFS.unlink as jest.Mock).mockResolvedValue(undefined);
  });

  describe('getModelPath()', () => {
    it('returns iOS Application Support path on iOS', () => {
      setPlatform('ios');
      expect(new KittenEngine().getModelPath()).toBe(
        '/path/to/library/Application Support/tts/kitten',
      );
    });

    it('returns Documents path on Android', () => {
      setPlatform('android');
      expect(new KittenEngine().getModelPath()).toBe(
        '/path/to/documents/tts/kitten',
      );
    });
  });

  describe('isInstalled()', () => {
    it('returns true when all required files exist', async () => {
      (RNFS.exists as jest.Mock).mockResolvedValue(true);
      await expect(new KittenEngine().isInstalled()).resolves.toBe(true);
    });

    it('returns false when the ONNX model file is missing', async () => {
      (RNFS.exists as jest.Mock).mockImplementation((path: string) =>
        Promise.resolve(!path.endsWith('kitten.onnx')),
      );
      await expect(new KittenEngine().isInstalled()).resolves.toBe(false);
    });

    it('returns false when the IPA dict is missing', async () => {
      (RNFS.exists as jest.Mock).mockImplementation((path: string) =>
        Promise.resolve(!path.endsWith(TTS_DICT_FILENAME)),
      );
      await expect(new KittenEngine().isInstalled()).resolves.toBe(false);
    });
  });

  describe('downloadModel()', () => {
    const okDownload = () => ({
      promise: Promise.resolve({statusCode: 200, bytesWritten: 100}),
      jobId: 1,
    });
    const failDownload = () => ({
      promise: Promise.resolve({statusCode: 500, bytesWritten: 0}),
      jobId: 2,
    });

    /** HF tree API 返回的 espeak-ng-data 文件（扁平化模拟，真实含 lang/ voices/ 子目录） */
    const espeakTree = [
      {type: 'directory', path: 'espeak-ng-data', size: 0},
      {type: 'file', path: 'espeak-ng-data/en_dict', size: 1000},
      {type: 'file', path: 'espeak-ng-data/phontab', size: 1000},
      {type: 'file', path: 'espeak-ng-data/phonindex', size: 1000},
      {type: 'file', path: 'espeak-ng-data/phondata', size: 1000},
      {type: 'file', path: 'espeak-ng-data/intonations', size: 1000},
      {type: 'file', path: 'espeak-ng-data/lang/phondata', size: 1000},
      {type: 'file', path: 'espeak-ng-data/voices/en/en_US', size: 1000},
      // 根目录文件（非 espeak）必须被过滤
      {type: 'file', path: 'model.fp16.onnx', size: 23000000},
      {type: 'file', path: 'voices.bin', size: 8192},
      {type: 'file', path: 'tokens.txt', size: 1064},
    ];
    const treeFileCount = 7; // espeak-ng-data 下 7 个文件
    const phase2Count = KITTEN_SHERPA_FILES.length + treeFileCount;
    const totalDownloadCount = KITTEN_MODEL_FILES.length + 1 + phase2Count; // 3 + 1 + 10

    const downloadCalls = () =>
      (RNFS.downloadFile as jest.Mock).mock.calls.map(
        (c: any[]) => c[0] as {fromUrl: string; toFile: string},
      );

    it('Phase 1 下载播放链三件套（fork 模型 + manifest + IPA dict）', async () => {
      mockFetchModelFilesDetails.mockResolvedValue(espeakTree);
      (RNFS.downloadFile as jest.Mock).mockImplementation(okDownload);

      await new KittenEngine().downloadModel();

      for (const file of KITTEN_MODEL_FILES) {
        expect(RNFS.downloadFile).toHaveBeenCalledWith(
          expect.objectContaining({
            fromUrl: `${KITTEN_MODEL_BASE_URL}/${file.urlPath}`,
            toFile: expect.stringContaining(`/tts/kitten/${file.name}`),
          }),
        );
      }
      expect(RNFS.downloadFile).toHaveBeenCalledWith(
        expect.objectContaining({
          fromUrl: TTS_DICT_URL,
          toFile: expect.stringContaining(`/tts/kitten/${TTS_DICT_FILENAME}`),
        }),
      );
    });

    it('Phase 2 经 HF tree API 枚举并下载 sherpa 生成链（3 固定文件 + espeak 树）', async () => {
      mockFetchModelFilesDetails.mockResolvedValue(espeakTree);
      (RNFS.downloadFile as jest.Mock).mockImplementation(okDownload);

      await new KittenEngine().downloadModel();

      // 树枚举走 sherpa 官方仓库
      expect(mockFetchModelFilesDetails).toHaveBeenCalledWith(
        KITTEN_SHERPA_MODEL_ID,
      );
      // 总下载数 = Phase1(3) + Phase2(3 固定 + 7 espeak)
      expect(RNFS.downloadFile).toHaveBeenCalledTimes(totalDownloadCount);
      // 3 个固定 sherpa 文件：官方源 URL + 本地落盘名（kitten_sherpa.onnx 不撞 fork 的 kitten.onnx）
      for (const file of KITTEN_SHERPA_FILES) {
        expect(RNFS.downloadFile).toHaveBeenCalledWith(
          expect.objectContaining({
            fromUrl: `${KITTEN_SHERPA_BASE_URL}/${file.urlPath}`,
            toFile: expect.stringContaining(`/tts/kitten/${file.name}`),
          }),
        );
      }
      // espeak 树逐文件下载（保留相对路径，非 espeak 根文件被过滤）
      const calls = downloadCalls();
      expect(calls).toContainEqual(
        expect.objectContaining({
          fromUrl: `${KITTEN_SHERPA_BASE_URL}/espeak-ng-data/en_dict`,
          toFile: expect.stringContaining(
            `/tts/kitten/${KITTEN_SHERPA_ESPEAK_DIR}/en_dict`,
          ),
        }),
      );
      expect(calls).toContainEqual(
        expect.objectContaining({
          fromUrl: `${KITTEN_SHERPA_BASE_URL}/espeak-ng-data/lang/phondata`,
          toFile: expect.stringContaining(
            `/tts/kitten/${KITTEN_SHERPA_ESPEAK_DIR}/lang/phondata`,
          ),
        }),
      );
      const rootFileCalls = calls.filter(c =>
        c.toFile.endsWith(`/tts/kitten/${KITTEN_SHERPA_ESPEAK_DIR}`),
      );
      expect(rootFileCalls).toHaveLength(0);
    });

    it('Phase 2 已存在文件跳过（断点续跑幂等）', async () => {
      (RNFS.exists as jest.Mock).mockImplementation((p: string) =>
        Promise.resolve(
          p.endsWith(`/tts/kitten/${KITTEN_SHERPA_ESPEAK_DIR}/en_dict`),
        ),
      );
      mockFetchModelFilesDetails.mockResolvedValue(espeakTree);
      (RNFS.downloadFile as jest.Mock).mockImplementation(okDownload);

      await new KittenEngine().downloadModel();

      // 13 个下载（14 个 Phase2 目标中 en_dict 已存在被跳过）
      expect(RNFS.downloadFile).toHaveBeenCalledTimes(
        KITTEN_MODEL_FILES.length + 1 + (phase2Count - 1),
      );
      const enDictCall = downloadCalls().find(c =>
        c.toFile.endsWith(`${KITTEN_SHERPA_ESPEAK_DIR}/en_dict`),
      );
      expect(enDictCall).toBeUndefined();
    });

    it('Phase 2 中途失败：仅回滚已写入的 sherpa 文件，播放链保留（引擎仍可播放）', async () => {
      mockFetchModelFilesDetails.mockResolvedValue(espeakTree);
      const modelDir = '/path/to/library/Application Support/tts/kitten';
      const espeakDirPath = `${modelDir}/${KITTEN_SHERPA_ESPEAK_DIR}`;
      // 状态化磁盘模型：文件"存在"当且仅当其下载返回 200（espeak 目录在任一子文件写入后即存在）
      const written = new Set<string>();
      let n = 0;
      (RNFS.downloadFile as jest.Mock).mockImplementation((cfg: any) => {
        n += 1;
        // Phase1(3) + sherpa 固定(3) + espeak 前 6 个成功，最后一个 espeak 文件失败
        const ok = n <= 3 + KITTEN_SHERPA_FILES.length + (treeFileCount - 1);
        if (ok) {
          written.add(cfg.toFile);
        }
        return {
          promise: Promise.resolve({
            statusCode: ok ? 200 : 500,
            bytesWritten: ok ? 100 : 0,
          }),
          jobId: n,
        };
      });
      (RNFS.exists as jest.Mock).mockImplementation((p: string) =>
        Promise.resolve(
          written.has(p) ||
            (p === espeakDirPath &&
              [...written].some(w => w.startsWith(`${espeakDirPath}/`))),
        ),
      );

      const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
      // 不抛错——播放链已就绪，Phase 2 失败不得把引擎标记为 error
      await expect(new KittenEngine().downloadModel()).resolves.toBeUndefined();

      const unlinkPaths = (RNFS.unlink as jest.Mock).mock.calls.map(
        (c: any[]) => c[0] as string,
      );
      // 已写入的 sherpa 固定文件 + espeak 目录被定向回滚
      for (const file of KITTEN_SHERPA_FILES) {
        expect(unlinkPaths).toContain(`${modelDir}/${file.name}`);
      }
      expect(unlinkPaths).toContain(espeakDirPath);
      // 播放链目录整体删除未发生（Phase 1 产物保留可用）
      expect(unlinkPaths).not.toContain(modelDir);
      warnSpy.mockRestore();
    });

    it('Phase 2 树枚举失败：无 sherpa 文件写入 → 不触发回滚，播放链保留', async () => {
      mockFetchModelFilesDetails.mockRejectedValue(new Error('network down'));
      (RNFS.downloadFile as jest.Mock).mockImplementation(okDownload);
      // exists 默认 false（无文件写入）

      const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
      await expect(new KittenEngine().downloadModel()).resolves.toBeUndefined();

      const unlinkPaths = (RNFS.unlink as jest.Mock).mock.calls.map(
        (c: any[]) => c[0] as string,
      );
      // 无 sherpa 文件落盘，回滚无目标；播放链目录未被删除
      expect(unlinkPaths.some(p => p.includes('/tts/kitten'))).toBe(false);
      warnSpy.mockRestore();
    });

    it('Phase 1 失败：整目录清理并抛出（all-or-nothing，不进 Phase 2）', async () => {
      (RNFS.exists as jest.Mock).mockResolvedValue(true);
      (RNFS.downloadFile as jest.Mock)
        .mockImplementationOnce(okDownload)
        .mockImplementationOnce(failDownload);

      const errSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      await expect(new KittenEngine().downloadModel()).rejects.toThrow(
        /HTTP 500/,
      );
      // 整目录删除（原行为保留）
      expect(RNFS.unlink).toHaveBeenCalledWith(
        '/path/to/library/Application Support/tts/kitten',
      );
      // 未进入 Phase 2（树枚举未触发）
      expect(mockFetchModelFilesDetails).not.toHaveBeenCalled();
      errSpy.mockRestore();
    });

    it('进度单调 0..1 且收尾 1.0（Phase1 = 0..0.5，Phase2 = 0.5..1）', async () => {
      mockFetchModelFilesDetails.mockResolvedValue(espeakTree);
      (RNFS.downloadFile as jest.Mock).mockImplementation(okDownload);
      const progresses: number[] = [];
      await new KittenEngine().downloadModel(p => progresses.push(p));

      expect(progresses.length).toBeGreaterThan(0);
      expect(progresses[progresses.length - 1]).toBe(1);
      expect(Math.min(...progresses)).toBeGreaterThanOrEqual(0);
      expect(Math.max(...progresses)).toBeLessThanOrEqual(1);
      // Phase 1 末值不超过 0.5，Phase 2 从 0.5 之后起步
      const phase1Max = Math.max(...progresses.filter(p => p <= 0.5));
      expect(phase1Max).toBeLessThanOrEqual(0.5);
      expect(progresses.some(p => p > 0.5)).toBe(true);
    });
  });

  describe('deleteModel()', () => {
    it('unlinks the model directory when present', async () => {
      (RNFS.exists as jest.Mock).mockResolvedValue(true);
      await new KittenEngine().deleteModel();
      expect(RNFS.unlink).toHaveBeenCalledWith(
        expect.stringContaining('/tts/kitten'),
      );
    });

    it('no-ops when the directory does not exist', async () => {
      (RNFS.exists as jest.Mock).mockResolvedValue(false);
      await expect(new KittenEngine().deleteModel()).resolves.toBeUndefined();
      expect(RNFS.unlink).not.toHaveBeenCalled();
    });
  });

  describe('play()', () => {
    it('throws when the model is not installed', async () => {
      (RNFS.exists as jest.Mock).mockResolvedValue(false);
      await expect(new KittenEngine().play('hello', anyVoice)).rejects.toThrow(
        /not installed/i,
      );
    });

    it('initializes lazily with Kitten engine id and delegates to Speech.speak', async () => {
      (RNFS.exists as jest.Mock).mockResolvedValue(true);

      const engine = new KittenEngine();
      await engine.play('hello', anyVoice);

      expect(Speech.initialize).toHaveBeenCalledTimes(1);
      expect(Speech.initialize).toHaveBeenCalledWith(
        expect.objectContaining({
          engine: TTSEngine.KITTEN,
          modelPath: expect.stringMatching(/^file:\/\/.*kitten\.onnx$/),
          voicesPath: expect.stringMatching(/voices-manifest\.json$/),
          dictPath: expect.stringMatching(/en-us\.bin$/),
          executionProviders: ['cpu'],
        }),
      );
      expect(Speech.speak).toHaveBeenCalledWith('hello', anyVoice.id);

      await engine.play('again', anyVoice);
      expect(Speech.initialize).toHaveBeenCalledTimes(1);
    });
  });
});
