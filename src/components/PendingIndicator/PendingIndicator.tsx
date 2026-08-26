import React, {useContext, useEffect, useRef, useState} from 'react';
import {Animated, StyleSheet, Text, View} from 'react-native';
import {observer} from 'mobx-react-lite';

import {useTheme} from '../../hooks';
import {L10nContext} from '../../utils';
import {t} from '../../locales';
import {modelStore} from '../../store';
import NativeHardwareInfo, {
  type PerfSnapshot,
} from '../../specs/NativeHardwareInfo';
import {AnimatedNumber} from '../PerfMotion';
import {PerfAreaChart} from '../PerfAreaChart';

import {createStyles, createCountStyle} from './styles';

import {Theme} from '../../utils/types';
import type {AgentUiState} from '../../services/agent';

// Suppress the count for trivial in-progress calls so simple talents
// don't trade a dot-row for "1 tokens" the moment they start. The
// threshold is small enough that the user sees the count appear
// within the first few tokens of any non-trivial tool call.
const MIN_TOKENS = 10;

// 心跳超时阈值（2026-08-19 K90 血证，CHAT_UI_SPEC §18.9）：3B + 思考
// 最坏 TTFT 226s，阈值 300s 有冗余；超此无任何 token/工具事件 →
// 判定疑似卡住（纯告知，尊重停止钮，不自动杀）。
const STALL_MS = 300_000;

// Map talent name → l10n key under `components.pendingIndicator`.
// Keeping the mapping local to the renderer avoids leaking React-
// context-bound l10n into the service layer. New talents that want
// a label add an entry here; otherwise they fall back to the
// generic "Preparing tool".
const TALENT_LABEL_KEYS: Record<
  string,
  'buildingPage' | 'calculating' | 'lookingUpTime' | 'searching'
> = {
  render_html: 'buildingPage',
  calculate: 'calculating',
  datetime: 'lookingUpTime',
  // B57：联网搜索业务语义标签——web_search 全程（生成调用+执行）
  // 不再 fallback 通用「准备工具/执行工具中」。
  web_search: 'searching',
};

// 遥测行格式化（B40 仪式卡，单位语言中立）
const perfGbFmt = (n: number) => `${n.toFixed(1)}G`;
const perfPctFmt = (n: number) => `${Math.round(n)}%`;
const perfTempFmt = (n: number) => `${Math.round(n)}°C`;

// 阶段 → 人类可读标签（生成进度监控卡 §18.9）。工具调用阶段走
// TALENT_LABEL_KEYS（更具体），prefill/streaming/executing 走通用文案。
// B57：streaming_text 按 reasoningPhase 区分「正在思考…/正在回复…」——
// 思考期与正文期语义不同，用户能分辨模型在思考还是在写答案。
function stageLabelKey(
  status: AgentUiState['status'],
  reasoningPhase: boolean,
): string | null {
  switch (status) {
    case 'prefill':
      return 'stagePreparing';
    case 'streaming_text':
      return reasoningPhase ? 'stageThinking' : 'stageGenerating';
    case 'executing_tool':
      return 'stageExecuting';
    default:
      return null;
  }
}

interface DotProps {
  delay: number;
  theme: Theme;
}

const waveBarStyles = StyleSheet.create({
  bar: {
    width: 2,
    borderRadius: 1,
  },
});

/**
 * 心跳微波形（B39 跑分感，PERF_BENCHMARK_DESIGN §10.4）：
 * 5 根错峰起伏小条——「手机在干活」的心电图证据。
 * 卡住/停止时由调用态隐去（心跳平坦 = 诚实语义）。
 */
const WaveBar: React.FC<{delay: number; color: string}> = ({delay, color}) => {
  const h = useRef(new Animated.Value(3)).current;
  // 心跳条静态外观（B39）：2px 细条 + 圆角，动态高/色经组件体变量注入
  const waveStyle = {backgroundColor: color, height: h};
  useEffect(() => {
    // 全局动画规范：Animated.loop 一律 JS driver
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(h, {
          toValue: 10,
          duration: 350,
          delay,
          useNativeDriver: false,
        }),
        Animated.timing(h, {toValue: 3, duration: 350, useNativeDriver: false}),
      ]),
    );
    anim.start();
    return () => anim.stop();
  }, [h, delay]);
  return <Animated.View style={[waveBarStyles.bar, waveStyle]} />;
};

const Dot: React.FC<DotProps> = ({delay, theme}) => {
  const opacity = useRef(new Animated.Value(0.3)).current;
  const dotStyle = createStyles(theme).dot;

  useEffect(() => {
    // 全局动画规范：Animated.loop 一律 JS driver。本组件在工具调用期间持续循环，
    // token 流期间 JS 高频活跃，3 个 opacity 插值每帧 JS 开销极小（ChatView
    // observer 隔离已保证 loop 不被 remount 打断），JS driver 下同样成立。
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 500,
          delay,
          useNativeDriver: false,
        }),
        Animated.timing(opacity, {
          toValue: 0.3,
          duration: 500,
          useNativeDriver: false,
        }),
      ]),
    );
    loop.start();
    // 锋利根治（B61 jest worker 泄漏）：loop 句柄必须随卸载停止——
    // JS driver 下 loop 靠 rAF/setTimeout 自续帧，不 stop 就是永动定时器，
    // 跨套件在 worker 内累积（同 CircularActivityIndicator 收口先例）。
    return () => loop.stop();
  }, [opacity, delay]);

  return (
    <Animated.View
      style={[
        dotStyle,
        {
          backgroundColor: theme.colors.onSurfaceVariant,
          opacity,
        },
      ]}
    />
  );
};

interface PendingIndicatorProps {
  /**
   * Names of tool calls the model is currently generating. The first
   * name (if any) drives the friendly label ("Building page", etc.).
   * Empty / undefined → no label, plain dot-row.
   */
  pendingTalentNames?: string[];
  /**
   * Number of token events received during the current tool-call
   * generation. Surfaced once it crosses {@link MIN_TOKENS}.
   */
  toolCallTokenCount?: number;
  /**
   * True between the user pressing Stop and the runner actually
   * exiting (native llama.rn finishing its in-flight `llama_decode`
   * chunk). When true, the indicator overrides any tool-call label /
   * count / elapsed suffix with a single "Stopping…" message — the
   * user-facing signal that "your stop was received, native is
   * winding down at its next chunk boundary."
   */
  isStopping?: boolean;
  /**
   * Agent run status（生成进度监控卡 §18.9）。驱动阶段标签
   * （准备中/生成中/执行工具）；非活跃态返回 null 由调用方门控。
   */
  agentStatus?: AgentUiState['status'];
  /** run_started 时间戳：总耗时起算（覆盖 prefill，K90 血证） */
  runStartedAt?: number | null;
  /** 最近一次 token/工具事件时间戳：心跳判定（>300s → 疑似卡住） */
  lastAgentEventAt?: number | null;
  /**
   * streaming_text 期阶段语义（B57）：true = 纯思考流 →「正在思考…」；
   * false = 正文流 →「正在回复…」。思考内容本身在气泡 ReasoningBlock，
   * 跑分卡不重复显示。
   */
  reasoningPhase?: boolean;
}

/**
 * Three-dot pending indicator rendered below the latest turn during
 * prefill / tool-call generation / tool execution. Pure decoration —
 * visibility is gated by the caller.
 *
 * For long tool calls, when `pendingTalentNames` is non-empty the
 * indicator also renders a friendly per-talent label, the running
 * token count, and elapsed seconds so the user can tell the model is
 * still working rather than hung.
 */
export const PendingIndicator: React.FC<PendingIndicatorProps> = observer(
  ({
    pendingTalentNames,
    toolCallTokenCount = 0,
    isStopping = false,
    agentStatus,
    runStartedAt = null,
    lastAgentEventAt = null,
    reasoningPhase = false,
  }) => {
    const theme = useTheme();
    const l10n = useContext(L10nContext);
    const styles = createStyles(theme);
    const countStyle = createCountStyle(theme).count;

    const firstTalent = pendingTalentNames?.[0];
    const inToolCallMode = !!firstTalent;

    // 总耗时 + 心跳（§18.9）：interval 只依赖 runStartedAt；
    // lastAgentEventAt 经 ref 同步最新值，避免 300ms 级事件触发
    // interval 重建（与 toolCallTokenCount 同策略的 observer 最小化）。
    const lastEventRef = useRef(lastAgentEventAt);
    lastEventRef.current = lastAgentEventAt;
    const [elapsedSec, setElapsedSec] = useState(0);
    const [stalled, setStalled] = useState(false);
    // 工具期实时速率（B39）：toolCallTokenCount 差分 / 1s 心跳 interval，
    // 不新增定时器；流式期监控卡本就隐藏（门控既有），不造假场景。
    const prevTokenCountRef = useRef(toolCallTokenCount);
    const [tokenRate, setTokenRate] = useState(0);
    useEffect(() => {
      if (runStartedAt == null) {
        setElapsedSec(0);
        setStalled(false);
        setTokenRate(0);
        prevTokenCountRef.current = toolCallTokenCount;
        return;
      }
      const startedAt = runStartedAt;
      const tick = () => {
        const now = Date.now();
        setElapsedSec(Math.floor((now - startedAt) / 1000));
        const last = lastEventRef.current;
        setStalled(last != null && now - last > STALL_MS);
        // interval 1s → 差分即 tok/s（真实采集，不平滑）
        setTokenRate(
          Math.max(0, toolCallTokenCount - prevTokenCountRef.current),
        );
        prevTokenCountRef.current = toolCallTokenCount;
      };
      tick();
      const interval = setInterval(tick, 1000);
      return () => clearInterval(interval);
      // toolCallTokenCount 经 ref 同步（首帧同步），不入依赖避免 interval 重建；
      // 基准只在 tick() 内推进——差分即真实速率，外部重置会让速率恒 0
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [runStartedAt]);

    // 实时遥测（B40 仪式卡）：待回复卡驻留期间 1Hz 采样（PSS/CPU/温度）——
    // 仪式感 = 设备在烧电路的活证据；N/A 诚实显 --，不造假。
    // B41：perfHistory 滚动缓冲（最近 60 点）驱动迷你折线，跑分是本体。
    const PERF_MAX_PSS_KB = 6 * 1024 * 1024;
    const [perfNow, setPerfNow] = useState<{
      pssGb: number;
      cpuPct: number;
      tempC: number;
    } | null>(null);
    const [perfHistory, setPerfHistory] = useState<PerfSnapshot[]>([]);
    useEffect(() => {
      let alive = true;
      const sample = async () => {
        try {
          const s = await NativeHardwareInfo.getPerfSnapshot();
          if (!alive) {
            return;
          }
          setPerfNow({
            pssGb: s.pssKb / 1024 / 1024,
            cpuPct: s.cpuPct,
            tempC: s.tempC,
          });
          setPerfHistory(h => [...h, s].slice(-60));
        } catch {
          if (alive) {
            setPerfNow(null);
          }
        }
      };
      sample();
      const iv = setInterval(sample, 1000);
      return () => {
        alive = false;
        clearInterval(iv);
      };
    }, []);

    // Build the label suffix.
    // - `stopping` overrides everything with "Stopping…".
    // - `stalled`（心跳超时）→ "Seems stuck — tap Stop · Xs"：
    //   用户必须能区分「正在干活 vs 挂了」（§18.9）。
    // - tool-call mode → "Building page · 120 tokens · Xs".
    // - 其它阶段 → 阶段标签 + 总耗时（prefill 不再裸三点）。
    let suffix: string | null = null;
    if (isStopping) {
      suffix = l10n.components.pendingIndicator.stopping;
    } else if (stalled && runStartedAt != null) {
      suffix = `${l10n.components.pendingIndicator.stageHang} · ${t(
        l10n.components.toolMetrics.elapsed,
        {seconds: elapsedSec},
      )}`;
    } else if (inToolCallMode) {
      const labelKey = firstTalent ? TALENT_LABEL_KEYS[firstTalent] : undefined;
      const label = labelKey
        ? l10n.components.pendingIndicator[labelKey]
        : l10n.components.pendingIndicator.preparingTool;
      const parts: string[] = [label];
      if (toolCallTokenCount >= MIN_TOKENS) {
        parts.push(
          t(l10n.components.toolMetrics.tokens, {
            count: toolCallTokenCount.toLocaleString(),
          }),
        );
      }
      if (runStartedAt != null && elapsedSec >= 1) {
        parts.push(
          t(l10n.components.toolMetrics.elapsed, {seconds: elapsedSec}),
        );
      }
      // 实时速率（B39）：差分 >0 才显，单位语言中立（同 GB/°C 惯例）
      if (tokenRate > 0) {
        parts.push(`≈${tokenRate} tok/s`);
      }
      suffix = parts.join(' · ');
    } else {
      const key = stageLabelKey(agentStatus ?? 'idle', reasoningPhase);
      const label = key
        ? (l10n.components.pendingIndicator as Record<string, string>)[key]
        : null;
      const parts: string[] = [];
      if (label) {
        parts.push(label);
      }
      if (runStartedAt != null && elapsedSec >= 1) {
        parts.push(
          t(l10n.components.toolMetrics.elapsed, {seconds: elapsedSec}),
        );
      }
      suffix = parts.length > 0 ? parts.join(' · ') : null;
    }

    // 阶段色（B39）：prefill 蓝（info）→ 工具期紫（domain.tools），
    // 全部既有 token 不造新色；流式期监控卡隐藏故无第三态。
    const stageColor = inToolCallMode
      ? theme.colors.domain.tools
      : theme.colors.info;
    // 心跳波形：卡住/停止时平坦（诚实），活跃时起伏（活着）
    const showWave = !isStopping && !stalled && runStartedAt != null;

    return (
      <View style={styles.card} testID="pending-indicator">
        <View style={styles.row}>
          {showWave && (
            <View style={styles.wave} testID="pending-indicator-wave">
              {[0, 1, 2, 3, 4].map(i => (
                <WaveBar key={i} delay={i * 120} color={stageColor} />
              ))}
            </View>
          )}
          <Dot delay={0} theme={theme} />
          <Dot delay={200} theme={theme} />
          <Dot delay={400} theme={theme} />
          {suffix !== null && (
            <Text style={countStyle} testID="pending-indicator-suffix">
              {suffix}
            </Text>
          )}
        </View>
        {/* 模型加载阶段（B40）：「加载到哪一步」可见 */}
        {modelStore.isContextLoading && (
          <Text style={styles.perfRow} testID="pending-indicator-loading">
            {l10n.benchmark.messages.initializingModel}
          </Text>
        )}
        {/* 实时遥测行（B40）：内存/CPU/温度 1Hz，追式缓动数字 */}
        <Text style={styles.perfRow} testID="pending-indicator-telemetry">
          <Text style={styles.perfLabel}>内存 </Text>
          <AnimatedNumber
            value={perfNow ? perfNow.pssGb : undefined}
            format={perfGbFmt}
            style={styles.perfValue}
          />
          <Text style={styles.perfSep}> · </Text>
          <Text style={styles.perfLabel}>CPU </Text>
          <AnimatedNumber
            value={perfNow ? perfNow.cpuPct : undefined}
            format={perfPctFmt}
            style={styles.perfValue}
          />
          <Text style={styles.perfSep}> · </Text>
          <AnimatedNumber
            value={perfNow ? perfNow.tempC : undefined}
            format={perfTempFmt}
            style={styles.perfValue}
          />
        </Text>
        {/* B41 迷你折线：等待的每一秒都有曲线在跑（跑分是本体）。
          复用生图页同款 PerfAreaChart，PSS 主图 + 5/6GB 阈值线。 */}
        {perfHistory.length > 1 && (
          <View style={styles.perfChartWrap} testID="pending-indicator-chart">
            <PerfAreaChart
              history={perfHistory}
              overlay="pss"
              max={PERF_MAX_PSS_KB}
              color={stageColor}
              warnColor="#F5A623"
              dangerColor={theme.colors.error}
              height={44}
            />
          </View>
        )}
      </View>
    );
  },
);
