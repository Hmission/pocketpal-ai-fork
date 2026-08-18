/**
 * screenReader — 只读读屏桥（SCREENWATCH_SPEC v1，P11）。
 *
 * 封装原生 ScreenReaderModule：读当前屏 a11y 精简树 / 查服务状态 / 跳无障碍设置。
 * 零写路径——原生侧不存在任何点击/输入/滑动接口。
 */
import {NativeModules} from 'react-native';

const ScreenReader: any = NativeModules.ScreenReader;

export const SCREEN_READER_DISABLED = 'SCREEN_READER_DISABLED';

/** 无障碍服务是否已开启 */
export async function isScreenReaderEnabled(): Promise<boolean> {
  try {
    return (await ScreenReader?.isServiceEnabled()) === true;
  } catch {
    return false;
  }
}

/**
 * 读当前屏精简树。服务未开启 reject SCREEN_READER_DISABLED（调用方显式引导）。
 */
export async function readScreen(): Promise<string> {
  return await ScreenReader.readScreen();
}

/** 跳转系统无障碍设置页（用户手动开启，App 不代授） */
export function openAccessibilitySettings(): void {
  ScreenReader?.openAccessibilitySettings();
}
