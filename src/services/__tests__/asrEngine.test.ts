/**
 * asrEngine 单测：resolveAudioPath（content uri → 本地路径，文件名 sanitize）
 *
 * 背景（2026-08-21 K90 真机实证）：DocumentPicker 返回 content:// uri，
 * 路径片段斜杠被编码（primary%3ADownload%2Ftest.wav），decode 后含 '/'，
 * 直接做目标文件名会生成非法路径（ENOENT）。先 decode 再取 basename + sanitize。
 */
import {NativeModules} from 'react-native';
import {resolveAudioPath} from '../asrEngine';

jest.mock('react-native', () => {
  const AudioAsr = {
    copyContentUri: jest.fn(),
  };
  return {
    NativeModules: {AudioAsr},
    Platform: {OS: 'android'},
  };
});

describe('resolveAudioPath', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (NativeModules.AudioAsr.copyContentUri as jest.Mock).mockResolvedValue(
      true,
    );
  });

  it('file:// uri 剥离前缀返回绝对路径', async () => {
    await expect(
      resolveAudioPath('file:///sdcard/Download/a.wav'),
    ).resolves.toBe('/sdcard/Download/a.wav');
    expect(NativeModules.AudioAsr.copyContentUri).not.toHaveBeenCalled();
  });

  it('content:// uri 拷贝到缓存目录，文件名先 decode 再取 basename', async () => {
    const uri =
      'content://com.android.externalstorage.documents/document/primary%3ADownload%2Ftest_speech_16k.wav';
    const dest = await resolveAudioPath(uri);
    expect(NativeModules.AudioAsr.copyContentUri).toHaveBeenCalledWith(
      uri,
      expect.stringMatching(/\/asr_\d+_test_speech_16k\.wav$/),
    );
    expect(dest).toMatch(/\/asr_\d+_test_speech_16k\.wav$/);
  });

  it('content:// uri 无查询参数污染文件名', async () => {
    const uri =
      'content://com.android.externalstorage.documents/document/primary%3ADownload%2Fa.wav?origin=test';
    const dest = await resolveAudioPath(uri);
    expect(dest).toMatch(/\/asr_\d+_a\.wav$/);
  });

  it('content:// 拷贝失败（返回非 true）显式抛错', async () => {
    (NativeModules.AudioAsr.copyContentUri as jest.Mock).mockResolvedValue(
      false,
    );
    await expect(
      resolveAudioPath('content://provider/document/a.wav'),
    ).rejects.toThrow('拷贝音频失败');
  });

  it('绝对路径直接透传', async () => {
    await expect(resolveAudioPath('/data/cache/raw.wav')).resolves.toBe(
      '/data/cache/raw.wav',
    );
    expect(NativeModules.AudioAsr.copyContentUri).not.toHaveBeenCalled();
  });
});
