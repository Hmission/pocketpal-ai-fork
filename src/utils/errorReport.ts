/**
 * errorReport — 诊断报告单一出口（开发者预览版）
 *
 * 生图失败任务页与聊天报错弹窗共用：
 *  - buildErrorReport：组装完整报告（摘要/错误/上下文/版本/设备/时间）
 *  - saveErrorReport：只落盘（全局异常出口用，不抢剪贴板）
 *  - copyAndSaveErrorReport：一键复制 + 落盘共享存储（测试员可另发文件）
 *  - registerGlobalErrorReporter：RN 全局 JS 异常唯一出口（CORE-8）
 */
import {Platform} from 'react-native';
import DeviceInfo from 'react-native-device-info';
import Clipboard from '@react-native-clipboard/clipboard';
import * as RNFS from '@dr.pogodin/react-native-fs';

import {AIOS_LOGS_DIR} from './paths';
import {matchFirstError} from '../debug/errorRegistry';
import {emit} from '../debug/eventStream';
import {setLastError} from '../debug/stateSnapshot';

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
 * 落盘报告到共享存储（/sdcard/Documents/AIOS/logs/error_<ts>.txt，卸载不丢）。
 * 返回落盘路径（失败为 null）。从 copyAndSaveErrorReport 拆出：全局异常上报只存不复制
 *（崩溃时抢用户剪贴板是错的），两个出口共用手写盘单点。
 */
export async function saveErrorReport(
  report: ErrorReport,
): Promise<string | null> {
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

/**
 * 一键复制完整报告到剪贴板，并落盘共享存储。
 * 返回落盘路径（失败为 null）。
 */
export async function copyAndSaveErrorReport(
  report: ErrorReport,
): Promise<string | null> {
  Clipboard.setString(report.detail);
  return saveErrorReport(report);
}

/**
 * 🔴 全局 JS 异常出口（2026-09-09 立项，SPEC §七 CORE-8）。
 *
 * 立项缘由：此前全仓 `setGlobalHandler` / `ErrorUtils` **零命中**，`error_*.txt` 只在
 * 用户主动点「报错」时落盘。后果是结构性的：RN 红屏 / 未接住的 rejection 必然无档——
 * 真机一次 `TypeError: Cannot read property 'catch' of undefined` 使 DRC 停摆 3.6 分，
 * 我们只能拿着 bundle 偏移（1:2471684）无法归因，就是因为缺这个出口。
 *
 * 三条约束：
 * 1. **不吞旧 handler**：dev 包红屏必须继照显示（它是开发者看错的第一手段），本函数
 *    只做“额外留档”，不做替代；release 无红屏时它就是唯一痕迹。
 * 2. **不抢剪贴板**：走 saveErrorReport，不走 copyAndSave。
 * 3. **不得递归**：上报自身失败只 console，不再进本函数（否则一个落盘错会变成死循环）。
 */
export function registerGlobalErrorReporter(): void {
  const prior = ErrorUtils.getGlobalHandler?.();
  let inFlight = false;
  ErrorUtils.setGlobalHandler(async (error: unknown, isFatal?: boolean) => {
    if (!inFlight) {
      inFlight = true;
      try {
        const {message} = errorToString(error);
        const report = await buildErrorReport({
          scope: 'system',
          summary: `全局 JS 异常${isFatal ? '（致命）' : ''}: ${
            message.slice(0, 120) || '(无消息)'
          }`,
          error,
        });
        const path = await saveErrorReport(report);
        console.error(
          '[errorReport] 全局异常已落盘:',
          path ?? '落盘失败',
          error,
        );
      } catch (e) {
        // 上报链自身失败：只留 console，不再进入本函数
        console.error('[errorReport] 全局异常上报失败:', e);
      } finally {
        inFlight = false;
      }
    }
    // 交回原 handler（dev 红屏 / 原上报照旧）
    if (prior) {
      prior(error, isFatal);
    }
  });
}
