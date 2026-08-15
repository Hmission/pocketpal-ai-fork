---
doc_id: SOP_TEMPLATE
module: _templates
type: sop
status: draft
version: "1.0"
created: "YYYY-MM-DD"
updated: "YYYY-MM-DD"
relates: ""
---
<!-- D-FORMAT:v3 -->

<!-- 文档管理：机制见 docs/DOC_MANAGEMENT.md；AI 用法见 docs/CURSOR_DOC_USAGE.md。
更新时：1) 更新 frontmatter 的 updated/version；2) 同步 type/status/relates 与文末「关联文档」；
3) 在「关联文档」指向 SSOT；4) 在 docs/INDEX.md 中登记。-->

# {子系统中文名} · SOP（{English Name} Operations）

**状态**：draft | **版本**：1.0 | **更新**：YYYY-MM-DD

> **定位**：{子系统}的日常运维、验证与故障排查操作手册。SSOT 见 [`{SSOT_NAME}.md`](../{module}/{SSOT_NAME}.md)。

## 一、独立运行验证（standalone smoke）

### 1.1 快速验证

> 最简短的冒烟测试命令 + 期望结果。

### 1.2 验证产物/状态完整性

> 检查点列表，每项含「检查命令 + 期望结果」。

### 1.3 退出码 / 状态速查

| 退出码/状态 | 含义 | 排查方向 |
|------|------|----------|
| 0 | 成功 | — |

## 二、日常操作

### 2.1 检查健康

> 日常巡检命令 + 判断标准。

### 2.2 常规操作

> 按频率或场景列出日常操作步骤。

## 三、故障排查

### 3.1 已知问题与解法

| 症状 | 根因 | 解法 |
|------|------|------|
| | | |

### 3.2 诊断路径

> 从症状到根因的诊断步骤（按优先级排序）。

## 四、变更操作

### 4.1 变更步骤

> 执行变更的具体步骤。

### 4.2 回滚方案

> 如何撤销变更、恢复基线。

## 五、验收标准

> 变更完成后如何确认成功（量化指标）。

## 变更日志

| 日期 | 版本 | 变更 |
|------|------|------|
| YYYY-MM-DD | 1.0 | 首发 |

## 关联文档

- [{SSOT_NAME}](../{module}/{SSOT_NAME}.md)（module）
