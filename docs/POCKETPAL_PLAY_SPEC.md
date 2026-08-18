---
doc_id: POCKETPAL_PLAY_SPEC
module: root
type: spec
status: active
version: "1.0"
created: "2026-08-18"
updated: "2026-08-18"
relates: [POCKETPAL_PRODUCT_SPEC, POCKETPAL_STARMAP_DOMAINS, POCKETPAL_MODEL_MATRIX]
---

<!-- D-FORMAT:v3 -->

# 玩具工坊 · 玩法 SPEC（PLAY_SPEC）

**状态**：active | **版本**：1.0 | **更新**：2026-08-18

> **定位**：让代码模型从「工程师」转岗「玩具匠」——不写生产代码，只造能玩的小玩意。
> 产品叙事：数字生命玩具，不追求生产力（INTEGRATION_PLAN 定位延续）。
> **配套**：路由专工见 `src/store/taskRouter.ts`；玩具渲染沙盒见 `HtmlPreviewBubble`。

## 一、定位与边界

- **负责**：
  - `play` 意图路由（聊天内「做个玩具」→ 代码模型 → render_html 出可玩成品）
  - 玩具箱：render_html 成功产物自动落盘 `workspace/toys/`，可浏览、可重玩
  - 玩法引导：聊天输入卡快捷按钮「做个玩具」（与「图像生成」「图片编辑」同构，前后端对齐）
- **不负责**（明确排除）：
  - 不写生产代码、不接真实工程任务（那是 `code` 任务，选型/弹窗分离）
  - 不做游戏引擎、不做沙盒外能力（CSP 禁网钉死，沿用 HtmlPreviewBubble 既有安全信封）
  - 不做 device_control 写操作（读屏围观属另一链路，Phase 2 只读子集另行评估）
- **上下游**：读 ChatInput 快捷前缀 / taskRouter 路由 / modelCapabilityRegistry 选型 → 写 toyChest 玩具箱 → 消费 HtmlPreviewBubble 渲染

## 二、核心原则 / 公理

1. **只判不执**：taskRouter 只分类，调度执行由 useChatScheduler 受控完成（与 image/write/code 同构）。
2. **玩具匠=代码模型**：play 任务选型复用 code 指纹（Ministral-3-3B，MODEL_MATRIX 入选清单 #6）；弹窗文案区分「玩具」任务，决策可见 + 用户主权。
3. **成品即藏品**：render_html 成功（非 error）且带 title 的产物自动进玩具箱——玩具箱是 render_html 的存档库，不做二次确认（无补丁无兜底）。
4. **沙盒不破防**：玩具渲染沿用 HtmlPreviewBubble 严格 CSP（default-src 'none'，禁网络），JS 全开仅限全屏 modal（用户主动激活）。
5. **玩法引导前置**：用户无需知道路由关键词——输入卡快捷按钮「做个玩具」即入口；知识库玩具箱 tab 可回看全部藏品。

## 三、架构概要

```
用户「做个玩具」→ ChatInput 快捷按钮（前缀「做个玩具：」）
                    或自然语言「做个贪吃蛇」
   → taskRouter: play 意图（payload=玩具主题）
   → useChatScheduler: resolveTaskModel('play') 弹窗确认（玩具任务推荐模型）
   → 代码模型加载（Ministral-3-3B）→ handleSendPress
   → AgentRunner: render_html 工具调用（玩具匠人格 fragment 注入系统消息）
   → RenderHtmlEngine 纯透传 → HtmlPreviewBubble 行内预览/全屏可玩
   → tool_call_finished: 成功产物 fire-and-forget 落盘 toyChest（workspace/toys/）
   → KnowledgeScreen 第四 tab「玩具箱」列表 + 重玩
```

## 四、状态模型

| 维度 | 说明 |
|------|------|
| 输入 | 快捷前缀「做个玩具：<主题>」/ 自然语言（PLAY_RE） |
| 输出 | render_html 成品 + 玩具箱条目（title + html） |
| 持久状态 | `workspace/toys/index.json`（title/时间戳）+ `toys/<ts>_<slug>.html` |
| 事件 / 日志 | ToolScreen 调用历史照常记录（render_html 条目） |

## 五、契约

- **taskRouter**：`TaskKind` 增 `'play'`；`PLAY_RE` 自然语言路由 + 快捷前缀「做个玩具：」→ `{task: 'play', payload}`；无主体不路由。
- **modelCapabilityRegistry**：`findModelForTask('play')` 复用 code 选型（declared capabilities → DEFAULT_MAP code 指纹 → 兜底最大本地模型）。
- **useChatScheduler**：`signal.task === 'play'` → `resolveTaskModel('play', text)`（扩展自 write/code 同构）→ 通过后 handleSendPress。
- **ModelSwitchDialog**：`TASK_LABEL` 增 `play: '玩具'`（弹窗标题「玩具任务推荐模型」）。
- **RenderHtmlEngine.systemPromptFragment**：render_html 激活时注入玩具匠人格——单文件 HTML、中文界面、必带 title、可玩性优先。
- **toyChest**：`saveToy(title, html)` / `listToys()` / `readToy(id)`；落盘 `AIOS_TOYS_DIR`；`ensureAiosDirs` 建目录。
- **useChatSession.applyEventToStore**：`tool_call_finished` 时若 toolName=render_html 且结果 type='html' 且 title 非空 → fire-and-forget `saveToy`（与记忆提取钩子同模式，不阻塞主链）。
- **KnowledgeScreen**：第四 tab「玩具箱」——listToys → 行点开读 html → HtmlPreviewBubble 渲染重玩。

## 六、健康指标

| 指标 | 阈值 / 说明 |
|------|-------------|
| tsc | 零错误 |
| jest | taskRouter play 用例 + toyChest 用例全绿 |
| validate:l10n | 无告警 |
| 真机验收 | 快捷按钮「做个玩具：贪吃蛇」→ 出可玩成品 → 入玩具箱 → 重启后可重玩 |

## 七、Gap Ledger

| Gap ID | 现象 | 补齐路径 |
|--------|------|----------|
| PLAY-1 | 3B 玩具匠首生成质量未知 | 真机实证（2026-08-19 K90）：工具在场但模型只吐概念/代码不调 render_html——根因是工具描述与人格片段只有「怎么做」没有「何时必须调」。✅ v1.3 已磨：description 与 fragment 首行加触发令（MUST call，禁吐代码）；仍不达标则玩具模板库（资产目录，非兜底分支） |
| PLAY-2 | 玩具箱条目无限增长 | ✅ 已闭环（v1.1）：上限 50 件滚动淘汰——saveToy 裁 index 时同步 unlink 出局 html 文件（名单与文件同生共死，无孤儿残留） |
| PLAY-3 | 无显式 Pal 的会话拿不到 pact 工具：系统提示词兜底 AIOS 女妖（useChatSession），但 getCurrentCompletionSettings 无兜底——灵魂注入了、手被砍了，play 任务静默退化为纯聊天 | ✅ 已闭环（v1.2）：getCurrentCompletionSettings 无显式 Pal 时兜底 AIOS 女妖 pact（与提示词兜底对仗）——pact.talents 是工具可用性的唯一事实源（2026-08-19 K90 真机实证） |

## 八、关联

- **同层子系统**：tools（ToolScreen 工具配置）、knowledge（KnowledgeScreen 玩具箱 tab）、chat（useChatScheduler 任务分发）
- **相关 ADR**：无（本 SPEC 为玩法层，不涉架构决策）
- **操作手册 (SOP)**：UI_GATE_VERIFICATION_SOP（验证门禁沿用）

## 变更日志

| 日期 | 版本 | 变更 |
|------|------|------|
| 2026-08-18 | 1.0 | 首发：play 路由 + 玩具匠人格 + 玩具箱 + 玩法引导（前后端对齐） |
| 2026-08-19 | 1.1 | 闭环收口：PLAY-2 文件级滚动淘汰（unlink 出局 html）——名单与文件同生共死 |
| 2026-08-19 | 1.2 | 闭环 PLAY-3：无显式 Pal 会话的工具兜底（getCurrentCompletionSettings → AIOS 女妖 pact），play/adventure 工具任务不再静默退化 |
| 2026-08-19 | 1.3 | 磨利 PLAY-1：render_html 工具描述与玩具匠片段首行加调用触发令（玩具请求 MUST call，禁止聊天内吐代码/空谈概念）——K90 真机实证工具在场但模型不调用 |

## 关联文档

- [产品路线图（P 系列）](./POCKETPAL_PRODUCT_SPEC.md)（positioning）
- [星图域清单](./POCKETPAL_STARMAP_DOMAINS.md)（spec）
- [模型选型唯一事实源](./POCKETPAL_MODEL_MATRIX.md)（spec）
