/**
 * #711 drcService | CP=DRC-004 | ST=running | 测试: test_drcService.ts
 *   SSOT: docs/DebugRemoteControl/DRC_SPEC.md | 铁律: BT07 观测不为SPOF
 *   入口: DrcBridge 生命周期 → 出口: commands/ 消费 + results/ 回写
 *   角色: DRC 命令轮询执行器——1s 轮询 AIOS_ROOT/drc/commands/，白名单执行，结果回写，消费后即删。
 *
 * 锋利边界：
 *   - 轮询仅在 drcEnabled 且 App 前台时进行（AppState 挂起时暂停）
 *   - 单飞锁（busy 标志）防并发；命令文件格式/actionId 校验失败写失败结果
 *   - 观测失败静默（BT07），绝不阻断业务
 */
import * as RNFS from '@dr.pogodin/react-native-fs';
import {AppState} from 'react-native';

import {
  AIOS_DRC_COMMANDS_DIR,
  AIOS_DRC_RESULTS_DIR,
  prepareSharedStorage,
} from '../utils/paths';
import {executeAction} from './actionRegistry';
import {DrcCommand, DrcResult, DRC_ENABLED} from './drcTypes';
import {emit} from './eventStream';
import {refreshStateSnapshot} from './stateSnapshot';

const POLL_MS = 1000;
const DEFAULT_TIMEOUT_MS = 30000;

let pollTimer: ReturnType<typeof setInterval> | null = null;
let started = false;
let busy = false;

/** 最近一次命令链路（写回 state.json lastCommand） */
let lastCommand: {cmdId: string; actionId: string; ts: number} | null = null;
export function getLastCommand(): {cmdId: string; actionId: string; ts: number} | null {
  return lastCommand;
}

async function writeResult(result: DrcResult): Promise<void> {
  try {
    const dir = AIOS_DRC_RESULTS_DIR;
    if (!(await RNFS.exists(dir))) {
      await RNFS.mkdir(dir);
    }
    await RNFS.writeFile(
      `${dir}/${result.cmdId}.json`,
      JSON.stringify(result, null, 2),
      'utf8',
    );
  } catch {
    // 结果回写失败静默（BT07）
  }
}

async function consumeCommand(cmdId: string): Promise<void> {
  const path = `${AIOS_DRC_COMMANDS_DIR}/${cmdId}.json`;
  let raw: string;
  try {
    raw = await RNFS.readFile(path, 'utf8');
  } catch {
    return; // 文件不存在/读取失败：跳过
  }
  // 消费后即删（防重复执行；删除失败不阻塞——文件可能已被外部清走）
  RNFS.unlink(path).catch(() => {});

  const startedAt = Date.now();
  let command: DrcCommand;
  try {
    command = JSON.parse(raw) as DrcCommand;
  } catch {
    await writeResult({
      cmdId,
      actionId: 'parse',
      ok: false,
      durationMs: Date.now() - startedAt,
      error: '命令 JSON 解析失败（DRC_SPEC §命令格式）',
      ts: Date.now(),
    });
    return;
  }

  if (!command.cmdId || command.cmdId !== cmdId) {
    await writeResult({
      cmdId,
      actionId: command.actionId ?? 'unknown',
      ok: false,
      durationMs: Date.now() - startedAt,
      error: `cmdId 不一致：文件名=${cmdId}，内容=${command.cmdId}`,
      ts: Date.now(),
    });
    return;
  }

  lastCommand = {cmdId: command.cmdId, actionId: command.actionId, ts: Date.now()};
  emit('system', 'command.start', {cmdId: command.cmdId, actionId: command.actionId});

  const timeoutMs = command.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error(`命令超时（${timeoutMs}ms）：${command.actionId}`)), timeoutMs),
  );
  try {
    const data = await Promise.race([
      executeAction(command.actionId, command.params),
      timeout,
    ]);
    await writeResult({
      cmdId: command.cmdId,
      actionId: command.actionId,
      ok: true,
      durationMs: Date.now() - startedAt,
      data,
      ts: Date.now(),
    });
    emit('system', 'command.done', {cmdId: command.cmdId, actionId: command.actionId});
  } catch (e: any) {
    const msg = e?.message ?? String(e);
    await writeResult({
      cmdId: command.cmdId,
      actionId: command.actionId,
      ok: false,
      durationMs: Date.now() - startedAt,
      error: msg,
      ts: Date.now(),
    });
    emit('system', 'command.failed', {cmdId: command.cmdId, actionId: command.actionId, error: msg});
  } finally {
    refreshStateSnapshot();
  }
}

async function pollOnce(): Promise<void> {
  if (busy) {
    return;
  }
  busy = true;
  try {
    let files: RNFS.ReadDirResItemT[];
    try {
      files = await RNFS.readDir(AIOS_DRC_COMMANDS_DIR);
    } catch {
      return; // 目录未就绪：跳过本轮
    }
    const cmds = files
      .filter(f => f.name.endsWith('.json'))
      .sort((a, b) => a.name.localeCompare(b.name));
    for (const f of cmds) {
      const cmdId = f.name.replace(/\.json$/, '');
      if (!cmdId) {
        continue;
      }
      await consumeCommand(cmdId);
    }
  } finally {
    busy = false;
  }
}

/** 启动轮询（幂等）。DrcBridge 挂载时调用。 */
export async function startDrcService(): Promise<void> {
  if (!DRC_ENABLED || started) {
    return;
  }
  started = true;
  // 目录就绪（ensureAiosDirs 已建 commands/，双保险）
  try {
    await prepareSharedStorage();
    if (!(await RNFS.exists(AIOS_DRC_COMMANDS_DIR))) {
      await RNFS.mkdir(AIOS_DRC_COMMANDS_DIR);
    }
  } catch {
    // 目录失败不阻断轮询（下轮重试）
  }
  pollTimer = setInterval(() => {
    if (AppState.currentState === 'active') {
      void pollOnce();
    }
  }, POLL_MS);
  void pollOnce();
}

/** 停止轮询（幂等）。DrcBridge 卸载时调用。 */
export function stopDrcService(): void {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
  started = false;
}
