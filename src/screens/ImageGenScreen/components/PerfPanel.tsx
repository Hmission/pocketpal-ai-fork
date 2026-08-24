/**
 * PerfPanel — 专业跑分式性能面板（ADR-0008 + PERF_BENCHMARK_DESIGN v0.2）
 *
 * 嵌于预览卡片下半截的**横版紧凑布局**（大王裁定）：
 *  - 折叠头一行：性能▾ + PSS 大字（阈值色）+ 指标胶囊（CPU/GPU/温/功耗）
 *  - 展开体：迷你曲线条（叠加线切换）+ 横向指标行（频率/分区温度/功耗/步耗时）+ 历史入口
 *  - 设备小字：SoC 型号（挂载时一次性拉取）；NPU 利用率无标准 API → 诚实模式（不编造）
 * 数据经 imageGenStore 单通道；-1 = 原生侧 N/A → 显 `--`（不报错不兜底）。
 * 语义色登记：IMAGEGEN_UI_SPEC §9（PERF_WARN 橙 #F5A623，>6GB 用 theme.colors.error）。
 */
import * as React from 'react';
import {ScrollView, Text, TouchableOpacity, View} from 'react-native';
import {observer} from 'mobx-react-lite';

import NativeHardwareInfo, {
  type PerfSnapshot,
} from '../../../specs/NativeHardwareInfo';
import {imageGenStore} from '../../../store/imageGenStore';
import {useTheme} from '../../../hooks';
import {createStyles} from '../styles';
import {PerfHistoryModal} from './PerfHistoryModal';

/** 阈值：>5GB 橙（逼近）/ >6GB 红（HyperOS 看护硬杀线，K90 实测 6291456kb） */
const PERF_WARN_KB = 5 * 1024 * 1024;
const PERF_DANGER_KB = 6 * 1024 * 1024;
/** 语义色登记（IMAGEGEN_UI_SPEC §9）：warning=橙 */
const PERF_WARN_COLOR = '#F5A623';
const CHART_HEIGHT = 40;

/** 叠加线维度：PSS 主图 + CPU/GPU/温度/功耗切换（各自满量程归一） */
type Overlay = 'pss' | 'cpu' | 'gpu' | 'temp' | 'power';
const OVERLAY_LABEL: Record<Overlay, string> = {
  pss: 'PSS',
  cpu: 'CPU',
  gpu: 'GPU',
  temp: '温度',
  power: '功耗',
};
const OVERLAY_MAX: Record<Overlay, number> = {
  pss: PERF_DANGER_KB,
  cpu: 100,
  gpu: 100,
  temp: 60,
  power: 10000,
};
const OVERLAY_COLOR: Record<Overlay, string> = {
  pss: '', // 走 theme.primary（阈值色另行）
  cpu: '#4FC3F7',
  gpu: '#81C784',
  temp: '#F5A623',
  power: '#BA68C8',
};

const overlayValue = (p: PerfSnapshot, o: Overlay): number => {
  switch (o) {
    case 'pss':
      return p.pssKb;
    case 'cpu':
      return p.cpuPct;
    case 'gpu':
      return p.gpuLoadPct ?? -1;
    case 'temp':
      return p.tempC;
    case 'power':
      return p.powerMw ?? -1;
  }
};

/** -1/无效 → '--'（原生侧 N/A 统一表达） */
const na = (v: number | undefined | null): boolean =>
  v === undefined || v === null || v < 0;
const fmtPct = (v: number | undefined) => (na(v) ? '--' : `${Math.round(v!)}%`);
const fmtTemp = (v: number | undefined) => (na(v) ? '--' : `${Math.round(v!)}°C`);
const fmtPower = (v: number | undefined) =>
  na(v) ? '--' : `${(v! / 1000).toFixed(1)}W`;
const fmtFreq = (v: number | undefined) =>
  na(v) ? '--' : `${(v! / 1000).toFixed(1)}GHz`;

export const PerfPanel: React.FC = observer(() => {
  const theme = useTheme();
  const s = createStyles(theme);
  const [expanded, setExpanded] = React.useState(true);
  const [overlay, setOverlay] = React.useState<Overlay>('pss');
  const [historyVisible, setHistoryVisible] = React.useState(false);
  // 设备小字：SoC 型号（静态数据，挂载拉一次；NPU 型号无公开字段，诚实省略）
  const [socModel, setSocModel] = React.useState('');
  React.useEffect(() => {
    NativeHardwareInfo.getChipset?.()
      .then(m => setSocModel(m))
      .catch(() => {});
  }, []);

  const {perf, perfHistory, stepTime} = imageGenStore;
  const pssKb = perf?.pssKb ?? 0;
  const pssColor =
    pssKb > PERF_DANGER_KB
      ? theme.colors.error
      : pssKb > PERF_WARN_KB
        ? PERF_WARN_COLOR
        : theme.colors.primary;
  const peakPss = perfHistory.reduce((m, p) => Math.max(m, p.pssKb), 0);

  const barColor =
    overlay === 'pss' ? undefined : OVERLAY_COLOR[overlay] || theme.colors.primary;

  return (
    <View style={s.perfPanel} testID="perf-panel">
      {/* 折叠头一行：性能▾ + PSS 大字 + 指标胶囊 */}
      <TouchableOpacity
        style={s.perfHeader}
        onPress={() => setExpanded(v => !v)}
        testID="perf-expand"
        activeOpacity={0.7}>
        <Text style={s.perfTitle}>性能 {expanded ? '▴' : '▾'}</Text>
        <Text style={[s.perfPssBig, {color: pssColor}]} testID="perf-pss">
          {perf ? `${(pssKb / 1024 / 1024).toFixed(1)} GB` : '--'}
        </Text>
        <View style={s.perfCapsuleRow}>
          <View style={s.perfCapsule} testID="perf-cpu">
            <Text style={s.perfCapsuleText}>CPU {fmtPct(perf?.cpuPct)}</Text>
          </View>
          <View style={s.perfCapsule} testID="perf-gpu">
            <Text style={s.perfCapsuleText}>GPU {fmtPct(perf?.gpuLoadPct)}</Text>
          </View>
          <View style={s.perfCapsule} testID="perf-temp">
            <Text style={s.perfCapsuleText}>{fmtTemp(perf?.tempC)}</Text>
          </View>
          <View style={s.perfCapsule}>
            <Text style={s.perfCapsuleText}>{fmtPower(perf?.powerMw)}</Text>
          </View>
        </View>
      </TouchableOpacity>
      {socModel ? (
        <Text style={s.perfDeviceNote} numberOfLines={1}>
          {socModel}
        </Text>
      ) : null}
      {expanded ? (
        <View style={s.perfBody}>
          {/* 叠加线切换 chips + 峰值 */}
          <View style={s.perfOverlayRow}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={s.perfChipsScroll}>
              {(Object.keys(OVERLAY_LABEL) as Overlay[]).map(o => (
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
          {/* 迷你曲线条（按叠加维度归一，40pt 高） */}
          <View style={s.perfMiniChart}>
            {perfHistory.map((p, i) => {
              const v = overlayValue(p, overlay);
              const h = na(v)
                ? 2
                : Math.max(3, (v / OVERLAY_MAX[overlay]) * CHART_HEIGHT);
              const warn = overlay === 'pss' && p.pssKb > PERF_WARN_KB;
              return (
                <View
                  key={i}
                  style={[
                    s.perfBar,
                    {
                      height: h,
                      backgroundColor: warn
                        ? PERF_WARN_COLOR
                        : barColor ?? theme.colors.primary,
                    },
                  ]}
                />
              );
            })}
            {perfHistory.length === 0 ? (
              <Text style={s.perfChartEmpty}>--</Text>
            ) : null}
          </View>
          {/* 指标行（自适应换行网格）+ 历史入口：
              不再横向滚动——7 项指标 + 历史按钮在卡片宽度内折行，
              全部可见（根治「最底下一行显示不全」）。 */}
          <View
            style={s.perfMetricsRow}
            testID="perf-metrics">
            <View style={s.perfMetric}>
              <Text style={s.perfMetricLabel}>CPU</Text>
              <Text style={s.perfMetricValue}>{fmtPct(perf?.cpuPct)}</Text>
            </View>
            <View style={s.perfMetric}>
              <Text style={s.perfMetricLabel}>GPU</Text>
              <Text style={s.perfMetricValue}>{fmtPct(perf?.gpuLoadPct)}</Text>
            </View>
            <View style={s.perfMetric}>
              <Text style={s.perfMetricLabel}>CPU频</Text>
              <Text style={s.perfMetricValue}>{fmtFreq(perf?.cpuFreqMhz)}</Text>
            </View>
            <View style={s.perfMetric}>
              <Text style={s.perfMetricLabel}>GPU频</Text>
              <Text style={s.perfMetricValue}>
                {na(perf?.gpuFreqMhz) ? '--' : `${Math.round(perf!.gpuFreqMhz!)}M`}
              </Text>
            </View>
            <View style={s.perfMetric}>
              <Text style={s.perfMetricLabel}>温度</Text>
              <Text style={s.perfMetricValue}>
                {fmtTemp(
                  !na(perf?.tempGpuC)
                    ? perf!.tempGpuC
                    : !na(perf?.tempCpuC)
                      ? perf!.tempCpuC
                      : perf?.tempC,
                )}
              </Text>
            </View>
            <View style={s.perfMetric}>
              <Text style={s.perfMetricLabel}>功耗</Text>
              <Text style={s.perfMetricValue}>{fmtPower(perf?.powerMw)}</Text>
            </View>
            <View style={s.perfMetric}>
              <Text style={s.perfMetricLabel}>步耗时</Text>
              <Text style={s.perfMetricValue}>
                {stepTime > 0 ? `${stepTime.toFixed(1)}s` : '--'}
              </Text>
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
