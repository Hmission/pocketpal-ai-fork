/**
 * PerfAreaChart — 折线 + 渐变面积图（PERF_BENCHMARK_DESIGN §10.5，B39）
 *
 * 替代 v0.2 的 40pt 条形迷你图：满宽贴卡片缘、峰值点打标、
 * PSS 叠加时绘制 5GB 逼近线（橙）与 6GB 硬杀线（红）——阈值语义不变。
 * 纪律：react-native-svg（既有依赖，零新增）；数据经 imageGenStore
 * 单通道；N/A 点落底不编造。
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

import type {PerfSnapshot} from '../../../specs/NativeHardwareInfo';

export type PerfOverlay = 'pss' | 'cpu' | 'gpu' | 'temp' | 'power';

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
  height?: number;
  testID?: string;
}

export const PerfAreaChart: React.FC<PerfAreaChartProps> = ({
  history,
  overlay,
  max,
  color,
  warnColor,
  dangerColor,
  height = 60,
  testID,
}) => {
  const [width, setWidth] = React.useState(0);

  const pts: Array<{x: number; y: number; v: number}> = [];
  const n = history.length;
  if (n > 0 && width > 0) {
    const step = n > 1 ? width / (n - 1) : width;
    history.forEach((p, i) => {
      const v = overlayValueOf(p, overlay);
      // N/A 落底（诚实，不插值编造）
      const norm = naOf(v) ? 0 : Math.min(Math.max(v / max, 0), 1);
      pts.push({x: i * step, y: height - 2 - norm * (height - 6), v});
    });
  }

  // 峰值点打标（有效值中的最大值）
  let peak: {x: number; y: number} | null = null;
  let peakV = -1;
  pts.forEach(p => {
    if (!naOf(p.v) && p.v > peakV) {
      peakV = p.v;
      peak = {x: p.x, y: p.y};
    }
  });

  const polylinePoints = pts.map(p => `${p.x},${p.y}`).join(' ');
  const areaPath =
    pts.length > 1
      ? `M ${pts.map(p => `${p.x},${p.y}`).join(' L ')} L ${
          pts[pts.length - 1].x
        },${height} L ${pts[0].x},${height} Z`
      : '';

  const gradId = `perf-grad-${overlay}`;

  return (
    <View
      style={{height, width: '100%'}}
      onLayout={e => setWidth(e.nativeEvent.layout.width)}
      testID={testID}>
      {width > 0 && pts.length > 1 ? (
        <Svg width={width} height={height}>
          <Defs>
            <LinearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={color} stopOpacity={0.32} />
              <Stop offset="1" stopColor={color} stopOpacity={0.02} />
            </LinearGradient>
          </Defs>
          {overlay === 'pss' ? (
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
          <Path d={areaPath} fill={`url(#${gradId})`} stroke="none" />
          <Polyline
            points={polylinePoints}
            fill="none"
            stroke={color}
            strokeWidth={1.5}
          />
          {peak ? (
            <Circle
              cx={(peak as {x: number}).x}
              cy={(peak as {y: number}).y}
              r={2.5}
              fill={color}
            />
          ) : null}
        </Svg>
      ) : null}
    </View>
  );
};
