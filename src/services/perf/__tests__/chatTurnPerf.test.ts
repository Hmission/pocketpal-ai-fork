/**
 * chatTurnPerf 测试（B40 §11.2）：回合遥测的起采/冻结/丢弃语义。
 * 诚实口径：<2 点返 null（不画无米之炊）、采样失败跳过该点不编造。
 */
import NativeHardwareInfo from '../../../specs/NativeHardwareInfo';
import {chatTurnPerf} from '../chatTurnPerf';

jest.mock('../../../specs/NativeHardwareInfo', () => ({
  __esModule: true,
  default: {
    getPerfSnapshot: jest.fn(),
  },
}));

const mockSnapshot = NativeHardwareInfo.getPerfSnapshot as jest.Mock;

const SNAP = {
  pssKb: 4 * 1024 * 1024,
  rssKb: 3 * 1024 * 1024,
  cpuPct: 80,
  tempC: 40,
  cpuFreqMhz: 3000,
  gpuLoadPct: 60,
  gpuFreqMhz: 800,
  tempCpuC: 41,
  tempGpuC: 39,
  powerMw: 5000,
};

describe('chatTurnPerf — 聊天回合遥测（B40 §11.2）', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    chatTurnPerf.cancel();
    mockSnapshot.mockReset();
  });
  afterEach(() => {
    chatTurnPerf.cancel();
    jest.useRealTimers();
  });

  it('未起采直接 finish → null', () => {
    expect(chatTurnPerf.finish()).toBeNull();
  });

  it('<2 个采样点 → 诚实返 null（不画无米之炊）', async () => {
    mockSnapshot.mockResolvedValue(SNAP);
    chatTurnPerf.begin();
    // 首点立即采样（微任务），此后无 1s 采样 → 仅 1 点
    await jest.advanceTimersByTimeAsync(10);
    expect(chatTurnPerf.finish()).toBeNull();
  });

  it('≥2 点冻结摘要：峰值/均 CPU/温升口径正确', async () => {
    mockSnapshot
      .mockResolvedValueOnce({...SNAP, pssKb: 4 * 1024 * 1024, tempC: 38})
      .mockResolvedValueOnce({...SNAP, pssKb: 5 * 1024 * 1024, tempC: 40})
      .mockResolvedValue({...SNAP, pssKb: 4.5 * 1024 * 1024, tempC: 42});
    chatTurnPerf.begin();
    await jest.advanceTimersByTimeAsync(2100);
    const sum = chatTurnPerf.finish();
    expect(sum).not.toBeNull();
    expect(sum!.points.length).toBeGreaterThanOrEqual(2);
    expect(sum!.pssPeakKb).toBe(5 * 1024 * 1024);
    expect(sum!.avgCpuPct).toBeCloseTo(80);
    expect(sum!.tempRiseC).toBeCloseTo(4); // 42 - 38
    expect(sum!.durationMs).toBeGreaterThanOrEqual(0);
  });

  it('采样失败跳过该点（稀疏好过造假）', async () => {
    mockSnapshot
      .mockResolvedValueOnce(SNAP)
      .mockRejectedValueOnce(new Error('sysfs busy'))
      .mockResolvedValueOnce({...SNAP, tempC: 41});
    chatTurnPerf.begin();
    await jest.advanceTimersByTimeAsync(2100);
    const sum = chatTurnPerf.finish();
    expect(sum).not.toBeNull();
    expect(sum!.points.length).toBe(2); // 失败点不计入
  });

  it('cancel 丢弃残迹（失败回合不留演出痕迹）', async () => {
    mockSnapshot.mockResolvedValue(SNAP);
    chatTurnPerf.begin();
    await jest.advanceTimersByTimeAsync(2100);
    chatTurnPerf.cancel();
    expect(chatTurnPerf.finish()).toBeNull();
  });
});
