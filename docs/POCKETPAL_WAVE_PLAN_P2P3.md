---
doc_id: POCKETPAL_WAVE_PLAN_P2P3
module: root
type: plan
status: active
version: "1.0"
created: "2026-09-09"
relates:
  [
    POCKETPAL_CHAIN_AUDIT_20260908_C,
    DEV_BACKLOG,
    POCKETPAL_IMAGEGEN_QUEUE_SPEC,
    POCKETPAL_ICON_SPEC,
    PERF_BENCHMARK_DESIGN,
    POCKETPAL_DESIGN_SPEC,
    ONDEVICE_VIDEO_GEN_ANALYSIS,
  ]
---

<!-- D-FORMAT:v3 -->

# P2 / P3 施工规划卷（§171 出品，交接力窗口零侦察开工）

> 本卷是 CHAIN_AUDIT_20260908_C §六 方案表的**施工级展开**：每一项都带「现状实物（本波
> 实读的 file:line）→ 改动面 → 判据 → 成本 → 红线」。接力窗口**不需要再侦察即可开工**；
> 若开工时发现本卷陈述与实物不符，**以实物为准并回头订正本卷**（本卷自己就订正过 C 卷两条）。
>
> 口径来源：`gate → route`（啄木鸟 `act-9211e8a4`）+ 四支取证脚本
> （`.tmp/plan171_evidence{,2,3,4}.py`，输出同名 .txt）。凡本波**未验证**的一律标 ❕，
> 不写成既定事实。
>
> **两卷分工（免双事实源）**：审计卷只定「做什么 / 不做什么」，**本卷定「怎么做完」**；
> 施工细节（现状实物 / 改动面 / 判据 / 成本 / 红线）**只存本卷一份**，审计卷与台账
> 仅留指针。接力窗改完一项，回到本卷对应小节销账，不得在多处各写一套。

## 0、接力顺序（先把上波的尾巴收掉，再动 P2）

| 序 | 动作 | 状态 | 说明 |
|---|---|---|---|
| 0-1 | B6 路径单点修复入库 | ✅ **本波已入库 `502e92c`** | 上波被并行窗口 prettier 脏文件拦住，对方提交后自解 |
| 0-2 | `yarn audit:gate-reentry` 自动闸（项 42） | ✅ **§172 波已入库 `827b275`** | 红/绿两态实测过（`.tmp/gate172_{red,green}.txt`）；已挂 pre-commit 第 6 闸；与原型差异及局限见 §172.2 |
| 0-3 | 视频 P2（桥 + 契约 + 页面形态 + 长跑） | ⚠️ **代码已入库 `65a27d4`；真机 V-1/V-2/U-1 过，V-3 撞引擎墙** | 桥已接通（backtrace 含 `nativeGenVideo`），但首次真实出片在 **T5/UMT5 前向**被引擎 `GGML_ASSERT(!chunk_hidden_states.empty())` abort（本仓首次执行该计算图）；另修一处 C-4 登记面缺陷（真机首跑抓出，见 §173.6）。新阻塞转 DEV_BACKLOG 项 45 |
| 0-4 | 全灰图像素取证（A6） | ✅ **§172 波已测毕** | 三选一定性取 (a) 平坦色→引擎数值面；新事实：修复后两例是 **128 中灰非纯白**（与白图旧案不同状），结论已回填 C 卷 §5.2.1，证据 `.tmp/gray172/` |

**P2/P3 本体**（本卷 §1–§7）与 0-2/0-3 无依赖，可并行排窗；但**不得与视频波次混在一笔提交里**
（项 36 台账原文就要求「逐项独立修，不得夹在视频波次里顺手改」）。

---

## 1、P2-1 队列夜间耐久（30+ 抽息屏，K90）

**这是 QUEUE_SPEC §十二 P2 行唯一未验的子项**（其余子项 §169 已补锚）。

| 项 | 内容 |
|---|---|
| 现状实物 | 保活判据是 `imageGenStore.ts:248-253` 的 reaction：`loading \|\| generating \|\| queueCore.state==='running' \|\| ==='stopping'` 四条件；busy 时 `:268` 取票据 `nightTaskRegistry.begin('imageGen')`，归零才 `:276` 停服务。原生三件：`NightTaskService.kt` / `NightTaskModule.kt` / `NightTaskPackage.kt`（前台服务 + `PARTIAL_WAKE_LOCK`）。队列侧 API：`imageGenQueueCore.ts` 的 `enqueue / updateItem / removeItem / clear / hydrate / start / stop`（全文件 317 行） |
| 为什么值得做 | 视频 P2 的长跑（80–200 分钟）与夜间连抽**共用同一条保活链**；一次通宵可同时给两件事取证，是 P2 里性价比最高的一晚 |
| 施工步骤 | ①接机、拉 scrcpy；②选低步数模型（DreamLite 秒级或 SD3.5 4 步）排 **30+ 抽连抽**（`enqueue` 累加，UI 上就是 ➕ 连点）；③`adb shell settings put global sleep_timeout 30000` 让屏自息 + **插充电**；④息屏 6–8h，次日只看证据不改行为（电池白名单引导的现状实物见 `ONDEVICE_VIDEO_GEN_ANALYSIS §7.1` + `src/store/imageGenStore.ts:63` 的 `NightTask?.isIgnoringBatteryOptimizations?.()`） |
| 判据（全绿才算过） | ①`image_gen_tasks` 落库行数 = 入队抽数，**零 running 残留**（活库在 `/data/data/com.pocketpalai/pocketpalai.db`，**不是**共享目录那份 B14 快照——§169 已栽过一次）；②`files/aios_images` 的 `gen_*.png` 增量与 success 行数相等；③logcat 有 `NightTask` 前台服务存活轨迹且**无**中途 stop；④若出现中断，中断原因必须能从 dumpsys/logcat 归因（wakelock 被放 / 系统 LMK / 电池优化），**不许写成"偶发"** |
| 红线 | 不得为"跑满"加任何重试或超时兜底；不得为了让服务不退出而改判据（判据是对的，被测的是它在真实压力下够不够）；严禁 uninstall / pm clear |
| 成本 | 一晚机时 + 次日 30 分钟读证据 |

> **§174 实测改口：本项曾被 DEV_BACKLOG 项 46 前置阻塞，现该阻塞已解除。**
> 91 抽混排（DreamLite 60× + SD3.5 31×）实跑：DreamLite 段 29 抽连成（活库 204→234），
> 14:37:06 被系统侧 `am_kill … due to from process:11200` 主动 stop（判据④已归因：非 native crash、
> 非 LMK、非保活链失效）。但跑完后查出**队列持久层克隆缺陷**（项 46）：`image_gen_queue` 120 行全
> pending，重启即复活成 3631 抽——当时判据①「落库行数 = 入队抽数」根本不成立。
>
> **现状态**：项 46 已修已入库（`d13b477`）并经真机重启双口径复验（§174.8：三击→1 项 3 抽→
> force-stop→仍 1 项 3 抽、活库仅 1 行）→ **P2-1 可重跑，判据① 现在才有意义**。
> 重跑时还要注意两点：① 本机 HyperOS 存在“被另一进程主动 stop”的先例（今日两次），
> 一夜不中断不是默认保证而是待验对象；② 上一轮 SD3.5 段在 13:11 死于 VAE 图分配的
> SIGBUS（项 30 家族），所以混排时建议 **DreamLite 段在前、SD3.5 段在后**，
> 这样即使引发作崩也能先拿到保活链证据（本窗就是靠这个排序才拿到 29 抽）。

## 2、P2-2 项 41：历史 32 行旧说谎文案（**保持待裁**）

实物：活库 `error_detail like '%强制退出%'` 命中 **32 行**（§169 实测）。这些卡今天仍在历史/相册里
说谎，而 §9.4 已判定该说法与 `pidof` 不变相矛盾。

| 候选 | 做法 | 代价与风险 | 本卷建议 |
|---|---|---|---|
| ① 只做前向修 | 旧行不动 | 零风险；但用户设备上的谎言永久存在 | 若大王认为"历史即历史"，选它 |
| ② 水合期一次性改写 | 首次水合扫 `error_detail` 含旧串的行，按 §9.4 口径覆写，完成后写一个"已订正"标记不再执行 | **引入常驻迁移**——违反不兜底红线；且动用户数据 | ❌ 不推荐 |
| ③ DRC 一次性命令 | 走 `DevToolsScreen`/DRC 手工触发一次 UPDATE，不留代码路径 | 零常驻代码、有明确人工授权点、可回滚（先备份 DB 副本到共享目录） | ✅ 若大王下令订正，选它 |

**接力窗口不得自行实现任何一档**；这格存在的意义是让大王一眼能批。判据（若批 ③）：订正后
活库旧串计数 = 0，且备份文件在位，且仓库零新增迁移代码。

## 3、P2-3 项 36③：stderr `dup2` 无轮转——**先判"该删"再谈"该转"**

| 项 | 内容 |
|---|---|
| 现状实物 | `ImageGenJNI.cpp:91-98` `redirect_stderr_once()`：`open("/sdcard/Documents/AIOS/imagegen_stderr.log", O_WRONLY\|O_CREAT\|O_APPEND, 0644)` + `dup2(fd, STDERR_FILENO)`，**无大小上限、无切割**；`:293` 在每次 `nativeLoadModel` 前调用。注释自陈目的：**捕获 ggml-vulkan 的 `std::cerr` 诊断** |
| 关键发现 | 该探针服务的路线已作废：IMAGE_GEN_UPGRADE_PLAN **§6.16「从 Vulkan 死路到 Adreno 正确路径」**，`:758/:851` 定 Vulkan 为 dormant（"一行 SD_VULKAN ON 可重启用"）。即：**为一个已放弃的路线，正在持续往用户的共享目录写无界日志** |
| 锋利结论 | 首选**删除整段**（`:91-98` + `:293` 调用），不是给它加轮转——加轮转是给死路续命，属"能加不减"的反例 |
| 施工步骤 | ①一次真机跑测：临时注释 `:293`，用 OpenCL 正常出一张图，看 logcat 是否仍拿得到需要的诊断（ggml OpenCL 走 `ggml_log` 回调进 logcat，不经 stderr——❕**本波未装机验证，接力窗必须实测这一条再删**）；②确认无信息丢失 → 删两处并留一行"探针随 §6.16 Vulkan dormant 移除，需复用于其它后端时按 O_TRUNC + 5MB 上限重写"的注释；③若确有 cerr 依赖 → 退而加**启动时截断**（`>5MB` 则 `O_TRUNC` 单文件覆盖），**不引入任何日志库、不做多文件轮转** |
| 判据 | 删除后：`imagegen_stderr.log` 不再增长；全量 native 构建通过；一张图正常产出且诊断信息未缺失（截图 + logcat 双证） |
| 红线 | 不得借"日志治理"名义顺手改后端 env 逻辑（`setenv/unsetenv` 那几处已按族分治，动它=动禁区边缘） |
| 成本 | 构建窗一次（~90s 增量编译）+ 半日 |

## 4、P2-4 项 36④：`batch_count = 1` 硬编

| 项 | 内容 |
|---|---|
| 现状实物 | `ImageGenJNI.cpp:604 gen.batch_count = 1;`，`:660 const sd_image_t& img = images[0];` —— 若将来有人把 batch 打开，**第 2..N 张会被静默丢弃**（无错误、无日志） |
| 现状判断 | 本仓**无 batch 产品需求**（连抽是队列串行多次单张，§160 起就是这个模型）。所以这不是"待实现的批能力"，而是**一处未来会咬人的静默丢数据** |
| 两种收法 | **A（推荐，能删不加）**：保持 `batch_count = 1`，但在 `:660` 前加一条**显式不变量断言**——`images.size() != 1` 即返回明确错误（复用现有 `failTaskWithReport` 通道的 native→JS 错误串），让"改 batch"必然暴露而不是静默丢图；B：真要 batch → 另立需求卷改产物落盘与任务模型（一张产物一条 task），**不在本项做** |
| 判据 | 构造性单测/真机任一：把 `batch_count` 临时改成 2 → 必须**报错**而不是只出一张；改回 1 → 正常出图（红/绿两态各跑一次） |
| 红线 | 选 A 时不得为"稳妥"加多路 fallback；A 的价值恰在"要么对要么明确失败" |
| 成本 | 与 P2-3 同一次构建窗（**同一文件同一次编译，但分两笔提交**，各自可追） |

## 5、P2-5 图标尺寸残余 W9b-V（25 处）+ W9c（12 处）

实物登记**不在 DEV_BACKLOG，在 ICON_SPEC §4.5**（C 卷 A4 行原写错，已在其 §十 更正）：

- **W9b-V**：离档值 10/13/15/22/26/32 共 12 个元素（24 处）+ 1 处 styles 常量 36 = **25 处**，
  状态「待逐屏目视」（ICON_SPEC:191）。红线明文（:200）：**不得拿"归档"当由头把 22 推成 24、
  把 10 推成 12**——那是用规范名义做视觉重排。
- **W9c**：`theme` 不在组件作用域的 6 个元素（12 处），像素零变化但需先穿参或组件内 `useTheme()`
  （ICON_SPEC:192/:204）。

| 项 | 内容 |
|---|---|
| 施工顺序 | 先 W9c（零像素、可全自动、无目视依赖）→ 再 W9b-V 分档逐屏 |
| W9c 判据 | 12 处硬写数字消失；`npx tsc --noEmit` 0 错；全量 jest 快照 318 全过（**零像素变化的硬证方式沿用 ICON_SPEC:196 的先例：改前改后各跑一轮全量 jest**） |
| W9b-V 判据 | **每一档单独一次目视**：改前/改后同屏截图对比（scrcpy + `screencap`，落 `.tmp/`），大王或本窗明确"像素变化可接受"后才进下一档；不可一次 25 处全改 |
| 判据缺口 ❕ | 项 33 的探针 `.tmp/probe_sizes_164.js` 是本仓现成的量测入口，接力窗先用它复算基线（W9b-lite 之后余量可能已变），**不要引用本卷的 25/12 当现行数——现行数以探针复算为准** |
| 红线 | 不新增 icon 档（9 档已裁）；不为"好看"改尺寸 |

> **§174 进度**：**W9c 已完**（12 处 / 6 元素硬写尺寸归零，探针复算 37→25；零像素以
> `iconSize.ts` 实物值恒等 + 6 目录内无测试锁死字面量双口径替代全量对跑——共享脏工作区里
> 做不出无混淆的改前基线，见 §174.5 自纠）。**余下全部是 W9b-V 离档 25 处**（13 元素含 1 styles 常量），
> 需逐屏目视，**不得拿"归档"当由头推尺寸**。

## 6、P3-1 跑分页国际化：**先修口径，再逐条判，最后才接线**

| 项 | 内容 |
|---|---|
| 口径已实测定案（**本卷初稿此处写反了，现更正**） | 定案脚本 `.tmp/plan171_l10n_recheck.py` 实跑三种判据：**PERF 卷的 28 可逐位复现**（口径 = 完整点号字面量 **或** `.leaf` 出现在源码）；我 §170 自跑的那支用了「叶子名在 src 任意位置出现即判活」，更宽松 → 只得出 **22，且是 28 的严格子集（漏判 6 条）**。所以 **22 是含假阴的下界，不是上界**；本卷初稿写的「含假阳上界/探针不认 property access」**方向错了**，而当时引为证据的 `BenchmarkScreen.tsx:234 {l10n.benchmark.suite.startButton}` 在两种口径下**均判活**，根本不存在漏判。漏判的 6 条含 `benchmark.suite.labels.endurance`——正是 PERF 卷 L290-291 **明文警告过**的动态下标那一类 |
| 真正要接的线（与闲置键是两批东西） | 跑分页**非注释中文硬编码实测只 4 处**：`:46 神鸡` / `:49 战斗鸡` / `:51 走地鸡` / `:242 性能回放历史`，且 en.json **没有对应键**（实测三串全 False）→ 属“**从未建键**”而非“有键未接”；因此 **那 28 个闲置键不能当接线素材**（多为已砍除的云提交链与旧版模型设置面残留），接线 = 新建键 + 逐条判旧键 | 
| 一个不能忽略的耦合 | 段位是**双口径**：`rankOf()` 返回 `{cn, ascii}`，`:120` 把 `.ascii` 写进 `share-score-card` 的像素卡。做 i18n 时**只可本地化 `cn` 一支，`ascii` 必须保持 ASCII**（像素卡字体子集不含 CJK，见 `yarn verify:fonts` 红线）——否则分享卡会变豆腐块 |
| 施工步骤 | ①**直接沿用 PERF 卷口径**（它已被实测复现，28 条为现行基数），并补上它 L290-291 要求的动态下标防护；若换新探针，必须先能复现 28 这个数才能往下判；②把 28 条分三堆：上游云提交残留（`errors.failedToSubmit`、`shareResults.*`、`buttons.viewRawData/hideRawData/runningTest/sharing`——**这些功能已随 §10.7 云提交链砍除**）、旧版模型设置面（`modelSettings.flashAttention*`、`deviceInfoCard.fields.openclRequirement`、`modelSettings.ubatch/gpuLayers/cacheTypes`——RN 版无此开关）、真该接线的；③第 1、2 堆**删**（commit message 写明逐条判据），新增那 4 处硬编码**建键接线**；④若新增语言键，须同步 `src/locales/*.json` 全部文件 + `docs/APP_INTRO_COPY.md`，并跑 `yarn l10n:validate` 与 `yarn verify:fonts` |
| 决策依赖（需大王先定） | 跑分页要不要进全语言面？现 locale 实测 **18 个 JSON 文件**（`de,en,et,fa,fr,he,id,it,ja,ko,ms,pl,pt,pt_BR,ru,uk,zh,zh_Hant`——含 pt/pt_BR 双变体，故 PERF 卷"16 语"是另一口径 ❕）。若"跑分页只做中英"，则只需 2 个 locale；若进全语言面，4 处新键 × 18 文件且非拉丁语系要过字体子集校验 |
| 判据 | `yarn l10n:validate` 全绿 + 复算死键数 0 + 跑分页 `grep` 非注释中文行为 0（注释允许）+ 分享像素卡在非拉丁语言下仍出 ASCII 段位（截图） |
| 红线 | **禁止盲删**（PERF 卷 v1.5 已立此规矩）；禁止为省事把中文塞进 en.json 代替本地化 |
| 成本 | 口径复算半天；删键半天；接线视语言面决策而定 |

> **§174 进度**：口径已复现（v1=22 / **v2=28** / v3=102，沿用 PERF 口径）；28 条已分堆，
> **堆 1（14）+ 堆 2（9）共 23 条已删**（按完整路径删，叶子同名会误伤），死键数 **28→5**。
> 关键发现：**28 里含假死**——`suite.labels.endurance` 被 `SUITE_CASES` 动态下标消费，不可删；
> 余 5 条转挂账（项 48，含「先给探针补动态下标防护」）。**未动**：4 处非注释中文硬编码的建键接线，
> 因本卷上方「决策依赖」要求大王先裁语言面。

## 7、P3-2 错误可见性三处（上游遗留，**其中一处是死码**）

| 处 | 实物 | 处置 |
|---|---|---|
| `UIStore.ts:106-109` `showError()` | 空实现（只 `console.error`），且**生产零调用方**——全仓 `showError` 命中 10 行里：定义 1、`HFTokenSheet` 的两个是**同名局部 useState**、`showErrorReport`（`components/ui/ErrorReportDialog.tsx:34`）是**另一个函数**、`ModelStore.test.ts:92/100/114` 只是 `jest.spyOn` + `mockRestore`，**无任何 `toHaveBeenCalled` 断言** | **删除该方法 + 那三行裸 spy**（能删不加）。留着它最坏的形态是：下一个人以为有统一错误出口，接上去得到一个静默黑洞——本仓 §153/§160 反复处理过这类"看着是接口其实是陷阱"的死物 |
| `PalSheet.tsx:312-316` | `catch { console.error('Error saving pal:'); // TODO: Show error message to user }` 且**不关 sheet**（注释自陈"让用户重试"）→ 用户点保存后除了按钮转圈结束，**什么都没发生** | 这是真缺口，要**接既有错误模态**（`showErrorReport` 或 DESIGN_SPEC 认定的 BannerBar/Snackbar 唯一底座——**先读 §弹窗范式**，禁新建第三模态）；只加一条"伙伴保存失败：<原因>"的可重试提示，不自动重试 |
| `utils/chat.ts:290-294` | `applyChatTemplate` 失败 → `console.error` 后 **`return formattedChat \|\| ' '`** → 拿一个空格当聊天模板继续跑，等于**静默降级成无格式上下文**（模型答得离谱时无人知道根因在这） | 改为**显式失败**（抛给调用方，让它走既有错误上报），不返回假值。这与"能加载但不能用"同罪：模板坏了就该说坏了 |
| 判据 | 三处 TODO 注释消失；②构造性单测：mock 保存抛错 → 断言错误模态被调用；③mock 模板抛错 → 断言调用方收到 rejection 而非 `' '`；①删完 tsc 0 错 + 全量 jest 绿（spy 删除不影响断言） |
| 红线 | 不新建错误组件；不把"删除死码"和"接线"混成一笔 |
| 成本 | 半天（②③需各补 1 条用例） |

> **§174 进度**：①② 已完（`UIStore.showError` 死码 + 3 行裸 spy 删除；`PalSheet` 接既有
> `showErrorReport`，不新建第三模态）。⚠️ 额外收获：旧测试两支**把 `console.error` 当断言**，
> 即把静默黑洞当绿灯——已改写为断言错误模态被调 + sheet 不关。③ **未落**：调用点在并行窗口
> 在飞文件 `useChatSession.ts`，且 `await prepareCompletion` 不在任何 try 内，单改会把
> 「静默降级」变成「静默无响应」→ 转项 47（含接线路径）。

## 8、待裁项（本卷不排期，只保证一眼能批）

| 项 | 要大王点的头 |
|---|---|
| 项 44 | `embed_kernel.py` 补 `encoding="utf-8"` 一行——**落点在引擎禁区路径**（`cpp/stable-diffusion.cpp/**`），需豁免 |
| 项 35 | 星图 `POCKETPAL_STARMAP_DOMAINS.md` 被 `.gitignore:194` 屏蔽，无历史无备份（本仓 08-24 丢过 3 个 pack）→ ①纳入跟踪 / ②加仓外备份 / ③维持现状 |
| 项 43 | 销账惯例：**销账与落码同波提交**写进 AGENTS.md 与否 |
| W11 | 视频容器（用户能否"拿走"文件）；未裁前 UI 文案不得出现"已生成视频/已保存视频"（U-5） |
| 版本 | CHANGELOG `[Unreleased]` 已堆 60+ 笔，是否定版升版；未推送提交**不写死在本卷**（任何一笔提交都会让它过期），要推时现查：`git rev-list --count origin/main..HEAD` |
| ❗新发现：**跨文档断代指针** | 星图 L76 引「MASTER_LOG §76」作电池白名单策略的凭据，而 **MASTER_LOG 现存卷宗从 §89 起头**（本波实测：`§7[6-9]` 串全卷零命中，79 个 H2 首条即 §89）——早期号段随 08-24 pack 丢失事故不在卷内。本卷已改引现行实物；**星图自身那行需手工双写订正**（它不入 git，见项 35） |

## 9、全波「明确不做」（写下来防手滑）

- 灰图自动重生成、UI 侧平坦图检测、产物收养加轮询/超时（§169 边界如实保留）
- stderr 日志引入轮转库/多文件切割（先删探针，删不掉才单文件截断）
- batch 生成能力（无需求，只补不变量）
- 视频自制播放器控件、聊天页生视频入口、新增顶栏控件（400dp 宽度硬账）
- 为闲置 l10n 键"以后可能用"而不删（定罪后删；不可定罪的转挂账，不静默保留）
- 把 `applyTaskPatch` / `imageOutDirPath` 再抽一层"以防万一"

## 10、每一波的收口 checklist（接力窗照抄执行）

1. 开工前：`gate` → `route`（带规则包：红线 / 域边界 / 指针 / 交付契约），posture 到 `agent_active` 才动码
2. 改动后：`npx tsc --noEmit` → 相关 jest 套 → 涉 UI 则全量 jest 快照对比（零像素改动的硬证）
3. 涉真机：先拉 scrcpy，人类模拟操作，严禁 uninstall/pm clear，夹具自己清（走 App 内删除路径，别摸数据库）
4. 提交：精确 pathspec（禁 `git add .`/`-A`），**逐文件核归属**（工作区脏 ≠ 我的改动）；commitlint 100 字符折行 → 用 `-F` 文件
5. 提交后：**跑 HEAD 复验脚本**（只读 `git show <rev>:<path>`），断言的是入库内容不是工作区——§170 的 B6 就是这一步抽出来的
6. 收口：MASTER_LOG 新节 + DEV_BACKLOG 销账 + 受影响 SPEC 同步 → `return`（状态如实：有未入库项就报 partial，不报 success）
