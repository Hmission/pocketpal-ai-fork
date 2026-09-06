/**
 * safeInterval 契约测试（POCKETPAL_TEST_INFRA_SPEC §3 律 2 的三条保证）。
 *
 * 重点是第 1 组：它钉住的是 §154 事故的机制本身——**同步抛出的 TypeError 也要被收口**，
 * 那是「挂在链尾的 .catch() 做不到、必须由外层承担」的那件事。
 */
import {safeInterval} from '../safeInterval';
import {emit} from '../../debug/eventStream';

jest.mock('../../debug/eventStream', () => ({
  emit: jest.fn(() => false),
}));

const emitMock = emit as unknown as jest.Mock;
let warn: jest.SpyInstance;

beforeEach(() => {
  jest.useFakeTimers();
  emitMock.mockClear();
  warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  warn.mockRestore();
  jest.useRealTimers();
});

/** 推进 ms 毫秒并把内部微任务跑干净 */
async function advance(ms: number) {
  await jest.advanceTimersByTimeAsync(ms);
}

describe('safeInterval', () => {
  it('按周期调用 tick，stop 后彻底停止', async () => {
    const tick = jest.fn();
    const stop = safeInterval('t_basic', tick, 1000);

    await advance(3000);
    expect(tick).toHaveBeenCalledTimes(3);

    stop();
    await advance(5000);
    expect(tick).toHaveBeenCalledTimes(3);
  });

  it('tick 内**同步抛 TypeError**也被收口（.catch 链做不到的一件事）', async () => {
    // 还原 §154 现场：调一个不存在的方法，抛出发生在取 .catch 之前。
    // 类型上装得象真（索引签名），但运行时该属性不存在 → 同步 TypeError。
    const host = {} as Record<string, () => Promise<unknown>>;
    const tick = () => host.missing().catch(() => null);

    const stop = safeInterval('t_sync_throw', tick, 1000);
    await advance(2000);
    stop();

    // 异常被收口：有上报，且轮询没被打断（下一轮照跑）
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0][0])).toContain('t_sync_throw');
    expect(emitMock).toHaveBeenCalledWith(
      'system',
      'safeInterval.tickFailed',
      expect.objectContaining({name: 't_sync_throw', failures: 1}),
    );
  });

  it('tick 返回 rejected promise 同样被收口并上报', async () => {
    const tick = jest.fn(async () => {
      throw new Error('engine down');
    });
    const stop = safeInterval('t_reject', tick, 1000);

    await advance(2000);
    stop();

    expect(tick).toHaveBeenCalledTimes(2); // 一轮失败不影响下一轮
    expect(emitMock).toHaveBeenCalledWith(
      'system',
      'safeInterval.tickFailed',
      expect.objectContaining({name: 't_reject', error: 'engine down'}),
    );
  });

  it('防重入：上一轮没结束就跳过本轮，慢轮询不得自我叠加', async () => {
    let release: (() => void) | null = null;
    const tick = jest.fn(
      () =>
        new Promise<void>(resolve => {
          release = resolve;
        }),
    );

    const stop = safeInterval('t_reentry', tick, 1000);
    await advance(5000); // 5 个周期，但第一轮仍未 resolve
    expect(tick).toHaveBeenCalledTimes(1);

    release!();
    await advance(1000);
    expect(tick).toHaveBeenCalledTimes(2);
    stop();
  });

  it('上报节流：首失败立即报，之后每 10 次报一条，不刷屏也不静默', async () => {
    const tick = jest.fn(() => {
      throw new Error('boom');
    });
    const stop = safeInterval('t_throttle', tick, 1000);

    await advance(11000); // 11 次失败 → 第 1 次与第 10 次各一条
    stop();

    expect(tick).toHaveBeenCalledTimes(11);
    expect(warn).toHaveBeenCalledTimes(2);
    expect(String(warn.mock.calls[0][0])).toContain('x1');
    expect(String(warn.mock.calls[1][0])).toContain('x10');
  });

  it('成功路径零上报（不制造噪音）', async () => {
    const tick = jest.fn(async () => 1);
    const stop = safeInterval('t_ok', tick, 1000);

    await advance(3000);
    stop();

    expect(tick).toHaveBeenCalledTimes(3);
    expect(warn).not.toHaveBeenCalled();
    expect(emitMock).not.toHaveBeenCalled();
  });

  it('immediate：注册即跑第一轮（裸调 async 那个逃逸口的正解）', async () => {
    const tick = jest.fn(async () => 1);
    const stop = safeInterval('t_imm', tick, 1000, {immediate: true});

    await advance(0);
    expect(tick).toHaveBeenCalledTimes(1); // 不等第一个周期

    await advance(2000);
    expect(tick).toHaveBeenCalledTimes(3);
    stop();
  });

  it('immediate 首调抛错也被收口（调用方无需再挂 .catch）', async () => {
    const tick = jest.fn(() => {
      throw new Error('boot fail');
    });
    const stop = safeInterval('t_imm_throw', tick, 1000, {immediate: true});

    await advance(0);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0][0])).toContain('t_imm_throw');
    stop();
  });

  it('默认不立即执行（保持 setInterval 原语义）', async () => {
    const tick = jest.fn();
    const stop = safeInterval('t_lazy', tick, 1000);

    await advance(0);
    expect(tick).not.toHaveBeenCalled();
    stop();
  });
});
