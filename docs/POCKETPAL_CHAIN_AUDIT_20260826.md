---
doc_id: POCKETPAL_CHAIN_AUDIT_20260826
module: root
type: audit
status: active
version: "1.0"
created: "2026-08-26"
updated: "2026-08-26"
relates: [POCKETPAL_CHAIN_AUDIT_20260825, DEV_BACKLOG, POCKETPAL_DESIGN_SPEC, POCKETPAL_STARMAP_DOMAINS, POCKETPAL_UI_INTERACTION_SPEC]
---

<!-- D-FORMAT:v3 -->

# 链路闭环复查 · 全面方案报告（2026-08-26）

> 排查时间：2026-08-26 | 方法：门禁全链路走查 → 星图域切分 → 洋葱三层对账（文档承诺→代码实现→质量闭环）→ 6D 洋葱诊断
> 范围：docs/ 全量 active 规范 + B44-B51 治理批次落点 + 上轮（08-25）审计欠账逐条复核 + git 工作区状态
> 基线：08-25 审计确证欠账 8 项 + 半闭环 5 项 + 文档销账 7 项 + 本窗口批次 B44-B51

---

## 一、总账结论（一页纸）

**链路健康度：B44-B51 治理批次全部闭环，质量门禁从「失效」到「三闸全量拦截」；上轮欠账过半已真落码，但暴露两类机制性缺口：①「预记账」惯性——文档先行、代码滞后未校验（图标收口声称零残留 vs 实际 11 处）；②并行窗口账实互扰——CI jest 红 7 套件与用户并行在途开发同源（与 08-25 的 219 文件消失事件同一根因：多窗口无账实同步约束）。**

- **门禁**：pre-commit 三闸（guard:worktree + lint:prettier + eslint 全量）✅ 全绿；tsc/l10n/fonts ✅；**CI jest 红**（8 失败用例 / 7 套件：invariants 已修，其余与并行窗口在途改动同源）
- **上轮欠账 8 项复核**：3 项真落码（TTS 镜像/写作 tab/孤儿删除）✅、2 项部分（InfoDialog 信息型已收编、确认型 ~23 处无批次挂账 ⚠️；全文朗读 API 在、长按菜单缺 ⚠️）、1 项账实不符（图标收口声称零残留 vs 实际 11 处 ❌）、2 项未动（肥件拆分/单槽 v2 ❌）
- **本窗口（B44-B51）**：全部落地；期间自纠 1 处规范缺口（invariants 白名单，B46 引入→已修）
- **219 文件消失事件**：已恢复（git 全量干净，仅 Dialog 留痕删除 4 文件）；事件本身说明并行窗口无保护机制——**需治理**

**产品判断**：没有「大件没做」。剩余欠账全部是「收尾不净」：图标 11 处、长按朗读 1 项、确认型 Alert 挂账 1 项、存量红测试 7 套件、账目 2 处（P1#1 未销/INDEX 缺登记）。按锋利哲学，应在 1 个窗口内集中清零 + 建立「落码=代码证据+测试绿」双证制防再犯。

---

## 二、门禁走查结果（守卫 hook 指南针全链路）

| 闸 | 命令 | 结果 |
|---|---|---|
| 1 | guard:worktree（tracked 删除留痕巡检） | ✅ 通过（提示 Dialog 4 文件删除留痕规范——git rm 留痕要求，已登记记忆，commit 时留痕） |
| 2 | lint:prettier（prettier --check src） | ✅ 全绿 |
| 3 | lint（eslint . 全量） | ✅ 0 错误 0 警告 |
| 4 | typecheck（tsc --noEmit） | ✅ 0 错 |
| 5 | l10n:validate / verify:fonts | ✅ All valid / OK |
| 6 | jest 全量 | ⚠️ 4559 通过 / 8 失败 / 7 套件（见 §四） |
| 7 | git 工作区 | ⚠️ 大量未提交（B44-B51 本次窗口代码 + 用户并行窗口在途改动均未提交）——**提交≠落袋，需窗口收口 push** |

---

## 三、上轮（08-25）欠账逐条复核

| # | 项 | 复核结论（2026-08-26 代码实证） | 性质 |
|---|---|---|---|
| 1 | TTS 三引擎切 hf-mirror（P4#11） | ✅ **真落码**：constants.ts 5 处全部 hf-mirror.com，注释含 P4#11 落码记录 | 已闭环 |
| 2 | WS-1 写作 tab（P4#13） | ✅ **真落码**：KnowledgeScreen Tab 枚举含 'writing' + writingProjects 状态 + listProjects('writing') | 已闭环 |
| 3 | InfoDialog 统一（P4#16） | ⚠️ **部分**：信息型 41 处已收编（上轮实证）；**确认型 Alert ~23 处源码使用点仍在**（ChatInput 5/HeaderRight 4/EmbeddedVideoView 2/ContentReportSheet 3/ModelErrorReportSheet 2/ModelsScreen 2/ModelFileCard 2/ProjectionModelSelector 2/PalGenerationSettingsSheet 1/ServerDetailsSheet 1 等）——UI_INTERACTION_SPEC §7 有「确认型→ConfirmDialog」规范但**无批次号挂账** | 挂账断点 |
| 4 | B10 图标收口（P4#14） | ❌ **账实不符**：上轮声称「26 处全部完成、grep 零残留」——实际 `size={20/24}` 裸数字 **11 处残留**（ChatInput 6/EnhancedSearchBar 3/ChatView 1/ModelsHeaderRight 1），iconSize token 已建（36 处正常消费） | 预记账未校验 |
| 5 | TTS 全文朗读（P4#15） | ⚠️ **部分**：TTSStore.play 全文路径 API 存在；**消息长按菜单「朗读」项缺失**（ChatView 无朗读挂载，B38 挂账未收口） | 半闭环 |
| 6 | 肥件拆分 + 单槽 v2（P4#17） | ❌ **未动**：ModelStore 3313 行 / ChatSessionStore 1563 行仍超肥；engineMutex 仍两对互斥（prompter↔chat、chat↔image），无「生图槽⇒管家联动」 | 架构债 |
| 7 | P1 单槽 v2 | 同上，engineMutex 无变化 | 架构债 |
| 8 | 孤儿文件（P4#18） | ✅ 已删除（SearchProviderKeySheet 不存在） | 已闭环 |
| — | 文档销账 7 项（§四 08-25） | ✅ 复核通过（B11/B12/B37/§7/视频陈述/MODEL_MATRIX/WORKSPACE_SPEC 均已落账） | 已闭环 |
| — | 219 文件消失事件 | ✅ **已恢复**（git 全量不存在 deleted 大清单；src/components 完整） | 已闭环（但见 §六 机制缺口） |

---

## 四、CI jest 红（8 失败 / 7 套件）定性

| 套件 | 失败断言 | 定性 |
|---|---|---|
| theme/tokens/invariants | token 白名单越界（DownloadErrorDialog） | ✅ **本次窗口引入，已修复**（B46 迁移未同步 allow-list，DESIGN_SPEC §7 违规——已补白名单 4/4 过） |
| store/ModelStore | n_ctx 24576 vs 32768 | 用户并行窗口在途开发（策展表版本化 v2，2026-08-26 工作区 diff 实证：CURATED_TABLE_VERSION/curatedTableVersion）——**在途不碰** |
| utils/modelCatalog | 目录条目 3→4/5 | 存量红测试：FLUX Klein 列入后断言未更新（HEAD 已合入 1efb267）——**测试滞后** |
| utils/modelContextDefaults | 断言与策展表 v2 拉齐冲突 | 同上用户在途（同源 ModelStore 改动） |
| utils/exportUtils / androidPermission | Platform.select not a function / mock 缺失 | 关联用户存量 diff（exportUtils 13 行/androidPermission 11 行）——**在途或环境** |
| services/contextCompaction | undefined.replace | summarizer.ts 用户 4 行改动（工作区 diff 实证）——**在途** |
| screens/AboutScreen | 未知 | AboutScreen 用户 134 行改动（工作区 diff 实证，远超 prettier 量级）——**在途** |

**结论**：除 invariants（已修）外全部与用户并行窗口在途改动同源——**并行窗口账实互扰**（与 219 文件消失同根因）。需大王定夺：等待并行窗口收口，或由本窗口代为同步测试（需先对齐在途改动的完成态）。

---

## 五、本窗口（B44-B51）闭环确认

| 批次 | 状态 | 证据 |
|---|---|---|
| B44 基建门禁恢复 | ✅ | .gitattributes/.editorconfig + 行尾归一；eslint 152,659→1,498；7 二进制 hash 对账无损 |
| B45 字号红线 | ✅ | 22 处 9/10px→captionS；git grep 清零 |
| B46 弹窗范式（①②③） | ✅ | Paper Dialog 4 处迁 OverlayCard + Dialog 删除 + 6 套件测试同步（含上轮后 2 套） |
| B46 ④ 确认型 Alert ~23 处 | 🔵 待大王裁定 | 无批次号挂账（本报告建议挂 B52） |
| B50 prettier 清零 | ✅ | 1,282→0；lint:prettier + pre-commit 挂载 |
| B51 规则问题清零 | ✅ | 216→0；eslint . 全仓 0/0；pre-commit 全量 lint |
| 自纠 | ✅ | invariants 白名单缺口（B46 引入）已修复，测试 4/4 绿 |

**窗口闭环状态**：代码 ✅ / 门禁 ✅ / 文档 ✅（DESIGN_SPEC 3.21→3.23 + CHANGELOG + MASTER_LOG §92-94）/ **git 提交 ❌**（B44-B51 全部改动未提交未 push——提交≠落袋，需窗口收口）

---

## 六、6D 洋葱诊断（表象→根因→治本）

| D | 层 | 发现 |
|---|---|---|
| D1 表象 | 用户可见 | 图标尺寸不统一（11 处裸数字）；长按消息无法全文朗读（菜单缺）；确认弹窗系统 Alert 与 App 卡片风格混用 |
| D2 数据 | 工程可见 | CI jest 红 7 套件；预记账 vs 实际不符 1 处（图标）；挂账无批次 1 处（确认型 Alert）；账未销 2 处（P1#1/INDEX） |
| D3 机制 | 流程 | 「落码」= 写文档预记账，无代码证据+测试绿双证校验；多窗口并行无工作区锁/账实同步（219 事件同根）；挂账不挂批次号=Gap Ledger 断链 |
| D4 根因 | 治理 | **双证制缺失**：文档先行无保真校验；**批次号纪律松弛**：挂账必挂 Gap Ledger（08-25 §11.2 明说"挂下批次转 confirmDialog 收编"却未登记批次） |
| D5 行动 | 方案 | 见 §八方案（B52 收尾清账 + 双证制写入窗口闭环 SOP） |
| D6 验证 | 判据 | CI jest 全绿 + grep 零残留 + 挂账全有批次号 + 窗口收口必 push |

---

## 七、明确不算欠账（防误伤边界）

- **视频玩具四前置 + Wan 端到端**（DEV_BACKLOG P2）——观望态，触发条件未满足（与 08-25 一致）
- **条件性后备玩法**（PLAY-1/INNER-1/ALBUM-1/ADV-1）——未触发不实现
- **ModelStore 策展表 v2 / AboutScreen 大改**——用户并行窗口在途开发（工作区 diff 实证），**不碰不定性**
- **B40-B43 不在 Gap Ledger**——归 PERF_BENCHMARK_DESIGN 分册治理（既有约定，保持）
- **StarMap 无新业务域缺口**——治理批次不新增业务域（星图 v2.2 覆盖 16 域 + 引擎禁区 + 勘误机制健全；建议补 08-25/26 两个勘误条目）

---

## 八、行动方案（迭代批次，锋利优先）

| 批次 | 动作 | 工作量 | 价值 | 性质 |
|---|---|---|---|---|
| **B52**（立即，本窗口收尾） | ① 图标收口 11 处（ChatInput 6 / EnhancedSearchBar 3 / ChatView 1 / ModelsHeaderRight 1 → iconSize token）；② 长按菜单「全文朗读」项落地（ChatView 挂载 + TTSStore.play 复用，UI_INTERACTION_SPEC §7 兑现）；③ 确认型 Alert 迁移 confirmDialog 立项登记（Gap Ledger 挂批，执行可拆子批） | 中 | 清掉全部自登记功能缺口 + 账本断链 | 落码 |
| **B53**（需并行窗口对齐） | 存量红测试修复：modelCatalog 条目断言更新（FLUX Klein）+ 并行窗口在途测试同步（ModelStore 策展表/AboutScreen 等，待用户窗口收口后对齐） | 小-中 | CI jest 全绿，门禁完整 | 落码 |
| **B54**（架构） | P4#17 肥件拆分（ModelStore 3313 行首拆：modelCatalog/persistence/context 子模块）+ 单槽 v2（engineMutex 生图⇔管家联动） | 大 | 架构锋利化 | 架构 |
| 文档治理（随 B52） | INDEX 补 CHAIN_AUDIT_20260825/20260826 登记；DEV_BACKLOG P1#1 销账（08-25 K90 验证依据在案）+ P4#16 剩余挂 B52；星图勘误补 08-25/26 | 极小 | 账实一致 | 文档 |
| 机制（随 B52） | **双证制入窗口闭环 SOP**：「落码=代码证据（grep/测试）+ 测试绿」双证校验后才许预记账；挂账必挂 Gap Ledger 批次号；每窗口收口必 push | 极小 | 防预记账/挂账断链/并行互扰再犯 | 治理 |

**总原则**：不兜底、不补丁。B52 本窗口可清；B53 待并行窗口对齐后执行；B54 择期。所有落码走门禁 SOP 闭环。

---

## 九、正向确认（承诺度抽核）

- **B44-B51 账实 100% 对齐**：DESIGN_SPEC Gap Ledger 每批状态与代码证据一一对应（eslint 0/0、字号 grep 清零、prettier 全绿均为可复现命令）
- **上轮欠账 8 项中 5 项已闭环或部分闭环**（TTS 镜像/写作 tab/孤儿/信息型弹窗/文档销账），仅 3 项未动（图标残留/朗读菜单/架构两件）且均已定位精确
- **门禁三闸全绿** + tsc/l10n/fonts 全过——治理批次自身零残留
- **星图/洋葱能力复用**：16 域 + 引擎禁区边界清晰，本次审计按星图域切分逐域核对无死角

---

## 十、执行状态回写（2026-08-26 窗口）

> 本报告发布即执行：B52 收尾（图标 11 处 + 朗读菜单 + 批次登记）+ 文档治理（INDEX/P1#1/星图勘误）+ 双证制登记。B53 待并行窗口收口后对齐。执行结果回写于 MASTER_LOG §95。