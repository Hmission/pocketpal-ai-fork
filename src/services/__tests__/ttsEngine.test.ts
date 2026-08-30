/**
 * Tests for ttsEngine synthesizeToFile (B38b language gate).
 * - kokoro/kitten reject non-Latin text explicitly (en-only voice set)
 * - supertonic passes through (31-language model)
 * - non-English engines still synthesize when text is Latin
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

describe('synthesizeToFile language gate (B38b)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (RNFS.exists as jest.Mock).mockResolvedValue(true);
    (RNFS.mkdir as jest.Mock).mockResolvedValue(undefined);
  });

  it('kokoro rejects Chinese text explicitly', async () => {
    await expect(
      synthesizeToFile('kokoro', '你好世界', 'af_heart'),
    ).rejects.toThrow('仅支持英文文本');
  });

  it('kokoro rejects Japanese text explicitly', async () => {
    await expect(
      synthesizeToFile('kokoro', 'こんにちは', 'af_heart'),
    ).rejects.toThrow('仅支持英文文本');
  });

  it('kitten rejects CJK text explicitly', async () => {
    await expect(
      synthesizeToFile('kitten', '안녕하세요', 'expr-voice-2-f'),
    ).rejects.toThrow('仅支持英文文本');
  });

  it('kokoro accepts pure English text', async () => {
    await expect(
      synthesizeToFile('kokoro', 'Hello world', 'af_heart'),
    ).resolves.toMatch(/tts_\d+\.wav$/);
  });

  it('supertonic passes CJK through (multilingual, no gate)', async () => {
    await expect(
      synthesizeToFile('supertonic', '你好 world', 'F1'),
    ).resolves.toMatch(/tts_\d+\.wav$/);
  });
});
