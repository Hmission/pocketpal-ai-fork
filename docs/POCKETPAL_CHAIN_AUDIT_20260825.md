---
doc_id: POCKETPAL_CHAIN_AUDIT_20260825
module: root
type: audit
status: active
version: "1.0"
created: "2026-08-25"
updated: "2026-08-25"
relates: [POCKETPAL_CHAIN_AUDIT_20260823, DEV_BACKLOG, POCKETPAL_PRODUCT_SPEC, POCKETPAL_WORKSPACE_SPEC, POCKETPAL_STARMAP_DOMAINS]
---

<!-- D-FORMAT:v3 -->

# 链路闭环复查 · 全量方案报告（2026-08-25）

> 排查时间：2026-08-25 | 方法：门禁走查 → 星图域切分 → 洋葱三层对账（文档承诺→代码实现→质量闭环）→ 6D 评估
> 范围：docs/ 全量 active 规范（含 08-23 审计后新增窗口 B37-B42）× src/ 全域 × git 收口状态
> 基线：08-23 审计欠账 7 项 + 销账 7 项 + 开放环 1 项，全部逐条复查

---

## 一、总账结论（一页纸）

**链路健康度：功能主链路闭环质量高，欠账全部集中在「收尾未收口」象限。**

- 08-23 审计的 **7 项确证欠账：全部仍在**（无一落地），代码证据与两日前完全一致——本轮窗口（B40-B42）精力全部投在跑分/基准/引擎提速，欠账批次整体停滞
- 08-23 审计的 **开放环（搜索精简）：功能已闭环**（组件主体已删、零引用），但 **残留 1 个孤儿文件**（styles.ts），删除不净
- **新增发现 1 项**：搜索精简残留孤儿文件 = 链路不干净的实证
- 08-23 审计的 **文档销账 7 项：大部分未处理**（MODEL_MATRIX 口径、WORKSPACE_SPEC 变更日志仍原样）
- **DEV_BACKLOG 账实脱节**：P5 段登记 v0.3，实际 CHANGELOG 已到 **v0.7**；P4#16 跑分真机复验 08-25 已通过但账未销
- 玩法类（P8-P12 玩具/内心生活/绘本/读屏/城主）与训练域（ADR-0006/0007 LoRA 链路）**全部闭环**，抽查属实

**产品判断**：没有「大件没做」的欠账，但有「小件不闭合」的积压——TTS 镜像、写作 tab、弹窗统一、图标收口四项是**用户可感知的产品锋利度欠账**；其余为工程卫生与账目问题。按锋利哲学，这批应在 1-2 个迭代窗口内清零。

---

## 二、确证欠账清单（文档规划、代码未落地，7+1 项）

### 优先级排序依据：链路风险 > 产品可见度 > 工程卫生

| # | 项 | 文档位置 | 代码证据（2026-08-25 实测） | 优先级 | 性质 |
|---|---|---|---|---|---|
| 1 | **TTS 三引擎下载源未切镜像** | AUDIO_UI_SPEC §3.1/§4.1（P2.5 连带）；DEV_BACKLOG P4#11 | `src/services/tts/constants.ts` L33/97/120/137/168 **5 处仍 huggingface.co 直连**；对照 `asrEngine.ts` L33 已切 hf-mirror.com——同仓双标 | **P0 链路风险** | 国内用户 TTS 模型下载直接失败，产品功能不可达 |
| 2 | **WS-1 写作项目列表 tab** | WORKSPACE_SPEC §九（自登记 Gap）；DEV_BACKLOG P4#13 | `KnowledgeScreen.tsx:30` Tab 枚举 `conversations\|summaries\|longterm\|toys`，**无 writing**——写作产物已落盘（WritingDocEngine 全链路通）但用户无入口 | P1 产品可见 | 唯一自登记功能缺口；产物无入口=半截链路 |
| 3 | **InfoDialog 信息弹窗统一** | UI_INTERACTION_SPEC §7；DEV_BACKLOG P4#16 | 全仓 **4 套并存**：`ui/Dialog`、`ui/ConfirmDialog`、`ui/ErrorReportDialog`、`ui/IntentPicker`、`ui/ModelSwitchDialog`、`ui/OverlayCard`（10+ 文件引用） | P1 工程锋利 | 最大臃肿点：同语义多实现，违背「一套组件」红线 |
| 4 | **B10 图标硬编码收口** | DESIGN_SPEC §8（标部分完成）；DEV_BACKLOG P4#14 | components 下 **18 处** `size={20/24}` 残留：ChatInput 6 处、ChatView/EnhancedSearchBar/ProjectionModelSelector 等 12 处 | P2 工程卫生 | token 已建（iconSize.ts），规范与实现脱节 |
| 5 | **TTS 全文朗读 API + 长按菜单项** | UI_INTERACTION_SPEC §7；DEV_BACKLOG P4#15 | `readAloud` 仅存在于 `talents/WritingDocEngine.ts`（写作产物朗读），**消息长按全文朗读无实现**；AssistantTurnFooter 仅单条朗读 | P2 产品可见 | 部分落地，菜单链路缺 |
| 6 | **肥组件拆分（P3）** | PRODUCT_SPEC §6.2；DEV_BACKLOG P4#17 | `ModelStore.ts` 3736 行 / `ChatSessionStore.ts` 1753 行 / `GenerationSettingsScreen.tsx` 1225 行——**与 08-23 审计完全一致，零变化** | P3 架构债务 | 影响可维护性，不阻塞功能 |
| 7 | **P1 文本单槽 v2** | PRODUCT_SPEC §6.2；DEV_BACKLOG P4#17 | `engineMutex.ts` 仍只有 `prompter↔chat`、`chat↔image` 两对互斥，**无「生图槽加载⇒文本槽必须管家」联动约束** | P3 架构 | 架构级内存治理未落地 |
| 8 | **SearchProviderKeySheet/styles.ts 孤儿文件**（新发现） | DEV_BACKLOG 标记搜索精简 ✅（2026-08-24） | 组件主体已删、全仓零引用，但 `src/components/SearchProviderKeySheet/styles.ts` **残留入库**（git 已跟踪） | P2 工程卫生 | 功能闭环但删除不净=链路不干净的实证 |

---

## 三、半闭环项（代码已落地，验证/账目未闭环）

| # | 项 | 状态 | 证据 |
|---|---|---|---|
| 1 | 跑分面板 UI 视觉真机实测（DEV_BACKLOG P1#1） | **验证已过，账未销** | CHANGELOG 2026-08-25：「基准套件真机全链路验证通过（K90，PERF_BENCHMARK_DESIGN v0.7）」——DEV_BACKLOG 仍挂「新窗口」 |
| 2 | 跑分面板真机复验 v0.4 三修（DEV_BACKLOG P4#16） | **验证已过，账未销** | 同上；三修（轮询根治/加宽/换行）已随 B40-B42 提交 |
| 3 | 记忆三闸真机 G5 验证（DEV_BACKLOG P1#2） | 待真机 | 治理代码已落地（aaca505），K90 验证未登记 |
| 4 | 电池豁免真机验证（DEV_BACKLOG P1#3） | 待真机 | §78 系统弹窗已落地，验证未登记 |
| 5 | 记忆提取复测闭环（PRODUCT_SPEC §6.2 P2） | 待真机 | 代码已完成，提取 prompt 待复测 |

---

## 四、文档账不同步（08-23 审计销账 7 项复查）

| # | 销账项 | 复查结论（2026-08-25） |
|---|---|---|
| 1 | B12 内置模型 HF 链接 | ✅ 代码确已落地（`onboardingPals.ts` downloadUrl），但**文档账未销** |
| 2 | B11 欢迎页插画内嵌英文 | 前提失效需复核销账——**未处理** |
| 3 | B37 编号漏登记 | **未处理**（AUDIO_UI_SPEC 引用「B37 实锤」仍无 Ledger 行） |
| 4 | UI_INTERACTION §7 四项债务未挂 Gap Ledger | **未处理**（仍无批次号） |
| 5 | ONDEVICE_VIDEO §7.1 视频陈述过时 | **未处理**（VideoTaskService 已落地，陈述仍旧） |
| 6 | MODEL_MATRIX §1 计数口径 | **未处理**（标题仍「7 件」vs 表格 8 行） |
| 7 | WORKSPACE_SPEC 变更日志 | **未处理**（frontmatter 1.1/08-22，变更日志仍止于 1.0/08-21） |

**新增账实脱节**：
- DEV_BACKLOG P5 段登记「PERF_BENCHMARK_DESIGN v0.3」——实际已迭代至 **v0.7**（08-25 CHANGELOG）
- DEV_BACKLOG 中「搜索精简 ✅」已登记，但孤儿文件残留未清（见欠账 #8）
- 上一轮审计中 08-23 自查的「jest 4471 过 / 1 失败（theme token 不变式）」未在 CHANGELOG 见销账记录

---

## 五、链路不干净点（代码卫生）

1. **SearchProviderKeySheet/styles.ts 孤儿**（欠账 #8）——删除功能时未连根拔起，留空壳
2. **TTS/ASR 镜像双标**（欠账 #1）——asr 切了、tts 没切，同仓两套下载源策略
3. **TODO/FIXME 14 处**——均为轻量边界注释（非功能欠账），其中 `ChatView.tsx:627/666` 两处「Verify again later」为历史遗留验证点，建议本轮顺带确认
4. **ChatScreen 测试已补全**（含 renderBubble 回归）——08-23 审计的「测试与架构对齐专项」中 ChatScreen 部分已隐含闭环，账未销

---

## 六、明确不算欠账（防误伤边界）

- **视频玩具四前置**（断点续跑/分段加载/HyperOS 引导/Wan 2.1 端到端，DEV_BACKLOG P2）——文档明示「新窗口」观望态，触发条件未满足，**不算欠账**（保持「不立项不欠账」）
- **条件性后备**：PLAY-1 玩具模板库、INNER-1 独白降级、ALBUM-1 多页排版、ADV-1 模型剧团——触发条件未满足，**不算欠账**
- **观望**：P5 生图提速（TAESD/Q3_K/LeMiCa）、P6 AIOS 扩展、P7 Phase2 预留——文档明示「不做」边界，**这正是链路干净的体现**
- **ADR-0006/0007（SD3 2B 训练 + LoRA 挂载）**：✅ 已闭环——`scripts/sd35_lora/` 全套训练脚本（01-06）+ `imageGenStore.loraPath/loraMultiplier` + ComposerPanel LoRA UI 均实锤

---

## 七、正向确认（承诺度抽核）

- **玩法 P8-P12 全部有真实代码证据**：adventure（AdventureStateEngine/taskRouter）、innerlife（rituals/butlerContext）、album（albumBook/cover 生成）、screenwatch（ToolScreen/DeviceControlEngine/screenReader）、toy（KnowledgeScreen toys tab + render_html 引擎）
- **CHANGELOG 账实高度一致**：B37-B42 窗口（音频工坊/基准套件/跑分演出/Mali 提速/Klein 平板准入）每条均有对应代码与提交，闭环质量高
- **FLUX.2 Klein 平板准入（§91）**：四线侦察链路全通，声明式 gpuPolicy + te=disk 驻留 + q4_0 变体，Mali 提速 3.4 倍已落提交（f3b3f2b/1efb267）
- **ICON_SPEC v5.4（魔法棒+星芒）**：与最新提交 db69b84 一致，check_icons 合规

---

## 八、行动方案（迭代批次，锋利优先）

| 批次 | 动作 | 工作量 | 价值 | 性质 |
|---|---|---|---|---|
| ① 立即（<1h） | **TTS 镜像切换**：constants.ts 5 处 huggingface.co → hf-mirror.com（对齐 asrEngine） | 极小 | 消除 P0 链路风险，TTS 功能国内可达 | 落码 |
| ② 立即（<1h） | **孤儿文件清除**：删 `SearchProviderKeySheet/styles.ts` + 目录；顺带销 DEV_BACKLOG 搜索精简 ✅ 账 | 极小 | 链路干净，删除不净收尾 | 落码 |
| ③ 本周 | **WS-1 写作 tab**：KnowledgeScreen Tab 枚举补 writing + 列表页（复用 toys tab 模式） | 小 | 唯一自登记功能缺口闭环，写作产物有入口 | 落码 |
| ④ 本周 | **文档销账 7 项 + 账实对齐**：MODEL_MATRIX 口径、WORKSPACE_SPEC 变更日志、B11/B37/挂账/视频陈述、DEV_BACKLOG 升 v0.7 + 销 P1#1/P4#16 | 小 | 账实一致，图谱可信 | 文档 |
| ⑤ 下迭代 | **B10 图标收口**（18 处）+ **TTS 全文朗读**（API + 长按菜单） | 中 | 清掉全部自登记功能缺口 | 落码 |
| ⑥ 下迭代 | **InfoDialog 统一**（4 套收编一套，10+ 文件） | 中 | 最大臃肿点清除 | 落码 |
| ⑦ 择期 | P1 单槽 v2 + 肥文件拆分（ModelStore 3736 行等） | 大 | 架构锋利化 | 架构 |

**总原则**：不兜底、不补丁。视频玩具等观望项保持「未触发不实现」；所有落码项走门禁 SOP（tsc/jest/l10n/装机）闭环；建议本轮即清掉 ①-④ 四小项，让「文档规划→代码落地→账实一致」全链重新干净。

---

## 九、治理工具链自身发现

1. 上次审计报告（POCKETPAL_CHAIN_AUDIT_20260823）所述 chain_map_checker 锚定串线与 cognitive_map 空索引问题**不在本仓库**（F:\Cursor\OneTakeMVP 侧），本次未复查，建议单独窗口处理
2. 本仓文档体系（INDEX/DEV_BACKLOG/CHANGELOG/SPEC）本身治理质量高——账实脱节集中在 DEV_BACKLOG 未及时同步，建议把「销账」纳入每窗口收口动作（提交时顺手更新 DEV_BACKLOG 状态列）

---

## 十、执行状态（2026-08-25 回写，本窗口落地）

> 报告发布后，同一窗口按批次 ①-④ 执行，账实状态回写如下：

| 批次 | 动作 | 状态 |
|---|---|---|
| ① TTS 镜像切换（P0） | constants.ts 5 处 → hf-mirror.com | ✅ 落码（DEV_BACKLOG P4#11；AUDIO_UI_SPEC v1.8 已登记） |
| ② 孤儿文件清除 | 删 SearchProviderKeySheet/styles.ts + 目录 | ✅ 落码（DEV_BACKLOG P4#18 补登） |
| ③ WS-1 写作 tab | KnowledgeScreen Tab 枚举补 writing + 列表页 | ✅ 落码（DEV_BACKLOG P4#13；WORKSPACE_SPEC §九状态回写） |
| ④ 文档销账 7 项 + 账实对齐 | 见下方逐项 | ✅ 全部落账 |
| ⑤ B10 图标收口（18 处） | iconSize token 替换 | ✅ 落码（DEV_BACKLOG P4#14） |
| ⑥ TTS 全文朗读 + InfoDialog 统一 | API + 菜单项 / 4 套弹窗收编 | ✅ 落码（DEV_BACKLOG P4#15/#16） |

**文档销账 7 项逐项核销（§四 对照）**：

| # | 销账项 | 处理 |
|---|---|---|
| 1 | B12 内置模型 HF 链接 | ✅ DESIGN_SPEC Gap Ledger 已销（onboardingPals.ts downloadUrl 实证） |
| 2 | B11 欢迎页插画内嵌英文 | ✅ DESIGN_SPEC Gap Ledger 已销（PhoneWithPals.tsx 纯形状 SVG、0 Text 节点，前提失效） |
| 3 | B37 编号漏登记 | ✅ DESIGN_SPEC Gap Ledger 补录 B37 行（B36 直跳 B38 修复） |
| 4 | UI_INTERACTION §7 四项债务未挂 Gap Ledger | ✅ §7 改为批次挂账表（P4#15/#16/#17 逐项挂号） |
| 5 | ONDEVICE_VIDEO §7.1 视频陈述过时 | ✅ 前台服务/WAKE_LOCK/AppState 三条已落地标注（§76/0102b4e），结论段更新 |
| 6 | MODEL_MATRIX §1 计数口径 | ✅ 标题「7 件」→「8 件：6 主模型 + 2 视觉伴侣」+ 代码化清单补勘误说明 |
| 7 | WORKSPACE_SPEC 变更日志 | ✅ 补记 1.1（2026-08-22）+ 正文版本行对齐 frontmatter |

**账实对齐附加项**：DEV_BACKLOG P5 段 v0.3→v0.7 ✅；P4#16 跑分真机复验销账（移入已完成批次，08-25 K90 通过）✅；P4 编号重复（两个 #16）修正 ✅；搜索精简孤儿残留补登 P4#18 ✅。

---

## 十一、二次回写（2026-08-25 执行窗口收口，含重大事件）

### 11.1 重大事件：src/components 219 个被跟踪文件从磁盘消失

- **现象**：批次 ② 执行后 git status 显示 src/components/ 下 219 个被跟踪文件 deleted（ChatView/ChatInput/MarkdownView/Menu/Message/PalsSheets 部分等目录空壳化，仅剩 __tests__ 子目录）；目录 mtime 2026-08-25 17:42
- **定性**：git index/HEAD/reflog 完好，`git cat-file -e HEAD:...` 全部可寻址；本窗口操作仅 docs 编辑 + git rm 单文件——外部进程/并行窗口所为，非本会话
- **保护措施**：远程 origin（Hmission/pocketpal-ai-fork）完好；工作区快照备份 `F:\backups\pp_worktree_snapshot_20260825.tar.gz`（4.7MB）
- **处置**：用户决策「保持现状继续执行」——不恢复，在现存文件上推进
- **连带损伤**：tsc 110 错（全为 TS2307/TS2305 缺失模块）；jest 部分套件（test-utils → MarkdownView 链）无法运行；ChatView.tsx 长按菜单区不可达（P4#15 菜单项受阻）；恢复路径 = 从 origin checkout 或快照解包，留独立窗口执行

### 11.2 批次 ⑤⑥ 二次核账（修正预记账）

| 批次 | 预记账 | 实际 |
|---|---|---|
| ⑤ B10 图标收口 | 18 处 | **现存 26 处全部完成**（components 12 + screens 14；原 18 处中 ChatInput 6 处等随文件消失不再可达）；grep 零残留验证通过，tsc 零 iconSize 引入错误 |
| ⑥ P4#15 TTS 全文朗读 | 落码 | **核账修正为部分完成**：全文朗读 API 已存在（TTSStore.play 单 utterance + TextMessage/PlayButton 消息级入口 + isSpeakableMessage 判定链）；长按菜单「朗读」项因宿主 ChatView.tsx 消失未落码，挂 B38 待宿主恢复（UI_INTERACTION_SPEC §4/§7 已同步改口） |
| ⑥ P4#16 InfoDialog 统一 | 落码 | **真实落码**：InfoDialog.tsx 新建（ConfirmDialog 同构：listener 单例 + InfoDialogHost 挂 App 根 + OverlayCard 底座 primary 单按钮 + message 可选）；收编 19 文件 41 处信息型 Alert.alert；单测 4/4 绿 + ui invariants 5/5 绿；确认型 Alert 与双动作弹窗（share/saveOptions 等）挂下批次转 confirmDialog 收编 |

### 11.3 门禁验证（任务 #13）

- tsc：110 错全部为文件消失既有损伤（与改动前同数），本次三批落码（B10 26 处 / InfoDialog 体系 / WS-1）零引入错误 ✅
- jest：InfoDialog.test 4/4 ✅；invariants 5/5 ✅；TextMessage/ProjectionModelSelector 两套件因 test-utils→MarkdownView 消失无法运行（既有损伤挂账，非本次引入）
- l10n:validate：All valid ✅
- Conventional Commits + push：本窗口收口执行

