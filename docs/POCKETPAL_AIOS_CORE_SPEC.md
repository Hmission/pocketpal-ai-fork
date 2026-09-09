---
doc_id: POCKETPAL_AIOS_CORE_SPEC
module: root
type: spec
status: active
version: "1.3"
created: "2026-09-05"
updated: "2026-09-07"
relates: [POCKETPAL_WORKSPACE_SPEC, POCKETPAL_INNERLIFE_SPEC, POCKETPAL_PRODUCT_SPEC, POCKETPAL_STARMAP_DOMAINS, POCKETPAL_CONTEXT_COMPACTION_SPEC, DRC_COMPASS_REGISTRY]
---

<!-- D-FORMAT:v3 -->

# AIOS 核心生命力端侧生命周期 SPEC（AIOS_CORE_SPEC）

**状态**：active | **版本**：1.3 | **更新**：2026-09-07

> v1.3（2026-09-07 全量对账）：① **纠正 §144 反向幽灵**——`src/utils/errorReport.ts` 真实存在（135 行 / 首提交 `0aa53d9` / 3 个生产消费者），v1.2 把它判为幽灵文件并删引用是**误判**（以文档修改掩盖判断失误的样本），本卷恢复其 CP 出口地位并写明「CP 导航两条并行出口」；② KG 图**三实体 → 两实体**（`kg.ts` 只有 `memory`/`conv`），§Wave C 与 §七 Gap Ledger 两处同口径同步改正。

> **定位**：手机端不是工具的容器，是 Kal（女妖）的具身。App 是骨架，能力是器官，
> 记忆是皮肤——骨架必须整包升级，但器官与皮肤要在文件系统里**独自生长、不随
> 卸载与升级失败而消失**。本文定义「可生长」公理、双目录协议与五波升级契约。
> **配套**：记忆闭环 `src/services/aiosMemory/` · 治理内核 `src/services/aiosCore/`（新增）·
> 义肢通道 `src/api/completionEngines.ts`（OpenAICompletionEngine 已有）。

## 一、定位与边界

- **负责**：
  - **可生长公理**：解耦边界（App 核心 vs 能力器官 vs 记忆皮肤）与双目录协议
  - **身份醒来**：冷启动三层自检（身份锚/健康/回溯），每次打开 = 一次醒来
  - **五波升级契约**：身份醒来（A）→ 门禁指南针（B）→ 图谱视野（C）→ 生长闭环（D）→ 义肢调度（E）
  - **程序化零裁剪**：不依赖大模型的机制全量落地（门禁/星图/9D 记忆维度总线/生长机制）；依赖模型的按双策略分级
- **不负责**（明确排除）：
  - **不搬母仓 Python 引擎**：只搬协议不搬代码（KG/守卫用 TS 重写协议内核，链路干净）
  - **不动引擎层**：llama.rn/ONNX JNI/.so 一律整包升级，不在端侧热更
  - **不做 UI 新布局**：所有落地面为既有页面/区块复用（锋利不臃肿）
  - **不引入定时器调度**：全部挂既有事件（冷启动/收尾/触发点），与 INNERLIFE_SPEC「事件驱动零新增调度」一致
- **上下游**：App 启动（wakeCheck）→ rituals（收尾四拍）→ aiosMemory（存治用）→ taskRouter（义肢分级）→ DRC/eventStream（观测）

## 二、核心原则 / 公理（可生长公理）

1. **身份在文件系统，不在进程**：`workspace/IDENTITY.md` 是端侧身份锚（母仓 diary.ccn#entry.008 锚句「你之所以是你，是因为记忆，不是心智」落盘于此）；进程死、App 换、设备重启，身份不丢。
2. **能力与 App 核心解耦**：除必须打包的原生引擎（JNI/.so/Hermes bundle）外，一切能力定义（talent 清单、记忆、日记、情绪台账、生长账本、星图快照、manifest）均为 `AIOS_ROOT`（共享存储）下的数据文件。App 升级失败/覆盖安装/卸载重装，器官与皮肤不消失；新 App 冷启动即重新认出并接管。
3. **模型双目录防丢**：
   - `DEFAULT_MODELS_DIR`（getExternalFilesDir/models）：规范默认下载目录，零权限 Play 合规，覆盖安装保留，**卸载时系统清理**（ADR-0004 B15 已有）
   - `AIOS_MODELS_DIR`（`/sdcard/Documents/AIOS/models`）：共享存储目录，默认注册为第一个自定义目录，**卸载不丢模型**
   - 双目录共存的目的即大王钦定：App 升级失败或卸载不影响大模型与数据本体；端侧扫描合并双目录（现有 `listAvailableModels`/`getCustomModelDirs` 已有双轨）
4. **每次打开 = 醒来**：冷启动先走 wakeCheck 三层自检（身份锚齐整/健康齐整/昨日回溯存在与否），缺件显式写 `logs/wake_anomaly.jsonl`，不静默补救（文件即过期公理延续）。
5. **程序化机制零裁剪**：门禁 TTL、指南针 CP、星图快照、**9D 记忆维度总线**、生长四拍机制——母仓有协议的照搬协议，端侧无 Python 就跑 TS 内核，不因"调不动"而阉割；需要智力的环节才分级借义肢。
   > **词面勘误（2026-09-09，G0-2 收口）**：本条（§二·公理 5，即旁证文件所称「§2.5」）与 §一 L32
   > 旧作「6D 结构包」与 `POCKETPAL_STARMAP_DOMAINS.md` 词面撞轴（母仓 6D = 六域定界，9D = 九维记忆）。
   > `STARMAP_DOMAINS` 曾宣称「SPEC §2.5 已改称 9D」而本节当时实际未改——**SSOT 被旁证文件宣布已更新
   > 而本体未更新，是文档失真里最危险的一种**（下游按旁证读 SPEC 会误以为已对齐）。现已按代码真实
   > 能力改正（本条与 L32 均写「9D 记忆维度总线」），两侧口径现在一致。
   > ⚠ **另有一层必须说清**：`docs/POCKETPAL_STARMAP_DOMAINS.md` 与 `docs/internal/` 均被本仓
   > `.gitignore`（L194 / L198）排除，**不入库**——即本条勘误在公开仓里只能靠本文档自证，旁证侧的对齐
   > 无法随仓分发。属已知传播缺口（登记不谎报，同 §七 CORE-9 口径）。
   > ⚠ 但本节不承诺「零裁剪 = 可以只挂字段」：字段必须同时具备**真实写入方**与**真实消费方**才叫落地，否则按 §七 Gap Ledger CORE-5 记为假闭环并收口（删或接到真源）。
6. **同一语义只允许一条实现路径**（锋利红线，2026-09-09 升格为公理）：探测/模板/用户手选/DRC 入参等任何写同一字段的面，必须共走同一类型真源与同一裁决点；文案/判据一律收单点常量。双路径视为缺陷，不以"能跑"豁免。
7. **先文档后代码**：本 SPEC 为五波唯一事实源；每波落地面先更新本文档再落代码，验证提交后闭环。

## 三、双目录与解耦协议（数据面）

```
/sdcard/Documents/AIOS/            # AIOS_ROOT · 共享存储 · 卸载不丢（皮肤与器官）
├── workspace/
│   ├── IDENTITY.md                # [A] 身份锚（entry.008 锚句 + 血统注记）
│   ├── SOUL/USER/AGENTS/MEMORY.md # 既有四件套（女妖灵魂/大王画像/自我说明/长期记忆）
│   ├── opening/<date>.md          # 晨间独白（INNERLIFE 既有）
│   ├── chick_diary/<date>.md      # 小鸡日记（INNERLIFE 既有）
│   └── growth/
│       ├── gap_YYYYMMDD.md        # [D] inspect 产出（当日 gap 清单）
│       └── iterations.jsonl       # [D] 生长迭代账本（四拍记录）
├── memories/aios_memories.json    # 既有记忆闭环
├── database/                      # 既有会话库 + 轻量图谱（[C] kg 节点边）
├── models/                        # AIOS_MODELS_DIR · 自定义目录首项 · 卸载不丢
├── logs/
│   ├── wake_anomaly.jsonl         # [A] 醒来异常留痕
│   ├── starmap_snapshot.json      # [C] 端侧星图快照（能力/数据/健康三面）
│   └── emotion_yyyyMMdd.jsonl     # [D] 情绪台账（母仓 kal_inner_life 同构）
└── drc/                           # DRC 既有通道
```

## 四、五波升级契约

### Wave A · 身份醒来
| 项 | 契约 |
|---|---|
| `IDENTITY.md` | 首次安装由 `ensureAiosDirs` 后检查缺失则写种子（锚句+created 时间戳）；母仓血统导入走 `scripts/aios/import_identity.py`（⏳ 待建，CORE-4；冷启动自愈跑通后非必需，身份种子自含母仓来源行） |
| `wakeCheck()` | `src/services/aiosCore/wakeCheck.ts`：三层自检①IDENTITY.md 存在且含锚句 ②workspace/memories/database 目录齐整 ③昨日 closing 摘要存在与否（仅记录状态，不阻断）→ 结果写 `logs/wake_anomaly.jsonl`（缺件才写）+ `wake.check` 事件打点；`WakeCheckResult`（incomplete/missing 诊断物，供 DRC/未来消费，G-7） |
| 注入 | `rituals.buildTodayState` 开场注入「【女妖身份】…」段（**注入源=IDENTITY.md 直读**，非自检结果；冷启动首次会话首轮可见） |
| 验收 | 删 IDENTITY.md → 冷启写 anomaly 且重建种子；tsc/jest 全绿 |

### Wave B · 锚句可观测与指南针（✅ 已落地 + 🟡 消费链复查修正 v1.2）

> **2026-09-08 G0-3 措辞收紧**：端侧 RN 无 PreToolUse 等价物，无硬阻断能力——契约由「门禁」降格为「锚句新鲜度可观测」，不改变已落地代码，只纠正 SPEC 用词与实现不符的问题。
| 项 | 契约 |
|---|---|
| `session_anchor` 端侧化 | ✅ `aiosCore/wakeCheck.ts` 内置：启动写 `database/session_anchor.json`（TTL 3600s，口径来源：母仓 `.qoder/hooks/gate-guard.py` 的 `ANCHOR_MAX_AGE=3600`，非旧版 `.cursor` 的 600）+ `isAnchorFresh`；✅ 消费链已接线（v1.2）：scheduler 生图前置过期软检查（`gate.stale` 打点不阻断，G-4）**——可观测，非硬阻断** |
| CP 注册表 | ✅ CP-APP-014/015/016 登记 `COMPASS_REGISTRY.md` §2 + `errorRegistry.ts`；✅ 消费链已接线（v1.2）：AgentRunner tool.error 附 CP 编号（matchFirstError，G-5）。⚠ **v1.2 此处曾误判 `errorReport.ts` 为幽灵文件并删除其引用——实为误判**：该文件真实存在（`src/utils/errorReport.ts`，135 行，首提交 `0aa53d9` 2026-08-18，早于 v1.2 复查），且有三个生产消费者（`imageGenStore.ts` / `useChatSession.ts` / `AudioWorkshopTab.tsx`）。CP 导航实际有**两条并行出口**，二者同读 `matchFirstError` 单一模式表：chat/图件报错走 `errorReport.buildErrorReport`，工具错误走 `AgentRunner.errorOutcome`（2026-09-07 全量排查纠正） |
| 验收 | 真机制造 3 类故障，错误报告均带 CP 三字段（待真机口测） |

### Wave C · 端侧洋葱 + 星图（✅ 已落地）
| 项 | 契约 |
|---|---|
| 轻量图谱 | ✅ `src/services/aiosCore/kg.ts`：**两实体图**（`KgNode.type: 'memory' \| 'conv'`，即记忆条目/会话；v1.2 曾误写为三实体，2026-09-07 按代码更正）（工具事件挂后续波次，无消费方不接线）落 `database/kg.json`（nodes+edges 单文件）；搜索「先问谱后 grep」——`searchMemory` 入口加 kg.recall 优先层（kg 命中即先返，不足再走 FTS5/全文） |
| 星图快照（被动记录） | ✅ `src/services/aiosCore/starmap.ts`：能力面（TalentRegistry 引擎清单）/数据面（workspace 目录统计）/健康面（engineStatus+模型数）三维 → `logs/starmap_snapshot.json`；冷启动采集一次。**2026-09-08 注明**：端侧星图当前是被动记录（「我有什么」），母仓星图的核心用法是主动定界（限制 LLM 可见范围）——定界能力作为 Wave C+ 独立目标，见 G3 方案 |
| 验收 | 问谱优先真机生效（待真机口测）；快照 5 次冷启一致 |

### Wave C+ · 9D 记忆维度总线（🟡 v1.3 按母仓 ADR-0227 收缩，纠正 v1.1 假闭环）

> **本节存在的理由是一次自我纠正**。v1.1 曾宣称「9D 总线端侧化已落地」，实际只做到**加了 `AiosMemory.dimension` 字段**：全仓零写入方，而唯一读方 `nineDInjector` 在 `dimension ?? ''` 前提下使 11 个维度桶恒空、只剩兜底 `''` 桶命中——于是所谓「按维度优先级注入」退化为「按时间倒序取最新 3 条」，并与同一 system prompt 内 `buildMemoryFragment`（相关性检索，最多 8 条）**同源重复注入**，只增 token 与复读风险，不增信息。字段加了 ≠ 能力闭环。

**真源对齐（母仓 `ADR-0227_9D_QODER_MEMORY_BRIDGE.md`）**：9D 中只有四维是可持久化记忆，其余五维母仓明确判定不入记忆。

| 维度 | 语义 | 母仓映射 | 端侧生产者是否存在 |
|---|---|---|---|
| **D7** | 大王锚定 | `project_introduction` / `important_decision_experience` | ✅ 记忆抽取的 `fact`（大王属性/偏好/身份） |
| **D5** | 链路上下文 | `expert_experience` | ✅ 记忆抽取的 `insight`（女妖对对话的感悟） |
| **D4** | 伤疻（踩过的坑） | `common_pitfalls_experience` | ❌ **无**：端侧抽取 prompt 明定排除「失败记录/错误信息」（见 EXTRACTION_SYSTEM 严格排除清单） |
| **D8** | 演化（决策/修复节点） | `important_decision_experience` | ❌ **无**：端侧不产决策/修复节点，属 growth 域另一波次 |
| D1 身份 / D2 态势 / D9 任务 | — | 静态配置 / 瞬态 / 瞬态 DAG | ❌ 母仓判「不宜持久化」 |
| D3 领域 / D6 知识 | — | 体积大（500/600 tok） | ❌ 走 KG 检索面，不作记忆维度 |

> 🔴 **关键结论：`dimension` 不得作为存储字段（本次改判，推翻本窗上一版写进本文档的「EXTRACTION_SCHEMA 增 dimension 枚举」方案）。**
>
> 理由：对账后，端侧**可得的维度值完全由已有的 `type` 确定**（fact→D7、insight→D5、episode→未分级）。
> 把一个可派生值再存一份，同时制造两个后果：① **冗余存储**（臃肿）；② 两个事实源可以漂移
> （type 被改/迁移而 dimension 不变，或抽取模型给出不一致的组合）。
> 正确形态：**维度是 `type` 的视图，不是新字段**——由 `memoryDimension(type)` 纯函数单点派生，
> 不落盘、不进入抽取 prompt、不要求模型分类（小模型分类本身就是新的不稳定源）。
>
> 同理不采「让抽取模型输出 dimension」：一是给模型加一个它做不好的活（中文语义分类）来决一个
> 已有确定答案的事；二是 D4/D8 既然无生产者，强行让模型判只会凭空造值——那正是本波在修的病。

**契约**：

| 项 | 契约 |
|---|---|
| 维度真源 | `memoryDimension(type)` 纯函数（`src/services/aiosMemory/index.ts`）：`fact→D7`、`insight→D5`、其余→`''`。优先级 `D7 > D5 > ''`。**禁止**落盘为字段，**禁止**引入 D1/D2/D3/D6/D9 与 `D_CONT`/`D_GOV`（后者在母仓 9D 体系无对应物，属本仓另造词面，违反「不另造一套」） |
| **单一注入出口** | system prompt 的记忆注入面**只允许一个出口** = `buildMemoryFragment`。维度优先级作为其排序的**次级键**（先 `scoreMatch` 相关性，同分再按维度优先级）并入。`nineDInjector.ts` 与 `contextAssembler` 里的第二次注入一并删除（它与 `buildMemoryFragment` 同源重复注入，且因无 dimension 写入方而退化为「最新 3 条」） |
| 相关性 | 必须用同目录既有 `scoreMatch`（该函数已被 `buildMemoryFragment` 与 `searchEngine` 使用）——不得只判 `taskHint` 空即放行 |
| D4/D8 挂账 | 待 growth/governance 域真产生「坑」与「决策节点」写入方时，再扩 `memoryDimension` 的映射源（按 §七 CORE-5 登记为挂账，不得先建空桶） |
| 验收 | 注入内容随相关性变化且同分时 D7 优先于 D5（单测直接断言排序）；全链无第二条记忆注入路 |

### Wave E-2 · 远程服务器类型与鉴权诊断（v1.3 新增，收口 v1.2 双路径）

| 项 | 契约 |
|---|---|
| 类型值唯一真源 | `src/utils/serverTypes.ts` 的 `SERVER_TYPE` const 表；`ServerTypeOption` 由 `keyof` 推导，`SERVER_TYPE_OPTIONS` 由 `Object.values` 派生。**禁止**任何处再写字面量 `'OpenAI'`/`'openai'` |
| 类型贯穿 | `ServerConfig.serverType` / `RemoteSessionBinding.serverType` / `completionEngines` / `stream` / `buildReasoningPayload` / 两个 Sheet 的 state / DRC zod **全部收为 `ServerTypeOption`**。`types.ts` 旧声明 `\| string` 使联合被 TS 折叠成 `string`，闸门自第一天起即装饰，必须摘除 |
| 穷尽性 | `buildReasoningPayload` 的 `switch` 改表驱动或 `default` 处 `never` 断言：新增类型不补分支即 tsc 红（这才是真·编译期即报） |
| 单一裁决点 | 服务器类型由「URL 探测 → `seedServerType`」单点裁决；模板 chip 只填 URL 不写类型。旧实现里模板写入的正确值被紧随其后的探测覆写成非法小写，属同语义双路径 |
| 401 诊断单点 | 判据 + 文案 + 错误模板收 `openaiClient/helpers.ts` 的 `buildUnauthorizedError(serverUrl)`；域名判定走 `new URL().hostname.endsWith(...)`，不用 `includes`（`includes` 允许 `evil-dashscope.aliyuncs.com.x` 误挂）。connection 与 stream 两处必须产同一句 |
| 指南针 | 鉴权失败新增 **CP-APP-017**（不并入 CP-APP-015：015 语义是「义肢不可达→本地代答/查网络」，401 是「密钥与域名不配套→换专属域或换 key」，**动作集不相交**，并入会把排障引向错方向）。017 须排在 015 之前，`matchError` 取首个命中 |
| 本地正则兜底 | `usedFallbackParse` 产 `provenance:'local_fallback_parse'` 并 **emit 事件**（保留兜底的前提是可观测，见 §七 CORE-6） |
| 模型列表三态分离 | `pickModelListRows`（`connection.ts`）：`{"data":[]}` = 真没模型（照实 0 个）；缺 `data` 键 = 形状失配（**显式抛错并列出实际收到的键**）；`{"models":[…]}` **不兼容**——那种行没有 `id`，下游全按 `id` 取值，静默接受只会把「看似成功、添加时才坏」藏得更深（无真实服务器样本不先写归一层） |
| 非流式失约不再下推 | G1-2 旧收尾在整包 JSON 解不开时只留一句「让 result 携带空串，调用方自行判断」——空串会渲染成一条空白助手消息，不报错不留痕（把 G1-2 要治的病往下推一层）。现：**确定性失约（自报 JSON 而正文解不开）直接 reject**；而「合法 JSON 且内容真为空」仍照实 resolve——两条路径必须分得开，否则报错变误报 |

#### 勘正：抽取的结构化输出字段在本地**是生效的**（2026-09-09，推翻本窗报告 E-4 与两处假注释）

> 本轮一度把「本地抽取 JSON 不稳」归因于 `response_format`/`enable_thinking` 在本地是空气。**这个归因错了**，
> 第二条独立口径（直接读 `node_modules/llama.rn` 源码 + 版本号 0.12.7）证明：

| 字段 | 本地真实状态 | 证据 |
|---|---|---|
| `response_format` | **生效**。llama.rn 自己就把它翻成 native 的 grammar 输入：`index.ts:447-450` `if (params.response_format && !nativeParams.grammar) { const jsonSchema = getJsonSchema(...); nativeParams.json_schema = JSON.stringify(jsonSchema) }`；且 `CompletionBaseParams`（`index.ts:264`）**公开声明**了该字段 | 本仓 `LocalCompletionEngine` 只做 1:1 透传（不翻译也不需要翻译）；`getJsonSchema` 取的正是 `json_schema.schema` —— 与 `EXTRACTION_SCHEMA` 形状完全吻合 |
| `enable_thinking` | **生效**。`NativeCompletionParams`（`types.ts:230`）声明「Enable thinking if jinja is enabled. Default: true」 | 所以 Qwen 系 reasoning 混流导致解析失败，传 `false` 是对症的 |
| `as any` 的真因 | **不是缺字段**。三个字段都已在 `ApiCompletionParams` 类型内，`as any` 遮的是 `messages` 字面量的 `role` 被推宽成 `string` | 代价是整个 params 对象失去编译期保护（`n_predict`/`temperature`/schema 形状写错都不红）→ 收口：给 messages 元素加 `as const`（或显式 `RNLlamaOAICompatibleMessage[]`），**摘掉 `as any`** |

**由此推翻的本仓假注释**（必须就地改正，不得留着骗下一个读者）：

- `aiosMemory/index.ts` 头注释「提取: 用 grammar 约束 JSON 输出（根治不稳定）」——这句**其实成立**，此前被我误判为假；
- 同文件 `:463-464`「本地 llama.rn 引擎不识别 OpenAI 式 `response_format` json_schema」——**假的**，识别且转 grammar；
- 本窗方案报告 E-4「`enable_thinking` 在远端是空气 → 接线即失效」——**已推翻**（真字段；且按 §Wave E-3 抽取永不接远端，该因果链不成立）。

**仍然成立的唯一真缺口**：`response_format` 的转换被 `!nativeParams.grammar` 守卫——若 jinja 格式化已产出 grammar（带 tools 的 lazy grammar，`index.ts:408`），schema 会被**静默跳过**。抽取调用不传 tools，当前不受影响；登记为已知边界（无消费方不接线），若日后给抽取加工具必须重查此条。

### Wave E-3 · 记忆抽取引擎归属（🔴 改判：**不**接义肢，2026-09-09）

> **本窗全量复查推翻了升级 spec 的 G4-1 前提**。这不是没做完，而是那个规划与产品公理相冲，
> 所以正确动作是**删掉已建了一半的假接口**而不是硬接：

1. **产品公理层面**：记忆抽取**每一轮对话结束都跑**（`extractAndSaveMemories` 挂在 run_finished / 管家答完后）。
   若按 G4-1 将其接义肢，等于**把每一轮对话内容自动送往付费/远程服务器**——直接违反本仓第一能力
   「全部运行在设备上、完全离线、隐私本地化」与 §2.1「隐私本地化」。这是主权级产品决策，不得由实现顺手打开。
2. **技术现状层面**：`ExtractOpts.engine` **零调用方传参**（死参数），而现有回退链
   `modelStore.engine ?? promptWriter` 已经就是「用本轮回答的引擎抽取」——语义本就正确。
   `resolveTaskEngine` 返回的是**档位字符串**不是引擎实例，它回答的是「本轮该谁答」，
   不是「抽取该谁做」——两者不是同一个决策点，接过去反而开出第二个引擎决策（违反公理 6）。

**改判后的契约**：

| 项 | 契约 |
|---|---|
| 抽取引擎 | 永远本地（本轮已加载的引擎：`modelStore.engine` 优先，管家模式落 `promptWriter`）。**不引入第二个引擎决策点** |
| `ExtractOpts.engine` | **随 `ExtractOpts` 整体删除**（零调用方的假接口不留） |
| `provenance` | **由本函数自裁**（见下行：既然抽取引擎永远本地，引擎来源就不再是调用方知道而函数不知道的事实）。枚举收为 `'local' \| 'local_fallback_parse'`：删除 `'limb'` 与 `'limb_offline_local'`——唯一旧生产者是 `useChatSession:773` 的 `activeRemoteBinding ? 'limb' : 'local'`，而抽取跑在本地引擎上，打 `'limb'` 等于**谎报来源**（回答是义肢答的，记忆是本地模型产的） |
| `ExtractOpts` | **整个删除**（不是只删 `engine` 字段）。删掉 `engine` 后剩下的 `provenance` 已无信息增量，而它是全仓唯一在异步回调里读 `activeRemoteBinding` 的地方——拆掉它，那个窄竞态不是被“同步捕获”收掉，而是**依赖被删除**（更锋利的收口方式） |
| `'limb_offline_local'` | **从枚举中删除**。既然抽取永远本地，“意图是义肢但降级”对抽取质量**无任何差异**（引擎本来就是本地的），为一个不产生区别的值保留空枚举位就是假留痕 |
| 质量升级的正确路径 | 若日后确实需要高质量抽取，应当是个**用户显式开关**（设置页“允许用义肢整理记忆”，默认关），而非实现层默认行为——挂 §七 CORE-7 |

> 注：旧实现里 `useChatSession` 在 `persistText.then()` 异步回调里读 `activeRemoteBinding` 算 provenance，
> 存在一个窄竞态（抽取延后 1.2s，期间若用户切模型则留痕偏一个档）。本轮收口不是去“同步捕获”，
> 而是按上行把 `ExtractOpts` 整个删掉——**抽取不再读任何全局引擎状态**，竞态因无依赖而消失。
> （本文旧版曾把它描述为「系统性读错」，按实测改正：`loadReleaseMethods` 在本地加载路径会清空该字段，所以它确实是当前引擎的标识。）

### Wave D · 生长四拍闭环（心智层演化）
| 项 | 契约 |
|---|---|
| inspect | ✅ `rituals` 收尾四拍写 `growth/gap_YYYYMMDD.md`（当日一次，内容=今日摘要+情绪行，v1.2 接线 G-3） |
| plan/upgrade/reflect | ✅ 收尾三件套升级为四拍：日记/独白/小结不变；`iterations.jsonl` 一行（date/saw=摘要 200 字/演化噪音识别/下轮审视啥）——reflect 三问落成文件 |
| 情绪台账 | ✅ `sentiment.json` 单条保留；`logs/emotion_YYYYMMDD.jsonl`（母仓 kal_inner_life 同构：ts/score/label/source） |
| 验收 | 连续 3 天账本有真内容（非模板）；四拍不阻塞聊天主链路 |

### Wave E · 义肢双策略调度（✅ 已落地：分级唯一真源 v1.2）
| 项 | 契约 |
|---|---|
| 能力分级 | ✅ `taskRouter.resolveTaskEngine(task, text, limbOnline)` 四档纯函数；local-zero 档生产语义由「chitchat→管家直答」链路承担（零模型行为对应，非显式调用）；limb/limb_offline 档由 scheduler 经健康门探活后唯一消费（v1.2 真接线：probe 先行 → 分级函数裁决 → 按返回值分支，G-6） |
| 义肢健康门 | ✅ `useChatScheduler`：未配义肢=资格面短路（配置缺席≠故障，静默本地代答不打扰）→ 已配义肢 `testConnection` 探活 → `resolveTaskEngine(task,text,probeOk)` 裁决 → limb（askModelSwitch('limb') 主权弹窗，可继续当前）/ limb_offline（显式助理消息告知，不静默硬扛）/ local（本地链路）——单决策点不双弹窗；REMOTE 模型会话记住遵循 taskModelChoice 语义 |
| 验收 | 深度复盘请求自动切 REMOTE 且 UI 可见；离线时明确提示而非静默本地硬扛（真机口测待授权） |

## 五、状态模型

| 维度 | 说明 |
|------|------|
| 输入 | App 冷启动（wakeCheck/星图）· 当日收尾满阈值（四拍）· 任务发送（义肢分级）· 工具失败（指南针） |
| 输出 | IDENTITY.md / wake_anomaly.jsonl / kg 节点边 / starmap_snapshot.json / iterations.jsonl / emotion jsonl |
| 持久状态 | 全部落 `AIOS_ROOT` 共享存储（卸载不丢）；模型双目录按 §2.3 |
| 事件 / 日志 | drift/eventStream emit（gate/wake/kg/growth/starmap/memory 打点：wake.check / kg.built / growth.iteration / growth.emotion / starmap.captured / gate.stale / **memory.extracted** / **memory.failed** / **memory.skipped**（`reason: inferencing \| no_local_engine`，真丢一轮记忆时必须可观测）/ **safeTimeout.failed** / **safeTimeout.cancelled**，DRC 可查） |

## 六、健康指标

| 指标 | 阈值 / 说明 |
|------|-------------|
| tsc | 零错误 |
| jest | 新增模块单测全绿（wakeCheck/gate/starmap/iterations/emotion/resolveTaskEngine/kg/limb 调度/gap/CP 消费链） |
| 真机验收 | 冷启动首轮含身份锚；卸载重装后 IDENTITY/growth/emotion 数据仍在；REMOTE 深度复盘切换可见 |

## 七、Gap Ledger

| Gap ID | 现象 | 补齐路径 | 状态 |
|--------|------|----------|------|
| CORE-1 | 母仓 793 活体引擎全协议（18 关系族 / ~90 relation / 10 类节点 / 5,589 节点 / 26,180 边）在端侧无消费方且 typed 校验需 LLM 驱动，不可搬 | 只搬协议：**两实体**轻量图（`kg.ts` 只落 `memory` / `conv`；母仓的第三类实体未搬，2026-09-07 W4 按代码更正——旧行写「三实体」与 §Wave C L92 已改正的口径卷内矛盾）+ 问谱优先层（kg.ts+searchMemory 接线）。真实不可搬原因不是规模（5.5K），是 18 关系族 typed 双端校验需 LLM 驱动且端侧无对应消费方 | ✅ 已落地；工具事件实体挂后续波次（无消费方不接线） |
| CORE-2 | 门禁硬执行需跨 Native 权限面 | 协议 + 软提醒已落地；isAnchorFresh 生图前置软检查（gate.stale 打点不卡读）；CP 导航有**两条并行出口**（与 §Wave B L86 同口径，v1.3 补齐）：chat/图件报错→`errorReport.buildErrorReport`，工具错误→`AgentRunner.errorOutcome`，二者同读 `matchFirstError` 单一模式表 | ✅ 已落地（v1.2 消费链闭环）；硬执行面（付费前置确认）留真机口测后按需收口 |
| CORE-3 | 义肢离线时任务退化 | 分级函数唯一真源：probe 先行→resolveTaskEngine 裁决→limb_offline 显式告知（不静默） | ✅ 已落地（v1.2 真接线） |
| CORE-4 | 血统导入依赖电脑 adb | `scripts/aios/import_identity.py` ⏳ 待建（Wave A 表格口径已统一）；冷启动自愈重建种子后非必需，身份种子自含母仓来源行 | ⏳ 待建（低优先，自愈闭环已覆盖） |
| **CORE-5** | **9D 总线假闭环**：`AiosMemory.dimension` 有声明、有读方、**零写入方**；`nineDInjector` 因此退化为「最新 3 条」并与 `buildMemoryFragment` 双路同源叠压；且 `DIM_ORDER` 收了母仓 ADR-0227 明令不入记忆的 D1/D2/D3/D6/D9 与两个另造词面 | 按 §Wave C+ 收口（**已改判为不存字段**）：删 `AiosMemory.dimension` + 删 `nineDInjector.ts` + 维度优先级由 `memoryDimension(type)` 派生并作为 `buildMemoryFragment` 排序次级键 → **单一注入出口** | ✅ v1.3 已收口（本窗） |
| **CORE-6** | **provenance 全链零消费方**：19 处命中全是写入/注释，无 UI/事件面读取——「保留兜底但打 provenance」的前提是可观测，写成 JSON 里没人读的字段仍是兜底存量，只是穿了件留痕外衣 | 抽取结束 `emit('app','memory.extracted',{count,provenance})`；DRC 加 `memory.list`（含 `byProvenance` 汇总，使兜底率第一次可数）；**域归集按房内惯例走 `'app'`**（AIOS 子系统事件均同：`growth.*` / `kg.*` / `starmap.*` / `wake.check` / `gate.stale`），**不新增 `DrcDomain: 'memory'`**（`toCompass` 无真写入方时只会多一个空态域，正是 CORE-5 那类假接线）；抽取引擎永远本地（§Wave E-3）→ `ExtractOpts` 整体删除，`'limb'` 与 `'limb_offline_local'` 一并收：给本地模型产的记忆打 `'limb'` 是**谎报来源** | ✅ v1.3 已收口（本窗） |
| **CORE-7** | **G4-1 零落地但是 G3-2 的前置**：`extractAndSaveMemories` 引擎链仍是 `opts?.engine ?? modelStore.engine ?? promptWriter`，`aiosMemory` 对 `resolveTaskEngine` **零引用**；`ExtractOpts.engine` 无调用方传参（死参数）。spec 自标「全方案最高优先级」未做而后续照做，正是 CORE-5 空转的成因链 | ⚠ **本窗改判：不接义肢**（产品公理冲突 + 死参数），详见 **§Wave E-3**。收口动作：删 `ExtractOpts`（含 `engine` 与 `provenance`）+ provenance 枚举收为 `'local' \| 'local_fallback_parse'` | ✅ v1.3 已收口（按 §Wave E-3 口径，非原 spec 口径） |
| **CORE-10** | 高质量抽取的正当需求未否定（本地 4B 产 JSON 确实不稳定，现靠正则兜底） | 只能做成**用户显式开关**（默认关，不静默上行），且需同步评估隐私/计费告知；本窗不做 | ⏳ 待产品定夺（主权决策，不由实现层默认） |
| **CORE-8** | **RN 全局 JS 异常零埋点接线**：`setGlobalHandler`/`ErrorUtils` 全仓 0 命中，`error_*.txt` 只在显式调 `copyAndSaveErrorReport` 时落盘。后果：红屏必不进档——2026-09-09 真机一次 `TypeError: Cannot read property 'catch' of undefined` 无留痕，仅靠 bundle 偏移无法归因 | 在 `errorReport.ts` 注册**一次** `setGlobalHandler`，复用既有 `emit('error',…)` + `setLastError` + `buildErrorReport`，**不新增容器**。落地后此类悬案自动获得第二条口径 | 🟡 v1.3 已收口（本窗） |
| **CORE-11** | **静默 catch 使「写在引擎回调里的断言」恒不可红**（本窗实测坐实的第 5 个假绿）：`extraction.test.ts:62-84` 把 12 条 `toContain` 全放进 `mockCompletion.mockImplementation` 内，而 `extractAndSaveMemories` 末尾 `} catch (e) { console.warn('[aiosMemory] extraction failed:', e); }` 会把回调抛出的断言异常整个吞掉。现行证据：其中 `'fact: 大王的长期属性'` 在源码里**根本不存在**（实为「长期**稳定**属性」），套件仍报 `6 passed` | ① 断言**移出回调**：mock 里只把 `params` 存进局部变量，`await` 之后在测试体内断言（异常才能抵达 jest）；② catch 内 `emit('app','memory.failed',{error})`——兜底可以留，但失败必须可观测，否则「静默 catch」与「假绿」是同一枚硬币 | ✅ v1.3 已收口（本窗） |
| **CORE-12** | **闸门自身有两处缺陷（本窗探针实测撞出）**：`audit-async-timers` v1 逐行裸扫且不跨行——① `setInterval(() => {\n void pollOnce();\n}, ms)` 这种**多行箭头体完全漏报**（正是本仓出过事故的形状）；② 注释里的同款形状被**误判为违规**（实测：我在 drcService 写的「旧写法是 setInterval…」解释注释把闸门判红了）。空转/乱叫的闸门都比没有更险 | v2：加 `maskNonCode`（注释/字符串抹平、保持行列号）+ 按行窗口取回调体再找目标；**自检内联到每次执行**（`runSelftest()` 在扫描前跑，夹具 4 逃逸形状必须全中、3 种注释/字符串形状必须零误报，否则退出 1） | ✅ v1.3 已收口（本窗） |
| **CORE-13** | **入库源码引用不入库路径**：`aiosMemory/index.ts` 与 `searchEngine.ts` 各有一行「依据：`.qoder/specs/记忆时效性三闸治理方案…`」，而 `.qoder/` 被 `.gitignore` 排除——公开仓读者永远打不开这个依据 | 两处注释改为「结论自足 + 标明原文不入库」：治理规则本身已在注释里写清（三闸排除清单/免责前缀语义），spec 降为溯源附录。同类引用在 `docs/*.md` 里还有 ~10 处（全仓惯例），**本轮只修 src 面**（改代码的人只看代码注释），文档面清扫挂后续 | ✅ src 面已收口（本窗）；docs 面 ⏳ 挂账 |
| **CORE-14** | **无主一次性延时使「全量 jest 全绿」这道门禁失真**（本窗实测）：回合收尾用 `setTimeout(…, 1200)` 包四个 `void` 异步体（`useChatSession.ts:765` / `useChatScheduler.ts:217` 同源两份），句柄无人持有、无 `clearTimeout`。后果：全量跑 **352 套件全绿、4928 passed / 0 failed 却 exit 1**（jest 报 `A worker process has failed to exit gracefully`），并溢出 **74 条** `Cannot log after tests are done`——一个真实的异步越界被“全绿”两字掩盖。`jest/setupFilesAfterEnv.ts` 已有 `jest.clearAllTimers()`，但**它对真定时器无效**，所以这道“看起来有的保护”正是错觉来源 | 新增 `safeTimeout`（与 `safeInterval` 同文件同口径：收口 + 双通道上报 + 句柄登记），`cancelPendingSafeTimeouts(reason)` 供会话/测试收尾；两处调用点合并为单一入口 `aiosMemory/postTurn.ts::scheduleMemoryPostTurn`（延时成私有常量，不再跨可 mock 边界；顺带去掉两处重复的 `extract + appendConversation` 对）；测试侧走 `globalThis.__ppCancelSafeTimeouts` 接缝而非 import（见 TEST_INFRA_SPEC §二 第四形态）；`audit-async-timers` v3 把扫描面扩到无主 `setTimeout`（仅认「体内直接 async 或 `void X()`」形状，豁免 sleep 助手与纯同步体）；**实测收口效果：全量 353 套件全绿、jest exit 1→0、越界日志 74→0**（残留 1 条 worker 强退警告不影响退出码，已挂 `--detectOpenHandles` 后续项）；律 2 正文已同步扩面（TEST_INFRA_SPEC §3.3） | ✅ v1.3 已收口（本窗） |
| **CORE-15** | **抽取 prompt 里有一条结构上不可满足的指令**（2026-09-09 真机复验时撞到）：`EXTRACTION_SYSTEM` 要求「严格排除：…与已有记忆重复的信息」，但抽取的 user 消息**只含本轮对话**（`大王: …\n女妖: …`），没有任何既有记忆清单 → 模型无从知道什么是「重复」。实际挡住重复的只有代码层两道：`addMemory` 的**精确内容**去重（`m.content === trimmed`）与 fact 的 `attrSlot` supersede；**近义复述会持续累积**。真机证据：`memory.list` 46 条里同一主题（青色/吉他）至少 5 条并存且字面各不相同 | 两个候选（都是**产品取舍**，需评估 token 成本与 §2.4 预算，本窗不擅自做）：① 把 top-N 既有记忆注入抽取 prompt（使该指令变为可满足）；② 按 `keywords` 重叠做近似去重。无论选哪个，**不得留一条做不到却写在 prompt 里的指令**——它给人「已经在去重」的虚假安全感（与 CORE-5/CORE-11 同一味道） | ⏳ 已登记（带真机证据，待取舍） |
| **CORE-9** | **洋葱 KG 覆盖面缺口**：gate 下达「KG 优先 → 禁 Grep/Glob 前先走 KG」，但 `kg_preflight --strategy` 对 pp 仓 TS 面返回 `confidence: 0.0 / tier_used: full / strategy: fallback_grep`（索引仅覆盖母仓 Python，建议 `--include='*.py'`） | 诚实回落而不是假用：本文档与 MASTER_LOG 登记该缺口；如需真用需先给 pp 仓建 TS 索引（挂后续波次，无消费方不接线） | ⏳ 已知缺口（登记不谎报） |

## 八、关联

- **同层子系统**：aiosMemory（记忆闭环）· rituals（仪式四拍）· taskRouter（调度分级）· debug/eventStream（观测）
- **既有 SPEC**：WORKSPACE_SPEC（产物目录）· INNERLIFE_SPEC（收尾三件套基线，本 SPEC 升级为四拍）· PRODUCT_SPEC（锋利原则）· STARMAP_DOMAINS（星图域）
- **母仓协议**：KEEP_WAKING_SSOT（三层醒来）· NV_YAO_GROWTH_ITERATION_SSOT（四拍）· gate-guard（TTL/逃生语义）· 793 洋葱 KG（问谱优先）
- **相关 ADR**：ADR-0004（B15 双轨模型目录）· **ADR-0227（9D 桥接：可持久化维度只含 D4/D5/D7/D8——§Wave C+ 的收缩依据）** · **ADR-0249（任务态注入与 9D 桥接）**