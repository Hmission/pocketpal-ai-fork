import React, {useContext, useState} from 'react';
import {TouchableOpacity, View} from 'react-native';
import {NavigationContext} from '@react-navigation/native';

import {observer} from 'mobx-react';
import {Text} from 'react-native-paper';
import Clipboard from '@react-native-clipboard/clipboard';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';

import {CopyIcon, RefreshIcon} from '../../assets/icons';
import {useTheme} from '../../hooks';
import {PlayButton} from '../TextMessage/PlayButton';
import {AnimatedNumber, OdometerNumber} from '../PerfMotion';
import {PerfAreaChart, type PerfSeriesSpec} from '../PerfAreaChart';
import type {ChatTurnPerfSummary} from '../../services/perf/chatTurnPerf';
import {isSpeakableMessage} from '../../utils/speakable';
import {ROUTES} from '../../utils/navigationConstants';

import {styles} from './styles';

import {chatSessionStore, modelStore, ttsStore} from '../../store';
import {L10nContext} from '../../utils';
import {derivedText, isFinalMessage} from '../../utils/chat';
import {MessageType} from '../../utils/types';
import {t} from '../../locales';

const hapticOptions = {
  enableVibrateFallback: true,
  ignoreAndroidSystemSettings: false,
};

// tok/s 迷你速率条满量程（B39 跑分图示）：端侧 3B 级典型上限，
// 仅作显示归一（演出层），不影响数值本身。
const RATE_FULL_SCALE = 30;

// footer 展开层图表语义色（与 PerfPanel 同登记，IMAGEGEN_UI_SPEC §9）
const PERF_WARN_COLOR = '#F5A623';
const PERF_CPU_COLOR = '#4FC3F7';
const PERF_FOOTER_MAX_KB = 6 * 1024 * 1024; // PSS 满量程 = 6GB 硬杀线

/** timing 段（B39）：数值 + 格式化同源，渲染接 AnimatedNumber 追式缓动 */
interface TimingPart {
  kind: 'msPerToken' | 'tokPerSec' | 'ttft';
  numValue: number;
  format: (n: number) => string;
  suffix: string;
}

/**
 * 每输出指标快照（run_finished 写入 metadata.turnMetrics）。
 * 接口从已删的 TurnMetricsRow 迁入——footer 是该数据的唯一渲染面。
 */
export interface TurnMetrics {
  ctxPct: number;
  writeTime: number;
  recallCount: number;
  recallPreview: string[];
  sentimentLabel: string;
  intent: 'chat' | 'vent' | 'qa' | 'task';
  // B19：本回合发送前压缩的消息条数（老消息无此字段 = 未压缩）
  compactedCount?: number;
}

interface AssistantTurnFooterProps {
  message: MessageType.Any;
  /** 重新生成（复用长按菜单同一 handleTryAgain 完整能力链）；
   *  未传则不渲染按钮 */
  onRegenerate?: () => void;
  /** 重新生成禁用（agent 运行中 / 无激活模型） */
  regenerateDisabled?: boolean;
}

/**
 * 助手卡统一 chrome（CHAT_UI_SPEC §18.2 双行合并）：
 *
 *   行1 = 播放/复制/重新生成（+ interrupted 状态文本）
 *   行2 = 统一指标行：timing 各段 + 上下文余量 + 落盘 + 召回 + 情绪，
 *         分隔符 `·`；数值 brandAccent 600，标签 textSecondary。
 *
 * TurnMetricsRow 已删除，能力并入本组件——每卡只有一块 chrome，
 * 单一存在理由。交互保留：ctx 段点按直达生成设置、召回段点按展开预览。
 *
 * 插槽门控（快照语义，老消息无快照不渲染，不兜底）：
 *   - timings / turnMetrics 任一存在 → 渲染指标行
 *   - 内容非空且已完成             → 渲染复制按钮
 *   - metadata.interrupted          → 渲染 interrupted 状态
 *   - 可朗读（TTS 可用 + 内容判定） → 渲染 PlayButton
 *
 * Used by both AssistantTurn rows and legacy assistant Text rows.
 */
export const AssistantTurnFooter: React.FC<AssistantTurnFooterProps> = observer(
  ({message, onRegenerate, regenerateDisabled}) => {
    const theme = useTheme();
    const l10n = useContext(L10nContext);
    // 直读 NavigationContext（非 useNavigation）：无导航上下文（单测等）时
    // 优雅降级为纯展示；应用内永远有导航容器，入口不丢。
    const navigation = useContext(NavigationContext);
    const [recallExpanded, setRecallExpanded] = useState(false);
    // B40 §11.3：指标图形化展开层开关（文本为主，点开看图）
    const [perfExpanded, setPerfExpanded] = useState(false);

    const {timings, interrupted, truncationLikely, completionResult} =
      message.metadata || {};
    const metrics = (
      message.metadata as {turnMetrics?: TurnMetrics} | undefined
    )?.turnMetrics;
    // B40 §11.2：回合遥测（内存态，仅新回合消息有；旧消息无 = 诚实不渲染）
    const turnPerf = (
      message.metadata as {turnPerf?: ChatTurnPerfSummary} | undefined
    )?.turnPerf;

    // 复制/重新生成按钮可见性：内容非空且（已完成 或 当前非流式中）。
    // 完成度单一事实源 = isFinalMessage（PlayButton 同源）。
    const copyText =
      message.type === 'text' || message.type === 'assistant_turn'
        ? derivedText(message).trim()
        : '';
    const actionsReady =
      copyText.length > 0 &&
      (isFinalMessage(message) || !modelStore.isStreaming);

    // 朗读按钮独立决定 footer 显示：仅可朗读消息（TTS 可用 + 内容判定）
    // 无 chrome 字段时也渲染 footer，承载 PlayButton。
    const speakable = ttsStore.isTTSAvailable && isSpeakableMessage(message);
    if (
      !timings &&
      !metrics &&
      !turnPerf &&
      !actionsReady &&
      !interrupted &&
      !speakable
    ) {
      return null;
    }

    // The sticky context-full banner is the single stronger surface for the
    // newest turn, so the footer drops its "cut off" wording on that turn and
    // shows plain interrupted status instead. Only the turn that drives the
    // banner is suppressed (its snapshot is the store's live one).
    const suppressTruncated =
      truncationLikely === true &&
      completionResult != null &&
      completionResult === chatSessionStore.lastCompletionResult &&
      chatSessionStore.lastCompletionResult?.contextFull === true;

    const componentStyles = styles({theme});

    // Build timing parts（B39）：{numValue, format, suffix} 同源拆分，
    // 数字用品牌色强调 + 追式缓动；tok/s 段额外带迷你速率条（跑分图示）
    const timingParts: TimingPart[] = [];
    const pushTiming = (
      kind: TimingPart['kind'],
      tplKey: string,
      numValue: number,
      format: (n: number) => string,
    ) => {
      const value = format(numValue);
      const full = t(tplKey, {value});
      timingParts.push({
        kind,
        numValue,
        format,
        suffix: full.replace(value, ''),
      });
    };
    if (timings?.predicted_per_token_ms != null) {
      pushTiming(
        'msPerToken',
        l10n.components.bubble.msPerToken,
        timings.predicted_per_token_ms,
        n => n.toFixed(),
      );
    }
    if (timings?.predicted_per_second != null) {
      pushTiming(
        'tokPerSec',
        l10n.components.bubble.tokensPerSec,
        timings.predicted_per_second,
        n => n.toFixed(2),
      );
    }
    if (timings?.time_to_first_token_ms != null) {
      pushTiming(
        'ttft',
        l10n.components.bubble.ttft,
        timings.time_to_first_token_ms,
        n => String(Math.round(n)),
      );
    }

    const copyToClipboard = () => {
      if (message.type !== 'text' && message.type !== 'assistant_turn') {
        return;
      }
      ReactNativeHapticFeedback.trigger('impactLight', hapticOptions);
      Clipboard.setString(derivedText(message).trim());
    };

    const writeTimeStr = metrics
      ? new Date(metrics.writeTime).toLocaleTimeString().slice(0, 5)
      : '';

    const hasMetricsRow =
      timingParts.length > 0 || Boolean(metrics) || Boolean(turnPerf);
    const separator = (key: string) => (
      <Text key={key} style={componentStyles.metricsSeparator}>
        ·
      </Text>
    );

    return (
      <View style={componentStyles.container} testID="assistant-turn-footer">
        {/* 行1：动作行（播放/复制/重新生成 + interrupted 状态） */}
        <View style={componentStyles.actionsRow}>
          <PlayButton message={message} />
          {actionsReady && (
            <TouchableOpacity
              onPress={copyToClipboard}
              testID="footer-copy"
              accessibilityLabel={l10n.components.chatView.menuItems.copy}
              hitSlop={{top: 14, bottom: 14, left: 14, right: 14}}>
              <CopyIcon
                stroke={theme.colors.textSecondary}
                width={16}
                height={16}
              />
            </TouchableOpacity>
          )}
          {actionsReady && onRegenerate ? (
            <TouchableOpacity
              onPress={regenerateDisabled ? undefined : onRegenerate}
              testID="footer-regenerate"
              accessibilityLabel={l10n.components.chatView.menuItems.regenerate}
              style={
                regenerateDisabled ? componentStyles.actionDisabled : undefined
              }
              hitSlop={{top: 14, bottom: 14, left: 14, right: 14}}>
              <RefreshIcon
                stroke={theme.colors.textSecondary}
                width={16}
                height={16}
              />
            </TouchableOpacity>
          ) : null}
          {interrupted ? (
            <Text
              style={componentStyles.interruptedStatus}
              testID="footer-interrupted-status">
              {truncationLikely && !suppressTruncated
                ? l10n.components.bubble.truncated
                : l10n.components.bubble.interrupted}
            </Text>
          ) : null}
        </View>

        {/* 行2：统一指标行（timing + turnMetrics 同源排版契约） */}
        {hasMetricsRow ? (
          <View style={componentStyles.metricsRow} testID="footer-metrics">
            {timingParts.map((part, i) => (
              <React.Fragment key={`timing-${i}`}>
                {i > 0 ? separator(`sep-t-${i}`) : null}
                <View style={componentStyles.metricsSection}>
                  {part.kind === 'tokPerSec' ? (
                    // 迷你速率条（B39 跑分图示）：24px 轨道 + 品牌色填充，
                    // 宽度按满量程归一（显示层，不改数值）
                    <View style={componentStyles.rateBarTrack}>
                      <View
                        style={[
                          componentStyles.rateBarFill,
                          {
                            width: Math.max(
                              2,
                              Math.min(part.numValue / RATE_FULL_SCALE, 1) * 24,
                            ),
                          },
                        ]}
                        testID="metrics-rate-bar"
                      />
                    </View>
                  ) : null}
                  <Text>
                    {/* 数字用品牌色强调 + 追式缓动，标签用辅助灰 */}
                    <AnimatedNumber
                      value={part.numValue}
                      format={part.format}
                      style={componentStyles.metricsValue}
                    />
                    <Text style={componentStyles.metricsLabel}>
                      {part.suffix}
                    </Text>
                  </Text>
                </View>
              </React.Fragment>
            ))}
            {metrics ? (
              <>
                {timingParts.length > 0 ? separator('sep-m-0') : null}
                {/* 上下文余量：点按直达生成设置（每模型 n_ctx 入口不丢） */}
                <TouchableOpacity
                  style={componentStyles.metricsSection}
                  onPress={() =>
                    navigation?.navigate(ROUTES.GENERATION_SETTINGS as never)
                  }
                  disabled={!navigation}
                  testID="metrics-ctx"
                  hitSlop={{top: 8, bottom: 8, left: 4, right: 4}}>
                  <Text style={componentStyles.metricsLabel}>上下文余量</Text>
                  <Text style={componentStyles.metricsValue}>
                    {metrics.ctxPct}%
                  </Text>
                </TouchableOpacity>
                {separator('sep-m-1')}
                <View style={componentStyles.metricsSection}>
                  <Text style={componentStyles.metricsLabel}>落盘</Text>
                  <Text style={componentStyles.metricsValue}>
                    {writeTimeStr}
                  </Text>
                </View>
                {separator('sep-m-2')}
                <TouchableOpacity
                  style={componentStyles.metricsSection}
                  onPress={() => setRecallExpanded(v => !v)}
                  disabled={metrics.recallCount === 0}
                  testID="metrics-recall"
                  hitSlop={{top: 8, bottom: 8, left: 4, right: 4}}>
                  <Text style={componentStyles.metricsLabel}>召回</Text>
                  <Text style={componentStyles.metricsValue}>
                    {metrics.recallCount}
                    {metrics.recallCount > 0
                      ? recallExpanded
                        ? ' ⌃'
                        : ' ⌄'
                      : ''}
                  </Text>
                </TouchableOpacity>
                {separator('sep-m-3')}
                {/* B19 压缩计数：本回合发送前压缩了 N 条早期消息（0/缺失不渲染） */}
                {metrics.compactedCount ? (
                  <>
                    <View
                      style={componentStyles.metricsSection}
                      testID="metrics-compacted">
                      <Text style={componentStyles.metricsLabel}>压缩</Text>
                      <Text style={componentStyles.metricsValue}>
                        {metrics.compactedCount}
                      </Text>
                    </View>
                    {separator('sep-m-4')}
                  </>
                ) : null}
                <Text style={componentStyles.metricsValue}>
                  {metrics.sentimentLabel}
                </Text>
              </>
            ) : null}
            {/* B40 §11.3：图形展开钥（仅本回合有遥测时显；文本为主，点开看图） */}
            {turnPerf ? (
              <>
                {timingParts.length > 0 || metrics
                  ? separator('sep-perf')
                  : null}
                <TouchableOpacity
                  style={componentStyles.metricsSection}
                  onPress={() => setPerfExpanded(v => !v)}
                  testID="footer-perf-toggle"
                  hitSlop={{top: 8, bottom: 8, left: 4, right: 4}}>
                  <Text style={componentStyles.metricsLabel}>
                    {perfExpanded ? '▴ 图' : '▾ 图'}
                  </Text>
                </TouchableOpacity>
              </>
            ) : null}
          </View>
        ) : null}

        {/* B40 §11.3：指标图形化展开层（回合遥测双层曲线 + 峰值/温升摘要 +
            tok/s 翻滚大数字）；无轨迹的旧消息诚实不渲染 */}
        {perfExpanded && turnPerf ? (
          <View style={componentStyles.perfExpand} testID="footer-perf-expand">
            <PerfAreaChart
              history={turnPerf.points}
              overlay="pss"
              max={PERF_FOOTER_MAX_KB}
              color={theme.colors.primary}
              warnColor={PERF_WARN_COLOR}
              dangerColor={theme.colors.error}
              series={
                [
                  {
                    key: 'pss',
                    color: theme.colors.primary,
                    max: PERF_FOOTER_MAX_KB,
                  },
                  {key: 'cpu', color: PERF_CPU_COLOR, max: 100},
                ] as PerfSeriesSpec[]
              }
              height={72}
              testID="footer-perf-chart"
            />
            <View style={componentStyles.perfExpandStats}>
              {timings?.predicted_per_second != null ? (
                <View style={componentStyles.metricsSection}>
                  <OdometerNumber
                    value={timings.predicted_per_second}
                    format={n => n.toFixed(1)}
                    fontSize={14}
                    color={theme.colors.brandAccent}
                    testID="footer-perf-toks"
                  />
                  <Text style={componentStyles.metricsLabel}>tok/s</Text>
                </View>
              ) : null}
              <Text style={componentStyles.metricsLabel}>
                峰值 {(turnPerf.pssPeakKb / 1024 / 1024).toFixed(1)}G · 温升{' '}
                {turnPerf.tempRiseC >= 0 ? '+' : ''}
                {turnPerf.tempRiseC.toFixed(1)}°C · {turnPerf.points.length}{' '}
                采样点
              </Text>
            </View>
          </View>
        ) : null}

        {/* 召回片段预览（默认折叠，点按展开） */}
        {recallExpanded && metrics && metrics.recallCount > 0 ? (
          <View
            style={componentStyles.recallPreview}
            testID="metrics-recall-preview">
            {metrics.recallPreview.map((frag, i) => (
              <Text
                key={i}
                style={componentStyles.recallText}
                numberOfLines={2}>
                {frag.slice(0, 100)}
              </Text>
            ))}
          </View>
        ) : null}
      </View>
    );
  },
);
