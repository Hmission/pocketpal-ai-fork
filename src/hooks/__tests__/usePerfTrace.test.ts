/**
 * usePerfTrace 测试（PHONE_SPEC §11.7）。
 *
 * 三条契约：①在岗即有数据（空闲期自采环境轨迹，跑分卡不再空白）
 * ②生成期**不起第二台采样器**（B1 单采样源，直接显示回合轨迹）
 * ③离开即停采清空（不泄漏 interval）。
 */
import {act, renderHook} from '@testing-library/react-native';

import NativeHardwareInfo from '../../specs/NativeHardwareInfo';
import {chatTurnPerf} from '../../services/perf/chatTurnPerf';
import {usePerfTrace, PERF_TRACE_WINDOW} from '../usePerfTrace';

jest.mock('../../specs/NativeHardwareInfo', () => ({
  __esModule: true,
  default: {getPerfSnapshot: jest.fn()},
}));

jest.mock('../../services/perf/chatTurnPerf', () => ({
  chatTurnPerf: {livePoints: []},
}));

const getSnapshot = NativeHardwareInfo.getPerfSnapshot as jest.Mock;
const GB = 1024 * 1024;

const snapshot = (pssKb: number) => ({
  pssKb,
  rssKb: pssKb * 0.9,
  cpuPct: 12,
  tempC: 40,
});

describe('usePerfTrace — 长驻观测面环境轨迹', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    getSnapshot.mockReset();
    (chatTurnPerf as unknown as {livePoints: unknown[]}).livePoints = [];
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('在岗：首帧即出点，其后 1Hz 追加（stage=ambient）', async () => {
    getSnapshot.mockResolvedValue(snapshot(3 * GB));

    const {result} = renderHook(() => usePerfTrace(true));
    await act(async () => {
      jest.advanceTimersByTime(0);
    });
    expect(result.current).toHaveLength(1);
    expect(result.current[0].stage).toBe('ambient');

    await act(async () => {
      jest.advanceTimersByTime(2000);
    });
    expect(result.current).toHaveLength(3);
    // 真实 PSS 落点（不插值不编造）
    expect(result.current[2].pssKb).toBe(3 * GB);
  });

  it('生成期：回合轨迹非空 → 本面不自采，直接显示回合轨迹（B1 单采样源）', async () => {
    const turnPoints = [
      {
        ts: 1,
        pssKb: 4 * GB,
        rssKb: 4 * GB,
        cpuPct: 88,
        tempC: 45,
        stepTime: 40,
      },
    ];
    (chatTurnPerf as unknown as {livePoints: unknown[]}).livePoints =
      turnPoints;

    const {result} = renderHook(() => usePerfTrace(true));
    await act(async () => {
      jest.advanceTimersByTime(3000);
    });

    expect(getSnapshot).not.toHaveBeenCalled();
    expect(result.current).toEqual(turnPoints);
  });

  it('挂断（active=false）：停采 + 清空，不留残影', async () => {
    getSnapshot.mockResolvedValue(snapshot(3 * GB));

    const {result, rerender} = renderHook(
      ({active}: {active: boolean}) => usePerfTrace(active),
      {initialProps: {active: true}},
    );
    await act(async () => {
      jest.advanceTimersByTime(2000);
    });
    expect(result.current.length).toBeGreaterThan(0);

    rerender({active: false});
    await act(async () => {
      jest.advanceTimersByTime(3000);
    });
    expect(result.current).toEqual([]);
    const callsAfterStop = getSnapshot.mock.calls.length;
    await act(async () => {
      jest.advanceTimersByTime(3000);
    });
    expect(getSnapshot).toHaveBeenCalledTimes(callsAfterStop);
  });

  it('滚动窗口封顶 60 点（长跑不无限增长）', async () => {
    getSnapshot.mockResolvedValue(snapshot(2 * GB));

    const {result} = renderHook(() => usePerfTrace(true));
    await act(async () => {
      jest.advanceTimersByTime((PERF_TRACE_WINDOW + 20) * 1000);
    });
    expect(result.current).toHaveLength(PERF_TRACE_WINDOW);
  });

  it('单点采样失败：跳过该点，轨迹不断（稀疏好过造假）', async () => {
    getSnapshot
      .mockResolvedValueOnce(snapshot(3 * GB))
      .mockRejectedValueOnce(new Error('sysfs busy'))
      .mockResolvedValue(snapshot(3 * GB));

    const {result} = renderHook(() => usePerfTrace(true));
    await act(async () => {
      jest.advanceTimersByTime(3000);
    });
    // 首帧 + 3 次 tick = 4 次尝试，其中 1 次失败 → 轨迹只留 3 个真点
    expect(getSnapshot).toHaveBeenCalledTimes(4);
    expect(result.current).toHaveLength(3);
  });
});
