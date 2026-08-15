---
doc_id: DOC_MANAGEMENT
module: root
type: spec
status: active
version: "1.0"
created: "2026-08-15"
updated: "2026-08-15"
relates: [DOC_GOVERNANCE_SPEC, CURSOR_DOC_USAGE, INDEX]
---

<!-- D-FORMAT:v3 -->

# 文档管理机制

**状态**：active | **版本**：1.0 | **更新**：2026-08-15

本文档定义全仓库文档元数据、目录、路径、登记与同步规则。治理总纲见
[DOC_GOVERNANCE_SPEC.md](./DOC_GOVERNANCE_SPEC.md)。

---

## 一、核心文档路径与角色（B 层）

| 核心文档 | 路径 | 变更时机 |
| --- | --- | --- |
| 文档治理总纲 | `docs/DOC_GOVERNANCE_SPEC.md` | 治理原则、分层方法或历史收敛规则变更时 |
| 文档管理机制 | `docs/DOC_MANAGEMENT.md` | 元数据、登记、同步机制变更时 |
| 文档索引 | `docs/INDEX.md` | 每次新增文档登记；meta 变化时同步更新 |
| AI 使用说明 | `docs/CURSOR_DOC_USAGE.md` | 机制或流程变化时 |

**docs 根目录白名单**：`DOC_GOVERNANCE_SPEC.md`、`DOC_MANAGEMENT.md`、`CURSOR_DOC_USAGE.md`、`INDEX.md`、以及既有的全局规范类文档（`POCKETPAL_*` SPEC 系列、`APP_INTRO_COPY.md`、`getting_started.md`）。**单一业务模块文档不得位于 `docs/` 根，必须位于 `docs/<module>/` 下。**

---

## 二、元数据（frontmatter）

每份 `docs/**/*.md` 最前、`---` 与 `---` 之间为 YAML frontmatter。

### 必填

| 字段 | 说明 |
| --- | --- |
| `doc_id` | 唯一 ID，= 文件名去掉 .md |
| `module` | 所属模块，= 所在目录名（根目录治理文档用 `root`） |
| `type` | ssot / spec / design / planning / implementation / summary / fix / index / howto / operations / positioning / adr / sop / doc / copy |
| `status` | draft / active / superseded / archived / deprecated |

### 类型语义速查

| 新增类型 | 含义 | A/B/C/D 层 | 何时使用 |
| --- | --- | --- | --- |
| `ssot` | 唯一真相源 — 子系统的定位、边界、契约、指标 | A 层 | 每个主要子系统/能力域各一份 |
| `adr` | 架构决策记录 — 难以逆转的真实权衡 | B 层 | 满足三条件准入标准时创建（见 §8.7） |
| `sop` | 操作手册 — 日常运维、验证、故障排查 | B 层 | 子系统上线运行后必须配套 |
| `spec` | 规范文档 — 适用范围/术语/条款/验证 | B 层 | 规则性内容定稿 |
| `doc` | 使用说明类 | B 层 | 面向 AI/开发者的执行手册 |

### 建议

`version`、`created`、`updated`、`relates`（doc_id 列表）、`supersedes`、`superseded_by`。

### 模块（module）清单

`root` | `adr` | `sop` | `ui` | `chat` | `imagegen` | `models` | `memory` | `knowledge` | `workspace` | `tools` | `settings` | `engine` | `platform` | `_templates`

---

## 三、新文档必须遵守的规则

| 规则 | 约束 |
| --- | --- |
| **放置** | **必须**放在 `docs/<module>/<文件名>.md`；**禁止**在 `docs/` 根新增业务文档（ADR 放 `docs/adr/`，SOP 放 `docs/sop/`）。仅允许经明确治理决策批准的跨模块治理元文档与全局规范。 |
| **命名** | `{SUBJECT}_{TYPE}.md`，UPPER_SNAKE_CASE（既有 POCKETPAL_* 系列沿用原名）；doc_id=文件名去掉 .md。 |
| **frontmatter** | 必填 doc_id、module、type、status；强烈建议 relates、version、created、updated。 |
| **头部** | 机制引用（见 §四）+ 标题下 1 行 `**状态**：x | **版本**：x | **更新**：x`。 |
| **登记** | 在 `docs/INDEX.md` 登记；ADR/SOP 在各自专域登记。 |
| **文末关联** | 与 `relates` 一致；**链接用相对路径**：同目录 `./X.md`，跨目录 `../<module>/X.md`，元文档 `../X.md`。 |

### 3.1 规划与合并、主文档切分（补充）

| 规则 | 约束 |
| --- | --- |
| **独立主题各自成文** | 不同主题/领域的规划不要硬塞到一个文档里；各自建文档，通过 INDEX 分组索引。 |
| **禁止一任务一文档** | 同一功能模块下，不按「每个子任务」单独建文档；子任务作为主文档内章节或附录即可。 |
| **规划期可新起、执行后合并** | 规划阶段可为新规划单独建文档；**执行完毕后**，应把该规划的要点与结果合并到该功能模块的**主文档**（ssot/spec/design 等），原 planning 置 `status: superseded`、`superseded_by` 指向主文档。 |
| **主文档可切分** | 功能模块主文档若过大（如 > 3000 行或单文件难以维护），可按子域切分，在 INDEX 中标明主从或阅读顺序。 |

---

## 四、头部机制引用模板

在 frontmatter `---` 结束与 `# 标题` 之间：

```html
<!-- 文档管理：机制见 docs/DOC_MANAGEMENT.md；AI 用法见 docs/CURSOR_DOC_USAGE.md。
更新时：1) 更新 frontmatter 的 updated/version；2) 同步 type/status/relates 与文末「关联文档」（链接用相对路径）；
3) 若取代/被取代则填 supersedes/superseded_by；
4) SSOT 文档须在「关联」章节指向相关 ADR 与 SOP；SOP 文档须指向其 SSOT；
5) 在 docs/INDEX.md 中登记。-->
```

---

## 五、更新检查清单（每次修改必查）

0. **放置**：新文档必须放在 `docs/<module>/`（ADR 放 `docs/adr/`，SOP 放 `docs/sop/`）；禁止在 `docs/` 根新增业务文档。
1. 更新 frontmatter 的 `updated`、`version`；若 type/status/relates 变更则同步。
2. `relates` 与文末「关联文档」一致（**链接用相对路径**）；若 supersedes/superseded_by 有变，成对维护。
3. 若 status 变为 superseded/archived/deprecated，同步 frontmatter 与 INDEX。
4. 更新 `docs/INDEX.md` 中该文档对应的行。

---

## 六、路径与文末「关联文档」

- **同目录**：`./OTHER.md`
- **跨目录**：`../chat/CHAT_UI_SPEC.md`、`../adr/ADR-0001-*.md`
- **元文档**：`../DOC_MANAGEMENT.md`、`../INDEX.md`、`../CURSOR_DOC_USAGE.md`

文末示例：

```markdown
## 关联文档

- [聊天页 UI 规范](../chat/CHAT_UI_SPEC.md)（chat）
- [生图页 UI 规范](../imagegen/IMAGEGEN_UI_SPEC.md)（imagegen）
- [文档管理机制](../DOC_MANAGEMENT.md)（root）
```

---

## 七、文档治理同步脚本与可选自动化

### 7.1 何时运行

在完成 **`docs/` 下任意 .md 的新增、修改、移动** 后，应运行：

```bash
python scripts/governance/doc_frontmatter_audit.py   # frontmatter 合规审计（必填字段 + D-FORMAT）
python scripts/governance/doc_naming_audit.py        # 命名规范审计（UPPER_SNAKE_CASE + 重名检测）
```

### 7.2 同步脚本

```bash
python scripts/governance/sync_doc_index.py          # 从 frontmatter 刷新 docs/INDEX.md 台账区
```

---

## 八、正文模板（必含章节）

新建文档时，按 `type` 选择对应正文模板。frontmatter 之后、正文之前请先放头部机制引用（第四节）。

### 8.1 ssot（唯一真相源）

> **适用场景**：子系统/能力域的第一入口文档——定义定位、边界、核心原则、契约、健康指标。是 A 层权威入口。模板见 `docs/_templates/GENERAL_SSOT_TEMPLATE.md`。

### 8.2 adr（架构决策记录）

> **创建前必读三条件准入标准**——当且仅当三者皆满足时才创建 ADR：

| # | 条件 | 判断标准 |
| --- | --- | --- |
| 1 | **难以逆转** | 改动代价大（时间/金钱/风险），逆转不是只改一行代码+重新部署 |
| 2 | **缺少上下文令人惊讶** | 未来读者看到代码会问「为什么这样做」，需要解释 |
| 3 | **真实权衡的结果** | 有真实备选方案，因明确理由选了其一；只有一个选项的不算 |

**不写 ADR 的场景**：日常 bug 修复（commit message 即可）；临时/数据决策（注释或 TODO）；显而易见的选择（无需解释）；记录性文档（写 `.md` 说明即可）；备选单一（不写 ADR）。

**ADR 专门规则**：

| 规则 | 约束 |
| --- | --- |
| **路径** | 必须位于 `docs/adr/`，不放入 `docs/<module>/` |
| **命名** | `ADR-NNNN-{slug}.md`，NNNN 为四位序号，slug 为短横线英文描述 |
| **序号分配** | 取现有最大序号 +1，禁止跳号或复用 |
| **frontmatter** | 必填 `doc_id`、`module: adr`、`type: adr`、`status`（accepted / proposed / superseded） |
| **正文结构** | `# ADR-NNNN 决策标题` → 状态/日期/决策人/相关 → 背景 → 决策 → 备选方案表 → 影响 → 验证 |

### 8.3 sop（操作手册）

> **适用场景**：子系统的日常运维、验证与故障排查操作手册。是 SSOT 的操作面配套。模板见 `docs/_templates/SOP_TEMPLATE.md`。

### 8.4 spec（规范文档）

```markdown
# {标题}

**状态**：{status} | **版本**：{version} | **更新**：{updated}

## 一、适用范围

本规范适用于哪些模块/场景/角色。

## 二、术语定义

| 术语 | 定义 |

## 三、规范条款

按条目列出规范要求，每条用「必须/禁止/建议」明确约束力。

## 四、验证方法

如何检查是否符合规范（脚本/人工/测试）。

## 关联文档
```

### 8.5 planning（规划文档）

```markdown
# {标题}

**状态**：{status} | **版本**：{version} | **更新**：{updated}

## 一、背景

为什么要做这个规划、触发条件。

## 二、目标

要达成什么、成功标准。

## 三、方案选择（若有多个方案）

| 方案 | 优点 | 缺点 | 建议 |

## 四、原子执行清单

| 序号 | 执行项 | 依赖 | 状态 |

## 五、风险与应对

| 风险 | 影响 | 应对措施 |

## 关联文档
```

### 8.6 fix（修复文档）

```markdown
# {标题}

**状态**：{status} | **版本**：{version} | **更新**：{updated}

## 一、问题描述

症状、触发条件、影响范围。

## 二、根因分析

根因链条、涉及的代码/配置/文档。

## 三、修复方案

具体改动（文件、函数、配置项）。

## 四、验证

如何确认修复成功。

## 五、教训沉淀

防止复发的机制（规则/检查脚本/测试用例）。

## 关联文档
```

---

## 九、规划类文档面向大王时的写作规范（读者当小白）

当规划、治理类文档需要**大王拍板或知晓**（大王不懂程序、不做 code review）时，按以下方式写，方便大王看懂、做选择：

- **少术语**：必须用到的技术词第一次出现时用一句话大白话解释。
- **多步骤**：用「先做什么、再做什么」的列表或表格，少用长段落。
- **关键决策用选项 + 后果**：用「选 A / 选 B」表格，并写清选 A 会怎样、选 B 会怎样，方便大王二选一。
- **多用表格与勾选**：能用「序 | 做什么 | 结果 | ☐」表格的就用表格。
- **给大王看的摘要**：长文档开头或结尾可加一两段「大王版摘要」。

## 十、SSOT/ADR/SOP 三文档哲学

每个主要子系统（能力域/平台模块/业务模块）应具备三份文档：

| 文档类型 | 回答的问题 | 创建时机 | 状态流转 |
| --- | --- | --- | --- |
| **SSOT** | 是什么、为什么（what & why） | 系统立项时写，随内容演进 | 状态 active |
| **ADR** | 为什么这样选（why this way） | 满足[三条件准入标准](#82-adr架构决策记录)时创建 | 状态 accepted |
| **SOP** | 怎么操作（how to operate） | 系统上线时写，随操作方式演进 | 随操作演进 |

### 10.1 三文档体系

```
SSOT（定位+边界+约束） → A 层第一入口
  ├→ ADR-NNNN（决策：为什么选 A 不选 B）
  ├→ ADR-NNNN（决策：为什么采用 X 架构）
  └→ SOP（日常运维、故障排查、恢复步骤）
```

- **SSOT** 是系统的第一入口文档（A 层），定义边界、原则、契约、指标。
- **ADR** 是 SSOT 中关键决策的证据链（B 层），记录真实权衡。
- **SOP** 是 SSOT 的操作面（B 层），把约束转化为可执行步骤。

### 10.2 触发时机

| 场景 | 应产出 |
| --- | --- |
| 新建/重构系统/重大变化 | SSOT 首次编写 |
| 系统上线 | SOP 编写 |
| 关键决策有多个备选 | ADR（决策评审时） |
| 系统重大架构调整 | 更新 SSOT + 新增 ADR |
| 操作方式变化 | 更新 SOP |

### 10.3 验收标准

一个子系统文档体系完备的标志：

1. 存在 `type: ssot` 的权威文档（`status: active`）。
2. SSOT 的「关联」章节指向相关 ADR 和 SOP。
3. 存在 `type: sop` 的操作手册（含冒烟验证 + 故障排查）。
4. 关键架构决策有对应 ADR（符合三条件准入标准）。

---

## 十一、文档治理脚本

| 脚本 | 用途 | 路径 |
| --- | --- | --- |
| `doc_frontmatter_audit.py` | frontmatter 合规审计（必填字段 + D-FORMAT 标记） | `scripts/governance/` |
| `doc_naming_audit.py` | 命名规范审计（UPPER_SNAKE_CASE + 重名检测） | `scripts/governance/` |
| `sync_doc_index.py` | 从 frontmatter 刷新 `docs/INDEX.md` 台账区 | `scripts/governance/` |

## 关联文档

- [文档治理总规范](./DOC_GOVERNANCE_SPEC.md)
- [AI 文档使用说明](./CURSOR_DOC_USAGE.md)
- [文档索引（INDEX）](./INDEX.md)
