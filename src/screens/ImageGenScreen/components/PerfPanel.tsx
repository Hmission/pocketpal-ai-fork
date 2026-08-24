/**
 * PerfPanel — 专业跑分式性能面板（ADR-0008 + PERF_BENCHMARK_DESIGN v0.2/v0.5）
 *
 * 嵌于预览卡片下半截的**横版紧凑布局**（大王裁定）：
 *  - 折叠头一行：性能▾ + PSS 大字（阈值色）+ 指标胶囊（CPU/GPU/温/功耗）
 *  - 展开体：折线渐变面积图（B39 替代条形图，峰值打标 + 5/6GB 阈值线）
 *    + 横向指标行（频率/分区温度/功耗/步耗时）+ 历史入口
 *  - 设备小字：SoC 型号（挂载时一次性拉取）；NPU 利用率无标准 API → 诚实模式（不编造）
 * B39 演出层：全数字接 AnimatedNumber 追式缓动；胶囊负载分档变色；
 * 数据链（syncPoll/perfRecorder）零改动。-1 = 原生侧 N/A → 显 `--`。
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
import {AnimatedNumber} from '../../../components/PerfMotion';
import {createStyles} from '../styles';
import {PerfHistoryModal} from './PerfHistoryModal';
import {PerfAreaChart, type PerfOverlay} from './PerfAreaChart';

/** 阈值：>5GB 橙（逼近）/ >6GB 红（HyperOS 看护硬杀线，K90 实测 6291456kb） */
const PERF_WARN_KB = 5 * 1024 * 1024;
const PERF_DANGER_KB = 6 * 1024 * 1024;
/** 语义色登记（IMAGEGEN_UI_SPEC §9）：warning=橙 */
const PERF_WARN_COLOR = '#F5A623';

/** 叠加线维度：PSS 主图 + CPU/GPU/温度/功耗切换（各自满量程归一） */
type Overlay = PerfOverlay;
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

/** -1/无效 → '--'（原生侧 N/A 统一表达）；opt 把 N/A 归一为 undefined 供 AnimatedNumber */
const na = (v: number | undefined | null): boolean =>
  v === undefined || v === null || v < 0;
const opt = (v: number | undefined | null): number | undefined =>
  na(v) ? undefined : (v as number);
// AnimatedNumber 格式化器（同源格式，演出层不改数值）
const pctFmt = (n: number) => `${Math.round(n)}%`;
const tempFmt = (n: number) => `${Math.round(n)}°C`;
const powerFmt = (n: number) => `${(n / 1000).toFixed(1)}W`;
const freqFmt = (n: number) => `${(n / 1000).toFixed(1)}GHz`;
const gbFmt = (n: number) => `${n.toFixed(1)} GB`;
const stepFmt = (n: number) => `${n.toFixed(1)}s`;

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

  // 胶囊负载分档变色（B39）：>=85 红 / >=60 橙 / 否则继承中性（显示层不改数值）
  const loadTierColor = (v: number | undefined) =>
    na(v)
      ? undefined
      : v! >= 85
        ? theme.colors.error
        : v! >= 60
          ? PERF_WARN_COLOR
          : undefined;
  // 分区温度归一（保持既有选取链：GPU 区 → CPU 区 → 整机）
  const tempShown = !na(perf?.tempGpuC)
    ? perf!.tempGpuC
    : !na(perf?.tempCpuC)
      ? perf!.tempCpuC
      : perf?.tempC;

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
                style={{color: loadTierColor(perf?.cpuPct)}}
              />
            </Text>
          </View>
          <View style={s.perfCapsule} testID="perf-gpu">
            <Text style={s.perfCapsuleText}>
              GPU{' '}
              <AnimatedNumber
                value={opt(perf?.gpuLoadPct)}
                format={pctFmt}
                style={{color: loadTierColor(perf?.gpuLoadPct)}}
              />
            </Text>
          </View>
          <View style={s.perfCapsule} testID="perf-temp">
            <Text style={s.perfCapsuleText}>
              <AnimatedNumber value={opt(perf?.tempC)} format={tempFmt} />
            </Text>
          </View>
          <View style={s.perfCapsule}>
            <Text style={s.perfCapsuleText}>
              <AnimatedNumber value={opt(perf?.powerMw)} format={powerFmt} />
            </Text>
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
          {/* 折线 + 渐变面积图（B39）：满宽贴卡片缘、峰值打标、5/6GB 阈值虚线 */}
          <View style={s.perfMiniChart}>
            <PerfAreaChart
              history={perfHistory}
              overlay={overlay}
              max={OVERLAY_MAX[overlay]}
              color={barColor ?? theme.colors.primary}
              warnColor={PERF_WARN_COLOR}
              dangerColor={theme.colors.error}
              testID="perf-area-chart"
            />
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
              <AnimatedNumber
                value={opt(perf?.cpuPct)}
                format={pctFmt}
                style={[s.perfMetricValue, {color: loadTierColor(perf?.cpuPct)}]}
              />
            </View>
            <View style={s.perfMetric}>
              <Text style={s.perfMetricLabel}>GPU</Text>
              <AnimatedNumber
                value={opt(perf?.gpuLoadPct)}
                format={pctFmt}
                style={[
                  s.perfMetricValue,
                  {color: loadTierColor(perf?.gpuLoadPct)},
                ]}
              />
            </View>
            <View style={s.perfMetric}>
              <Text style={s.perfMetricLabel}>CPU频</Text>
              <AnimatedNumber
                value={opt(perf?.cpuFreqMhz)}
                format={freqFmt}
                style={s.perfMetricValue}
              />
            </View>
            <View style={s.perfMetric}>
              <Text style={s.perfMetricLabel}>GPU频</Text>
              <AnimatedNumber
                value={opt(perf?.gpuFreqMhz)}
                format={n => `${Math.round(n)}M`}
                style={s.perfMetricValue}
              />
            </View>
            <View style={s.perfMetric}>
              <Text style={s.perfMetricLabel}>温度</Text>
              <AnimatedNumber
                value={opt(tempShown)}
                format={tempFmt}
                style={s.perfMetricValue}
              />
            </View>
            <View style={s.perfMetric}>
              <Text style={s.perfMetricLabel}>功耗</Text>
              <AnimatedNumber
                value={opt(perf?.powerMw)}
                format={powerFmt}
                style={s.perfMetricValue}
              />
            </View>
            <View style={s.perfMetric}>
              <Text style={s.perfMetricLabel}>步耗时</Text>
              <AnimatedNumber
                value={stepTime > 0 ? stepTime : undefined}
                format={stepFmt}
                style={s.perfMetricValue}
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
