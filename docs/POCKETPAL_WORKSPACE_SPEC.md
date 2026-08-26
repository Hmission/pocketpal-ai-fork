---
doc_id: POCKETPAL_WORKSPACE_SPEC
module: root
type: spec
status: active
version: "1.1"
created: "2026-08-21"
updated: "2026-08-22"
relates: [POCKETPAL_PRODUCT_SPEC, POCKETPAL_ADVENTURE_SPEC, POCKETPAL_PLAY_SPEC, POCKETPAL_CONTEXT_COMPACTION_SPEC, WORKSPACE_TOOL_ERROR_FEEDBACK_SPEC]
---

<!-- D-FORMAT:v3 -->

# 产物工作区 SPEC（WORKSPACE_SPEC）

**状态**：active | **版本**：1.1 | **更新**：2026-08-22

> **定位**：对话是过程，产物是文档。写作/冒险/玩具三模式的产物统一落盘
> `workspace/<domain>/`，上下文只放框架指针，正文按需读段；压缩只动过程，
> 永不碰产物；新会话凭索引恢复工作区。
> **配套**：docStore 分段读取原语 + 每域 index.json 索引 + taskRouter/恢复链路。

## 一、定位与边界

- **负责**：
  - **目录协议**：workspace/writing|adventure|toys 三域目录结构（分文件 = 天然分段）
  - **索引协议**：每域 `index.json` 条目清单，写后置顶（恢复入口）
  - **分段读取原语**：`## ` 分节只读目标段（readSection），正文永不预注入上下文
  - **恢复链路**：新会话「继续写 X」→ 索引命中 → 框架文档注入 → 续写
- **不负责**（明确排除）：
  - **不做业务逻辑**：JS 层零业务逻辑，文档由模型经 TalentEngine 工具维护（状态即规则）
  - **不迁移 toyChest**：玩具单层索引不迁移，仅兼容读（listToyProjects 只读视图）
  - **不引入 KV cache 量化默认化**：独立优化杠杆，与本次范围解耦
- **上下游**：taskRouter（续写识别）→ useChatScheduler（恢复/选型）→ contextAssembler（框架注入）→ TalentEngine（WritingDocEngine/AdventureStateEngine/toyChest）

## 二、核心原则 / 公理

1. **对话是过程，产物是文档**：写作正文/冒险剧情/玩具成品是产物，落盘文件；压缩只压缩对话过程，永不触碰产物文件。
2. **上下文只放框架指针**：大纲/人设/世界设定等框架文档内联注入（2-4K token）；正文/剧情按需 read 单节，不预注入。
3. **文件即存档**：每次写入落盘共享存储，重启/换会话不丢。
4. **显式失败不静默**：超 20KB 显式拒绝（模型开新章）；节不存在返回 NO_SECTION；索引未命中静默放行（防误伤）。
5. **三模式同构**：写作/冒险/玩具共享目录、索引、分段读取三协议；域语义留在各 TalentEngine。

## 三、目录协议

```
workspace/
├── writing/<project>/          # 写作域（2026-08-21 新增）
│   ├── 大纲.md                 # 框架文档：主线/章节规划
│   ├── 人设.md                 # 框架文档：角色设定
│   └── 正文-<章节>.md          # 正文分章文件（单文件 ≤20KB，超限开新章）
├── adventure/<campaign>/       # 冒险域（现有 state.json + 2026-08-21 多文档）
│   ├── 世界设定.md
│   ├── 角色卡.md
│   ├── 剧情.md
│   └── state.json              # HP/位置/背包（schema 自由，不校验）
├── toys/                       # 玩具域（既有，不迁移）
│   ├── index.json              # [{id, title, createdAt}]
│   └── <id>.html               # 成品原稿（纯透传）
└── writing|adventure/index.json # 索引协议（见下）
```

- 项目名 sanitize（`sanitizeProjectName`）：去 `\ / : * ? " < > |` 与控制字符，空白折叠；空名返回 null。
- 文档名即文件名（`<doc>.md`），写入前同样 sanitize，防任意路径写盘。

## 四、索引协议

`workspace/<domain>/index.json` = `[{name, path, updatedAt, progress}]`：

| 字段 | 含义 |
|---|---|
| name | 项目名（目录名，已 sanitize） |
| path | 相对域根路径（name 即目录名） |
| updatedAt | 最近一次写入时间（写后 touchProject 刷新置顶） |
| progress | 进度一句话（模型自报，如「已完成 3 章 / 2.1 万字」） |

原语（src/services/workspace/index.ts）：

- `ensureProject(domain, name)`：建目录 + 索引条目一次到位（幂等）
- `touchProject(domain, name, progress?)`：写后置顶（与 toyChest「title 即身份」同语义）
- `listProjects(domain)`：项目清单（存储即最新在前）
- `findProject(domain, name)`：按名查（恢复判定）

> toys 域无本协议条目：toyChest 单层索引由 read_html 工具与玩具箱 UI 直读（消费端即协议，不建第二份视图）。

## 五、分段读取原语

src/services/workspace/docStore.ts，文档以 `## 标题` 分节（markdown）：

- `readSection(path, sectionName)`：按节名只读目标段（精确匹配），返回 `{section, content}`；节不存在返回 null（显式）
- `listSections(path)`：节清单（模型据此决定读哪段）
- `appendSection(path, sectionName, content)`：节尾追加；节不存在新建
- `updateSection(path, sectionName, content)`：整节替换（框架文档修订）；空内容删除节
- `readWholeDoc(path)`：全文读取（框架文档/短文档用）
- **单文件上限 20KB**（`MAX_DOC_BYTES`）：写后超限显式拒绝 `DOC_TOO_LARGE`（不改文件）——模型开新章 = 天然分段
- 写路径统一 parseDoc 重建（节标题行 + 正文规范化），无正则替换边界缺陷

## 六、恢复协议

新会话「继续写《X》」→ 跨会话恢复：

1. **识别**（src/store/taskRouter.ts）：WRITE_RE 增续写意图（继续写/续写/接着写/写下去）+ 项目名提取；快捷前缀「新建写作项目：/写作项目：」显式引导（剥离后为空短路 chitchat 防误伤）；聊天输入快捷行「写作项目」pencil 图标钮与玩具/冒险同构（P5 快捷行第五钮，一键置前缀 + 引导文案）
2. **解析**（src/services/workspace/recovery.ts）：`parseProjectName`（《X》优先，无书名号剥意图词）；`isWritingResumeIntent` 前置判定（非续写/建项意图 → null）
3. **恢复**：`resolveWritingRecovery` → `findProject('writing', name)` 索引命中 → 读框架文档（大纲 + 人设 + progress）组装 frameworkText → `setPendingWorkspaceContext`（单次消费）
4. **注入**：useChatSession 首轮 `consumePendingWorkspaceContext()?.frameworkText` → contextAssembler `workspaceContext` 参数 → systemPrompt 追加框架块（含 read_section 工具提示）
5. **未命中**：静默放行（无恢复上下文，普通会话开始），不兜底不报错

## 七、域差异表

| 维度 | writing（写作） | adventure（冒险） | toys（玩具） |
|---|---|---|---|
| 入口 | WritingDocEngine（`writing_doc`，九动作） | AdventureStateEngine（`adventure_state`，五动作） | toyChest（saveToy/readToy）+ read_html |
| 框架文档 | 大纲.md + 人设.md（恢复时内联注入） | 世界设定.md + 角色卡.md（引导按需 read 自取，不预注入） | —（成品即产物） |
| 正文/剧情 | 正文-<章节>.md（按需 read_section） | 剧情.md（按需 read） | <id>.html（read_html 读回迭代） |
| 状态 | progress 一句话进索引 | state.json（schema 自由） | index.json（滚动淘汰 50 件） |
| 恢复 | 索引命中 → 框架注入 → 续写 | 既有「继续冒险」恢复（state.json） | read_html 按 title 读回 |
| 索引 | workspace/writing/index.json | workspace/adventure/index.json | workspace/toys/index.json（兼容读） |
| DRC 事件 | `workspace.writing_doc` | `workspace.adventure_state` | —（既有 toyChest 链路） |

## 八、健康指标

| 指标 | 阈值 / 说明 |
|------|-------------|
| tsc | 零错误 |
| jest | workspace 三协议（index/docStore/recovery）+ WritingDocEngine 九动作 + AdventureStateEngine read/append + taskRouter 续写用例全绿 |
| 真机验收 | ①「新建写作项目」→ 正文落盘 → 对话压缩 20+ 条 → 正文文件完好；②新会话「继续写小说 X」→ 索引恢复 → 框架注入 → 续写追加成功；③冒险多文档读取/玩具迭代回归 |

## 九、Gap Ledger

| Gap ID | 现象 | 补齐路径 | 状态 |
|--------|------|----------|------|
| WS-1 | KnowledgeScreen 尚无「写作项目」列表 tab | 复用玩具箱 tab 模式（模型经工具维护，UI 只读列表） | **2026-08-25 落码**（DEV_BACKLOG P4#13；KnowledgeScreen Tab 枚举补 writing + 列表页，复用 `StaggeredListItem` + `FlatList`，数据源 `listProjects('writing')`） |

## 变更日志

| 日期 | 版本 | 变更 |
|------|------|------|
| 2026-08-21 | 1.0 | 首发：目录/索引/分段读取/恢复四协议 + WritingDocEngine + AdventureStateEngine 多文档 + 压缩产物指针 |
| 2026-08-22 | 1.1 | 新增 WORKSPACE_TOOL_ERROR_FEEDBACK_SPEC 关联（错误回传三字段 + 重试纪律 + guide 契约）；版本号同步（正文版本行此前与 frontmatter 不一致，勘误对齐） |
## 关联文档

- [写作/冒险/玩具产品定位](./POCKETPAL_PRODUCT_SPEC.md)（positioning，§4.11）
- [TRPG 城主玩法](./POCKETPAL_ADVENTURE_SPEC.md)（spec，P12）
- [玩具工坊玩法](./POCKETPAL_PLAY_SPEC.md)（spec，P8）
- [上下文压缩 SPEC](./POCKETPAL_CONTEXT_COMPACTION_SPEC.md)（spec，B19.1）
- [工具错误回传协议](./workspace/WORKSPACE_TOOL_ERROR_FEEDBACK_SPEC.md)（spec，2026-08-22：错误回传三字段 + 重试纪律 + guide 契约）
