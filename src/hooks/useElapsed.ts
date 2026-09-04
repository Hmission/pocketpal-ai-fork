import {useEffect, useRef, useState} from 'react';

/**
 * useElapsed — 通话时长计时（PHONE_SPEC §10.2，纯数字轻量 hook）。
 *
 * active 翻转 true 起秒表，false 冻结；返回累计秒数。首版无暂停/分段语义
 *（挂断即结束）。驱动方式：1s interval（JS 侧仅数字 state，无动画资产）。
 */
export function useElapsed(active: boolean): number {
  const [elapsed, setElapsed] = useState(0);
  const startedAtRef = useRef<number | null>(null);

  useEffect(() => {
    if (!active) {
      startedAtRef.current = null;
      setElapsed(0);
      return;
    }
    startedAtRef.current = Date.now();
    const timer = setInterval(() => {
      const base = startedAtRef.current ?? Date.now();
      setElapsed(Math.floor((Date.now() - base) / 1000));
    }, 1000);
    return () => clearInterval(timer);
  }, [active]);

  return elapsed;
}

/** 秒 → mm:ss（通话时长展示，纯数字无 l10n） */
export const formatElapsed = (seconds: number): string => {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
};
