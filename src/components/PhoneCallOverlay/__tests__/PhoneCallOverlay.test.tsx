import React from 'react';
import {StyleSheet, type StyleProp, type ViewStyle} from 'react-native';
import {runInAction} from 'mobx';
import {render, fireEvent} from '../../../../jest/test-utils';
import {
  PhoneCallOverlay,
  WAVE_BAR_RANGE,
  type PhoneCallOverlayProps,
} from '../PhoneCallOverlay';
import {L10nContext} from '../../../utils';
import {l10n} from '../../../locales';
import {ttsStore} from '../../../store';

const baseProps: PhoneCallOverlayProps = {
  visible: true,
  status: 'idle',
  recentText: '你好呀',
  partnerName: '小黄鸡',
  modelLabel: 'MiniCPM 1B',
  engineReady: true,
  engineLoading: null,
  elapsedSeconds: 65,
  transcript: '',
  perfHistory: [],
  onStartRecording: jest.fn(),
  onStopRecording: jest.fn(),
  onHangUp: jest.fn(),
};

const renderPhone = (props: Partial<PhoneCallOverlayProps> = {}) =>
  render(
    <L10nContext.Provider value={l10n.en}>
      <PhoneCallOverlay {...baseProps} {...props} />
    </L10nContext.Provider>,
  );

/**
 * PhoneCallOverlay v2.1 用例（PHONE_SPEC §11）。
 *
 * 三条回归护栏：①控制区横向（大王报「为什么是上下放置」）②转写轮次级常驻
 * （大王报「没显示我说过的话」）③播报通路显式化（大王报「听不到语音输出」）。
 * 断言文案一律用 en 基准（l10n.en 为类型/文案源）。
 */
describe('PhoneCallOverlay v2.1（PHONE_SPEC §11）', () => {
  beforeEach(() => {
    // 播报通路默认「就绪」态（mock store 的 isTTSAvailable 由 deviceMeetsMemory 派生）
    runInAction(() => {
      (ttsStore as any).deviceMeetsMemory = true;
      (ttsStore as any).currentVoice = {id: 'v1', engine: 'system'};
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('联系人区 / 状态区 / 对话区 / 控制区齐备，右上重复关闭钮已删', () => {
    const {getByTestId, queryByTestId, getByText} = renderPhone();
    expect(getByTestId('phone-overlay')).toBeTruthy();
    expect(getByTestId('phone-contact')).toBeTruthy();
    expect(getByTestId('phone-avatar')).toBeTruthy();
    expect(getByTestId('phone-elapsed').props.children).toBe('01:05');
    expect(getByTestId('phone-perf-row')).toBeTruthy();
    expect(getByTestId('phone-hold-talk')).toBeTruthy();
    expect(getByTestId('phone-hangup')).toBeTruthy();
    // v2.1：✕ 与挂断同函数 = 重复入口，已删
    expect(queryByTestId('phone-close')).toBeNull();
    // 六态文案体系：就绪未开口 → readyToTalk + 副提示
    expect(getByText('Ready to talk')).toBeTruthy();
    expect(
      getByText("Hold the button below, release when you're done"),
    ).toBeTruthy();
  });

  it('控制区横向 + 两钮分居两侧（大王报障：上下放置、离太近会误触）', () => {
    const {getByTestId, toJSON} = renderPhone();
    const flattened = StyleSheet.flatten(
      getByTestId('phone-controls').props.style,
    );
    expect(flattened.flexDirection).toBe('row');
    // 防误触：space-between 分居两侧（不是紧靠居中）
    expect(flattened.justifyContent).toBe('space-between');
    expect(flattened.gap).toBeUndefined();
    // 位置定案：挂断在左、按住说话在右（文档序 hangup 先于 hold-talk）
    const tree = JSON.stringify(toJSON());
    expect(tree.indexOf('phone-hangup')).toBeLessThan(
      tree.indexOf('phone-hold-talk'),
    );
  });

  it('转写文本轮次级常驻：思考态仍显示「我说」（大王报障：不显示说过的话）', () => {
    const {getByTestId, getByText} = renderPhone({
      status: 'awaiting_reply',
      transcript: '你好呀',
      recentText: '你好呀，今天想聊点什么',
    });
    expect(getByTestId('phone-transcript').props.children).toBe('「你好呀」');
    expect(getByText('Thinking…')).toBeTruthy();
    // 「它说」= 与「我说」不同文时才出现（回复未落流不重复显示）
    expect(getByText('你好呀，今天想聊点什么')).toBeTruthy();
  });

  it('引擎未就绪 → hold 禁用 + 加载进度条（§10.3 门控）', () => {
    const onStart = jest.fn();
    const {getByTestId, getAllByText, getByText} = renderPhone({
      engineReady: false,
      engineLoading: {progress: 0.42, stage: '加载模型中…'},
      onStartRecording: onStart,
    });
    expect(getByTestId('phone-engine-progress')).toBeTruthy();
    expect(getAllByText('Loading voice assistant…').length).toBeGreaterThan(0);
    expect(getByText('加载模型中…')).toBeTruthy();
    const hold = getByTestId('phone-hold-talk');
    expect(hold.props.accessibilityState?.disabled ?? hold.props.disabled).toBe(
      true,
    );
    fireEvent(hold, 'pressIn');
    expect(onStart).not.toHaveBeenCalled();
  });

  it('录音态：主文案切「松开发送」+ 副提示「正在听你说…」', () => {
    const {getAllByText, getByText} = renderPhone({status: 'recording'});
    // 主状态行与 hold 钮 caption 同为「松开发送」（两处同语义）
    expect(getAllByText('Release to send').length).toBeGreaterThan(0);
    expect(getByText("I'm listening…")).toBeTruthy();
  });

  it('播报未就绪（未选语音）→ 提示行可点拉起 TTSSetupSheet（不静默失败）', () => {
    runInAction(() => {
      (ttsStore as any).currentVoice = null;
    });
    const {getByText} = renderPhone();
    fireEvent.press(getByText('No voice chosen yet, tap to choose'));
    expect(ttsStore.openSetupSheet).toHaveBeenCalledTimes(1);
  });

  it('播报就绪 → 提示行显示就绪态且不触发设置页', () => {
    const {getByText, getByTestId} = renderPhone();
    expect(getByText('Voice output ready')).toBeTruthy();
    fireEvent.press(getByTestId('phone-tts-status'));
    expect(ttsStore.openSetupSheet).not.toHaveBeenCalled();
  });

  it('挂断回调转发（唯一退出入口）', () => {
    const onHangUp = jest.fn();
    const {getByTestId} = renderPhone({onHangUp});
    fireEvent.press(getByTestId('phone-hangup'));
    expect(onHangUp).toHaveBeenCalledTimes(1);
  });
});

/** Animated 插值对象的 outputRange 提取（字段名跨 RN 版本兼容）。 */
function outputRangeOf(height: unknown): number[] {
  const h = height as {
    _animationConfig?: {outputRange?: number[]};
    _config?: {outputRange?: number[]};
  };
  return h?._animationConfig?.outputRange ?? h?._config?.outputRange ?? [];
}

/**
 * v2.2 波形语义契约（PHONE_SPEC §11.5）——回答大王「为什么一直是波浪线」：
 * 那不是声波，是思考中三点跳动；空闲/聆听原本没有任何波形。
 * 红线：无真实数据源不得做假波形跳动（振幅未接原生通道，P1 待办）。
 */
describe('PhoneCallOverlay v2.2 波形语义（§11.5）', () => {
  beforeEach(() => {
    runInAction(() => {
      (ttsStore as any).deviceMeetsMemory = true;
      (ttsStore as any).currentVoice = {id: 'v1', engine: 'system'};
    });
  });

  it('常量契约：三根柱、中柱最高、下限不重叠（防后人改坏）', () => {
    expect(WAVE_BAR_RANGE).toHaveLength(3);
    expect(WAVE_BAR_RANGE[1][1]).toBeGreaterThan(WAVE_BAR_RANGE[0][1]);
    for (const [min, max] of WAVE_BAR_RANGE) {
      expect(max).toBeGreaterThan(min);
    }
  });

  it('录音态：状态行为三根呼吸声波柱，高度按区间插值', () => {
    const {getByTestId, queryByTestId} = renderPhone({status: 'recording'});
    const bars = getByTestId('phone-wave').children;
    expect(bars).toHaveLength(3);
    bars.forEach((bar, i) => {
      const style = StyleSheet.flatten(
        (
          bar as unknown as React.ReactElement<{
            style?: StyleProp<ViewStyle>;
          }>
        ).props.style ?? {},
      ) as {height?: unknown};
      expect(outputRangeOf(style.height)).toEqual([
        WAVE_BAR_RANGE[i][0],
        WAVE_BAR_RANGE[i][1],
      ]);
    });
    // 录音期不应再画静态柱
    expect(queryByTestId('phone-ambient')).toBeNull();
  });

  it('空闲聆听：静态三柱（phone-ambient），无呼吸柱', () => {
    const {getByTestId, queryByTestId} = renderPhone({status: 'idle'});
    expect(getByTestId('phone-ambient')).toBeTruthy();
    expect(queryByTestId('phone-wave')).toBeNull();
  });

  it('思考中：保留三点跳动（真实推进信号），不是声波', () => {
    const {queryByTestId} = renderPhone({status: 'awaiting_reply'});
    expect(queryByTestId('phone-wave')).toBeNull();
    expect(queryByTestId('phone-ambient')).toBeNull();
  });

  it('播报中：主色呼吸柱（与录音同一体系）', () => {
    const {getByTestId} = renderPhone({status: 'speaking'});
    expect(getByTestId('phone-wave').children).toHaveLength(3);
  });
});
