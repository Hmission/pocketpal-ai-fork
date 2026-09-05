/**
 * usePerfTrace — 长驻观测面的 1Hz 环境跑分轨迹（PHONE_SPEC §11.7）。
 *
 * 为什么要它：跑分是灵魂，但 `chatTurnPerf` 是**回合制**采样
 * （run_started → run_finished 之间 1Hz，回合外诚实返空）。电话模式跨回合
 * 常驻（聆听/播报期同样要看见内存/CPU/温度画像），空闲期无数据时展开的
 * 跑分卡就是一张空白框——2026-09-05 大王复测报「跑分卡片默认折叠，这不好」
 * 的真因即在此（defaultExpanded 一直是 true，展开的是空图）。
 *
 * 采样纪律（PERF B1 单采样源，2026-08-31 裁定）：任一瞬间至多一个 1Hz
 * NativeHardwareInfo 采样源。回合轨迹非空时**本面不自采**，直接以回合轨迹为
 * 显示源（双采样 = 每点 ~10 个 sysfs 读 + Debug.getMemoryInfo 的翻倍固定开销）；
 * 回合结束（cancel/finish 清空 points）后自动续采，接在同一条时间线上不跳变。
 *
 * 诚实口径：采样失败跳过该点，不插值不编造（与 chatTurnPerf 同规则）；
 * active=false（未打开通话页 / 已挂断）立即停采并清空，不留残影。
 */
import * as React from 'react';

import NativeHardwareInfo from '../specs/NativeHardwareInfo';
import {chatTurnPerf} from '../services/perf/chatTurnPerf';
import type {PerfPoint} from '../services/perf/perfRecorder';

/** 滚动窗口（与聊天卡/生图卡同口径：最近 60 点 = 60 秒） */
export const PERF_TRACE_WINDOW = 60;

/** NativeHardwareInfo 快照 → 轨迹点（字段补齐口径与 chatTurnPerf.sample 同源） */
function toPoint(
  s: Awaited<ReturnType<typeof NativeHardwareInfo.getPerfSnapshot>>,
  stage: string,
): PerfPoint {
  return {
    ts: Date.now(),
    pssKb: s.pssKb,
    rssKb: s.rssKb,
    cpuPct: s.cpuPct,
    tempC: s.tempC,
    cpuFreqMhz: s.cpuFreqMhz ?? -1,
    gpuLoadPct: s.gpuLoadPct ?? -1,
    gpuFreqMhz: s.gpuFreqMhz ?? -1,
    tempCpuC: s.tempCpuC ?? -1,
    tempGpuC: s.tempGpuC ?? -1,
    powerMw: s.powerMw ?? -1,
    stepTime: 0,
    stage,
  };
}

/**
 * @param active 观测面是否在岗（电话模式 = overlay 可见）
 * @returns 最近 60 点轨迹（回合期 = 回合轨迹；空闲期 = 本面环境轨迹）
 */
export function usePerfTrace(active: boolean): PerfPoint[] {
  const [history, setHistory] = React.useState<PerfPoint[]>([]);

  React.useEffect(() => {
    if (!active) {
      setHistory([]);
      return;
    }
    let alive = true;
    const tick = async () => {
      const turnPoints = chatTurnPerf.livePoints;
      if (turnPoints.length > 0) {
        // 生成期：唯一采样源是 chatTurnPerf，本面只读不重复采
        setHistory(turnPoints.slice(-PERF_TRACE_WINDOW));
        return;
      }
      try {
        const s = await NativeHardwareInfo.getPerfSnapshot();
        if (!alive) {
          return;
        }
        setHistory(prev => [
          ...prev.slice(-(PERF_TRACE_WINDOW - 1)),
          toPoint(s, 'ambient'),
        ]);
      } catch {
        // 本点失败：跳过，不打断轨迹（稀疏好过造假）
      }
    };
    tick();
    const iv = setInterval(tick, 1000);
    return () => {
      alive = false;
      clearInterval(iv);
    };
  }, [active]);

  return history;
}
