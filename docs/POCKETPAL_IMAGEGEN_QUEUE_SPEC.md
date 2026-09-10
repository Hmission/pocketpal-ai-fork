---
doc_id: POCKETPAL_IMAGEGEN_QUEUE_SPEC
module: imagegen
type: spec
status: active
version: "0.7"
created: "2026-08-27"
updated: "2026-09-08"
relates: [POCKETPAL_IMAGEGEN_UI_SPEC, POCKETPAL_STARMAP_DOMAINS, ONDEVICE_VIDEO_GEN_ANALYSIS]
---

<!-- D-FORMAT:v3 -->

# 生图队列（任务购物车）设计规格 — IMAGEGEN_QUEUE_SPEC v0.8

**状态**：active（P0/P1 已实现并平板实机验收通过，P2 待夜间耐久；DECISION D1-A/D2-A/D3-A/D4-A 定稿） | **版本**：0.8 | **更新**：2026-09-08

> v0.4（2026-09-07 W4 文档-代码对账）：按代码现状回写四处失真——§六.2 判据由「三条件」改为实际**四条件 + 票据制**、§六.4/6.5 补 W1 失败可见性收口（超时真 cancel / 停止有界确认）、§九 队列表迁移版本 3→**10**、§十 互斥行为由「冲突显式报错」改正为**自动抢占**；另删除 frontmatter 不存在的 `IMAGEGEN_UI_SPEC` 悬空 relates。
>
> v0.5（2026-09-07 W5 接口面收口）：§七 新增两条——「N 项 · M 抽」拼法单点 `formatQueueSummary`
> （`GenActionBar` 不再接已格式化字符串 prop，组件内兜底删）与 QueuePanel 零消费的 `totalDraws`
> prop 删除；队列面板条目徽章改与模型下拉同源显示族名（旧行直接打 `sd3` 等内部键）。均为接口/文案
> 面收口，状态机与执行器零改动。
>
> v0.6（2026-09-08 §168 项 38 根治）：§九 恢复语义**重写**——新增 §9.1 通道归属表（谁能被收养）、
> §9.2 收养判据（**产物落盘证据 + 严格唯一**，不用心跳超时猜）、§9.3 队列侧不变项、§9.4 失败文案
> 与实测对齐（旧文案“被强制退出”与 `pidof` 不变相矛盾）。同时推翻两处旧推定：项 38 原描述的
> “ONNX 产物可能已落盘”（写盘在 JS 侧，不成立）与 §167 草图的 `g_gen_in_flight`+`tickMs` 凭据
> （只能证“活着”不能证“会落地”，且必带超时兜底，已作废）。
>
> v0.7（2026-09-08 §169 真机接机修正）：§9.1 里“最后一个 ReactContext 销毁即销毁 JS 运行时”被
> **直接实验否证**（开「不保留活动」后仅销毁 Activity：pid 不变、任务照常跑完并落盘、无水合日志）
> → 幽灵分支的真实前置是“JS 续体确实没了”（进程终止或运行时被单独释放），不是“Activity 被回收”。
> 同时按实测把 §9.4 的文案再收一格：连“界面被系统回收”这一因果断言也删掉，只写可观察事实。
>
> v0.8（2026-09-08 §169 native 收养分支真机跑通）：① §9.2 补登“同一条锁的第二扇门”——
> 水合内 `await this.init()` 与直接调 `patchTask` 是同一类自锁（`init()` 末行 `await ensureReady()`），
> 后果是整条写路径永久挂起；收法为只取路径的纯函数 `imageOutDirPath()`，并补按生产形态接
> `readyPromise` 的回归测试。② 新增 §9.5 真机取证口径（**活库在私有目录，共享目录只是 B14 去抖
> 快照**——拿快照判“未落库”必得假结论；计时文本必须有起点守卫）。

> **定位**：为「任务购物车（连抽队列）」能力提供决策完备的设计规格——数据、状态机、执行器、UI、持久化、错误登记、迭代路线。生图页 UI 细则仍以 `POCKETPAL_IMAGEGEN_UI_SPEC` 为准，本卷只增补队列专属设计。

## 一、背景与目标

手机端端侧推理慢（Z-Image 单张 10.9 分钟），夜间长跑多图生成场景需要**预先规划任务清单**（购物车心智）：规划期自由编排（不同提示词/参数/模型，同任务可多次点击=多抽），开始执行后依次跑，执行中可停止，停止后恢复编辑。

**最终目标**：手机端夜间长跑多图生成成为一等公民能力——与既有 nightTask 域（前台服务 + WakeLock + 电池白名单引导）无缝衔接。

## 二、核心设计原则（锋利哲学）

1. **规划期/执行期分离**：规划期自由编辑；执行期 UI 锁定（手机算力有限，执行期交互必然卡顿——大王裁定方向）。
2. **复用不新建**：画廊任务化（beginTask/finishTask/failTask + WatermelonDB + 幽灵治理）、nightTaskRegistry、engineMutex、心跳超时（120s/600s）全部复用；不复制逻辑。
3. **参数快照入队冻结**：队列条目持有生成参数快照，不引用活动表单。
4. **失败继续是队列原子语义，不是兜底**：单项失败标记 failed，继续下一项，结束汇总；不重试不静默。
5. **无兜底无补丁**：停止=显式中断（native cancel 已具备）；超时=显式失败；恢复=显式标记。

## 三、DECISION 待拍板项（大王确认后本卷转定稿）

| # | 决策点 | 选项 A | 选项 B | 推荐 |
|---|---|---|---|---|
| D1 | ➕ 入口形态 | 出图按钮内部切两半（左窄 ➕ + 右宽「出图」） | 出图按钮不动，入队后出现「队列胶囊条（N 项待抽）」→ 点开面板 | A（贴合大王原意；实测若挤则退 B） |
| D2 | 停止语义 | **立即中断当前抽**（native cancelTxt2img，引擎已有完整取消链） | 跑完当前抽再停 | A |
| D3 | 排队中可否编辑 | 可自由增删改（规划期）；执行期严格锁定，停止后恢复 | 入队即锁定 | A |
| D4 | 队列持久化 | WatermelonDB 新表（image_gen_queue，自动获得 B14 快照保护） | AIOS 目录 JSON 文件 | A |

## 四、状态机

```
┌─────────┐   ➕/编辑    ┌──────────┐   开始(≥1项)   ┌─────────┐  全部完成   ┌──────┐
│  idle   │ ──────────► │ planning │ ─────────────► │ running │ ─────────► │ done │
└─────────┘             └──────────┘                └─────────┘             └──────┘
   (无队列)     停止/编辑  ▲  ▲  │ 停止(interrupt)     │ 单项失败→继续下一项
                         │  └──┴─────────────────────┘
                         └─► 回 planning（当前抽标 failed('用户停止')）
```

- `running → stopping` 过渡态：停止已按下、native cancel 在途；两按钮（开始/停止）均禁用，杜绝双写竞态。
- 队列运行期 UI 锁定面：模型下拉、加载/卸载按钮、出图/➕（现有 generating 灰置逻辑自然覆盖，需补充队列面板内锁定）。

## 五、数据结构

```ts
/** 生成参数快照（入队冻结；从 handleGenerate 提取下沉的实体） */
interface GenParamsSnapshot {
  prompt: string;
  negativePrompt: string;
  steps: number;
  cfg: number;
  size: number;        // 方形尺寸（SD 族）
  ratio: string;       // 非 Dream 比例档；Dream 画幅档位
  seed: number;        // 空→随机（入队时生成，保证多抽非重复）
  family: string;      // 'dreamlite' | 'sd3' | 'zimage' | ...
  modelId: string;     // manifest id（加载/切换依据）
  loraEnabled: boolean;
  loraMultiplier: number;
}

interface QueueItem {
  id: string;              // 队列条目 id（非任务 id）
  snapshot: GenParamsSnapshot;
  total: number;           // 购物车抽数（相同快照去重累加）
  done: number;            // 已完成抽数
  failed: number;          // 失败抽数（done 内细分或独立均可，汇总用）
  status: 'pending' | 'done' | 'failed';  // done/failed = 条目整体终结
}

type QueueState = 'idle' | 'planning' | 'running' | 'stopping' | 'done';
```

- 每抽落地为画廊任务（running→success/failed），与现有单张生成完全同构。
- 相同参数快照去重累加抽数（购物车语义：`2×` 徽标）；prompt 不同必为独立条目。

## 六、执行器语义（queueRunner，落 imageGenStore/service 层）

```
loop:
  for item of queue (status=pending):
    for i in 1..(item.total - item.done - item.failed):
      ensureModelLoaded(item.snapshot.modelId)   // dreamlite: loadDreamLiteEntry / sd: resolveCompanions+loadModel
      uri = runGenTask(item.snapshot)            // beginTask → generate*/edit* → finishTask/failTask
      失败 → item.failed++ 且 continue           // 队列原子语义：失败继续，不重试
  done → 汇总 (N 成功 / M 失败)
```

关键约束：
1. **key 重构（P0 前提）**：把 handleGenerate 的「参数→生成」核心抽为 `runGenTask(snapshot)` 下沉 imageGenStore；组件层 handleGenerate（校验/引导/动效）与队列执行器共用同一下游；`loadEntry` 的模型加载链同步下沉（resolveCompanions/loadModel/loadDreamLiteEntry）。**消除组件层闭包复制**。
2. **nightTask 恒 busy**：判定式为**四条件** `loading || generating || queueCore.state==='running' || queueCore.state==='stopping'`（imageGenStore 单点 reaction，S5 已落地）——防模型切换时 loading/generating 翻转导致前台服务反复启停。2026-09-07 W2 起 begin **返回票据**（`nightTaskRegistry.begin('imageGen')`），只有持票者能 `end` 自己的额度：旧裸计数下「队列长跑时结束一次通话就把前台服务停掉、息屏即被杀」是真实反例。
3. **引擎切换**：跨模型条目之间 unload+load（复用现有行内按钮卸载/加载链路）；切换耗时计入队列进度展示。
4. **心跳超时**：复用现有 120s(Vulkan)/600s(CPU/OpenCL) 判活；超时=当前抽 failTask('采样超时') + **continue 下一项**（注意：判活置 generating=false 后引擎仍驻留，下一项 ensureModelLoaded 复用驻留引擎）。2026-09-07 W1 收口：超时分支**必须真发 native cancel**，让在途 `generate()` 以 null 干净返回、由 runGenTask 自然落 failTask——旧实现只改 UI 再 return，任务卡会永停 running。
5. **停止**：`stopQueue()` → JNI `cancelTxt2img()`（设置取消标志）→ 引擎采样/VAE 解码循环检查标志干净退出（见 §八技术验证）→ 当前抽 failTask('用户停止') → 队列回 planning。2026-09-07 W1 收口：cancel 与执行器退出都**等结果**——`await cancelTxt2img()` 失败即置错留痕；`queueCore.stop()` 由执行器 `finally` 唤醒（不再 `while(running) await sleep(50)` 忙等），**15s 有界确认**；确认超时则如实报错「停止未确认……需重启应用」，状态留在 `stopping`，**不伪造已停止**（唯一出口是重启）。

## 七、UI 设计（细则入 IMAGEGEN_UI_SPEC 增补）

- **GenActionBar**：出图按钮形态按 DECISION D1；➕ 入队（当前表单参数实时快照）；执行期灰置。
- **队列面板**：OverlayCard 底座（2026-08-25 弹窗范式唯一底座）；列表行 = prompt 单行摘要 + 模型族徽章（语义色，SD3.5 紫 / Z-Image 青）+ `2×` 抽数徽标 + 状态徽标（pending/done/failed/单抽失败计数）。
- **条目编辑**：点条目 → 参数回填 composer（复用 syncFromParams 同源逻辑）→ 改完「更新条目」（仅 planning 态可用）。
- **开始**：底部主按钮「开始队列（N 项 · M 抽）」；running 态主按钮变「停止队列」（红色描边，二次确认走 confirmDialog 同款）。
- **进度**：队列面板顶部「第 i/N 项 · 第 j/M 抽」+ 预览区照常显示当前任务页（peviewIndex=1，动效与单张一致）。
- **完成**：汇总卡（成功 X / 失败 Y）+「清空队列」；失败项可点击看报错（复用失败任务页一键复制）。
- **入口**（选做，非 MVP）：画廊「同参数/复刻生图」可扩展「加入队列」。
- **摘要文案的口径（v0.5 W5 收口）**：胶囊条与「开始队列」按钮的「N 项 · M 抽」拼法单点 =
  `ImageGenScreen/constants.ts` 的 `formatQueueSummary(items, draws)`；组件只接**数值**
  （`queueItemCount` / `queueTotalDraws`），编排层不得再把拼好的字符串当 prop 传进来
  （旧写法另在组件内留了一份 `${n} 项` 兜底，两种格式并存）。两处传的 `draws` 语义**有意不同**：
  胶囊 = 总抽数（看存量），开始按钮 = 剩余抽数（看要做的事），只统一措辞不统一口径。
- **面板 props 不留空位**：`totalDraws` 曾传给 QueuePanel 但从不读（面板自己按 items 算剩余）
  ——v0.5 删字段：能删不加，零消费接口不进契约面。
- **testID 域**：面板 `imagegen-queue-panel` / 动作 `queue-start`·`queue-stop`·`queue-clear`·`queue-close` / 行内 `queue-item-{i}`·`queue-remove-{i}` / 入口 `imagegen-queue-badge`·`imagegen-queue-capsule`。逐条值以代码为准（本文档不复制清单，防漂移）；e2e 契约的唯一真值源是 `e2e/helpers/selectors.ts`。

## 八、技术验证记录（P1 停止能力，已取证）

`stable-diffusion.cpp` 已有完整取消链，**零引擎改动**，仅需 JNI 暴露一个口子：

| 证据 | 位置 |
|---|---|
| 原子取消标志 + set/reset/get | stable-diffusion.cpp:286-298（`cancellation_flag` / `sd_cancel_mode_t`） |
| 采样循环每步消费 | stable-diffusion.cpp:2623-2626（`get_cancel_flag() == SD_CANCEL_ALL` → 干净返回） |
| VAE latent 解码消费 | stable-diffusion.cpp:5409-5412 |
| **公开 API 已暴露** | stable-diffusion.cpp:3920-3927（`SD_API sd_cancel_generation(sd_ctx, mode)`） |

落地面：`ImageGenModule.kt` 新增 `ReactMethod cancelTxt2img()` → JNI 调 `sd_cancel_generation(g_ctx, SD_CANCEL_ALL)` → JS 侧收到生成返回 → failTask('用户停止')。cleanup 路径与现有 unload 共用，不新增清理补丁。

## 九、持久化与恢复（D4 裁定后细化）

- 队列表 `image_gen_queue`（WatermelonDB）：QueueItem 全字段 + 队列元（state 不持久化，仅 planning 态可水合并由用户手动开始）。
- **迁移机制已验证（2026-08-27）/ 版本已按代码改正（2026-09-07 W4）**：`src/database/schema.ts`（tableSchema 追加）+ `src/database/migrations.ts`（`schemaMigrations` + `createTable`）。本卷早期把队列表写作 `toVersion: 3`（规划值，当时仅到 v2），**实际落地是 `toVersion: 10`**（`schema.ts` 当前 version 10；同卷 §十三 S3 记的也是 v10——卷内自相矛盾已按代码改正）+ model 类 + collection getter。与 image_gen_tasks 同构，自动获得 B14 整库快照保护（prepareSharedStorage + scheduleDbSnapshot 复用，零新增）。
- 恢复语义（**v0.6 重写：按“产物证据”收养，不再一律判死**）：见 §9.1–§9.4。旧写法
  “水合时 `running/stopping` 一律回 `planning`，当前抽在画廊无条件落 failed('生成中断')”
  在真机上会误伤（项 38，MASTER_LOG §164 实捕：生成中退桌面约 40 分钟后回 app，任务显示
  「生成失败/生成中断」而 **pid 全程未变**）。
- 条目 `pending` 保留（抽数不丢失），用户重新点开始续跑。

### 9.1 通道归属：谁能被收养，谁不能（实测，不是推定）

运行时重建会摧毁旧 JS 续体——但**“Activity 被销毁”不等于“运行时被销毁”**（§169 K90 实测推翻旧推定）。
当年本卷写的“bridgeless RN 下最后一个 ReactContext 销毁即销毁 JS 运行时”已被直接实验否证：

> 实测（§169，开发者选项「不保留活动」=1）：DreamLite 出图途中按 home → `topResumedActivity` 确实变成
> `com.miui.home/.launcher.Launcher`（Activity 已被销毁）且 **pid 全程不变** → 等 100s → 回 app：
> 任务以 **success 卡**呈现（`dreamlite · 80.1s · 832×1216`）、`files/aios_images` 从 63 增到 64（产物真的落盘）、
> logcat **无任何水合/幽灵治理日志**。→ 结论：仅销毁 Activity 时 JS 续体仍存活，任务会正常跑完，
> **根本不会进入幽灵分支**。

以本卷判据而言，真正摧毁 JS 续体的是另两种情形：**进程终止**（用户划掉/系统杀进程/崩溃），
或**运行时被单独释放而进程存活**（§164 那类长时间离场）。因此下表的“能否被收养”**成立条件
是“JS 续体确实没了”**；续体存活时任务自己会完成，无需收养。

判定只看一件事：**产物是由 native 写盘还是由 JS 写盘**——JS 已死时，JS 侧的后续代码不可能执行。

| 通道 | 引擎调用方 | **产物写盘方** | 运行时重建后可收养？ |
|---|---|---|---|
| txt2img（SD3.5/Z-Image/Klein/Krea2/Wan） | Kotlin `Thread{}` → `nativeTxt2img` | **native**（`ImageGenJNI.cpp:664  stbi_write_png(outStr,…)`） | ✅ 能——线程与写盘不依赖 JS |
| DreamLite（ONNX）/ 超分 / TTS | JS 直调 `onnxruntime-react-native` 会话 | **JS**（`encodePng` + RNFS 写入） | ❌ 不能——推理线程可继续，但无人把结果落盘 |
| 图像反推（caption） | JS 直调视觉会话 | **无图像产物**（产物是文本，写进任务行） | ❌ 不能，且**根本没有文件可扫** |

> 三条归属均逐项验实物，不是一处推全类（2026-09-08）：JS 写盘——`dreamLiteEngine.ts:13`
> （`encodePng`/`toBase64` 入 import）、`superResEngine.ts:257-259`（`encodePng` + `RNFS.writeFile`，
> 产出名 `upscaled_*.png`，不落 `gen_` 前缀）、`tts/sherpaConvert.ts:52/67`；反推无产物——
> `captionEngine.ts` 全文 172 行，`RNFS`/`writeFile`/`encodePng`/`.png` **零命中**。
> 本表旧版把「反推」列进 JS 写盘通道不精确（代码行为不受影响：收养 gate 已要求
> `kind === 'generated'`），由 CHAIN_AUDIT_20260908_C 项 B5 更正。

> 本表同时**推翻项 38 原描述里的一句推定**：“原生/ONNX 线程其实还在跑，**产物可能已落盘**
> 却对用户显示假失败”——对 DreamLite（即当时实捕的那一例）**不成立**：写盘在 JS 侧，
> 运行时一重建这条链就断了。当时那次的真实缺陷是**文案说谎**（见 §9.4），不是误杀好产物。

### 9.2 收养判据：产物落盘证据，不用心跳阈值猜

**已作废的草图**（MASTER_LOG §167 曾登记）：“JNI 加 `g_gen_in_flight` + 快照带 `tickMs`，
水合时先问存活”——它被 §9.1 的归属表推翻：① 凭据只能证明“还活着”，不能证明“结果会落地”
（JS 通道活着也写不出图）；② 要拿它当凭据就得定一个心跳超时阈值，而 VAE 解码期本就无 step
回调（VIDEO_GEN_SPEC §3.5）→ 又回到“猜”，违反不兜底红线。**收养需要的是产物证据，不是活着证据。**

水合时对每条 `status='running'` 的画廊条目：

1. 取 `outDir`（`RNFS.DocumentDirectoryPath/aios_images`）内 **`mtime >= 该条 ts` 且
   `size > 0`** 的 `gen_*.png` 候选集（该前缀只由 native 通道写，天然排除 JS 通道产物）。
   `mtime` 在库类型上是 `Date | null`——**取不到时刻就不算证据**（宁可不收，不拿（1970）或
   当前时刻兜底）；路径字段是 `path`（全路径）而非 `filepath`，旧写法误用后者已被 tsc 拒下。
2. **严格唯一才收养**：恰好 1 条 running × 恰好 1 个候选 → 收养；否则不猜，一律标失败。
   互斥链保证同一时刻只有一抽在跑（`engineMutex.acquire('image')` + 队列串行），所以唯一
   就是真；出现多候选正说明状态已不可信，宁可不收。
3. 收养动作：复用任务完成的**同一个变更原语**（内存 + DB 双写），不新建第二套完成路径。
   **已知坑（实测前置防）**：本判定跑在 `ensureReadyImpl` 内部，而 `patchTask`/`finishTask`/
   `failTask` 都会 `await this.readyPromise`——那个 promise 正是本次尚未 settle 的执行，
   调用即**自锁**（旧代码直接摸 repository 就是这个因由）。收法：抽出无门禁原语
   `applyTaskPatch(taskId, patch)`，`patchTask` = 就绪门禁 + 该原语，幽灵分支直接用原语，
   全仓仍只有一处“任务状态双写”实现。
   **同一条锁的第二扇门（§169 真机实证）**：抽出 `applyTaskPatch` 并不等于水合链干净——
   `adoptFinishedTasks` 为拿 `outDir` 而 `await this.init()`，而 `init()` 末行也是
   `await this.ensureReady()` → 与直接调 `patchTask` 完全等价的自锁。后果不是“没收尾”而是
   **整条写路径永久挂起**（`beginTask`/`patchTask`/`init` 全在等这个永不 settle 的 promise）。
   且因 JS 通道幽灵在 `isNativeProductTask` 处早退、从不碰 `init()`，单测与 DreamLite 真机
   验证均恰好绕开它——**native 收养分支在 §169 之前从未真机跑通过**。
   收法：扫盘只需要**路径**，不需要 `init()` 的副作用（mkdir / GPU 探测 / 门禁）→
   抽纯函数 `imageOutDirPath()`，`init()` 与幽灵分支共用（路径仍单点定义，不二处拼字符串）。
   **防线（§169 补）**：回归测试必须按**生产形态**接 `readyPromise`（把本次 `ensureReadyImpl()`
   赋给 `readyPromise` 再等它 settle）并显式置空 `outDir`——直接调 `ensureReadyImpl()` 的用例
   等的是构造期已 settle 的旧 promise，锁不住也测不出；单例残留的非空 `outDir` 会使该用例
   在全量跑时失去鉴别力（红/绿两态均已实测）。
   `durationMs = 文件 mtime - 条目 ts`（真实测量，非估算）；未命中→标失败，文案按 §9.4 分通道说真话。

### 9.3 队列侧恢复（不变）

队列 `running/stopping` 仍一律回 `planning`（队列 state 本来就不持久化）；差别只在于：
当前抽的**画廊条目**不再无条件判死，而是先过 §9.2 的产物证据门——否则会出现“队列回
planning 而当前抽已出图”的双事实源。`pending` 条目语义不变（抽数不丢）。

### 9.4 失败文案必须与实测一致（本项的真正缺陷面）

旧文案「应用在上次生成中被**强制退出**，任务未完成」与取证矛盾：`pidof` 前后相同、
无 tombstone——当时把它改写成「界面被系统回收」，而 **§169 实测证明这一句同样是对因果的断言**：
仅销毁 Activity 时任务根本不会失败，而进程被杀时确实没有“只是回收界面”。

**因此本条的裁定是：删掉因果断言，只写可观察事实**（能删不加；为区分“进程被杀”与“运行时被释放”
需新增一个进程起点信号，而它对用户下一步动作没有任何增量价值）：

- JS 通道无产物：「本次生成未完成（生成续体已随应用重启失效，推理结果无法落盘），请重试」；
- native 通道无产物：「本次生成未完成（未找到产物文件），请重试」；
- 有产物且严格唯一：按 §9.2 收编为 success（这才是唯一能拿实物当凭据的分支）。

禁止再出现的具体字样：「被强制退出」（与 pidof 不变矛盾）、「界面被系统回收」（仅销毁 Activity 时
并不导致失败）。另登记一项未做：若将来需向用户解释“为何后台会丢任务”，再评估是否引入进程起点信号。

> **32 行存量订正（2026-09-10 §180）**：§169 发现的历史 `error_detail like '%强制退出%'` 32 行已按
> 大王裁③在水合期**一次性订正**为通用口径「本次生成未完成，请重试」——旧行通道未知，带括号原因即
> 断言，故不带；订正实现 `ImageGenTaskRepository.rectifyLegacyFailureText`（幂等、原值留日志回滚痕迹、
> 无常驻迁移），`imageGenStore.initQueue` 水合后调用。

### 9.5 真机取证口径（§169 血泪，后续窗口照此办事）

- **活库在私有目录，共享目录那份只是快照**：WatermelonDB 实际落
  `/data/data/com.pocketpalai/pocketpalai.db`（`paths.ts` 注释与实测一致），
  `/sdcard/Documents/AIOS/database/pocketpalai.db` 是写入后 **debounce 导出**的 B14 快照；
  进程被 force-stop 时待导出的快照不会刷新——**拿快照判「这一行没落库」必然得出假结论**
  （§169 一度据此误判 SD3.5 幽灵未落库，改读活库后该行赫然在列且 `status=running`）。
  取法：`adb exec-out run-as com.pocketpalai cat pocketpalai.db`（连同 `-wal`），
  读前先 `am force-stop` 让库静止；PowerShell 的 `>` 会按文本重编码，必须走 .NET BaseStream。
- **区分「内存态」与「落库态」用二次重启**：再重启一次即可分辨（内存态消失、落库态重现）——
  §169 靠此确认那张 running 卡是每次启动都被重建的持久态，而非本进程残留。
- **计时类文本必须有起点守卫**：`genStartedAt` 是本进程内任务启动时刻，水合出的 running 卡
  本进程没跑过它 → 无守卫时 `now - 0` 把 epoch 秒当已耗时渲染成 `1788871961s`（真机截图实证）。
  起点缺失一律显 `--`（与 `PerfPanel` 缺值同一记号），不拿 `now-0` 编时长；
  `ImageTaskProgress`（聊天侧同源卡）早已有此守卫，`ResultPreview` 曾漏——**同源卡片的两处实现必须对账**。
- **水合日志不能当「未运行」的证据**：`ghost running tasks` 日志在 `ghost.length > 0` 分支内，
  无幽灵时静默是预期行为；要证伪“未运行”得拿库/卡面证据，不能拿日志缺失当否定证据。

## 十、错误登记（守卫指南针 CP-APP 映射）

| 场景 | 登记 | 行为 |
|---|---|---|
| 引擎互斥（chat 占槽） | CP-APP-004 | **开始前不校验、不报错**：`startQueue` 只挡 `loading/generating`；每抽经 `engineMutex.acquire('image')` **自动抢占释放 chat**（`EXCLUSIVE_PAIRS` chat↔image），与引擎域 §9.2 互斥语义一致（旧文档「冲突→显式报错」与实现相反，W4 按代码改正） |
| 抢占释放超时（30s） | CP-APP-004 | 互斥链**唯一显式失败出口**：releaser 挂起 → `withTimeout` 抛「xxx 引擎释放超时（30s），请重启应用重试」+ 置空闲自愈，不永久挂起 |
| OpenCL/Vulkan hang | CP-APP-005 | 心跳超时 → 当前抽 failed + 继续下一项 |
| txt2img 失败/ERR_ | CP-APP-006 | 单项 failTaskWithReport（一键复制） |
| 前台服务启动失败 | CP-APP-010 | 队列开始前复用 requestBatteryOptOutIfNeeded |
| 模型加载失败/缺伴侣 | CP-APP-003 | 该模型全部条目 failed + 继续下一模型；汇总展示 |
| 用户停止 | 新增登记（归 CP-APP-006 兜底面） | 当前抽 failed('用户停止')，队列回 planning |

## 十一、6D 排查摘要（2026-08-27 窗口）

- **D1 数据**：快照冻结；持久化新表；画廊任务复用；HistoryStrip 解码风暴已由 FlatList 窗口化根治（50 张验证），队列长跑安全；内存 history 上限 50 条（DB 全量保留，可接受）。
- **D2 控制流**：状态机 §四；停止=interrupt；超时=continue；失败=标记继续。
- **D3 状态**：队列状态**唯一真值源在 `ImageGenQueueCore`**（类自身 observable）；imageGenStore 侧 `queueState/queueItems/queuePosition/queueTotalDraws/…` 全是**同名 computed 代理**，不存副本、无同步窗（2026-09-07 W2：旧镜像字段 + `syncQueueMirror` + 11 处调用全删，UI 代码零改动）；预览区单状态机不动；队列运行期 taskKind='gen' 动效一致。
- **D4 竞态**：stopping 过渡态防双写；执行器全串行 await；入队幂等累加；nightTask 恒 busy；连点防抖（现有 generating 灰置）。
- **D5 错误**：§十 全登记，显式失败不静默。
- **D6 演进**：执行器=store 层一等公民批量执行器，nightTask 域（生图/未来视频）共用；队列与 benchmark 域正交；画廊入口扩展为选做。

## 十二、迭代路线（每步独立闭环可发布）

| 迭代 | 范围 | 验收 |
|---|---|---|
| **P0**（单模型闭环） | 数据结构 + GenParamsSnapshot 下沉（runGenTask 重构）+ 入队/编辑/删除/清空 + 单模型执行（DreamLite 秒级先通）+ 队列面板 UI（OverlayCard）+ jest | ✅ tsc 0 错；jest 20/20；**平板实机验收通过**（连点累加/面板/串行连跑/停止，MASTER_LOG §116.7） |
| **P1**（停止与跨模型） | native cancelTxt2img + 停止语义 + 跨模型切换 + 失败继续 + 汇总卡 | ✅ 实现完成（JNI/Kotlin/store 停止链）；停止流程平板实测通过（DreamLite 在途抽自然完成后停止）；SD 族 native cancel 即时性待真机专项 |
| **P2**（夜间耐久） | 持久化恢复（幽灵队列治理）+ nightTask 恒 busy 收口 + K90 夜间模拟（息屏充电）+ 门禁五关 + 文档闭环（IMAGEGEN_UI_SPEC 增补/星图勘误/MASTER_LOG §N） | ✅ 幽灵治理真机双分支已过（§169 Test C/E，rev `6760ea2`）；队列水合恢复真机复验（§169 Test D v2 前置轮：重启后面板显「排队中 · 第 2/3 抽 · 待抽」且 running 行水合回在飞抽；设备 aab688d9、2026-09-08）。⏳ 夜间 30+ 抽息屏模拟仍待专项 |

> **P2 未完子项的施工规格已外置**（§171）：夜间 30+ 抽息屏耐久的现状实物（reaction 四条件
> `imageGenStore.ts:248-253`）、排期步骤、四条全绿判据与红线→ `POCKETPAL_WAVE_PLAN_P2P3.md` §1。
> 本表只定范围与状态，**不在此重复施工细节**（免双事实源）。

## 十三、实现接缝清单（2026-08-27 已逐项取证，P0 开工零侦察）

| # | 接缝 | 取证结论 | P0 状态 |
|---|---|---|---|
| S1 | runGenTask 下沉 | handleGenerate（ImageGenScreen.tsx:866-985）的调用面已确认：beginTask 字段组 / generateDreamLiteEntry(w,h,steps,p) / generate(p,{steps,cfg,width,height,seed,negativePrompt,loraPath,loraMultiplier,modelLabel}) / finishTask-failTaskWithReport。下沉=快照→同参数调用，组件层仅保留校验/引导/动效 | ✅ 全量闭环：store 侧任务化一体（含 hooks.onTaskStarted 保持动效时序）；组件层 handleGenerate 已复用 runGenTask（~100 行 → ~40 行，校验/引导/动效保留） |
| S2 | 模型加载下沉 | loadEntry（ImageGenScreen.tsx:322-360）含 resolveCompanions+loadModel/loadDreamLiteEntry+推错链路——整段搬入 store，组件层仅按 manifest 行内按钮触发 | ✅ 快照自包含方案落地（mainPath/伴侣/backend/loraPath 入队时组件层解析），runGenTask 内 ensureModelLoaded；行内按钮 loadEntry 维持现状（推错链路与 UI 反馈耦合，收口收益低风险高，留测试治理窗后专项） |
| S3 | 队列表 | schema.ts + migrations.ts toVersion:10（createTable）见 §九；model 类 + collection getter 对齐 ImageGenTask 模式 | ✅ schema v10 + migrations toVersion 10 + ImageGenQueue model + ImageGenQueueRepository（upsert/remove/clearAll）
| S4 | native cancel | ImageGenModule.kt 新增 ReactMethod cancelTxt2img()（模式同 getGpuRenderer:200-230）+ ImageGenJNI.cpp 调 sd_cancel_generation(g_ctx, SD_CANCEL_ALL)——JNI 层 g_ctx 已在 nativeLoadModel 持有，零新增状态 | ✅ P1 已完成：JNI nativeCancelTxt2img（不持 g_mutex——nativeTxt2img 全程持锁跑长任务，持锁会阻塞停止）+ Kotlin cancelTxt2img ReactMethod + store.stopQueue 接入（**await 结果 + 15s 有界确认**，见 §六.5；core 见 stopRequested 不计抽数。旧口径「fire-and-forget」已于 2026-09-07 W1 作废——它正是「按了停止没反应」的根因） |
| S5 | nightTask 恒 busy | imageGenStore.ts:180-202 reaction 条件 `loading||generating` → 加 `queueActive`；执行器 begin==end 对保持引用计数平衡 | ✅ reaction 四条件（loading/generating/queue running/stopping）
| S6 | l10n | src/locales/en.json 追加队列 keys（validate:l10n 门禁） | ✅ 跟随生图页现有惯例硬编码中文（GenActionBar「出图」同链路），不引入新 l10n 面
| S7 | jest | queueStore 状态机/执行器/恢复三组用例，挂 src/store/__tests__/（对齐 ModelStore.test.ts 模式） | ✅ imageGenQueueCore.test.ts 11 用例全绿（入队幂等/编辑/删除/清空/失败继续/停止不消耗抽数/水合/防重入）；ghost 测试 mock 边界补全 2 处 |

## 十四、测试与门禁

- **jest**：queueStore 状态机（入队幂等累加/编辑/删除/清空）、执行器（失败继续/停止/超时继续）、恢复（running→planning + 当前抽 failed）。
- **l10n**：新增 key 全部以 en 为基准（validate:l10n 绿）。
- **真机**：K90 队列「DreamLite 3 抽 + Z-Image 2 抽」混合链路 + 停止即时性；夜间模拟（息屏 + 充电 + 白名单）。
- **门禁**：UI_GATE_VERIFICATION_SOP 五关（tsc/jest/Gradle/装机/性能）。

## 十五、非目标（锋利边界）

- 不触碰引擎层红线（llama.rn / ONNX JNI / engineMutex 语义不变；JNI 仅新增 cancel 口子）。
- 不做执行期进度内编辑（停止→编辑→重新开始的显式闭环已够锋利）。
- 不做任务排序拖拽/批量导入/计划任务（夜间定时启动）——超出本卷，后续独立决策。