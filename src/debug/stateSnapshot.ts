/**
 * #711 stateSnapshot | CP=DRC-003 | ST=running | 测试: test_stateSnapshot.ts
 *   SSOT: docs/DebugRemoteControl/DRC_SPEC.md | 铁律: BT07 观测不为SPOF
 *   入口: DrcBridge/actionRegistry/system.state → 出口: AIOS_ROOT/logs/state.json
 *   角色: 状态快照——覆盖写 state.json（节流），供开发机实时读「我在哪/往哪走」。
 *
 * 状态指南针五字段（母仓 STATE_COMPASS 同构）：state/nextAction/label/evidence/terminal。
 * 未知状态降级 unknown，观测失败静默（BT07）。
 */
import * as RNFS from '@dr.pogodin/react-native-fs';
import DeviceInfo from 'react-native-device-info';

import {AIOS_STATE_JSON} from '../utils/paths';
import {engineStatus} from '../store/engineStatus';
import {chatSessionStore} from '../store';
import {getLastCommand} from './drcService';
import {toCompass} from './stateCompass';
import {DrcStateSnapshot, DRC_ENABLED, StateCompass} from './drcTypes';

/** 状态快照节流表：key → 最近落盘时间 */
let lastWrite = 0;
const THROTTLE_MS = 1000;

/** 当前页面（DrcBridge 监听导航状态更新） */
let currentRoute: string | null = null;
export function setCurrentRoute(route: string | null): void {
  currentRoute = route;
}

/** 最近错误（P3 errorRegistry 写入） */
let lastError: {cpId: string; summary: string; ts: number} | null = null;
export function setLastError(cpId: string, summary: string): void {
  lastError = {cpId, summary, ts: Date.now()};
}

/** 组装状态快照（纯函数，导出供单测） */
export function buildStateSnapshot(): DrcStateSnapshot {
  const engines: Record<string, StateCompass> = {};
  for (const [kind, state] of Object.entries(engineStatus.engines)) {
    engines[kind] = toCompass('engine', state.phase, {
      progress: state.progress,
      stage: state.stage,
      error: state.error,
    });
  }
  return {
    ts: Date.now(),
    appVersion: 'preview',
    currentRoute,
    activeSessionId: chatSessionStore.activeSessionId ?? null,
    engines,
    lastError,
    lastCommand: getLastCommand(),
  };
}

/** 覆盖写 state.json（节流 1s）。门控 + 静默失败（BT07）。 */
export function refreshStateSnapshot(): void {
  if (!DRC_ENABLED) {
    return;
  }
  const now = Date.now();
  if (now - lastWrite < THROTTLE_MS) {
    return;
  }
  lastWrite = now;
  try {
    const snapshot = buildStateSnapshot();
    // 版本信息增量补齐（DeviceInfo 异步不可用时不阻塞快照主体）
    try {
      snapshot.appVersion = `v${DeviceInfo.getVersion()} (${DeviceInfo.getBuildNumber()})`;
    } catch {
      // 版本信息失败不影响快照
    }
    void RNFS.writeFile(AIOS_STATE_JSON, JSON.stringify(snapshot, null, 2), 'utf8').catch(
      () => {
        // 观测失败静默降级（BT07）
      },
    );
  } catch {
    // 静默降级
  }
}

/** 测试辅助：重置节流 */
export function __resetStateSnapshotForTest(): void {
  lastWrite = 0;
  currentRoute = null;
  lastError = null;
}
