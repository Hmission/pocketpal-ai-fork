---
doc_id: POCKETPAL_CONTEXT_COMPACTION_SPEC
module: root
type: spec
status: active
version: "1.2"
created: "2026-08-19"
updated: "2026-08-26"
relates: [POCKETPAL_CHAT_UI_SPEC, POCKETPAL_MODEL_MATRIX, POCKETPAL_DESIGN_SPEC]
---

<!-- D-FORMAT:v3 -->

# 上下文压缩机制 · SPEC（CONTEXT_COMPACTION_SPEC）

**状态**：active | **版本**：1.2 | **更新**：2026-08-26

> **定位**：本地模型聊天页的上下文治理机制——发送前预算驱动，扩窗优先（内存允许）、
> 压缩兜底（已到天花板），人机协作、选择记忆（per-model 持久化），全链路可管可控可见。
> **行业对齐**：Claude Code auto-compact（80% 容量触发、**压到约 50% 低位一次顶很久**、
> 摘要替换旧消息、最近保留）、Codex CLI（per-model 阈值、压缩独立于 LLM 提供商）、
> OpenCode（非破坏性隐藏）。核心共识：触发 75-85% → **目标 40-60%**——压缩次数 ≈
> 摘要重写次数，重写越多信息损耗越大，小额滚动压缩 = 碎片化（v1.2 修正）。
> **本地化差异**：扩窗有设备内存成本（KV cache 线性增长，K90/小米 13 实证 OOM 风险），
> 因此扩窗可行性由内存审计单事实源（hasModelUpgradeFitting）判定，到天花板自动转压缩。

## 一、决策机（单状态机，发送前预算驱动）

```
发送前水位 = max(字符估算, 上轮 native 实测 used)（B19.1 双源归一）
├─ 水位 + 生成预留(512) < 0.8×n_ctx（WARNING_THRESHOLD，与 banner 同源）→ 正常发送
├─ 上轮实测 contextFull 且水位仍满 → 跳过压缩直接照发（B19.1 满态显式失败：
│    摘要与主生成都会立即硬错，走既有错误链路 + context-full banner，用户主权）
└─ 水位 + 预留 ≥ 0.8×n_ctx → 查策略（per-model 持久化，默认 'ask'）：
     ├─ 'expand'：尝试阶梯上一档扩窗（PSS 审计）→ 成功则扩窗；
     │            已到最大档/审计失败 → 自动转压缩（提示条可见）
     ├─ 'compact'：直接压缩最旧消息（发送前无感，snackbar 提示）
     └─ 'ask'：可扩 → 照发（banner CTA 提供选择并记住）；已到天花板 → 直接压缩
```

- **B19.1 水位实测校准**：字符估算对英文/markdown/符号系统性低估（真机实证
  banner 81% 时压缩从未触发），消费上一轮 native 实测水位
  （tokens_evaluated + tokens_predicted，lastCompletionResult.used）钉底取大者。
- **B19.1 生成预留**：触发线含本轮生成预算（GENERATION_RESERVE=512，与默认
  n_predict 同阶）——触发时必然剩余工作空间，单轮无法从阈值下直接跳满；
  banner ratio 不含预留（用户视角真实占用），提醒与动作共存自洽。
- **本地模型专属**：REMOTE 模型不压缩（上下文由服务器控制，走既有 context-remote-hedged 分支）。
- **压缩失败不兜底**：走既有 banner 链路（增窗/新会话），不新增隐藏路径。
- **策略记忆**：banner CTA 即选择入口——点「增大上下文」记 `expand`、点「压缩旧消息」记 `compact`；
  生成设置页可改（含恢复 `ask`）。persist 持久化（ModelStore.perModelContextPolicy）。

## 二、压缩执行（摘要压缩 Summarize-and-Compact）

1. **选区间**：最旧未压缩消息起，预算缺口（目标释放至半水位 50%：
   `targetReleaseTokens = used − n_ctx×COMPACT_TARGET_WATERMARK(0.5)`）驱动条数；
   触发 80% → 压到 50% = 一次释放 ~30% 容量（16K 下 ≈4.8K token ≈ 10+ 轮对话），
   压缩频率与摘要重写次数降 3-4 倍（v1.2：旧 70% 目标线致「每次只压一两轮」
   小额滚动、摘要碎片化叠加损耗）；旧版「预算缺口突破单次 ≤20 条上限」随
   目标线重算自然淘汰（大块语义由水位驱动，条数上限不再必要）。保护最近 4 条（≈2 轮）；
   **B19.1 释放量校验**：保护区外全部压完仍不达预算缺口 → 诚实返回 null
   （剩余消息自身超预算，如保护区巨型消息），避免「压缩了但预算仍超」的静默失效。
2. **摘要生成**：当前对话模型（复用 extractAndSaveMemories 引擎选择模式，独立摘要 prompt，
   ≤400 字、温度 0.3、n_predict 220）；多次压缩 = 已有摘要 + 中间消息增量重压（单锚点模型）。
   **B19.1 摘要工作集预算化**：输入按 min(12000, n_ctx−400 token) 1:1 保守折算裁剪
   （v1.2：上限 6000→12000，随 n_ctx 上探——16K 档一次吃下「压到 50%」的 slice，
   否则 slice 被输入预算裁剪回小额，压缩大块化落空；小 n_ctx 自动收窄不变）；
   llama.rn ctx_shift 默认 false，prompt ≥ n_ctx 直接硬错，容量约束前置，不靠运行时报错回退。
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
- 不启用 llama.rn ctx_shift（截断不可预测，违背可见性）。
- 不做满态自动换引擎压缩（B19.1 大王裁定：换模型不是正道；满态走用户主权显式路径）。
- 不做错误字符串匹配式运行时回退（脆弱且掩盖根因，容量约束前置）。

## 六、v1.2 变更记录（2026-08-26，大王裁定「探索上限」+ 「每次只压两轮」复发治理）

背景：策展表按 8-9GB 设备可用内存重排后（见 CHAT_UI_SPEC §18.6 v3.8），16K+
档位成为常态；旧目标线 70% 在 16K 下每次只释放 ~10% 容量（≈一两轮对话），
压缩变成高频小额滚动——每 2-4 轮触发一次 LLM 摘要、priorSummary 增量退化为
整段重写、摘要信息逐次损耗。行业对照（Claude Code auto-compact / LangChain
SummaryBufferMemory）均为「触发 80% → 压到 40-60%」。

根治三项：
1. 目标线 70% → **COMPACT_TARGET_WATERMARK=0.5**（一次性压到半水位，一次顶 10+ 轮）；
2. 摘要输入预算 6000 → **12000 上限随 nCtx 收缩**（大块 slice 完整进摘要）；
3. 新增 **TOOL_BASELINE_TOKENS=4500** 常量（工具 schema 注入后提示词基线，从
   注释沉底为代码）——策展门禁断言每档 nCtx ≥ 工具基线 + 2 轮对话 + 生成预留。

**真机验证（2026-08-26 K90，MASTER_LOG §96.5）**：策展档 4B 生效 n_ctx=16384
（原生层加载日志铁证）；16K f16 KV 加载 PSS 4.15GB / 推理后 4.74GB 全程存活；
5275 tokens prefill（占 32%）后余量 ≈ 20+ 轮短对话才触 0.8 压缩线——大上下文 + 大块化
压缩的组合在多轮场景下压缩频率显著下降；多轮逐轮实测成本过高转观察项。

## 七、B19.1 变更记录（2026-08-20，真机血证链路根治）

小米 13 DRC 实证：决策 compact 正确触发但压缩执行死锁（摘要请求与主生成
双硬错「Context is full」）。6D 排查定位三条缝隙合流——估算与实测脱节（D5）、
无生成预留可单轮跳满（D4）、摘要工作集无预算可自身溢出（D3）。根治四项：
水位双源校准（resolveWatermark）+ 生成预留（GENERATION_RESERVE）+ 摘要
工作集预算化（tokenBudgetToMaxChars）+ 满态显式失败（饱和跳过，不静默不换引擎）。
