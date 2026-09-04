import React from 'react';
import {render, fireEvent} from '../../../../jest/test-utils';
import {
  PhoneCallOverlay,
  type PhoneCallOverlayProps,
} from '../PhoneCallOverlay';
import {L10nContext} from '../../../utils';
import {l10n} from '../../../locales';

const baseProps: PhoneCallOverlayProps = {
  visible: true,
  status: 'idle' as const,
  recentText: '你好',
  partnerName: '小黄鸡',
  modelLabel: '管家 MiniCPM 1B',
  engineReady: true,
  engineLoading: null,
  elapsedSeconds: 65,
  transcript: '',
  perfHistory: [],
  onStartRecording: jest.fn(),
  onStopRecording: jest.fn(),
  onHangUp: jest.fn(),
  onClose: jest.fn(),
};

const renderPhone = (props: Partial<typeof baseProps> = {}) =>
  render(
    <L10nContext.Provider value={l10n.en}>
      <PhoneCallOverlay {...baseProps} {...props} />
    </L10nContext.Provider>,
  );

describe('PhoneCallOverlay v2（PHONE_SPEC §10.2/§10.3）', () => {
  it('联系人区 + 通话时长 + 跑分迷你行 + 控制区齐备', () => {
    const {getByTestId, getByText} = renderPhone();
    expect(getByTestId('phone-overlay')).toBeTruthy();
    expect(getByTestId('phone-contact')).toBeTruthy();
    expect(getByTestId('phone-elapsed').props.children).toBe('01:05');
    expect(getByTestId('phone-perf-row')).toBeTruthy();
    expect(getByTestId('phone-hold-talk')).toBeTruthy();
    expect(getByTestId('phone-hangup')).toBeTruthy();
    expect(getByText('Listening…')).toBeTruthy();
  });

  it('引擎未就绪 → hold 禁用 + 加载进度条（§10.3 门控）', () => {
    const onStart = jest.fn();
    const {getByTestId, getByText, getAllByText} = renderPhone({
      engineReady: false,
      engineLoading: {progress: 0.42, stage: '加载模型中…'},
      onStartRecording: onStart,
    });
    expect(getByTestId('phone-engine-progress')).toBeTruthy();
    // engineLoading 文案同时出现在状态区与 hold 按钮标签（双重匹配 → getAllByText）
    expect(getAllByText('Loading voice assistant…').length).toBeGreaterThan(0);
    expect(getByText('加载模型中…')).toBeTruthy();
    const hold = getByTestId('phone-hold-talk');
    expect(hold.props.accessibilityState?.disabled ?? hold.props.disabled).toBe(
      true,
    );
    fireEvent(hold, 'pressIn');
    expect(onStart).not.toHaveBeenCalled();
  });

  it('转写中 → 识别中文案 + 转写回显（§10.3 输入反馈）', () => {
    const {getByTestId, getByText} = renderPhone({
      status: 'transcribing',
      transcript: '你好呀',
    });
    expect(getByText('Recognizing…')).toBeTruthy();
    // JSX 表达式 children = ['「', text, '」'] 数组，join 后断言
    expect(
      (getByTestId('phone-transcript').props.children as string[]).join(''),
    ).toBe('「你好呀」');
  });

  it('挂断回调转发', () => {
    const onHangUp = jest.fn();
    const {getByTestId} = renderPhone({onHangUp});
    fireEvent.press(getByTestId('phone-hangup'));
    expect(onHangUp).toHaveBeenCalledTimes(1);
  });
});
