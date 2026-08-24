---
doc_id: DRC_COMPASS_REGISTRY
module: root
type: registry
status: active
version: "1.2"
created: "2026-08-19"
updated: "2026-08-23"
relates: [DRC_SPEC, COMPASS_SYSTEM_SSOT, STATE_COMPASS_ENGINE_SELF_NAVIGATION_SSOT, WORKSPACE_TOOL_ERROR_FEEDBACK_SPEC, ONDEVICE_VIDEO_GEN_ANALYSIS]
---

<!-- D-FORMAT:v3 -->

# 小黄鸡 App 侧指南针注册表（DRC_COMPASS_REGISTRY）

> 唯一事实源：App 端（TypeScript/React Native）指南针编号索引。与母仓 `COMPASS_REGISTRY.md`（Python 侧）同构，编号域分离：App 侧用 `CP-APP-NNN` / `ST-APP-NNN`。
> 新增错误/状态必须在此登记再写入代码（指南针五秒原则：定位/导航/深入）。

## 1. 六维对齐

| 6D 维度 | App 侧落地 |
|---|---|
| D4 锚（CP） | `CP-APP-NNN` 错误锚点 → errorRegistry + errorReport |
| D5 态（ST） | `ST-APP-NNN` 状态指南针 → stateSnapshot STATE_MAP |
| D6 策（SG） | nextAction 字段（导航=策略建议） |

## 2. 错误指南针（CP-APP-NNN）

格式：定位（错误文本匹配）→ 导航（第一步动作）→ 深入（文档/代码指针）。

| 编号 | 定位（triggerRegex） | 导航 | 深入 | 状态 |
|---|---|---|---|---|
| CP-APP-000 | 未知错误（未收录） | 登记到本文档 §2 | docs/DebugRemoteControl/DRC_SPEC.md | ✅ 已落地 |
| CP-APP-001 | JSI bindings not installed | 执行 node scripts/restore-llamarn-jnilibs.js | docs/sop/LLAMARN_JNI_RESTORE_SOP.md · scripts/restore-llamarn-jnilibs.js | ✅ 已落地 |
| CP-APP-002 | OutOfMemory / OOM / PSS | 降 n_ctx 或换小模型；检查 session 释放是否 await | docs/POCKETPAL_MODEL_MATRIX.md | ✅ 已落地 |
| CP-APP-003 | model not found / modelLoadError | models.scan 重扫；校验 manifest 与文件一致性 | src/utils/imageGenManifest.ts | ✅ 已落地 |
| CP-APP-004 | engine busy / 互斥超时 | 等引擎释放重试；检查未 await 的释放 | src/store/engineMutex.ts | ✅ 已落地 |
| CP-APP-005 | OpenCL / Vulkan / hang | imagegen 命令显式 backend:"CPU" 回退 | docs/SD35_OPENCL_WHITE_IMAGE_ANALYSIS.md | ✅ 已落地 |
| CP-APP-006 | ERR_ / 生图失败 / txt2img | 检查 manifest 模型族、LoRA 路径、seed 复现 | docs/POCKETPAL_IMAGE_GEN_UPGRADE_PLAN.md | ✅ 已落地 |
| CP-APP-007 | 反推失败 / caption 失败 / 视觉模型未加载 | 检查 Qwen3.5+mmproj 在机（MODEL_MATRIX #3/#4）；engineMutex chat 槽释放后重试 | docs/IMAGEGEN_UI_SPEC.md §7（v4） | ✅ 已登记（2026-08-21） |
| CP-APP-008 | 转写失败 / ASR 失败 / 录音权限 | 检查 SenseVoice 模型在机（MODEL_MATRIX §2.2 A1）；RECORD_AUDIO 权限引导；重试转写 | docs/POCKETPAL_AUDIO_UI_SPEC.md | ✅ 已登记（2026-08-21） |
| CP-APP-009 | 工具调用错误 / tool.error / 工具返回 error | 按错误回传中的 guide（正确调用示例）修正参数后重试；同一工具连续失败 2 次才可放弃，并在最终回答中如实说明 | docs/workspace/WORKSPACE_TOOL_ERROR_FEEDBACK_SPEC.md · src/services/agent/AgentRunner.ts | ✅ 已登记（2026-08-22） |
| CP-APP-010 | VIDEO_TASK_START_FAILED / 前台服务启动失败 / WakeLock / 夜间任务被杀 | 检查 FOREGROUND_SERVICE + FOREGROUND_SERVICE_DATA_SYNC 权限与 service 声明（targetSdk 36 需 foregroundServiceType）；查 logcat 是否被 PSS 看护/内存配额杀（压内存优先于白名单，见 ONDEVICE_VIDEO §7.1） | android/app/.../VideoTaskServiceModule.kt · AndroidManifest.xml · docs/ONDEVICE_VIDEO_GEN_ANALYSIS.md §7.1 | ✅ 已登记（2026-08-23） |
| CP-APP-011 | TTS 模型未安装完整 / sample_rate does not exist / 生成噪音 | 检查 TTS 模型下载源是否为 sherpa 兼容源（kokoro 需 metadata+tokens.txt、kitten 需 sherpa 官方 v0.1 生成链四件套）；**kitten 生成链下载已补齐（§81，Phase 2 动态枚举 espeak）**，新装机经下载链即可齐备；kokoro 换源=降版本（v1.0→v0.19）+ fork/sherpa 双链耦合，裁定不动，生成链靠 sherpaConvert 下载后转换兜底 | src/services/tts/constants.ts · src/services/tts/engines/kitten/index.ts · docs/internal/POCKETPAL_MODIFICATION_MASTER_LOG.md §74.5/§81 | ✅ 已登记（2026-08-23） |

## 3. 状态指南针（ST-APP-NNN）

格式：state（定位）→ nextAction（导航）→ label → terminal。实现：src/debug/stateCompass.ts 域级 `STATE_MAP`（engine/chat/imagegen/model 四域 + 未知降级 unknown）。

### 3.1 engine 域（ST-APP-001~006）

| 编号 | state | nextAction | label | terminal |
|---|---|---|---|---|
| ST-APP-001 | idle | load_model | 引擎空闲 | true |
| ST-APP-002 | loading | await_load_finish | 引擎加载中 | false |
| ST-APP-003 | ready | run_task | 引擎就绪 | false |
| ST-APP-004 | running | await_completion | 任务执行中 | false |
| ST-APP-005 | error | investigate_and_retry | 引擎错误 | true |
| ST-APP-006 | unknown | inspect_state | 未知状态（降级） | false |

### 3.2 chat 域

| state | nextAction | label | terminal |
|---|---|---|---|
| idle | send_message | 会话空闲 | true |
| sending | await_reply | 消息发送中 | false |
| thinking | await_reply | 模型思考中 | false |
| running | await_completion | 回合执行中 | false |
| done | next_turn | 回合完成 | false |
| error | investigate_and_retry | 回合错误 | true |

### 3.3 imagegen 域

| state | nextAction | label | terminal |
|---|---|---|---|
| idle | load_model | 生图空闲 | true |
| loading | await_load_finish | 引擎加载中 | false |
| ready | generate | 引擎就绪 | false |
| generating | await_sampling | 采样生成中 | false |
| captioning | await_caption | 反推进行中 | false |
| done | next_generation | 生成完成 | false |
| error | investigate_and_retry | 生成错误 | true |

### 3.3.1 audio 域（2026-08-21 音频工坊）

| state | nextAction | label | terminal |
|---|---|---|---|
| idle | start_transcribe / speak | 音频空闲 | true |
| loading | await_load_finish | 语音模型加载中 | false |
| transcribing | await_transcript | 转写中 | false |
| speaking | await_playback | 朗读中 | false |
| error | investigate_and_retry | 音频错误 | true |

### 3.3.2 nighttask 域（2026-08-23 夜间长任务模式）

| state | nextAction | label | terminal |
|---|---|---|---|
| idle | start_night_task | 无夜间任务 | true |
| running | await_task_done | 夜间任务运行中（前台服务 + WakeLock） | false |
| stopping | await_release | 任务结束释放中 | false |
| error | investigate_and_retry | 夜间任务异常（前台服务/WakeLock） | true |

> 实现：`nightTaskRegistry.isBusy`（JS 侧单一事实源）+ 原生 `VideoTaskService.isRunning`（调试旁证）。事件流 domain 复用 `imagegen`/`system`，不新增 domain 枚举（BT05 稳定）。

### 3.4 model 域

| state | nextAction | label | terminal |
|---|---|---|---|
| idle | load_model | 模型未加载 | true |
| loading | await_load_finish | 模型加载中 | false |
| ready | run_task | 模型就绪 | false |
| unloading | await_release | 模型卸载中 | false |
| error | investigate_and_retry | 模型错误 | true |

## 4. 事件域编号（ST-APP 补充）

事件流（events.jsonl）domain 枚举：app / nav / chat / imagegen / model / engine / error / system。事件类型清单见 DRC_SPEC §3。

## 4.1 产物工作区事件（2026-08-21，WORKSPACE_SPEC v1）

| 事件类型 | 触发点 | payload | 消费方 |
|---|---|---|---|
| workspace.writing_doc | WritingDocEngine 写动作（init/append/update 等） | {action, project} | 工作区恢复链路/日志 |
| workspace.adventure_state | AdventureStateEngine read/append 多文档动作 | {action, doc} | 冒险多文档日志 |
| chat.tool.error | AgentRunner.executeOne 工具错误分支 | {tool, errorMessage, hasGuide} | 工具失败复盘取证（模型自纠链路观测） |

- 格式指南针三字段：定位（触发点）→ 导航（恢复链路）→ 深入（WORKSPACE_SPEC §六）。
- 玩具域无新事件：toyChest 既有落盘链路不迁移。

## 5. 退役规则

- 根因修复（代码层面不可能再发生）→ 标记 `🗑 已退役`，保留记录用于审计
- 新错误出现 → 登记一行（cpId 递增），写入 errorRegistry.ERROR_PATTERNS
