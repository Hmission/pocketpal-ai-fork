/**
 * perfTiers — 跑分面板共享阈值/格式器（IMAGEGEN_UI_SPEC §9 语义色注册表，2026-08-26 抽取）
 *
 * 单一事实源：PerfPanel（生图大面板）与 PerfMiniRow（聊天/叠图紧凑遥测）共用，
 * 阈值不分散定义。语义：
 *  - PSS：>5GB 橙（逼近）/ >6GB 红（HyperOS 看护硬杀线，K90 实测 6291456kb）
 *  - 指标分级：两档阈值变色（正常继承 / 橙警告 / 红危险）；invert=低于阈值警戒（频率）
 *  - N/A（undefined/null/<0）：诚实显 '--'，不编造
 */
import type {PerfSnapshot} from '../specs/NativeHardwareInfo';

/** PSS 阈值（KB）：与 perfScore 硬杀线同口径（6GB） */
export const PERF_WARN_KB = 5 * 1024 * 1024;
export const PERF_DANGER_KB = 6 * 1024 * 1024;
/** 语义色登记：warning=橙 */
export const PERF_WARN_COLOR = '#F5A623';
/** CPU 折线青 / GPU 绿（与 PerfPanel OVERLAY_COLOR 同源；PerfMiniRow 仅用 CPU 青） */
export const PERF_CPU_COLOR = '#4FC3F7';
export const PERF_GPU_COLOR = '#81C784';
/** 功耗紫 */
export const PERF_POWER_COLOR = '#BA68C8';

/** 指标分级阈值 */
export const TIER_TEMP = {warn: 45, danger: 55}; // °C
export const TIER_POWER_W = {warn: 7, danger: 10}; // W
export const TIER_CPU_FREQ_G = {warn: 2.0, danger: 1.5}; // GHz，低于=降频警戒
export const TIER_GPU_FREQ_M = {warn: 500, danger: 300}; // MHz，低于=降频警戒
export const TIER_STEP_S = {warn: 12, danger: 20}; // s/步

/** -1/无效 → true（原生侧 N/A 统一表达） */
export const na = (v: number | undefined | null): boolean =>
  v === undefined || v === null || v < 0;
/** opt：把 N/A 归一为 undefined 供 AnimatedNumber 显 '--' */
export const opt = (v: number | undefined | null): number | undefined =>
  na(v) ? undefined : (v as number);

/** 指标分级色：正常继承（undefined）/ 橙警告 / 红危险；invert=低于阈值警戒 */
export const tierColor = (
  theme: {colors: {error: string}},
  v: number | undefined,
  warn: number,
  danger: number,
  invert = false,
): string | undefined => {
  if (na(v)) {
    return undefined;
  }
  const val = v as number;
  if (invert) {
    return val < danger
      ? theme.colors.error
      : val < warn
        ? PERF_WARN_COLOR
        : undefined;
  }
  return val >= danger
    ? theme.colors.error
    : val >= warn
      ? PERF_WARN_COLOR
      : undefined;
};

/** 胶囊负载分档变色（>=85 红 / >=60 橙 / 否则继承中性） */
export const loadTierColor = (
  theme: {colors: {error: string}},
  v: number | undefined,
): string | undefined => tierColor(theme, v, 60, 85);

/** PSS 大字/主曲线阈值色（>6GB 红 / >5GB 橙 / 正常用调用方主色） */
export const pssColorOf = (
  theme: {colors: {error: string}},
  pssKb: number,
  normalColor: string,
): string =>
  pssKb > PERF_DANGER_KB
    ? theme.colors.error
    : pssKb > PERF_WARN_KB
      ? PERF_WARN_COLOR
      : normalColor;

// AnimatedNumber 格式化器（同源格式，演出层不改数值）
export const pctFmt = (n: number) => `${Math.round(n)}%`;
export const tempFmt = (n: number) => `${Math.round(n)}°C`;
export const powerFmt = (n: number) => `${(n / 1000).toFixed(1)}W`;
export const freqFmt = (n: number) => `${(n / 1000).toFixed(1)}GHz`;
export const gbFmt = (n: number) => `${n.toFixed(1)} GB`;
export const stepFmt = (n: number) => `${n.toFixed(1)}s`;
/** 迷你/紧凑面 GB 格式（无空格，窄空间）：4.2G */
export const gbTinyFmt = (n: number) => `${n.toFixed(1)}G`;

/** PerfAreaChart Y 轴刻度（PSS GB 满量程）格式器：mx 即满量程，frac 为 0..1 */
export const yTickGbFmt = (frac: number, mx: number): string =>
  `${((frac * mx) / 1024 / 1024).toFixed(0)}G`;

export type {PerfSnapshot};
