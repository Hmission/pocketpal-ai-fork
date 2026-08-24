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

  markAsSubmitted(uuid: string) {
    runInAction(() => {
      const result = this.results.find(r => r.uuid === uuid);
      if (result) {
        result.submitted = true;
      }
    });
  }

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
