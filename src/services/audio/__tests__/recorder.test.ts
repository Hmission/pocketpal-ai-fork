/**
 * audioRecorder 单测（W2b）：钉住「同一时刻独占 + 失败分类 + 锁必释放」三件事。
 * 其中第 2、5 例是本次改造的**动机**：旧写法（原生遇忙返回旧路径 / 三处各自直调）
 * 下，第二个调用者会静默接管别人的录音，松手停掉对方——这两例在旧代码上必红。
 */
import {NativeModules, PermissionsAndroid} from 'react-native';

import {
  audioRecorder,
  currentRecorderOwner,
  _resetForTests,
  RecorderError,
} from '../recorder';

jest.mock('react-native', () => ({
  NativeModules: {
    AudioRecord: {
      startRecording: jest.fn(),
      stopRecording: jest.fn(),
    },
  },
  PermissionsAndroid: {
    PERMISSIONS: {RECORD_AUDIO: 'android.permission.RECORD_AUDIO'},
    RESULTS: {GRANTED: 'granted', DENIED: 'denied'},
    request: jest.fn(),
  },
  Platform: {OS: 'android'},
}));

const native = NativeModules.AudioRecord as unknown as {
  startRecording: jest.Mock;
  stopRecording: jest.Mock;
};
const perm = PermissionsAndroid.request as unknown as jest.Mock;

const grabError = async (p: Promise<unknown>): Promise<RecorderError> => {
  try {
    await p;
  } catch (e) {
    return e as RecorderError;
  }
  throw new Error('expected rejection');
};

describe('audioRecorder', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    _resetForTests();
    perm.mockResolvedValue('granted');
    native.startRecording.mockResolvedValue('/cache/record_a.wav');
    native.stopRecording.mockResolvedValue('/cache/record_a.wav');
  });

  it('start 成功：申请权限 → 打原生一次 → 登记持有者', async () => {
    const path = await audioRecorder.start('chat_input');

    expect(path).toBe('/cache/record_a.wav');
    expect(perm).toHaveBeenCalledTimes(1);
    expect(native.startRecording).toHaveBeenCalledTimes(1);
    expect(currentRecorderOwner()).toBe('chat_input');
  });

  it('已在录时第二个入口 start → busy 错且不再打原生（旧行为：静默共享同一次录音）', async () => {
    await audioRecorder.start('audio_workshop');
    native.startRecording.mockClear();

    const err = await grabError(audioRecorder.start('phone_call'));

    expect(err.code).toBe('busy');
    expect(native.startRecording).not.toHaveBeenCalled();
    // 持有者不变：失败的第二人不抢锁
    expect(currentRecorderOwner()).toBe('audio_workshop');
  });

  it('权限被拒 → permission 错，原生 startRecording 一次都不打，且不占锁', async () => {
    perm.mockResolvedValue('denied');

    const err = await grabError(audioRecorder.start('chat_input'));

    expect(err.code).toBe('permission');
    expect(native.startRecording).not.toHaveBeenCalled();
    expect(currentRecorderOwner()).toBeNull();
  });

  it('持有者 stop → 返回路径并释放锁，之后可再次 start', async () => {
    await audioRecorder.start('phone_call');
    const path = await audioRecorder.stop('phone_call');

    expect(path).toBe('/cache/record_a.wav');
    expect(native.stopRecording).toHaveBeenCalledTimes(1);
    expect(currentRecorderOwner()).toBeNull();

    await expect(audioRecorder.start('chat_input')).resolves.toBeTruthy();
  });

  it('非持有者 stop → busy 错且不打原生（不会停掉别人的录音）', async () => {
    await audioRecorder.start('audio_workshop');

    const err = await grabError(audioRecorder.stop('chat_input'));

    expect(err.code).toBe('busy');
    expect(native.stopRecording).not.toHaveBeenCalled();
    expect(currentRecorderOwner()).toBe('audio_workshop');
  });

  it('未持有者 stop → no-op 返回 null，不打原生（避免停掉无关会话）', async () => {
    await expect(audioRecorder.stop('chat_input')).resolves.toBeNull();
    expect(native.stopRecording).not.toHaveBeenCalled();
  });

  it('原生 start 抛错 → native 错，不留脏锁', async () => {
    native.startRecording.mockRejectedValue(
      new Error('AUDIO_RECORD_INIT_FAIL'),
    );

    const err = await grabError(audioRecorder.start('chat_input'));

    expect(err.code).toBe('native');
    expect(currentRecorderOwner()).toBeNull();
  });

  it('原生 stop 抛错 → 仍释放锁（锁不释放会把麦克风永久焊死）', async () => {
    await audioRecorder.start('chat_input');
    native.stopRecording.mockRejectedValue(new Error('boom'));

    const err = await grabError(audioRecorder.stop('chat_input'));

    expect(err.code).toBe('native');
    expect(currentRecorderOwner()).toBeNull();
  });

  it('缺原生模块（iOS / 未注册）→ native 错，不抛 TypeError', async () => {
    const original = NativeModules.AudioRecord;
    (NativeModules as unknown as Record<string, unknown>).AudioRecord =
      undefined;

    const err = await grabError(audioRecorder.start('chat_input'));

    expect(err.code).toBe('native');
    (NativeModules as unknown as Record<string, unknown>).AudioRecord =
      original;
  });
});
