/**
 * #711 drcTypes | CP=DRC-000 | ST=idle | 测试: test_drcTypes.ts
 *   SSOT: docs/DebugRemoteControl/DRC_SPEC.md | 铁律: BT07 观测不为SPOF
 *   入口: eventStream/actionRegistry/drcService → 出口: events.jsonl / state.json / results
 *   角色: DRC（Debug Remote Control）共享类型——命令、事件、状态快照、结果四类载荷。
 */
import {NativeModules} from 'react-native';

/**
 * 调试面开关（DRC 门控）：
 *   - __E2E__：编译期注入（e2e 构建 true，prod release 折叠 false）
 *   - NativeModules.BuildInfo.isDevSupport：原生 BuildConfig.USE_DEV_SUPPORT
 *     （debug=true / release=false）。RN 0.82 Hermes 预编译 assets bundle 下
 *     __DEV__ 恒折叠 false，JS 侧无法区分构建类型，必须依赖原生信号。
 * 剥离契约：release 构建运行时恒 false（isDevSupport=false），DRC 功能不可达；
 * 代码保留于 bundle（无法静态 DCE），验证口径为「运行时不激活」。
 */

export const DRC_ENABLED: boolean =
  __E2E__ || NativeModules?.BuildInfo?.isDevSupport === true;

/** 命令载荷：开发机 adb 写入 AIOS_ROOT/drc/commands/<cmdId>.json */
export interface DrcCommand {
  /** 唯一命令 id（文件名即 cmdId.json，二者必须一致） */
  cmdId: string;
  /** 注册表内稳定动作 id，如 "chat.send" */
  actionId: string;
  /** 动作参数（zod schema 校验） */
  params?: Record<string, unknown>;
  /** 可选超时（ms），默认 30000 */
  timeoutMs?: number;
}

/** 命令执行结果：App 写回 AIOS_ROOT/drc/results/<cmdId>.json */
export interface DrcResult {
  cmdId: string;
  actionId: string;
  ok: boolean;
  /** 执行耗时（ms） */
  durationMs: number;
  /** 返回值（ok=true 时） */
  data?: unknown;
  /** 失败原因（ok=false 时） */
  error?: string;
  ts: number;
}

/**
 * 事件流载荷：追加写 AIOS_ROOT/logs/events.jsonl（每行一个 JSON）。
 * 三字段指南针对齐（母仓 COMPASS_SYSTEM_SSOT）：
 *   type=定位（我在哪）· payload 内可带 nextAction=导航 · 可带 deepDive=深入
 */
export interface DrcEvent {
  ts: number;
  /** 单调递增序号（每次 App 启动从 0 起），辅助排序 */
  seq: number;
  /** 功能域：chat / imagegen / model / nav / system / engine / error */
  domain: DrcDomain;
  /** 事件类型（见 DRC_SPEC §事件清单） */
  type: string;
  /** 事件负载（JSON 序列化友好） */
  payload?: Record<string, unknown>;
}

export type DrcDomain =
  | 'app'
  | 'nav'
  | 'chat'
  | 'imagegen'
  | 'model'
  | 'engine'
  | 'error'
  | 'system';

/**
 * 状态指南针五字段（母仓 STATE_COMPASS 同构，六维矩阵 D5 态维度）：
 *   state=定位 · nextAction=导航 · label=人类可读 · evidence=深入 · terminal=终态
 */
export interface StateCompass {
  state: string;
  nextAction: string;
  label: string;
  evidence?: Record<string, unknown>;
  terminal: boolean;
}

/** 状态快照：覆盖写 AIOS_ROOT/logs/state.json */
export interface DrcStateSnapshot {
  ts: number;
  appVersion: string;
  /** 当前页面（ROUTES 名） */
  currentRoute: string | null;
  /** 当前活动会话 */
  activeSessionId: string | null;
  /** 三引擎状态指南针（engineStatus 增强注入） */
  engines: Record<string, StateCompass>;
  /** 最近一次错误（CP 编号 + 摘要） */
  lastError: {cpId: string; summary: string; ts: number} | null;
  /** 最近一条命令链路 */
  lastCommand: {cmdId: string; actionId: string; ts: number} | null;
}
