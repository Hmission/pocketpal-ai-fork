/**
 * stateCompass 契约测试：域级 STATE_MAP / 未知状态降级（BT07 观测不为 SPOF）。
 * 覆盖铁律：BT07（观测不为 SPOF）、六维矩阵 D5 态维度。
 */
import {STATE_REGISTRY, toCompass} from '../stateCompass';

describe('stateCompass', () => {
  it('STATE_MAP 覆盖 engine/chat/imagegen/model 四域', () => {
    for (const domain of ['engine', 'chat', 'imagegen', 'model']) {
      expect(Object.keys(STATE_REGISTRY[domain as keyof typeof STATE_REGISTRY]).length).toBeGreaterThan(0);
    }
  });

  it('engine running 态映射 nextAction=await_completion（五字段）', () => {
    const compass = toCompass('engine', 'running', {progress: 50});
    expect(compass.state).toBe('running');
    expect(compass.nextAction).toBe('await_completion');
    expect(compass.label).toBe('任务执行中');
    expect(compass.terminal).toBe(false);
    expect(compass.evidence).toEqual({progress: 50});
  });

  it('imagegen generating 态映射导航', () => {
    const compass = toCompass('imagegen', 'generating');
    expect(compass.state).toBe('generating');
    expect(compass.nextAction).toBe('await_sampling');
  });

  it('chat 域状态机含 sending/thinking/done', () => {
    const chat = STATE_REGISTRY.chat;
    expect(chat.sending.nextAction).toBe('await_reply');
    expect(chat.thinking.nextAction).toBe('await_reply');
    expect(chat.done.terminal).toBe(false);
  });

  it('未知状态降级 unknown（BT07 不抛异常）', () => {
    const compass = toCompass('engine', 'weird-state');
    expect(compass.state).toBe('unknown');
    expect(compass.nextAction).toBe('inspect_state');
    expect(compass.terminal).toBe(false);
  });

  it('未知域降级 unknown', () => {
    const compass = toCompass('app', 'anything');
    expect(compass.state).toBe('unknown');
  });

  it('无 evidence 时字段缺省', () => {
    const compass = toCompass('model', 'ready');
    expect(compass.evidence).toBeUndefined();
    expect(compass.nextAction).toBe('run_task');
  });
});
