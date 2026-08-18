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
  }

  setProgress(kind: EngineKind, progress: number, stage = ''): void {
    runInAction(() => {
      const e = this.engines[kind];
      e.progress = progress;
      if (stage) {
        e.stage = stage;
      }
    });
  }

  setError(kind: EngineKind, error: string): void {
    runInAction(() => {
      const e = this.engines[kind];
      e.phase = 'error';
      e.error = error;
      e.progress = -1;
    });
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

  /** 全景摘要（B18 §17 后无消费方，保留供调试/日志） */
  get summary(): string {
    const name: Record<EngineKind, string> = {
      prompter: '管家',
      chat: '对话',
      image: '生图',
    };
    const label: Record<EnginePhase, string> = {
      idle: '',
      loading: '加载中',
      ready: '就绪',
      running: '运行中',
      error: '出错',
    };
    const parts: string[] = [];
    for (const k of ['prompter', 'chat', 'image'] as EngineKind[]) {
      const e = this.engines[k];
      if (e.phase === 'idle') {
        continue;
      }
      let s = `${name[k]}${label[e.phase]}`;
      if ((e.phase === 'loading' || e.phase === 'running') && e.progress >= 0) {
        s += ` ${e.progress}%`;
      }
      parts.push(s);
    }
    return parts.join(' · ') || '待命';
  }
}

export const engineStatus = new EngineStatus();
