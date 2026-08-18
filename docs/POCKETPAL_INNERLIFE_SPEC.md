---
doc_id: POCKETPAL_INNERLIFE_SPEC
module: root
type: spec
status: active
version: "1.0"
created: "2026-08-18"
updated: "2026-08-18"
relates: [POCKETPAL_PLAY_SPEC, POCKETPAL_PRODUCT_SPEC, POCKETPAL_STARMAP_DOMAINS]
---

<!-- D-FORMAT:v3 -->

# 内心生活 · 玩法 SPEC（INNERLIFE_SPEC）

**状态**：active | **版本**：1.0 | **更新**：2026-08-18

> **定位**：让写作模型从「应答工具」升格为「有内心生活的伙伴」——开场白不再模板化，
> 收尾时写自己的日记、给明天的自己留话。数字生命玩具的第二层：活着的质感。
> **配套**：仪式四件套在 `src/services/aiosMemory/rituals.ts`；收尾时机 = 当日对话满阈值。

## 一、定位与边界

- **负责**：
  - **晨间独白**：收尾仪式预写「明日开场独白」（女妖口吻 1-2 句，基于今日小结+情绪），次日首轮注入 system——开场白由模型现编，非规则模板
  - **小鸡日记**：收尾仪式写当日日记（女妖第一人称，记录今天与大王的事+感受），WorkspaceScreen 可浏览
  - 与既有收尾小结（memory/YYYY-MM-DD-closing.md）组成「收尾三件套」
- **不负责**（明确排除）：
  - 不做独立日记编辑页（复用 Workspace 编辑器，锋利不臃肿）
  - 不做情绪数值养成系统（M7 情绪规则版保持现状，score 仅服务状态展示）
  - 不做定时任务/通知推送（收尾三件套纯事件驱动，无新调度）
- **上下游**：读 trackSentiment（sentiment.json）/ compaction（昨日摘要）→ 写 opening/ + chick_diary/ → 消费 buildTodayState 注入 / WorkspaceScreen 浏览

## 二、核心原则 / 公理

1. **收尾即预写**：晨间独白在收尾时预写明日文件——「睡前写信给明天的自己」；次日开场零延迟注入（无同步生成阻塞首轮回复）。
2. **文件即过期**：独白按日期文件名（opening/YYYY-MM-DD.md）天然轮转——没写就没有，无需删除逻辑、无缓存失效。
3. **无兜底无补丁**：收尾引擎不在（inferencing/无 engine）→ 三件套整体跳过（现状小结 guard 语义）；独白缺失 → 开场回退规则版「今日状态」（现状行为）。显式状态，不静默补救。
4. **写作模型强化**：三件套全部用收尾时机已加载的聊天大模型（modelStore.engine）生成——收尾即写作模型主场。
5. **事件驱动零新增调度**：全部挂在 maybeClosingSummary 既有触发点（当日满阈值一次），无定时器。

## 三、架构概要

```
当日对话 ≥15 轮（maybeClosingSummary 触发，收尾三件套）：
  ① 今日小结（既有）：memory/YYYY-MM-DD-closing.md
  ② 明日晨间独白（新）：opening/明日.md —— 「大王，昨晚我梦到……」
  ③ 当日小鸡日记（新）：chick_diary/今日.md —— 「今天和大王聊了……」
        ↓ 次日首轮
buildTodayState：读 opening/今日.md → 存在则注入【女妖晨间独白】
        ↓ 任意时刻
WorkspaceScreen「小鸡日记」区块：chick_diary/ 列表 → 查看/编辑
```

## 四、状态模型

| 维度 | 说明 |
|------|------|
| 输入 | 收尾时机：当日对话轮数 ≥ CLOSING_THRESHOLD(15) 且引擎可用 |
| 输出 | 小结（既有）+ 明日独白 + 当日日记 |
| 持久状态 | `workspace/opening/YYYY-MM-DD.md`（独白，按日轮转）；`workspace/chick_diary/YYYY-MM-DD.md`（日记，可浏览） |
| 事件 / 日志 | console.log 收尾落盘路径（既有模式） |

## 五、契约

- **paths.ts**：`AIOS_OPENING_DIR`（workspace/opening/）+ `AIOS_DIARY_DIR`（workspace/chick_diary/）入 ensureAiosDirs。
- **rituals.maybeClosingSummary**：小结生成成功后，追加生成明日独白（n_predict≈80，temperature 0.8）与当日日记（n_predict≈250，temperature 0.8）；任一失败独立跳过（try/catch 各自隔离）。
- **rituals.buildTodayState**：读 `opening/今日.md`，存在则注入「【女妖晨间独白】{content}」并替换规则版问候句；不存在保持现状。
- **rituals.listDiaries / readDiary**：chick_diary/ 日期倒序列表 + 读取，供 WorkspaceScreen。
- **WorkspaceScreen**：文件列表下新增「小鸡日记」区块（section 标题 + 日期行），点击查看（复用编辑器，可编辑可导出）。

## 六、健康指标

| 指标 | 阈值 / 说明 |
|------|-------------|
| tsc | 零错误 |
| jest | rituals 三件套用例全绿（独白注入/日记落盘/文件轮转） |
| 真机验收 | 连续两天：首轮开场含昨日收尾预写的独白；Workspace 可见日记；重启后独白仍生效 |

## 七、Gap Ledger

| Gap ID | 现象 | 补齐路径 |
|--------|------|----------|
| INNER-1 | 收尾三件套跑 3 次 completion（~500 tokens），1B 级设备耗时 | 收尾本身 fire-and-forget 异步，不阻塞主链；若真机实测过慢，独白可降级为规则版+情绪拼装 |
| INNER-2 | 日记无封面/无配图 | 波次 3 记忆绘本（周度故事 + DreamLite 插画）对接 chick_diary 素材 |

## 八、关联

- **同层子系统**：memory（aiosMemory 仪式）、workspace（WorkspaceScreen 浏览）、chat（useChatSession 收尾钩子）
- **相关 ADR**：无（玩法层，不涉架构决策）
- **操作手册 (SOP)**：UI_GATE_VERIFICATION_SOP（验证门禁沿用）

## 变更日志

| 日期 | 版本 | 变更 |
|------|------|------|
| 2026-08-18 | 1.0 | 首发：收尾三件套（小结+晨间独白+小鸡日记）+ Workspace 浏览 |

## 关联文档

- [玩具工坊玩法](./POCKETPAL_PLAY_SPEC.md)（spec，波次 1）
- [产品路线图（P 系列）](./POCKETPAL_PRODUCT_SPEC.md)（positioning）
- [星图域清单](./POCKETPAL_STARMAP_DOMAINS.md)（spec）
