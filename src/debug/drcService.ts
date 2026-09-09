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
import {safeInterval} from '../utils/safeInterval';

const POLL_MS = 1000;
const DEFAULT_TIMEOUT_MS = 30000;
/** 命令认领目录：从 commands/ 原子移入此处后才执行，防同一命令被重放。 */
const PROCESSING_DIR = `${AIOS_DRC_COMMANDS_DIR}/.processing`;

/**
 * 轮询收口句柄。
 * 🔴 旧写法是 `setInterval(() => { ... void pollOnce(); }, 1000)` —— 仓内唯一一处
 * 裸 setInterval + async 逃逸口，直接违反测试基建铁律②（异步轮询一律走 safeInterval）。
 * 后果实测：任何动作内同步抛出即成 unhandled rejection（红屏），而 `finally { busy=false }`
 * 保不住轮询本身——上一轮真机因此停摆 3.6 分、6 条命令堆积。
 * 现改走 safeInterval：异常永不逃逸 + 自带防重入 + 失败进事件流可查。
 */
let stopPolling: (() => void) | null = null;
let started = false;

/** 最近一次命令链路（写回 state.json lastCommand） */
let lastCommand: {cmdId: string; actionId: string; ts: number} | null = null;
export function getLastCommand(): {
  cmdId: string;
  actionId: string;
  ts: number;
} | null {
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
  const claimed = `${PROCESSING_DIR}/${cmdId}.json`;
  let raw: string;
  // 🔴 原子认领，而非“删失败就算了”。旧写法 `RNFS.unlink(path).catch(() => {})` 吞掉
  // 删除失败且无任何已处理标记：一旦 unlink 真失败（权限/竞态），下一秒 pollOnce 会把
  // 同一条命令（server.add 时还包括明文密钥）再执行一遍，无限重放。
  // 现在：move 失败 = 未被本进程独占，直接拒给并回报，不执行。
  try {
    await RNFS.moveFile(path, claimed);
  } catch (e: any) {
    const msg = e?.message ?? String(e);
    // 文件已不在（被外部清走/上一轮已认）是正常竞争，不算错；报而不洗
    if (!(await RNFS.exists(path))) {
      return;
    }
    await writeResult({
      cmdId,
      actionId: 'claim',
      ok: false,
      durationMs: 0,
      error: `命令认领失败（未能移入 .processing），拒给执行以防重放：${msg}`,
      ts: Date.now(),
    });
    return;
  }

  try {
    raw = await RNFS.readFile(claimed, 'utf8');
  } catch (e: any) {
    // 认领成功但读不到：显式报错，不静默吞（静默会让人以为命令发了但丢了）
    await writeResult({
      cmdId,
      actionId: 'read',
      ok: false,
      durationMs: 0,
      error: `已认领但读取失败：${e?.message ?? String(e)}`,
      ts: Date.now(),
    });
    await discardClaim(claimed);
    return;
  }

  const startedAt = Date.now();
  let command: DrcCommand;
  try {
    command = JSON.parse(raw) as DrcCommand;
  } catch {
    await discardClaim(claimed);
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
    await discardClaim(claimed);
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

  lastCommand = {
    cmdId: command.cmdId,
    actionId: command.actionId,
    ts: Date.now(),
  };
  emit('system', 'command.start', {
    cmdId: command.cmdId,
    actionId: command.actionId,
  });

  const timeoutMs = command.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  // 🔴 定时器必须 clear：旧写法把 `timeout` 直接丢进 Promise.race，命令 1s 就返回后
  // 那个 setTimeout 仍在跑，30s 到点时 promise reject 而 race 早已定局、无人再接
  // → 周期性 unhandled rejection（每条命令一次）。本文件接入全局异常出口后，
  // 它会被当成真错误反复上报，因此先在源头收掉。
  let timerId: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timerId = setTimeout(
      () =>
        reject(new Error(`命令超时（${timeoutMs}ms）：${command.actionId}`)),
      timeoutMs,
    );
  });
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
    emit('system', 'command.done', {
      cmdId: command.cmdId,
      actionId: command.actionId,
    });
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
    emit('system', 'command.failed', {
      cmdId: command.cmdId,
      actionId: command.actionId,
      error: msg,
    });
  } finally {
    if (timerId !== undefined) {
      clearTimeout(timerId);
    }
    refreshStateSnapshot();
    // 认领件的主退出清点。除上述两条校验早退（已各自行清）外，成功/失败/抛出
    // 三条路都经此；进程被杀留下的残件由 startDrcService 的 sweepProcessingDir 兼平。
    await discardClaim(claimed);
  }
}

/** 清掉已认领的命令件（.processing 里的残留）。失败不静默：它意味着明文密钥多存一份。 */
async function discardClaim(claimedPath: string): Promise<void> {
  try {
    await RNFS.unlink(claimedPath);
  } catch (e: any) {
    console.warn(
      '[DRC] 认领件清理失败（明文密钥可能仍驻盘）:',
      e?.message ?? e,
    );
    emit('system', 'drc.claimCleanupFailed', {
      path: claimedPath,
      error: e?.message ?? String(e),
    });
  }
}

/**
 * 启动时扫平 .processing 残留：上一进程被杀时留下的残件既无人会再执行、
 * 也不会被任何 return 路径清掉，而 server.add 的残件里含**明文密钥**。
 * 靠「每条路径都记得清」必然漏；本扫平才是单点保证。
 */
async function sweepProcessingDir(): Promise<void> {
  try {
    const stale = await RNFS.readDir(PROCESSING_DIR);
    for (const f of stale) {
      if (f.name.endsWith('.json')) {
        await discardClaim(`${PROCESSING_DIR}/${f.name}`);
      }
    }
  } catch {
    // 目录不存在：首次启动或未认领过任何命令，无需扫
  }
}

async function pollOnce(): Promise<void> {
  // 防重入不在这里再写一份：safeInterval 已保证上一轮未结束则跳过本轮。
  // 旧版自定义 `busy` 与它同语义两条实现，且 `busy` 只能在 await 链路内生效，
  // 抵不住同步抛出——真正需要的是收口，而收口已由 safeInterval 承担。
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
    if (!(await RNFS.exists(PROCESSING_DIR))) {
      await RNFS.mkdir(PROCESSING_DIR);
    }
  } catch {
    // 目录失败不阻断轮询（下轮重试）
  }
  // 先扫上一进程留下的认领残件，再开始轮询
  await sweepProcessingDir();
  // 🔴 safeInterval 代替裸 setInterval + void pollOnce；immediate 接手了原来的
  // “启动时手动跑一轮”——那句裸调与定时器回调是同一个逃逸口（铁律②明文点名）。
  stopPolling = safeInterval(
    'drc_poll',
    () => {
      // 后台不消费命令：HyperOS 后台限流下抢跑只会制造半态命令
      if (AppState.currentState === 'active') {
        return pollOnce();
      }
    },
    POLL_MS,
    {immediate: true},
  );
}

/** 停止轮询（幂等）。DrcBridge 卸载时调用。 */
export function stopDrcService(): void {
  if (stopPolling) {
    stopPolling();
    stopPolling = null;
  }
  started = false;
}
