/**
 * Tests for ttsEngine synthesizeToFile (B38b/B38c language gate).
 * - kokoro: text must match the selected voice's language (en/en-GB/zh)
 * - kitten: en-only engine, rejects CJK explicitly
 * - supertonic passes through (31-language model)
 */
import * as RNFS from '@dr.pogodin/react-native-fs';

import {synthesizeToFile} from '../ttsEngine';

jest.mock('react-native', () => {
  const RN = jest.requireActual('react-native');
  RN.Platform.OS = 'android';
  RN.NativeModules.AudioTts = {
    isReady: jest.fn().mockResolvedValue(true),
    synthesizeToFile: jest.fn().mockResolvedValue('/out.wav'),
  };
  return RN;
});

jest.mock('@dr.pogodin/react-native-fs', () => ({
  DocumentDirectoryPath: '/data/user/0/com.pocketpalai/files',
  exists: jest.fn(),
  mkdir: jest.fn(),
}));

describe('synthesizeToFile language gate (B38b/B38c)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (RNFS.exists as jest.Mock).mockResolvedValue(true);
    (RNFS.mkdir as jest.Mock).mockResolvedValue(undefined);
  });

  it('kokoro en voice rejects Chinese text with switch guidance', async () => {
    await expect(
      synthesizeToFile('kokoro', '你好世界', 'af_heart'),
    ).rejects.toThrow('请切换中文音色');
  });

  it('kokoro en voice rejects Japanese text explicitly', async () => {
    await expect(
      synthesizeToFile('kokoro', 'こんにちは', 'af_heart'),
    ).rejects.toThrow('仅支持英文文本');
  });

  it('kokoro zh voice accepts Chinese text (B38c)', async () => {
    await expect(
      synthesizeToFile('kokoro', '你好，世界', 'zf_xiaobei'),
    ).resolves.toMatch(/tts_\d+\.wav$/);
  });

  it('kokoro zh voice rejects pure Latin text', async () => {
    await expect(
      synthesizeToFile('kokoro', 'Hello world', 'zm_yunjian'),
    ).rejects.toThrow('请配合中文文本');
  });

  it('kokoro accepts pure English text with en voice', async () => {
    await expect(
      synthesizeToFile('kokoro', 'Hello world', 'af_heart'),
    ).resolves.toMatch(/tts_\d+\.wav$/);
  });

  it('kitten rejects CJK text explicitly', async () => {
    await expect(
      synthesizeToFile('kitten', '안녕하세요', 'expr-voice-2-f'),
    ).rejects.toThrow('仅支持英文文本');
  });

  it('supertonic passes CJK through (multilingual, no gate)', async () => {
    await expect(
      synthesizeToFile('supertonic', '你好 world', 'F1'),
    ).resolves.toMatch(/tts_\d+\.wav$/);
  });
});
