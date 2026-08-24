---
doc_id: WORKSPACE_TOOL_ERROR_FEEDBACK_SPEC
module: workspace
type: spec
status: active
version: "1.0"
created: "2026-08-22"
updated: "2026-08-22"
relates: [POCKETPAL_WORKSPACE_SPEC, DRC_SPEC, DRC_COMPASS_REGISTRY, POCKETPAL_CHAT_UI_SPEC]
---

<!-- D-FORMAT:v3 -->

<!-- 文档管理：机制见 docs/DOC_MANAGEMENT.md；AI 用法见 docs/CURSOR_DOC_USAGE.md。
更新时：1) 更新 frontmatter 的 updated/version；2) 同步 type/status/relates 与文末「关联文档」（链接用相对路径）；
3) 若取代/被取代则填 supersedes/superseded_by；
4) SSOT 文档须在「关联」章节指向相关 ADR 与 SOP；SOP 文档须指向其 SSOT；
5) 在 docs/INDEX.md 中登记。-->

# 工具错误回传协议规范（WORKSPACE_TOOL_ERROR_FEEDBACK_SPEC）

**状态**：active | **版本**：1.0 | **更新**：2026-08-22

## 一、适用范围

本规范适用于 App 侧智能体工具调用链路（`AgentRunner` 循环 + `TalentEngine` 执行器）中**工具调用失败后，错误信息如何回传大模型**的全部环节：

- `TalentResult` 错误结果契约（`src/services/talents/types.ts`）
- `AgentRunner.executeOne` 错误拼装（`src/services/agent/AgentRunner.ts`）
- 全局工具重试纪律（系统提示词片段，`src/services/talents/index.ts`）
- 各引擎的导航指引（guide）产出契约（ReadUrlEngine / WritingDocEngine 首波覆盖）
- DRC 观测闭环（`tool.error` 事件 + CP-APP-009）

背景：聊天页真机实证「read_url 失败 only http(s) / writing_doc 失败 WRITE_FAILED」——模型收到只有错误描述、没有正确用法的回传后放弃重试，失败块成为终局。本规范把指南针三字段（定位/导航/深入）下沉到模型回传链路，使模型能按导航自纠。

## 二、术语定义

| 术语 | 定义 |
|---|---|
| 定位 | 错误本身（`summary` / `errorMessage`），描述「发生了什么」 |
| 导航 | `guide` 字段：正确调用示例 / 下一步动作，描述「该怎么改」 |
| 深入 | 工具契约（`toToolDefinition` 的 description/parameters）与文档指针 |
| guide | `TalentResult` 错误结果的**可选**字段，由引擎自治产出，随 `role:'tool'` 消息回传模型 |
| 重试纪律 | 系统提示词中的全局规则：失败必先修正重试；同一工具连续失败 2 次才可放弃 |
| 吞错 | 引擎把真实异常替换为无信息量的错误码（如纯 `WRITE_FAILED`），模型无法据此自纠——本规范禁止 |

## 三、规范条款

### 3.1 错误回传三字段协议（必须）

`TalentResult` 错误结果形态：

```ts
| {type: 'error'; summary: string; errorMessage: string; guide?: string}
```

- `guide` 为可选字段；不提供时行为与现状完全一致（向后兼容）。
- 约定：`summary` 人类/模型均可读（已有）；`errorMessage` 机器错误码（已有）；`guide` 为「正确调用示例 + 下一步动作」的自然语言导航（新增）。

### 3.2 拼装规则（必须）

`AgentRunner.executeOne` 产出错误 outcome 时：

```
responseContent = guide ? `${summary}\n\n${guide}` : summary
```

`responseContent` 是 `role:'tool'` 消息的 `content`（模型下一轮可见）。**不得**把 `guide` 拼进 UI 展示字段（`ToolErrorBlock` 只显示 `errorMessage`，保持克制）。

### 3.3 重试纪律（必须）

`collectSystemPromptFragments` 在存在激活工具时追加全局纪律片段（非任一引擎私有）：

> 工具返回错误时，先按错误提示修正参数后重试，不要放弃；同一工具连续失败 2 次仍未成功，才可放弃，并在最终回答中如实说明。

失败历史由模型上下文中的 `role:'tool'` 错误消息天然可数，**禁止**新增失败计数状态机（锋利，不臃肿）。

### 3.4 guide 产出契约（必须）

各引擎按自身错误域自治产出 guide，**禁止**建全局错误→示例注册表（引擎自治，声明式）：

| 引擎 | 错误场景 | guide 内容要求 |
|---|---|---|
| ReadUrlEngine | 非 http(s) URL | 正确调用 JSON 示例 + 「本地路径不是 URL，读本地文档用 read_section/read_html」 |
| ReadUrlEngine | 不在 allowlist | 「先 web_search 或原样复制用户消息中的链接」 |
| WritingDocEngine | 项目不存在（写动作） | init 正确调用 JSON 示例 + list 提示 |
| WritingDocEngine | 未知 action | action 枚举 + JSON 示例 |
| WritingDocEngine | DOC_TOO_LARGE | new_chapter 正确调用 JSON 示例 |
| 其余引擎 | — | 无 guide，行为不变（首波不覆盖） |

### 3.5 写作项目校验协议（必须，非兜底）

WritingDocEngine 写动作（`append` / `update_outline` / `update_persona` / `new_chapter`）执行前**必须**先 `findProject('writing', project)`：

- 命中 → 照常执行；
- 未命中 → 返回 `PROJECT_NOT_FOUND` 错误 + init guide。

**禁止**自动 `ensureProject`（隐式建目录会污染索引语义，属兜底补丁）。

### 3.6 禁止吞错（必须）

- 引擎异常兜底 `errorMessage` **必须**透传真实原因（如 `WRITE_FAILED: <真实 message>`），禁止硬编码无信息量错误码。
- 错误是模型自纠的原料：吞错 = 模型无法自纠 = 失败块成为终局。

### 3.7 观测闭环（必须，BT07 不为 SPOF）

- `executeOne` 错误分支发 DRC 事件：`emit('chat', 'tool.error', {tool, errorMessage, hasGuide})`，落 `AIOS/logs/events.jsonl` 供真机复盘取证。
- 指南针注册表登记 CP-APP-009（见 COMPASS_REGISTRY §2）；DRC_SPEC §3 事件表登记 `tool.error`。
- 观测失败静默（BT07），不阻断业务。

## 四、验证方法

| 关卡 | 检查内容 |
|---|---|
| 单测 | ①AgentRunner：error+guide → `responseContent` 含导航；无 guide → 行为不变；②WritingDocEngine：PROJECT_NOT_FOUND + guide、catch 透传真实错误；③ReadUrlEngine：guide 产出；④纪律片段在 `collectSystemPromptFragments` 输出中（有工具时） |
| 门禁 | `npx tsc --noEmit` + `npx jest` 全绿 + 文档治理三脚本 |
| 真机 | K90 复现：触发 read_url 本地路径误用 / writing_doc 未 init 直接写 → 取证第一轮失败后模型按 guide 自纠成功（或连续 2 次后如实放弃） |

## 关联文档

- [产物工作区规范](../POCKETPAL_WORKSPACE_SPEC.md)（workspace）
- [DRC 远程调试协议](../DebugRemoteControl/DRC_SPEC.md)（debug）
- [指南针注册表](../DebugRemoteControl/COMPASS_REGISTRY.md)（debug）
- [聊天页 UI 规范](../POCKETPAL_CHAT_UI_SPEC.md)（chat）
