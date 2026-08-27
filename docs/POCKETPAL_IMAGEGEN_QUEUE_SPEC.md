---
doc_id: POCKETPAL_IMAGEGEN_QUEUE_SPEC
module: imagegen
type: spec
status: active
version: "0.3"
created: "2026-08-27"
updated: "2026-08-27"
relates: [POCKETPAL_IMAGEGEN_UI_SPEC, POCKETPAL_STARMAP_DOMAINS, ONDEVICE_VIDEO_GEN_ANALYSIS, IMAGEGEN_UI_SPEC]
---

<!-- D-FORMAT:v3 -->

# 生图队列（任务购物车）设计规格 — IMAGEGEN_QUEUE_SPEC v0.3

**状态**：active（P0/P1 已实现并平板实机验收通过，P2 待夜间耐久；DECISION D1-A/D2-A/D3-A/D4-A 定稿） | **版本**：0.3 | **更新**：2026-08-27

> **定位**：为「任务购物车（连抽队列）」能力提供决策完备的设计规格——数据、状态机、执行器、UI、持久化、错误登记、迭代路线。生图页 UI 细则仍以 IMAGEGEN_UI_SPEC 为准，本卷只增补队列专属设计。

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
2. **nightTask 恒 busy**：队列运行期 `queueActive=true` 期间 nightTask 引用计数恒 begin（现有 reaction 改为 `loading || generating || queueActive` 三条件；或执行器自行 begin/end）——防模型切换时 loading/generating 翻转导致前台服务反复启停。
3. **引擎切换**：跨模型条目之间 unload+load（复用现有行内按钮卸载/加载链路）；切换耗时计入队列进度展示。
4. **心跳超时**：复用现有 120s(Vulkan)/600s(CPU/OpenCL) 判活；超时=当前抽 failTask('采样超时') + **continue 下一项**（注意：判活置 generating=false 后引擎仍驻留，下一项 ensureModelLoaded 复用驻留引擎）。
5. **停止**：`stopQueue()` → JNI `cancelTxt2img()`（设置取消标志）→ 引擎采样/VAE 解码循环检查标志干净退出（见 §八技术验证）→ 当前抽 failTask('用户停止') → 队列回 planning。

## 七、UI 设计（细则入 IMAGEGEN_UI_SPEC 增补）

- **GenActionBar**：出图按钮形态按 DECISION D1；➕ 入队（当前表单参数实时快照）；执行期灰置。
- **队列面板**：OverlayCard 底座（2026-08-25 弹窗范式唯一底座）；列表行 = prompt 单行摘要 + 模型族徽章（语义色，SD3.5 紫 / Z-Image 青）+ `2×` 抽数徽标 + 状态徽标（pending/done/failed/单抽失败计数）。
- **条目编辑**：点条目 → 参数回填 composer（复用 syncFromParams 同源逻辑）→ 改完「更新条目」（仅 planning 态可用）。
- **开始**：底部主按钮「开始队列（N 项 · M 抽）」；running 态主按钮变「停止队列」（红色描边，二次确认走 confirmDialog 同款）。
- **进度**：队列面板顶部「第 i/N 项 · 第 j/M 抽」+ 预览区照常显示当前任务页（peviewIndex=1，动效与单张一致）。
- **完成**：汇总卡（成功 X / 失败 Y）+「清空队列」；失败项可点击看报错（复用失败任务页一键复制）。
- **入口**（选做，非 MVP）：画廊「同参数/复刻生图」可扩展「加入队列」。

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
- **迁移机制已验证（2026-08-27）**：`src/database/schema.ts`（tableSchema 追加）+ `src/database/migrations.ts`（`schemaMigrations` + `createTable`，现有 toVersion:2 为先例——新队列表 = `toVersion: 3` 一个 createTable 步骤）+ model 类 + collection getter。与 image_gen_tasks 同构，自动获得 B14 整库快照保护（prepareSharedStorage + scheduleDbSnapshot 复用，零新增）。
- 恢复语义：水合时 `running/stopping` 一律回 `planning`（幽灵队列治理，与画廊 running→failed 同款显式标记）；当前抽已在画廊落 failed('生成中断')（复用幽灵任务治理）。
- 条目 `pending` 保留（抽数不丢失），用户重新点开始续跑。

## 十、错误登记（守卫指南针 CP-APP 映射）

| 场景 | 登记 | 行为 |
|---|---|---|
| 引擎忙/互斥冲突 | CP-APP-004 | 队列开始前校验 engineMutex；冲突→显式报错 |
| OpenCL/Vulkan hang | CP-APP-005 | 心跳超时 → 当前抽 failed + 继续下一项 |
| txt2img 失败/ERR_ | CP-APP-006 | 单项 failTaskWithReport（一键复制） |
| 前台服务启动失败 | CP-APP-010 | 队列开始前复用 requestBatteryOptOutIfNeeded |
| 模型加载失败/缺伴侣 | CP-APP-003 | 该模型全部条目 failed + 继续下一模型；汇总展示 |
| 用户停止 | 新增登记（归 CP-APP-006 兜底面） | 当前抽 failed('用户停止')，队列回 planning |

## 十一、6D 排查摘要（2026-08-27 窗口）

- **D1 数据**：快照冻结；持久化新表；画廊任务复用；HistoryStrip 解码风暴已由 FlatList 窗口化根治（50 张验证），队列长跑安全；内存 history 上限 50 条（DB 全量保留，可接受）。
- **D2 控制流**：状态机 §四；停止=interrupt；超时=continue；失败=标记继续。
- **D3 状态**：queueItems/queueState/queuePosition 进 imageGenStore（MobX 单缝）；预览区单状态机不动；队列运行期 taskKind='gen' 动效一致。
- **D4 竞态**：stopping 过渡态防双写；执行器全串行 await；入队幂等累加；nightTask 恒 busy；连点防抖（现有 generating 灰置）。
- **D5 错误**：§十 全登记，显式失败不静默。
- **D6 演进**：执行器=store 层一等公民批量执行器，nightTask 域（生图/未来视频）共用；队列与 benchmark 域正交；画廊入口扩展为选做。

## 十二、迭代路线（每步独立闭环可发布）

| 迭代 | 范围 | 验收 |
|---|---|---|
| **P0**（单模型闭环） | 数据结构 + GenParamsSnapshot 下沉（runGenTask 重构）+ 入队/编辑/删除/清空 + 单模型执行（DreamLite 秒级先通）+ 队列面板 UI（OverlayCard）+ jest | ✅ tsc 0 错；jest 20/20；**平板实机验收通过**（连点累加/面板/串行连跑/停止，MASTER_LOG §116.7） |
| **P1**（停止与跨模型） | native cancelTxt2img + 停止语义 + 跨模型切换 + 失败继续 + 汇总卡 | ✅ 实现完成（JNI/Kotlin/store 停止链）；停止流程平板实测通过（DreamLite 在途抽自然完成后停止）；SD 族 native cancel 即时性待真机专项 |
| **P2**（夜间耐久） | 持久化恢复（幽灵队列治理）+ nightTask 恒 busy 收口 + K90 夜间模拟（息屏充电）+ 门禁五关 + 文档闭环（IMAGEGEN_UI_SPEC 增补/星图勘误/MASTER_LOG §N） | ⏳ 水合恢复已实机验证；夜间 30+ 抽息屏模拟待专项 |

## 十三、实现接缝清单（2026-08-27 已逐项取证，P0 开工零侦察）

| # | 接缝 | 取证结论 | P0 状态 |
|---|---|---|---|
| S1 | runGenTask 下沉 | handleGenerate（ImageGenScreen.tsx:866-985）的调用面已确认：beginTask 字段组 / generateDreamLiteEntry(w,h,steps,p) / generate(p,{steps,cfg,width,height,seed,negativePrompt,loraPath,loraMultiplier,modelLabel}) / finishTask-failTaskWithReport。下沉=快照→同参数调用，组件层仅保留校验/引导/动效 | ✅ 全量闭环：store 侧任务化一体（含 hooks.onTaskStarted 保持动效时序）；组件层 handleGenerate 已复用 runGenTask（~100 行 → ~40 行，校验/引导/动效保留） |
| S2 | 模型加载下沉 | loadEntry（ImageGenScreen.tsx:322-360）含 resolveCompanions+loadModel/loadDreamLiteEntry+推错链路——整段搬入 store，组件层仅按 manifest 行内按钮触发 | ✅ 快照自包含方案落地（mainPath/伴侣/backend/loraPath 入队时组件层解析），runGenTask 内 ensureModelLoaded；行内按钮 loadEntry 维持现状（推错链路与 UI 反馈耦合，收口收益低风险高，留测试治理窗后专项） |
| S3 | 队列表 | schema.ts + migrations.ts toVersion:3（createTable）见 §九；model 类 + collection getter 对齐 ImageGenTask 模式 | ✅ schema v10 + migrations toVersion 10 + ImageGenQueue model + ImageGenQueueRepository（upsert/remove/clearAll）
| S4 | native cancel | ImageGenModule.kt 新增 ReactMethod cancelTxt2img()（模式同 getGpuRenderer:200-230）+ ImageGenJNI.cpp 调 sd_cancel_generation(g_ctx, SD_CANCEL_ALL)——JNI 层 g_ctx 已在 nativeLoadModel 持有，零新增状态 | ✅ P1 已完成：JNI nativeCancelTxt2img（不持 g_mutex——nativeTxt2img 全程持锁跑长任务，持锁会阻塞停止）+ Kotlin cancelTxt2img ReactMethod + store.stopQueue 接入（fire-and-forget，core 见 stopRequested 不计抽数） |
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