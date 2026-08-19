#!/usr/bin/env node
/**
 * drc/adb.js — DRC 开发机侧 adb 共享模块（跨平台 Node，无第三方依赖）
 *
 * 用法（内部共享，勿直接执行）：
 *   const {resolveDevice, adb} = require('./adb');
 *
 * DRC 路径常量与 App 侧 src/utils/paths.ts 保持一致：
 *   AIOS_ROOT=/sdcard/Documents/AIOS
 *   commands/ results/ logs/events.jsonl logs/state.json
 */
const {execFileSync} = require('child_process');

const AIOS_ROOT = '/sdcard/Documents/AIOS';
const DRC_COMMANDS_DIR = `${AIOS_ROOT}/drc/commands`;
const DRC_RESULTS_DIR = `${AIOS_ROOT}/drc/results`;
const EVENTS_LOG = `${AIOS_ROOT}/logs/events.jsonl`;
const STATE_JSON = `${AIOS_ROOT}/logs/state.json`;

/** 解析设备参数：优先 --device <id>，否则 adb devices 第一台在线设备 */
function resolveDevice(args = process.argv.slice(2)) {
  const idx = args.indexOf('--device');
  if (idx >= 0 && args[idx + 1]) {
    return args[idx + 1];
  }
  try {
    const out = execFileSync('adb', ['devices'], {encoding: 'utf8'});
    const lines = out.split('\n').slice(1);
    for (const line of lines) {
      const parts = line.trim().split(/\s+/);
      if (parts.length >= 2 && parts[1] === 'device') {
        return parts[0];
      }
    }
  } catch {
    // 无 adb 时由调用方给出可读错误
  }
  return null;
}

/** 执行 adb 命令（带 --device 前缀），返回 stdout 去尾换行 */
function adb(device, ...args) {
  const cmd = device ? ['-s', device, ...args] : [...args];
  try {
    return execFileSync('adb', cmd, {encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe']}).trim();
  } catch (e) {
    const stderr = (e.stderr && e.stderr.toString()) || e.message;
    throw new Error(`adb ${args.join(' ')} 失败: ${stderr}`);
  }
}

/** 确保 DRC 目录存在（幂等；目录不存在时 adb push 会失败） */
function ensureDirs(device) {
  adb(device, 'shell', `mkdir -p ${DRC_COMMANDS_DIR} ${DRC_RESULTS_DIR} ${AIOS_ROOT}/logs`);
}

module.exports = {
  AIOS_ROOT,
  DRC_COMMANDS_DIR,
  DRC_RESULTS_DIR,
  EVENTS_LOG,
  STATE_JSON,
  resolveDevice,
  adb,
  ensureDirs,
};
