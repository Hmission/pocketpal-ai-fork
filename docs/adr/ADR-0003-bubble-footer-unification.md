---
doc_id: ADR-0003-bubble-footer-unification
module: adr
type: adr
status: accepted
version: "1.0"
created: "2026-08-15"
updated: "2026-08-15"
relates: [POCKETPAL_CHAT_UI_SPEC, POCKETPAL_DESIGN_SPEC]
---

<!-- D-FORMAT:v3 -->

# ADR-0003 消息气泡一体化：footer 收进卡片（B1 批次决策）

- 状态：Accepted（B1 批次已实施落地）
- 日期：2026-08-15
- 决策人：大王 / 女妖
- 相关：`src/components/Message/Message.tsx`、`src/components/AssistantTurnFooter/`、`src/components/Bubble/styles.ts`、DESIGN_SPEC §4c.1

## 背景

聊天页助手消息呈「卡片割裂」：
- 气泡卡片（assistantBubbleBackground 浅蓝）与下方 footer 按钮行（朗读 ▶ / 复制 / timing）**分离渲染**——footer 在 `renderBubbleContainer()` 之外（Message.tsx），悬浮在卡片下方。
- CHAT_UI_SPEC §2 图示为「footer 在文本卡片内部」——**实现落后于规范**。
- 同时灰色治理问题：surfaceVariant 被 5+ 处功能共用（模型 chip/状态条/横幅/编辑栏/问候卡），用户气泡 #f2f2f2 同灰阶 → 一片灰。

## 决策

1. **气泡一体化**：footer（朗读 ▶ / 复制 / timing）收进气泡卡片内——同底色（assistantBubbleBackground）、底部 padding s(8)，height 24 保持；朗读/复制 icon 用 onSurfaceVariant（灰降级为文字级），timing 数字 brandAccent 不变（对齐 CHAT_UI_SPEC §2 定稿图示）。
2. **灰色分层落地**（DESIGN_SPEC §1.8 一灰一职）：模型 chip → 域彩 12% 底；SessionStatusBar → surface + hairline 分隔；编辑栏 → surface + 边框；softCapBanner 保留信息带职责（surfaceVariant 唯一保留位）；用户气泡保持 authorBubbleBackground 并与 surfaceVariant 用途区隔。
3. **50+ 处原始 borderRadius 同波清除**（ImageMessage/FileMessage/GreetingBubble/LoadingBubble/HtmlPreviewBubble/ChatView 等 → radius[shapeRoles.*]），随 CHAT_UI_SPEC v2 定稿同波执行。
4. **执行载体**：DESIGN_SPEC §8 Gap Ledger B1 批次（前置 = 本文档 + DESIGN_SPEC v3 已就绪）。

## 备选方案

| 方案 | 结论 |
| --- | --- |
| footer 保持卡片外（现状） | 割裂感持续；与 CHAT_UI_SPEC §2 矛盾；弃 |
| footer 半透明浮层叠卡片 | 性能与深浅模式复杂度上升；弃 |
| 只改 footer 不动灰色 | 割裂修一半，灰仍泛滥；弃（同波治理） |

## 影响

- 组件：Message.tsx（footer 移入 contentContainer）、AssistantTurnFooter/styles.ts（卡片内间距）、Bubble/styles.ts、ChatHeader/SessionStatusBar/ChatInput（灰色 token 换血）。
- 风险：聊天域为既有定稿 SPEC 管辖，改动须 CHAT_UI_SPEC v2 升版 + 深浅双模式零视觉回归走查。
- 性能：纯样式改动，无新增动画/订阅面（G1-G5 不受影响）。

## 验证

- CHAT_UI_SPEC v2 升版记录；五关门禁（tsc/jest/Gradle/装机/性能）全绿；真机浅/深双模式截图走查：footer 在卡片内、灰阶一灰一职。
