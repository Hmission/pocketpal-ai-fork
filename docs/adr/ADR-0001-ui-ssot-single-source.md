---
doc_id: ADR-0001-ui-ssot-single-source
module: adr
type: adr
status: accepted
version: "1.0"
created: "2026-08-15"
updated: "2026-08-15"
relates: [POCKETPAL_DESIGN_SPEC, DOC_GOVERNANCE_SPEC, DOC_MANAGEMENT]
---

<!-- D-FORMAT:v3 -->

# ADR-0001 UI 规范单源：DESIGN_SPEC 升格为 UI 域 SSOT

- 状态：Accepted
- 日期：2026-08-15
- 决策人：大王 / 女妖
- 相关：`docs/POCKETPAL_DESIGN_SPEC.md`、`docs/DOC_GOVERNANCE_SPEC.md`、`docs/DOC_MANAGEMENT.md`、Phase 2 UI 规范治理

## 背景

2026-08 前 UI 规范呈「扁平 SPEC 平铺」：DESIGN_SPEC（总纲）+ CHAT_UI_SPEC / IMAGEGEN_UI_SPEC / UI_INTERACTION_SPEC / ICON_SPEC 并列，无 frontmatter、无分层、无生命周期管理。实际问题：
- 规范缺失维度（间距栅格/阴影层级/组件状态/可访问性/文案）——单靠 DESIGN_SPEC v2 无法承载。
- 遗留债务无批次管理（聊天 50+ 处 borderRadius、fonts 双轨等无限期挂账）。
- 文档本身不符合团队标准文档逻辑（OneTakeMVP 的 ADR/SOP/SSOT 三文档体系）。

## 决策

1. **DESIGN_SPEC 升格为 UI 域 SSOT**（type: ssot, A 层）：定位/边界/核心原则/十一维度/Gap Ledger/关联 ADR+SOP。
2. **并行 SPEC 降为 B 层分册**（type: spec）：CHAT / IMAGEGEN / INTERACTION / ICON 四 SPEC 加 frontmatter，上位规范指向 DESIGN_SPEC（SSOT）。
3. **引入三文档体系**：决策证据进 `docs/adr/`（ADR-0001 起）；操作手册进 `docs/sop/`（五关门禁 SOP 起）。
4. **债务转 Gap Ledger**：原「登记债务」全部转为带批次号/验收标准的治理批次（B1-B5），不留无批次债务。
5. **文档治理入库**：DOC_GOVERNANCE_SPEC / DOC_MANAGEMENT / CURSOR_DOC_USAGE / INDEX / _templates 适配自 OneTakeMVP 体系。

## 备选方案

| 方案 | 结论 |
| --- | --- |
| 维持扁平 SPEC 平铺 | 缺维度、无分层、债务挂账；弃 |
| 新建独立「UI 治理文档」与 DESIGN_SPEC 并列 | 总纲唯一原则被破坏（两个 A 层入口）；弃 |
| 全部文档搬进 docs/<module>/ | 既有引用（AGENTS.md/代码注释/README）大量指向 docs/ 根，搬迁成本高且破坏兼容；按 DOC_GOVERNANCE_SPEC §七 过渡规则保留根目录全局规范 |

## 影响

- 文档：DESIGN_SPEC v3（SSOT 格式）+ 4 份并行 SPEC 加 frontmatter；新增治理元文档 4 份 + 模板 3 份 + ADR/SOP 库。
- 代码：零影响（纯文档治理）。
- 工作流：AI 修改文档后须跑 frontmatter/命名审计（scripts/governance/）。

## 验证

- `scripts/governance/doc_frontmatter_audit.py` 全绿（docs/ 全部 .md 含合法 frontmatter + D-FORMAT 标记）。
- `docs/INDEX.md` 登记所有文档。
- DESIGN_SPEC 的「关联」章节指向 ADR-0001/0002/0003 与 UI_GATE_VERIFICATION_SOP。
