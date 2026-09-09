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
| 1   | 测试替身必须与被测代码**同一模块来源**（barrel 与具体文件不得混用；全局 setup 也不得 eager import 生产模块） | §152：actionRegistry 2 例被误判成「生产代码吞错误原文」，实为测试取错对象；§二 第四形态：setup 里一个 `import` 同时弄坏 spy 与 4 个无关套件 |
| 2   | 异步工作**不得让异常逃逸**——轮询与一次性延时皆算，分别走 `src/utils/safeInterval.ts` / 同文件 `safeTimeout` | §154：未捕获 TypeError 被 jest 随机归属，把确定性缺陷伪装成「超时型 flake」流传两轮；§3.3（CORE-14）：1.2 s 无主 `setTimeout` 使全量跑溢出 74 条越界日志并令 jest worker 强退 |
| 3   | 全局 mock 必须**覆盖 spec 方法全集**，由闸门脚本校验                | §154 真凶：mock 缺 `getPerfSnapshot`                                                |

三条的共同点是：**故障不出在坏掉的地方，而出在被它污染的别处**。因此本规范的重点不是「怎么写不出错」，而是「出错时能不能被看见、被正确归因」。

## 二、律 1：替身接线

仓内 `src/store/index.ts`、`src/hooks/index.ts` 这类 barrel 与同名具体文件并存，
`import` 与 `jest.mock` 的**路径必须逐字一致**，否则两边拿到的是两个不同模块。

- **反向错配**：`jest/setup.ts` 只 mock 了 barrel（`jest.mock('../src/store')`），测试却 `require('../../store/imageGenStore')` 取到未被 mock 的真实实例 → `spyOn` 与赋值打在另一个对象上，被测代码完全看不见。
- **正向错配**：测试 `jest.mock('../../../hooks')`（barrel），组件却 `import {useTheme} from '../../hooks/useTheme'`（具体文件）→ **mock 从未生效，测试一直跑在真环境**。不断言具体值时更阴——不红，只是静默失效。
- **判定顺序**：先读被测组件的 import 原文对齐路径，再谈「坏了 / 过期」；必要时一句 `console.log('SAME_OBJECT:', a === b)` 定音。
- **第四种形态（2026-09-09 现行踩到，本窗自己引入又当场改账）：全局 setup 的 eager import**。
  在 `jest/setupFilesAfterEnv.ts` 里 `import`（或延迟 `require`）一个生产模块，会让它**比测试文件
  更早实例化**，而 `jest.mock(...)` 是测试文件被求值时才注册的 → 两件事同时发生：
  ① 该模块的闭包里握着**真**依赖，测试里对同一依赖装的 spy/mock 永远打不到它
  （实测：`safeInterval.test.ts` 两条既有 `emit` 断言红在 `Number of calls: 0`）；
  ② 它的**整条依赖链**被首次拽进本来不用它的套件，链上的顶层副作用（本仓：
  `utils/paths.ts` 顶层 `RNFS.DocumentDirectoryPath.replace(…)`）在替身字段不全时直接抛
  TypeError——于是 4 个互不相关的套件同时红在同一句（症状与 §纪律1 描述的“随机归属”一模一样，
  但它是确定性的，抽错误原文+栈就能一眼看到 `at Object.require` 仍在新拽进来的那条链上）。
  **口径**：全局 hook 需要碰生产模块时，走由该模块自己注册在 `globalThis` 上的接缝（本仓：
  `globalThis.__ppCancelSafeTimeouts`），零加载零副作用；不得为了“能调到”而把依赖链 import 进来。
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

### 3.3 一次性延时同罪：`safeTimeout`（2026-09-09 补，实证事故 CORE-14）

律 2 原先只写「异步轮询」，把一次性 `setTimeout` 当成不在射程内——`audit-async-timers.js`
的注释里甚至明确写着「纳入 setTimeout 会变噪音源，等有真实事故样本再定判据」。样本到了：

- `src/hooks/useChatSession.ts` 与 `src/hooks/useChatScheduler.ts` 各有一处
  `setTimeout(() => { void extractAndSaveMemories(…); void appendConversation(…); }, 1200)`；
- 全量 jest 实测 **74 条** `Cannot log after tests are done`，按栈归并：64 条经
  `conversationLog.ts` 落进 RNFS 替身的 `console.log`，10 条是 `aiosMemory/index.ts` 的
  `extraction failed` 告警，两者栈顶均为上述 `Timeout._onTimeout`；
- 后果不止脏日志：jest 因此报 `A worker process has failed to exit gracefully and has been
  force exited`——**全量跑 352 套件全绿却 exit 1**，「jest 全绿」这道发布门禁当场失真。

一次性延时比轮询更阴的地方在于：异常只逃逸**一次**，所以「首失败 + 每 10 次一报」这类节流
叙事用不上，单条 `console.warn` 在真机 logcat 里几乎不可能被人眼撞上。

```ts
const cancel = safeTimeout(name: string, work: () => unknown, ms: number): () => void;
```

与 `safeInterval` 同族同文件（同一语义只留一处入口）：同步抛出与 rejection 一律被捕获，
`console.warn('[safeTimeout:<name>] …')` + `emit('system', 'safeTimeout.failed', …)` 双通道上报。
**额外两条**：

1. 句柄由本模块登记，`cancelPendingSafeTimeouts(reason)` 可整体撤销（会话收尾 / 测试收尾）；
   撤销必留痕不静默——撤销意味着有一次收尾工作没做，这个事实必须可见。
2. 测试侧由 `jest/setupFilesAfterEnv.ts` 在每个用例后调用它。⚠ 注意既有那行
   `jest.clearAllTimers()` **对真定时器无效**（只有 `jest.useFakeTimers()` 之后才有意义），
   所以「setup 里已经清了定时器」不构成豁免理由——本仓的泄漏正是从这条错觉里长出来的。

**豁免口径**（写清是为了不让后人拿豁免塞任意写法）：纯同步体延时（刷 UI 状态、动画、防抖）
不迁；`new Promise(resolve => setTimeout(resolve, ms))` 这类**被 await 的 sleep 助手**不迁——
它的句柄生命周期由 promise 链持有。闸门只认「无主句柄 + 体内直接 async 体或丢弃 promise
（`void X()`）」这一形状（实测：本仓 44 处 `setTimeout` 中仅 2 处命中，信号足够窄）。

### 3.4 存量迁移清单（8 处，当时迁毕）

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

同理 `node scripts/audit-async-timers.js`：报告所有「回调最终执行 async 但未走收口原语」
的定时器（`setInterval` 与无主 `setTimeout` 皆在扫描面内），存在即 `exit 1`。
判据自身由 `runSelftest()` 在**每次跑闸门时**先验一遍（逃逸形状全命中 + 注释/字符串/已收口
形状零误报），验不过直接 `exit 1` 并声明「本轮绿色不可信」——能被改坏的判据等于没有判据。

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

**新代码四条自查**：① 替身路径与被测代码逐字一致？② 新轮询走 `safeInterval` 了吗？
③ 动了 spec 是否同步了替身并通过 `yarn audit:native-mocks`？
④ **真机不可构造的分支有没有单测锁住？**典型：`ttsStatusTextFor` 五条文案分支里
`device`/`noVoice`/`engine` 三条要弄坏内存档位/音色/引擎才能看到——真机跑一百次也碰不到。
这类分支必须抽成纯函数 + 单测，否则「改错也不会有人知道」；判断标准很简单：
**这个分支能不能用正常操作路径让它出现。不能，就只能靠测试。**

**已知债（登记不掩盖）**：

1. ~~两个闸门只接本地门禁~~ → ~~已接入 CI（`ci.yml` Step 5b/5c）~~ → 两个结论都错过，现登记最终事实：
   本仓 `.gitignore` 原有一条无斜杠的 `workflows/`，按 git 语义**连带排除了 `.github/workflows/`**，
   所以第一次「接入 CI」完全无效（改 ci.yml 不产生任何提交）。§156 已修为 `/workflows/`，
   两个闸门现同时挂在 **`.husky/pre-commit`（提交拦）+ `ci.yml` Step 5b/5c（入库）**。
   连带发现：本仓 4 个 workflow 长期未入库（等于 fork 一直没有 CI），其中 `e2e-tests.yml` /
   `l10n-upload.yml` / `release.yml` 仍显式挂在 `.gitignore` 里待裁（`release.yml` 会触发发布动作，
   风险最高）——**删对应行即启用**。
2. 全仓 6 个 spec 中只有 `NativeHardwareInfo` 做了全局替身，其余 5 个（如 `NativeDownloadModule` 含 10 个方法）闸门报 SKIP。**不是漏洞**——没有替身就不存在「替身落后于契约」这个问题；但将来给它们加替身时，闸门会立刻要求全覆盖。
3. 自查留痕：本节初稿把 spec 数写成「15 个」（未数的估词），实为 **6 个**（Grep 列文件与闸门输出双口径核对）。数字必须来自已完成的核验。
4. ~~`docs/INDEX.md` 只收录治理类文档，业务 SPEC（含本文）未进导航表——属文档治理债~~ →
   **经实证不成立（§156.3）**：第二节标题即「全局规范（A 层 / B 层）」，早已收录大批业务 SPEC，
   且 L18 明写「新增文档必须在本文件登记」。真相是**新建本文时漏做登记**，却把它写成了需要
   大王授权的「治理债 + 禁区红线」——把自己的失职包装成障碍。已按 INDEX.md 自身规则补录（v1.4）。
   **报「某规范不支持」前，先读那条规范本身。**另经取证：INDEX.md 本身在 `.gitignore:196` 的
   「内部治理文档不公开发布」清单里（与 `DOC_GOVERNANCE_SPEC` / `DOC_MANAGEMENT` / `adr/` /
   `internal/` 同组），所以它**不入库属既有策略、不是缺陷**，补录在本地生效即可——与 ci.yml
   那次不同（那个必须入库才生效）。
5. 洋葱图谱事实库 `code_facts.duckdb` 不存在，`code_fact_query` 不可用，本仓定位按 gate 降级链
   （Grep → Glob → Read）完成。**真因经 §156.4 取证更正**：不是「跨仓需点头」——构建器
   `F:\AIOS\scripts\search\builders\code_facts.py` 本就支持 `--repo-root /path/to/fork`，且
   DuckDB 是可选副作用（缺包时仍产 JSON 投影，只登记 `duckdb_not_installed`）；真正卡点是
   ① 环境未装 `duckdb` 包；② **该构建器当前自身不可运行**：`builders/` 下独缺
   `_code_facts_tables.py`，被 `_code_facts_type_inference.py:194/196` import 即
   `ModuleNotFoundError`。属**母仓缺陷**，需母仓侧修，本仓无权亦不该代修。
