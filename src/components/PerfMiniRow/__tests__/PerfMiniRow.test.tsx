/**
 * PerfMiniRow 紧凑遥测条测试（PERF_BENCHMARK_DESIGN v1.3）。
 *
 * 2026-08-31 单位回归修复（引入即错）：pssKb（KB）曾直接喂 gbTinyFmt
 * （`n.toFixed(1)+'G'`）→ 4.2GB=4404019KB 显示成「4404019.0G」。
 * 本套件钉死换算契约：大字与内存胶囊必须 KB→GB（4.2G），原始 KB 值一律不出现；
 * N/A 诚实显 '--'，不编造。
 */
import React from 'react';
import {fireEvent} from '@testing-library/react-native';
import {render} from '../../../../jest/test-utils';
import {PerfMiniRow} from '../PerfMiniRow';

const GB = 1024 * 1024;
/** 完整 P1 快照（与 PerfPanel 测试同构；tempGpuC/tempCpuC 供分区温度选取链） */
const SNAP = {
  pssKb: 4.2 * GB,
  rssKb: 3.5 * GB,
  cpuPct: 87.5,
  tempC: 41.2,
  cpuFreqMhz: 3200,
  gpuLoadPct: 76,
  gpuFreqMhz: 840,
  tempCpuC: 43.1,
  tempGpuC: 41.4,
  powerMw: 6200,
};

describe('PerfMiniRow（紧凑遥测条）', () => {
  it('空 history → PSS 大字与胶囊全部 --（诚实不编造）', () => {
    const {getByTestId, getAllByText} = render(<PerfMiniRow history={[]} />);
    expect(getByTestId('perf-mini-pss').props.children).toBe('--');
    expect(getAllByText('--').length).toBeGreaterThan(0);
  });

  it('PSS 大字与内存胶囊 KB→GB 换算（2026-08-31 回归修复）', () => {
    const {getByTestId, getAllByText, queryAllByText} = render(
      <PerfMiniRow history={[SNAP]} testIDPrefix="pending-indicator" />,
    );
    // 大字：4404019KB → 4.2G（不允许显示原始 KB 位数）
    expect(getByTestId('pending-indicator-pss').props.children).toBe('4.2G');
    // 内存胶囊同源换算：大字 + 胶囊共两处 4.2G
    const shown = getAllByText('4.2G');
    expect(shown.length).toBeGreaterThanOrEqual(2);
    // 回归哨兵：任何「4404019…G」形态都不许出现
    expect(queryAllByText(/4404019/)).toHaveLength(0);
  });

  it("PSS N/A（-1）→ 大字 '--'，CPU/温度胶囊不受影响", () => {
    const {getByTestId} = render(
      <PerfMiniRow history={[{...SNAP, pssKb: -1}]} />,
    );
    expect(getByTestId('perf-mini-pss').props.children).toBe('--');
  });

  it('CPU 与温度胶囊正常渲染（分区温度优先 GPU 区）', () => {
    const {getAllByText} = render(<PerfMiniRow history={[SNAP]} />);
    // cpuPct 87.5 → 88%；tempGpuC 41.4 → 41°C（GPU 区优先于整机 41.2）
    expect(getAllByText('88%').length).toBeGreaterThanOrEqual(1);
    expect(getAllByText('41°C').length).toBeGreaterThanOrEqual(1);
  });

  it('默认展开渲染面积图容器；点折叠头收起后图移除', () => {
    const {getByTestId, queryByTestId} = render(
      <PerfMiniRow history={[SNAP]} />,
    );
    expect(getByTestId('perf-mini-area-chart')).toBeTruthy();
    // 折叠头（TouchableOpacity）点按收起
    fireEvent.press(getByTestId('perf-mini-perf-toggle'));
    expect(queryByTestId('perf-mini-area-chart')).toBeNull();
  });
});
