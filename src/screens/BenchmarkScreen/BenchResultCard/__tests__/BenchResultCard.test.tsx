/**
 * BenchResultCard 测试（B39 v2，PERF_BENCHMARK_DESIGN §10.7）
 * 新协议套件卡（综合分/分项）+ 旧协议诚实标记 + 删除回调；云提交链已砍。
 */
import React from 'react';
import {fireEvent, render} from '../../../../../jest/test-utils';

import {BenchResultCard} from '../BenchResultCard';
import type {BenchmarkResult} from '../../../../utils/types';

const baseResult: BenchmarkResult = {
  config: {pp: 0, tg: 0, pl: 1, nr: 1, label: 'suite'},
  modelDesc: 'test',
  modelSize: 0,
  modelNParams: 0,
  ppAvg: 0,
  ppStd: 0,
  tgAvg: 0,
  tgStd: 0,
  timestamp: new Date().toISOString(),
  modelId: 'test',
  modelName: '测试模型',
  uuid: 'u-1',
};

const suiteResult: BenchmarkResult = {
  ...baseResult,
  suiteCase: 'suite',
  wallTimeMs: 180000,
  suite: {
    tokAvg: 15.2,
    ttftMs: 800,
    stepAvg: 2.1,
    pssPeakKb: 4 * 1024 * 1024,
    tempRiseC: 3.2,
    score: {memory: 82, thermal: 88, stability: 95, speed: null, total: 78},
  },
};

describe('BenchResultCard（B39 v2：砍云提交，双协议诚实渲染）', () => {
  it('新协议套件卡：综合分 + 分项 + 推理/生图实测', () => {
    const {getByTestId, getByText} = render(
      <BenchResultCard result={suiteResult} onDelete={jest.fn()} />,
    );
    expect(getByTestId('suite-result')).toBeTruthy();
    expect(getByText(/78/)).toBeTruthy(); // 综合分
    expect(getByText(/15\.2/)).toBeTruthy(); // tok/s
    expect(getByText(/2\.1/)).toBeTruthy(); // s/步
  });

  it('旧协议诚实标「Legacy protocol」，不洗数据', () => {
    const legacy: BenchmarkResult = {
      ...baseResult,
      uuid: 'u-2',
      ppAvg: 120.5,
      tgAvg: 15.2,
      config: {pp: 512, tg: 128, pl: 1, nr: 3, label: 'Default'},
    };
    const {getByText, queryByTestId} = render(
      <BenchResultCard result={legacy} onDelete={jest.fn()} />,
    );
    expect(getByText(/Legacy protocol/)).toBeTruthy();
    expect(queryByTestId('suite-result')).toBeNull();
  });

  it('删除按钮回调透传', () => {
    const onDelete = jest.fn();
    const {getByTestId} = render(
      <BenchResultCard result={suiteResult} onDelete={onDelete} />,
    );
    fireEvent.press(getByTestId('delete-result-button'));
    expect(onDelete).toHaveBeenCalledWith(suiteResult.timestamp);
  });

  it('速度分项缺失（null）时不渲染假数', () => {
    const {queryByText} = render(
      <BenchResultCard result={suiteResult} onDelete={jest.fn()} />,
    );
    // speed=null → 卡片层不显示速度分项（雷达层置灰显「—」）
    expect(queryByText('速度分')).toBeNull();
  });
});
