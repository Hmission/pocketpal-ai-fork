---
doc_id: POCKETPAL_PHONE_SPEC
module: chat
type: spec
status: active
version: "1.0"
created: "2026-09-04"
updated: "2026-09-04"
relates: [POCKETPAL_CHAT_UI_SPEC, POCKETPAL_AUDIO_UI_SPEC, POCKETPAL_STARMAP_DOMAINS, POCKETPAL_DESIGN_SPEC]
---

<!-- D-FORMAT:v3 -->

# PocketPal 电话模式设计规范（PHONE_SPEC）

> 单一事实源：聊天页「电话模式」（豆包式语音通话）的入口、交互、编排链路与边界定稿。
> 任何电话模式迭代必须先更新本文档再改代码（文档先行门禁）。
> 上游契约：CHAT_UI_SPEC（聊天页布局/顶栏）+ AUDIO_UI_SPEC（ASR/TTS 引擎资产）+ STARMAP_DOMAINS（chat 域）。
> 版本：v1.0（2026-09-04 首版定稿，路线 A 定案）

## 1. 产品定位

**电话模式 = 端侧语音通话**：聊天页顶栏电话图标 → 全屏通话界面 → 按住说话 → 语音回复（流式 TTS 播报）。
与聊天页输入框麦克风（听写输入：语音→文字→手动发送）互补：电话模式是**自动闭环**（说话→回复→播报），
所有消息以普通聊天消息落库——**人设、记忆、智能体逻辑 100% 走现有链路，零改动**。

**心法（复用而非新建）**：本功能不新增任何引擎与模型，全部复用既有资产：

| 环节 | 复用资产 | 位置 |
|---|---|---|
| 录音 | AudioRecordModule（PCM16 16kHz mono→wav） | android/AudioRecordModule.kt（B33 已落地） |
| 转写 | SenseVoice + audioStore.transcribeTask / asrState | src/store/audioStore.ts |
| 推理/智能体 | useChatSession.handleSendPress（AgentRunner 全链路） | src/hooks/useChatSession.ts |
| 流式播报 | ttsStore 流式会话（onAssistantMessageStart/Chunk） | src/store/ttsStore.ts |
| 记忆/人设 | assembleContext（SOUL.md + 召回注入） | src/services/aiosMemory/contextAssembler.ts |
| 顶栏 | ChatHeader（HeaderRight 旁插电话图标） | src/components/ChatHeader/ChatHeader.tsx |

## 2. 产品红线（首版定案）

1. **工具禁用 + 引导**：电话会话 systemPrompt 注入引导片段（见 §5）。模型不调用任何工具；
   工具需求（联网/生图/玩具/冒险等）明确引导用户「切回文字模式」。理由：端到端语音链路
   工具调用未验证 + 端侧多轮工具 loop 延迟不可接受（决策记录见 2026-09-04 考察）。
2. **人设/记忆全保留**：走现有 assembleContext 链路，一行不改。
3. **聊天记录全量落库**：通话中的 user/assistant 消息 = 普通文本消息，记忆召回、知识库照常消费。
4. **权限红线**：RECORD_AUDIO 已声明（AudioRecordModule 注释），入口处 JS 申请（复用 ChatInput 同款逻辑）。
5. **锋利原则**：不兜底——SenseVoice 未就绪时电话入口禁用（引导下载）；转写空文本提示回到聆听态；
   模型未加载走现有 handleSendPress 错误路径。

## 3. 入口与页面结构

### 3.1 入口：ChatHeader 电话图标

- 位置：ChatHeader 右区，HeaderRight 之前（顶栏模型胶囊之后）。
- 图标：PhoneIcon（Lucide 同族描边 2px，iconSize token），testID 登记 `phone-call-button`。
- 禁用态：`audioStore.asrState !== 'ready'` 时半透明禁用（transcribeTask 依赖 SenseVoice）；
  点击禁用图标 → 提示「语音模型未下载，请先在音频工坊完成下载」（audioStore 下载状态机引导）。

### 3.2 通话界面：ChatScreen 内全屏 overlay

```
┌─────────────────────────────────────┐
│ ① 顶栏：当前伙伴名 + 模型名（胶囊）     │
│    右上角 「收起」按钮（退出通话）       │
├─────────────────────────────────────┤
│ ② 状态区（中部）：                     │
│    - 聆听中：麦克风大图标 + 「我在听…」 │
│    - 思考中：转圈 + 「思考中…」         │
│    - 播报中：波形动效 + 「播报中…」     │
│    - 最近一条消息摘要（2 行截断）       │
├─────────────────────────────────────┤
│ ③ 控制区（底部）：                     │
│    - 按住说话 大圆钮（84dp，primary 底）│
│    - 录音中变「松开发送」（红色）        │
│    - 挂断按钮（次要，退出通话）         │
└─────────────────────────────────────┘
```

- 背景：surface 全底（设计 token），不另造容器（弹窗范式 OverlayCard 语义对齐）。
- 三态文案走 l10n（§7），动效复用 useWaveDots（生图三点波浪同源，不新建动画体系）。
- 通话界面挂 ChatScreen 根节点内部（isPhoneCallVisible 控制），与 useChatSession 同实例，
  通话消息实时进入聊天流（通话结束回到聊天页即可见）。

## 4. 会话编排（核心，服务层）

### 4.1 状态机

```
idle ──startRecording()──▶ recording ──stopAndSend()──▶ transcribing
  ▲                          │                          │
  │                          │（转写空文本→回 idle）      │（非空→append user + send）
  │                          ▼                          ▼
  └──────────────────────── idle ◀──speakDone ◀── speaking ◀── awaiting_reply
                        （挂断/完成均归 idle）
```

| 状态 | 含义 | 退出条件 |
|---|---|---|
| idle | 聆听中，可开始录音 | startRecording / hangUp |
| recording | 按住说话中 | stopAndSend（松手） |
| transcribing | 转写中 | 空文本→idle；非空→发送 |
| awaiting_reply | 模型推理中 | 首个回复 token→speaking |
| speaking | 流式播报中 | 播报完成→idle；新录音→先停播再 recording |
| error | 任一环节失败 | 提示后回 idle（不悬挂） |

### 4.2 流水线（PhoneCallSession 服务类，依赖注入可单测）

```
startCall()
  - 前置校验：asrState==='ready'（否则返回错误码 PHONE_ASR_NOT_READY）
startRecording()   → AudioRecord.startRecording()
stopAndSend()      → AudioRecord.stopRecording()
                   → transcribeTask(wavPath)
                   → 空文本：emit('empty') → idle
                   → 非空：send(text, {phoneMode:true}) → awaiting_reply
                       （send = 注入的 ChatScreen handleSendPress；append user 消息在其内部）
onReplyText(delta)  → tts 播报（注入的 tts 播放器，复用 ttsStore 流式会话）
onReplyDone()      → idle
hangUp()           → 停止播报 + 回 idle（不删除已落库消息）
```

- 对话流编排类 `PhoneCallSession` 放 `src/services/phoneCall/`（纯 TS，不 import RN UI），
  依赖四件套注入：`{record, transcribe, send, speak}`——单测用桩注入验证全流水线。

### 4.3 并发与中断

- 用户在任何状态按住说话（新录音）→ 先 `speak.stop()` 中止播报，再进入 recording（说话优先）。
- 通话中 tts 播报与 autoSpeak 互不干扰：电话模式强制走 ttsStore 流式（与 autoSpeak 开关无关），
  挂断时 `ttsStore` 停止当前流。
- 引擎互斥遵循既有 engineMutex 语义：TTS 引擎切换走 ttsRuntime.acquire，不新开通道。

## 5. systemPrompt 注入（工具禁用引导）

- **注入点**：`useChatSession.handleSendPress` 的 `assembleContext` → `effectiveSystem` 组装处
  （src/hooks/useChatSession.ts）。send 参数透传 `phoneMode: true` 时，在 system 消息尾部追加
  `PHONE_MODE_GUIDE` 片段（src/services/phoneCall/prompt.ts 常量）。
- **片段内容**（中英随 l10n 由模型语言决定，注入原文为中文定稿）：

  > 当前为语音通话模式。你只进行语音对话，**不调用任何工具**（不联网搜索、不生成图片、
  > 不制作玩具、不冒险、不读取网页）。如果用户请求需要工具能力的事项，明确告知：
  > 「这个操作需要回到文字模式」，并简短询问是否切换。

- 注入条件收敛：仅 handleSendPress 收到 phoneMode 标记的那一轮注入（消息已在会话中，
  后续轮次由上下文自然延续，不逐轮重复注入）。

## 6. 失败路径

| 场景 | 行为 |
|---|---|
| 录音权限拒绝 | 提示「需要麦克风权限」→ idle |
| SenseVoice 未就绪 | 入口禁用；点击提示引导下载 |
| 转写空文本 | 提示「没有听到声音，请再试一次」→ idle |
| 转写失败 | 提示转写失败 → idle |
| 模型未加载 | 走现有 handleSendPress 模型缺失错误路径（不吞错） |
| 播报引擎缺失 | ttsStore 现有降级语义（不崩溃，仅无声，聊天记录不受影响） |

## 7. l10n 文案登记

新增 key 前缀 `phoneCall.`：`title`（电话通话）、`listening`（我在听…）、`thinking`（思考中…）、
`speaking`（播报中…）、`holdToTalk`（按住说话）、`releaseToSend`（松开发送）、`hangUp`（挂断）、
`emptySpeech`（没有听到声音，请再试一次）、`asrNotReady`（语音模型未下载，请先下载语音模型）、
`permissionDenied`（需要麦克风权限）、`guideToText`（这个操作需要回到文字模式）、`failed`（转写或发送失败，请稍后重试）——
sync 至 en 基准 + zh 同源（l10n 缺失回退英文，既有机制）。

## 8. 验收标准

1. 真机（K90）：顶栏电话图标 → 通话界面 → 按住说话 → 流式语音回复 + 聊天记录文本完整落库。
2. 记忆：通话后 memory 召回（searchMemory）可命中通话内容（文本历史消费闭环）。
3. 工具边界：电话中说「帮我搜一下天气」→ 模型口头引导回文字模式，不产生工具调用。
4. 自动播报与挂断：挂断即时停止语音；新录音中断旧播报。
5. tsc --noEmit 零错；jest 新增 phoneCall 会话测试全绿；chat 域组件测试不回归。

## 9. 非目标（边界）

- **不做端到端语音模型直通**（路线 B：Qwen3-Omni-4B / MiniCPM-o 2.6 + llama.rn vocoder 链路，
  llama.rn 0.12.7 API 已备，列为实验分支后置，数据说话再定）。
- 不做免提/VAD 自动断句（首版 = 按住说话，交互收敛）。
- 不做通话专属气泡/专属消息类型（复用现有消息卡）。
- 不新增 Drawer/设置页入口（单入口 = 聊天页顶栏图标）。
- 不改引擎层（llama.rn / sherpa / ONNX JNI 为 UI 改造禁区，星图红线）。