---
doc_id: POCKETPAL_TEST_INFRA_SPEC
module: root
type: spec
status: active
version: '1.0'
created: '2026-09-06'
updated: '2026-09-06'
relates:
  [POCKETPAL_MASTER_LOG, POCKETPAL_GUARD_INSPECTION_LOG, POCKETPAL_DESIGN_SPEC]
---

<!-- D-FORMAT:v3 -->

# 测试与可诊断性基建规范

**状态**：active | **版本**：1.0 | **更新**：2026-09-06

> **定位**：本仓「让测试失败可信」的基建规范。三条铁律各对应一次真实事故，不是理想化条款。
>
> **适用范围**：写测试、写全局 mock、增删 NativeModule spec 方法、写任何轮询/定时器时，先读本文。
>
> **上游指针**：门禁执行顺序与断言纪律见 `AGENTS.md`「验证门禁纪律」；事故细节见 `POCKETPAL_MASTER_LOG` §152–§155。

## 一、三条铁律

| #   | 铁律                                                                | 对应事故                                                                            |
| --- | ------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| 1   | 测试替身必须与被测代码**同一模块来源**（barrel 与具体文件不得混用） | §152：actionRegistry 2 例被误判成「生产代码吞错误原文」，实为测试取错对象           |
| 2   | 异步轮询**不得让异常逃逸**，一律走 `src/utils/safeInterval.ts`      | §154：未捕获 TypeError 被 jest 随机归属，把确定性缺陷伪装成「超时型 flake」流传两轮 |
| 3   | 全局 mock 必须**覆盖 spec 方法全集**，由闸门脚本校验                | §154 真凶：mock 缺 `getPerfSnapshot`                                                |

三条的共同点是：**故障不出在坏掉的地方，而出在被它污染的别处**。因此本规范的重点不是「怎么写不出错」，而是「出错时能不能被看见、被正确归因」。

## 二、律 1：替身接线

仓内 `src/store/index.ts`、`src/hooks/index.ts` 这类 barrel 与同名具体文件并存，
`import` 与 `jest.mock` 的**路径必须逐字一致**，否则两边拿到的是两个不同模块。

- **反向错配**：`jest/setup.ts` 只 mock 了 barrel（`jest.mock('../src/store')`），测试却 `require('../../store/imageGenStore')` 取到未被 mock 的真实实例 → `spyOn` 与赋值打在另一个对象上，被测代码完全看不见。
- **正向错配**：测试 `jest.mock('../../../hooks')`（barrel），组件却 `import {useTheme} from '../../hooks/useTheme'`（具体文件）→ **mock 从未生效，测试一直跑在真环境**。不断言具体值时更阴——不红，只是静默失效。
- **判定顺序**：先读被测组件的 import 原文对齐路径，再谈「坏了 / 过期」；必要时一句 `console.log('SAME_OBJECT:', a === b)` 定音。
- **断言口径**：组件测试断言**绑 token 语义**（如 `mockTheme.colors.tertiary`），不写 hex 字面量。色值 SSOT 在 `src/theme/tokens/colors.ts`，属主题域；锁 hex 等于把主题决策权错误交给组件测试——将来任何人改主题色都会让组件测试变红。

## 三、律 2：异步收口

### 3.1 为什么 `.catch()` 不够

```ts
// 反例（本仓 §154 现场）
const perf = await NativeHardwareInfo.getPerfSnapshot().catch(() => null);
```

`.catch()` 只能接住**该方法返回的 promise 的 rejection**。当 `getPerfSnapshot` 这个属性
根本不存在时，抛出发生在**取 `.catch` 之前**，是**同步 TypeError**——catch 链碰不到它。
于是「看起来有 catch」并不等于「有保护」。

异常逃逸后的去处更坑：它不在原地崩，而是被 jest（或运行时）归给**当时正在运行**的那个
上下文，于是表现为「每次全量跑红的套件互不重叠、单跑却全绿」——**一个确定性缺陷被读成了
偶发 flake，并据此改了两轮纪律**。

### 3.2 `safeInterval` 契约

```ts
const stop = safeInterval(name: string, tick: () => unknown, ms: number): () => void;
```

三条保证，缺一不可：

1. **异常永不逃逸**：`tick` 的同步抛出与 promise rejection 一律被捕获；
2. **防重入**：上一轮未结束则跳过本轮（慢轮询不得自我叠加成堆栈雪崩与内存叠压）；
3. **统一上报双通道**：`console.warn('[safeInterval:<name>] tick failed x<N>: …')`
   永远有（真机 logcat 走 `ReactNativeJS` tag 可取证）；DRC 开启时同时 `emit('system', 'safeInterval.tickFailed', …)` 进事件流。
   首失败与每 10 次各报一条，**既不静默也不刷屏**。

`name` 必填且全局唯一（如 `imagegen_poll`、`perf_trace`），日志与事件都靠它定位。

**⚠ 防重入对测试的副作用（本轮真实踩到）**：若轮询回调是异步的，测试却用**同步** `jest.advanceTimersByTime()` 推进假时间，则微任务不会被 flush，`running` 永不释放 → 几乎每轮都被判「上一轮还在跑」而跳点（现象：期望 60 点实收 1 点，看上去完全像原语坏了）。**测异步轮询一律用 `await jest.advanceTimersByTimeAsync()`**（`usePerfTrace.test.ts` 已按此改，断言期望未动一字）。另：行级 `try` 不能自证安全（`try` 在函数体内不代表盖住了危险那一行），所以收口口径只认「是否走 `safeInterval`」。

### 3.3 存量迁移清单（8 处，本轮迁毕）

| 点位                                                            | 原回调形态                  | 原状态                  |
| --------------------------------------------------------------- | --------------------------- | ----------------------- |
| `src/store/imageGenStore.ts:347`                                | `() => this.pullSnapshot()` | **未收口（§154 真凶）** |
| `src/services/benchmarkOrchestrator.ts:84`                      | `async () =>`               | 未收口                  |
| `src/__automation__/screens/BenchmarkRunnerScreen.tsx:834`      | `async () =>`               | 未收口                  |
| `src/hooks/usePerfTrace.ts:83`                                  | `tick`（体内 try）          | 自处理，迁后统一        |
| `src/hooks/useStorageCheck.ts:90`                               | `checkStorage`（体内 try）  | 自处理，迁后统一        |
| `src/services/perf/chatTurnPerf.ts:88`                          | `sample`（体内 try）        | 自处理，迁后统一        |
| `src/components/EmbeddedVideoView/EmbeddedVideoView.tsx:96`     | `async () =>`（体内 catch） | 自处理，迁后得防重入    |
| `src/screens/ImageGenScreen/components/AudioWorkshopTab.tsx:87` | `async () =>`（体内 catch） | 自处理，迁后得防重入    |

纯同步定时器（如 `setInterval(() => setNow(Date.now()), 1000)` 一类刷时间戳）**不迁**：
无异步异常可逃逸，迁它只是增加改动面。

## 四、律 3：mock 契约闸门

### 4.1 校验脚本

`node scripts/audit-native-mocks.js`：以 `src/specs/*.ts` 的 TurboModule spec 与
`jest/setup.ts` 等全局替身为两侧输入，比对**方法覆盖度**；任一 spec 方法在替身里缺失即
`exit 1`。它替代「靠人记得同步 mock」——这次是 `getPerfSnapshot`，下次会是另一个方法。

同理 `node scripts/audit-async-timers.js`：报告所有「回调最终执行 async 但未走 `safeInterval`」
的定时器，存在即 `exit 1`。

### 4.2 替身取值口径

- 字段必须对齐 spec 的返回类型（缺字段会让消费面拿到 `undefined` 而静默算错，比报错更难查）；
- 真机拿不到的数值一律用**与真机一致的 N/A 口径**（本仓性能快照用 `-1`），
  **禁止编造「看起来像真」的数据**——它会让测试通过，但掩盖真实缺陷。

## 五、门禁命令

| 命令                      | 作用               | 何时跑                                                       |
| ------------------------- | ------------------ | ------------------------------------------------------------ |
| `yarn audit:native-mocks` | 全局替身覆盖度闸门 | 改 `src/specs/**` 或 `jest/setup.ts` 后必跑；已挂 pre-commit |
| `yarn audit:async-timers` | 异步轮询收口闸门   | 新增/改动 `setInterval` 后必跑；已挂 pre-commit              |
| `npx jest --ci`           | 全量（并发）       | 终验；失败必按 `AGENTS.md` 纪律第 1 条归类错误文本后再定性   |

## 六、复发防护与已知债

**新代码三条自查**：① 替身路径与被测代码逐字一致？② 新轮询走 `safeInterval` 了吗？
③ 动了 spec 是否同步了替身并通过 `yarn audit:native-mocks`？

**已知债（登记不掩盖）**：

1. 两个闸门已挂 `.husky/pre-commit`（每次提交必跑）。**曾经误写「已接入 CI」**：本仓 `.gitignore` 有一条 `workflows/`（注释表明本意是忽略开发团队流程产物），按 git 语义**连带排除了 `.github/workflows/`**——该目录不入库（`git check-ignore -v` 实测），改 ci.yml 不会产生任何提交，因此那一步「接入 CI」完全无效且留了幽灵差异，已回滚。接入真 CI 需先调整该ignore规则（属仓库级决定，待大王裁）。
2. 全仓 6 个 spec 中只有 `NativeHardwareInfo` 做了全局替身，其余 5 个（如 `NativeDownloadModule` 含 10 个方法）闸门报 SKIP。**不是漏洞**——没有替身就不存在「替身落后于契约」这个问题；但将来给它们加替身时，闸门会立刻要求全覆盖。
3. 自查留痕：本节初稿把 spec 数写成「15 个」（未数的估词），实为 **6 个**（Grep 列文件与闸门输出双口径核对）。数字必须来自已完成的核验。
4. `docs/INDEX.md` 只收录治理类文档，业务 SPEC（含本文）未进导航表——属文档治理债。
5. 洋葱图谱事实库 `code_facts.duckdb` 未在本仓建索引，`code_fact_query` 不可用，
   本轮定位按 gate 的降级链（Grep → Glob → Read）完成；构建器在母仓
   `F:\AIOS\scripts\search\build_all_indexes.py`，属跨仓动作，需大王点头。
