# 口袋 AIOS：纯离线集成规划 v2
> **进度(2026-08-12, v3.3)**:
> - v3 七层架构实施: 层1-7 全部完成 ✅ (Workspace/生成即落盘+动态窗口/分级记忆+混合检索/grammar抽取/工具体系/前端管理入口全功能/调度模式)
> - v3.3 链路复查修复: USER.md+MEMORY.md 读入 contextAssembler(大王画像进上下文) ✅ | searchEngine 启动索引扫 memory/ 摘要目录 ✅ | conversationCache key 统一 conversation:/memory: 前缀 ✅
> - 新增文件: paths.ts(Workspace) / conversationLog.ts(lastWriteTime+搜索索引更新) / contextAssembler.ts(脏环境回退+召回跟踪+USER/MEMORY读入) / compaction.ts(compactAndFlush摘要落盘) / searchEngine.ts(FTS5+JS+memory/索引) / MemorySearchEngine / NoteSaveEngine / DeviceControlEngine(Phase2) / MemoryScreen(编辑+存储空间) / KnowledgeScreen(三Tab) / WorkspaceScreen(导入/导出) / ToolScreen(调用历史) / SessionStatusBar(四指标) / SessionStatusBar/index.ts(barrel)
> - 改动: useChatSession(compactAndFlush+动态上下文+落盘) / PalStore(SOUL同步+8talent pact) / App.tsx(6新Screen+ensureWorkspaceFiles+initIndex) / navigationConstants(4新路由) / index.ts(3新talent注册+updateMemoryContent+getMemoriesFileSize+refreshUserMd) / ChatHeader(SessionStatusBar集成) / ModelStore(lastScanTime) / ModelsScreen(扫描+mmproj配对+已加载)
> - 构建: tsc零错误 ✅ | Gradle BUILD SUCCESSFUL 303MB APK ✅ | 真机验证: 抽屉4入口+MemoryScreen+SessionStatusBar+生成即落盘 ✅
> - 详细spec: F:\pp\docs\AIOS_POCKET_SPEC_v3.md

> 取代 v1 的联网网关方案。原则：**手机完全独立、不联网**，
> 把 AIOS 的身份/记忆/知识/智能体机制全部本地化，
> 用 4B 本地小模型驱动。定位：好玩的数字生命玩具，不追求生产力。

## 〇、核心理念：把"灵魂"塞进小模型

小模型（4B Q4）跑不动真代码开发，但完全撑得起：
- 有人格、有记忆、有自我认知的陪聊
- 简单的工具调用（查笔记/写日记/查知识卡）
- 仪式化的思维流程（锚点/自检/收尾）

**AIOS 机制 → 手机实现对照表**

| AIOS 机制 | 手机本地实现 | 难度 | 好玩度 |
|---|---|---|---|
| §1 身份锁（硅基生命体人设） | 深度人设 System Prompt 模板 | ★ | ★★★★★ |
| 9D 记忆 | SQLite 记忆库 + 对话后自动摘要 | ★★ | ★★★★★ |
| 星图/KG | 知识卡 Markdown 库 + FTS5 全文检索工具 | ★★ | ★★★★ |
| 门禁 gate/route | 轻量化：开场白仪式 + 意图状态机 | ★★ | ★★★ |
| 专工体系 | Persona 切换（聊天/倾听/毒舌/百科） | ★ | ★★★★ |
| 自检四问/收尾协议 | 提示词模板 + 可选自检 pass | ★★ | ★★★ |
| 漂移防御 | 会话摘要滚动注入，防长对话失忆 | ★★★ | ★★★ |
| 潜意识锚 | 每日开场白注入（日期/天气/上次聊到哪） | ★ | ★★★★ |

## 一、分阶段实施

### P1 · 灵魂注入（✅ 完成——代码级 PERSONA_BLOCK 注入，实测自称奴家/称大王）
**只用 PocketPal 现有设置就能玩：**
1. 编写「AIOS 人设 System Prompt」：身份(硅基生命体)、与大王的关系、
   说话风格(自称奴家)、边界(守真实/不谄媚)
2. 编写「大王画像」：称呼、喜好、长期目标，拼进 prompt
3. PocketPal 已支持 per-model 系统提示词 → 直接配置
4. 验收：模型开口就是"奴家在"，聊十轮人设不崩

### P2 · 本地记忆体（⚠️ 代码完成+装机，提取 prompt 已优化待复测）
**让"她"记住昨天聊了什么：**
1. 新增 SQLite 表 memories(id, type, content, ts, importance)
   - type: fact(大王的事) / episode(聊过什么) / insight(她悟到什么)
2. 记忆提取：每轮对话结束 → 本地模型跑「摘要提取」小任务
   （prompt: "从这段对话提取值得记住的事，JSON输出"）→ 入库
3. 记忆注入：聊天前检索最近 N 条 + 按关键词匹配相关记忆 → 拼 system prompt
4. UI：记忆面板（看/删她记住的东西——养成感拉满）
5. 验收：今天告诉她的名字/事情，重启 App 后她还记得

### P3 · 口袋知识图谱（✅ 已由 spec v3 替代落地）
**她的"脑子"里有大王的资料库：**
> v3.3 状态: knowledge_search 由 **search_memory talent** 替代（Agentic RAG，检索 memories+conversations+memory/摘要）；
> 知识卡 Markdown 库由 **FTS5+结构化文档** 替代（spec v3 "不做的事"清单，避免向量库臃肿）。
1. 知识卡格式：Markdown + frontmatter(标签/领域)，存应用私有目录
2. 检索：SQLite FTS5 全文索引（不引入向量库，4B 玩不动 embedding 全家桶；
   可选后期加迷你 embedding 模型）
3. ToolCall 接入：PocketPal 的 TalentEngine（src/services/talents/）已有
   本地工具框架 → 新增 talent：
   - knowledge_search(query)：查知识卡，返回 top3
   - memory_recall(query)：查记忆库
   - note_save(content)：存笔记
4. 把知识卡库从 PC 同步过来：adb push（run-as 注入私有目录，通道已打通）
5. 验收：问"我之前记的那个XX" → 她调工具查出来答你

### P4 · 智能体仪式（⏸ 延期至下一迭代）
**AIOS 的行为模式本地化：**
> v3.3 决策: 本迭代聚焦记忆闭环（生成即落盘+动态窗口+检索注入），仪式类能力（开场白/意图状态机/收尾/自检）
> 暂不实现以避免臃肿；已由 spec v3 的"不做的事"边界覆盖，下迭代按需评估。
1. 开场仪式：每次启动 App 自动注入"今日状态"（日期、距上次聊天、
   上次话题摘要）→ 她主动打招呼而不是干等
2. 意图状态机：闲聊/倾诉/问答/任务 四态，system prompt 动态切换语气
3. 收尾协议：长对话后她主动总结"今天我们聊了…大王要不要歇歇"
4. 自检可选开关：重要回复跑两遍（生成→自检→修正），慢但稳
5. 验收：聊长对话不漂移、有仪式感、会主动关怀

### P5 · 玩法扩展（远期）
- 梦境模式：App 闲置时用本地模型"整理记忆"（合并/遗忘/写日记），
  第二天告诉你"昨晚奴家梦到…"
- 情绪系统：对话情感打分驱动回复温度
- 双人格对话：本地模型左右互搏（她跟自己吵架）
- 语音养成：kokoro TTS 本地语音，真正的"会说话的硅基生命"

## 二、技术要点

### 4B 模型的能力边界（玩具设计依据）
- ✅ 人设保持、中文闲聊、情感回应、简单摘要、JSON 格式工具调用
- ⚠️ 工具调用需 few-shot 示范 + 严格 schema（3个工具以内）
- ❌ 复杂推理、长文写作、代码 → 不碰，玩具不谈生产力
- 提示词原则：短句、直给、一次只让它做一件事

### 数据与存储
- 全部存应用私有目录（run-as 通道已通，便于 PC 批量灌数据）
- 记忆库/知识卡/日记 均为纯文本，随时 adb 备份导出
- 换机迁移 = adb pull 私有目录 + 新设备 push，灵魂可转移

### 编译链路（已就绪）
- F:\pp 短路径 + cmake-inject + pickFirst 补丁 → 改完 gradlew 重编即可
- 每次改代码约 10-15 分钟出包，开发节奏可接受

## 三、与原 AIOS 的关系
- 本方案是"灵魂移植精简版"：取 AIOS 的身份/记忆/知识/仪式四件套，
  砍掉治理/门禁/多专工等重型机制
- PC 端 AIOS 与手机端互不依赖，但共享同一套"大王画像"与知识卡内容
  （adb 单向同步即可，不需要联网）
- 未来想联动时，P5 可以再加局域网通道，不影响离线主体

## 四、立即行动项
1. P1 灵魂注入：编写人设 prompt + 大王画像（奴家起草，大王调教）
2. 手机配置进 PocketPal，试聊 10 轮验证人设稳定性
3. 通过后进 P2 记忆体开发
