/**
 * PerfMiniRow — 紧凑遥测条（PERF_BENCHMARK_DESIGN v1.3，2026-08-26）
 *
 * 叠图模式（反推/编辑/放大 overlay）与聊天待回复卡（PendingIndicator）共用的
 * 迷你跑分形态（大王裁定「叠图迷你遥测条」，与 PendingIndicator 同形态）：
 *  - 折叠头一行：「性能 ▾/▴ + PSS 大字（阈值色）+ 内存/CPU/温度胶囊（分级色）」
 *  - 展开体：B43 演出层迷你折线（PSS 主色 + CPU 青双线 + 温度热力带 + 坐标轴 +
 *    阈值虚线 5/6GB 端点标注 + vivid 呼吸光圈/彗星尾/扫掠光）
 * 数据源经 props 注入（imageGenStore.perfHistory / PendingIndicator 自采样 history），
 * 最新点即当前值（不造假，N/A 诚实显 '--'）。
 * 阈值/格式器单一事实源：utils/perfTiers（IMAGEGEN_UI_SPEC §9 语义色注册表）。
 */
import * as React from 'react';
import {Text, TouchableOpacity, View} from 'react-native';

import {useTheme} from '../../hooks/useTheme';
import {AnimatedNumber} from '../PerfMotion';
import {PerfAreaChart, type PerfSeriesSpec} from '../PerfAreaChart';
import type {PerfSnapshot} from '../../specs/NativeHardwareInfo';
import {
  PERF_DANGER_KB,
  PERF_WARN_COLOR,
  PERF_CPU_COLOR,
  TIER_TEMP,
  na,
  opt,
  tierColor,
  loadTierColor,
  pssColorOf,
  pctFmt,
  tempFmt,
  gbTinyFmt,
  yTickGbFmt,
} from '../../utils/perfTiers';

import {createStyles} from './styles';

export interface PerfMiniRowProps {
  /** 1Hz 滚动缓冲（最近 60 点）；最新点 = 当前值；空数组 → 全部 '--' */
  history: PerfSnapshot[];
  /** 主色（PSS 折线/大字正常阈值色）；缺省 theme.colors.primary */
  color?: string;
  /** 默认展开（聊天卡 true 保持数据密度；叠图 overlay false 少遮挡原图） */
  defaultExpanded?: boolean;
  /** 折线高度（默认 48；聊天卡可加高到 56） */
  chartHeight?: number;
  /** testID 前缀（PendingIndicator 传 'pending-indicator' 兼容既有断言） */
  testIDPrefix?: string;
}

export const PerfMiniRow: React.FC<PerfMiniRowProps> = ({
  history,
  color,
  defaultExpanded = true,
  chartHeight = 48,
  testIDPrefix = 'perf-mini',
}) => {
  const theme = useTheme();
  const s = createStyles(theme);
  const [expanded, setExpanded] = React.useState(defaultExpanded);

  const latest = history.length > 0 ? history[history.length - 1] : undefined;
  const pssKb = latest?.pssKb;
  const mainColor = color ?? theme.colors.primary;
  const pssColor = pssColorOf(theme, pssKb ?? 0, mainColor);
  // 分区温度归一（与 PerfPanel 同选取链：GPU 区 → CPU 区 → 整机）
  const tempShown = latest
    ? !na(latest.tempGpuC)
      ? latest.tempGpuC
      : !na(latest.tempCpuC)
        ? latest.tempCpuC
        : latest.tempC
    : undefined;

  // B43 双线：PSS 主色 + CPU 青（温度走热力带不占线；与 PerfPanel 叠全同通道语义）
  const series: PerfSeriesSpec[] = [
    {key: 'pss', color: mainColor, max: PERF_DANGER_KB},
    {key: 'cpu', color: PERF_CPU_COLOR, max: 100},
  ];

  return (
    <View style={s.root} testID={`${testIDPrefix}-telemetry`}>
      {/* 折叠头一行：性能 + PSS 大字 + 指标胶囊 */}
      <TouchableOpacity
        style={s.foldRow}
        onPress={() => setExpanded(v => !v)}
        activeOpacity={0.7}
        testID={`${testIDPrefix}-perf-toggle`}>
        <Text style={s.foldTitle}>性能 {expanded ? '▴' : '▾'}</Text>
        <AnimatedNumber
          value={opt(pssKb)}
          format={gbTinyFmt}
          style={[s.pssBig, {color: pssColor}]}
          testID={`${testIDPrefix}-pss`}
        />
        <View style={s.capsuleRow}>
          <View style={s.capsule}>
            <Text style={s.capsuleText}>
              <AnimatedNumber
                value={opt(pssKb)}
                format={gbTinyFmt}
                style={{color: loadTierColor(theme, pssKb)}}
              />
            </Text>
          </View>
          <View style={s.capsule}>
            <Text style={s.capsuleText}>
              CPU{' '}
              <AnimatedNumber
                value={opt(latest?.cpuPct)}
                format={pctFmt}
                style={{color: loadTierColor(theme, latest?.cpuPct)}}
              />
            </Text>
          </View>
          <View style={s.capsule}>
            <Text style={s.capsuleText}>
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
        </View>
      </TouchableOpacity>
      {/* 展开体：B43 演出层迷你折线（双线 + 热力带 + 坐标轴 + 阈值标注） */}
      {expanded ? (
        <View style={s.chartWrap} testID={`${testIDPrefix}-chart`}>
          <PerfAreaChart
            history={history}
            overlay="pss"
            max={PERF_DANGER_KB}
            color={mainColor}
            warnColor={PERF_WARN_COLOR}
            dangerColor={theme.colors.error}
            series={series}
            tempBand
            axes
            yTick={yTickGbFmt}
            vivid
            axisColor={theme.colors.onSurfaceVariant}
            height={chartHeight}
            testID={`${testIDPrefix}-area-chart`}
          />
        </View>
      ) : null}
    </View>
  );
};
