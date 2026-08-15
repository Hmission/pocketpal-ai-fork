---
doc_id: CURSOR_DOC_USAGE
module: root
type: doc
status: active
version: "1.0"
created: "2026-08-15"
updated: "2026-08-15"
relates: [DOC_GOVERNANCE_SPEC, DOC_MANAGEMENT, INDEX]
---

<!-- D-FORMAT:v3 -->

# AI 文档使用说明

**面向**：Qoder / Cursor 及其它 AI 助手。治理总纲见 [DOC_GOVERNANCE_SPEC.md](./DOC_GOVERNANCE_SPEC.md)，机制详见
[DOC_MANAGEMENT.md](./DOC_MANAGEMENT.md)。

---

## 0. 入口与 @ 约定（必守）

涉及某**模块**的修改、阅读或排查时：

- **必须先 @ 对应入口**，再按索引打开文档或代码：
  - 文档：**@docs/INDEX.md** → 再按 ssot/spec 与 `relates` 打开。
- **禁止**一上来就 `@docs`、`@.` 或全目录引用；避免全量 `grep` 或遍历 `docs/**/*.md`。
- **排除噪音**：提供报错或日志时，**只贴关键几行或关键信息**，不贴整段终端输出或完整 build/运行日志。
- 目的：缩小上下文、降低 token、精确定位。

---

## 1. 入口

当你说 **「读取相关文档」** 或 **「对 [某] 模块进行修改/更新」** 时，AI 会按以下流程执行：

1. **先读**：`docs/DOC_GOVERNANCE_SPEC.md`（治理总纲）、`docs/CURSOR_DOC_USAGE.md`（本说明）、`docs/DOC_MANAGEMENT.md`（元数据与检查清单）。
2. **再按任务读**：`docs/INDEX.md` 定位 module → 相关文档 → 按 `relates` 扩散。**不要**全量 `grep` 或遍历 `docs/**/*.md`。

---

## 2. 规划新功能时

1. **确定 module**：从 INDEX 的 module 列表选一个；若缺失则选 `platform` 并提议新增 module。
2. **读该模块的必读与 ssot/spec**：只读这些 + 其 `relates` 中 `status=active` 的文档。
3. **写新规划文档时**：
   - **必须保存到 `docs/<module>/<文件名>.md`**；按 DOC_MANAGEMENT 的 frontmatter 填写；`relates` 至少含 1 份 ssot/spec。
   - **必须执行**：在 `docs/INDEX.md` 登记。
4. **禁止**：在 `docs/` 根下新建业务文档；不填 frontmatter 就提交；不更新 INDEX；把 `status=superseded` 的文档当权威读。
5. **三文档检查**：若规划的是新子系统/能力域，须规划 SSOT（type: ssot）和 SOP（type: sop）；若涉及满足[三条件](../docs/DOC_MANAGEMENT.md#82-adr架构决策记录)的技术决策，须规划 ADR（type: adr）。详见 [DOC_MANAGEMENT §十](DOC_MANAGEMENT.md#十ssotadrsop-三文档哲学)。

---

## 3. 实现或修改已有功能时

1. **定位文档**：从 INDEX 找 ssot/spec/fix；**先看 frontmatter 的 `superseded_by`**，若非空则改读其指向的文档。
2. **若修改了实现或规范**：按 DOC_MANAGEMENT 的更新检查清单更新 frontmatter、INDEX。

---

## 4. 新建或大幅改写任意文档时（通用）

- **必做**：**必须放在 `docs/<module>/` 下**（ADR 放 `docs/adr/`，SOP 放 `docs/sop/`）；frontmatter 完整；在 INDEX 登记；若取代某文档则成对维护 supersedes/superseded_by。
- **推荐**：文末「关联文档」与 `relates` 一致，链接用相对路径。
- **禁止**：在 `docs/` 根下新增业务文档；提交未在 INDEX 登记的新文档。

---

## 5. 按任务类型的最小必读（减负）

| 任务类型 | 最小必读路径 |
| --- | --- |
| **修 bug / 定位问题** | INDEX.md（定 module）→ 相关 spec/fix（按 relates） |
| **新功能 / 改已有功能** | INDEX.md → 对应 ssot/spec；若影响 UI 则先读 DESIGN_SPEC（SSOT） |
| **了解子系统架构** | INDEX.md → SSOT（type: ssot，A 层入口）→ 相关 ADR（决策证据）→ SOP（操作手册） |
| **只读文档 / 了解项目** | INDEX.md → 治理文档（DOC_GOVERNANCE_SPEC、DOC_MANAGEMENT、本说明）及目标 module 文档 |

---

## 6. 用 `relates` 降低阅读消耗

- 只读 frontmatter 的 `doc_id`、`module`、`type`、`relates` 即可决定是否打开全文。
- 按 `relates` 扩散时：只打开 `status=active`；`superseded` 仅在查历史时打开。

---

## 7. 完成修改后：文档治理同步

AI 在完成 **代码** 或 **`docs/` 下文档** 的修改后，**必须**主动运行：

```bash
python scripts/governance/doc_frontmatter_audit.py   # frontmatter 合规
python scripts/governance/doc_naming_audit.py        # 命名合规
```

并在 `docs/INDEX.md` 登记/更新对应文档行（手动或运行 `scripts/governance/sync_doc_index.py`）。

## 关联文档

- [文档治理总规范](./DOC_GOVERNANCE_SPEC.md)
- [文档管理机制](./DOC_MANAGEMENT.md)
- [文档索引（INDEX）](./INDEX.md)
