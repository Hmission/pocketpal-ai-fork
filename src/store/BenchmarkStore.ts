import {makeAutoObservable, runInAction} from 'mobx';
import {makePersistable} from 'mobx-persist-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {BenchmarkResult} from '../utils/types';
import {
  migrateBenchmarkResults,
  migrateBenchmarkResult,
} from '../utils/benchmarkMigration';

/** 套件用例顺序（B39 §10.7）：推理速度 → 生图速度 → 温控耐久 */
export const SUITE_CASES = ['llm', 'gen', 'endurance'] as const;

/**
 * 用例 key → l10n 标签键（取词在 `l10n.benchmark.suite.labels.*`）。
 *
 * **唯一定义点**（2026-09-07 W5 双份常量收口）：旧写法是 `BenchmarkScreen` 与
 * `BenchmarkHudBar` 各手写一份同名 `CASE_LABEL_KEY`（后者注释只写了「与
 * BenchmarkScreen 同源映射」——靠人记），改用例名会只改一处而横幅与 HUD 分叉。
 * 值停在键名层，不在此绑文案（存储层不拉 l10n）。
 * 下标来自 `suiteBanner`（自由字符串），故值域含 `undefined`，调用侧用真判定而非强转。
 */
export const SUITE_CASE_LABEL_KEY: Record<string, string | undefined> = {
  llm: 'inferSpeed',
  gen: 'genSpeed',
  endurance: 'endurance',
};

export class BenchmarkStore {
  results: BenchmarkResult[] = [];

  // ── 瞬态编排状态（B39；不入持久化 properties，CP-APP-012：
  //    用例结束/失败必须复位，不留半态）──
  /** 套件运行中 */
  suiteRunning = false;
  /** 当前用例序号（-1 = 空闲） */
  suiteCaseIndex = -1;
  /** 导航横幅文案（「测试 2/3 · 切换生图赛道…」） */
  suiteBanner = '';
  /** 套件失败原因（诚实报错，不兜底） */
  suiteError: string | null = null;

  constructor() {
    makeAutoObservable(this);
    makePersistable(this, {
      name: 'BenchmarkStore',
      properties: ['results'],
      storage: AsyncStorage,
    }).then(() => {
      // Migrate benchmark results after loading from storage
      runInAction(() => {
        this.results = migrateBenchmarkResults(this.results);
      });
    });
  }

  addResult(result: BenchmarkResult) {
    runInAction(() => {
      // Migrate the result in case it still has legacy format
      const migratedResult = migrateBenchmarkResult(result);
      this.results.unshift(migratedResult); // Add new result at the beginning
    });
  }

  removeResult(timestamp: string) {
    runInAction(() => {
      this.results = this.results.filter(
        result => result.timestamp !== timestamp,
      );
    });
  }

  clearResults() {
    runInAction(() => {
      this.results = [];
    });
  }

  getResultsByModel(modelId: string): BenchmarkResult[] {
    return this.results.filter(result => result.modelId === modelId);
  }

  get latestResult(): BenchmarkResult | undefined {
    return this.results[0];
  }

  // 注：旧 `markAsSubmitted(uuid)` 已随云提交链删除（2026-09-07 W5 死码纯删）——
  // PERF §10.7 裁定“整体砍除”后仅方法体残留，全仓零生产调用者。

  // ── B39 套件编排（瞬态）──
  startSuite() {
    runInAction(() => {
      this.suiteRunning = true;
      this.suiteCaseIndex = 0;
      this.suiteError = null;
      this.suiteBanner = '';
    });
  }

  setCase(index: number, banner: string) {
    runInAction(() => {
      this.suiteCaseIndex = index;
      this.suiteBanner = banner;
    });
  }

  /** 失败即复位（不留半态）；错误信息留待结果页诚实展示 */
  failSuite(message: string) {
    runInAction(() => {
      this.suiteRunning = false;
      this.suiteCaseIndex = -1;
      this.suiteBanner = '';
      this.suiteError = message;
    });
  }

  endSuite() {
    runInAction(() => {
      this.suiteRunning = false;
      this.suiteCaseIndex = -1;
      this.suiteBanner = '';
    });
  }

  clearSuiteError() {
    runInAction(() => {
      this.suiteError = null;
    });
  }
}

export const benchmarkStore = new BenchmarkStore();
