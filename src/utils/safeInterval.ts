import {emit} from '../debug/eventStream';

/**
 * 异步定时器统一收口原语（POCKETPAL_TEST_INFRA_SPEC §3，律 2）。
 *
 * 为什么存在：仓内多处 setInterval 的回调最终执行 async 逻辑（轮询 native / store）。
 * 一旦其中抛出且无人收口，异常不会崩在原地，而是逃逸成 unhandled rejection，被
 * jest（或运行时）归给「当时正在运行」的上下文——本仓曾因此把一个确定性缺陷
 * （全局 mock 缺 `getPerfSnapshot`）读成「每次位置都不同的超时型 flake」，流传两轮。
 * 见 MASTER_LOG §154。
 *
 * 关键认知：`foo().catch(h)` 只能接住 foo 返回的 promise 的 rejection；当 `foo` 这个
 * 属性不存在时，抛出发生在**取 .catch 之前**，是同步 TypeError，catch 链碰不到。
 * 所以收口必须由外层 `try`/本原语承担，不能靠挂在链尾的 `.catch`。
 *
 * 三条保证：
 * 1. 异常永不逃逸（同步抛出与 promise rejection 一律捕获）；
 * 2. 防重入——上一轮未结束则跳过本轮，慢轮询不得自我叠加成堆栈雪崩与内存叠压；
 * 3. 统一上报双通道：console.warn 永远有（真机 logcat 走 ReactNativeJS tag 可取证），
 *    DRC 开启时再进事件流；首失败与每 10 次各报一条，既不静默也不刷屏。
 *
 * @param name 全局唯一的轮询名（日志与事件靠它定位），如 `imagegen_poll`
 * @returns stop 句柄：调用即 clearInterval（调用方不再需要自己持有 timer id）
 */
export interface SafeIntervalOptions {
  /**
   * true = 注册后立即跑一轮。专治「先手动 tick() 一次再开定时器」这种写法——
   * 裸调 async 与定时器回调是同一个逃逸口（首调用挂 .catch 又是重复收口），
   * 交给本原语则首调同样享有收口与防重入。
   */
  immediate?: boolean;
}

export function safeInterval(
  name: string,
  tick: () => unknown,
  ms: number,
  options?: SafeIntervalOptions,
): () => void {
  let running = false;
  let failures = 0;

  const runOnce = () => {
    if (running) {
      return; // 保证 2：防重入
    }
    running = true;
    Promise.resolve()
      .then(() => tick()) // 保证 1：同步抛出也被这个 .then 捕获
      .catch(e => {
        failures += 1;
        if (failures === 1 || failures % 10 === 0) {
          // 保证 3：双通道上报
          console.warn(`[safeInterval:${name}] tick failed x${failures}:`, e);
          emit('system', 'safeInterval.tickFailed', {
            name,
            failures,
            error: e instanceof Error ? e.message : String(e),
          });
        }
      })
      .finally(() => {
        running = false;
      });
  };

  const timer = setInterval(runOnce, ms);
  if (options?.immediate) {
    runOnce();
  }

  return () => {
    clearInterval(timer);
    running = false;
  };
}
