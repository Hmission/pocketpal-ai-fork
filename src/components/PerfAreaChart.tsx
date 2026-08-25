/**
 * PerfAreaChart — 折线 + 渐变面积图（PERF_BENCHMARK_DESIGN §10.5，B39/B40 多层）
 *
 * 共享遥测折线组件，被生图页（PerfPanel）、聊天待回复卡（PendingIndicator）、
 * 回复卡展开层（AssistantTurnFooter）三处复用——单一事实源，故置于
 * components 共享层（B41：消除 components→screens 依赖倒置）。
 *
 * 满宽贴卡片缘、峰值点打标、PSS 叠加时绘制 5GB 逼近线（橙）与 6GB 硬杀线
 * （红）——阈值语义不变。
 *
 * B40 多层叠加：`series` 传入多条曲线规格（各自满量程归一 + 分色），
 * 一次看全 PSS/CPU/GPU/温度/功耗 的叠加走势（大王诉求：折线不止一层）。
 * 多层模式画彩色折线不画渐变面积（避免 5 层面积糊成一团）。
 *
 * 纪律：react-native-svg（既有依赖，零新增）；N/A 点落底不编造。
 */
import * as React from 'react';
import {View} from 'react-native';
import {
  Circle,
  Defs,
  Line,
  LinearGradient,
  Path,
  Polyline,
  Stop,
  Svg,
} from 'react-native-svg';

import type {PerfSnapshot} from '../specs/NativeHardwareInfo';

export type PerfOverlay = 'pss' | 'cpu' | 'gpu' | 'temp' | 'power';

/** 多层叠加的一条曲线规格：维度 + 颜色 + 满量程（归一用） */
export interface PerfSeriesSpec {
  key: PerfOverlay;
  color: string;
  max: number;
}

const overlayValueOf = (p: PerfSnapshot, o: PerfOverlay): number => {
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

const naOf = (v: number | undefined | null): boolean =>
  v === undefined || v === null || v < 0;

interface PerfAreaChartProps {
  history: PerfSnapshot[];
  overlay: PerfOverlay;
  /** 满量程（与面板 OVERLAY_MAX 同源） */
  max: number;
  /** 折线/面积主色（叠加维度色或 theme.primary） */
  color: string;
  /** PSS 阈值色（仅 pss 叠加时画逼近线/硬杀线） */
  warnColor: string;
  dangerColor: string;
  /** B40 多层叠加：非空时按各自满量程归一并分色画多条折线 */
  series?: PerfSeriesSpec[];
  height?: number;
  testID?: string;
}

/** 把一条序列归一成画布坐标点；N/A 落底（诚实，不插值编造） */
function buildPoints(
  history: PerfSnapshot[],
  key: PerfOverlay,
  max: number,
  width: number,
  height: number,
): Array<{x: number; y: number; v: number}> {
  const pts: Array<{x: number; y: number; v: number}> = [];
  const n = history.length;
  if (n <= 0 || width <= 0) {
    return pts;
  }
  const step = n > 1 ? width / (n - 1) : width;
  history.forEach((p, i) => {
    const v = overlayValueOf(p, key);
    const norm = naOf(v) ? 0 : Math.min(Math.max(v / max, 0), 1);
    pts.push({x: i * step, y: height - 2 - norm * (height - 6), v});
  });
  return pts;
}

const toPolyline = (pts: Array<{x: number; y: number}>): string =>
  pts.map(p => `${p.x},${p.y}`).join(' ');

export const PerfAreaChart: React.FC<PerfAreaChartProps> = ({
  history,
  overlay,
  max,
  color,
  warnColor,
  dangerColor,
  series,
  height = 60,
  testID,
}) => {
  const [width, setWidth] = React.useState(0);

  const multi = series && series.length > 0;
  // PSS 阈值线：单层 pss 模式，或多层中含 pss 时都画
  const showPssLines = multi
    ? series!.some(sp => sp.key === 'pss')
    : overlay === 'pss';

  // 单层模式的点（多层模式下不用）
  const singlePts = multi
    ? []
    : buildPoints(history, overlay, max, width, height);

  let singlePeak: {x: number; y: number} | null = null;
  if (!multi) {
    let peakV = -1;
    singlePts.forEach(p => {
      if (!naOf(p.v) && p.v > peakV) {
        peakV = p.v;
        singlePeak = {x: p.x, y: p.y};
      }
    });
  }

  const gradId = `perf-grad-${overlay}`;
  const singleAreaPath =
    !multi && singlePts.length > 1
      ? `M ${toPolyline(singlePts)} L ${singlePts[singlePts.length - 1].x},${height} L ${singlePts[0].x},${height} Z`
      : '';

  return (
    <View
      style={{height, width: '100%'}}
      onLayout={e => setWidth(e.nativeEvent.layout.width)}
      testID={testID}>
      {width > 0 && history.length > 1 ? (
        <Svg width={width} height={height}>
          {!multi ? (
            <Defs>
              <LinearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={color} stopOpacity={0.32} />
                <Stop offset="1" stopColor={color} stopOpacity={0.02} />
              </LinearGradient>
            </Defs>
          ) : null}
          {showPssLines ? (
            <>
              {/* 5GB 逼近线（橙）：满量程 6GB → y = H-2-(5/6)*(H-6) */}
              <Line
                x1={0}
                x2={width}
                y1={height - 2 - (5 / 6) * (height - 6)}
                y2={height - 2 - (5 / 6) * (height - 6)}
                stroke={warnColor}
                strokeWidth={1}
                strokeDasharray="4 3"
                opacity={0.8}
              />
              {/* 6GB 硬杀线（红，满量程顶） */}
              <Line
                x1={0}
                x2={width}
                y1={2}
                y2={2}
                stroke={dangerColor}
                strokeWidth={1}
                strokeDasharray="4 3"
                opacity={0.9}
              />
            </>
          ) : null}
          {multi ? (
            // B40 多层叠加：每条曲线各自满量程归一 + 分色
            series!.map(sp => (
              <Polyline
                key={sp.key}
                points={toPolyline(
                  buildPoints(history, sp.key, sp.max, width, height),
                )}
                fill="none"
                stroke={sp.color}
                strokeWidth={1.4}
                opacity={0.9}
              />
            ))
          ) : (
            <>
              <Path d={singleAreaPath} fill={`url(#${gradId})`} stroke="none" />
              <Polyline
                points={toPolyline(singlePts)}
                fill="none"
                stroke={color}
                strokeWidth={1.5}
              />
              {singlePeak ? (
                <Circle
                  cx={(singlePeak as {x: number}).x}
                  cy={(singlePeak as {y: number}).y}
                  r={2.5}
                  fill={color}
                />
              ) : null}
            </>
          )}
        </Svg>
      ) : null}
    </View>
  );
};
