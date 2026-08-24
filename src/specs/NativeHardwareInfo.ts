import type {TurboModule} from 'react-native';
import {TurboModuleRegistry} from 'react-native';

export interface CPUProcessor {
  processor?: string;
  'model name'?: string;
  'cpu MHz'?: string;
  vendor_id?: string;
}

export interface CPUInfo {
  cores: number;
  processors?: CPUProcessor[];
  features?: string[];
  hasFp16?: boolean;
  hasDotProd?: boolean;
  hasSve?: boolean;
  hasI8mm?: boolean;
  socModel?: string;
  hardware?: string;
  maxFreqMhz?: number;
}

export interface GPUInfo {
  renderer: string;
  vendor: string;
  version: string;
  hasAdreno: boolean;
  hasMali: boolean;
  hasPowerVR: boolean;
  supportsOpenCL: boolean;
  gpuType: string;
}

/**
 * 1Hz 性能快照（ADR-0008 跑分面板 + PERF_BENCHMARK_DESIGN P1 扩展）。
 * pssKb 与 HyperOS 看护硬杀同口径（Debug.getMemoryInfo().totalPss）。
 * cpuPct 为本进程 CPU 时间差分（单核百分比，0-100*n 可超 100）。
 * tempC 为 thermal_zone 最大有效值，-1 表示不可读（N/A）。
 * P1 扩展字段（全部可选，向后兼容旧版原生）：
 *  cpuFreqMhz/gpuLoadPct/gpuFreqMhz/tempCpuC/tempGpuC/powerMw，
 *  sysfs 平台探测，不可读时 -1（UI 显 `--`，不报错不兜底）。
 *  NPU 利用率无标准 API（诚实模式：不在此结构内伪造）。
 */
export interface PerfSnapshot {
  pssKb: number;
  /** VmRSS（辅指标，与 PSS 差异 10-20%） */
  rssKb: number;
  cpuPct: number;
  tempC: number;
  /** P1：大核当前频率 MHz（-1 = N/A） */
  cpuFreqMhz?: number;
  /** P1：GPU 负载%（Adreno kgsl gpubusy / devfreq 百分比，-1 = N/A） */
  gpuLoadPct?: number;
  /** P1：GPU 频率 MHz（-1 = N/A） */
  gpuFreqMhz?: number;
  /** P1：CPU 分区温度 ℃（-1 = N/A） */
  tempCpuC?: number;
  /** P1：GPU 分区温度 ℃（-1 = N/A） */
  tempGpuC?: number;
  /** P1：功耗毫瓦（battery current×voltage，-1 = N/A） */
  powerMw?: number;
}

export interface Spec extends TurboModule {
  getCPUInfo(): Promise<CPUInfo>;
  getGPUInfo(): Promise<GPUInfo>;
  getChipset?(): Promise<string>; // Android only
  /**
   * Get available memory in bytes from the operating system.
   * - Android: Uses ActivityManager.getMemoryInfo() to get availMem
   * - iOS: Uses os_proc_available_memory()
   * @returns Promise<number> Available memory in bytes
   */
  getAvailableMemory(): Promise<number>;
  /**
   * Collect memory metrics and write a snapshot entry to disk.
   * Appends to Documents/memory-snapshots.json (iOS) or externalFilesDir/memory-snapshots.json (Android).
   */
  writeMemorySnapshot(label: string): Promise<{label: string; status: string}>;
  /**
   * Hint the native allocator to release fully-free pages back to the
   * kernel. Best-effort: resolves with `purged: false` on platforms
   * without an underlying mechanism (iOS, Android < API 28).
   * `rss_kb_before`/`after` are sampled from /proc/self/status so
   * callers can record actual reclaim per call.
   */
  purgeNativeAllocator(): Promise<{
    purged: boolean;
    rss_kb_before: number;
    rss_kb_after: number;
  }>;
  /**
   * 1Hz 性能快照（ADR-0008 跑分面板）：PSS/CPU/温度一次返回。
   */
  getPerfSnapshot(): Promise<PerfSnapshot>;
}

export default TurboModuleRegistry.getEnforcing<Spec>('HardwareInfo');
