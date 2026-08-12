# AIOS 寄宿型口袋智能体 · 完整迭代 Spec v3

## 认知重构（方法论根基）

AIOS 是寄宿型智能体，不做 IDE，寄宿在 Cursor/Qoder 等宿主上。**PocketPal 是新的手机端宿主**。寄宿者注入人设(SOUL)+工具(Tools)+记忆(Memory)+规范(AGENTS)+调度，宿主提供对话流/引擎/模型管理。

**三大核心理念**：
1. **生成即落盘**：每轮回复立即落盘 `conversations/日期.md`，不依赖窗口上下文保留历史
2. **动态知识库管理窗口**：窗口不再是"装载历史的地方"，而是"动态召回的舞台"。每轮推理前从知识库召回相关片段组装精简上下文，上下文永不耗光，会话永不锁死
3. **前后端对齐**：后端有能力，前端有入口有管理

## 产品锋利原则（守 RULE.md 内核）

- R1 北极星唯一：手机端有限资源下提供锋利、可进化、跨会话连续的寄宿智能体
- R3 根因优先：抽取不稳定根因=没用 grammar 约束；上下文丢失根因=依赖窗口而非落盘；从根因层闭环
- R5 状态主权：所有状态落盘共享目录，明确读写方与脏环境兼容
- 不补丁不兜底：每处从架构层改干净

---

## 架构总览（七层 + 前端管理）

```
前端管理层: MemoryPanel | KnowledgePanel | WorkspacePanel | ToolPanel | SessionStatus | ModelsScreen增强
    ↕ 前后端对齐
寄宿核心层:
  层1 Workspace文件系统 (SOUL/USER/AGENTS/MEMORY + conversations/ + memory/)
  层2 生成即落盘+动态知识库管理窗口 (核心创新)
  层3 分级记忆+混合检索 (工作/短期/长期 + FTS5+关键词)
  层4 稳定抽取 (grammar约束JSON)
  层5 工具体系 (信息获取+memory_search+device_control[Phase2])
  层6 调度模式 (本地串行角色化 / API并行sub_agent)
```

---

## 层 1：Workspace 文件系统（寄宿者注入的落盘形态）

**目标**：从"Pal.systemPrompt 硬编码"升级为"Workspace 文件系统可迁移"，人设/记忆/规范解耦落盘。

**目录结构**:
```
/sdcard/Documents/AIOS/workspace/
  SOUL.md          # 女妖人设全文（从 PalStore.initializeAiosPal 同步写出）
  USER.md          # 大王画像（由记忆系统从 fact 类记忆聚合，定期刷新）
  AGENTS.md        # 会话行为规范（会话开始读 SOUL/USER/MEMORY 的指令）
  MEMORY.md        # 长期记忆主形态（结构化 markdown，按主题组织）
  memory/YYYY-MM-DD.md  # 每日对话摘要落盘（OpenClaw pre-compaction flush 范式）
  conversations/YYYY-MM-DD.md  # 每轮对话逐轮落盘（生成即落盘）
```

**改动**:
- `F:\pp\src\utils\paths.ts`：新增 `AIOS_WORKSPACE_DIR`、`AIOS_CONVERSATIONS_DIR`、文件常量 + `ensureWorkspaceFiles()` 首次初始化
- `F:\pp\src\store\PalStore.ts` `initializeAiosPal()`：创建 Pal 时同步把 systemPrompt 写出为 SOUL.md
- `F:\pp\App.tsx` 启动 `ensureAiosDirs()` 扩展调用 `ensureWorkspaceFiles()`

---

## 层 2：生成即落盘 + 动态知识库管理窗口（核心创新）

**目标**：彻底颠覆"滑窗保留历史"模式。每轮落盘，下轮动态召回组装精简窗口。上下文永不耗光，会话永不锁死。

### 2.1 生成即落盘
**文件**: 新建 `F:\pp\src\services\aiosMemory\conversationLog.ts`

- 每轮 assistant 回复完成后（`useChatSession.ts` 第 471 行 `extractAndSaveMemories` 调用点旁），立即调用 `appendConversation(userText, assistantText)`
- `appendConversation`：追加写入 `conversations/YYYY-MM-DD.md`，格式：
  ```
  ## HH:MM:SS
  大王: {userText}
  女妖: {assistantText}
  ```
- 异步 fire-and-forget，不阻塞 UI
- 这取代了依赖窗口上下文保留历史——历史全在落盘文件里

### 2.2 动态上下文组装
**文件**: `F:\pp\src\hooks\useChatSession.ts`（改造推理前的上下文组装）+ 新建 `F:\pp\src\services\aiosMemory\contextAssembler.ts`

每轮推理前（第 148 行 `buildMemoryFragment` 调用点改造）：
1. **system 层**：SOUL.md（人设） + AGENTS.md（规范） + 注入记忆 `buildMemoryFragment(currentUserText)`
2. **召回层**：`searchMemory(currentUserText)` 从 conversations/ + memory/ 召回 top-N 相关历史片段（FTS5 全文检索 + 关键词匹配混合）
3. **即时层**：最近 1-2 轮原文（保证即时上下文连贯，不靠召回）
4. **当前层**：当前 user 输入

- 窗口只装这四层精简内容，永不耗光
- `contextAssembler.assemble(currentUserText, recentMessages)` 返回组装后的 messages 数组
- 召回片段数自适应：上下文剩余空间大→多召回，剩余少→少召回

### 2.3 状态主权（R5）
- 写入方：`appendConversation`（对话日志）、`extractAndSaveMemories`（条目）、`compactAndFlush`（摘要文档）
- 读取方：`contextAssembler`（组装）、`searchMemory`（检索）
- 脏环境兼容：conversations/ 空时回退到原 useChatSession 全量上下文模式

---

## 层 3：分级记忆 + 混合检索

**目标**：从"200 条 JSON + 2-4 字滑窗关键词"升级为"三层分级 + 混合检索"。

**三层结构**:
1. **工作记忆**（in-context）：`contextAssembler` 组装的召回片段 + 最近 1-2 轮
2. **短期记忆**（会话内）：`conversations/日期.md` 逐轮落盘 + 阈值触发的增量摘要落 `memory/日期.md`
3. **长期记忆**（落盘可检索）：`MEMORY.md` 结构化文档 + `aios_memories.json` 条目 + `conversations/` 全量对话日志

**混合检索**（`searchMemory(query)`）:
- 保留 `generateKeywords` + `scoreMatch` 作为快速路径（零依赖）
- 新增 FTS5 全文检索（SQLite 内置，零新依赖）：对 conversations/ 和 memory/ 建 FTS5 索引，语义召回
- 合并去重 top-N，返回片段数组
- Agentic RAG：4B 模型可通过 `search_memory` talent 主动调用检索（层 5）

**文件**: `F:\pp\src\services\aiosMemory\index.ts`（保留存储层，重写检索层）+ 新建 `F:\pp\src\services\aiosMemory\searchEngine.ts`（FTS5 索引+检索）

**FTS5 索引构建**:
- 启动时扫描 conversations/ + memory/，建/更新 FTS5 虚拟表
- 每轮落盘后增量更新索引（插入新片段）
- 索引存 `AIOS_DB_DIR/search.db`

---

## 层 4：稳定记忆抽取（根因修复 · R3）

**目标**：根治小模型产 JSON 不稳定。根因=没用 grammar 约束。

**文件**: `F:\pp\src\services\aiosMemory\index.ts` - `extractAndSaveMemories`

- `engine.completion` 调用新增 `response_format: {type: 'json_schema', strict: true, schema: AiosMemorySchema}`
- AiosMemorySchema: `{type:'object', properties:{memories:{type:'array', items:{type:'object', properties:{type:{enum:['fact','episode','insight']}, content:{type:'string'}}, required:['type','content']}}}, required:['memories']}`
- 删除 `output.match(/\{[\s\S]*\}/)` 正则解析，改为 `JSON.parse(output)`（grammar 保证合法）
- 保留 `temperature: 0` + "禁止照抄提示词" prompt（双保险）

**验证标准**: 连续 10 次抽取，JSON 解析成功率 100%

---

## 层 5：工具体系升级

**5.1 memory_search 工具**（Agentic RAG）
**文件**: 新建 `F:\pp\src\services\talents\memorySearchTalent.ts`
- talent: `{name: 'search_memory', description: '检索本地记忆/对话日志/知识库', execute(query)→searchMemory(query)}`
- AIOS Pal 的 `pact.talents` 新增 `search_memory`
- 4B 通过 function calling 主动检索

**5.2 note_save 工具**（让模型主动写笔记）
**文件**: 新建 `F:\pp\src\services\talents\noteSaveTalent.ts`
- talent: `{name: 'note_save', description: '保存笔记到知识库', execute(content)→addMemory('insight', content)}`
- AIOS Pal 的 `pact.talents` 新增 `note_save`

**5.3 device_control 工具**（Phase 2 预留）
- 基于 AccessibilityService：读屏/模拟点击/输入文本
- 本 spec 只做架构预留（talent 接口定义），不实现完整自动化
- 需用户手动开启无障碍权限

---

## 层 6：前端管理入口（大幅升级 · 前后端对齐）

**目标**：后端有能力，前端有入口。参考 workbuddy"每日落盘日志可浏览"理念。

### 6.1 MemoryPanel（记忆管理）
**文件**: 新建 `F:\pp\src\screens\MemoryScreen\MemoryScreen.tsx`
- 列表展示所有记忆（按时间倒序，type 分组着色）
- 单条删除、全量清空、编辑内容
- 显示记忆条数 + 存储路径 + 占用空间
- 从 SettingsScreen 或抽屉导航进入

### 6.2 KnowledgePanel（对话日志/知识库浏览）
**文件**: 新建 `F:\pp\src\screens\KnowledgeScreen\KnowledgeScreen.tsx`
- 按日期浏览 `conversations/` 对话日志（每日一页）
- 全文搜索（FTS5）跨日志检索
- 浏览 `memory/` 摘要文档
- 浏览 `MEMORY.md` 长期记忆

### 6.3 WorkspacePanel（人设/规范文件浏览编辑）
**文件**: 新建 `F:\pp\src\screens\WorkspaceScreen\WorkspaceScreen.tsx`
- 浏览/编辑 SOUL.md（人设）、USER.md（画像）、AGENTS.md（规范）
- 导入/导出（灵魂迁移：adb pull/push workspace/）

### 6.4 ToolPanel（工具配置）
**文件**: 新建 `F:\pp\src\screens\ToolScreen\ToolScreen.tsx`
- 列出已注册 talent，启用/禁用开关
- 查看工具调用历史（AgentRunner 步骤记录）
- AIOS Pal 的 pact.talents 可视化编辑

### 6.5 SessionStatusIndicator（会话状态指示器）
**文件**: 改造 `F:\pp\src\components\ChatHeader\` 或新增组件
- 上下文使用率（已用 token / n_ctx）
- 落盘状态（conversations/ 最后写入时间）
- 召回片段预览（当前轮注入了哪些历史片段，可展开查看）
- 模型加载状态 + 内存占用

### 6.6 ModelsScreen 增强
**文件**: `F:\pp\src\screens\ModelsScreen\ModelsScreen.tsx`
- 扫描状态指示（scanLocalModels 最后扫描时间）
- mmproj 配对状态可视化（已配对/未配对）
- 内存占用预估 + 快速加载/卸载
- 模型能力标签（工具调用/视觉/代码）

### 6.7 抽屉导航更新
**文件**: `F:\pp\src\components\DrawerContent\` 或对应导航配置
- 新增入口：记忆 | 知识库 | Workspace | 工具
- 保持锋利：不堆砌，按使用频率排序

---

## 层 7：调度模式

**本地模型**（单 context 单例，内存约束）:
- 不派真 sub agent（多实例必 OOM）
- 单 agent + 串行角色化 completion：侦察/抽取/摘要/主答，复用同一 LlamaContext，换 system prompt
- `appendConversation` + `contextAssembler` 都是串行（不阻塞主推理）

**接 API**（RemoteSessionBinding，无状态并发）:
- 可派真 sub agent：每 Pal 一 session 并发
- 架构预留，本 spec 不强制实现

---

## 不做的事（产品锋利边界）

- 不上完整 KG（过重，用 FTS5+结构化文档替代）
- 不上完整向量库引擎（sqlite-vec 为 Phase 2 评估，本 spec 用 FTS5 零新依赖）
- 不做多 Pal 切换 UI（一个女妖 Pal 锋利到底）
- 不做插件系统
- 不做 device_control 完整实现（Phase 2 预留）
- 不做数据迁移工具（新装即可）

---

## 验证矩阵

| 维度 | 测试方法 | 成功标准 |
|------|---------|---------|
| 生成即落盘 | 对话 5 轮 → 检查 conversations/日期.md | 每轮 user+assistant 完整落盘 |
| 动态窗口组装 | 对话 20 轮（超 n_ctx）→ 检查上下文不报 full | 会话不锁死，早期内容靠召回注入 |
| 混合检索 | 注入种子记忆 → 问相关问题 | FTS5+关键词混合召回优于纯关键词 |
| 稳定抽取 | 连续 10 轮抽取 | JSON 解析成功率 100%（grammar） |
| memory_search 工具 | 问"我之前说过什么" → 模型调用 search_memory | 工具链路打通 |
| 前端管理入口 | 抽屉进入各面板 | 记忆/知识库/workspace/工具面板可用 |
| 跨会话连续 | 告诉模型"我叫大王" → 新建会话 → 问 | 回答"大王" |
| 人设稳定 | 10 轮对话 | 自称奴家、称大王 |
| 数据独立化 | 卸载 → 重装 → 启动 | 模型/workspace/conversations/memories 全恢复 |

---

## 依赖关系与执行顺序

```
层1(Workspace) → 层2(生成即落盘+动态窗口) → 层3(分级记忆+FTS5) → 层4(grammar抽取) → 层5(工具) → 层6(前端) → 验证 → 构建
层1是地基; 层2是核心创新(解决会话锁死); 层3增强检索; 层4根治抽取; 层5扩展能力; 层6前后端对齐。
层7(调度)贯穿层2-5。
```

一次性按层 1→6 顺序做完，每层做完立即用验证矩阵对应项验证。

---

## 规划文档迭代落盘

执行阶段第一件事：把本 spec 落盘到 `F:\pp\docs\AIOS_POCKET_SPEC_v3.md`，作为 PocketPal 二开的唯一权威规划文档。后续每轮迭代追加更新记录，按要点依次迭代直到收敛。同步更新 `lab/pocketpal-ai/docs/AIOS_INTEGRATION_PLAN.md` 进度徽章。

---

## 构建部署

1. 源码改动在 F:\pp 完成层 1-6
2. `cd F:\pp && npx tsc --noEmit` 零类型错误
3. `cd F:\pp\android && .\gradlew.bat assembleProdDebug`
4. `adb install -r app-prod-debug.apk`（applicationIdSuffix .dg 并存）
5. `adb shell appops set com.pocketpalai.dg MANAGE_EXTERNAL_STORAGE allow`
6. 真机按验证矩阵逐项测试
---

## v3.4 迭代记录（2026-08-12 App 产品迭代：UI 四项修复）

### 修复项
1. **安卓状态栏安全区**: App.tsx Drawer.Navigator screenOptions 增加 `headerStatusBarHeight: insets.top`（useSafeAreaInsets），四个新增 AIOS 页面（Memory/Knowledge/Workspace/Tool）不再冲进状态栏。ChatScreen headerShown:false 自带 ChatHeader 不受影响。
2. **抽屉图标差异化**: SidebarContent 记忆管理→HeartIcon、知识库→GridIcon、Workspace→EditBoxIcon、工具配置→AtomIcon、Dev Tools→CodeIcon，全部复用现有图标库零新增 SVG。
3. **抽屉菜单分组重构**: 11 项平铺拆为三组——核心导航（对话/Pals/模型）· AIOS 智能体（记忆/知识库/Workspace/工具配置）· 系统（基准/设置/App信息/DevTools），分组标签+Divider，设计逻辑对齐 PalsScreen 的分层思想。
4. **聊天输入框分隔线**: ChatInput textInputArea 与 controlBar 之间插入 1px 横线（theme 色半透明），两行分栏视觉区隔。

### 验证
- [x] `npx tsc --noEmit` 零错误
- [ ] 真机验证矩阵（状态栏/抽屉/输入框，待装机）

---

## v3.3 迭代记录（2026-08-12 链路复查修复）

### 修复项
1. **USER.md 读入上下文**: contextAssembler system 层由 SOUL+AGENTS 扩展为 SOUL+USER+AGENTS+MEMORY+记忆碎片。此前 refreshUserMd 定期写 USER.md（fact 聚合）但从不读入 → 大王画像不进上下文，链路断裂。
2. **MEMORY.md 定位明确**: 作为寄宿者注入的知识文档（WorkspaceScreen 人工维护，截断 2000 字符注入 system 层），不再承担"记忆系统动态维护"职责——动态长期记忆 = aios_memories.json + memory/摘要。
3. **searchEngine 索引覆盖 memory/**: 启动时扫描 conversations/ + memory/ 双目录，key 统一 conversation:/memory: 前缀；conversationLog/compaction 调用方同步。

### 已记录偏差（不修，避免臃肿）
- **FTS5 索引路径**: spec 原文"索引存 AIOS_DB_DIR/search.db"，实现为 WatermelonDB SQLiteAdapter(dbName:'aios_search') 且运行时因 WatermelonDB 封装不可达回退纯 JS 全文检索。功能等效（手机端少量文档场景），引新原生依赖违背锋利原则 → 保留纯 JS 方案并记录。
- **AIOS_INTEGRATION_PLAN.md P4 智能体仪式**: 延期至下一迭代（开场白/意图状态机/收尾/自检），本迭代聚焦记忆闭环。
