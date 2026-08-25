/**
 * PerfAreaChart — 折线 + 渐变面积图（PERF_BENCHMARK_DESIGN §10.5，B39/B40 多层）
 *
 * 共享遥测折线组件，被生图页（PerfPanel）、聊天待回复卡（PendingIndicator）、
 * 回复卡展开层（AssistantTurnFooter）三处复用——单一事实源，故置于
 * components 共享层（B41：消除 components→screens 依赖倒置）。
 *
 * 图表能力分层（新 props 全部可选，不传时行为与 B40 完全一致，聊天页零回归）：
 *  - axes：左 Y 轴刻度（按维度单位）+ 底部 X 轴时间刻度（真实 ts 差值）+ 网格线
 *  - bars：柱状系列（画布底部柱区，叠全模式 CPU/GPU 负载用柱状呈现）
 *  - tempBand：温度热力带（画布底 2px 渐变带，30→60°C 绿→橙→红）——
 *    温度从折线改色带后与 PSS 主曲线（同橙）不再同屏撞色
 *  - vivid：演出层（最新点呼吸光圈 + 彗星尾 + 示波器扫掠光，JS driver 循环动画）
 *  - legend：底部图例行（色点+名称，解决「紫色线/虚线是什么」的可读性问题）
 *
 * 阈值线语义不变：PSS 叠加时画 5GB 逼近线（橙）与 6GB 硬杀线（红），
 * axes 开启时端点加迷你文字标注（5GB/6GB）。
 *
 * 纪律：react-native-svg（既有依赖，零新增）；N/A 点落底不编造；
 * 演出动画一律 Animated JS driver（全局规范）。
 */
import * as React from 'react';
import {Animated, Easing, View} from 'react-native';
import {
  Circle,
  Defs,
  Line,
  LinearGradient,
  Path,
  Polyline,
  Rect,
  Stop,
  Svg,
  Text as SvgText,
} from 'react-native-svg';

import type {PerfSnapshot} from '../specs/NativeHardwareInfo';

export type PerfOverlay = 'pss' | 'cpu' | 'gpu' | 'temp' | 'power';

/** 多层叠加的一条折线规格：维度 + 颜色 + 满量程（归一用） */
export interface PerfSeriesSpec {
  key: PerfOverlay;
  color: string;
  max: number;
}

/** 复合图柱状规格（叠全模式 CPU/GPU 负载，柱区贴画布底部） */
export interface PerfBarSpec {
  key: PerfOverlay;
  color: string;
  max: number;
}

/** Y 轴刻度文本：frac=0..1（满量程比例），max=维度满量程 */
export type YTickFormatter = (frac: number, max: number) => string;

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

// ── 布局常量（axes 开启时的坐标系）──
const AXIS_L = 24; // 左轴刻度区宽
const PAD_T = 6; // 顶部留白（阈值线/顶部刻度呼吸）
const X_LABEL_H = 14; // 底部 X 轴时间文字区高
const BAND_H = 2; // 温度热力带高
const BAR_H = 12; // 柱状区高

// ── 演出层（vivid）：JS driver 循环动画组件 ──
const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const AnimatedLine = Animated.createAnimatedComponent(Line);

// 温度热力带色点：30°C 绿 → 45°C 橙 → 60°C 红（三段插值，不造新色：复用 GPU 绿/PERF_WARN/error）
const TEMP_LOW = '#81C784';
const TEMP_MID = '#F5A623';
const TEMP_HIGH = '#FF653F';

const lerpHex = (a: string, b: string, k: number): string => {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const r = Math.round(((pa >> 16) & 0xff) + (((pb >> 16) & 0xff) - ((pa >> 16) & 0xff)) * k);
  const g = Math.round(((pa >> 8) & 0xff) + (((pb >> 8) & 0xff) - ((pa >> 8) & 0xff)) * k);
  const bl = Math.round((pa & 0xff) + ((pb & 0xff) - (pa & 0xff)) * k);
  return `#${((r << 16) | (g << 8) | bl).toString(16).padStart(6, '0')}`;
};

const tempBandColor = (t: number): string => {
  const c = Math.max(30, Math.min(60, t));
  return c <= 45 ? lerpHex(TEMP_LOW, TEMP_MID, (c - 30) / 15) : lerpHex(TEMP_MID, TEMP_HIGH, (c - 45) / 15);
};

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
  /** 柱状系列（叠全复合图：CPU/GPU 负载） */
  bars?: PerfBarSpec[];
  /** 温度热力带（叠全复合图：温度改色带，与 PSS 折线不再撞色） */
  tempBand?: boolean;
  /** 坐标轴（Y 刻度 + X 时间刻度 + 网格 + 阈值线标注）；默认关（聊天页视觉零回归） */
  axes?: boolean;
  /** Y 轴刻度文本格式器（axes 开启时生效） */
  yTick?: YTickFormatter;
  /** 演出层：呼吸光圈 + 彗星尾 + 扫掠光 */
  vivid?: boolean;
  /** 坐标轴/文字颜色（默认中性灰，可传 theme.onSurfaceVariant 弱化） */
  axisColor?: string;
  height?: number;
  testID?: string;
}

/** 把一条序列归一成画布坐标点；N/A 落底（诚实，不插值编造）
 *  公式与原版等价：y = bottom - 2 - norm×(h-6)，axes 关闭时聊天页视觉零回归 */
function buildPoints(
  history: PerfSnapshot[],
  key: PerfOverlay,
  max: number,
  width: number,
  x0: number,
  plotBottom: number,
  plotH: number,
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
    pts.push({
      x: x0 + i * step,
      y: plotBottom - 2 - norm * (plotH - 6),
      v,
    });
  });
  return pts;
}

const toPolyline = (pts: Array<{x: number; y: number}>): string =>
  pts.map(p => `${p.x},${p.y}`).join(' ');

/** 主曲线（单层=overlay；多层=series[0]）——演出层锚点 */
const lastValid = (
  pts: Array<{x: number; y: number; v: number}>,
): {x: number; y: number} | null => {
  for (let i = pts.length - 1; i >= 0; i--) {
    if (!naOf(pts[i].v)) {
      return {x: pts[i].x, y: pts[i].y};
    }
  }
  return null;
};

export const PerfAreaChart: React.FC<PerfAreaChartProps> = ({
  history,
  overlay,
  max,
  color,
  warnColor,
  dangerColor,
  series,
  bars,
  tempBand = false,
  axes = false,
  yTick,
  vivid = false,
  axisColor = '#9E9E9E',
  height = 60,
  testID,
}) => {
  const [width, setWidth] = React.useState(0);

  const multi = series && series.length > 0;
  // PSS 阈值线：单层 pss 模式，或多层中含 pss 时都画
  const showPssLines = multi
    ? series!.some(sp => sp.key === 'pss')
    : overlay === 'pss';

  // 坐标系：axes 关闭时保持 B40 满宽贴缘布局（聊天页零回归）
  const x0 = axes ? AXIS_L : 0;
  const plotW = width - x0;
  const bandY = height - X_LABEL_H - BAND_H;
  const barBottom = tempBand ? bandY : height;
  const plotBottom = bars && bars.length > 0 ? barBottom - BAR_H : barBottom;
  // 顶部留白仅 axes 时生效（供 6GB 标注呼吸）；非 axes 时 plotTop=0 →
  // plotH=height → 公式还原为原版 height-2-norm×(height-6)，聊天页视觉零回归
  const plotTop = axes ? PAD_T : 0;
  const plotH = plotBottom - plotTop;
  // 阈值线 y（与 buildPoints 同公式：norm=5/6、1；范围 plotTop+4 ~ plotBottom-2）
  const yOf = (norm: number) => plotBottom - 2 - norm * (plotH - 6);
  const warnY = yOf(5 / 6);
  const dangerY = yOf(1);

  // 单层模式的点（多层模式下不用）
  const singlePts = multi
    ? []
    : buildPoints(history, overlay, max, plotW, x0, plotBottom, plotH);

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

  // 主曲线（演出层锚点）：多层=series[0]，单层=overlay 曲线
  const mainColor = multi ? series![0].color : color;
  const mainPts = multi
    ? buildPoints(history, series![0].key, series![0].max, plotW, x0, plotBottom, plotH)
    : singlePts;
  const mainLast = lastValid(mainPts);
  // 彗星尾：主曲线尾部渐隐拖尾（最后 8 点淡、最后 3 点稍亮）
  const validPts = mainPts.filter(p => !naOf(p.v));
  const tail1 = validPts.slice(-8);
  const tail2 = validPts.slice(-3);
  const hasTail = validPts.length > 1;

  const gradId = `perf-grad-${overlay}`;
  const singleAreaPath =
    !multi && singlePts.length > 1
      ? `M ${toPolyline(singlePts)} L ${singlePts[singlePts.length - 1].x},${plotBottom} L ${singlePts[0].x},${plotBottom} Z`
      : '';

  // ── 演出层动画（vivid 才启动；数据流 1Hz 更新不重置动画实例）──
  const pulse = React.useRef(new Animated.Value(0)).current;
  const sweep = React.useRef(new Animated.Value(0)).current;
  React.useEffect(() => {
    if (!vivid) {
      return;
    }
    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 850,
          easing: Easing.out(Easing.quad),
          useNativeDriver: false,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 850,
          easing: Easing.in(Easing.quad),
          useNativeDriver: false,
        }),
      ]),
    );
    const sweepLoop = Animated.loop(
      Animated.timing(sweep, {
        toValue: 1,
        duration: 3400,
        easing: Easing.linear,
        useNativeDriver: false,
      }),
    );
    pulseLoop.start();
    sweepLoop.start();
    return () => {
      pulseLoop.stop();
      sweepLoop.stop();
    };
  }, [vivid, pulse, sweep]);

  const pulseR = pulse.interpolate({inputRange: [0, 1], outputRange: [3, 7]});
  const pulseO = pulse.interpolate({inputRange: [0, 1], outputRange: [0.65, 0.08]});
  const sweepX = sweep.interpolate({
    inputRange: [0, 1],
    outputRange: [x0 + 2, width - 2],
  });
  const sweepO = sweep.interpolate({
    inputRange: [0, 0.7, 0.85, 1],
    outputRange: [0.1, 0.22, 0.3, 0.1],
  });

  // ── X 轴时间刻度（1Hz 采样契约，索引差=相对秒数，不编造）：0 / 1/3 / 2/3 / 末尾 ──
  const xTicks: Array<{frac: number; label: string; anchor: 'start' | 'middle' | 'end'}> =
    axes && history.length > 1
      ? [0, 1 / 3, 2 / 3, 1].map((f, i) => {
          const idx = Math.round(f * (history.length - 1));
          const secAgo = history.length - 1 - idx; // 1Hz 采样，索引差即秒数
          return {
            frac: f,
            label: secAgo > 0 ? `-${secAgo}s` : '0s',
            anchor: i === 0 ? 'start' : i === 3 ? 'end' : 'middle',
          };
        })
      : [];

  // 网格刻度（水平 4 档含 0/100% 轴线，垂直 4 档）；0 档不标文字（底部轴即 0，避免撞柱区）
  const hTicks = [0, 1 / 3, 2 / 3, 1];
  const vTicks = [0, 1 / 3, 2 / 3, 1];
  const yAxisLabels = (yTick ? hTicks.slice(1) : []).map(f => ({f, t: yTick!(f, max)}));

  const canDraw = width > 0 && history.length > 1;
  if (!canDraw) {
    return (
      <View style={{height, width: '100%'}} onLayout={e => setWidth(e.nativeEvent.layout.width)} testID={testID} />
    );
  }

  return (
    <View
      style={{height, width: '100%'}}
      onLayout={e => setWidth(e.nativeEvent.layout.width)}
      testID={testID}>
      <Svg width={width} height={height}>
        {!multi ? (
          <Defs>
            <LinearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={color} stopOpacity={0.32} />
              <Stop offset="1" stopColor={color} stopOpacity={0.02} />
            </LinearGradient>
          </Defs>
        ) : null}

        {/* ── 坐标网格（axes）：水平 3 条 + 垂直 3 条 + 左/下轴线 ── */}
        {axes ? (
          <React.Fragment>
            <Line
              x1={x0}
              x2={width}
              y1={plotBottom}
              y2={plotBottom}
              stroke={axisColor}
              strokeWidth={0.5}
              opacity={0.5}
            />
            <Line
              x1={x0}
              x2={x0}
              y1={plotTop}
              y2={plotBottom}
              stroke={axisColor}
              strokeWidth={0.5}
              opacity={0.5}
            />
            {hTicks.map((f, i) =>
              i === 0 || i === hTicks.length - 1 ? null : (
                <Line
                  key={`hg-${i}`}
                  x1={x0}
                  x2={width}
                  y1={yOf(f)}
                  y2={yOf(f)}
                  stroke={axisColor}
                  strokeWidth={0.5}
                  opacity={0.14}
                  strokeDasharray="2 4"
                />
              ),
            )}
            {vTicks.map((f, i) =>
              i === 0 || i === vTicks.length - 1 ? null : (
                <Line
                  key={`vg-${i}`}
                  x1={x0 + f * plotW}
                  x2={x0 + f * plotW}
                  y1={plotTop}
                  y2={plotBottom}
                  stroke={axisColor}
                  strokeWidth={0.5}
                  opacity={0.1}
                  strokeDasharray="2 4"
                />
              ),
            )}
            {/* Y 轴刻度文字 + 短横线（左轴） */}
            {yAxisLabels.map(({f, t}) => (
              <React.Fragment key={`yt-${f}`}>
                <SvgText
                  x={x0 - 4}
                  y={yOf(f) + 3}
                  fontSize={8}
                  fill={axisColor}
                  opacity={0.85}
                  textAnchor="end">
                  {t}
                </SvgText>
                <Line
                  x1={x0 - 3}
                  x2={x0}
                  y1={yOf(f)}
                  y2={yOf(f)}
                  stroke={axisColor}
                  strokeWidth={0.5}
                  opacity={0.5}
                />
              </React.Fragment>
            ))}
            {/* X 轴时间刻度文字（真实 ts 差值） */}
            {xTicks.map(t => (
              <SvgText
                key={`xt-${t.frac}`}
                x={x0 + t.frac * plotW}
                y={height - 3}
                fontSize={8}
                fill={axisColor}
                opacity={0.85}
                textAnchor={t.anchor}>
                {t.label}
              </SvgText>
            ))}
          </React.Fragment>
        ) : null}

        {/* ── 温度热力带（tempBand）：底 2px 渐变带，按列绘制 ── */}
        {tempBand && history.length > 1 ? (
          history.map((p, i) => {
            const colW = plotW / history.length;
            const t = p.tempC;
            if (naOf(t)) {
              return null;
            }
            return (
              <Rect
                key={`band-${i}`}
                x={x0 + i * colW}
                y={bandY}
                width={Math.max(colW + 0.5, 1.5)}
                height={BAND_H}
                fill={tempBandColor(t)}
                opacity={0.9}
              />
            );
          })
        ) : null}

        {showPssLines ? (
          <>
            {/* 5GB 逼近线（橙）：满量程 6GB → norm 5/6 */}
            <Line
              x1={x0}
              x2={width}
              y1={warnY}
              y2={warnY}
              stroke={warnColor}
              strokeWidth={1}
              strokeDasharray="4 3"
              opacity={0.8}
            />
            {/* 6GB 硬杀线（红，满量程顶） */}
            <Line
              x1={x0}
              x2={width}
              y1={dangerY}
              y2={dangerY}
              stroke={dangerColor}
              strokeWidth={1}
              strokeDasharray="4 3"
              opacity={0.9}
            />
            {/* 端点迷你标注（axes 时）：虚线语义可读化 */}
            {axes ? (
              <>
                <SvgText
                  x={x0 + 2}
                  y={warnY - 3}
                  fontSize={7}
                  fill={warnColor}
                  opacity={0.9}>
                  5GB
                </SvgText>
                <SvgText
                  x={x0 + 2}
                  y={dangerY - 3}
                  fontSize={7}
                  fill={dangerColor}
                  opacity={0.9}>
                  6GB
                </SvgText>
              </>
            ) : null}
          </>
        ) : null}

        {/* ── 柱状区（bars）：贴画布底部，双系列并排 ── */}
        {bars && bars.length > 0 && history.length > 1 ? (
          bars.map(bar => {
            const colW = plotW / history.length;
            const barW = Math.max(colW * 0.34, 1.5);
            return history.map((p, i) => {
              const v = overlayValueOf(p, bar.key);
              if (naOf(v)) {
                return null;
              }
              const h = Math.min(Math.max((v / bar.max) * (BAR_H - 2), 0.5), BAR_H - 2);
              const x = x0 + i * colW + (colW - bars!.length * barW) / 2 + barW * bars!.indexOf(bar);
              return (
                <Rect
                  key={`bar-${bar.key}-${i}`}
                  x={x}
                  y={barBottom - h}
                  width={barW}
                  height={h}
                  rx={0.5}
                  fill={bar.color}
                  opacity={0.85}
                />
              );
            });
          })
        ) : null}

        {multi ? (
          // B40 多层叠加：每条曲线各自满量程归一 + 分色
          series!.map(sp => (
            <Polyline
              key={sp.key}
              points={toPolyline(
                buildPoints(history, sp.key, sp.max, plotW, x0, plotBottom, plotH),
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

        {/* ── 演出层（vivid）：彗星尾 + 呼吸光圈 + 扫掠光 ── */}
        {vivid ? (
          <React.Fragment>
            {hasTail ? (
              <>
                <Polyline
                  points={toPolyline(tail1)}
                  fill="none"
                  stroke={mainColor}
                  strokeWidth={1.2}
                  opacity={0.35}
                />
                {tail2.length > 1 ? (
                  <Polyline
                    points={toPolyline(tail2)}
                    fill="none"
                    stroke={mainColor}
                    strokeWidth={1.5}
                    opacity={0.75}
                  />
                ) : null}
              </>
            ) : null}
            {mainLast ? (
              <>
                <AnimatedCircle
                  cx={mainLast.x}
                  cy={mainLast.y}
                  r={pulseR}
                  fill={mainColor}
                  opacity={pulseO}
                  testID="perf-chart-pulse"
                />
                <Circle
                  cx={mainLast.x}
                  cy={mainLast.y}
                  r={2.5}
                  fill={mainColor}
                />
              </>
            ) : null}
            {/* 示波器扫掠光：从左到右循环，最上层微光 */}
            <AnimatedLine
              x1={sweepX}
              x2={sweepX}
              y1={plotTop}
              y2={plotBottom}
              stroke={mainColor}
              strokeWidth={1}
              opacity={sweepO}
              testID="perf-chart-sweep"
            />
          </React.Fragment>
        ) : null}
      </Svg>
    </View>
  );
};