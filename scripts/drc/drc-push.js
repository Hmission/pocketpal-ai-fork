#!/usr/bin/env node
/**
 * drc-push.js — 发送 DRC 命令并等待结果（AI 一条命令驱动 App）
 *
 * 用法：
 *   node scripts/drc/drc-push.js <actionId> [jsonParams] [--device <id>] [--timeout <ms>] [--params-file <path>]
 *
 * 示例：
 *   node scripts/drc/drc-push.js system.ping
 *   node scripts/drc/drc-push.js nav.go '{"route":"ImageGen"}'
 *   node scripts/drc/drc-push.js chat.send '{"text":"你好，介绍一下你自己"}'
 *   node scripts/drc/drc-push.js imagegen.generate '{"prompt":"apple","steps":4,"seed":42}'
 *   node scripts/drc/drc-push.js imagegen.generateDreamLite --params-file ./gen.json
 *
 * 流程：写命令 JSON → adb push 到 commands/<cmdId>.json → 轮询 results/<cmdId>.json → 打印结果。
 * 前置：App 以 debug/E2E 构建运行（DRC 桥在岗）；adb 文件 push 属允许的非 UI 操作。
 * 提示：Windows PowerShell 传 JSON 字符串引号易错，复杂参数建议用 --params-file。
 */
const fs = require('fs');
const os = require('os');
const path = require('path');

const {resolveDevice, adb, ensureDirs, DRC_COMMANDS_DIR, DRC_RESULTS_DIR} = require('./adb');

function usage() {
  console.error(`用法: node scripts/drc/drc-push.js <actionId> [jsonParams] [--device <id>] [--timeout <ms>]
示例:
  node scripts/drc/drc-push.js system.ping
  node scripts/drc/drc-push.js nav.go '{"route":"ImageGen"}'
  node scripts/drc/drc-push.js chat.send '{"text":"你好"}'
  node scripts/drc/drc-push.js imagegen.generate '{"prompt":"apple","steps":4}'
参数 jsonParams 为 JSON 字符串；--timeout 默认 30000ms。`);
}

function main() {
  const args = process.argv.slice(2);
  const deviceIdx = args.indexOf('--device');
  const device = deviceIdx >= 0 ? args[deviceIdx + 1] : null;
  const timeoutIdx = args.indexOf('--timeout');
  const timeoutMs = timeoutIdx >= 0 ? Number(args[timeoutIdx + 1]) : 30000;
  const paramsFileIdx = args.indexOf('--params-file');
  const paramsFile = paramsFileIdx >= 0 ? args[paramsFileIdx + 1] : null;
  const flagArgs = ['--device', '--timeout', '--params-file'];
  const positional = args.filter((_, i) => {
    const prevIsFlag = flagArgs.includes(args[i - 1]);
    return !flagArgs.includes(args[i]) && !prevIsFlag;
  });

  const actionId = positional[0];
  if (!actionId) {
    usage();
    process.exit(1);
  }
  let params = {};
  if (paramsFile) {
    try {
      params = JSON.parse(fs.readFileSync(paramsFile, 'utf-8'));
    } catch (e) {
      console.error(`--params-file 解析失败: ${e.message}`);
      process.exit(1);
    }
  } else if (positional[1]) {
    try {
      params = JSON.parse(positional[1]);
    } catch (e) {
      console.error(`jsonParams 解析失败: ${e.message}`);
      process.exit(1);
    }
  }

  const resolvedDevice = device || resolveDevice(args);
  if (!resolvedDevice) {
    console.error('未找到在线设备。请连接设备（adb devices 确认）或用 --device <id> 指定。');
    process.exit(1);
  }
  console.log(`[drc-push] device=${resolvedDevice} action=${actionId}`);

  const cmdId = `cmd_${Date.now()}`;
  const command = {cmdId, actionId, params, timeoutMs};
  const tmpFile = path.join(os.tmpdir(), `${cmdId}.json`);
  fs.writeFileSync(tmpFile, JSON.stringify(command));

  try {
    ensureDirs(resolvedDevice);
    adb(resolvedDevice, 'push', tmpFile, `${DRC_COMMANDS_DIR}/${cmdId}.json`);
  } finally {
    fs.unlinkSync(tmpFile);
  }

  // 轮询结果文件（App 消费命令后写回 results/<cmdId>.json）
  const resultPath = `${DRC_RESULTS_DIR}/${cmdId}.json`;
  const deadline = Date.now() + timeoutMs;
  let result = null;
  while (Date.now() < deadline) {
    try {
      const out = adb(resolvedDevice, 'shell', `cat ${resultPath} 2>/dev/null`);
      if (out) {
        result = JSON.parse(out);
        break;
      }
    } catch {
      // 结果未就绪，继续轮询
    }
    const sleep = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
    sleep(500);
  }

  if (!result) {
    console.error(`超时（${timeoutMs}ms）：未收到 results/${cmdId}.json。检查：
  1. App 是否以 debug/E2E 构建运行（DRC 桥在岗）
  2. 事件流确认命令是否到达：node scripts/drc/drc-tail.js --last 5
  3. 状态快照：node scripts/drc/drc-state.js`);
    process.exit(2);
  }

  console.log(JSON.stringify(result, null, 2));
  if (!result.ok) {
    process.exit(3);
  }
}

main();
