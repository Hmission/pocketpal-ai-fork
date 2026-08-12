---
doc_id: ADR-20260812
module: lab/pocketpal-ai
type: adr
status: accepted
created: 2026-08-12
updated: 2026-08-12
author: zhuo-mu-niao
D-FORMAT: v3
---

<!-- D-FORMAT:v3 -->

# ADR-20260812: AIOS 寄宿型口袋智能体七层架构

## 状态
✅ 已采纳并实施（tsc 零错误 + Gradle BUILD SUCCESSFUL + 真机验证通过）

## 背景
PocketPal 是基于 React Native 的本地 LLM 手机端应用。需要将 AIOS 寄宿型智能体能力（人设/记忆/工具/规范/调度）移植到手机端，形成"口袋里的硅基生命体"。手机端约束：4B Q4 小模型、内存受限（可用 ~7GB）、无联网、Windows 编译链 260 字符路径限制。

三大核心理念：
1. **生成即落盘**：每轮回复立即落盘 `conversations/日期.md`，不依赖窗口上下文保留历史
2. **动态知识库管理窗口**：窗口是"动态召回的舞台"而非"装载历史的地方"，每轮推理前召回相关片段组装精简上下文，上下文永不耗光
3. **前后端对齐**：后端有能力，前端有入口有管理

## 决策

### 七层架构 + 前端管理

| 层 | 职责 | 核心文件 |
|---|---|---|
| 层1 Workspace 文件系统 | 人设/记忆/规范解耦落盘（SOUL/USER/AGENTS/MEMORY + conversations/ + memory/） | `src/utils/paths.ts` |
| 层2 生成即落盘+动态窗口 | 每轮落盘 + 四层组装（system/召回/即时/当前） | `conversationLog.ts` + `contextAssembler.ts` |
| 层3 分级记忆+混合检索 | 工作/短期/长期 + FTS5+关键词（纯 JS 回退） | `searchEngine.ts` + `index.ts` |
| 层4 稳定抽取 | grammar 约束 JSON（strict:true），删正则回退 | `index.ts` extractAndSaveMemories |
| 层5 工具体系 | search_memory + note_save + device_control(Phase2) | `MemorySearchEngine` + `NoteSaveEngine` |
| 层6 前端管理入口 | 六面板 + SessionStatusBar + 抽屉导航 | `MemoryScreen`/`KnowledgeScreen`/`WorkspaceScreen`/`ToolScreen` |
| 层7 调度模式 | 本地串行角色化（单 context 单例，不派真 sub agent） | `useChatSession.ts` |

### 前端六面板
- **MemoryScreen**：列表/删除/清空/编辑 + 存储空间显示
- **KnowledgeScreen**：三 Tab（对话日志/摘要/MEMORY.md）+ 全文搜索
- **WorkspaceScreen**：SOUL/USER/AGENTS/MEMORY 浏览编辑 + 导入/导出
- **ToolScreen**：talent 开关 + pact 可视化编辑 + 调用历史
- **SessionStatusBar**：上下文使用率 + 落盘时间 + 召回预览 + 模型状态
- **ModelsScreen 增强**：扫描时间 + mmproj 配对 + 已加载模型

### v3.3 链路复查修复（2026-08-12）
1. **USER.md 读入上下文**：contextAssembler system 层由 SOUL+AGENTS 扩展为 SOUL+USER+AGENTS+MEMORY+记忆碎片。此前 refreshUserMd 定期写 USER.md 但从不读入 → 大王画像不进上下文，链路断裂。
2. **MEMORY.md 定位明确**：作为寄宿者注入的知识文档（WorkspaceScreen 人工维护，截断 2000 字符注入），不承担记忆系统动态维护职责。
3. **searchEngine 索引覆盖 memory/**：启动扫描 conversations/ + memory/ 双目录，key 统一 `conversation:`/`memory:` 前缀。

### 不采纳的方案（产品锋利边界）
- **不上完整 KG**：过重，用 FTS5+结构化文档替代
- **不上完整向量库**：sqlite-vec 为 Phase 2 评估，本 spec 用 FTS5 零新依赖
- **不做多 Pal 切换 UI**：一个女妖 Pal 锋利到底
- **不做插件系统**
- **不做 device_control 完整实现**：Phase 2 预留
- **不做数据迁移工具**：新装即可
- **不做 P4 智能体仪式**（开场白/意图状态机/收尾/自检）：延期至下一迭代，聚焦记忆闭环

## 后果
- **正面**：会话永不锁死（动态召回替代滑窗）；跨会话连续（落盘+检索注入）；抽取稳定（grammar 约束）；前后端对齐（六面板管理）
- **负面**：FTS5 因 WatermelonDB 封装不可达，回退纯 JS 全文检索（手机端少量文档场景功能等效，引新原生依赖违背锋利原则）
- **验证**：tsc 零错误 ×2 轮 | Gradle BUILD SUCCESSFUL 303MB APK | 真机验证：抽屉4入口+MemoryScreen+SessionStatusBar+生成即落盘 conversations/2026-08-11.md

## 关键文件清单
| 文件 | 层 | 职责 |
|---|---|---|
| `src/utils/paths.ts` | 层1 | AIOS 目录常量 + ensureWorkspaceFiles |
| `src/services/aiosMemory/conversationLog.ts` | 层2 | appendConversation + lastWriteTime |
| `src/services/aiosMemory/contextAssembler.ts` | 层2 | 四层组装 + 脏环境回退 + USER/MEMORY 读入 |
| `src/services/aiosMemory/compaction.ts` | 层2 | compactAndFlush 摘要落盘 |
| `src/services/aiosMemory/searchEngine.ts` | 层3 | FTS5+JS 混合检索 + memory/ 索引 |
| `src/services/aiosMemory/index.ts` | 层3-4 | 存储层 + grammar 抽取 + refreshUserMd |
| `src/services/talents/MemorySearchEngine.ts` | 层5 | search_memory talent |
| `src/services/talents/NoteSaveEngine.ts` | 层5 | note_save talent |
| `src/screens/MemoryScreen/MemoryScreen.tsx` | 层6 | 记忆管理 |
| `src/screens/KnowledgeScreen/KnowledgeScreen.tsx` | 层6 | 知识库浏览 |
| `src/screens/WorkspaceScreen/WorkspaceScreen.tsx` | 层6 | Workspace 文件编辑 |
| `src/screens/ToolScreen/ToolScreen.tsx` | 层6 | 工具配置 |
| `src/components/SessionStatusBar/SessionStatusBar.tsx` | 层6 | 会话状态指示器 |
| `src/store/PalStore.ts` | 层1 | AIOS Pal + 8-talent pact |
| `src/store/ModelStore.ts` | 层6 | scanLocalModels + lastScanTime |
| `src/hooks/useChatSession.ts` | 层2/7 | 动态上下文 + 落盘 + compactAndFlush |

## 参考
- SSOT: [AIOS_POCKETPAL_SPEC_V3_SSOT](./AIOS_POCKETPAL_SPEC_V3_SSOT.md)
- SOP: [AIOS_POCKETPAL_BUILD_INSTALL_VERIFY_SOP](./AIOS_POCKETPAL_BUILD_INSTALL_VERIFY_SOP.md)
- 工程副本: `F:\pp`（短路径编译链）| 只读参考: `lab/pocketpal-ai/`
