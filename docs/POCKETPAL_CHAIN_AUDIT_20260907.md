---
doc_id: POCKETPAL_CHAIN_AUDIT_20260907
module: root
type: plan
status: active
version: '1.0'
created: '2026-09-07'
updated: '2026-09-07'
relates:
  [
    POCKETPAL_STARMAP_DOMAINS,
    POCKETPAL_PHONE_SPEC,
    POCKETPAL_TTS_SPEC,
    POCKETPAL_AIOS_CORE_SPEC,
    POCKETPAL_IMAGEGEN_QUEUE_SPEC,
    POCKETPAL_IMAGEGEN_UI_SPEC,
    POCKETPAL_AUDIO_UI_SPEC,
    DRC_COMPASS_REGISTRY,
    PERF_BENCHMARK_DESIGN,
    POCKETPAL_CHAT_UI_SPEC,
  ]
---

<!-- D-FORMAT:v3 -->

# 闭环复查全量审计与收口方案（6D + 星图，2026-09-07）

> **触发**：大王令「复查本窗口规划是否全部落地，是否还有文档规划了但代码没落地闭环的项；产品要锋利不臃肿、不兜底、不补丁，从产品角度确保链路干净清晰；用 6D 与星图能力全量排查，给出全面方案报告」。
> **方法**：门禁（gate→route `act-b92f2533` 啄木鸟）→ KG 优先协议问谱 → 四路只读专工分域对账（各携规则包：红线/星图域/文档指针/交付契约）→ 奴家亲自复核要害结论 → 6D 六维归置。
> **6D 口径**（母仓 `6D_AUDIT_REPAIR_PLAN` §1.1）：**链 · 簇 · 面 · 锚 · 态 · 策**。
> **本文只诊断与定方案，不含已实施改动**（唯一例外见 §0.2，属修复上轮污染）。

---

## 〇、对本窗直接答复

### 0.1 本窗口规划是否全部落地？

**代码侧：五项全部落地，有实锤。** 逐项复核（专工 A + 奴家复验）：

| 规划项                         | 代码实锤                                                                                                                                                   | 判定                         |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------- |
| 删旁路 A、改由管家直答声明回合 | `ChatScreen.tsx:226-240` + `useChatScheduler.ts:149-153/198-204/529/571`；`phoneLastReply`/`phoneReplyHandled` **src 零残留**                              | ✅ 已落地                    |
| 卡片标记同源                   | `utils/messageCards.ts`（8 键 + 4 判定），两消费方接入，TODO(P1) 消除                                                                                      | ✅ 已落地                    |
| 分段遥测                       | `session.ts` 实际 **7 个调用点**（begin L154 / markAsrDone L164 / endAndReport L174·L186·L207 / markReplyStarted L193 / reset L215），比文档"5 点"更多收口 | ✅ 已落地                    |
| 复读早停                       | `repetitionGuard.ts` + `promptWriter.ts:17-20/264-270`                                                                                                     | ✅ 已落地                    |
| 上游 PR 素材                   | `docs/internal/RN_SPEECH_STOP_UPSTREAM_PR.md`（行号级根因 + 方案 A/B）                                                                                     | ✅ 已落地（internal 不入库） |

**文档侧：没有全部落地，且发现两处"文档声称 ≠ 事实"的硬伤**（下条）。

### 0.2 本轮复查当场修掉的两个真问题（提交 `108f526`）

1. **§18 契约节在上一笔提交里就是缺失的。** 上轮登记的"已按原稿插回"事后未生效：实测 `WORK` 与 `HEAD` 完全一致（1005 行 / `h18=0` / `h91=2` / H2 序列缺 18 / 工作树干净）→ **跨窗口丢更新第二次发生，且这次污染已进入 git 历史**。后果是五处引用（PHONE_SPEC 两处、TTS_SPEC §6.5、`ChatScreen:218`、`useChatScheduler:201` 代码注释）全部指向不存在的章节——"唯一事实源"名存实亡。已按原稿插回并删除 §9.1 重复块，带全量结构断言（H2 序列 1..19 连续、`h91=1`、`h10=1`、numstat 59 增/33 删与预期吻合）。
2. **§19.3 是奴家写的不实陈述。** 该节以「**已核实**的替代信息」口径引用 `TTSStore.lastSpeakElapsedMs` 与单测常量 `TTS_TURN_MS = 870`，全仓检索证明**两个标识符均不存在**（`TTSStore` 内连 `elapsed/duration` 字段都没有），而这条虚构被用来支撑「不做播报启动延迟打点」的裁定。已就地作废，只保留真实证据（§9.1 的 TTS 加载 0.87s、真机 `engine_init_ms=874`）。

> **由此产生一条新纪律（已生效）**：文档类改动**提交后必须复验 HEAD 内容**（`git show HEAD:<path>` 取结构计数），不得以工作区验证代替——上轮正是"工作区验过、提交内容却是脏的"。

---

## 一、D1 链：链路断点与失败不可见（最高优先级）

### 1.1 队列停止链——本仓最尖锐的"按了没反应且永远不被告知"

三处合起来构成同一个**补丁式假设**：「cancel 一定成功、native 一定会返回」。

| 环节            | 位置                           | 事实                                                                                                                                                                                                               |
| --------------- | ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| cancel 被三重吞 | `imageGenStore.ts:1417`        | `void ImageGen.cancelTxt2img?.().catch?.(() => {})`：可选链（方法缺失即静默 no-op）+ 空 catch + 外层 try 仅 `console.warn`(L1419)                                                                                  |
| 无超时忙等      | `imageGenQueueCore.ts:276-278` | `while (this.running) await new Promise(r => setTimeout(r, 50))`——**无上限、无失败出口**                                                                                                                           |
| 心跳超时不收口  | `imageGenStore.ts:398-414`     | 超时仅置 `generating=false` + `this.error`，**不调 failTask、不解在途 await** → 当前抽任务卡**永停 running**；而 composer 底部 error 出口已被 UI_SPEC §4「报错唯一出口=预览区 failed 卡」废掉 → 用户看不到任何失败 |

**破产路径**：cancel 静默失败或 Vulkan hang → `stop()` 永不 resolve → `stopping` 常驻 → 面板长禁 → nightTask 恒 busy → 前台服务永不停。
**违反**：不兜底（忙等本身就是 §十五 该禁的兜底形态）+ 失败不可见。

### 1.2 nightTask 单计数器无归属——跨域误杀保活

`nightTaskRegistry` 是**全 App 共享单计数器**，但写点分属两域且不记"谁 begin"：

- `imageGenStore.ts:237-246`：队列/生图 `begin()` / `else if (isBusy) end()`
- `ChatScreen.tsx:305-314`：通话 `begin()` / cleanup `end()` + `VideoTaskService.stop()`

**实锤故障路径**：夜间队列 running（busy 只 begin 一次）→ 用户拨出/结束通话 → ChatScreen `end()` 把计数扣到 0 → 前台服务停、`PARTIAL_WAKE_LOCK` 释放 → **队列仍在跑，息屏即被杀**。这正是 ONDEVICE_VIDEO §7.1 与 QUEUE §六 想根治的"夜间耐久"反例。

### 1.3 内存检查谎报"装得下"——fail-open 编造状态

`useMemoryCheck.ts:195-202`：catch 后 `setFitStatus('fits')` 并**清空所有警告**。内存检查抛错 = 对用户谎报"没问题"→ 用户继续加载 → OOM/闪退。全仓最典型的"用兜底掩盖故障"。

### 1.4 朗读按钮静默早退

`audioStore.ts:312-315`：`if (!text.trim() || !this.isTTSAvailable) return;`——无 banner、无任务、无提示，点「朗读」零反应。同族：`loadVoices` L305-307 `catch {}` 使单引擎音色整块消失零提示；播放器 `togglePlay/seekTo/stopPlayback`（L232-274）**无 catch 且状态先行乐观置位**（`pausePlayFile()` 抛错则 `isPlaying=false` 永不落，UI 与 native 反目；底层 `ttsEngine.ts:214-247` `if (!AudioTts) return;` + `stopPlay` `catch{}` 双吞）。

### 1.5 转写源音频持久化失败仅 warn

`audioStore.ts:183-190`：源音频落盘失败只 `console.warn` → 「对照播放」按钮静默不可用（不阻断、无提示）= 降级不可见。

---

## 二、D2 簇：双真值源与状态簇分裂

### 2.1 队列"当前是否忙"：3 个真值源 / 7 个判定点（同一函数体内混源）

`imageGenQueueCore.state`（私有三态 `state`/`running`/`stopRequested`）→ 经 `syncQueueMirror` 拷入 → `imageGenStore.queueState`（镜像，**存在同步窗**）。消费方各自选源：

| #   | 判定点             | 位置                                                                | 用的源                                                     |
| --- | ------------------ | ------------------------------------------------------------------- | ---------------------------------------------------------- |
| 1   | nightTask reaction | `imageGenStore.ts:222-227`                                          | 镜像                                                       |
| 2   | 采样轮询 syncPoll  | `:346` `active = loading \|\| generating`                           | **两者都不是**（漏队列两态）                               |
| 3   | 入队/编辑/删除守卫 | `:1364` / `:1375`                                                   | 镜像                                                       |
| 4   | 开始守卫           | `:1399`                                                             | 只判 loading/generating，**不判队列**（靠 core L206 兜住） |
| 5   | **停止守卫**       | **`:1410`**                                                         | **core**（与 1/3/4 反源）                                  |
| 6   | 执行器 while       | `imageGenQueueCore.ts:226`                                          | core 私有                                                  |
| 7   | UI busy            | `GenActionBar.tsx:70`、`ImageGenScreen.tsx:994-1001/1398-1401/1624` | 镜像 + 组件本地态                                          |

SPEC §四/§十一 D3 自称「队列状态进 MobX **单缝**」，实为五层并判。**同一次 `stopQueue` 里 L1364(镜像) 与 L1410(core) 混用即真值竞态**——这是竞态的定义，不是隐患。

### 2.2 `phoneVisible` ↔ `inCall` 两份"此刻在通话中"

`PHONE_SPEC §16.4` 明写「不留第二份开合状态」，`inCall.ts` 自称单一事实源；实际 `ChatScreen.tsx:267` 的 React state 与 `inCall.ts` 的模块 boolean **同时存在**，靠 L301-317 的 effect 单向镜像（`if (!phoneVisible) return;` 提前返回，false 侧全靠 cleanup）。消费方分家：前者驱动 `useElapsed`/`usePerfTrace`/引擎派生/overlay `visible`，后者驱动 `isInCall()` 与 `useChatSession:879`。撕裂后果：播报不被强制、回合不收口，**只能等 90s 看门狗放行**——即 §16.4 声称已废除的那种"常规收口手段"以间接方式回来了。

### 2.3 播报门仍有第二套判定

`TTSStore.ts:156` 写「播报门的**唯一**事实源：能不能播一律读 `speakBlock`」，而 §16.1 合并表逐行列了 4 处旧写法——**第 5 处既没进表也没改**：`audioStore.ts:313` 仍用 `isTTSAvailable`（只覆盖 `voiceBlock()` 三因子中的 `device`，**不判 `noVoice` 与 `engine`**）→ 引擎未装/未选音色时它会放行，与 `speakBlock` 给出**不同答案**。同文件另有两份"唯一"互斥宣称：`TTSStore.ts:97`（"the single boolean every TTS-aware surface reads"）vs `:156`（"唯一事实源"）。

### 2.4 双份幂等（可接受但应显式化）

`useChatSession.ts:971-982` 的 `phoneTurnStarted` 边沿闩 与 `session.ts:201-208` 的 `notifyReplyFinished` 状态幂等构成双份保护，文档只描述了一道。"回调丢了靠什么收口"这条链上现叠了三道语义重叠防线（含 90s 看门狗）。

### 2.5 常量/判据双份（已实测分叉）

| 语义                          | 两处                                                                        | 后果                                                     |
| ----------------------------- | --------------------------------------------------------------------------- | -------------------------------------------------------- |
| `CJK_RE`                      | `aiosCore/kg.ts:57` `/[\u4e00-\u9fff]/` vs `utils/speakable.ts:24` 多 Ext-A | **范围已分叉**：生僻字在图谱切词与可朗读判定上结论不一致 |
| `AIOS_LOGS_DIR`               | `utils/errorReport.ts:18` vs `utils/paths.ts:28`（**都 export 同名**）      | 路径权威未收口                                           |
| `HF_DOMAIN`                   | `config/urls.ts:3` vs `utils/downloadSources.ts:14`                         | 换镜像需改两处                                           |
| `DEFAULT_SUPERTONIC_LANGUAGE` | `tts/engines/supertonic/index.ts:38` vs `TTSStore.ts:74`                    | 默认语言两处                                             |
| `PAL_IMAGES_DIR`              | `utils/imageUtils.ts:7` vs `utils/importUtils.ts:389`                       | 祖传                                                     |

---

## 三、D3 面：可感知面与登记不闭合

### 3.1 testID 双向不闭合（e2e 会踩空）

- **登记未挂**：`phone-hint`（CHAT_UI_SPEC §21 L531 登记，全仓仅文档 1 处命中，副提示行 `PhoneCallOverlay.tsx:451/459` 无 testID）；`audio-speak`（AUDIO_SPEC §7 L139 登记，src+e2e 全域零命中）。
- **挂了未登记**：队列族 **11 个**（`imagegen-enqueue`/`queue-badge`/`queue-capsule`/`queue-panel`/`queue-start|stop|close|clear`/`queue-item-*`/`queue-remove-*`，QUEUE_SPEC **全卷无 testID 章节**）；音频工坊 **21+ 个**；`perf-metrics`（`PerfPanel.tsx:301`，全 docs 零登记）；电话族另多挂 4 个（`phone-dialogue`/`phone-elapsed`/`phone-live-transcript`/`phone-wave`）。

### 3.2 野值：族色硬编码且全部与登记值不符

`QueuePanel.tsx:32-37` `FAMILY_COLORS` = `#9C27B0 / #00BCD4 / #4CAF50 / #FF9800`，而 UI_SPEC §6 L162 登记的是 SD3.5 `#8e24aa` / Z-Image `#00838f` / DreamLite `#d81b60`——**4 色全不符且未登记**，直接违反该节红线「新增色必须登记本文档」。

### 3.3 死字段与死码（臃肿面）

| 项                            | 位置                                                                          | 证据                                                                         |
| ----------------------------- | ----------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| `queueSummary` 死字段         | `imageGenStore.ts:184/1353`                                                   | 全仓 `.queueSummary` **唯一命中即赋值行**，零消费                            |
| `submitted`/`markAsSubmitted` | `BenchmarkStore.ts:71-78`                                                     | PERF §10.7 声称"整体砍除"，实际仍在，仅测试引用                              |
| 4 个死 l10n 键                | `phoneCall.title` / `guideToText` / `mineLabel` / `partnerLabel`              | 零消费者；其中 `guideToText` 与 `phoneCall/prompt.ts` 硬编码中文**同义两份** |
| LoRA 运行时挂载               | 代码链完整（`ComposerPanel.tsx:39-44/239-255`、`ImageGenScreen.tsx:970-987`） | **UI_SPEC 全文零条目**（grep `lora` 零命中），违"文档先行"                   |

---

## 四、D4 锚 / D5 态：指南针"登记即生效"是假象

### 4.1 CP-APP 七条登记但代码无匹配规则（实测）

`COMPASS_REGISTRY §2` 登记 CP-APP-000..016 共 17 条，而 `src/debug/errorRegistry.ts` 的 `ERROR_PATTERNS` 实测只有 **9 条**：001-006 + 014-016。

→ **CP-APP-007（反推失败）/ 008（转写失败）/ 009（工具调用）/ 010（前台服务）/ 011（TTS 模型）/ 012（基准编排）/ 013（上下文满）七条文档标 `✅ 已登记`，但 `matchFirstError` 永远匹配不到**。指南针的核心承诺是"犯错现场就应有修复指引"，这七条等于没做。

### 4.2 ST-APP 状态指南针缺域与漂移

- **nighttask 整域缺失**：`stateCompass.ts:17-188` 的 `STATE_MAP` 无 nighttask 键，而 COMPASS §3.3.2 登记了 idle/running/stopping/error 四态。
- **imagegen.captioning 缺失**：文档有、代码落 UNKNOWN。
- **audio 域词面双向漂移**：文档 idle=`start_transcribe/speak`、transcribing=`await_transcript`、含 `loading/speaking`；代码 idle=`pick_audio_task`、transcribing=`await_transcribe`、有 `generating` 无 `loading/speaking`。

### 4.3 悬空指针（可达性实测）

| 指针                                  | 引用处                                                | 实测                                                                                                |
| ------------------------------------- | ----------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `docs/sop/LLAMARN_JNI_RESTORE_SOP.md` | `errorRegistry.ts:32`（CP-APP-001 deepDive）+ COMPASS | **MISS**（姊妹脚本 `restore-llamarn-jnilibs.js` 存在）                                              |
| `docs/IMAGEGEN_UI_SPEC.md`            | COMPASS CP-APP-007 deepDive                           | **MISS**（真身缺 `POCKETPAL_` 前缀）                                                                |
| `architecture/tts.md`                 | `TTSStore.ts` 等 **11 处**                            | **MISS**（目录不存在；上轮只加了免责声明块，未改指针，而 TTS_SPEC §6.1 声称"注释指针同步改指此处"） |
| `scripts/aios/import_identity.py`     | AIOS_CORE_SPEC / CP-APP-014                           | MISS，但 SPEC 已标 `⏳ 待建` → **正确标注，非幽灵**                                                 |

### 4.4 反向幽灵：真实文件被文档判为不存在

`MASTER_LOG §144` 与 `AIOS_CORE_SPEC v1.2 L86` 均称 `errorReport.ts` 是"幽灵文件（全 git 历史不存在）"并据此**删除了 SPEC 引用**。实测：`src/utils/errorReport.ts` **存在（135 行）**，git 首提交 `0aa53d9`（2026-08-18，早于 §144 的 09-05），且有三个生产消费者（`imageGenStore.ts:37`、`useChatSession.ts:54`、`AudioWorkshopTab.tsx:41`），本身承担 `matchFirstError → CP 三字段` 导航。

→ §144 的处置方向反了：把真实存在的 CP 出口判成幽灵，再以"出口=仅 AgentRunner tool.error"作**文档补丁**固化误判，使 SPEC/COMPASS 与代码背离。**这是本仓"以文档修改掩盖判断失误"的样本**。

### 4.5 §144 账目不闭合

§144 称"10 项缺口 G-1..G-10 全部处置"，但正文仅记 P0/G-3/4/5/6/8/9/10，**G-1、G-2 无任何处置描述** → 无法复验。

---

## 五、D6 策：文档失真清单（代码与文档互斥，需裁定以谁为准）

| #   | 位置                              | 文档说                                                                  | 代码做                                                                                                       | 建议裁定                                                                   |
| --- | --------------------------------- | ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------- |
| 1   | QUEUE_SPEC §六.4 / §十 CP-APP-004 | 「队列开始前校验 engineMutex，冲突→**显式报错**」                       | `engineMutex.ts:66-85` 是**自动抢占释放 chat**，不报错                                                       | **以代码为准回写文档**（改文档；若照文档实现会改互斥语义）                 |
| 2   | UI_SPEC §4 L148                   | 三点波浪「纯 Animated + **useNativeDriver**」                           | `useWaveDots.ts:53/58` 一律 `false`（L13-16 记明红线理由：分钟级挂载致 TurboModule weak ref 溢出 tombstone） | **以代码为准**（AUDIO_SPEC §6 已写对，UI_SPEC 未同步）                     |
| 3   | QUEUE_SPEC §九 L134-137           | `toVersion: 3`                                                          | `schema.ts` version 10 / `migrations.ts` toVersion 10；**同卷 §十三 S3 自己写 v10**                          | 改文档（卷内自相矛盾）                                                     |
| 4   | CHAT_UI_SPEC §21 L513             | 控制区 按住说话 **96px** + 挂断 **64px**                                | 两钮**等大 72×72**（`styles.ts:225/250`，单测钉住相等）；PHONE_SPEC §11.8/§14.6 才是现行口径                 | 改文档 + 改 `styles.ts:12` 陈旧注释                                        |
| 5   | CHAT_UI_SPEC §21 L511             | 伙伴名回落 pal.name→**会话标题**→小黄鸡                                 | `ChatScreen.tsx:388-389` **明确不取会话标题**（注释即裁定）                                                  | 改文档（两份文档对同一回落链互斥，代码站 PHONE_SPEC §13.3 一边）           |
| 6   | PERF §10.2 表 L254                | 生图用例演出「折线面积图 + **进度环**」                                 | §10.5 L219 已划删「步耗时进度环」；代码零命中                                                                | 改文档（表格未同步；UI_SPEC v5.6② 同残留）                                 |
| 7   | AIOS_CORE_SPEC L92                | 「**三**实体图」                                                        | `kg.ts:5-6/20` 明确两实体（`'memory' \| 'conv'`）                                                            | 改文档                                                                     |
| 8   | TTS_SPEC §6.2 L110                | `REPLY_TIMEOUT_MS` 在 `session.ts:31`                                   | 实际 **L34**（L29-33 是其注释块）                                                                            | 改行号                                                                     |
| 9   | `session.ts:65` 字段注释          | 「超时自动回聆听（**回调丢失兜底**）」                                  | 同文件 L31-33 与 §16.4 已裁定「只是卡死保险」                                                                | 改注释（文件内自相矛盾）                                                   |
| 10  | `turnTelemetry.ts:19-20` 注释     | `firstToken` = 「进入 awaiting_reply → 首个内容 token」                 | 文档 §19.2 已更正为「转写返回 → 回合声明」+ 两路径警示                                                       | 改注释（文档对、实现对、**离代码最近的注释是旧的**）                       |
| 11  | PHONE_SPEC §15.2 L721             | 「遗留：`@react-native-voice/voice` 依赖 + patch + jest mock 现为孤儿」 | **已彻底清完**：package.json / yarn.lock 对 `/voice/i` 零命中，`patches/` 仅 2 个无关补丁                    | 销账（账已销、文档仍挂，会诱导重复清理）                                   |
| 12  | TTS_SPEC §16.3 L784               | 「`engine !== 'system'` 特判**全删**」                                  | 门判定确已收，但按 id 字面量特判仍存 2 处（`runtime.ts:138`、`stopOutcome.ts:27`）                           | 改措辞（"全删"过强；这两处不在 store，以"新增引擎不需改 store"限定则成立） |
| 13  | STARMAP v2.4 imageGen 域          | 代码根含 `src/services/imageGen*`                                       | Glob **0 命中**（store 在 `src/store/imageGenStore.ts`，services 下仅 `chatImageTask.ts`）                   | 改清单                                                                     |
| 14  | QUEUE_SPEC §五 L104               | reaction「**三条件**」                                                  | 实为四条件（L222-227 拆 running/stopping）；同卷 S5 又写四条件                                               | 改文档                                                                     |
| 15  | AUDIO_SPEC §3.1 L75               | 「显式校验扩展名（16kHz）」                                             | 文案与判定逐字落地，但**只校后缀不校采样率**                                                                 | 改措辞（功能边界仍锋利，只是别声称校了采样率）                             |
| 16  | AUDIO_SPEC 版本行 L19-26          | —                                                                       | 版本行乱序（v1.12 排在 v1.11/v1.10 前）                                                                      | 重排（影响按版本追待办的可审计性）                                         |
| 17  | QUEUE_SPEC frontmatter            | `relates` 同时列 `POCKETPAL_IMAGEGEN_UI_SPEC` 与 `IMAGEGEN_UI_SPEC`     | 后者不存在（即 §4.3 悬空指针同源）                                                                           | 改文档                                                                     |

**另**：`PHONE_SPEC §12.2` 的 P1 七项（ASR 增量流式回显 / 免按住打断 / 选完语音回通话页 / 通话中切模型 / 打断提示上主状态行 / 「内容由 AI 生成」署名 / 转写态防闪驻留 ≥400ms）与测试债（电话模式 **e2e 零覆盖**：非 vendor `e2e/` 87 文件对 `phone-call-button|PhoneCall|电话模式` 零命中、无 PhonePage）**文档已诚实自标未做**，代码逐项核实为无 → 属"规划了没做"的最大一块，需排期或明确降级。

---

## 六、祖传债 vs 本仓自研（决策前提，必须区分）

**上游 PocketPal 祖传（fork 自带，按"不主动扩面"处理）**：`ChatSessionRepository.ts` 的 10× `.catch(() => null)`（把 DB 故障与"记录不存在"混为 null，可能把数据库损坏渲染成"会话已删除"）、`loadReleaseMethods.ts` 的 `author/repo||'unknown'` 路径探测、`HFStore.ts:255-264` 空结果节流、`useMemoryCheck` 骨架、`imageUtils/importUtils` 双写、`config/urls.ts`、ChatView 的 `istanbul ignore` 群、通用 `|| 'Unknown error'` 文案层。

**本仓自研（须按本仓红线复核，问题集中在此）**：§1.3 内存检查 `fits` fail-open 的实际触发分支、§2.5 全部双份常量、`imageGenStore`/`imageGenQueueCore`/`dreamLiteEngine`(11× `as any`)、`aiosCore/*`、`aiosMemory/*`、`phoneCall/*`、`tts/*`、`talents/*`、CP/ST 登记面。

**类型与豁免面（量化基线）**：`@ts-ignore` **0**、`@ts-expect-error` **0**、`as any` **83 处/45 文件**（热点 `dreamLiteEngine` 11 处=引擎契约未类型化）、`istanbul ignore next` **8 处**（全在动画/滚动/键盘等 RN 不可单测处，未掩盖用户失败分支）、`.catch(` 全仓 93 处（空/仅注释体 48）、`try…catch` 空体 61。
**正向确认（重要，防止过度整改）**：`catch { return true }` / `return {ok:true}` 假成功 **全仓 0 命中**；`ttsStore.play()` 内部已把失败转成可见 `speakIssue='failed'`，故 `PlayButton.tsx:55/67`、`ChatView.tsx:802`、`AudioActionBar.tsx:98` 的 `.catch(() => {})` 经核为**合理防御**（上层已兜显示），非掩盖——**这三处不改**。

---

## 七、收口方案（六波，每波独立可验，含"删什么"）

> 排序依据：**用户可感知故障 > 单状态机破口 > 治理面假生效 > 文档失真 > 祖传债**。
> 锋利优先：能删不加、能收不叠、能回写文档不硬改码。

### W1 失败可见性收口（P0，最高优先）

| 动作                                                 | 落点                            | 验收                                                                                                 |
| ---------------------------------------------------- | ------------------------------- | ---------------------------------------------------------------------------------------------------- |
| 队列 cancel 去三重吞：失败必须置当前抽 failed 并留痕 | `imageGenStore.ts:1417`         | 构造 cancel 失败（DRC 注入或桩）→ 任务卡转 failed + `queueState` 回 planning，不出现 `stopping` 常驻 |
| `stop()` 忙等加**有界超时 + 显式失败出口**           | `imageGenQueueCore.ts:276-278`  | 超时后走 failTask 而非永挂；单测覆盖"cancel 不返回"分支                                              |
| 心跳超时收口到任务卡                                 | `imageGenStore.ts:398-414`      | 超时后当前抽必为 failed（不再永停 running），复用 UI_SPEC §4 唯一报错出口                            |
| 内存检查 fail-open 改 fail-visible                   | `useMemoryCheck.ts:195-202`     | catch 分支置 `unknown` 并保留警告，**绝不写 'fits'**                                                 |
| 朗读早退/音色加载失败可见                            | `audioStore.ts:313`、`:305-307` | 早退给 banner；单引擎失败在清单上标注缺失（不静默少一块）                                            |
| 源音频持久化失败可见                                 | `audioStore.ts:183-190`         | 降级为"对照播放不可用"显式提示                                                                       |

### W2 队列与保活单状态机（P0/P1）

| 动作                                                                                                     | 落点                                                                         | 验收                                                                                                            |
| -------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| **删 `queueState` 镜像与 `syncQueueMirror`，全站只认 `queueCore.state`**（MobX 侧用 computed 直读 core） | `imageGenStore.ts:176/1346/1364/1375/1399/1410/222-227`                      | 全仓 `queueState` 零命中；7 个判定点归一；同一函数内不再混源                                                    |
| `syncPoll` 判据纳入队列两态                                                                              | `:346`                                                                       | 队列跑批时采样轮询不被关掉（对齐 §六「nightTask 恒 busy」意图）                                                 |
| `nightTaskRegistry` **begin 返回 ticket，end 按归属释放**（或按域分计数 + 全局聚合）                     | `nightTaskRegistry.ts`、`imageGenStore.ts:237-246`、`ChatScreen.tsx:305-314` | 新增用例：队列 running 中结束通话，前台服务**不停**；两侧各自 end 后计数归零才停                                |
| `phoneVisible` 与 `inCall` 职责显式化：`inCall` 为唯一判定源，`phoneVisible` 仅作 overlay 挂载开关       | `ChatScreen.tsx:267/301-317`                                                 | 文档 §16.4 措辞与代码一致（要么改码归一，要么改文档承认两份并说明职责边界）——**不许继续用"不留第二份"描述现状** |

### W3 指南针真生效（P1）

| 动作                                                                             | 落点                                             | 验收                                                                                         |
| -------------------------------------------------------------------------------- | ------------------------------------------------ | -------------------------------------------------------------------------------------------- |
| 补 CP-APP-007..013 的 `triggerRegex`（7 条）                                     | `errorRegistry.ts`                               | 每条有命中用例；`COMPASS_REGISTRY` 状态列由「✅ 已登记」升级为「✅ 已落地（含 regex 行号）」 |
| 补 ST-APP nighttask 整域 + imagegen.captioning，audio 词面对齐                   | `stateCompass.ts:17-188`                         | STATE_MAP 与 COMPASS §3.3 双向对账零差                                                       |
| 修 3 处悬空指针（SOP 文档、IMAGEGEN_UI_SPEC 前缀、`architecture/tts.md` 11 处）  | `errorRegistry.ts:32`、COMPASS、`TTSStore.ts` 等 | 全仓 `docs/`+`src/` 内 markdown/注释路径可达性脚本跑通零 MISS；**TTS_SPEC §6.1 销账**        |
| 纠 §144 反向幽灵：恢复 errorReport 的 CP 出口地位或显式合并到 AgentRunner 单出口 | `AIOS_CORE_SPEC L86`、§144                       | SPEC 与代码一致；G-1/G-2 补齐定义与落点（账目闭合）                                          |
| 新增治理闸门：登记类文档条目必须有代码对账项                                     | `scripts/guard_*`                                | 无 regex 的 CP / 无键的 ST 在 CI 报警（防再次"登记即生效"假象）                              |

### W4 文档-代码对账清零（P1/P2，§5 全部 17 项 + §3.1/3.3）

- 逐条按"建议裁定"列回写；**以代码为准的 6 项**（互斥语义、useNativeDriver、族色、回落链、进度环、三实体）改文档；**以文档为准的**（族色硬编码、采样率措辞）改码或改措辞。
- 补 testID 登记（队列 11 + 音频 21 + perf-metrics + 电话 4），删 2 处"登记未挂"或补挂。
- `QueuePanel.FAMILY_COLORS` 收编到域色 token（违 UI_SPEC §6 红线）。
- 补写 **LoRA 运行时挂载** 的 UI_SPEC 条目（代码已有完整链，文档零条目）。
- 改 2 处陈旧注释：`turnTelemetry.ts:19`、`session.ts:65`。
- 销账：§15.2 voice 遗留、TTS_SPEC §6.1。

### W5 死码/死键/野值清理（P2，纯删）

`queueSummary`（死字段）、`submitted`/`markAsSubmitted`（文档称已砍）、4 个死 l10n 键（含 `guideToText` 与硬编码中文同义两份）、`HF_DOMAIN`/`AIOS_LOGS_DIR`/`DEFAULT_SUPERTONIC_LANGUAGE` 双份常量收口、`CJK_RE` 统一为一份（**先裁定字符范围**，Ext-A 要不要含属产品决策）。

### W6 祖传债与"明确不做"（P2，只登记不扩面）

`ChatSessionRepository` 的 `.catch(() => null)`（建议：区分 DB 故障与不存在，故障必须可见——**唯一建议动祖传的一处**，因影响面是"聊天记录被误判删除"）、`HFStore` 空结果节流、`loadReleaseMethods` 路径探测兜底、ChatView `istanbul ignore` 群 → 登记为 fork 债，不排期。

---

## 八、明确不做（防臃肿，与"要做的"同等重要）

1. **不补播报启动延迟打点**（§19.3 裁定不变，但**理由要重写**——原理由引用了虚构常量；新理由：跨域回调污染单链，且当前无任何决策在等这个数）。
2. **不照 §12.2 P1 七项全做**：ASR 增量流式回显需新 zipformer 资产（§9.1 未立项）、免按住打断属交互模型变更（§14.3 裁定"只测不断"）→ 建议**只挑 3 项低成本高收益**：转写态防闪驻留 ≥400ms、打断提示上主状态行、「内容由 AI 生成」署名行。
3. **不新建电话 e2e 框架**：现有 WebdriverIO 已覆盖其他域，电话域补 2-3 条主链路用例即可（按住说话→转写→回复→挂断），不为其扩基建。
4. **不动引擎层**：`engineMutex` 抢占语义、`dreamLiteEngine` 的 `as any`（11 处属引擎契约未类型化，但改它=碰禁区）→ 只登记，本轮不碰。
5. **不追求 `.catch(() => {})` 数量清零**：48 处空 catch 中经核为合理防御/幂等/mutex 链式吞的占多数；**只按"用户是否可感知失败"处置 W1 那 6 处**，不搞一刀切整改。
6. **不再为 core 域采集面加消费者凑数**：`readStarmap`/`readIterations`/`readEmotions`/`WakeCheckResult` 目前零生产消费方（仅测试引用）→ 要么明确"供未来消费"并在 SPEC 标注，要么按"无消费方不接线"裁剪冷启动无条件采集（**当前是采集侧双标：对 kg 用锋利裁剪、对星图/账本无条件落盘**）。

---

## 九、执行建议

- W1 + W2 是**故障级**（用户按了停止没反应、夜间长跑被通话误杀、内存谎报），建议先打，两波各自独立可验、可分别提交。
- W3 是**治理假象级**（指南针七条形同未登记），不修则"犯错现场有修复指引"这条核心承诺在 7/17 的锚点上是空的。
- W4 体量大但风险低（多为文档回写），可并行；W5/W6 属清理，放最后。
- 每波收口必须：先改 SPEC → 落码 → 门禁（tsc/eslint/prettier/定向 jest）→ 真机可感知验证 → **提交后复验 HEAD**（§0.2 新纪律）。
