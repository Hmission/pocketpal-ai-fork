/**
 * stateSnapshot 契约测试：状态快照结构 / 未知状态降级（BT07 观测不为 SPOF）。
 */
import {runInAction} from 'mobx';

import {engineStatus} from '../../store/engineStatus';
import {
  buildStateSnapshot,
  setCurrentRoute,
  setLastError,
  __resetStateSnapshotForTest,
} from '../stateSnapshot';

describe('stateSnapshot', () => {
  beforeEach(() => {
    __resetStateSnapshotForTest();
  });

  it('buildStateSnapshot 含三引擎状态指南针（五字段）', () => {
    const snapshot = buildStateSnapshot();
    expect(snapshot.engines).toHaveProperty('prompter');
    expect(snapshot.engines).toHaveProperty('chat');
    expect(snapshot.engines).toHaveProperty('image');
    for (const compass of Object.values(snapshot.engines)) {
      expect(compass).toHaveProperty('state');
      expect(compass).toHaveProperty('nextAction');
      expect(compass).toHaveProperty('label');
      expect(compass).toHaveProperty('terminal');
    }
  });

  it('引擎 running 态映射 nextAction=await_completion', () => {
    engineStatus.setPhase('chat', 'running', '生成中');
    const snapshot = buildStateSnapshot();
    expect(snapshot.engines.chat.state).toBe('running');
    expect(snapshot.engines.chat.nextAction).toBe('await_completion');
    expect(snapshot.engines.chat.terminal).toBe(false);
  });

  it('未知状态降级 unknown（BT07 不抛异常）', () => {
    runInAction(() => {
      (engineStatus.engines.chat as any).phase = 'weird-phase';
    });
    const snapshot = buildStateSnapshot();
    expect(snapshot.engines.chat.state).toBe('unknown');
    expect(snapshot.engines.chat.nextAction).toBe('inspect_state');
  });

  it('currentRoute / lastError / lastCommand 可注入', () => {
    setCurrentRoute('ImageGen');
    setLastError('CP-APP-006', '出图失败');
    const snapshot = buildStateSnapshot();
    expect(snapshot.currentRoute).toBe('ImageGen');
    expect(snapshot.lastError).toMatchObject({
      cpId: 'CP-APP-006',
      summary: '出图失败',
    });
  });
});
