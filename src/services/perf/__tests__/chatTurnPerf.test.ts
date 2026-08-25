/**
 * chatTurnPerf 测试（B40 §11.2 / B41 留存）：回合遥测的起采/冻结/丢弃语义
 * + 落盘委托（逐点进 perfRecorder，可回看）。
 * 诚实口径：<2 点返 null（不画无米之炊）、采样失败跳过该点不编造。
 */
import NativeHardwareInfo from '../../../specs/NativeHardwareInfo';
import {chatTurnPerf, CHAT_TURN_TASK_TYPE} from '../chatTurnPerf';
import {perfRecorder} from '../perfRecorder';

jest.mock('../../../specs/NativeHardwareInfo', () => ({
  __esModule: true,
  default: {
    getPerfSnapshot: jest.fn(),
  },
}));

// B41 留存：落盘委托 mock（不触真实 RNFS）
jest.mock('../perfRecorder', () => ({
  perfRecorder: {
    begin: jest.fn().mockResolvedValue(undefined),
    append: jest.fn().mockResolvedValue(undefined),
    finish: jest.fn().mockResolvedValue(undefined),
    removeSession: jest.fn().mockResolvedValue(undefined),
  },
}));

const mockSnapshot = NativeHardwareInfo.getPerfSnapshot as jest.Mock;
const recBegin = perfRecorder.begin as jest.Mock;
const recAppend = perfRecorder.append as jest.Mock;
const recFinish = perfRecorder.finish as jest.Mock;
const recRemove = perfRecorder.removeSession as jest.Mock;

const META = {taskId: 'msg-1', modelLabel: 'Qwen 2B'};

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

describe('chatTurnPerf — 聊天回合遥测（B40 §11.2 / B41 留存）', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    chatTurnPerf.cancel();
    mockSnapshot.mockReset();
    recBegin.mockClear();
    recAppend.mockClear();
    recFinish.mockClear();
    recRemove.mockClear();
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
    chatTurnPerf.begin(META);
    // 首点立即采样（微任务），此后无 1s 采样 → 仅 1 点
    await jest.advanceTimersByTimeAsync(10);
    expect(chatTurnPerf.finish()).toBeNull();
  });

  it('≥2 点冻结摘要：峰值/均 CPU/温升口径正确', async () => {
    mockSnapshot
      .mockResolvedValueOnce({...SNAP, pssKb: 4 * 1024 * 1024, tempC: 38})
      .mockResolvedValueOnce({...SNAP, pssKb: 5 * 1024 * 1024, tempC: 40})
      .mockResolvedValue({...SNAP, pssKb: 4.5 * 1024 * 1024, tempC: 42});
    chatTurnPerf.begin(META);
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
    chatTurnPerf.begin(META);
    await jest.advanceTimersByTimeAsync(2100);
    const sum = chatTurnPerf.finish();
    expect(sum).not.toBeNull();
    expect(sum!.points.length).toBe(2); // 失败点不计入
  });

  it('cancel 丢弃残迹（失败回合不留演出痕迹）', async () => {
    mockSnapshot.mockResolvedValue(SNAP);
    chatTurnPerf.begin(META);
    await jest.advanceTimersByTimeAsync(2100);
    chatTurnPerf.cancel();
    expect(chatTurnPerf.finish()).toBeNull();
  });

  // ---------- B41 留存：落盘委托 ----------

  it('begin 落盘 meta（chat-turn 任务类型 + 模型标签）', async () => {
    mockSnapshot.mockResolvedValue(SNAP);
    chatTurnPerf.begin(META);
    await jest.advanceTimersByTimeAsync(10);
    expect(recBegin).toHaveBeenCalledWith(
      expect.objectContaining({
        taskId: 'msg-1',
        taskType: CHAT_TURN_TASK_TYPE,
        modelLabel: 'Qwen 2B',
      }),
    );
  });

  it('逐点增量落盘（可回看的断点轨迹）', async () => {
    mockSnapshot.mockResolvedValue(SNAP);
    chatTurnPerf.begin(META);
    await jest.advanceTimersByTimeAsync(2100); // 首点 + 2 个 1s 点 = 3 点
    expect(recAppend.mock.calls.length).toBeGreaterThanOrEqual(2);
    chatTurnPerf.finish();
  });

  it('finish 落盘 success 收尾（进统一历史）', async () => {
    mockSnapshot.mockResolvedValue(SNAP);
    chatTurnPerf.begin(META);
    await jest.advanceTimersByTimeAsync(2100);
    chatTurnPerf.finish();
    await jest.advanceTimersByTimeAsync(10);
    expect(recFinish).toHaveBeenCalledWith('success');
  });

  it('cancel 删落盘残迹（失败回合不入库）', async () => {
    mockSnapshot.mockResolvedValue(SNAP);
    chatTurnPerf.begin(META);
    await jest.advanceTimersByTimeAsync(1100);
    chatTurnPerf.cancel();
    expect(recRemove).toHaveBeenCalledWith('msg-1');
  });
});
