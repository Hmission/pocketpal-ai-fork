---
doc_id: DOC_GOVERNANCE_SPEC
module: root
type: spec
status: active
version: "1.0"
created: "2026-08-15"
updated: "2026-08-15"
relates: [DOC_MANAGEMENT, CURSOR_DOC_USAGE, INDEX, POCKETPAL_DESIGN_SPEC]
---

<!-- D-FORMAT:v3 -->

<!-- 文档治理：本文件是跨模块文档治理总纲。更新时：1) 同步 DOC_MANAGEMENT 与 CURSOR_DOC_USAGE 的入口说明；2) 若调整治理入口展示，需同步 INDEX.md 的头部生成逻辑；3) 若新增治理层级或生命周期规则，需检查各模块 README/INDEX 是否仍匹配。-->

# 文档治理总规范

**状态**：active | **版本**：1.0 | **更新**：2026-08-15

> **定位**：这是全仓库“文档治理”领域的唯一总纲，用于指导各模块如何建立入口、分层、索引、生命周期与历史收敛规则。
>
> **适用范围**：凡是进行模块文档梳理、README/INDEX 重构、SSOT 收敛、planning 压缩、历史文档降级、跨模块文档树治理时，必须先读本文档。
>
> **体系来源**：本规范适配自 OneTakeMVP 仓库文档治理体系（DOC_GOVERNANCE_SPEC v1.1 / DOC_MANAGEMENT v1.2），按小黄鸡（Pocket Chick）仓库结构裁剪。

## 一、治理目标

1. 建立稳定入口，避免 AI 和开发者从旧文档、海量平铺文档或一次性报告起步。
2. 建立树状目录与网状 `relates` 共存的知识结构，做到高内聚、低耦合、可导航。
3. 压缩主视野，只让当前权威文档进入第一阅读链。
4. 保留历史证据，但禁止历史文档污染现行决策。

## 二、治理对象与职责分层

| 文档 | 角色 |
| --- | --- |
| `docs/DOC_GOVERNANCE_SPEC.md` | 文档治理总纲，定义治理原则与方法 |
| `docs/DOC_MANAGEMENT.md` | 文档管理机制，定义 frontmatter、路径、登记、同步 |
| `docs/CURSOR_DOC_USAGE.md` | AI/开发者执行手册，定义如何读取、定位、修改 |
| `docs/INDEX.md` | 全仓权威导航，提供显要入口与模块分发 |
| `docs/<module>/README.md` | 模块入口页，承担模块级阅读顺序与文档分流 |

## 三、治理铁律

1. **入口先于内容治理**
   - 先确定“第一读”是谁，再治理细节文档。
   - 若入口混乱，禁止直接开始大规模合并或降级。

2. **总纲唯一，分册分治**
   - 一个治理域只能有一篇总纲。
   - 总纲只管原则、边界、分层、冲突处理；细则下沉到模块 README 或分册规范。

3. **树状结构优先，网状关联补充**
   - 目录树负责“从哪里开始读”。
   - `relates` 负责“还应该看什么”。
   - 禁止只靠全文搜索或随机命中文档完成治理。

4. **现行文档与历史文档硬隔离**
   - 现行决策入口只允许 `active` 的权威总纲、分册规范、模块 README、索引。
   - `superseded` / `archived` 只能保留背景与证据价值，不得再承担第一读职责。

5. **规划会收敛，历史要降级**
   - `planning`、`summary`、`status`、`report` 不是永久入口。
   - 当阶段目标完成、已被主文档吸收、或已失去现行指导意义时，必须降级为 `superseded` 或 `archived`。

## 四、推荐知识结构

### 4.1 树状结构

- `docs/INDEX.md`：全仓总入口
- `docs/<module>/README.md`：模块总入口
- 主题文档：ssot / spec / design / implementation / adr / sop / planning / fix

模块 `README.md` 默认采用**混合模式**：

- 上半部：人工维护的治理入口、阅读顺序、权威文档说明
- 下半部：脚本自动维护的文档台账

自动台账区必须包裹在：

- `<!-- AUTO-GENERATED-TABLE:START -->`
- `<!-- AUTO-GENERATED-TABLE:END -->`

### 4.2 网状结构

- `relates`：当前阅读链扩散
- `supersedes` / `superseded_by`：生命周期关系
- 文末“关联文档”：人类可读的导航镜像

### 4.3 链路结构

- 第一读链：总入口 → 模块入口 → 子域总纲 → 分册细则
- 执行链：规范（SSOT）→ 决策（ADR）→ 操作（SOP）
- 历史链：现行文档 ← superseded_by ← 旧规划 / 旧总结 / 旧报告

## 五、A/B/C/D 分层模型

| 层级 | 含义 | 允许承担第一读 |
| --- | --- | --- |
| A 层 | 权威入口 / 总纲 / 现行分册（SSOT） | 是 |
| B 层 | 当前有效的主题设计 / 规范 / 指南（spec / adr / sop） | 按需 |
| C 层 | 执行计划 / 审计 / 检查 / 工作面（planning / fix） | 否 |
| D 层 | 历史 / 被替代 / 迁移背景 / 一次性产物 | 否 |

判定原则：

- A 层解决“先看什么”
- B 层解决“深入看什么”
- C 层解决“当前在做什么”
- D 层解决“过去发生过什么”

### 5.1 三文档类型与分层映射

SSOT/ADR/SOP 三文档体系与 A/B/C/D 分层的关系：

| 文档类型 | 默认层级 | 说明 |
| --- | --- | --- |
| SSOT（type: ssot） | A 层 | 子系统第一入口，承担权威入口职责 |
| ADR（type: adr） | B 层 | 决策证据链，按需阅读 |
| SOP（type: sop） | B 层 | 操作手册，运维时按需阅读 |

SSOT 是三文档体系的枢纽：它是 A 层权威入口，通过 `relates`/关联文档指向 B 层的 ADR 和 SOP。详见 [DOC_MANAGEMENT §十](DOC_MANAGEMENT.md#十ssotadrsop-三文档哲学)。

## 六、跨模块治理流程

1. 先确定治理域与目标边界。
2. 建立或确认模块入口、子域入口、第一读顺序。
3. 定义 A/B/C/D 分层。
4. 收敛冲突总纲，只保留一个权威口径。
5. 批量降级已历史化的 planning / summary / status / report。
6. 把新入口注册到 `docs/INDEX.md` 和相关 README。
7. 运行治理同步与全局索引重建，验证入口已可命中。

## 七、何时允许放在 `docs/` 根目录

`docs/` 根目录只允许放置**跨模块治理元文档与全局规范**，例如：

- 文档治理总纲（DOC_GOVERNANCE_SPEC / DOC_MANAGEMENT / CURSOR_DOC_USAGE / INDEX）
- 全局 UI 规范（POCKETPAL_DESIGN_SPEC 等 SPEC 系列，被多个业务模块共同消费）

禁止把任何单一业务模块的设计、实现、规划、排障文档直接放到 `docs/` 根；单一业务模块文档必须放 `docs/<module>/`。

**既有文档过渡规则**：2026-08-15 前已存在于 `docs/` 根的全局规范类文档（POCKETPAL_* SPEC 系列）按全局规范保留在根；新增单一业务模块文档一律进 `docs/<module>/`。

**AIOS 内部工作区（docs/internal/）**：该目录为 AIOS 体系既有工作文档（含 AIOS 版 ADR/SOP/SSOT 与 MASTER_LOG），由 AIOS 自身治理体系管理，**豁免本文档体系的前端 frontmatter/命名审计**；新规范文档不得写入该目录，AIOS 文档也不得混入 `docs/adr/`、`docs/sop/`。

## 八、冲突处理

若不同文档对“文档治理方式”描述冲突，优先级如下：

1. `DOC_GOVERNANCE_SPEC.md`
2. `DOC_MANAGEMENT.md`
3. `CURSOR_DOC_USAGE.md`
4. 模块 `README.md` / 模块 `INDEX.md`
5. 旧 planning / analysis / summary / report

## 九、模块域归属规则

### 9.1 域列表（小黄鸡仓库）

| 域目录 | 模块 | 前缀约定 | 说明 |
| --- | --- | --- | --- |
| `docs/chat/` | 聊天域 | `CHAT_*` | 聊天页 UI、气泡、输入、会话调度 |
| `docs/imagegen/` | 生图域 | `IMAGEGEN_*` | 生图页、DreamLite/SD/Z-Image 引擎 UI |
| `docs/models/` | 模型域 | `MODELS_*` | 模型列表/下载/设置 |
| `docs/memory/` | 记忆域 | `MEMORY_*` | AIOS 记忆管理 |
| `docs/knowledge/` | 知识库域 | `KNOWLEDGE_*` | AIOS 知识库 |
| `docs/workspace/` | 智能体域 | `WORKSPACE_*` | AIOS 智能体（workspace） |
| `docs/tools/` | 工具域 | `TOOLS_*` | 工具配置、ActiveTaskBanner |
| `docs/settings/` | 设置域 | `SETTINGS_*` | 设置入口中心与二级设置页 |
| `docs/engine/` | 引擎域 | `ENGINE_*` | llama.cpp 文本推理、ONNX 生图 JNI（UI 改造禁区） |
| `docs/ui/` | 设计系统域 | `UI_*` | 设计 token、DS 组件、主题 |
| `docs/platform/` | 跨域治理 | `PLATFORM_*` | 跨模块治理文档（SSOT/ADR/SOP 之外） |

### 9.2 归属判定规则

1. **前缀优先**：文件名前缀（如 `IMAGEGEN_`、`MEMORY_`）决定归属域。
2. **无前缀时**：按内容主题归入最相关域；若跨域，放主域并在 frontmatter `relates` 中关联。
3. **新建文档**：必须在 frontmatter 声明 `module: <域目录名>`。

### 9.3 ADR 与 SOP 专域

- ADR 统一放 `docs/adr/`（module: adr），不按业务域分散。
- SOP 统一放 `docs/sop/`（module: sop），不按业务域分散。

## 关联文档

- [文档管理机制](./DOC_MANAGEMENT.md)
- [AI 文档使用说明](./CURSOR_DOC_USAGE.md)
- [文档索引（INDEX）](./INDEX.md)
- [UI 设计语言总纲（SSOT）](./POCKETPAL_DESIGN_SPEC.md)
