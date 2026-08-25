import React from 'react';
import {runInAction} from 'mobx';
import {NavigationContext} from '@react-navigation/native';

import {render, fireEvent} from '../../../../jest/test-utils';

import {chatSessionStore} from '../../../store';
import {ROUTES} from '../../../utils/navigationConstants';

import {AssistantTurnFooter} from '../AssistantTurnFooter';

jest.mock('@react-native-clipboard/clipboard', () => ({
  setString: jest.fn(),
}));

const baseTurn = (overrides: Partial<any> = {}): any => ({
  author: {id: 'assistant'},
  createdAt: 0,
  id: 'turn-1',
  type: 'assistant_turn',
  steps: [{content: 'Hello'}],
  metadata: {},
  ...overrides,
});

describe('AssistantTurnFooter', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders nothing when no content, no timings, no interrupted (空内容无 chrome)', () => {
    // 新契约：复制门控 = 内容非空且完成；空 steps 且无其他 chrome → 不渲染
    const message = baseTurn({metadata: {}, steps: []});
    const {queryByTestId} = render(<AssistantTurnFooter message={message} />);
    expect(queryByTestId('assistant-turn-footer')).toBeNull();
  });

  it('renders timing line when timings present (复制按钮同显：内容有内容即完成态)', () => {
    const message = baseTurn({
      metadata: {
        timings: {predicted_per_token_ms: 10, predicted_per_second: 100},
      },
    });
    const {getByText, queryByTestId} = render(
      <AssistantTurnFooter message={message} />,
    );
    expect(queryByTestId('assistant-turn-footer')).toBeTruthy();
    // §18.2：分段渲染（分隔符 `·`），逐段断言
    expect(getByText('10ms/token')).toBeTruthy();
    expect(getByText('100.00 tokens/sec')).toBeTruthy();
    // 新契约：内容非空且完成 → 复制按钮显示（不再依赖 metadata.copyable）
    expect(queryByTestId('footer-copy')).toBeTruthy();
  });

  it('renders copy button when copyable, even if timings absent (abort path)', () => {
    const message = baseTurn({
      metadata: {copyable: true, interrupted: true},
    });
    const {queryByTestId} = render(<AssistantTurnFooter message={message} />);
    expect(queryByTestId('assistant-turn-footer')).toBeTruthy();
    expect(queryByTestId('footer-copy')).toBeTruthy();
    expect(queryByTestId('footer-metrics')).toBeNull();
  });

  it('renders both timing and copy when both fields present', () => {
    const message = baseTurn({
      metadata: {
        copyable: true,
        timings: {predicted_per_token_ms: 32, predicted_per_second: 30},
      },
    });
    const {getByText, queryByTestId} = render(
      <AssistantTurnFooter message={message} />,
    );
    expect(getByText('32ms/token')).toBeTruthy();
    expect(getByText('30.00 tokens/sec')).toBeTruthy();
    expect(queryByTestId('footer-copy')).toBeTruthy();
  });

  it('copy button copies derived text via Clipboard.setString', () => {
    const message = baseTurn({
      steps: [{content: 'Sure, here it is.'}, {content: 'Hope this helps.'}],
      metadata: {
        copyable: true,
        timings: {predicted_per_second: 50},
      },
    });
    const {getByTestId} = render(<AssistantTurnFooter message={message} />);
    fireEvent.press(getByTestId('footer-copy'));
    expect(
      require('@react-native-clipboard/clipboard').setString,
    ).toHaveBeenCalledWith('Sure, here it is.\n\nHope this helps.');
  });

  it('does not render copy button for unsupported message types (非文本类型无复制钮)', () => {
    // 新契约：非 text/assistant_turn 类型 derivedText 为空 → 复制按钮不渲染
    const message = {
      author: {id: 'assistant'},
      createdAt: 0,
      id: 'img-1',
      type: 'image' as const,
      uri: 'file://foo.png',
      width: 10,
      height: 10,
      size: 100,
      name: 'foo.png',
      metadata: {copyable: true},
    } as any;
    const {queryByTestId} = render(<AssistantTurnFooter message={message} />);
    expect(queryByTestId('footer-copy')).toBeNull();
    expect(
      require('@react-native-clipboard/clipboard').setString,
    ).not.toHaveBeenCalled();
  });

  it('renders TTFT-only timing string when only ttft is present', () => {
    const message = baseTurn({
      metadata: {
        timings: {time_to_first_token_ms: 150},
      },
    });
    const {getByText} = render(<AssistantTurnFooter message={message} />);
    expect(getByText('150ms TTFT')).toBeTruthy();
  });

  it('does not render the timing Text when timings are empty (no parts to show)', () => {
    const message = baseTurn({
      metadata: {
        copyable: true,
        timings: {},
      },
    });
    const {queryByTestId} = render(<AssistantTurnFooter message={message} />);
    expect(queryByTestId('footer-metrics')).toBeNull();
    expect(queryByTestId('footer-copy')).toBeTruthy();
  });

  it('renders "Interrupted" status when metadata.interrupted is set', () => {
    const message = baseTurn({
      metadata: {copyable: true, interrupted: true},
    });
    const {getByTestId, getByText} = render(
      <AssistantTurnFooter message={message} />,
    );
    expect(getByTestId('footer-interrupted-status')).toBeTruthy();
    expect(getByText('Interrupted')).toBeTruthy();
  });

  it('upgrades the status to "Cut off — likely context full" when truncationLikely is set', () => {
    const message = baseTurn({
      metadata: {copyable: true, interrupted: true, truncationLikely: true},
    });
    const {getByTestId, getByText} = render(
      <AssistantTurnFooter message={message} />,
    );
    expect(getByTestId('footer-interrupted-status')).toBeTruthy();
    expect(getByText('Cut off — likely context full')).toBeTruthy();
  });

  it('renders the footer for interrupted-only turns (新契约：有内容即显复制)', () => {
    // 新契约：复制门控不再依赖 metadata.copyable——有内容且完成即显示；
    // interrupted 状态同时展示。
    const message = baseTurn({metadata: {interrupted: true}});
    const {queryByTestId} = render(<AssistantTurnFooter message={message} />);
    expect(queryByTestId('assistant-turn-footer')).toBeTruthy();
    expect(queryByTestId('footer-interrupted-status')).toBeTruthy();
    expect(queryByTestId('footer-copy')).toBeTruthy();
    expect(queryByTestId('footer-metrics')).toBeNull();
  });

  it('流式中的 partial 消息不渲染复制/重新生成按钮（actionsReady 门控）', () => {
    // 未完成（partial step）且流式中：按钮隐藏，避免复制半截内容
    const {modelStore} = require('../../../store');
    runInAction(() => {
      modelStore.setIsStreaming(true);
    });
    try {
      const message = baseTurn({
        metadata: {},
        steps: [{content: 'half...', partial: true}],
      });
      const {queryByTestId} = render(<AssistantTurnFooter message={message} />);
      expect(queryByTestId('footer-copy')).toBeNull();
      expect(queryByTestId('footer-regenerate')).toBeNull();
    } finally {
      runInAction(() => {
        modelStore.setIsStreaming(false);
      });
    }
  });

  it('传入 onRegenerate 时渲染重新生成按钮并触发回调', () => {
    const onRegenerate = jest.fn();
    const message = baseTurn({metadata: {}});
    const {getByTestId} = render(
      <AssistantTurnFooter message={message} onRegenerate={onRegenerate} />,
    );
    fireEvent.press(getByTestId('footer-regenerate'));
    expect(onRegenerate).toHaveBeenCalled();
  });

  it('regenerateDisabled 时按钮不触发回调', () => {
    const onRegenerate = jest.fn();
    const message = baseTurn({metadata: {}});
    const {getByTestId} = render(
      <AssistantTurnFooter
        message={message}
        onRegenerate={onRegenerate}
        regenerateDisabled
      />,
    );
    fireEvent.press(getByTestId('footer-regenerate'));
    expect(onRegenerate).not.toHaveBeenCalled();
  });

  describe('§18.2 统一指标行（TurnMetricsRow 能力并入 footer）', () => {
    const turnMetrics = {
      ctxPct: 29,
      writeTime: new Date('2026-08-20T01:58:00').getTime(),
      recallCount: 2,
      recallPreview: ['片段一', '片段二'],
      sentimentLabel: '平稳',
      intent: 'chat' as const,
    };

    it('渲染统一指标行：timing 与 turnMetrics 同源排版', () => {
      const message = baseTurn({
        metadata: {
          timings: {predicted_per_token_ms: 54},
          turnMetrics,
        },
      });
      const {getByTestId, getByText} = render(
        <AssistantTurnFooter message={message} />,
      );
      const metricsRow = getByTestId('footer-metrics');
      expect(metricsRow).toBeTruthy();
      expect(getByText('54ms/token')).toBeTruthy();
      expect(getByText('上下文余量')).toBeTruthy();
      expect(getByText('29%')).toBeTruthy();
      expect(getByText('落盘')).toBeTruthy();
      expect(getByText('召回')).toBeTruthy();
      expect(getByText('平稳')).toBeTruthy();
    });

    it('B19：本回合压缩过旧消息时指标行显示「压缩 N」', () => {
      const message = baseTurn({
        metadata: {
          turnMetrics: {
            ...turnMetrics,
            compactedCount: 6,
          },
        },
      });
      const {getByTestId, getByText} = render(
        <AssistantTurnFooter message={message} />,
      );
      expect(getByTestId('metrics-compacted')).toBeTruthy();
      expect(getByText('6')).toBeTruthy();
    });

    it('B19：compactedCount 缺失（未压缩/老消息）不渲染压缩段', () => {
      const message = baseTurn({metadata: {turnMetrics}});
      const {queryByTestId} = render(<AssistantTurnFooter message={message} />);
      expect(queryByTestId('metrics-compacted')).toBeNull();
    });

    it('召回段点按展开片段预览', () => {
      const message = baseTurn({metadata: {turnMetrics}});
      const {getByTestId, queryByTestId} = render(
        <AssistantTurnFooter message={message} />,
      );
      expect(queryByTestId('metrics-recall-preview')).toBeNull();
      fireEvent.press(getByTestId('metrics-recall'));
      expect(queryByTestId('metrics-recall-preview')).toBeTruthy();
    });

    it('ctx 段点按直达生成设置（导航上下文注入）', () => {
      const navigation: any = {navigate: jest.fn()};
      const message = baseTurn({metadata: {turnMetrics}});
      const {getByTestId} = render(
        <NavigationContext.Provider value={navigation}>
          <AssistantTurnFooter message={message} />
        </NavigationContext.Provider>,
      );
      fireEvent.press(getByTestId('metrics-ctx'));
      expect(navigation.navigate).toHaveBeenCalledWith(
        ROUTES.GENERATION_SETTINGS,
      );
    });

    it('无 turnMetrics 快照的老消息不渲染指标段（锋利不兜底）', () => {
      const message = baseTurn({
        metadata: {timings: {predicted_per_token_ms: 10}},
      });
      const {queryByTestId, getByTestId} = render(
        <AssistantTurnFooter message={message} />,
      );
      expect(getByTestId('footer-metrics')).toBeTruthy();
      expect(queryByTestId('metrics-ctx')).toBeNull();
    });
  });

  describe('context-full banner / footer non-duplication', () => {
    afterEach(() => {
      runInAction(() => {
        chatSessionStore.lastCompletionResult = undefined;
      });
    });

    it('suppresses the "cut off" footer text when the context-full banner owns this turn', () => {
      // The turn's snapshot is the store's live one AND it is contextFull,
      // so the sticky banner is the single surface — footer drops "cut off"
      // and shows plain "Interrupted" instead.
      const snapshot = {used: 4096, contextFull: true, isRemote: false};
      runInAction(() => {
        chatSessionStore.lastCompletionResult = snapshot;
      });
      const message = baseTurn({
        metadata: {
          copyable: true,
          interrupted: true,
          truncationLikely: true,
          completionResult: snapshot,
        },
      });
      const {getByTestId, getByText, queryByText} = render(
        <AssistantTurnFooter message={message} />,
      );
      expect(getByTestId('footer-interrupted-status')).toBeTruthy();
      expect(getByText('Interrupted')).toBeTruthy();
      expect(queryByText('Cut off — likely context full')).toBeNull();
    });

    it('still shows "cut off" when the turn snapshot is not the live banner snapshot', () => {
      // An older truncated turn whose snapshot is not the store's live one
      // keeps its own "cut off" footer.
      runInAction(() => {
        chatSessionStore.lastCompletionResult = {
          used: 1000,
          contextFull: false,
          isRemote: false,
        };
      });
      const message = baseTurn({
        metadata: {
          copyable: true,
          interrupted: true,
          truncationLikely: true,
          completionResult: {used: 4096, contextFull: true, isRemote: false},
        },
      });
      const {getByText} = render(<AssistantTurnFooter message={message} />);
      expect(getByText('Cut off — likely context full')).toBeTruthy();
    });

    it('shows "cut off" when the live snapshot is not contextFull even if it matches', () => {
      const snapshot = {used: 1000, contextFull: false, isRemote: false};
      runInAction(() => {
        chatSessionStore.lastCompletionResult = snapshot;
      });
      const message = baseTurn({
        metadata: {
          copyable: true,
          interrupted: true,
          truncationLikely: true,
          completionResult: snapshot,
        },
      });
      const {getByText} = render(<AssistantTurnFooter message={message} />);
      expect(getByText('Cut off — likely context full')).toBeTruthy();
    });

    it('shows plain "Interrupted" for an interrupted-but-not-truncated turn regardless of banner state', () => {
      runInAction(() => {
        chatSessionStore.lastCompletionResult = {
          used: 4096,
          contextFull: true,
          isRemote: false,
        };
      });
      const message = baseTurn({
        metadata: {copyable: true, interrupted: true},
      });
      const {getByText, queryByText} = render(
        <AssistantTurnFooter message={message} />,
      );
      expect(getByText('Interrupted')).toBeTruthy();
      expect(queryByText('Cut off — likely context full')).toBeNull();
    });
  });

  describe('B40 §11.3 指标图形化展开层（回合遥测）', () => {
    const GB = 1024 * 1024;
    const mkPoint = (
      ts: number,
      pssKb: number,
      cpuPct: number,
      tempC: number,
    ) => ({
      ts,
      pssKb,
      rssKb: pssKb * 0.8,
      cpuPct,
      tempC,
      cpuFreqMhz: 3000,
      gpuLoadPct: -1,
      gpuFreqMhz: -1,
      tempCpuC: -1,
      tempGpuC: -1,
      powerMw: -1,
      stepTime: 0,
      stage: 'chat-turn',
    });
    const turnPerfFixture = {
      points: [
        mkPoint(1000, 4 * GB, 70, 38),
        mkPoint(2000, 5 * GB, 90, 40),
        mkPoint(3000, 4.5 * GB, 80, 41),
      ],
      pssPeakKb: 5 * GB,
      avgCpuPct: 80,
      tempRiseC: 3,
      durationMs: 3200,
    };

    it('有回合遥测 → 展开钥在场；无遥测的旧消息诚实不显', () => {
      const withPerf = baseTurn({metadata: {turnPerf: turnPerfFixture}});
      const {getByTestId} = render(<AssistantTurnFooter message={withPerf} />);
      expect(getByTestId('footer-perf-toggle')).toBeTruthy();

      const legacy = baseTurn({
        metadata: {timings: {predicted_per_second: 12}},
      });
      const {queryByTestId} = render(<AssistantTurnFooter message={legacy} />);
      expect(queryByTestId('footer-perf-toggle')).toBeNull();
    });

    it('点开展开层：双层曲线 + 峰值/温升摘要 + tok/s 翻滚数字', () => {
      const message = baseTurn({
        metadata: {
          timings: {predicted_per_second: 12.34},
          turnPerf: turnPerfFixture,
        },
      });
      const {getByTestId, queryByTestId, getByText} = render(
        <AssistantTurnFooter message={message} />,
      );
      expect(queryByTestId('footer-perf-expand')).toBeNull(); // 默认折叠
      fireEvent.press(getByTestId('footer-perf-toggle'));
      expect(getByTestId('footer-perf-expand')).toBeTruthy();
      expect(getByTestId('footer-perf-chart')).toBeTruthy();
      expect(getByTestId('footer-perf-toks')).toBeTruthy();
      expect(getByText(/峰值 5.0G/)).toBeTruthy();
      expect(getByText(/3 采样点/)).toBeTruthy();
    });
  });
});
