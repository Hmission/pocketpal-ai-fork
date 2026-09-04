import {PhoneCallSession, PhoneCallStatus} from '../session';

/**
 * PhoneCallSession 流水线单测（PHONE_SPEC §4.2）。
 * 依赖五件套全桩注入：验证状态机流转、语音优先打断、失败路径收口。
 */

const makeDeps = (
  overrides: Partial<{
    recordStart: jest.Mock;
    recordStop: jest.Mock;
    transcribe: jest.Mock;
    send: jest.Mock;
    stopInference: jest.Mock;
    speakStop: jest.Mock;
  }> = {},
) => {
  const recordStart =
    overrides.recordStart ?? jest.fn().mockResolvedValue('/tmp/a.wav');
  const recordStop =
    overrides.recordStop ?? jest.fn().mockResolvedValue('/tmp/a.wav');
  const transcribe =
    overrides.transcribe ?? jest.fn().mockResolvedValue('你好');
  const send = overrides.send ?? jest.fn().mockResolvedValue(undefined);
  const stopInference =
    overrides.stopInference ?? jest.fn().mockResolvedValue(undefined);
  const speakStop =
    overrides.speakStop ?? jest.fn().mockResolvedValue(undefined);
  const notify = jest.fn();
  const onError = jest.fn();
  const statuses: PhoneCallStatus[] = [];
  notify.mockImplementation((s: PhoneCallStatus) => statuses.push(s));
  const session = new PhoneCallSession({
    record: {start: recordStart, stop: recordStop},
    transcribe,
    send,
    stopInference,
    speakStop,
    notify,
    onError,
  });
  return {
    session,
    recordStart,
    recordStop,
    transcribe,
    send,
    stopInference,
    speakStop,
    notify,
    onError,
    statuses,
  };
};

describe('PhoneCallSession', () => {
  it('#1 完整闭环：录音 → 转写 → 发送 → 等回复 → 播报 → 聆听（状态机全链路）', async () => {
    const {session, transcribe, send, statuses} = makeDeps();

    expect(session.getStatus()).toBe('idle');
    expect(session.isActive()).toBe(false);

    await session.startRecording();
    expect(session.getStatus()).toBe('recording');
    expect(session.isRecording()).toBe(true);
    expect(session.isActive()).toBe(true);

    await session.stopAndSend();
    expect(transcribe).toHaveBeenCalledWith('/tmp/a.wav');
    expect(send).toHaveBeenCalledWith('你好');
    expect(session.getStatus()).toBe('awaiting_reply');

    session.notifyReplyStarted();
    expect(session.getStatus()).toBe('speaking');

    session.notifyReplyFinished();
    expect(session.getStatus()).toBe('idle');

    expect(statuses).toEqual([
      'recording',
      'transcribing',
      'awaiting_reply',
      'speaking',
      'idle',
    ]);
  });

  it('#2 空文本 → 不发送不落库，回聆听态 + EMPTY_SPEECH', async () => {
    const {session, recordStart, transcribe, send, onError, speakStop} =
      makeDeps({
        transcribe: jest.fn().mockResolvedValue(''),
      });

    await session.startRecording();
    expect(recordStart).toHaveBeenCalled();
    await session.stopAndSend();

    expect(transcribe).toHaveBeenCalled();
    expect(send).not.toHaveBeenCalled();
    expect(session.getStatus()).toBe('idle');
    expect(onError).toHaveBeenCalledWith('EMPTY_SPEECH');
    expect(speakStop).not.toHaveBeenCalled();
  });

  it('#3 转写抛错 → 回聆听态 + TRANSCRIBE_FAILED（不悬挂）', async () => {
    const {session, send, onError} = makeDeps({
      transcribe: jest.fn().mockRejectedValue(new Error('asr down')),
    });

    await session.startRecording();
    await session.stopAndSend();

    expect(send).not.toHaveBeenCalled();
    expect(session.getStatus()).toBe('idle');
    expect(onError).toHaveBeenCalledWith('TRANSCRIBE_FAILED');
  });

  it('#4 录音无输出路径 → TRANSCRIBE_FAILED', async () => {
    const {session, send, onError} = makeDeps({
      recordStop: jest.fn().mockResolvedValue(null),
    });

    await session.startRecording();
    await session.stopAndSend();

    expect(send).not.toHaveBeenCalled();
    expect(session.getStatus()).toBe('idle');
    expect(onError).toHaveBeenCalledWith('TRANSCRIBE_FAILED');
  });

  it('#5 录音权限拒绝（start 抛错）→ 回聆听态 + PERMISSION_DENIED，不假录音', async () => {
    const {session, recordStart, notify, onError} = makeDeps({
      recordStart: jest
        .fn()
        .mockRejectedValue(new Error('RECORD_AUDIO denied')),
    });

    await session.startRecording();

    expect(recordStart).toHaveBeenCalled();
    expect(session.getStatus()).toBe('idle');
    expect(session.isRecording()).toBe(false);
    expect(onError).toHaveBeenCalledWith('PERMISSION_DENIED');
    // 未进入 recording 态（无假录音）
    expect(notify).not.toHaveBeenCalledWith('recording');
  });

  it('#6 播报中按住说话 → 先停播再进录音（说话优先）', async () => {
    const {session, speakStop, recordStart} = makeDeps();

    await session.startRecording();
    await session.stopAndSend();
    session.notifyReplyStarted();
    expect(session.getStatus()).toBe('speaking');

    await session.startRecording();

    expect(speakStop).toHaveBeenCalledTimes(1);
    expect(recordStart).toHaveBeenCalledTimes(2);
    expect(session.getStatus()).toBe('recording');
  });

  it('#7 等待回复中按住说话 → 打断推理再进录音（stopInference）', async () => {
    const {session, stopInference, recordStart} = makeDeps();

    await session.startRecording();
    await session.stopAndSend();
    expect(session.getStatus()).toBe('awaiting_reply');

    await session.startRecording();

    expect(stopInference).toHaveBeenCalledTimes(1);
    expect(recordStart).toHaveBeenCalledTimes(2);
    expect(session.getStatus()).toBe('recording');
  });

  it('#8 录音中重复 startRecording → 幂等忽略', async () => {
    const {session, recordStart} = makeDeps();

    await session.startRecording();
    await session.startRecording();

    expect(recordStart).toHaveBeenCalledTimes(1);
    expect(session.getStatus()).toBe('recording');
  });

  it('#9 挂断（播报中）→ 停播 + 归 idle；已落库消息不受影响（无删除调用）', async () => {
    const {session, speakStop} = makeDeps();

    await session.startRecording();
    await session.stopAndSend();
    session.notifyReplyStarted();
    await session.hangUp();

    expect(speakStop).toHaveBeenCalled();
    expect(session.getStatus()).toBe('idle');
    expect(session.isActive()).toBe(false);
  });

  it('#10 挂断（等待回复中）→ 打断推理 + 归 idle', async () => {
    const {session, stopInference} = makeDeps();

    await session.startRecording();
    await session.stopAndSend();
    await session.hangUp();

    expect(stopInference).toHaveBeenCalled();
    expect(session.getStatus()).toBe('idle');
  });

  it('#11 挂断（转写中）→ 不打断转写不发发送，直接收口 idle', async () => {
    let resolveTranscribe: (v: string | null) => void = () => {};
    const transcribe = jest.fn().mockImplementation(
      () =>
        new Promise<string | null>(resolve => {
          resolveTranscribe = resolve;
        }),
    );
    const {session, send} = makeDeps({transcribe});

    await session.startRecording();
    const stopPromise = session.stopAndSend();
    // 转写挂起中挂断
    await session.hangUp();
    expect(session.getStatus()).toBe('idle');
    // 挂断后转写完成也不发送
    resolveTranscribe('迟到的话');
    await stopPromise;
    expect(send).not.toHaveBeenCalled();
  });

  it('#12 非录音态 stopAndSend → 幂等忽略（不触发任何依赖）', async () => {
    const {session, recordStop, transcribe, send} = makeDeps();

    await session.stopAndSend();

    expect(recordStop).not.toHaveBeenCalled();
    expect(transcribe).not.toHaveBeenCalled();
    expect(send).not.toHaveBeenCalled();
  });

  it('#13 录音中挂断 → 停录（麦克风归还）+ 归 idle，录音结果作废', async () => {
    const {session, recordStop, transcribe, send} = makeDeps();

    await session.startRecording();
    await session.hangUp();

    expect(recordStop).toHaveBeenCalledTimes(1);
    expect(transcribe).not.toHaveBeenCalled();
    expect(send).not.toHaveBeenCalled();
    expect(session.getStatus()).toBe('idle');
  });
});
