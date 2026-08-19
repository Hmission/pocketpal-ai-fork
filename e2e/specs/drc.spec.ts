/**
 * DRC E2E Spec — 命令注入 → App 执行 → 事件落盘 全链路闭环
 *
 * 验证 DRC（Debug Remote Control）双通道：
 *   1. adb push system.ping 命令 → results/<cmdId>.json 返回 pong（命令通道）
 *   2. events.jsonl 出现 command.done / app.drc_ready（事件流通道）
 *
 * 前置：E2E 构建（e2e flavor，DRC 桥在岗）；不需要任何 UI 点击——纯文件通道。
 *
 *   yarn e2e --platform android --spec drc --skip-build
 */
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {execFileSync} from 'child_process';

import {expect} from '@wdio/globals';

import {PACKAGE} from '../helpers/bench-runner';

declare const driver: WebdriverIO.Browser;
declare const browser: WebdriverIO.Browser;

const AIOS_ROOT = '/sdcard/Documents/AIOS';
const DRC_COMMANDS_DIR = `${AIOS_ROOT}/drc/commands`;
const DRC_RESULTS_DIR = `${AIOS_ROOT}/drc/results`;
const EVENTS_LOG = `${AIOS_ROOT}/logs/events.jsonl`;

function adb(udid: string | undefined, ...args: string[]): string {
  const cmd = udid ? ['-s', udid, ...args] : [...args];
  return execFileSync('adb', cmd, {encoding: 'utf8'}).trim();
}

describe('DRC remote control', () => {
  const udid = process.env.E2E_DEVICE_UDID;

  before(async () => {
    if (!(driver as any).isAndroid) {
      throw new Error('Android-only.');
    }
    adb(udid, 'shell', 'mkdir', '-p', DRC_COMMANDS_DIR, DRC_RESULTS_DIR, `${AIOS_ROOT}/logs`);
  });

  it('system.ping 命令经文件通道执行并写回结果', async function (this: Mocha.Context) {
    this.timeout(60_000);

    // 先拉起 App（冷启动桥挂载；无 UI 交互）
    await driver.execute('mobile: deepLink', {
      url: 'pocketpal://e2e/benchmark',
      package: PACKAGE,
    });
    await browser.pause(4000);

    // 写命令（与 scripts/drc/drc-push.js 同协议）
    const cmdId = `e2e_ping_${Date.now()}`;
    const cmdFile = path.join(os.tmpdir(), `${cmdId}.json`);
    fs.writeFileSync(cmdFile, JSON.stringify({cmdId, actionId: 'system.ping'}));
    adb(udid, 'push', cmdFile, `${DRC_COMMANDS_DIR}/${cmdId}.json`);
    fs.unlinkSync(cmdFile);

    // 轮询结果（App 1s 轮询消费 → 写回 results/）
    const resultPath = `${DRC_RESULTS_DIR}/${cmdId}.json`;
    const deadline = Date.now() + 30_000;
    let result: any = null;
    while (Date.now() < deadline) {
      try {
        const out = adb(udid, 'shell', `cat ${resultPath} 2>/dev/null`);
        if (out) {
          result = JSON.parse(out);
          break;
        }
      } catch {
        // 结果未就绪
      }
      await browser.pause(500);
    }
    expect(result, 'system.ping 应在 30s 内写回结果').not.toBeNull();
    expect(result.ok).toBe(true);
    expect(result.data).toMatchObject({pong: true});

    // 命令文件应已被消费删除
    const remains = adb(udid, 'shell', `ls ${DRC_COMMANDS_DIR}/${cmdId}.json 2>/dev/null`);
    expect(remains).toBe('');
  });

  it('事件流 events.jsonl 落盘 command.done 事件', async () => {
    const tail = adb(udid, 'shell', `tail -n 50 ${EVENTS_LOG} 2>/dev/null`);
    expect(tail).toContain('command.done');
    expect(tail).toContain('system.ping');
  });

  it('状态快照 state.json 可读（状态指南针）', async () => {
    const out = adb(udid, 'shell', `cat ${AIOS_ROOT}/logs/state.json 2>/dev/null`);
    const snapshot = JSON.parse(out);
    expect(snapshot.engines).toHaveProperty('chat');
    expect(snapshot.engines.chat).toHaveProperty('nextAction');
  });
});
