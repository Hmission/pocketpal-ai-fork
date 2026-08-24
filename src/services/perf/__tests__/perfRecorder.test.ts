/**
 * PerfRecorder 落盘契约测试（PERF_BENCHMARK_DESIGN §4.2）
 * JSONL：meta 首行 + pt 行 + summary 尾行；被杀无 summary 时读侧重算。
 */
import * as RNFS from '@dr.pogodin/react-native-fs';

import {perfRecorder, type PerfPoint} from '../perfRecorder';

jest.mock('@dr.pogodin/react-native-fs', () => ({
  DocumentDirectoryPath: '/mock/docs',
  mkdir: jest.fn().mockResolvedValue(undefined),
  writeFile: jest.fn().mockResolvedValue(undefined),
  appendFile: jest.fn().mockResolvedValue(undefined),
  readFile: jest.fn().mockResolvedValue(''),
  readDir: jest.fn().mockResolvedValue([]),
  unlink: jest.fn().mockResolvedValue(undefined),
}));

const mkPt = (over: Partial<PerfPoint> = {}): PerfPoint => ({
  ts: Date.now(),
  pssKb: 3 * 1024 * 1024,
  rssKb: 2.5 * 1024 * 1024,
  cpuPct: 80,
  tempC: 40,
  cpuFreqMhz: 3200,
  gpuLoadPct: 70,
  gpuFreqMhz: 840,
  tempCpuC: 41,
  tempGpuC: 39,
  powerMw: 5000,
  stepTime: 12,
  stage: '采样 3/8',
  ...over,
});

describe('PerfRecorder 落盘契约', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    perfRecorder._reset();
    (RNFS.readDir as jest.Mock).mockResolvedValue([]);
    (RNFS.readFile as jest.Mock).mockResolvedValue('');
  });

  it('begin：建目录 + 写 meta 首行（kind=meta，含 taskId）', async () => {
    await perfRecorder.begin({
      taskId: 't1',
      taskType: 'generated',
      modelLabel: 'dreamlite',
      startedAt: 1000,
    });
    expect(perfRecorder.isActive).toBe(true);
    expect(RNFS.mkdir).toHaveBeenCalledWith('/mock/docs/perf');
    const [path, content] = (RNFS.writeFile as jest.Mock).mock.calls[0];
    expect(path).toBe('/mock/docs/perf/perf_t1.jsonl');
    const line = JSON.parse(content.trim());
    expect(line.kind).toBe('meta');
    expect(line.meta.taskId).toBe('t1');
    expect(line.meta.modelLabel).toBe('dreamlite');
  });

  it('append：逐点写 JSONL pt 行（无 active 会话时静默丢弃）', async () => {
    await perfRecorder.begin({taskId: 't2', taskType: 'generated', startedAt: 1});
    await perfRecorder.append(mkPt({pssKb: 4000}));
    const [path, content] = (RNFS.appendFile as jest.Mock).mock.calls[0];
    expect(path).toContain('perf_t2.jsonl');
    expect(JSON.parse(content.trim()).kind).toBe('pt');

    perfRecorder._reset(); // 无 active：静默不写
    await perfRecorder.append(mkPt());
    expect((RNFS.appendFile as jest.Mock).mock.calls.length).toBe(1);
  });

  it('finish：写 summary 行（含跑分卡 + 结果）并复位状态', async () => {
    await perfRecorder.begin({taskId: 't3', taskType: 'generated', startedAt: 1});
    await perfRecorder.append(mkPt({ts: 1000}));
    await perfRecorder.append(mkPt({ts: 2000, pssKb: 4 * 1024 * 1024}));
    await perfRecorder.finish('success');
    expect(perfRecorder.isActive).toBe(false);
    const last = (RNFS.appendFile as jest.Mock).mock.calls.at(-1);
    const line = JSON.parse(last[1].trim());
    expect(line.kind).toBe('summary');
    expect(line.summary.result).toBe('success');
    expect(line.summary.pssPeakKb).toBe(4 * 1024 * 1024);
    expect(line.summary.score.total).toBeGreaterThan(0);
  });

  it('readSession：解析 meta+points+summary；被杀无 summary 时由轨迹重算跑分卡', async () => {
    const meta = {kind: 'meta', meta: {taskId: 't4', taskType: 'generated', startedAt: 1}};
    const p1 = {kind: 'pt', pt: mkPt({ts: 1000})};
    const p2 = {kind: 'pt', pt: mkPt({ts: 2000})};
    (RNFS.readFile as jest.Mock).mockResolvedValue(
      [meta, p1, p2].map(l => JSON.stringify(l)).join('\n') + '\n',
    );
    const session = await perfRecorder.readSession('t4');
    expect(session).not.toBeNull();
    expect(session!.meta.taskId).toBe('t4');
    expect(session!.points).toHaveLength(2);
    expect(session!.result).toBeUndefined(); // 无 summary = 被杀/中断
    expect(session!.score).toBeDefined(); // 重算兜底
  });

  it('readSession：有 summary 时直接使用落盘分数', async () => {
    const meta = {kind: 'meta', meta: {taskId: 't5', taskType: 'generated', startedAt: 1}};
    const summary = {
      kind: 'summary',
      summary: {
        finishedAt: 2000,
        result: 'failed',
        durationMs: 1000,
        pssPeakKb: 100,
        avgStepTime: 12,
        score: {memory: 80, thermal: 90, stability: 95, speed: null, total: 86},
      },
    };
    (RNFS.readFile as jest.Mock).mockResolvedValue(
      [meta, summary].map(l => JSON.stringify(l)).join('\n') + '\n',
    );
    const session = await perfRecorder.readSession('t5');
    expect(session!.result).toBe('failed');
    expect(session!.score!.total).toBe(86);
  });

  it('listSessions：只读首行 meta，按开始时间倒序', async () => {
    (RNFS.readDir as jest.Mock).mockResolvedValue([
      {name: 'perf_a.jsonl', path: '/p/a'},
      {name: 'perf_b.jsonl', path: '/p/b'},
      {name: 'other.txt', path: '/p/o'},
    ]);
    (RNFS.readFile as jest.Mock)
      .mockResolvedValueOnce(JSON.stringify({kind: 'meta', meta: {taskId: 'a', taskType: 'generated', startedAt: 100}}) + '\n')
      .mockResolvedValueOnce(JSON.stringify({kind: 'meta', meta: {taskId: 'b', taskType: 'caption', startedAt: 200}}) + '\n');
    const list = await perfRecorder.listSessions();
    expect(list.map(m => m.taskId)).toEqual(['b', 'a']); // 倒序
  });
});
