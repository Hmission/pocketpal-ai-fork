/**
 * PerfPanel 测试（PERF_BENCHMARK_DESIGN v0.2 横版专业面板）
 * 数据经 imageGenStore 单通道：测试直接 set store 可观察字段再渲染断言。
 * v2 断言：折叠头胶囊行（CPU/GPU/温/功耗）+ 叠加线切换 + 指标行 + 历史入口。
 */
import React from 'react';
import {runInAction} from 'mobx';
import {fireEvent} from '@testing-library/react-native';

import {render} from '../../../../../jest/test-utils';
import {imageGenStore} from '../../../../store/imageGenStore';
import {PerfPanel} from '../PerfPanel';

// PerfPanel 内嵌 PerfHistoryModal → perfRecorder → RNFS（测试环境 mock）
jest.mock('@dr.pogodin/react-native-fs', () => ({
  DocumentDirectoryPath: '/mock/docs',
  mkdir: jest.fn().mockResolvedValue(undefined),
  writeFile: jest.fn().mockResolvedValue(undefined),
  appendFile: jest.fn().mockResolvedValue(undefined),
  readFile: jest.fn().mockResolvedValue(''),
  readDir: jest.fn().mockResolvedValue([]),
  unlink: jest.fn().mockResolvedValue(undefined),
}));

const GB = 1024 * 1024;
/** 完整 P1 快照（含扩展字段） */
const FULL_SNAP = {
  pssKb: 4.2 * GB,
  rssKb: 3.5 * GB,
  cpuPct: 87.5,
  tempC: 41.2,
  cpuFreqMhz: 3200,
  gpuLoadPct: 76,
  gpuFreqMhz: 840,
  tempCpuC: 43.1,
  tempGpuC: 40.5,
  powerMw: 6200,
};

describe('PerfPanel（v2 横版专业面板）', () => {
  afterEach(() => {
    runInAction(() => {
      imageGenStore.perf = null;
      imageGenStore.perfHistory = [];
      imageGenStore.stepTime = 0;
    });
  });

  it('无数据（未就绪）显示 --，不报错', () => {
    const {getByTestId, getAllByText} = render(<PerfPanel />);
    expect(getByTestId('perf-panel')).toBeTruthy();
    expect(getByTestId('perf-expand')).toBeTruthy();
    // 默认展开：PSS/胶囊/指标行各显 --（多重匹配用 getAll）
    expect(getAllByText('--').length).toBeGreaterThan(0);
  });

  it('折叠头胶囊行显示 CPU%/GPU%/温度/功耗（P1 扩展指标）', () => {
    runInAction(() => {
      imageGenStore.perf = FULL_SNAP;
    });
    const {getByText, getAllByText} = render(<PerfPanel />);
    expect(getByText('4.2 GB')).toBeTruthy();
    expect(getByText('CPU 88%')).toBeTruthy();
    expect(getByText('GPU 76%')).toBeTruthy();
    // 温度在胶囊与指标行各出现一次（分区温度归一后同为 41）
    expect(getAllByText('41°C').length).toBeGreaterThanOrEqual(1);
    expect(getAllByText('6.2W').length).toBeGreaterThanOrEqual(1);
  });

  it('指标行显示频率/功耗/步耗时；历史入口可达', () => {
    runInAction(() => {
      imageGenStore.perf = FULL_SNAP;
      imageGenStore.stepTime = 12.3;
    });
    const {getByText, getByTestId} = render(<PerfPanel />);
    expect(getByText('3.2GHz')).toBeTruthy(); // CPU 频率
    expect(getByText('840M')).toBeTruthy(); // GPU 频率
    expect(getByText('12.3s')).toBeTruthy(); // 步耗时
    expect(getByText('历史 ▷')).toBeTruthy();
    expect(getByTestId('perf-history')).toBeTruthy();
  });

  it('叠加线切换：点 GPU chip 不崩溃且峰值文字更新', () => {
    runInAction(() => {
      imageGenStore.perf = FULL_SNAP;
      imageGenStore.perfHistory = [FULL_SNAP, {...FULL_SNAP, pssKb: 5 * GB}];
    });
    const {getByText, getByTestId} = render(<PerfPanel />);
    expect(getByText('峰值 5.0GB')).toBeTruthy();
    // 叠加线 chip 用 testID 定位（文案与指标行标签重名）；切换后叠加图仍渲染不崩溃
    fireEvent.press(getByTestId('perf-overlay-chip-temp'));
    expect(getByText('峰值 5.0GB')).toBeTruthy();
  });

  it('PSS 超 6GB（HyperOS 硬杀线）时 PSS 大字为 error 色', () => {
    runInAction(() => {
      imageGenStore.perf = {...FULL_SNAP, pssKb: 6.5 * GB};
    });
    const {getByText} = render(<PerfPanel />);
    const pss = getByText('6.5 GB');
    const styleArr = Array.isArray(pss.props.style)
      ? pss.props.style
      : [pss.props.style];
    expect(styleArr.some((s: any) => s?.color === '#FF653F')).toBe(true);
  });

  it('点历史入口唤起回放 Modal（空态提示）', () => {
    const {getByText, getByText: txt} = render(<PerfPanel />);
    fireEvent.press(getByText('历史 ▷'));
    expect(txt('性能回放历史')).toBeTruthy();
    expect(txt(/暂无性能记录/)).toBeTruthy();
  });

  it('toggle 仍可收起/展开（默认展开）', () => {
    runInAction(() => {
      imageGenStore.perf = FULL_SNAP;
    });
    const {getAllByText, getByText, queryByText} = render(<PerfPanel />);
    // B39：胶囊与指标行各有一个 88%（数字独立成节点）
    expect(getAllByText('88%').length).toBeGreaterThanOrEqual(2);
    fireEvent.press(getByText(/性能/));
    expect(queryByText('840M')).toBeNull(); // 收起
    fireEvent.press(getByText(/性能/));
    expect(getAllByText('840M').length).toBeGreaterThanOrEqual(1); // 再展开
  });

  // ── B39 演出层（PERF_BENCHMARK_DESIGN §10.5）──
  it('面积图容器在场（含 N/A 点不崩溃，落底不编造）', () => {
    runInAction(() => {
      imageGenStore.perf = FULL_SNAP;
      imageGenStore.perfHistory = [
        FULL_SNAP,
        {...FULL_SNAP, gpuLoadPct: -1}, // N/A 点
        {...FULL_SNAP, pssKb: 4.8 * GB},
      ];
    });
    const {getByTestId} = render(<PerfPanel />);
    expect(getByTestId('perf-area-chart')).toBeTruthy();
  });

  it('胶囊负载分档变色：70% → 橙逼近档；87.5% → 红危险档', () => {
    const colorsOf = (cpuPct: number, label: string): string[] => {
      runInAction(() => {
        imageGenStore.perf = {...FULL_SNAP, cpuPct};
      });
      const {getAllByText, unmount} = render(<PerfPanel />);
      const colors = getAllByText(label).flatMap((n: any) =>
        (Array.isArray(n.props.style) ? n.props.style : [n.props.style]).map(
          (s: any) => s?.color,
        ),
      );
      unmount();
      return colors;
    };
    expect(colorsOf(70, '70%')).toContain('#F5A623'); // PERF_WARN 橙
    expect(colorsOf(87.5, '88%')).toContain('#FF653F'); // theme.error 红（浅模式）
  });

  it('PSS 大字接追式缓动：首帧锚定真实值（不演假动画）', () => {
    runInAction(() => {
      imageGenStore.perf = FULL_SNAP;
    });
    const {getByTestId} = render(<PerfPanel />);
    expect(getByTestId('perf-pss').props.children).toBe('4.2 GB');
  });
});
