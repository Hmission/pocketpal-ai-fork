/**
 * EngineStatus — 统一引擎状态源（调度叙事的状态中枢）
 *
 * 三引擎 prompter(常驻) / chat / image 的 phase/progress/stage/error 单一来源。
 * 消费方：ActiveTaskBanner（聊天内任务卡片）。B18 §17 后状态栏整行删除，
 * 引擎就绪信息融入顶栏模型胶囊（ChatHeader）。
 * 生产方：promptWriter / ModelStore / imageGenStore 在生命周期节点写入。
 *
 * 锋利原则：只做状态镜像与派生，不驱动任何 native 调用。
 */
import {makeAutoObservable, runInAction} from 'mobx';
import {emit} from '../debug/eventStream';

export type EngineKind = 'prompter' | 'chat' | 'image';
export type EnginePhase = 'idle' | 'loading' | 'ready' | 'running' | 'error';

export interface EngineState {
  phase: EnginePhase;
  /** 0-100；-1 表示无进度 */
  progress: number;
  /** 当前阶段文本（如 "采样 3/8"） */
  stage: string;
  error: string | null;
}

const fresh = (): EngineState => ({
  phase: 'idle',
  progress: -1,
  stage: '',
  error: null,
});

class EngineStatus {
  engines: Record<EngineKind, EngineState> = {
    prompter: fresh(),
    chat: fresh(),
    image: fresh(),
  };

  /** 变更订阅（DrcBridge 接线刷新 state.json；观测不为 SPOF，监听器异常静默） */
  private listeners = new Set<() => void>();

  onChange(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(): void {
    for (const fn of this.listeners) {
      try {
        fn();
      } catch {
        // 监听器异常静默（BT07）
      }
    }
  }

  constructor() {
    makeAutoObservable(this);
  }

  setPhase(kind: EngineKind, phase: EnginePhase, stage = ''): void {
    runInAction(() => {
      const e = this.engines[kind];
      e.phase = phase;
      if (stage) {
        e.stage = stage;
      }
      if (phase !== 'error') {
        e.error = null;
      }
      if (phase === 'idle' || phase === 'ready') {
        e.progress = -1;
        e.stage = '';
      }
    });
    emit('engine', 'state.change', {kind, phase, stage}, `engine:${kind}`);
    this.notify();
  }

  setProgress(kind: EngineKind, progress: number, stage = ''): void {
    runInAction(() => {
      const e = this.engines[kind];
      e.progress = progress;
      if (stage) {
        e.stage = stage;
      }
    });
    emit('engine', 'state.change', {kind, progress, stage}, `engine:${kind}`);
    this.notify();
  }

  setError(kind: EngineKind, error: string): void {
    runInAction(() => {
      const e = this.engines[kind];
      e.phase = 'error';
      e.error = error;
      e.progress = -1;
    });
    emit('engine', 'state.change', {kind, phase: 'error', error});
    this.notify();
  }

  /** 当前是否有引擎处于需要用户感知的活跃态（驱动任务卡片显示） */
  get busy(): EngineKind | null {
    for (const k of ['image', 'chat', 'prompter'] as EngineKind[]) {
      const p = this.engines[k].phase;
      if (p === 'loading' || p === 'running' || p === 'error') {
        return k;
      }
    }
    return null;
  }
}

export const engineStatus = new EngineStatus();
