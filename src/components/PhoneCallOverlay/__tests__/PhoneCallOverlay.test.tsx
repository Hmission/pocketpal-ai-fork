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
import {assistantId, userId} from '../../../utils/chat';
import {ttsStore, chatSessionStore} from '../../../store';
import {themeFixtures} from '../../../../jest/fixtures/theme';

const baseProps: PhoneCallOverlayProps = {
  visible: true,
  status: 'idle',
  partnerName: '小妖',
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
    // 对话流数据源用后复位（mock 是共享单例，不得泄漏到其他用例）
    (chatSessionStore as any).currentSessionMessages = [];
  });

  afterEach(() => {
    jest.clearAllMocks();
    // 测试卫生：对话流用例向共享 mock 塞了消息，必须归零——
    // 否则泄漏到同 worker 后续套件（全域 mock 是单例）。
    (chatSessionStore as any).currentSessionMessages = [];
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
    // v2.3 契约（大王：「按住说话比挂断大好多」）：两钮**等大**，
    // 语义靠颜色/图标区分，不靠尺寸做视觉等级。
    // hold 的 style 是 Pressable 回调（`({pressed}) => [...]`），需先求值再 flatten。
    const resolve = (raw: unknown) =>
      StyleSheet.flatten(
        typeof raw === 'function'
          ? (raw as (a: {pressed: boolean}) => unknown)({pressed: false})
          : raw,
      ) as {width?: number; height?: number};
    const hold = resolve(getByTestId('phone-hold-talk').props.style);
    const hang = resolve(getByTestId('phone-hangup').props.style);
    expect(hang.width).toBe(hold.width);
    expect(hang.height).toBe(hold.height);
    expect(hold.width).toBe(72);
  });

  it('对话流（§14.1）：全文铺满，未落库转写补为末条，思考态不丢（§11.4 不回退）', () => {
    // 契约：数组**新在旧前**（index 0 = 最新），故 a1（伙伴回复）在 u1 前面
    (chatSessionStore as any).currentSessionMessages = [
      {
        id: 'a1',
        type: 'assistant_turn',
        steps: [{content: '你好呀，今天想聊点什么'}, {content: '我都在'}],
      },
      {id: 'u1', type: 'text', text: '你好呀'},
    ];
    const {getByTestId, getByText} = renderPhone({
      status: 'awaiting_reply',
      transcript: '讲个笑话',
    });
    // 容器存在 + 伙伴句全文（多 step 拼接；RNTL getByText 会折叠空白，故用正则定位后断言原文）
    expect(getByTestId('phone-dialogue')).toBeTruthy();
    expect(getByText(/今天想聊点什么/).props.children).toBe(
      '你好呀，今天想聊点什么\n我都在',
    );
    expect(getByText('你好呀')).toBeTruthy();
    // 本轮未落库的转写 = 末条浅色行（不再只截 2 行、不再加「」包装）
    expect(getByTestId('phone-transcript').props.children).toBe('讲个笑话');
    expect(getByText('Thinking…')).toBeTruthy();
  });

  /**
   * 顺序契约护栏（2026-09-05 K90 真机定位）：`currentSessionMessages` 是**新在旧前**
   * （store `unshift` + DB `Q.sortBy('position', Q.desc)` + ChatView `inverted` 列表）。
   * 旧写法按「旧在新前」遍历并 `slice(-DIALOGUE_TAIL)`，取到的是**最旧 12 条**：
   * 真机表现为字幕停在开场问候语、伙伴新回复永远看不到（单测当时抓不到，
   * 因为我的 fixture 也按错序写）。此用例钉住真实方向。
   */
  it('顺序契约：尾窗取最近 N 条（数组头部），渲染为旧→新', () => {
    // e00 = 次新，下标越大越早（21 条远超尾窗 12）
    const older = Array.from({length: 20}, (_, i) => ({
      id: `e${i}`,
      type: 'text' as const,
      text: `e${String(i).padStart(2, '0')}`,
      author: {id: userId},
    }));
    (chatSessionStore as any).currentSessionMessages = [
      {
        id: 'newest',
        type: 'assistant_turn',
        steps: [{content: 'NEWEST'}],
      },
      ...older,
    ];
    const {getByText, queryByText, toJSON} = renderPhone();
    // 最新一条必须在场（旧写法会把它丢掉）
    expect(getByText('NEWEST')).toBeTruthy();
    // 超出尾窗的最旧句必须被挤出
    expect(queryByText('e19')).toBeNull();
    // 屏上顺序 = 旧→新（末行是最新）
    const tree = JSON.stringify(toJSON());
    expect(tree.indexOf('e09')).toBeLessThan(tree.indexOf('e02'));
    expect(tree.indexOf('e02')).toBeLessThan(tree.indexOf('NEWEST'));
  });

  it('对话流去重：转写已落库为末条用户句时不重复追加', () => {
    (chatSessionStore as any).currentSessionMessages = [
      {id: 'u1', type: 'text', text: '你好呀'},
    ];
    const {getAllByText, queryByTestId} = renderPhone({
      status: 'transcribing',
      transcript: '你好呀',
    });
    expect(getAllByText('你好呀')).toHaveLength(1);
    expect(queryByTestId('phone-transcript')).toBeNull();
  });

  /**
   * 自动贴底机制回归护栏（2026-09-05 K90 真机两轮发现）：
   * ① `InteractionManager.runAfterInteractions(scrollToEnd)` 在新行尚未测量就执行
   *   → 字幕完全不跟底；② 改挂 onContentSizeChange 后仍稳定少滚 6dp（=18px），
   *   因为 `scrollToEnd` 读的是未含 contentContainerStyle padding 的旧高。
   * 现由 onLayout + onContentSizeChange 喂入权威几何，算精确偏移。此用例钉住
   * 双入口存在且两条路径（内容溢出 / 未溢出）都不抛。
   */
  it('对话流自动贴底：onLayout + onContentSizeChange 算精确偏移（真机差 6dp 回归护栏）', () => {
    (chatSessionStore as any).currentSessionMessages = [
      {id: 'u1', type: 'text', text: '第一句'},
      {id: 'a1', type: 'assistant_turn', steps: [{content: '第二句'}]},
    ];
    const {getByTestId} = renderPhone({transcript: '第三句'});
    const scroller = getByTestId('phone-dialogue');
    const {onContentSizeChange, onLayout} = scroller.props as any;
    expect(typeof onContentSizeChange).toBe('function');
    expect(typeof onLayout).toBe('function');
    onLayout({nativeEvent: {layout: {x: 0, y: 0, width: 360, height: 300}}});
    // 内容高于视口 → 走精确 scrollTo（溢出部分贴底）
    expect(() => onContentSizeChange(360, 900)).not.toThrow();
    // 内容不足视口 → 不该滚（不抛即成立）
    expect(() => onContentSizeChange(360, 120)).not.toThrow();
    // 不拿「读源码文本断言不含某标识符」做护栏（注释里提到旧写法就会误伤），
    // 是否真贴底以 K90 真机复验为准。
  });

  /**
   * 真机补修护栏（2026-09-05 K90）：上一版只挡 metadata.system，导致
   * 「🎨 已识别为生图任务，管家优化提示词中…」这类任务占位卡被当成
   * 伙伴说的话铺进字幕。但 **butler 卡必须保留**：管家直答卡会被原地回写为
   * 真正回复文本，那就是伙伴说的话。
   */
  it('任务卡不入字幕，管家直答卡保留（v2.4 真机补修）', () => {
    // 本用例只验「入不入流」，与数组方向无关（方向契约见上面「顺序契约」用例）
    (chatSessionStore as any).currentSessionMessages = [
      {
        id: 't1',
        type: 'text',
        text: '🎨 已识别为生图任务，管家优化提示词中…',
        author: {id: assistantId},
        metadata: {imageTask: true},
      },
      {
        id: 't2',
        type: 'text',
        text: '⚠️ 编辑未完成：源图解码失败',
        author: {id: assistantId},
        metadata: {editTask: true, editTaskFailed: true},
      },
      {
        id: 't3',
        type: 'text',
        text: '调度失败：没有可用模型',
        author: {id: assistantId},
        metadata: {taskError: {code: 'no_model'}},
      },
      {
        id: 't4',
        type: 'text',
        text: '你好呀，我在。',
        author: {id: assistantId},
        metadata: {butler: true},
      },
    ];
    const {getByText, queryByText} = renderPhone();
    expect(queryByText(/已识别为生图任务/)).toBeNull();
    expect(queryByText(/编辑未完成/)).toBeNull();
    expect(queryByText(/调度失败/)).toBeNull();
    expect(getByText('你好呀，我在。')).toBeTruthy();
  });

  it('无活动会话（messages 为 undefined）不得抛错杀通话页', () => {
    (chatSessionStore as any).currentSessionMessages = undefined;
    const {getByTestId} = renderPhone({transcript: '还在说'});
    expect(getByTestId('phone-overlay')).toBeTruthy();
    expect(getByTestId('phone-transcript').props.children).toBe('还在说');
  });

  it('对话流归属（v2.4 自查）：系统提示不入流，author 定说/听，不假设 text 都是我说', () => {
    (chatSessionStore as any).currentSessionMessages = [
      {id: 'u1', type: 'text', text: '说点啥', author: {id: userId}},
      {
        id: 'sys1',
        type: 'text',
        text: 'Completion failed: boom',
        author: {id: assistantId},
        metadata: {system: true},
      },
      // 遗留形态：助手回复以 text 落库（非 assistant_turn）——归伙伴句
      {
        id: 'a2',
        type: 'text',
        text: ' legacy 助手句',
        author: {id: assistantId},
      },
    ];
    const {getByText, queryByText} = renderPhone();
    // 报错文本不得以「我说」字幕出现
    expect(queryByText(/Completion failed/)).toBeNull();
    // 颜色定说话人（伙伴深 / 我说浅，不用气泡）
    const partner = StyleSheet.flatten(getByText('legacy 助手句').props.style);
    const me = StyleSheet.flatten(getByText('说点啥').props.style);
    expect(partner.color).toBe(themeFixtures.lightTheme.colors.onSurface);
    expect(me.color).toBe(themeFixtures.lightTheme.colors.onSurfaceVariant);
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

  afterEach(() => {
    (chatSessionStore as any).currentSessionMessages = [];
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

  /**
   * 真机致命回归护栏（2026-09-05 K90）：本组件有 `if (!visible) return null` 早退，
   * 任何 hook 放到早退之后就会在「隐藏→打开」那一帧抛
   * `Rendered more hooks than during the previous render` → RN release 直接杀进程。
   * 单测必须走真实路径：先 visible=false 挂载，再 rerender 为 visible=true。
   */
  it('隐藏态→打开不得抛 hooks 顺序错（真机杀进程回归护栏）', () => {
    const {rerender, getByTestId} = render(
      <L10nContext.Provider value={l10n.en}>
        <PhoneCallOverlay {...baseProps} visible={false} />
      </L10nContext.Provider>,
    );
    expect(() =>
      rerender(
        <L10nContext.Provider value={l10n.en}>
          <PhoneCallOverlay {...baseProps} visible />
        </L10nContext.Provider>,
      ),
    ).not.toThrow();
    expect(getByTestId('phone-overlay')).toBeTruthy();
  });
});
