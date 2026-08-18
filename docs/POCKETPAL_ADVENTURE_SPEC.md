---
doc_id: POCKETPAL_ADVENTURE_SPEC
module: root
type: spec
status: active
version: "1.0"
created: "2026-08-18"
updated: "2026-08-18"
relates: [POCKETPAL_SCREENWATCH_SPEC, POCKETPAL_PLAY_SPEC, POCKETPAL_PRODUCT_SPEC]
---

<!-- D-FORMAT:v3 -->

# TRPG 城主 · 玩法 SPEC（ADVENTURE_SPEC）

**状态**：active | **版本**：1.0 | **更新**：2026-08-18

> **定位**：文字冒险——聊天即冒险。写作模型当「城主」（写剧情），`adventure_state` 工具管状态
> （HP/位置/背包 JSON 落盘），模型自主维护冒险世界。数字生命玩具的第五层：一起闯关。
> **配套**：复用 AgentRunner 工具循环（maxTurns=5）+ toyChest 同款落盘模式。

## 一、定位与边界

- **负责**：
  - **adventure 任务路由**：聊天内「来场冒险/开个副本/当城主」→ 选型写作模型（write 指纹）→ 城主开场
  - **adventure_state 工具**：get（读当前状态）/ set（合并更新）/ reset（新冒险清档）——状态 `workspace/adventure/state.json`
  - **城主叙事**：systemPromptFragment 引导模型写剧情 + 自主维护状态（角色卡模板/事件/判定）
- **不负责**（明确排除）：
  - **不做模型剧团**：多 context 接力辩论（内存账本 ≈7GB 超 12GB 设备安全线 + 换模耗时长）——继续观望，防臃肿闸门
  - 不做复杂规则引擎（D&D 判定表/战斗计算）——判定由模型叙事 + 骰子工具化简化（状态即规则）
  - 不做地图/道具系统 UI（纯文本冒险，锋利不臃肿）
- **上下游**：taskRouter（adventure 意图）→ useChatScheduler（选型）→ AdventureStateEngine（工具循环）→ AgentRunner 消费

## 二、核心原则 / 公理

1. **状态即规则**：冒险状态（HP/位置/背包/事件）由模型通过 `adventure_state.set` 自主维护，JS 层零业务逻辑只存取——模型是城主，代码是纸笔。
2. **文件即存档**：`workspace/adventure/state.json` 每次 set 落盘——重启/换会话冒险不丢（共享存储）。
3. **城主专用模型**：adventure 选型复用 write 指纹（Qwen3.5-2B/4B，写作剧情）——城主是写作模型的主场。
4. **无兜底无补丁**：状态文件缺失（未开档）→ get 返回显式「尚未开档」；reset 后剧情从零开始；工具失败显式报错。
5. **零新引擎**：不加载任何新模型/新原生——纯 talent + 落盘，内存账本不动。

## 三、架构概要

```
「来场冒险」→ taskRouter: adventure 意图
   → useChatScheduler: resolveTaskModel('write' 指纹) → 加载写作模型
   → 城主开场（systemPromptFragment：角色卡模板 + 状态维护规则）
   → AgentRunner 工具循环：
      模型写剧情 → adventure_state.set({hp:-1, 位置:...}) → 状态落盘
      下一轮 → adventure_state.get() → 剧情延续
   → workspace/adventure/state.json（共享存储，冒险存档）
```

## 四、状态模型

| 维度 | 说明 |
|------|------|
| 输入 | 「来场冒险 / 开个副本 / 当城主 / 冒险」等意图；冒险中任意自然语言动作 |
| 输出 | 城主剧情文本 + 状态 JSON 落盘 |
| 持久状态 | `workspace/adventure/state.json`（{hp, 位置, 背包[], 事件计数, ...}，模型自由扩展） |
| 事件 / 日志 | ToolScreen 调用历史记录 adventure_state 条目 |

## 五、契约

- **taskRouter**：`TaskKind` 增 `'adventure'`；ADVENTURE_RE 自然语言（来场冒险/开个副本/当城主/冒险模式/一起冒险）→ `{task:'adventure', payload}`。
- **useChatScheduler**：`signal.task === 'adventure'` → `resolveTaskModel('write', text)`（城主=写作模型，弹窗「写作」叙事沿用）→ handleSendPress。
- **AdventureStateEngine（talent `adventure_state`）**：
  - `{action:'get'}` → `{ok, state}`；未开档 → `{ok:false, error:'尚未开档，请先让城主开启冒险'}`
  - `{action:'set', state:{...}}` → 合并写 state.json（模型维护，不校验 schema——状态即规则）
  - `{action:'reset'}` → 删除 state.json（新冒险清档）
  - 上限 20KB（防膨胀）
- **注册**：talents/index.ts `registerDefaultTalents` + 女妖 pact.talents 增 `adventure_state`。
- **systemPromptFragment**：城主引导——写剧情、自主用 adventure_state 维护 HP/位置/背包、判定用骰子叙事（1d20 口语化）、冒险结束自动 reset。
- **paths.ts**：`AIOS_ADVENTURE_DIR`（workspace/adventure/）入 ensureAiosDirs。

## 六、健康指标

| 指标 | 阈值 / 说明 |
|------|-------------|
| tsc | 零错误 |
| jest | AdventureStateEngine 用例全绿（get/set/reset/未开档/上限）+ taskRouter adventure 用例 |
| 真机验收 | 「来场冒险」→ 城主开场 → 行动后状态落盘 → 重启后冒险可继续 |

## 七、Gap Ledger

| Gap ID | 现象 | 补齐路径 |
|--------|------|----------|
| ADV-1 | 模型剧团（多模型辩论）未实现 | 内存账本（双大模型 ≈7GB 超安全线）+ 换模耗时——观望；若后续上 16GB+ 设备再评估 |
| ADV-2 | 1B 级设备城主剧情质量未知 | 真机验收定级；质量不达标则冒险走管家轻量版（短剧情） |

## 八、关联

- **同层子系统**：chat（taskRouter/useChatScheduler）、tools（talent 注册/ToolScreen）、pals（女妖 pact）
- **相关 ADR**：无（玩法层）
- **操作手册 (SOP)**：UI_GATE_VERIFICATION_SOP（验证门禁沿用）

## 变更日志

| 日期 | 版本 | 变更 |
|------|------|------|
| 2026-08-18 | 1.0 | 首发：adventure 路由 + adventure_state 工具化状态管理 + 城主叙事 |

## 关联文档

- [读屏围观玩法](./POCKETPAL_SCREENWATCH_SPEC.md)（spec，波次 4）
- [玩具工坊玩法](./POCKETPAL_PLAY_SPEC.md)（spec，波次 1）
- [产品路线图（P 系列）](./POCKETPAL_PRODUCT_SPEC.md)（positioning）
