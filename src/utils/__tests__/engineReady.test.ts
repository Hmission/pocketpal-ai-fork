import {awaitEngineReady, engineIsBusy} from '../engineReady';
import {chatSessionStore, modelStore} from '../../store';

// store 已被 jest/setup 全局 mock（mockModelStore/mockChatSessionStore），
// 此处直接改写 observable 标志位模拟忙碌/就绪状态。

const setBusy = (busy: boolean) => {
  (modelStore as any).inferencing = busy;
  (modelStore as any).isStreaming = false;
  (chatSessionStore as any).isGenerating = false;
  (chatSessionStore as any).isStopping = false;
};

describe('engineReady', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    setBusy(false);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('engineIsBusy：推理中为忙碌', () => {
    setBusy(true);
    expect(engineIsBusy()).toBe(true);
  });

  it('engineIsBusy：停止收尾中为忙碌', () => {
    (chatSessionStore as any).isStopping = true;
    expect(engineIsBusy()).toBe(true);
  });

  it('engineIsBusy：全部空闲为就绪', () => {
    expect(engineIsBusy()).toBe(false);
  });

  it('awaitEngineReady：已就绪立即返回 true（不轮询）', async () => {
    const result = await awaitEngineReady();
    expect(result).toBe(true);
  });

  it('awaitEngineReady：忙碌中转就绪后返回 true', async () => {
    setBusy(true);
    const promise = awaitEngineReady();
    // 两次轮询后（400ms）引擎就绪
    await jest.advanceTimersByTimeAsync(400);
    setBusy(false);
    await jest.advanceTimersByTimeAsync(200);
    await expect(promise).resolves.toBe(true);
  });

  it('awaitEngineReady：持续忙碌超时返回 false（不静默）', async () => {
    setBusy(true);
    const promise = awaitEngineReady();
    // 推进超过 8s 超时窗口
    await jest.advanceTimersByTimeAsync(8400);
    await expect(promise).resolves.toBe(false);
  });
});
