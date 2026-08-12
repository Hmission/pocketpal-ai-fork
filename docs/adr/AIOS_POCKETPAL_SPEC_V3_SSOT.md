---
doc_id: AIOS_POCKETPAL_SPEC_V3_SSOT
module: lab/pocketpal-ai
type: ssot
status: authoritative
created: 2026-08-11
updated: 2026-08-12
author: zhuo-mu-niao
D-FORMAT: v3
---

<!-- D-FORMAT:v3 -->

# AIOS 寄宿型口袋智能体 · Spec v3.3（SSOT 单一真理源）

> 本文档是 PocketPal AIOS 集成的**唯一权威规划文档**。代码工程副本位于 `F:\pp`（短路径编译链），只读参考副本位于 `lab/pocketpal-ai/`。任何架构决策变更先改本文档再改代码。

## 认知重构
AIOS 是寄宿型智能体，不做 IDE，寄宿在 Cursor/Qoder 等宿主上。PocketPal 是新的手机端宿主。寄宿者注入人设(SOUL)+工具(Tools)+记忆(Memory)+规范(AGENTS)+调度，宿主提供对话流/引擎/模型管理。

## 七层架构总览

```
前端管理层: MemoryPanel | KnowledgePanel | WorkspacePanel | ToolPanel | SessionStatus | ModelsScreen增强
    ↕ 前后端对齐
寄宿核心层:
  层1 Workspace文件系统 (SOUL/USER/AGENTS/MEMORY + conversations/ + memory/)
  层2 生成即落盘+动态知识库管理窗口 (核心创新)
  层3 分级记忆+混合检索 (工作/短期/长期 + FTS5+关键词)
  层4 稳定抽取 (grammar约束JSON)
  层5 工具体系 (search_memory+note_save+device_control[Phase2])
  层6 调度模式 (本地串行角色化 / API并行sub_agent)
```

## 层1：Workspace 文件系统
目录结构：`/sdcard/Documents/AIOS/workspace/`
- `SOUL.md` — 女妖人设全文（PalStore.initializeAiosPal 同步写出）
- `USER.md` — 大王画像（refreshUserMd 从 fact 类记忆聚合，contextAssembler 读入 system 层）
- `AGENTS.md` — 会话行为规范
- `MEMORY.md` — 寄宿者注入知识文档（WorkspaceScreen 人工维护，截断 2000 字符注入）
- `memory/YYYY-MM-DD.md` — 每日对话摘要（compactAndFlush 阈值触发）
- `conversations/YYYY-MM-DD.md` — 每轮对话逐轮落盘

## 层2：生成即落盘 + 动态窗口
- **生成即落盘**：appendConversation 每轮追加 conversations/日期.md（fire-and-forget）
- **四层组装**：system（SOUL+USER+AGENTS+MEMORY+记忆碎片）→ 召回（searchMemory top-N）→ 即时（最近1-2轮）→ 当前（用户输入）
- **状态主权**：脏环境兼容（conversations/ 空时回退全量上下文模式）
- **compactAndFlush**：阈值触发（20条/8000字符）→ 摘要落 memory/日期.md

## 层3：分级记忆 + 混合检索
- 三层：工作记忆（in-context 召回片段）/ 短期记忆（conversations/ + memory/摘要）/ 长期记忆（aios_memories.json + MEMORY.md）
- searchMemory：FTS5 优先 → 纯 JS 回退（generateKeywords+scoreMatch）
- 启动索引扫描 conversations/ + memory/ 双目录

## 层4：稳定抽取
- response_format: json_schema strict:true
- AiosMemorySchema: `{memories:[{type:fact|episode|insight, content:string}]}`
- 删正则 match，改 JSON.parse

## 层5：工具体系
- search_memory（Agentic RAG）→ searchMemory
- note_save → addMemory('insight')
- device_control（Phase 2 预留，AccessibilityService）

## 层6：前端管理入口
六面板 + SessionStatusBar + ModelsScreen 增强 + 抽屉导航

## 层7：调度模式
- 本地：单 context 单例，串行角色化 completion
- API：架构预留，不强制实现

## 不做的事（产品锋利边界）
- 不上完整 KG / 不上完整向量库 / 不做多 Pal 切换 / 不做插件 / 不做 device_control 完整 / 不做数据迁移 / 不做 P4 智能体仪式（延期）

## v3.3 迭代记录（2026-08-12 链路复查）
1. USER.md 读入 contextAssembler system 层（此前链路断裂）
2. MEMORY.md 定位为寄宿者注入知识文档（截断 2000 字符）
3. searchEngine 启动索引扫 memory/ 摘要目录
4. conversationCache key 统一 conversation:/memory: 前缀

## 已记录偏差
- FTS5 索引路径：spec 原文 AIOS_DB_DIR/search.db → 实现 WatermelonDB adapter（回退纯 JS，功能等效）
- P4 智能体仪式：延期至下一迭代

## 验证矩阵
| 维度 | 方法 | 状态 |
|---|---|---|
| 生成即落盘 | 对话5轮→检查 conversations/ | ✅ 设备验证 |
| 动态窗口组装 | 对话20轮→不报 full | ✅ 代码验证 |
| 混合检索 | 注入种子记忆→问相关 | ✅ 代码验证 |
| 稳定抽取 | 连续10轮 | ✅ 代码验证（grammar） |
| search_memory 工具 | 问"我之前说过什么" | ✅ 代码验证 |
| 前端管理入口 | 抽屉进入各面板 | ✅ 设备验证 |
| 跨会话连续 | 告诉名字→新建会话→问 | ✅ 代码验证 |
| 人设稳定 | 10轮对话 | ✅ 设备验证 |
| 数据独立化 | 卸载→重装→启动 | ✅ 设备验证 |

## 构建
1. `cd F:\pp && npx tsc --noEmit` — 零错误 ✅
2. `cd F:\pp\android && .\gradlew.bat assembleProdDebug` — BUILD SUCCESSFUL 303MB ✅
3. `adb install -r app-prod-debug.apk` ✅
4. `adb shell appops set com.pocketpalai MANAGE_EXTERNAL_STORAGE allow` ✅

## 参考
- ADR: [ADR-20260812-AIOS_POCKETPAL_SEVEN_LAYER_ARCH](./ADR-20260812-AIOS_POCKETPAL_SEVEN_LAYER_ARCH.md)
- SOP: [AIOS_POCKETPAL_BUILD_INSTALL_VERIFY_SOP](./AIOS_POCKETPAL_BUILD_INSTALL_VERIFY_SOP.md)
- 原始工程: `F:\pp` | 只读副本: `lab/pocketpal-ai/`
