/**
 * Jest setup file for test lifecycle hooks
 * This runs after the test environment is set up, so lifecycle hooks like afterEach are available
 */

/**
 * ⚠ 不得改成文件顶部 `import '../src/utils/safeInterval'`。
 * setup 文件比测试文件先求值，顶部 import 会做两件坏事：
 * ① 把 `safeInterval` 提前实例化，它的闭包里就握着**真** eventStream——之后测试
 *    `jest.mock('../../debug/eventStream')` 拿到的是另一个实例，spy 永远打不到被测代码
 *    （实测：两条既有 emit 断言当场红在 `Number of calls: 0`）；
 * ② 把本不相关的依赖链（`eventStream` → `utils/paths` 顶层的 `RNFS.DocumentDirectoryPath
 *    .replace(…)`）首次拽进所有套件，替身没这个字段的就撞 `TypeError: Cannot read
 *    properties of undefined`（实测：4 个互不相关套件同时红在同一句）。
 * 这是 TEST_INFRA_SPEC 铁律① 的第四种形态：**全局 setup 的 eager import 会亲手拆开
 * 替身与被测代码**。故走 `globalThis.__ppCancelSafeTimeouts` 接缝（由本原语自身注册），
 * 零加载、零副作用；从未用过原语的套件里它是 undefined，而它也不可能有未到期延时。
 */
function cancelTimersSafely(reason: string): void {
  const fn = globalThis.__ppCancelSafeTimeouts;
  if (typeof fn === 'function') {
    fn(reason);
  }
}

afterEach(() => {
  // 收口原语里的未到期延时必须显式撤销：下面那行 jest.clearAllTimers() **只对假定时器
  // 生效**，没调过 useFakeTimers() 的套件里它是空操作（TEST_INFRA_SPEC §3.3 / CORE-14）。
  // 本仓全量跑曾有 74 条 `Cannot log after tests are done` + worker 被强退（352 套件全绿
  // 却 exit 1），真凶就是这类无主 `setTimeout(fn, 1200)`。
  cancelTimersSafely('jest afterEach');

  // Clear all timers to prevent memory leaks
  jest.clearAllTimers();

  // Clear all mocks to prevent state leakage between tests
  jest.clearAllMocks();
});

afterAll(() => {
  // Restore real timers after all tests complete
  jest.useRealTimers();

  cancelTimersSafely('jest afterAll');

  // Clear all remaining timers
  jest.clearAllTimers();
});
