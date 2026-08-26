/**
 * PerfPanel — 专业跑分式性能面板（ADR-0008 + PERF_BENCHMARK_DESIGN v0.2/v0.5）
 *
 * 嵌于预览卡片下半截的**横版紧凑布局**（大王裁定）：
 *  - 折叠头一行：性能▾ + PSS 大字（阈值色）+ 指标胶囊（CPU/GPU/温/功耗）
 *  - 展开体：坐标轴折线图（B43 坐标轴升级：Y 刻度/时间轴/网格/虚线标注）
 *    + 复合图（叠全模式：PSS/功耗折线 + CPU/GPU 柱状 + 温度热力带）
 *    + 指标行（分级色）+ 图例行（叠全时）+ 历史入口
 *  - 默认叠全（B40 五通道分色同屏；B43 改复合呈现：折线不糊、温度不撞色），
 *    chip 可切回单线；「叠全」chip 置于最左（大王裁定）
 * B39 演出层：全数字接 AnimatedNumber 追式缓动；胶囊负载分档变色；
 * B43 演出层：折线图 vivid 动画（呼吸光圈 + 彗星尾 + 扫掠光）+ 指标分级色
 *   （温度/功耗/频率/步耗时全部按档变色，不再全黑）。
 * 数据链（syncPoll/perfRecorder）零改动。-1 = 原生侧 N/A → 显 `--`。
 * 语义色登记：IMAGEGEN_UI_SPEC §9（PERF_WARN 橙 #F5A623，>6GB 用 theme.colors.error）。
 */
import * as React from 'react';
import {ScrollView, Text, TouchableOpacity, View} from 'react-native';
import {observer} from 'mobx-react-lite';
import {imageGenStore} from '../../../store/imageGenStore';
import {useTheme} from '../../../hooks';
import {AnimatedNumber} from '../../../components/PerfMotion';
import {createStyles} from '../styles';
import {PerfHistoryModal} from '../../../components/PerfHistoryModal';
import {
  PerfAreaChart,
  type PerfBarSpec,
  type PerfOverlay,
  type PerfSeriesSpec,
} from '../../../components/PerfAreaChart';
// 阈值/格式器单一事实源（IMAGEGEN_UI_SPEC §9 语义色注册表，2026-08-26 抽取共享）
import {
  PERF_DANGER_KB,
  PERF_WARN_COLOR,
  PERF_CPU_COLOR,
  PERF_GPU_COLOR,
  PERF_POWER_COLOR,
  TIER_TEMP,
  TIER_POWER_W,
  TIER_CPU_FREQ_G,
  TIER_GPU_FREQ_M,
  TIER_STEP_S,
  na,
  opt,
  tierColor,
  loadTierColor,
  pssColorOf,
  pctFmt,
  tempFmt,
  powerFmt,
  freqFmt,
  gbFmt,
  stepFmt,
} from '../../../utils/perfTiers';

/** 阈值已迁 utils/perfTiers（2026-08-26 抽取共享；PERF_WARN_KB/PERF_DANGER_KB 单一事实源） */

/** 叠加线维度：PSS 主图 + CPU/GPU/温度/功耗切换（各自满量程归一）；
 *  B40 新增 'all' 叠全；B43 叠全改复合图（折线+柱状+热力带）并置于最左 */
type Overlay = PerfOverlay | 'all';
const OVERLAY_LABEL: Record<Overlay, string> = {
  pss: 'PSS',
  cpu: 'CPU',
  gpu: 'GPU',
  temp: '温度',
  power: '功耗',
  all: '叠全',
};
/** chip 顺序（大王裁定：「叠全」在最左边） */
const OVERLAY_ORDER: Overlay[] = ['all', 'pss', 'cpu', 'gpu', 'temp', 'power'];
const OVERLAY_MAX: Record<PerfOverlay, number> = {
  pss: PERF_DANGER_KB,
  cpu: 100,
  gpu: 100,
  temp: 60,
  power: 10000,
};
const OVERLAY_COLOR: Record<PerfOverlay, string> = {
  pss: '', // 走 theme.primary（阈值色另行）
  cpu: PERF_CPU_COLOR,
  gpu: PERF_GPU_COLOR,
  temp: PERF_WARN_COLOR,
  power: PERF_POWER_COLOR,
};

/** 叠全复合图图例（B43）：色点 + 名称，虚线语义已由图内 5GB/6GB 端点标注承载 */
const LEGEND_ITEMS: Array<{label: string; color: string}> = [
  {label: 'PSS', color: ''},
  {label: 'CPU', color: PERF_CPU_COLOR},
  {label: 'GPU', color: PERF_GPU_COLOR},
  {label: '温度带', color: PERF_WARN_COLOR},
  {label: '功耗', color: PERF_POWER_COLOR},
];

/** 指标分级阈值与三色函数见 utils/perfTiers（2026-08-26 抽取共享，本文件不再重复定义） */

export const PerfPanel: React.FC = observer(() => {
  const theme = useTheme();
  const s = createStyles(theme);
  const [expanded, setExpanded] = React.useState(true);
  // 默认叠全：五通道分色同屏（B43 复合图：折线+柱状+热力带），打开即看全参数走势
  const [overlay, setOverlay] = React.useState<Overlay>('all');
  const [historyVisible, setHistoryVisible] = React.useState(false);

  const {perf, perfHistory, stepTime} = imageGenStore;
  const pssKb = perf?.pssKb ?? 0;
  const pssColor = pssColorOf(theme, pssKb, theme.colors.primary);
  const peakPss = perfHistory.reduce((m, p) => Math.max(m, p.pssKb), 0);

  const isAll = overlay === 'all';
  const barColor =
    isAll || overlay === 'pss'
      ? undefined
      : OVERLAY_COLOR[overlay] || theme.colors.primary;

  // B43 叠全复合图：折线（PSS+功耗）+ 柱状（CPU/GPU 负载）+ 热力带（温度）
  const multiSeries: PerfSeriesSpec[] | undefined = isAll
    ? [
        {key: 'pss', color: theme.colors.primary, max: OVERLAY_MAX.pss},
        {key: 'power', color: OVERLAY_COLOR.power, max: OVERLAY_MAX.power},
      ]
    : undefined;
  const multiBars: PerfBarSpec[] | undefined = isAll
    ? [
        {key: 'cpu', color: OVERLAY_COLOR.cpu, max: OVERLAY_MAX.cpu},
        {key: 'gpu', color: OVERLAY_COLOR.gpu, max: OVERLAY_MAX.gpu},
      ]
    : undefined;

  /** Y 轴刻度文本：按当前叠加维度单位（叠全=主维度 PSS GB） */
  const yTickFmt = (frac: number, mx: number): string => {
    const dim: PerfOverlay = isAll ? 'pss' : overlay;
    if (dim === 'pss') {
      const g = (frac * mx) / 1024 / 1024;
      return g >= 1 ? `${g.toFixed(0)}G` : `${Math.round(g * 1024)}M`;
    }
    if (dim === 'cpu' || dim === 'gpu') {
      return `${Math.round(frac * 100)}%`;
    }
    if (dim === 'temp') {
      return `${Math.round(frac * mx)}°`;
    }
    return `${Math.round((frac * mx) / 1000)}W`;
  };

  // 指标分级色（B43）：统一「正常继承 / 橙警告 / 红危险」两档；invert=低于阈值警戒
  // 实现见 utils/perfTiers（tierColor/loadTierColor 单一事实源，2026-08-26 抽取）
  const tempShown = !na(perf?.tempGpuC)
    ? perf!.tempGpuC
    : !na(perf?.tempCpuC)
      ? perf!.tempCpuC
      : perf?.tempC;
  const powerW =
    perf?.powerMw != null && perf.powerMw >= 0
      ? perf.powerMw / 1000
      : undefined;

  return (
    <View style={s.perfPanel} testID="perf-panel">
      {/* 折叠头一行：性能▾ + PSS 大字 + 指标胶囊 */}
      <TouchableOpacity
        style={s.perfHeader}
        onPress={() => setExpanded(v => !v)}
        testID="perf-expand"
        activeOpacity={0.7}>
        <Text style={s.perfTitle}>性能 {expanded ? '▴' : '▾'}</Text>
        <AnimatedNumber
          value={perf ? pssKb / 1024 / 1024 : undefined}
          format={gbFmt}
          style={[s.perfPssBig, {color: pssColor}]}
          testID="perf-pss"
        />
        <View style={s.perfCapsuleRow}>
          <View style={s.perfCapsule} testID="perf-cpu">
            <Text style={s.perfCapsuleText}>
              CPU{' '}
              <AnimatedNumber
                value={opt(perf?.cpuPct)}
                format={pctFmt}
                style={{color: loadTierColor(theme, perf?.cpuPct)}}
              />
            </Text>
          </View>
          <View style={s.perfCapsule} testID="perf-gpu">
            <Text style={s.perfCapsuleText}>
              GPU{' '}
              <AnimatedNumber
                value={opt(perf?.gpuLoadPct)}
                format={pctFmt}
                style={{color: loadTierColor(theme, perf?.gpuLoadPct)}}
              />
            </Text>
          </View>
          <View style={s.perfCapsule} testID="perf-temp">
            <Text style={s.perfCapsuleText}>
              <AnimatedNumber
                value={opt(tempShown)}
                format={tempFmt}
                style={{
                  color: tierColor(
                    theme,
                    tempShown,
                    TIER_TEMP.warn,
                    TIER_TEMP.danger,
                  ),
                }}
              />
            </Text>
          </View>
          <View style={s.perfCapsule}>
            <Text style={s.perfCapsuleText}>
              <AnimatedNumber
                value={opt(perf?.powerMw)}
                format={powerFmt}
                style={{
                  color: tierColor(
                    theme,
                    powerW,
                    TIER_POWER_W.warn,
                    TIER_POWER_W.danger,
                  ),
                }}
              />
            </Text>
          </View>
        </View>
      </TouchableOpacity>
      {expanded ? (
        <View style={s.perfBody}>
          {/* 叠加线切换 chips（叠全最左）+ 峰值 */}
          <View style={s.perfOverlayRow}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={s.perfChipsScroll}>
              {OVERLAY_ORDER.map(o => (
                <TouchableOpacity
                  key={o}
                  onPress={() => setOverlay(o)}
                  testID={`perf-overlay-chip-${o}`}
                  style={[
                    s.perfOverlayChip,
                    overlay === o && s.perfOverlayChipActive,
                  ]}>
                  <Text
                    style={[
                      s.perfOverlayChipText,
                      overlay === o && s.perfOverlayChipTextActive,
                    ]}>
                    {OVERLAY_LABEL[o]}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <Text style={s.perfPeak}>
              峰值 {(peakPss / 1024 / 1024).toFixed(1)}GB
            </Text>
          </View>
          {/* B43 图例行（叠全时）：色点 + 通道名，虚线语义已由图内 5GB/6GB 端点标注 */}
          {isAll ? (
            <View style={s.perfLegend} testID="perf-legend">
              {LEGEND_ITEMS.map(it => (
                <View key={it.label} style={s.perfLegendItem}>
                  <View
                    style={[
                      s.perfLegendDot,
                      {backgroundColor: it.color || theme.colors.primary},
                    ]}
                  />
                  <Text style={s.perfLegendText}>{it.label}</Text>
                </View>
              ))}
            </View>
          ) : null}
          {/* 坐标轴复合图（B43）：折线 + 渐变面积（单通道）/ 复合图（叠全）+ 演出层动画 */}
          <View style={s.perfMiniChart}>
            <PerfAreaChart
              history={perfHistory}
              overlay={isAll ? 'pss' : overlay}
              max={isAll ? OVERLAY_MAX.pss : OVERLAY_MAX[overlay]}
              color={barColor ?? theme.colors.primary}
              warnColor={PERF_WARN_COLOR}
              dangerColor={theme.colors.error}
              series={multiSeries}
              bars={multiBars}
              tempBand={isAll}
              axes
              yTick={yTickFmt}
              vivid
              axisColor={theme.colors.onSurfaceVariant}
              height={88}
              testID="perf-area-chart"
            />
            {perfHistory.length === 0 ? (
              <Text style={s.perfChartEmpty}>--</Text>
            ) : null}
          </View>
          {/* 指标行（自适应换行网格，B43 分级色）+ 历史入口：
              不再横向滚动——7 项指标 + 历史按钮在卡片宽度内折行，
              全部可见（根治「最底下一行显示不全」）。 */}
          <View style={s.perfMetricsRow} testID="perf-metrics">
            <View style={s.perfMetric}>
              <Text style={s.perfMetricLabel}>CPU</Text>
              <AnimatedNumber
                value={opt(perf?.cpuPct)}
                format={pctFmt}
                style={[
                  s.perfMetricValue,
                  {color: loadTierColor(theme, perf?.cpuPct)},
                ]}
              />
            </View>
            <View style={s.perfMetric}>
              <Text style={s.perfMetricLabel}>GPU</Text>
              <AnimatedNumber
                value={opt(perf?.gpuLoadPct)}
                format={pctFmt}
                style={[
                  s.perfMetricValue,
                  {color: loadTierColor(theme, perf?.gpuLoadPct)},
                ]}
              />
            </View>
            <View style={s.perfMetric}>
              <Text style={s.perfMetricLabel}>CPU频</Text>
              <AnimatedNumber
                value={opt(perf?.cpuFreqMhz)}
                format={freqFmt}
                style={[
                  s.perfMetricValue,
                  {
                    color: tierColor(
                      theme,
                      perf?.cpuFreqMhz != null && perf.cpuFreqMhz >= 0
                        ? perf.cpuFreqMhz / 1000
                        : undefined,
                      TIER_CPU_FREQ_G.warn,
                      TIER_CPU_FREQ_G.danger,
                      true,
                    ),
                  },
                ]}
              />
            </View>
            <View style={s.perfMetric}>
              <Text style={s.perfMetricLabel}>GPU频</Text>
              <AnimatedNumber
                value={opt(perf?.gpuFreqMhz)}
                format={n => `${Math.round(n)}M`}
                style={[
                  s.perfMetricValue,
                  {
                    color: tierColor(
                      theme,
                      perf?.gpuFreqMhz,
                      TIER_GPU_FREQ_M.warn,
                      TIER_GPU_FREQ_M.danger,
                      true,
                    ),
                  },
                ]}
              />
            </View>
            <View style={s.perfMetric}>
              <Text style={s.perfMetricLabel}>温度</Text>
              <AnimatedNumber
                value={opt(tempShown)}
                format={tempFmt}
                style={[
                  s.perfMetricValue,
                  {
                    color: tierColor(
                      theme,
                      tempShown,
                      TIER_TEMP.warn,
                      TIER_TEMP.danger,
                    ),
                  },
                ]}
              />
            </View>
            <View style={s.perfMetric}>
              <Text style={s.perfMetricLabel}>功耗</Text>
              <AnimatedNumber
                value={opt(perf?.powerMw)}
                format={powerFmt}
                style={[
                  s.perfMetricValue,
                  {
                    color: tierColor(
                      theme,
                      powerW,
                      TIER_POWER_W.warn,
                      TIER_POWER_W.danger,
                    ),
                  },
                ]}
              />
            </View>
            <View style={s.perfMetric}>
              <Text style={s.perfMetricLabel}>步耗时</Text>
              <AnimatedNumber
                value={stepTime > 0 ? stepTime : undefined}
                format={stepFmt}
                style={[
                  s.perfMetricValue,
                  {
                    color: tierColor(
                      theme,
                      stepTime > 0 ? stepTime : undefined,
                      TIER_STEP_S.warn,
                      TIER_STEP_S.danger,
                    ),
                  },
                ]}
              />
            </View>
            <TouchableOpacity
              style={s.perfHistoryBtn}
              onPress={() => setHistoryVisible(true)}
              testID="perf-history">
              <Text style={s.perfHistoryBtnText}>历史 ▷</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : null}
      <PerfHistoryModal
        visible={historyVisible}
        onClose={() => setHistoryVisible(false)}
      />
    </View>
  );
});
