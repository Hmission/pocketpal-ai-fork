import {emit} from '../debug/eventStream';

/**
 * 异步定时器统一收口原语（POCKETPAL_TEST_INFRA_SPEC §3，律 2）。
 * 两个入口一套口径：轮询走 `safeInterval`，一次性延时走 `safeTimeout`。
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

type TimerId = ReturnType<typeof setTimeout>;

interface PendingTimeout {
  name: string;
  timer: TimerId;
}

/** 未到期的 safeTimeout 登记表：句柄必须有地方拿着，否则「无人持有」就是本次的病灶本身。 */
const pendingTimeouts = new Set<PendingTimeout>();

/**
 * 一次性延时的收口版（与 `safeInterval` 同族、同上报口径）。
 *
 * 为什么必须有它（TEST_INFRA_SPEC §3.3 / CORE-14 实证，不是「洁癖」）：
 * 本仓两处回合收尾写成裸 `setTimeout(() => { void a(); void b(); }, 1200)`，两个后果——
 * ① 体内 async 抛出同样逃逸，与律 2 同罪；且一次性延时比轮询更难发现：它只炸一次，
 *   「首失败 + 每 10 次一报」这类节流叙事根本用不上，真机 logcat 里人眼撞不到；
 * ② 句柄无人持有 → 测试跑完它还在倒计时，日志泼在已结束的套件上。全量 jest 实测
 *   74 条 `Cannot log after tests are done` 全仍源于此，并令 worker 被强退——
 *   **352 套件全绿、零失败却 exit 1**，「jest 全绿」这道发布门禁当场失真。
 *
 * `work` 可以直接是 async 函数：返回的 promise 被本原语串进链，rejection 同样接得住。
 * 因此调用面应当 `return Promise.all([...])` 而不是 `void a(); void b();`——后者把异常
 * 留在链外，本原语再安全也接不到随手丢掉的 promise。
 *
 * @param name 全局唯一名（日志与事件靠它定位），如 `chat_post_turn_memory`
 * @returns cancel 句柄；重复 cancel 安全（已执行过的不报错）
 */
export function safeTimeout(
  name: string,
  work: () => unknown,
  ms: number,
): () => void {
  const entry: PendingTimeout = {
    name,
    timer: undefined as unknown as TimerId,
  };
  const cancel = () => {
    // 以集合成员为唯一事实：不在集内 = 已跑过或已被整体撤销，不事二报
    if (!pendingTimeouts.delete(entry)) {
      return;
    }
    clearTimeout(entry.timer);
  };
  entry.timer = setTimeout(() => {
    pendingTimeouts.delete(entry);
    Promise.resolve()
      .then(() => work()) // 同步抛出也进这条链
      .catch(e => {
        // 一次性任务只逃一次，所以不做节流：每一次失败都必须可见
        console.warn(`[safeTimeout:${name}] work failed:`, e);
        emit('system', 'safeTimeout.failed', {
          name,
          error: e instanceof Error ? e.message : String(e),
        });
      });
  }, ms);
  pendingTimeouts.add(entry);
  return cancel;
}

/**
 * 撤销所有未到期的延时（会话收尾 / 测试收尾用），返回被撤销个数。
 *
 * 撤销必留痕：一次撤销 = 一次没做完的收尾工作。静默撤销会把真实故障洗成干净日志，
 * 与本文件存在的理由直接相悖。
 */
export function cancelPendingSafeTimeouts(reason: string): number {
  const names = [...pendingTimeouts].map(e => e.name);
  if (!names.length) {
    return 0;
  }
  pendingTimeouts.forEach(e => clearTimeout(e.timer));
  pendingTimeouts.clear();
  console.warn(
    `[safeTimeout] 撤销 ${names.length} 个未到期延时（${reason}）: ${names.join(', ')}`,
  );
  emit('system', 'safeTimeout.cancelled', {reason, names});
  return names.length;
}

declare global {
  // eslint-disable-next-line no-var
  var __ppCancelSafeTimeouts: ((reason: string) => number) | undefined;
}

/**
 * 测试收尾用的显式接缝：`jest/setupFilesAfterEnv.ts` 读它而不是 import 本模块。
 *
 * 为何不能 import（本窗自己踩出、当场改账的现行故障）：setup 文件比测试文件先求值，
 * eager import 会把本模块**及其依赖链**（`eventStream` → `utils/paths` 的顶层
 * `RNFS.DocumentDirectoryPath.replace(…)`）首次拽进那些从来不用本原语的套件；
 * 它们的 RNFS 替身没有这个字段 → `TypeError: Cannot read properties of undefined`
 * 归给当时正在跑的套件（实测：4 个互不相关的套件同时红在同一句）。它同时也拆了铁律①
 * 的台：提前实例化使测试后续 `jest.mock('../../debug/eventStream')` 只能拿到另一个
 * 实例，spy 永远打不到被测代码。
 * 走全局接缝后：从未加载过本模块的套件里 `__ppCancelSafeTimeouts` 为 undefined，
 * 而它也不可能有未到期延时——不加载即无需撤销，构造上自洽。
 */
globalThis.__ppCancelSafeTimeouts = cancelPendingSafeTimeouts;
