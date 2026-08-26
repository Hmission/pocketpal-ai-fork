/**
 * errorReport — 诊断报告单一出口（开发者预览版）
 *
 * 生图失败任务页与聊天报错弹窗共用：
 *  - buildErrorReport：组装完整报告（摘要/错误/上下文/版本/设备/时间）
 *  - copyAndSaveErrorReport：一键复制 + 落盘共享存储（测试员可另发文件）
 */
import {Platform} from 'react-native';
import DeviceInfo from 'react-native-device-info';
import Clipboard from '@react-native-clipboard/clipboard';
import * as RNFS from '@dr.pogodin/react-native-fs';

import {AIOS_ROOT} from './paths';
import {matchFirstError} from '../debug/errorRegistry';
import {emit} from '../debug/eventStream';
import {setLastError} from '../debug/stateSnapshot';

export const AIOS_LOGS_DIR = `${AIOS_ROOT}/logs`;

export type ErrorReportScope = 'chat' | 'imagegen' | 'system';

export interface ErrorReportInput {
  scope: ErrorReportScope;
  /** 一句话摘要（UI 展示用） */
  summary: string;
  /** 原始错误对象（取 message + stack） */
  error?: unknown;
  /** 上下文行（模型名、参数、n_ctx 等，逐行写入报告） */
  extra?: Record<string, string | number | undefined>;
}

export interface ErrorReport {
  summary: string;
  detail: string;
}

function errorToString(error: unknown): {message: string; stack: string} {
  if (error instanceof Error) {
    return {message: error.message, stack: error.stack ?? ''};
  }
  if (typeof error === 'string') {
    return {message: error, stack: ''};
  }
  try {
    return {message: JSON.stringify(error), stack: ''};
  } catch {
    return {message: String(error), stack: ''};
  }
}

/**
 * 组装完整诊断报告文本（纯文本，方便测试员整段复制发出）。
 */
export async function buildErrorReport(
  input: ErrorReportInput,
): Promise<ErrorReport> {
  const {message, stack} = errorToString(input.error);
  const lines: string[] = [];
  lines.push('===== 小黄鸡报错信息（开发者预览版） =====');
  lines.push(`摘要: ${input.summary}`);
  lines.push(`模块: ${input.scope}`);
  lines.push(`时间: ${new Date().toLocaleString()}`);
  // DRC 报错指南针（CP-APP-NNN）：定位/导航/深入三字段，未知错误提示录入
  const compass = matchFirstError(`${input.summary}\n${message}`);
  if (compass) {
    lines.push(`指南针: ${compass.cpId}`);
    lines.push(`导航: ${compass.navigation}`);
    lines.push(`深入: ${compass.deepDive.join(' | ')}`);
    setLastError(compass.cpId, input.summary);
  } else {
    lines.push(
      '指南针: 未收录（建议登记 docs/DebugRemoteControl/COMPASS_REGISTRY.md）',
    );
    setLastError('CP-APP-000', input.summary);
  }
  emit('error', 'error.reported', {
    scope: input.scope,
    summary: input.summary,
    cpId: compass?.cpId ?? 'CP-APP-000',
  });
  try {
    lines.push(
      `应用: v${DeviceInfo.getVersion()} (${DeviceInfo.getBuildNumber()})`,
    );
    lines.push(
      `设备: ${DeviceInfo.getBrand()} ${DeviceInfo.getModel()} / Android ${
        Platform.Version
      }`,
    );
  } catch {
    // DeviceInfo 异常不影响报告主体
  }
  if (input.extra) {
    for (const [k, v] of Object.entries(input.extra)) {
      if (v !== undefined && v !== '') {
        lines.push(`${k}: ${v}`);
      }
    }
  }
  lines.push('--- 错误详情 ---');
  lines.push(message || '(无错误消息)');
  if (stack) {
    lines.push('--- 堆栈 ---');
    lines.push(stack);
  }
  lines.push('===== 报告结束 =====');
  return {summary: input.summary, detail: lines.join('\n')};
}

/**
 * 一键复制完整报告到剪贴板，并落盘共享存储
 *（/sdcard/Documents/AIOS/logs/error_<ts>.txt，卸载不丢，可另发文件）。
 * 返回落盘路径（失败为 null）。
 */
export async function copyAndSaveErrorReport(
  report: ErrorReport,
): Promise<string | null> {
  Clipboard.setString(report.detail);
  try {
    if (!(await RNFS.exists(AIOS_LOGS_DIR))) {
      await RNFS.mkdir(AIOS_LOGS_DIR);
    }
    const ts = new Date()
      .toISOString()
      .replace(/[-:]/g, '')
      .replace('T', '_')
      .slice(0, 15);
    const path = `${AIOS_LOGS_DIR}/error_${ts}.txt`;
    await RNFS.writeFile(path, report.detail, 'utf8');
    return path;
  } catch (e) {
    console.warn('[errorReport] save failed:', e);
    return null;
  }
}
