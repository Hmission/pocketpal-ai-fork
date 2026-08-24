/**
 * BenchmarkScreen 测试（B39 总控台，PERF_BENCHMARK_DESIGN §10.7）
 * 编排器整体 mock（单测不真跑用例；链路验收走真机人类模拟路径）。
 */
import React from 'react';
import {runInAction} from 'mobx';

import {fireEvent, render} from '../../../../jest/test-utils';

import {BenchmarkScreen} from '../BenchmarkScreen';
import {benchmarkStore} from '../../../store';
import type {BenchmarkResult} from '../../../utils/types';

jest.mock('../../../services/benchmarkOrchestrator', () => ({
  benchmarkOrchestrator: {start: jest.fn(), abort: jest.fn()},
  BENCH_ENDURANCE_ROUNDS: 3,
}));

const suiteResult: BenchmarkResult = {
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
  uuid: 'u-suite',
  wallTimeMs: 180000,
  suiteCase: 'suite',
  suite: {
    tokAvg: 15.2,
    ttftMs: 800,
    stepAvg: 2.1,
    pssPeakKb: 4 * 1024 * 1024,
    tempRiseC: 3.2,
    score: {memory: 82, thermal: 88, stability: 95, speed: null, total: 78},
  },
};

const legacyResult: BenchmarkResult = {
  ...suiteResult,
  uuid: 'u-legacy',
  suiteCase: undefined,
  suite: undefined,
  ppAvg: 120.5,
  tgAvg: 15.2,
  config: {pp: 512, tg: 128, pl: 1, nr: 3, label: 'Default'},
};

describe('BenchmarkScreen — 基准测试总控台（B39）', () => {
  beforeEach(() => {
    runInAction(() => {
      benchmarkStore.results = [];
      benchmarkStore.endSuite();
      benchmarkStore.clearSuiteError();
    });
    jest.clearAllMocks();
  });

  it('空闲态：一键跑分按钮在场（start-test-button testID 契约）', () => {
    const {getByTestId} = render(<BenchmarkScreen />);
    expect(getByTestId('start-test-button')).toBeTruthy();
  });

  it('点一键跑分触发编排器', () => {
    const {
      benchmarkOrchestrator,
    } = require('../../../services/benchmarkOrchestrator');
    const {getByTestId} = render(<BenchmarkScreen />);
    fireEvent.press(getByTestId('start-test-button'));
    expect(benchmarkOrchestrator.start).toHaveBeenCalled();
  });

  it('套件运行中：横幅 + 终止按钮（耐久可终止）', () => {
    runInAction(() => {
      benchmarkStore.startSuite();
      benchmarkStore.setCase(0, 'llm');
    });
    const {getByTestId, getByText} = render(<BenchmarkScreen />);
    expect(getByTestId('suite-running')).toBeTruthy();
    // 用例 key → l10n 标签（测试默认英文）
    expect(getByText('Test 1/3 · LLM Speed')).toBeTruthy();
    expect(getByTestId('suite-abort-button')).toBeTruthy();
  });

  it('套件失败诚实报错（不兜底）+ 可关闭', () => {
    runInAction(() => benchmarkStore.failSuite('聊天模型未加载'));
    const {getByTestId, getByText} = render(<BenchmarkScreen />);
    expect(getByTestId('suite-error')).toBeTruthy();
    expect(getByText('聊天模型未加载')).toBeTruthy();
  });

  it('最新套件结果：揭幕综合分 + 四轴雷达 + 段位', () => {
    runInAction(() => benchmarkStore.addResult(suiteResult));
    const {getByTestId} = render(<BenchmarkScreen />);
    expect(getByTestId('suite-total-reveal')).toBeTruthy();
    expect(getByTestId('suite-radar')).toBeTruthy();
    expect(getByTestId('suite-rank')).toBeTruthy();
  });

  it('旧协议结果诚实渲染（不洗数据）', () => {
    runInAction(() => benchmarkStore.addResult(legacyResult));
    const {getByText} = render(<BenchmarkScreen />);
    expect(getByText(/Legacy protocol/)).toBeTruthy();
  });
});
