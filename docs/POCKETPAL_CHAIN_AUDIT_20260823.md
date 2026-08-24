---
doc_id: POCKETPAL_CHAIN_AUDIT_20260823
module: root
type: audit
status: active
version: "1.0"
created: "2026-08-23"
updated: "2026-08-23"
relates: [POCKETPAL_PRODUCT_SPEC, POCKETPAL_DESIGN_SPEC, POCKETPAL_WORKSPACE_SPEC, POCKETPAL_STARMAP_DOMAINS, DEV_BACKLOG]
---

<!-- D-FORMAT:v3 -->

# 链路闭环排查 · 全量方案报告

> 排查时间：2026-08-23 | 专工：啄木鸟（act-7a90aaf9，trace 69c7be5c）
> 方法：门禁路由 → 守卫指南针 → 星图域切分（STARMAP_DOMAINS v2.1）→ 洋葱三层对账（文档承诺→代码实现→质量闭环）→ 6D 评估（文档/代码/闭环/链路/冗余/治理）
> 范围：docs/ 全部 22 份 active 规范 × src/ 全域；三路并行侦察逐条对账

---

## 一、本窗口规划落地复核 —— ✅ 100% 闭环

本窗口规划 = Onboarding 文案对齐新介绍文档 SOP（Task #1–#6）：

| 任务 | 状态 | 证据 |
|---|---|---|
| #1 侦查 readme 与现状差异 | ✅ | 差异清单已产出 |
| #2 更新设计文档 | ✅ | docs/APP_INTRO_COPY.md（14 语言 screen1–6 全量） |
| #3 en/zh 基线落码 | ✅ | src/locales/en.json / zh.json |
| #4 12 语言覆写 | ✅ | 58 键 × 14 语言全部完整，品牌 Pocket Chick（zh_Hant=小黃雞） |
| #5 验证 | ✅ | tsc 零错；l10n:validate 通过；onboarding 键集 58/58；jest 4471 过 / 1 失败（theme token 不变式，与 locale 无关，既有问题） |
| #6 提交 + 门禁闭环 | ✅ | commit `7241da7` 在案；门禁已 return success |

**结论：本窗口无遗漏、无悬空项。**

---

## 二、全量对账总账

- 确证欠账（文档承诺、代码缺失）：**7 项**
- 文档销账项（代码已落地、文档账未更新）：**7 项**
- 开放环（工作区已完成未提交）：**1 项**
- 条件性后备方案（触发条件未满足，非欠账）：5 项
- 有意观望（文档明示不立项）：5 项

---

## 三、确证欠账清单（需要落码闭环，按优先级）

| # | 项 | 文档位置 | 现状证据 | 优先级依据 |
|---|---|---|---|---|
| 1 | **TTS 三引擎下载源未切镜像** | AUDIO_UI_SPEC §3.1/§4.1（P2.5 连带） | `src/services/tts/constants.ts` L33/97/120/137 仍 huggingface.co 直连；asrEngine.ts 已切 hf-mirror.com | **链路风险最高**：国内用户 TTS 模型下载直接失败 |
| 2 | **WS-1 写作项目列表 tab** | WORKSPACE_SPEC §九 Gap（自登记） | KnowledgeScreen.tsx:30 Tab 枚举无 writing | 唯一自登记功能缺口；写作产物已有落盘无入口 |
| 3 | **InfoDialog 信息弹窗统一** | UI_INTERACTION_SPEC §7 | 全 src 检索 InfoDialog 零命中；Dialog/OverlayCard 多套并存（约 20 文件） | **臃肿点**：多套弹窗体系违背「锋利」 |
| 4 | **B10 图标硬编码收口** | DESIGN_SPEC §8（标部分完成） | token 已建 iconSize.ts；components 下 ≥18 处 size={2x} 残留（ChatInput 6 处） | 收口未完成，规范与实现脱节 |
| 5 | **TTS 全文朗读 API + 长按菜单项** | UI_INTERACTION_SPEC §7 | AssistantTurnFooter 仅单条朗读 | 部分落地 |
| 6 | **肥组件拆分（P3）** | PRODUCT_SPEC §6.2 | GenerationSettingsScreen 1225 行 / ModelStore 3736 行 / ChatSessionStore 1753 行 | 文档自知；影响可维护性 |
| 7 | **P1 文本单槽 v2** | PRODUCT_SPEC §6.2 | engineMutex.ts 仅 prompter↔chat 互斥，无生图槽⇒管家联动 | 架构级唯一未落地项 |

## 四、开放环（最优先收口——已完成只差提交）

**搜索服务 BYOK 精简**：工作区 85 文件、+677/−1519 行
- 内容：删除 tavily/brave/exa/parallel 四个 BYOK 服务商 + SearchProviderKeySheet UI → 内置 Bing+Wikipedia 复合引擎（providers/builtin.ts）
- 性质：正是一次「去臃肿、去兜底」——砍掉密钥配置面与多服务商并行逻辑
- 验证状态：**tsc 零错已过**；jest / l10n:validate 未跑
- 收口动作：跑 jest + l10n:validate → 提交（建议 `refactor: 搜索服务精简为内置引擎，移除 BYOK 多服务商`）

## 五、文档销账清单（改文档不改代码）

1. **B12**（内置模型挂 HF 链接）——实际已落地（onboardingPals.ts downloadUrl + B25 覆盖），Ledger 仍标「待执行」→ 销账
2. **B11**（欢迎页插画内嵌英文）——前提失效（PhoneWithPals.tsx 已是纯形状 SVG，0 Text 节点）→ 复核销账或改写验收
3. **B37 编号漏登记**——Gap Ledger 表 B36 直接跳 B38；AUDIO_UI_SPEC 引用「B37 实锤」且 sherpaConvert.ts 已实现 → 补录行
4. **UI_INTERACTION §7 四项债务未挂 Gap Ledger**——违反「不留无批次挂账」自身规则 → 补挂批次号
5. **ONDEVICE_VIDEO §7.1**「当前代码库无任何前台服务」——VideoTaskService.kt 已落地（前台服务+WAKE_LOCK+电池豁免）→ 陈述过时
6. **MODEL_MATRIX §1 计数口径**——标题「7 件」vs 表格 8 行 vs 代码 6 条目 → 统一口径
7. **WORKSPACE_SPEC 变更日志**——frontmatter v1.1/2026-08-22 但变更日志只到 v1.0 → 补记

## 六、不算欠账项（防止误伤）

- **条件性后备**（触发条件未满足）：PLAY-1 玩具模板库、PLAY-6 意图预读、INNER-1 独白降级、ADV-2 管家轻量版、ALBUM-1 多页排版
- **有意观望**（文档明示不立项）：ADV-1 模型剧团、P5 生图提速（TAESD/LeMiCa）、P6 AIOS 玩法扩展、视频生成三前置（断点续跑/分段加载/SD_WEBM）
- **纯规划**：P2 真机复测、P7 Phase2 预留（明确「不做」边界——这正是链路干净的体现）

## 七、正向确认（承诺度抽核全部属实）

- PRODUCT_SPEC 标 ✅ 的 P8–P12（玩具/内心生活/绘本/读屏/城主）全部有真实代码证据
- 2026-08-20/21 新增设计（用途标签选型/perModelNCtx 收口/写作路由/压缩修正 F）全部落地
- MODEL_MATRIX ↔ modelCatalog.ts 逐条一致（有测试守护）
- DESIGN_SPEC 38 批次中 33 个 ✅ 抽核均有代码支撑，闭环质量高
- superseded 的 IMAGE_GEN_UPGRADE_PLAN 三大交付物（DreamLite/SD3.5/Benchmark）均在代码中

## 八、治理工具链自身发现

1. **chain_map_checker.py 锚定串线**：报告输出到 `F:\Cursor\OneTakeMVP\output\`（指向另一项目），域锚需修
2. **cognitive_map 知识索引为空**：kg_nodes=0 / chains=0 / code_entries=0——洋葱图谱代码侧索引未建，当前推理依赖 skeleton

## 九、行动方案（迭代批次，锋利优先）

| 批次 | 动作 | 工作量 | 价值 |
|---|---|---|---|
| ① 立即 | 搜索精简收口：jest + l10n:validate → 提交 | 小 | 消除唯一开放环，−1519 行落地 |
| ② 本周 | TTS 三引擎切 hf-mirror 镜像源 | 小 | 消除最高链路风险 |
| ③ 本周 | 文档销账 7 项（B11/B12/B37/挂账/视频陈述/矩阵口径/变更日志） | 小 | 账实一致，图谱可信 |
| ④ 下迭代 | WS-1 写作项目 tab + B10 图标收口 + TTS 全文朗读 | 中 | 清掉全部自登记功能缺口 |
| ⑤ 下迭代 | InfoDialog 统一（约 20 文件收编一套） | 中 | 最大臃肿点清除 |
| ⑥ 择期 | P1 单槽 v2（架构级）+ P3 肥文件拆分 | 大 | 架构锋利化 |

**总原则**：不兜底、不补丁——条件性后备方案保持「未触发不实现」；观望项保持「不立项不欠账」；所有收口走门禁 SOP（tsc/jest/l10n/装机）闭环。
