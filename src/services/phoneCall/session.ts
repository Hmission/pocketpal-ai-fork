/**
 * phoneCall/session — 电话模式会话编排（PHONE_SPEC §4，纯 TS 可单测）。
 *
 * 状态机：idle → recording → transcribing → awaiting_reply → speaking → idle
 * 依赖五件套注入（record/transcribe/send/stopInference/speakStop），不 import
 * 任何 RN UI —— 单测全部用桩注入。状态变更经 notify 发布，UI 层订阅渲染。
 *
 * 语音优先：speaking 中按住说话 → 先停播报再进录音；awaiting_reply 中按住
 * → 注入的 stopInference（handleStopPress）打断推理再进录音。
 */
export type PhoneCallStatus =
  | 'idle'
  | 'recording'
  | 'transcribing'
  | 'awaiting_reply'
  | 'speaking';

/** 错误码 → UI 层映射 l10n 文案（PHONE_SPEC §6 失败路径表） */
export type PhoneCallErrorCode =
  | 'PERMISSION_DENIED'
  | 'EMPTY_SPEECH'
  | 'TRANSCRIBE_FAILED'
  | 'SEND_FAILED';

export interface PhoneCallDeps {
  record: {
    start(): Promise<string>;
    stop(): Promise<string | null>;
  };
  transcribe(audioPath: string): Promise<string | null>;
  /** 提交文本走聊天调度链路（wrappedSendPress，带 phoneMode 标记） */
  send(text: string): Promise<void>;
  /** 打断进行中的推理（handleStopPress）；未注入则 awaiting_reply 期间禁录 */
  stopInference?: () => Promise<void>;
  /** 中止当前 TTS 播报（ttsStore.stop） */
  speakStop(): Promise<void>;
  /** 状态发布（UI 订阅刷新） */
  notify(status: PhoneCallStatus): void;
  /** 错误提示（UI 展示对应 l10n） */
  onError(code: PhoneCallErrorCode): void;
}

export class PhoneCallSession {
  private status: PhoneCallStatus = 'idle';
  private deps: PhoneCallDeps;
  /** 挂断标记：转写在途时作废结果（stopAndSend 转写完成后检查，不发送） */
  private closing = false;

  constructor(deps: PhoneCallDeps) {
    this.deps = deps;
  }

  getStatus(): PhoneCallStatus {
    return this.status;
  }

  /** 通话中（非 idle 即通话进行中） */
  isActive(): boolean {
    return this.status !== 'idle';
  }

  /** 录音中（UI 按住态） */
  isRecording(): boolean {
    return this.status === 'recording';
  }

  private setStatus(next: PhoneCallStatus): void {
    if (this.status === next) {
      return;
    }
    this.status = next;
    this.deps.notify(next);
  }

  /**
   * 开始录音（语音优先）：speaking/awaiting_reply 中按住 = 打断当前环节。
   * idle 直接进录音；已在录音 = 幂等忽略。
   */
  async startRecording(): Promise<void> {
    if (this.status === 'recording' || this.status === 'transcribing') {
      return;
    }
    // 新一轮说话 = 会话恢复（清挂断标记）
    this.closing = false;
    if (this.status === 'speaking') {
      await this.deps.speakStop();
    } else if (this.status === 'awaiting_reply') {
      await this.deps.stopInference?.();
    }
    try {
      await this.deps.record.start();
    } catch (e) {
      // 权限拒绝/录音初始化失败 → 回聆听态 + 显式提示（不悬挂、不假录音）
      console.warn('[PhoneCall] startRecording failed:', e);
      this.setStatus('idle');
      this.deps.onError('PERMISSION_DENIED');
      return;
    }
    this.setStatus('recording');
  }

  /**
   * 停止录音并走完整流水线（PHONE_SPEC §4.2）：
   * stop → transcribe → 空文本回 idle（EMPTY_SPEECH）→ 非空 send → awaiting_reply。
   * 任一环节失败：回 idle + onError，不悬挂。
   */
  async stopAndSend(): Promise<void> {
    if (this.status !== 'recording') {
      return;
    }
    this.setStatus('transcribing');
    try {
      const path = await this.deps.record.stop();
      if (!path) {
        this.setStatus('idle');
        this.deps.onError('TRANSCRIBE_FAILED');
        return;
      }
      const text = await this.deps.transcribe(path);
      // 转写期间挂断（hangUp 已置 closing）：丢弃结果，不发送（#11 行为契约）
      if (this.closing) {
        return;
      }
      if (!text || !text.trim()) {
        // 空文本：没有听到有效语音，回到聆听态（不发送，不落库）
        this.setStatus('idle');
        this.deps.onError('EMPTY_SPEECH');
        return;
      }
      await this.deps.send(text.trim());
      this.setStatus('awaiting_reply');
    } catch (e) {
      console.warn('[PhoneCall] stopAndSend failed:', e);
      this.setStatus('idle');
      this.deps.onError('TRANSCRIBE_FAILED');
    }
  }

  /** 回复首个内容 token 到达（useChatSession 生命周期回调驱动） */
  notifyReplyStarted(): void {
    if (this.status === 'awaiting_reply') {
      this.setStatus('speaking');
    }
  }

  /** 回复回合收尾（完成/失败/被打断，useChatSession 生命周期回调驱动） */
  notifyReplyFinished(): void {
    if (this.status === 'speaking' || this.status === 'awaiting_reply') {
      this.setStatus('idle');
    }
  }

  /** 挂断：停播 + 打断推理 + 归 idle（已落库消息保留；在途转写结果作废） */
  async hangUp(): Promise<void> {
    this.closing = true;
    if (this.status === 'recording') {
      // 录音中挂断：先停录（麦克风归还），丢弃本次录音
      await this.deps.record.stop();
    }
    if (this.status === 'transcribing') {
      // 转写中挂断：不打断转写也不发送（结果作废，回 idle）
      this.setStatus('idle');
      return;
    }
    if (this.status === 'speaking') {
      await this.deps.speakStop();
    }
    if (this.status === 'awaiting_reply') {
      await this.deps.stopInference?.();
    }
    this.setStatus('idle');
  }
}
