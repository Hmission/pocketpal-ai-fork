/**
 * #711 eventStream | CP=DRC-001 | ST=running | 测试: test_eventStream.ts
 *   SSOT: docs/DebugRemoteControl/DRC_SPEC.md | 铁律: BT07 观测不为SPOF
 *   入口: store/hook 埋点（6 处统一出口）→ 出口: AIOS_ROOT/logs/events.jsonl
 *   角色: DRC 事件流——聊天/生图/状态/错误全链路增量观测视图（DB 为事实源，本流为调试视图）。
 *
 * 锋利边界：
 *   - emit 永不抛错（try/catch 静默降级），观测失败绝不阻断业务（BT07）
 *   - 流式增量事件走节流合并（per-key），避免逐 token 写盘
 *   - 门控跟随 DRC_ENABLED，prod release 构建整模块 DCE 剥离
 */
import * as RNFS from '@dr.pogodin/react-native-fs';

import {AIOS_EVENTS_LOG} from '../utils/paths';
import {DrcDomain, DrcEvent, DRC_ENABLED} from './drcTypes';

/** 内存单调序号（每次启动从 0 起；文件行序即真实顺序，seq 仅辅助排序） */
let seqCounter = 0;

/** 节流表：key → 最近一次落盘时间 */
const throttleTable = new Map<string, number>();
const THROTTLE_MS = 300;

/** 懒创建标记：events.jsonl 是否已确认存在（appendFile 对不存在文件抛 ENOENT） */
let fileEnsured = false;

/** 确保事件流文件存在（appendFile 用 "wa" 模式，文件不存在时 contentResolver 抛 ENOENT） */
async function ensureEventFile(): Promise<void> {
  if (fileEnsured) {
    return;
  }
  try {
    if (!(await RNFS.exists(AIOS_EVENTS_LOG))) {
      await RNFS.writeFile(AIOS_EVENTS_LOG, '', 'utf8');
    }
    fileEnsured = true;
  } catch {
    // 创建失败静默（BT07）：下轮重试
  }
}

/**
 * 纯函数：构造事件行（不落盘）。导出供单测与复用。
 */
export function buildEventLine(
  domain: DrcDomain,
  type: string,
  payload?: Record<string, unknown>,
  ts = Date.now(),
): string {
  const event: DrcEvent = {ts, seq: ++seqCounter, domain, type, payload};
  return JSON.stringify(event);
}

/**
 * 事件落盘（追加 JSONL）。门控 + 静默失败（BT07）。
 * throttleKey 存在时按 key 节流（流式增量合并），返回是否实际写入。
 */
export function emit(
  domain: DrcDomain,
  type: string,
  payload?: Record<string, unknown>,
  throttleKey?: string,
): boolean {
  if (!DRC_ENABLED) {
    return false;
  }
  if (throttleKey) {
    const last = throttleTable.get(throttleKey) ?? 0;
    const now = Date.now();
    if (now - last < THROTTLE_MS) {
      return false;
    }
    throttleTable.set(throttleKey, now);
  }
  try {
    void ensureEventFile().then(() =>
      RNFS.appendFile(AIOS_EVENTS_LOG, buildEventLine(domain, type, payload) + '\n', 'utf8').catch(
        () => {
          // 观测失败静默降级（BT07）：不阻断业务
        },
      ),
    );
    return true;
  } catch {
    return false;
  }
}

/** 测试辅助：重置序号与节流表（仅 __E2E__ / 单测场景调用） */
export function __resetEventStreamForTest(): void {
  seqCounter = 0;
  throttleTable.clear();
  fileEnsured = false;
}
