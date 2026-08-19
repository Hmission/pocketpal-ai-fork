#!/usr/bin/env node
/**
 * drc-state.js — 读取 App 状态快照（状态指南针：我在哪/往哪走）
 *
 * 用法：
 *   node scripts/drc/drc-state.js [--device <id>]
 *
 * 快照含：currentRoute / activeSessionId / engines（三引擎 StateCompass）/ lastError / lastCommand。
 */
const {resolveDevice, adb, STATE_JSON} = require('./adb');

function main() {
  const args = process.argv.slice(2);
  const device = resolveDevice(args);
  if (!device) {
    console.error('未找到在线设备。请连接设备或用 --device <id> 指定。');
    process.exit(1);
  }
  try {
    const out = adb(device, 'shell', `cat ${STATE_JSON} 2>/dev/null`);
    if (!out) {
      console.log('（state.json 不存在：App 未启动或 DRC 桥未激活）');
      process.exit(1);
    }
    const snapshot = JSON.parse(out);
    console.log(JSON.stringify(snapshot, null, 2));
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  }
}

main();
