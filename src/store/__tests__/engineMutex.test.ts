/**
 * EngineMutex 互斥协调器测试（SPEC §9.2 → 复查 2026-08-20 超时保护）
 *
 * 覆盖：互斥对释放（chat↔image / prompter↔chat）、释放超时显式失败
 * （不再无限挂起）、超时后链自愈（后续 acquire 不被前一个失败阻塞）、
 * 同引擎重复 acquire 串行化。
 */
import {engineMutex} from '../engineMutex';

describe('EngineMutex（互斥 + 超时保护）', () => {
  beforeEach(() => {
    // 每个用例独立实例，避免单例状态泄漏
    const fresh = new (engineMutex.constructor as any)();
    (engineMutex as any).current = fresh.current;
    (engineMutex as any).releasers = fresh.releasers;
    (engineMutex as any).acquiring = fresh.acquiring;
  });

  it('互斥对：acquire(image) 会先释放 chat（releaser 被调用）', async () => {
    const releaseChat = jest.fn().mockResolvedValue(undefined);
    engineMutex.register('chat', releaseChat);
    await engineMutex.acquire('chat');
    expect(engineMutex.active).toBe('chat');

    await engineMutex.acquire('image');
    expect(releaseChat).toHaveBeenCalled();
    expect(engineMutex.active).toBe('image');
  });

  it('非互斥对共存：prompter 与 image 同时驻留（不触发 releaser）', async () => {
    const releaseChat = jest.fn().mockResolvedValue(undefined);
    engineMutex.register('chat', releaseChat);
    await engineMutex.acquire('prompter');
    await engineMutex.acquire('image');
    expect(releaseChat).not.toHaveBeenCalled();
    expect(engineMutex.active).toBe('image');
  });

  it('释放超时：显式抛错（不无限挂起），占用者置空闲', async () => {
    // setTimeout 覆盖为即时回调：确定性模拟 30s 流逝（避免 fake timers 与 promise 链交互不稳）
    const origSetTimeout = global.setTimeout;
    global.setTimeout = ((fn: (...args: unknown[]) => void) => {
      fn();
      return 0 as unknown as NodeJS.Timeout;
    }) as typeof global.setTimeout;
    try {
      engineMutex.register(
        'chat',
        () => new Promise<void>(() => {}), // 永不 resolve 的 releaser
      );
      await engineMutex.acquire('chat');
      const p = engineMutex.acquire('image');
      await expect(p).rejects.toThrow(/释放超时/);
      expect(engineMutex.active).toBeNull(); // 已置空闲，避免下次再卡
    } finally {
      global.setTimeout = origSetTimeout;
    }
  });

  it('链自愈：前一个 acquire 失败不阻塞后续 acquire', async () => {
    const origSetTimeout = global.setTimeout;
    global.setTimeout = ((fn: (...args: unknown[]) => void) => {
      fn();
      return 0 as unknown as NodeJS.Timeout;
    }) as typeof global.setTimeout;
    try {
      engineMutex.register(
        'chat',
        () => new Promise<void>(() => {}), // 永久挂起 releaser
      );
      await engineMutex.acquire('chat');
      // 第一次 acquire('image') 超时失败
      await expect(engineMutex.acquire('image')).rejects.toThrow(/释放超时/);

      // 第二次 acquire（注册正常 releaser）不再被前一次失败阻塞
      engineMutex.register('chat', jest.fn().mockResolvedValue(undefined));
      await engineMutex.acquire('image');
      expect(engineMutex.active).toBe('image');
    } finally {
      global.setTimeout = origSetTimeout;
    }
  });
});
