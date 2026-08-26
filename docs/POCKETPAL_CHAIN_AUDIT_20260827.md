---
doc_id: POCKETPAL_CHAIN_AUDIT_20260827
module: root
type: audit
status: active
version: "1.0"
created: "2026-08-27"
updated: "2026-08-27"
relates: [POCKETPAL_CHAIN_AUDIT_20260826, DEV_BACKLOG, POCKETPAL_STARMAP_DOMAINS, DRC_COMPASS_REGISTRY, PERF_BENCHMARK_DESIGN]
---

<!-- D-FORMAT:v3 -->

# 链路闭环复查 · 全面方案报告（2026-08-27）

> 排查时间：2026-08-27 | 方法：守卫指南针（COMPASS v1.3）路由 → 星图域切分 → 洋葱三层对账（文档承诺→代码实证→账目状态）→ 6D 诊断
> 范围：DEV_BACKLOG 全量逐项 + .qoder/specs 17 份 task 文档 + MASTER_LOG §85-97 + 0826 审计方案（B52/B53/文档治理）执行结果复核 + git 工作区
> 基线：0826 审计（B44-B51 全闭环 + 欠账 8 项复核 + B52/B53 方案）

---

## 一、总账结论（一页纸）

**链路健康度：主体干净，无「大件没做」；剩余问题全部是「收尾不净 + 账目标态滞后」两类，且集中在文档生命周期管理，不涉及核心链路。**

- **门禁**：tsc 0 错 ✅；三闸（guard:worktree/lint/prettier）审计时全绿 ✅；**jest 不稳** ⚠️——两次全量跑失败套件名不一致（首跑 2 failed → 复跑 FAIL MemoryAdapter/WebSearchResultBubble/PerfMotion + worker 泄漏警告），flaky 或并行窗口在途同源。
- **0826 审计方案执行复核**：B52 部分执行（朗读菜单 ✅ 已挂载 ChatView；图标 11→5 处 ⚠️ 未清零；Alert 23→2 处 ⚠️ ModelsScreen 未迁）；B53 收口（krea2 catalog 断言提交在案）；文档治理（P1#1 已销账 ✅ / 星图勘误已补正文 ✅ / 双证制入 SOP ✅ §95）。
- **三类账目问题（本报告新增发现）**：
  1. **DEV_BACKLOG P5 目标态滞后**：P5 标题/项 18-21 仍标「v0.7 待真机验证」，实际 DESIGN 已 v1.2（B40-B43 演进）+ 跑分面板真机复验已于 08-25 销账（已完成批次表有），且 DESIGN v1.2 是「生图页三修」后的终态——账目互相矛盾。
  2. **task 文档状态滞后群（.qoder/specs）**：多份规划文档无状态字段或标 open/待执行，但代码已实证落地（9a1b 分发双缺口 manifest 含 vae 清单 / 632 双下载源 downloadSources HF+ModelScope 在码 / b37 文档标「待执行」但 §74 已闭环提交 0f8ac57 / 6d0f 标 active 但 injectGenMeta 在码 L28/L488 等）——「文档写完即弃」，与 0826 认定的「文档先行无保真校验」同根。
  3. **元数据小瑕疵**：星图 frontmatter updated 仍 08-23（正文勘误已补）；MASTER_LOG §90/§92 章节编号重复两次。

- **并行窗口互扰仍在**：工作区 100 文件未提交在途（styles 批量 spacing token 化 + imageGenStore 9 行 + invariants 33 行）——「提交≠落袋」机制缺口未根治，与 08-25 219 文件事件、08-26 CI 红同根因。

---

## 二、守卫指南针走查（COMPASS v1.3）

| 锚点 | 状态 | 说明 |
|---|---|---|
| CP-APP-012（基准套件判定） | ✅ 已登记 | benchmarkStore 域 |
| CP-APP-013（上下文满/预算决策） | ✅ 已登记 + §96 配套落码 | resolvePssSafeBudget/策展表 v2 实证 |
| ST-APP 状态机 | ✅ 无漂移 | 未发现 stateCompass 缺口 |

## 三、规划→落地核对表（差集实证）

### 3.1 DEV_BACKLOG（截至 08-26，代码实证）

| 批次项 | 文档标注 | 代码实证 | 结论 |
|---|---|---|---|
| P1#1 跑分面板真机 | ✅ 已销（08-26 复查） | 08-25 K90 截图在案 | ✅ 闭环 |
| P4#10 搜索精简 | ✅ | — | ✅ 闭环 |
| P4#11 TTS hf-mirror | ✅ 落码 | constants.ts 9 处 hf-mirror | ✅ **真落码** |
| P4#12-16、18 | ✅ 落码 | 写作 tab/孤儿删除/朗读等 | ✅ 闭环（见 B52 遗留） |
| P4#17 肥件拆分+单槽v2 | 择期 | ModelStore 3313 行未拆 | ⏳ 架构债（审计已知） |
| P5#18-21 跑分四阶段 | ⚠️ **v0.7 待真机** | DESIGN 已 **v1.2**；真机复验 08-25 已过；B40-B43 演进提交在案 | ❌ **账目标态滞后**（见 §六 B60b） |
| P6#19/20 上下文极限化 | ✅ 落码（待真机） | §96 实证 resolvePssSafeBudget/策展表 v2/CURATED_TABLE_VERSION | ✅ 落码，待真机 |
| P1#2 记忆三闸 G5 | 待真机 | 代码 aaca505 在案 | ⏳ 真机待办（合理） |
| P1#3 电池豁免真机 | 待真机 | 代码 46af4e5 在案 | ⏳ 真机待办（合理） |
| P2#4-7 视频四前置 | 观望 | 触发条件未满足 | ⏳ 明确不算欠账 |

### 3.2 .qoder/specs 17 份 task 文档（抽查实证）

| 文档 | 标注 | 代码实证 | 结论 |
|---|---|---|---|
| task-b37 TTS 三引擎 | 「待执行」 | §74 已闭环，0f8ac57 在案 | ❌ 文档滞后 |
| task-9a1b 分发双缺口 | 无状态字段 | manifest 含 sd35_vae 清单 + 双源 | ❌ 文档滞后 |
| task-632 模型清单双源 | 无状态字段 | downloadSources.ts HF+ModelScope | ❌ 文档滞后 |
| task-6d0f 元数据路径 | status: active | imageGenStore injectGenMeta L28/L488 在码 | ❌ 文档滞后 |
| task-6ad/9f4e/3g4/b28/b27 | 无状态字段 | 对应批次均已提交闭环（§74/79 等） | ❌ 文档滞后 |
| task-9f3d/7c3e/a7e2 | ✅ 已闭环 | 复核一致 | ✅ |
| task-f1d/b75（新） | 无状态字段 | 需并行窗口补充（B 线 Mali/图标回撤域） | ⚠️ 未核 |

**共性**：17 份中约 9 份无闭环状态标注——**task 文档生命周期无收口动作**。

### 3.3 0826 审计方案（B52/B53/文档治理）执行复核

| 承诺 | 现状 | 结论 |
|---|---|---|
| B52① 图标 11 处清零 | 裸数字残留 5 处（ChatInput1/EnhancedSearchBar2/PalGen1 + 误匹配1） | ⚠️ 未完 |
| B52② 长按朗读菜单 | ChatView.tsx L774 已挂载 | ✅ |
| B52③ 确认型 Alert 挂批 | 残留 2 处（ModelsScreen L148/L226）；ConfirmDialog 组件已建 | ⚠️ 未完 |
| B53 存量红测试 | krea2 catalog 断言同步已提交（302dac9）；jest 仍不稳 | ⚠️ 部分 |
| 文档治理（INDEX/P1#1/星图勘误） | P1#1 ✅ 销；星图正文勘误 ✅（frontmatter 滞后）；INDEX 待核 | ⚠️ 部分 |
| 双证制入 SOP | guard 巡检哨兵入库（80f65b4 §95）+ git rm 留痕纪律 | ✅ |

---

## 四、6D 洋葱诊断

| D | 层 | 发现 |
|---|---|---|
| D1 表象 | 用户可见 | 确认弹窗 2 处系统 Alert 混用；图标 5 处尺寸不统一（低频可见） |
| D2 数据 | 工程可见 | jest flaky（两次失败套件不一致 + worker 泄漏警告）；task 文档滞后群；P5 账目矛盾 |
| D3 机制 | 流程 | 双证制已上（代码证据+测试绿）但**未覆盖 .qoder/specs 文档状态翻新**；并行窗口无锁（100 文件在途）；「写文档即弃」惯性 |
| D4 根因 | 治理 | 文档生命周期缺「终态收口」动作（翻 ✅ + 引用 commit）；账目更新依赖人工且无巡检 |
| D5 行动 | 方案 | §六 B60 批次（收尾清零 + 文档治理 + 测试稳化） |
| D6 验证 | 判据 | grep 零残留 / task 文档 17 份全量翻状态 / jest 稳定全绿 / P5 账目修正 / 工作区并行窗口收口 |

## 五、兜底/补丁存量排查（锋利维度）

**perf 域自检（本窗口 08-23 落地物）**：
- perfRecorder catch 静默 / fire-and-forget / readSession 重算 = **设计契约**（N/A 降级 + 断点容错），非兜底 ✅
- PerfPanel N/A(-1) → `--` = 规范明文的诚实降级，非补丁 ✅
- 设计文档已演进 v1.2（B40-B43），无「临时绕过」残留 ✅

**存量兜底债**：
- 确认型 Alert 2 处（ModelsScreen）——UI 范式混用（B52 尾账）
- 图标裸数字 5 处——token 化尾账（B52 尾账）
- jest worker 泄漏（teardown 不净）——测试基建小债
- 并行窗口在途 100 文件未提交——过程债（非代码债）

**利器与机制的区分**：Mali tiled GEMM 变体（§86-90）/ klein gpuPolicy 门控（§91）= 机制性适配，非兜底 ✅

## 六、行动方案（迭代批次，锋利优先，全部门禁 SOP 闭环）

| 批次 | 动作 | 工作量 | 价值 | 性质 |
|---|---|---|---|---|
| **B60a 收尾清零** | 图标 5 处 → iconSize token（ChatInput/EnhancedSearchBar/PalGenerationSettingsSheet）；ModelsScreen 2 处 Alert.alert → ConfirmDialog | 小 | 清掉全部 UI 范式尾账 | 落码 |
| **B60b 文档治理** | ① .qoder/specs 17 份 task 文档状态批量翻新（✅+闭环 commit 引用 / ⏳+缘由）；② DEV_BACKLOG P5 修正（v1.2 + 真机已过 + 项 18-21 翻 ✅）；③ 星图 frontmatter updated；④ MASTER_LOG §90/§92 重复编号修正；⑤ INDEX 补审计文档登记复核 | 小 | 账实一致，堵「文档滞后群」 | 文档 |
| **B60c 测试稳化** | PerfMotion/WebSearchResultBubble/MemoryAdapter 三套 flaky 定性：teardown 泄漏排查（--detectOpenHandles）+ 定因（时序/在途）；modelCatalog 断言终态复核 | 小-中 | CI jest 稳定全绿，门禁判据可信 | 落码 |
| **B61 并行对齐** | 待并行窗口收口后：100 文件在途提交 + 全量复跑 + 账实抽查 | 待定 | 「提交≠落袋」收口 | 治理 |
| **B62 架构（择期）** | P4#17：ModelStore 3313 行首拆（modelCatalog/persistence/context）+ 单槽 v2（engineMutex 生图⇔管家联动） | 大 | 架构锋利化 | 架构 |
| **机制（随 B60b）** | task 文档「终态收口」纳入窗口闭环 SOP：文档交付 3 件套 = 代码证据 + 测试绿 + 状态翻新（含 commit） | 极小 | 防文档滞后群再犯 | 治理 |

## 七、防误伤边界（明确不动）

- **并行窗口在途 100 文件**（styles token 化 / imageGenStore 9 行 / invariants 33 行）——不碰不定性，待 B61
- **视频玩具 P2#4-7 / P3#8-9**——观望态，触发条件未满足（与 08-23/25/26 审计一致）
- **B40-B43 跑分卡域**——PERF_BENCHMARK_DESIGN 分册治理（既有约定），不在 Gap Ledger
- **P1#2/#3 真机项**——合理待办（需真机条件），非缺口

## 八、正向确认（承诺度抽核）

- 0826 审计 8 项欠账：TTS 镜像/写作 tab/孤儿删除/文档销账 ✅ 真落码复核通过；朗读 ✅；图标/Alert 半程（B60a 收尾）；架构 2 件明确定位（B62 择期）
- P6 上下文极限化账实 100% 对齐（§96 文档与代码逐条对应）
- COMPASS v1.3 无漂移；星图勘误机制在运转（正文已补 08-25/26 条目）
- perf 域（P5）代码健康：设计 v1.2 终态 + 真机复验已过，仅账目标态滞后

---

## 九、执行状态回写（2026-08-27 窗口）

> 本报告为纯复查产出（走门禁/指南针/星图，无代码改动）。执行批次 B60a/B60b/B60c 建议新窗口按序执行；B61 待并行窗口收口；B62 择期。回写登记 MASTER_LOG §98。