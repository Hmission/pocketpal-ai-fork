#!/usr/bin/env node
/**
 * drc-tail.js — 读取 App 事件流（读落盘日志替代读屏幕）
 *
 * 用法：
 *   node scripts/drc/drc-tail.js [--last N] [--follow] [--device <id>]
 *
 * 示例：
 *   node scripts/drc/drc-tail.js --last 20
 *   node scripts/drc/drc-tail.js --follow        # 持续输出（Ctrl+C 退出）
 */
const {resolveDevice, adb, EVENTS_LOG} = require('./adb');

function main() {
  const args = process.argv.slice(2);
  const device = resolveDevice(args);
  if (!device) {
    console.error('未找到在线设备。请连接设备或用 --device <id> 指定。');
    process.exit(1);
  }

  const lastIdx = args.indexOf('--last');
  const lastN = lastIdx >= 0 ? Number(args[lastIdx + 1]) : 50;
  const follow = args.includes('--follow');

  if (follow) {
    // 持续跟随：每次 cat 尾部 N 行（Android toybox tail 可用）
    let lastSeq = '';
    const interval = setInterval(() => {
      try {
        const out = adb(device, 'shell', `tail -n ${lastN} ${EVENTS_LOG} 2>/dev/null`);
        if (out && out !== lastSeq) {
          const delta = lastSeq ? out.split('\n').filter(Boolean).slice(-lastN) : out.split('\n');
          delta.filter(Boolean).forEach(line => console.log(line));
          lastSeq = out;
        }
      } catch {
        // 事件流未就绪则静默重试
      }
    }, 1000);
    process.on('SIGINT', () => {
      clearInterval(interval);
      process.exit(0);
    });
  } else {
    try {
      const out = adb(device, 'shell', `tail -n ${lastN} ${EVENTS_LOG} 2>/dev/null`);
      if (out) {
        console.log(out);
      } else {
        console.log('（事件流为空或文件不存在）');
      }
    } catch (e) {
      console.error(e.message);
      process.exit(1);
    }
  }
}

main();
