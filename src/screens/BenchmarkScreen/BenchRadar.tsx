/**
 * BenchRadar — 四轴雷达图（PERF_BENCHMARK_DESIGN §10.7，B39）
 *
 * 轴 = perfScore 四分（内存安全/速度/温控/稳定性，SSOT 不造新公式）；
 * 速度无基线时该轴诚实置灰显「—」。自绘 SVG（react-native-svg 既有依赖）。
 */
import * as React from 'react';
import {View} from 'react-native';
import {Line, Polygon, Svg, Text as SvgText} from 'react-native-svg';

export interface RadarScore {
  memory: number;
  thermal: number;
  stability: number;
  speed: number | null;
}

interface BenchRadarProps {
  score: RadarScore;
  /** 主色（消费方传 theme brandAccent，不裸 hex） */
  color: string;
  /** 网格/文字弱色 */
  gridColor: string;
  textColor: string;
  size?: number;
  testID?: string;
}

const AXES: Array<{key: keyof RadarScore; label: string; angle: number}> = [
  {key: 'memory', label: '内存', angle: -Math.PI / 2}, // 上
  {key: 'speed', label: '速度', angle: 0}, // 右
  {key: 'thermal', label: '温控', angle: Math.PI / 2}, // 下
  {key: 'stability', label: '稳定', angle: Math.PI}, // 左
];

export const BenchRadar: React.FC<BenchRadarProps> = ({
  score,
  color,
  gridColor,
  textColor,
  size = 180,
  testID,
}) => {
  const c = size / 2;
  const R = size / 2 - 24; // 留标签边距

  const pt = (angle: number, r: number) => ({
    x: c + Math.cos(angle) * r,
    y: c + Math.sin(angle) * r,
  });

  // 网格三圈（33%/66%/100%）
  const rings = [1 / 3, 2 / 3, 1].map(f =>
    AXES.map(a => {
      const p = pt(a.angle, R * f);
      return `${p.x},${p.y}`;
    }).join(' '),
  );

  // 数值多边形：null 轴按 0 收拢（置灰由标签标注，不编造数值）
  const valuePoints = AXES.map(a => {
    const v = score[a.key];
    const r = v == null ? 0 : (Math.min(Math.max(v, 0), 100) / 100) * R;
    const p = pt(a.angle, r);
    return `${p.x},${p.y}`;
  }).join(' ');

  return (
    <View testID={testID}>
      <Svg width={size} height={size}>
        {rings.map((points, i) => (
          <Polygon
            key={i}
            points={points}
            fill="none"
            stroke={gridColor}
            strokeWidth={i === rings.length - 1 ? 1.2 : 0.7}
          />
        ))}
        {AXES.map(a => {
          const p = pt(a.angle, R);
          return (
            <Line
              key={a.key}
              x1={c}
              y1={c}
              x2={p.x}
              y2={p.y}
              stroke={gridColor}
              strokeWidth={0.7}
            />
          );
        })}
        <Polygon
          points={valuePoints}
          fill={color}
          fillOpacity={0.25}
          stroke={color}
          strokeWidth={1.5}
        />
        {AXES.map(a => {
          const p = pt(a.angle, R + 14);
          const v = score[a.key];
          return (
            <SvgText
              key={a.key}
              x={p.x}
              y={p.y + 3}
              fontSize={10}
              fill={textColor}
              textAnchor="middle">
              {a.label} {v == null ? '—' : v}
            </SvgText>
          );
        })}
      </Svg>
    </View>
  );
};
