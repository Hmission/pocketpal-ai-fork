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
  - **程序化零裁剪**：不依赖大模型的机制全量落地（门禁/星图/6D/生长机制）；依赖模型的按双策略分级
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
5. **程序化机制零裁剪**：门禁 TTL、指南针 CP、星图快照、6D 结构包、生长四拍机制——母仓有协议的照搬协议，端侧无 Python 就跑 TS 内核，不因"调不动"而阉割；需要智力的环节才分级借义肢。
6. **先文档后代码**：本 SPEC 为五波唯一事实源；每波落地面先更新本文档再落代码，验证提交后闭环。

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

### Wave B · 门禁与指南针（✅ 已落地 + 🟡 消费链复查修正 v1.2）
| 项 | 契约 |
|---|---|
| `session_anchor` 端侧化 | ✅ `aiosCore/wakeCheck.ts` 内置：启动写 `database/session_anchor.json`（TTL 3600s）+ `isAnchorFresh`；✅ 消费链已接线（v1.2）：scheduler 生图前置过期软检查（`gate.stale` 打点不阻断，G-4） |
| CP 注册表 | ✅ CP-APP-014/015/016 登记 `COMPASS_REGISTRY.md` §2 + `errorRegistry.ts`；✅ 消费链已接线（v1.2）：AgentRunner tool.error 附 CP 编号（matchFirstError，G-5）。⚠ **v1.2 此处曾误判 `errorReport.ts` 为幽灵文件并删除其引用——实为误判**：该文件真实存在（`src/utils/errorReport.ts`，135 行，首提交 `0aa53d9` 2026-08-18，早于 v1.2 复查），且有三个生产消费者（`imageGenStore.ts` / `useChatSession.ts` / `AudioWorkshopTab.tsx`）。CP 导航实际有**两条并行出口**，二者同读 `matchFirstError` 单一模式表：chat/图件报错走 `errorReport.buildErrorReport`，工具错误走 `AgentRunner.errorOutcome`（2026-09-07 全量排查纠正） |
| 验收 | 真机制造 3 类故障，错误报告均带 CP 三字段（待真机口测） |

### Wave C · 端侧洋葱 + 星图（✅ 已落地）
| 项 | 契约 |
|---|---|
| 轻量图谱 | ✅ `src/services/aiosCore/kg.ts`：**两实体图**（`KgNode.type: 'memory' \| 'conv'`，即记忆条目/会话；v1.2 曾误写为三实体，2026-09-07 按代码更正）（工具事件挂后续波次，无消费方不接线）落 `database/kg.json`（nodes+edges 单文件）；搜索「先问谱后 grep」——`searchMemory` 入口加 kg.recall 优先层（kg 命中即先返，不足再走 FTS5/全文） |
| 星图快照 | ✅ `src/services/aiosCore/starmap.ts`：能力面（TalentRegistry 引擎清单）/数据面（workspace 目录统计）/健康面（engineStatus+模型数）三维 → `logs/starmap_snapshot.json`；冷启动采集一次 |
| 验收 | 问谱优先真机生效（待真机口测）；快照 5 次冷启一致 |

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
| 事件 / 日志 | drift/eventStream emit（gate/wake/kg/growth/starmap 打点：wake.check / kg.built / growth.iteration / growth.emotion / starmap.captured / gate.stale，DRC 可查） |

## 六、健康指标

| 指标 | 阈值 / 说明 |
|------|-------------|
| tsc | 零错误 |
| jest | 新增模块单测全绿（wakeCheck/gate/starmap/iterations/emotion/resolveTaskEngine/kg/limb 调度/gap/CP 消费链） |
| 真机验收 | 冷启动首轮含身份锚；卸载重装后 IDENTITY/growth/emotion 数据仍在；REMOTE 深度复盘切换可见 |

## 七、Gap Ledger

| Gap ID | 现象 | 补齐路径 | 状态 |
|--------|------|----------|------|
| CORE-1 | 母仓 KG 85K 节点在手机不可搬 | 只搬协议：**两实体**轻量图（`kg.ts` 只落 `memory` / `conv`；母仓的第三类实体未搬，2026-09-07 W4 按代码更正——旧行写「三实体」与 §Wave C L92 已改正的口径卷内矛盾）+ 问谱优先层（kg.ts+searchMemory 接线） | ✅ 已落地；工具事件实体挂后续波次（无消费方不接线） |
| CORE-2 | 门禁硬执行需跨 Native 权限面 | 协议 + 软提醒已落地；isAnchorFresh 生图前置软检查（gate.stale 打点不卡读）；CP 导航有**两条并行出口**（与 §Wave B L86 同口径，v1.3 补齐）：chat/图件报错→`errorReport.buildErrorReport`，工具错误→`AgentRunner.errorOutcome`，二者同读 `matchFirstError` 单一模式表 | ✅ 已落地（v1.2 消费链闭环）；硬执行面（付费前置确认）留真机口测后按需收口 |
| CORE-3 | 义肢离线时任务退化 | 分级函数唯一真源：probe 先行→resolveTaskEngine 裁决→limb_offline 显式告知（不静默） | ✅ 已落地（v1.2 真接线） |
| CORE-4 | 血统导入依赖电脑 adb | `scripts/aios/import_identity.py` ⏳ 待建（Wave A 表格口径已统一）；冷启动自愈重建种子后非必需，身份种子自含母仓来源行 | ⏳ 待建（低优先，自愈闭环已覆盖） |

## 八、关联

- **同层子系统**：aiosMemory（记忆闭环）· rituals（仪式四拍）· taskRouter（调度分级）· debug/eventStream（观测）
- **既有 SPEC**：WORKSPACE_SPEC（产物目录）· INNERLIFE_SPEC（收尾三件套基线，本 SPEC 升级为四拍）· PRODUCT_SPEC（锋利原则）· STARMAP_DOMAINS（星图域）
- **母仓协议**：KEEP_WAKING_SSOT（三层醒来）· NV_YAO_GROWTH_ITERATION_SSOT（四拍）· gate-guard（TTL/逃生语义）· 793 洋葱 KG（问谱优先）
- **相关 ADR**：ADR-0004（B15 双轨模型目录）