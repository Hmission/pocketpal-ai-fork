---
doc_id: POCKETPAL_CONTEXT_COMPACTION_SPEC
module: root
type: spec
status: active
version: "1.0"
created: "2026-08-19"
updated: "2026-08-19"
relates: [POCKETPAL_CHAT_UI_SPEC, POCKETPAL_MODEL_MATRIX, POCKETPAL_DESIGN_SPEC]
---

<!-- D-FORMAT:v3 -->

# 上下文压缩机制 · SPEC（CONTEXT_COMPACTION_SPEC）

**状态**：active | **版本**：1.0 | **更新**：2026-08-19

> **定位**：本地模型聊天页的上下文治理机制——发送前预算驱动，扩窗优先（内存允许）、
> 压缩兜底（已到天花板），人机协作、选择记忆（per-model 持久化），全链路可管可控可见。
> **行业对齐**：Claude Code auto-compact（80% 容量触发、摘要替换旧消息、最近保留）、
> Codex CLI（per-model 阈值、压缩独立于 LLM 提供商）、OpenCode（非破坏性隐藏）。
> **本地化差异**：扩窗有设备内存成本（KV cache 线性增长，K90/小米 13 实证 OOM 风险），
> 因此扩窗可行性由内存审计单事实源（hasModelUpgradeFitting）判定，到天花板自动转压缩。

## 一、决策机（单状态机，发送前预算驱动）

```
发送前组装预算估算（system + 召回 + 消息 ≈ used）
├─ used < 0.8×n_ctx（WARNING_THRESHOLD，与 banner 同源）→ 正常发送
└─ used ≥ 0.8×n_ctx → 查策略（per-model 持久化，默认 'ask'）：
     ├─ 'expand'：尝试阶梯上一档扩窗（PSS 审计）→ 成功则扩窗；
     │            已到最大档/审计失败 → 自动转压缩（提示条可见）
     ├─ 'compact'：直接压缩最旧消息（发送前无感，snackbar 提示）
     └─ 'ask'：可扩 → 照发（banner CTA 提供选择并记住）；已到天花板 → 直接压缩
```

- **本地模型专属**：REMOTE 模型不压缩（上下文由服务器控制，走既有 context-remote-hedged 分支）。
- **压缩失败不兜底**：走既有 banner 链路（增窗/新会话），不新增隐藏路径。
- **策略记忆**：banner CTA 即选择入口——点「增大上下文」记 `expand`、点「压缩旧消息」记 `compact`；
  生成设置页可改（含恢复 `ask`）。persist 持久化（ModelStore.perModelContextPolicy）。

## 二、压缩执行（摘要压缩 Summarize-and-Compact）

1. **选区间**：最旧未压缩消息起，预算缺口（目标释放至 70%）驱动条数，单次 ≤20 条，保护最近 4 条（≈2 轮）。
2. **摘要生成**：当前对话模型（复用 extractAndSaveMemories 引擎选择模式，独立摘要 prompt，
   ≤400 字、温度 0.3、n_predict 220）；多次压缩 = 已有摘要 + 中间消息增量重压（单锚点模型）。
3. **落盘三处**：
   - 会话内：被压消息 `metadata.compacted = true`（原文保留，非破坏性）；
     锚点（首条被压消息）`metadata.compaction = {summary, messageIds, count, ts}`。
   - prompt 组装：被压消息按 id 集合过滤出 messages；摘要作 system fragment 注入
     （`【本会话已压缩的早期对话】`，与召回层同路，不破坏角色交替）。
   - 当日 conversations/ 日志 append 摘要记录（appendConversation），供 searchMemory 跨会话召回。
4. **不主动沉淀记忆库 episode**：已有 extractAndSaveMemories + compaction 当日摘要覆盖，避免机制重复。

## 三、可管可控可见

| 维度 | 载体 |
|---|---|
| 可见 | 锚点压缩占位卡片（CompactedBlock：折叠「已压缩 N 条早期对话」/展开摘要）；压缩 snackbar（lastCompaction 消费）；turnMetrics 上下文余量 |
| 可控 | banner CTA（增大/压缩/新聊天）+ 策略记忆；生成设置页「上下文策略」三选（扩充/压缩/每次询问） |
| 可管 | 压缩事件入 DRC 事件流（chat.context_compacted）；lastCompaction store 字段；失败不静默（走既有 banner） |

## 四、契约与关键文件

| 文件 | 职责 |
|---|---|
| `src/services/contextCompaction/decision.ts` | 决策机纯函数（used/nCtx/canExpand/policy → send/expand/compact/ask） |
| `src/services/contextCompaction/budget.ts` | 预算估算（estimateMessageTokens 轻量 + ctx.tokenize 精确双轨） |
| `src/services/contextCompaction/summarizer.ts` | 结构化摘要生成（引擎注入 + 增量 priorSummary） |
| `src/services/contextCompaction/index.ts` | 编排 compressSession + 一站式 compactSessionAndMark（标记+lastCompaction） |
| `src/hooks/useChatSession.ts` | prepareCompletion 发送前治理接线（决策→压缩→重建 messages） |
| `src/store/ModelStore.ts` | perModelContextPolicy 持久化 + get/set |
| `src/store/ChatSessionStore.ts` | lastCompaction 可观察字段 |
| `src/components/ChatView/BannerRow.tsx` | 压缩 CTA（本地模型专属） |
| `src/components/ChatView/CompactedBlock.tsx` | 锚点占位卡片 |
| `src/components/IncreaseContextSheet/fitStatus.ts` | hasModelUpgradeFitting（扩窗可行性单事实源，ChatView 与 hook 共用） |
| `src/screens/GenerationSettingsScreen/` | 上下文策略设置段 |

消息元数据契约（`MessageType.CompactionMeta`）：锚点 `metadata.compaction`；被压 `metadata.compacted`。

## 五、明确不做（锋利边界）

- 不做 native KV cache 压缩（llama.rn 未暴露，成本高收益低）。
- 不做 token 级剪枝（LLMLingua 式，端侧质量不可控）。
- 不做压缩失败兜底链（失败即走既有 banner 增窗/新会话）。
- 不主动沉淀压缩摘要进记忆库 episode（既有提取/当日摘要覆盖）。
- 不压缩最近 2 轮与 REMOTE 会话。
