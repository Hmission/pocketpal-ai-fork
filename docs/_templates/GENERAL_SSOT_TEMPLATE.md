---
doc_id: GENERAL_SSOT_TEMPLATE
module: _templates
type: ssot
status: draft
version: "0.1"
created: "YYYY-MM-DD"
updated: "YYYY-MM-DD"
relates: []
---
<!-- D-FORMAT:v3 -->

<!-- 文档管理：机制见 docs/DOC_MANAGEMENT.md；AI 用法见 docs/CURSOR_DOC_USAGE.md。
更新时：1) 更新 frontmatter 的 updated/version；2) 同步 type/status/relates 与文末「关联文档」；
3) 在「关联」章节指向相关 ADR 与 SOP；4) 在 docs/INDEX.md 中登记。-->

# {子系统中文名} · SSOT（{English Name}）

**状态**：draft | **版本**：0.1 | **更新**：YYYY-MM-DD

> **定位**：一句话说明本子系统在系统中的边界与职责。
> **配套**：相关 ADR 见 `docs/adr/ADR-NNNN-*`；操作手册见 `{SOP_NAME}.md`。

## 一、定位与边界

- **负责**：
- **不负责**（明确排除）：
- **上下游**：读谁 / 被谁读

## 二、核心原则 / 公理

> 用若干条不可违背的规则描述运行时行为或设计哲学。

1. …
2. …

## 三、架构概要

> 用文字描述或 ASCII 图说明核心组件及数据流向。

## 四、状态模型

| 维度 | 说明 |
|------|------|
| 输入 | |
| 输出 | |
| 持久状态 | |
| 事件 / 日志 | |

## 五、契约

- **对外 API / CLI**：
- **事件 schema**（若有）：
- **与其他子系统的合同**（若有）：

## 六、健康指标

| 指标 | 阈值 / 说明 |
|------|-------------|
| | |

## 七、Gap Ledger

| Gap ID | 现象 | 补齐路径 |
|--------|------|----------|
| | | |

## 八、关联

- **同层子系统**：
- **相关 ADR**：
- **操作手册 (SOP)**：

## 变更日志

| 日期 | 版本 | 变更 |
|------|------|------|
| YYYY-MM-DD | 0.1 | 骨架首发 |

## 关联文档

- [{SOP_NAME}](./{SOP_NAME}.md)（sop）
