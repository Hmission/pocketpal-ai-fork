---
doc_id: POCKETPAL_PHONE_SPEC
module: chat
type: spec
status: active
version: "2.4"
created: "2026-09-04"
updated: "2026-09-05"
relates: [POCKETPAL_CHAT_UI_SPEC, POCKETPAL_AUDIO_UI_SPEC, POCKETPAL_STARMAP_DOMAINS, POCKETPAL_DESIGN_SPEC]
---

<!-- D-FORMAT:v3 -->

# PocketPal 电话模式设计规范（PHONE_SPEC）

> 单一事实源：聊天页「电话模式」（豆包式语音通话）的入口、交互、编排链路与边界定稿。
> 任何电话模式迭代必须先更新本文档再改代码（文档先行门禁）。
> 上游契约：CHAT_UI_SPEC（聊天页布局/顶栏）+ AUDIO_UI_SPEC（ASR/TTS 引擎资产）+ STARMAP_DOMAINS（chat 域）。
> 版本：v1.0（2026-09-04 首版定稿，路线 A 定案）
> 版本：v1.1（2026-09-04 真机验证两修复）：①**回复看门狗**——handleSendPress 提前 return/管家直答无回合回调时
> session 不悬挂（REPLY_TIMEOUT_MS 90s 自动回聆听，#14/#15 单测）；②**落流同步**——管家直答路径
> 无 token 回调，ChatScreen observer 派生最后一条回复，落流即 ttsStore.play 播报 + 回聆听（防双播 handledRef
> 先到者胜）；③真机证：录音/AudioRecord→SenseVoice 转写→落库→管家回复→播报 全链闭环（K90 aab688d9）。
> ⚠ 本条的②「落流同步」已于 2026-09-07 被 **§18 取代**（改由管家直答自行声明回合，
> 删除 observer 旁路与 handledRef 仲裁）；①看门狗与③真机结论仍有效。
> 版本：v2.0（2026-09-05 大王四问题升级方案，真机排查取证驱动）：①顶栏电话图标可见性——overlay 残留遮罩根因（自动化关闭 tap 被 HyperOS 拦截）+ 图标视觉弱（20px 灰 stroke）→ icon 胶囊化（triggerPill 语言）；②通话页「打电话式」UI 重设计——联系人区/通话时长/三态波形/跑分迷你行（复用 PerfMiniRow + chatTurnPerf）；③输入反馈与引擎就绪门控——engineStatus 单源进度条，未就绪禁录；④防锁屏防清后台——keep awake + nightTaskRegistry 前台服务双保活。详见 §10。
> 版本：v2.1（2026-09-05 大王上手复测，**根因纠正 + 深化设计**）：①图标「看不见」真因 = svgr `.svgrrc` 将 #333333 映射为 `{props.fill}`，v2.0 误传 `color=` → 图标从未渲染（**推翻 v2.0 遮罩结论**，胶囊化同步撤销，回归 controlHeight 同族触区）；②通话页 v2.1——控制区横向化（按住说话 / 挂断 同一行）+ 头像真实化（品牌小鸡图 + 名字回落链，消除问号）+ 删右上重复 ✕ + 跑分行默认展开；③**播报强制贯通**——ttsStore 流式/回落两道的 `autoSpeakEnabled` 门改 `autoSpeakEnabled || forceSpeak`（电话模式 forceSpeak，根除「听不到语音输出」）+ 播报不可用显式提示行（复用 TTSSetupSheet）；④**转写回显持久化**——轮次级常驻（修「不显示我说过的话」）；⑤六态提示文案体系 + 图标规范。详见 §11。
> 版本：v2.2（2026-09-05 大王二次复测，播报已出声✓）：①控制区**挂断居左 / 按住说话居右**且两钮分居两侧（space-between + xl 边距）——v2.1 居中 gap 40dp 被报「离太近会误触」（§11.8）；②**跑分环境轨迹**——真因不是默认折叠（v2.1 已 true），而是 `chatTurnPerf` 回合制采样在通话页空闲期无数据→展开的是空图；新增 `usePerfTrace`（空闲自采 1Hz、生成期不双采样、挂断即停）（§11.7）；③新增 §12 Roadmap：端到端路线 B 现状实证（未接；JNI 已含 vocoder/audio 符号但核心层能力待 spike 验证）+ P0/P1/P2/测试债清单。
> 版本：v2.3（2026-09-05 大王三次复测 + 豆包四图对标）：①默认伙伴名定「**小妖**」（en `Xiaoyao`），pal 无名不再拿会话标题当名字；②**两钮等大** 72dp（大王：「按住说话比挂断大好多」，§11.8）；③新增 §13：ASR 链路定性（grep 证 App **未接系统语音识别**，聊天页与电话模式共用同一条 SenseVoice 链，不存在重复转写）+ 豆包对标表（可取/不取/待裁定）。
> 版本：v2.4（2026-09-05 大王裁定落地，详见 §14）：①**对话流铺满主区**（§14.1）——取代「我说/它说」两行摘要，observer 直读 chatSessionStore（零 props 接线），伙伴句深色 / 我说浅色，未落库转写补为末条（§11.4 不回退）；系统提示（报错/未加载）**不入字幕**（不是「谁说了什么」）；②**真实振幅通道**（§14.2）——原生 `AudioRecordModule` 读块内算 RMS 以 `AudioLevel` 事件回传（沿用 DownloadModule 事件范式），录音期波形不再造假；③**VAD 只观测不断句**（§14.3）——峰值/均值/最长静音段/假想断点落 logcat 供判读，数据不支持就不上免手；④**归属口径自查修正**（§14.1）——系统提示（`Completion failed` / 模型未加载）不再以「我说」行入字幕，说话人改按 author 判定。

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

- **不做端到端语音模型直通**（路线 B：Qwen3-Omni-4B / MiniCPM-o 2.6 + llama.rn vocoder 链路）。
  原措词为「llama.rn 0.12.7 API 已备，列为实验分支后置，数据说话再定」——
  **该措词已于 2026-09-06 W3 只读复现评估作废并定案**，结论见 §9.1。
- 不做免提/VAD 自动断句（首版 = 按住说话，交互收敛）。
- 不做通话专属气泡/专属消息类型（复用现有消息卡）。
- 不新增 Drawer/设置页入口（单入口 = 聊天页顶栏图标）。
- 不改引擎层（llama.rn / sherpa / ONNX JNI 为 UI 改造禁区，星图红线）。

### 9.1 W3 只读复现评估结论（2026-09-06，不落任何改动）

**结论：路线 B 在当前引擎栈与内存档位下不可行，维持 SenseVoice 级联单链，不立项。**
重新评估只在下方三个触发条件任一成立时启动。

三条硬门槛（均取仓内已有数字，不引外部估测）：

1. **引擎能力（决定性）**：端到端必需 `llama_supports_audio_in/out` 符号，而备份
   `librnllama.so` 无该符号且 `rnllamaBuildFromSource` 关闭（MASTER_LOG :1592、:1648）。
   llama.rn TS 面虽有 `initVocoder()` / `input_audio` 消息类型、JNI `.so` 也含
   `llamaInitVocoder` 等符号，但核心库缺能力 → **「API 在册 ≠ 能力可用」**。
   要补就必重编 llama.cpp/llama.rn = 引擎禁区 → 不进禁区则端到端不可开工。
2. **内存**：`管家常驻 0.69GB + omni 3B 级 Q4 本体 ≈2.0GB + 输出音频解码峰值 ≈1.0GB
   + KV/激活余量` 已贴近 HyperOS **6GB 硬杀线**（MASTER_LOG :74）；而 TTS 单颗
   Kokoro FP32 峰值已标 ~1GB（`tts/constants.ts:92-98`）、聊天主力 4B Q4_K_M =
   2.71GB（MODEL_MATRIX :25）。「边听边想」常驻多一轮直接越线；12GB 机型仓内已定
   「维持不可用」（MASTER_LOG :316）。
3. **收益未被证明**：现级联一轮 = ASR 0.3–1s（:475）+ 回复 2.7–8.2s（:611、:748、:843）
   + TTS 加载 0.87s（:676）；端到端的增量收益（边听边想 / 流式 ASR）尚无需求证明，
   且流式 ASR 本身需新 zipformer 资产、未立项（:671）。

**重评触发条件**（任一成立即重启，否则本条保持关闭）：

- 引擎层解禁且 `llama_supports_audio_in/out` 已在预编产物中可用；
- 出现 ≤2GB 且含音频编解码、经实测可在 4GB 预算内跑通的端侧 omni 资产；
- 产品明确要「边听边想」语义（而非现在的按住说话）且接受中低端机型不可用。

**未找到项（诚实登记）**：除 SenseVoice 外无运行时 ASR 路径（系统识别已于 W1b 删除、
Whisper 仅 e2e 开发工具）；Kimi / Step-Audio / Paraformer 零痕迹；已接线的音频 mmproj
伴生文件零项；电话一轮的**首 token 延迟 / ASR 纯耗时 / 播报启动延迟**分解实测值仓内
不存在（只有整链与分段负载数据）——若将来要拿数据驱动语音体验决策，这三项插桩是前置作业。

## 10. 升级设计 v2.0（2026-09-05 大王四问题，真机排查取证）

> ⚠️ **本节 10.1 根因判定已被 §11.0 推翻**（图标「看不见」真因是 svgr 传参错用 `color`，
> 不是 overlay 残留遮罩）；胶囊化方案已被 §11.1 撤销。其余小节（10.2~10.4）仍有效。

> 排查结论先行（像素级取证）：顶栏图标渲染**无静态缺陷**——冷启动截图像素证
> （顶栏橙色胶囊描边 3.1K px + 深灰图标 2.3K px）；「看不见」= ①通话 overlay 关闭
> tap 被 HyperOS 拦截导致 overlay 残留全屏遮盖（截图证：顶栏/中部空白 + 底部中央
> 84dp 橙色 hold 钮 47K px）；②图标视觉弱（20px 灰 stroke 2px）。

### 10.1 顶栏电话图标可见性（icon 胶囊化）

- **视觉增强**：图标 20→24px；就绪态图标色 primary + 36px 底衬（primary 12% 底 + full 圆角
  + primary 1px 描边——**triggerPill 设计语言**，与模型胶囊/生图顶栏胶囊同族，不另造）；
  禁用态（SenseVoice 未就绪）outline 色 + 0.4 透明不变。
- **交互不变**：testID `phone-call-button`、禁用点击引导下载均保留。
- **残留遮罩防御**（自动化/特殊路径）：overlay 关闭路径统一收口（hangUp/close 共用
  closeOverlay 单函数 + force-stop 恢复现场 SOP 登记 MASTER_LOG）；overlay 打开时
  ChatHeader 不响应（isPhoneCallVisible 门控，双保险）。

### 10.2 通话页「打电话式」UI（v2 布局）

```
┌─────────────────────────────────────┐
│ ① 联系人区（打电话仪式）：             │
│    伙伴头像（pal avatar 资产/品牌黄圆）│
│    名字 + 模型胶囊 + 通话时长 mm:ss    │
├─────────────────────────────────────┤
│ ② 状态区：                           │
│    聆听：大麦克风 + 波纹涟漪（按住脉冲）│
│    思考：三点波浪（useWaveDots 复用）  │
│    播报：波形条 + 「播报中…」          │
│    最近消息摘要（2 行截断，保留）      │
├─────────────────────────────────────┤
│ ③ 跑分迷你行（复用 PerfMiniRow）：     │
│    PSS/内存/CPU/温度 + tok/s + 阶段态 │
│    （chatTurnPerf 数据源，与聊天页同款）│
├─────────────────────────────────────┤
│ ④ 控制区：                           │
│    按住说话 84dp（录音中红 + 涟漪脉冲）│
│    挂断（红）                        │
└─────────────────────────────────────┘
```

- **复用清单（禁止另造）**：useWaveDots（生图三点波浪）/ PerfMiniRow（chat 域跑分迷你行，
  含 PSS 大字/胶囊分级色）/ chatTurnPerf（生成期唯一采样源）/ pal 头像资产 / 通话时长
  计时 = 新轻量 hook（useElapsed，纯数字，无 UI 资产新建）。
- 跑分卡是核心：**复用 PerfMiniRow 完整组件**（含遥测/表演层），仅位置差异；
  数据源 chatTurnPerf 由 handleSendPress 既有链路驱动，零接线成本。

### 10.3 输入反馈 + 引擎就绪门控

- **引擎就绪门控**（解决「没加载完就输入、输入无效」）：
  - 数据源：engineStatus（单一事实源）——chat 引擎 phase（idle/loading/ready/error）
    + 管家（prompter）phase 任一 ready 即可通话（管家直答/chat 引擎二选一）。
  - UI：通话界面进入时若双引擎均未 ready → hold 按钮禁用 + 显示加载进度条
    （engineStatus .progress/.stage 数据，同模型加载卡片三点波浪语言）；
    ready 后自动解锁并短提示「可以说话啦」。
- **输入反馈闭环**：
  - 录音中：红钮 + 「松开发送」+ 按压涟漪（既有）+ 新增录音振幅波形（AudioRecord
    音量回调可选，首版不做——涟漪脉冲即可，不扩面）。
  - 转写中：状态「识别中…」+ 转写文本实时回显（转写结果区，SenseVoice 无词级
    时间戳，整句回显即可——AUDIO_UI_SPEC 已确认）；空文本走既有 EMPTY_SPEECH。
  - 已发送：状态「思考中…」（既有 awaiting_reply）即反馈；回复落流同步播报（v1.1 修复）不变。

### 10.4 防锁屏防清后台（双保活）

- **亮屏保活**：overlay 打开 → activateKeepAwake()；挂断/关闭 → deactivateKeepAwake()
  （复用 utils/keepAwake；推理期 handleSendPress 既有 activateKeepAwake 不冲突——
  同一原生 WakeLock，引用语义幂等）。
- **防清后台**：通话进行中（overlay 打开）→ nightTaskRegistry 引用计数 +1（复用
  nightTask 机制：前台服务 + PARTIAL_WAKE_LOCK，HyperOS 不杀）；挂断 → -1。
  与生图/聊天推理共用同一引用计数，无新机制。
- **边界**：通话 = 用户使用中，聆听态同样保活（不漏任务）；锁屏后推理期
  handleSendPress 既有 keep awake 继续持有；挂断释放全部。

### 10.5 验收标准（v2.0）

1. 冷启动聊天页：顶栏电话图标胶囊化可见（像素对比 24px primary）。
2. overlay 打开时：通话时长走秒、hold 涟漪、三态波形、跑分迷你行与聊天页同款同源。
3. 引擎未就绪：hold 禁用 + 进度条；就绪自动解锁。
4. 通话中熄屏超时不断电（keep awake）；HyperOS 杀后台列表不出现 App（nightTask）。
5. tsc 零错；jest 新增（useElapsed / 门控逻辑）全绿；回归不破。

## 11. 复测定案 v2.1（2026-09-05 大王上手复测，四报障根因纠正 + 深化设计）

### 11.0 根因纠正（诚实推翻 v2.0 排查结论）

| 报障 | v2.0 判定 | v2.1 真因（代码级铁证） |
|---|---|---|
| 顶栏图标看不见 | overlay 残留遮罩 + 视觉弱 | **svgr 传参错用**：`.svgrrc` 把 `#333333` 一律换成 `{props.fill}`（phone.svg 是 `stroke="#333333"`），v2.0 传 `color=` → `stroke=undefined` → **图标从未渲染**，只剩胶囊底衬——恰好是「有圆圈、里面没内容」；同一错面波及通话页 MicIcon / PhoneIcon / CloseIcon 共 5 处 |
| 圆圈过大/高度不一致 | —— | 胶囊化自身造错：36px 底衬 + 描边与左右 `compactBtn`（36px 透明触区）不同族 |
| 顶部圆圈 + 问号 | —— | 头像首字母回落链断裂：`partnerName = activePal?.name ?? ''` → `''.slice(0,1) \|\| '?'` → 问号；无 pal 绑定的会话必现 |
| 听不到语音输出 | —— | **双重门不同源**：useChatSession 电话模式 `ctx.tts.enabled=true`，但 `ttsStore.onAssistantMessageStart` 内部另有一道 `!autoSpeakEnabled → return`（onAssistantMessageComplete 回落分支同门）→ 流式播报从未开流，全程静默且无任何提示 |
| 我说的话没显示 | —— | 观测窗口为 0：`onTranscript` 在转写完成那一刻才 fire，下一行即 `setStatus('awaiting_reply')`，而渲染条件是 `transcribing && transcript` |

纪律落点：图标传参红线 + 同行触区几何红线已写入 **DESIGN_SPEC §3**（全 App 适用，非电话域私有）。

### 11.1 顶栏入口（撤销胶囊化，回归同族触区）

- `phoneButton` = `theme.size.controlHeight` 方形**透明**触区（与 `HeaderRight.styles.compactBtn`
  同几何同基线）+ `PhoneIcon` `theme.iconSize.m` 尺寸；**无底衬、无描边、不另造一族**。
- 着色走 `fill`：就绪 `primary`，未就绪 `outline` + `opacity 0.4`（禁用语义不变）。
- testID `phone-call-button`、点击引导（未就绪弹下载提示）均不变。

### 11.2 通话页布局 v2.1（横向控制区 + 头像真实化 + 去重复入口）

```
┌────────────────────────────────────┐
│ ① 联系人区                       │
│   头像：品牌小鸡图（聊天空态同资产）  │
│   伙伴名回落链：pal.name → 会话标题 → 「小黄鸡」
│   模型名 · 通话时长 mm:ss         │
├────────────────────────────────────┤
│ ② 状态区（图标 + 一句话状态 + 副提示）  │
│   我说：「转写文本」（本轮常驻，见 11.4） │
│   它说：回复摘要（2 行截断）          │
│   播报通路行（图标 + 可点提示，见 11.3）  │
│ ③ 跑分迷你行（PerfMiniRow，**默认展开**） │
├────────────────────────────────────┤
│ ④ 控制区（**同一横行、同一基线**）：    │
│   〔96px 按住说话·麦〕   〔64px 挂断·红·电话横置〕 │
│   caption 均在各自圆钮下方（不再挤进圆内） │
└────────────────────────────────────┘
```

- **右上 ✕ 删除**：`onClose` 与 `onHangUp` 同函数 = 重复入口（锋利原则）；挂断即退出通话页。
- **caption 不再坐在圆钮内**：v2.0 把 `Text` 放在 84px 固定圆内，与 40px 图标抢高→文案被裁；
  改为「圆钮列：图标居中 + caption 在圆外下方」，控制区 `flexDirection: row`。
- **头像零新资产**：复用 `src/assets/pocketpal-dark-v2.png`（聊天空态已用）圆裁；
  名字回落链兼顶（消除问号）。
- 跑分卡是核心：**默认展开**（大王复测报「默认折叠」= 看不到）；仍复用 PerfMiniRow，不另造 SSOT。

### 11.3 播报强制贯通（单一门）+ 播报可用性显式化

- **修门**（ttsStore，单一事实源）：`onAssistantMessageStart(messageId, opts?: {forceSpeak})`
  与 `onAssistantMessageComplete(messageId, text, {hadReasoning, forceSpeak})` 的自动朗读门
  改为 `autoSpeakEnabled || forceSpeak`；可用性/声音存在/idempotency 三门**不变**。
- **源**（useChatSession）：`phoneMode` 单一来源同时控 `ctx.tts.enabled` 与向两处 hook 传
  `forceSpeak: phoneMode`——不再第二处判断，也不新增 store 字段（无泄漏态）。
- **语义**：电话模式 = 用户主动要求语音交互，播报强制 且**不修改**用户的「自动朗读」开关。
- **显式化**（不静默失败）：通话页状态区常驻一行「播报通路」：
  - `currentVoice == null` → 「还没选播报语音 · 点这里选」
  - `!isTTSAvailable` → 「语音播报已关闭 · 点这里开启」
  - 两者均就绪 → 「播报就绪」（`VolumeOnIcon`）
  点击→ `ttsStore.openSetupSheet()`（**复用既有 TTSSetupSheet**，不新建任何设置 UI）。

### 11.4 转写回显持久化

- `phoneTranscript` 生命周期改为**轮次级**：新一轮录音按下时清空 → 以后 awaiting_reply /
  speaking / idle 全程常驻显示「我说：「…」」→ 挂断清空。
- 渲染不再看 `status === 'transcribing'`（该态只存在几十毫秒，不构成可观测反馈）。

### 11.5 提示文案体系（六态一句话 + 一行副提示，zh/en 双源）

| 态 | 主状态（titleM） | 副提示（captionS / onSurfaceVariant） |
|---|---|---|
| idle 就绪 | 我在听… | 按住下方按钮说话，松开我就回答 |
| recording | 松开发送 | 正在听你说… |
| transcribing | 识别中… | 正在把你说的话认出来 |
| awaiting_reply | 思考中… | 想好我就说，按住按钮可以打断 |
| speaking | 播报中… | 我在说话，按住按钮可以打断 |
| 引擎未就绪 | 正在加载语音助手… | 加载好就能说话（+ 进度条与 stage） |

文案风格红线（DESIGN_SPEC §10）：全角标点、第一人称「我」、无技术术语、无「错误/失败」式冷冰冰。

### 11.6 验收标准（v2.1）

1. 真机顶栏：电话图标**有像素**（primary 色出现在图标笔画区域，非仅底衬）且触区与左右
   `+`/`⋮` 同高（36px，截图像素等高验证）。
2. 通话页：按住说话与挂断**同一横行**（testID `phone-controls` 断言 flexDirection=row）；
   头像为小鸡图非问号；右上无重复关闭钮。
3. 输入反馈：说一句话→「我说：「…」」在思考/播报态仍可见（截图取证）。
4. 语音输出：**「自动朗读」关**的前提下，电话模式仍能听到播报（forceSpeak 贯通）；
   未选语音/播报已关闭时，通话页出现可点提示行并拉起 TTSSetupSheet。
5. 跑分迷你行默认展开可见。
6. tsc 零错；jest 全绿（含新增 ttsStore forceSpeak 门用例 + overlay 布局/回显用例）；
   eslint / l10n:validate 零错。

### 11.7 跑分环境轨迹（v2.2 新增，2026-09-05 二次复测：「跑分默认折叠不好，跑分是灵魂」）

**真因不是折叠**——`defaultExpanded` 自 v2.1 起就为 true；展开的是一张**空图**：
`chatTurnPerf` 是**回合制**采样（run_started → run_finished 之间 1Hz，回合外诚实返空），
而通话页是跨回合常驻面，聆听/播报期无新回合 → `livePoints` 为空 → 跑分行只剩一排 `--`。

**修法（新增 hook `usePerfTrace(active)`，不改任何采样服务语义）**：

| 时刻 | 数据源 | 自采？ | 纪律 |
|---|---|---|---|
| 生成期（`chatTurnPerf.livePoints` 非空） | 回合轨迹 | **否** | B1 单采样源（2026-08-31 裁定：双 1Hz = 每点 ~10 个 sysfs 读 + getMemoryInfo 翻倍） |
| 空闲期（聆听/播报/等待） | 本面环境轨迹（1Hz `getPerfSnapshot`） | 是 | 仅在 overlay 在岗时跑，挂断即停并清空 |
| 回合结束 | `livePoints` 转空 → 接回环境轨迹 | 是 | 追加到同一时间线，不跳变 |

诚实口径与 `chatTurnPerf` 一致：采样失败跳过该点，不插值不编造；窗口 60 点封顶。
零新轮子：复用同一 `NativeHardwareInfo.getPerfSnapshot` 单通道 + 同一 `PerfMiniRow`，
环境轨迹**不落盘**（不进跑分历史库，避免把 30 分钟通话记成一次「聊天回合」）。

### 11.8 控制区位置定案（v2.2，大王二次复测）

- **挂断居左、按住说话居右**（互换 v2.1 的左右顺序）。
- **两钮分居两侧**：`justifyContent: space-between` + 左右 `xl`(32dp) 边距，
  400dp 屏上两钮圆心相距 ~240dp——按住说话需长握，与一次性挂断必须拉开距离防误触
  （v2.1 居中 gap 40dp 实测太近）。
- 其余不变：同一基线、caption 在圆外下方、挂断符号 = 电话图标横置。
- **两钮等大（v2.3 修订，大王：「按住说话的按钮比挂断按钮大好多」）**：
  两钮一律 72dp 圆、图标一律 `iconSize.xl`；语义靠**颜色与图标**区分
  （primary=说话 / error=挂断），不靠尺寸做视觉等级（参豆包通话页：所有圆钮等大）。

### 11.9 波形语义契约（v2.2，大王：「为什么一直是波浪线」）

| 态 | 视觉 | 数据源 | 诚实口径 |
|---|---|---|---|
| recording | 三根声波柱（error 色，`WAVE_BAR_RANGE` 12-22 / 16-30 / 10-18 dp） | **原生 RMS 事件**（`audioLevel` 单通道，≈20Hz，§14.2） | v2.4 起柱高 = 真实音量（`min(1, level×8)`）；拿不到事件（旧构建/iOS）则回落静态柱，**不画假波形** |
| speaking | 三根呼吸柱（primary 色） | 组件内 900ms 往复呼吸 | 麦克风已停、播报无振幅回传 → 只作「正在播」节律提示，**不声称是音量** |
| awaiting_reply | 三点跳动（`useWaveDots`，与生图三点同源） | 回合推进 | 大王原报「一直是波浪线」实为把它当成了声波 |
| transcribing / idle | **三根不等高静态柱**（`phone-ambient`，outline 色） | 无 | 无数据源就不动——红线：不得做假波形跳动 |

**本组件级红线（真机血证 2026-09-05）**：

- **hooks 一律在 `if (!visible) return null` 之前声明**。声波 `useEffect` 曾被放到早退
  之后，「隐藏→打开」那一帧抛 `Rendered more hooks than during the previous render`，
  release 构建直接 `JavascriptException` 杀进程（现象：点顶栏电话图标后手机回到桌面）。
  单测护栏：`visible=false` 挂载 → rerender `visible=true` 必须不抛。
- 波形/动画一律 core `Animated` + JS driver（与本文件 `pulse` 同族），不为一个小波形
  另引 reanimated 分支（仓库动画纪律收口）。

## 12. 后续波次与路线（Roadmap，2026-09-05 登记，回答「还剩多少没做」）

### 12.1 端到端语音模型（路线 B）：**未接入**（现状实证）

当前全链路仍是**级联**：AudioRecord → SenseVoice（ASR）→ AgentRunner（文本）→ TTS 引擎。

本窗对装机 APK 的原生库做了符号探测（`.tmp` 探针，只读）：

- `librnllama_jni*.so`（arm64 全档位）**含** `llamaInitVocoder` /
  `llamaIsVocoderEnabled` / `llamaGetFormattedAudioCompletion` /
  `llamaGetAudioCompletionGuideTokens` / `GetMultimodalSupport` 符号；
  llama.rn 0.12.7 的 TS 面有 `initVocoder({path, n_batch})` 与 `input_audio` 消息类型。
- 但核心 `librnllama*.so` 内**未见** `llama_supports_audio_in/out` 一类能力探测符号
  → 不能断言可直接跑通，「API 在册」≠「能力可用」。

**结论**：路线 B 不是「重编内核」型活（引擎禁区暂时不触发），而是
「选型 + 接线 + 实测」型活，但**可行性尚未验证**，不得先拍工期。按依赖分四步：

| 步 | 内容 | 产物 | 前置/红线 |
|---|---|---|---|
| S1 可行性 spike | 选一颗音频 GGUF（MiniCPM-o 2.6 / Qwen2.5-Omni 3B 系），`initVocoder` 跑通「语音进→语音出」，记 K90 首字延迟/峰值内存/温度 | spike 报告 + 数据 | 只用现有 `.so`；**禁止擅自重编 llama.cpp**（需先立项请示） |
| S2 模型资产与下载 | 模型目录/体积/增量下载 + 与现有 12 模型阵容的内存互斥降级策略 | 模型页可下载可卸载 | 不挤碎现有聊天体验（G1-G5 性能门禁） |
| S3 双引擎路由 | 电话模式可选「级联（现）/端到端」，单点决策不双跑 | 设置页一行开关 | 现有级联不删除（低端设备回退路径） |
| S4 免手交互 | VAD 自动断句 + 说话即打断播报 | 免按住可用 | §2 红线：首版仍是按住说话，需大王裁定才扩 |

### 12.2 电话模式待办清单（真完成项，不留无批次挂账）

| 级别 | 项 | 当前状态 |
|---|---|---|
| P0 | 顶栏图标可见/同高、控制区横向换位、头像真实化、转写常驻、播报 forceSpeak、跑分环境轨迹 | 已落地，待大王耳测+手感终验 |
| P1 | ASR 增量流式回显（现整句）、说话即打断（免按住）、选完语音自动回到通话页、通话中切模型/切语音、「按住按钮可打断」提到主状态行、「内容由 AI 生成」署名行、**转写态防闪驻留**（定案见 §13.1，本期未落地） | 未做（每项独立可验） |
| 已收口 | ~~录音实时振幅波形~~（v2.4 §14.2）、~~对话全文铺满主区~~（v2.4 §14.1） | 已落地，待真机终验 |
| P2 | 路线 B（见 12.1）、电话内工具调用恢复（现 §2 红线禁用）、通话录音回放/摘要、多语言 ASR×TTS 组合矩阵 | 未做，需产品裁定优先级 |
| 测试债 | 电话模式 e2e 用例（现仅单测）、HyperOS 自动化 tap 拦截绕行 SOP | 未做 |
| 无关本域存量 | actionRegistry 2 例 / ModelTypeTag 4 例（§936 D1 色值断言） | 挂账待收 |

## 13. ASR 链路定性 与 豆包通话页对标（2026-09-05，大王三问与四图）

### 13.1 「是不是重复转了一次」：**没有**（代码取证）

本窗 grep 实证（2026-09-05）：

- ~~`src/**` 全域零命中 `SpeechRecognizer` / `RecognitionListener` → App 从未接入手机系统语音识别~~
  **本句已推翻（同日 W1b 取证）**：当时只 grep 了类名，漏了封装库——`ChatInput.tsx` 一直用
  `@react-native-voice/voice`（内部就是 Android `SpeechRecognizer`）做本地 ASR 的 catch 回退。
  教训：**否定性结论必须换多个口径交叉**（类名/包名/依赖表），否则文档会把误判固化成事实。
  现该回退已删除（见 §15.2），本句结论反而成立了。
- 全 App 只有**一条** ASR 链路：`NativeModules.AudioRecord`（PCM16 16k mono →
  手写 WAV 头落盘，`AudioRecordModule.kt` B33）→ `audioStore.transcribeTask(path)` →
  `AsrModule.kt` sherpa-onnx **SenseVoice 离线**（非流式、自动语种、greedy_search）。
- 两个消费面**共用同一条链**：聊天页语音条（`ChatInput.tsx` 录音→转写→
  `handleChangeText` 填输入框）与电话模式（`ChatScreen.tsx` 注入
  `transcribe: path => audioStore.transcribeTask(path)`）。原生 AudioRecord 是单例，
  同一时刻只能有一个录音源在跑 → 结构上不存在「系统转一次 + 我们再转一次」。

大王看到「语音输入完立马弹出已转完的文本」的两种可能（都不 = 重复转写）：

1. 用的是**输入法键盘的麦克风**（搜狗/小米输入法语音输入）——那是系统/厂商识别，
   文本直接打进输入框，App 根本没参与；
2. 用的是我们自己的语音条——SenseVoice 对短句端侧 0.3–1s 出结果，观感就是「立马」。

**为何不改用系统识别（主动选择，不是遗漏）**：HyperOS 上系统识别多走云端 + 账号依赖，
违反本 App「完全离线 / 隐私本地化」产品红线，且无 GMS 机型不可用。

**一个真实的提示缺陷**（P1 挂账，**v2.4 未做**）：短句时 `transcribing` 态一闪而过，容易让人
误读为「又转了一次」。**定案设计**（不落地不等于没想清）：给 `PhoneCallSession` 加**显示层驻留**
——真实状态机照常推进（`this.status` 立即变），只把「离开转写态」的 `notify` 广播补足
≥400ms，到期时一律广播 `this.status` 的最新值。

为何必须是显示层而不是「推迟切态」：若把 `setStatus('awaiting_reply')` 延后 400ms，
这段窗口内 `notifyReplyStarted/Finished` 会因状态不匹配而 **no-op 丢事件**（超快回复/
管家直答路径），之后强推 awaiting_reply 就要等 90s 看门狗才能收口——拿一个观感小修
换一种悬挂可能，不划算。挂断路径（`closing`）直接放行不驻留。

### 13.2 豆包通话页四图对标（可取 / 不取 / 待裁定）

| 豆包做法 | 评估 | 决策 |
|---|---|---|
| 所有圆钮等大（mic/摄像/字幕/喇叭/挂断/更多），挂断用红 ✕ | 视觉等级不靠尺寸；语义靠颜色 + 图标 | ✅ **已采**（v2.3 两钮 72dp 等大；挂断仍用听筒横置——比 ✕ 更「挂断」不歧义） |
| 状态一行居中：「… 正在听…」/「说话或点击打断」 | 与我们六态文案同构，但它把**怎么打断**写进提示 = 现场教交互 | ✅ 待采（P1：把「按住按钮可打断」提到主状态行，不只做副提示） |
| 对话全文铺满主区（当前句深色、历史句浅色） | 信息密度远高于我们「我说/它说」两行摘要，电话场景相当于字幕 | ✅ **已采**（v2.4 §14.1：对话流 flex:1 铺满，跑分行下移让位） |
| 免手：说话即录入 + 点击打断（VAD） | 交互模型变更，需原生 VAD（能量门限/silero）；§2 红线首版为按住 | 🔴 待裁定（即 §12.1 S4） |
| 顶部「选择情景」胶囊（辩论/同传/面试/英语陪练/歌手） | 场景玩法，非通话必需 | ❌ 不采（功能膨胀，远背「锋利不臃肿」） |
| 六钮含摄像头 / 共享屏幕 / 字幕开关 | 我们无对应能力 | ❌ 不采（**不做没有能力入口的按钮**） |
| 底部一行「内容由 AI 生成」 | 合规署名，成本一行 captionS | ✅ 待采（P1） |

### 13.3 v2.3 已落地项

- 默认伙伴名改「**小妖**」（en 用专名拼音 `Xiaoyao`）；pal 无名时**不再拿会话标题当名字**
  （曾显示「帮我画一张画。」，大王裁定修正）。
- 两钮 72dp 等大 + 图标同 `iconSize.xl`（单测断言两钮尺寸相等，防后人改回大小差）。

## 14. v2.4：对话流铺满 + 真实振幅通道 + VAD 观测 spike（2026-09-05 大王裁定）

大王对 §13.2 两项待裁定给出结论：**①通话页改「对话全文铺满主区」= 做**；
**②免手 VAD = 先 spike 拿数据再定**。本节把两条的设计与边界定死。

### 14.1 通话页布局契约（对话流版）

```
① 联系人区   头像 + 名字 + 模型 · 通话时长
② 状态区     波形（真实振幅）/ 三点 / 静态柱 + 主状态 + 一行副提示
③ 对话流     flex:1 可滚动，全文铺满（伙伴句深色、我说浅色）
④ 播报通路行 紧凑一行（就绪态弱化，不可用态红色可点）
⑤ 跑分行     PerfMiniRow 展开（环境轨迹，§11.7）
⑥ 控制区     挂断（左）· 按住说话（右），72dp 等大分居两侧
```

- 跑分行**移到对话流之下、控制区之上**：对话流要拿到最大垂直空间，
  而跑分是灵魂——放在视线落点（拇指与屏幕底之间）而不是被顶到中间。
- 对话流数据源：`chatSessionStore.currentSessionMessages`（overlay 已是 observer，
  直读派生，**不新增 props 接线**——与 §11.3 播报通路同源规则一致）；
  本轮**未落库的用户语音** = `transcript` prop 追加为末条浅色行（轮次级常驻语义不变，§11.4）。
- **归属口径（v2.4 自查 + K90 真机两轮修正）**：不得假设「`type==='text'` 就是我说」——系统提示
  （模型未加载 / `Completion failed: …`）与任务占位卡（「🎨 已识别为生图任务…」）都是 text 且
  author=assistant，旧写法会把报错与进度文案当「我说的话」铺进字幕。定法：`metadata` 命中
  **非对话卡标记集**（`system` / `imageTask` / `imageTaskFailed` / `editTask` / `editTaskFailed` /
  `captionTask` / `captionTaskFailed` / `taskError`，写入方 = `chatImageTask` + `useChatScheduler` +
  `useChatSession`）一律**不入流**；其余按 author id 判 `me`/`partner`，author 缺失才按消息类型
  回退（与 `contextCompaction.speakerOf` 同口径）。**`butler: true` 不在标记集内**——管家直答卡
  会被原地回写为真正回复文本，那就是伙伴说的话。
- **顺序契约（K90 真机定位，此前整条反了）**：`currentSessionMessages` 是**新在旧前**——
  `addMessageToCurrentSession` 用 `unshift`、DB 读取用 `Q.sortBy('position', Q.desc)`、
  ChatView 是 `inverted` 列表（`currentSessionMessages[0]` = 最新，`useChatScheduler` /
  `chatImageTask` / `benchmarkOrchestrator` 均按此取「刚落库那一条」）。字幕必须
  `slice(0, N)` 取最近 N 条再**倒序遍历**成「旧→新」铺；按「旧在新前」遍历 + `slice(-N)`
  的真机症状 = **字幕停在开场问候语，伙伴新回复永远看不到**（单测当时抓不到，因为
  fixture 也按错序写——教训：**测顺序必须按真实契约造新在旧前的数组**）。
  同一根因另中一处：`ChatScreen.phoneLastReply` 从数组尾部往回扫，取到的是**最旧**
  一条回复→电话模式播报陈年旧话；已改为从 index 0 往后扫。
- 尾窗 12 条（`DIALOGUE_TAIL`）：防长通话无限渲染；上滚看更早历史不在本期范围。
- 视觉：伙伴句 `onSurface`（深）、用户句 `onSurfaceVariant`（浅），左对齐纯文本
  （豆包同构，不用气泡——通话页是「读字幕」不是「翻聊天记录」）。
- **贴底机制（K90 真机两轮定案）**：`onLayout` 记视口高 + `onContentSizeChange` 记内容高，
  任一变化即 `scrollTo({y: 内容高 - 视口高, animated: false})`。两次踩坑必须留字：
  ① `useEffect` + `InteractionManager.runAfterInteractions(scrollToEnd)`——新行尚未测量就执行，
  字幕完全不跟底；② 改挂 `onContentSizeChange` 但仍用 `scrollToEnd`——它读的是**未含
  `contentContainerStyle` padding 的旧高**，稳定少滚 6dp（真机量得 18px），最新一行永远差一截。

### 14.2 真实振幅通道（P1「录音实时振幅波形」收口）

现状诚实声明：v2.2 的呼吸柱是**900ms 循环相位**，不是音量——因为原生只落盘 PCM，
没有把能量回传 JS（§11.9 已记）。v2.4 补这条通道：

| 层 | 改动 | 契约 |
|---|---|---|
| 原生 | `AudioRecordModule.kt` 读块循环内算 **RMS**（PCM16 归一化 0..1），≥50ms 节流发 `AudioLevel` 事件 | 事件范式沿用本仓 `DownloadModule.kt`（`getJSModule(RCTDeviceEventEmitter).emit`），不引第三方；**不得阻塞写盘线程**（单次 O(n) 扫自有 buffer） |
| JS | 新增 `services/phoneCall/audioLevel.ts` 单例订阅，暴露 `last` 与滚动统计；overlay 用 `Animated.timing` 命令式推入柱高（**不 20Hz 触发 React 重渲染**） | 单一订阅点（重复订阅 = 事件翻倍），页面离开录音态即解除，不泄漏 |
| 视觉 | 录音期柱高 = `min(1, level × 增益 8)` 插值到 §11.9 的 `WAVE_BAR_RANGE`；无事件（未录音/旧构建）仍走静态柱 | 无真实数据不画假波形这条红线不变 |

### 14.3 VAD：**观测期只测不断**（不擅自改交互模型）

§2 红线「首版按住说话」未被推翻前，VAD 只做数据采集：

- 观测内容：录音期 `level` 序列的**峰值 / 均值 / 静音段最长连续时长**
  （静音判定门限 `level < 0.02`，与能量分布解耦，可单测）；
  并记录「若启用 900ms 静音断句，会在第几毫秒触发」——即假想断点，不执行。
- 出口：`stopRecording` 时把统计经 `console.log` 落 logcat（tag `ReactNativeJS`，
  前缀 `[VAD-obs]`），本窗用 `adb logcat` 取证成表，交大王判读。
- 决策门（拿到数据后才定）：①正常语速下的句中停顿分布是否显著小于 900ms
  （若频繁误断，说明免手需要更高门限或语义 VAD）；②播报回声是否被误判为人声
  （免提场景风险）。**数据不支持就不上免手**，不做「看起来高级」的自欺。

### 14.4 验收标准（v2.4）

1. 通话页主区为连续对话流，伙伴句深色 / 用户句浅色，新消息自动到底；本轮语音在
   未落库时即出现在末条（§11.4 常驻语义不回退）；系统提示行不出现（§14.1 归属口径）。
2. 录音时波形随**真实音量**起伏（外放声源可观测到柱高变化；无声时回落）。
3. logcat 出 VAD 观测统计（峰值/均值/最长静音段/假想断点），零行为改变：
   按住说话仍是唯一录音触发，松手仍是唯一提交口。
4. 原生改动不破坏既有链路：聊天页语音条与音频工坊转写（同一 `AudioRecord` 模块）
   回归可用；跑分行、播报通路、引擎门控、双保活全部不回退。
5. tsc 零错；jest 全绿（新增 audioLevel 统计单测 + overlay 对话流与归属断言）；
   eslint / prettier 零错；本轮无新增 l10n key（字幕全文来自 store，不新增文案）。

### 14.5 本波交付状态（诚实口径）

- 已落代码 + 单测：§14.1（含归属修正与卡集不入流、贴底机制）、§14.2、§14.3。
- 真机终验：K90 / Android 已跑完（2026-09-05，结果与数据见 §14.6）。该轮**抓出三个
  单测与链路复核看不到的真缺陷**：①字幕顺序整条反了（新回复不入字幕，最严）；
  ②任务卡混入字幕；③贴底差 6dp。三者均已当场修并重装复验——其中①还暴露了
  **测试自身的错**：fixture 也跟着按错序写，所以单测全绿而真机全反。
- 未入本波（回到 §12.2 P1）：转写态防闪驻留（定案见 §13.1）、ASR 增量流式回显、打断提示上行。

### 14.6 K90 真机终验结果（2026-09-05，覆盖安装不卸旧）

| 验收项 | 结果 | 铁证 |
|---|---|---|
| 零崩溃链路 | ✅ | 进页/录音/转写/生成/播报/挂断全程 logcat 无 JavascriptException / FATAL / ANR |
| 两钮几何 | ✅ | 左右各 216px = **72dp 等径**（密度 3.0），边到边 576px ≈ 192dp 分居两侧 |
| 真实振幅通道 | ✅ | 逐列探针三柱宽 11/14/11px（=4/5/4dp）；安静 16.8/22.5/13.9dp（反推 level 0.48/0.46/0.49）→ 有声 20.3/27.5/16.8dp（0.83/0.82/0.85）：三柱 level 一致且随音量整体抬升 = 单一 Animated 值被真 RMS 驱动 |
| VAD 观测数据 | ✅ | `[VAD-obs] duration=6801ms samples=86 peak=0.1415 avg=0.0652 longestSilence=81ms hypotheticalStop=none`（另两组：5760ms/73、3841ms/49） |
| 字幕不混系统/任务文案 | ✅（修后） | 「🎨 已识别为生图任务…」装机复验已不再入字幕 |
| 字幕顺序（新回复在场） | ✅（根因修） | 修前冷启动只见「。 / 开场问候 / . / 帮我画一张画。」，而聊天页里最新的两条伙伴回复完全不在字幕内；修后同页末行 = 最新一条（「我。」+ 其回复全文 212 字） |
| 新回复自动贴底 | ✅（修后终验） | 精确偏移版：手动翻回旧内容 → 说一轮 → 新回复到达后「容器内向上甩」画面 **0.00% 不变**（= 已在真实底），同法「向下甩」**19.13% 变化**（= 内容确实溢出，排除「无内容可滚」的假阴性）；旧 `scrollToEnd` 版量得稳定差 18px（=6dp，恰为 `paddingVertical`） |
| 整链跑通 | ✅ | `[AudioStore] transcribe ok` → `[PromptWriter] chat done in 8201ms, 212 chars`（另 4668ms / 27593ms / 13558ms）；挂断回聊天页正常，全程零 JavascriptException / FATAL / ANR |
| 播报通路真机取不到声 | ✅ 已定性并修（见 §15） | 状态行显示「播报就绪」，但播放时 `[TTSStore] stop failed: Failed to initialize TTS engine`（`code: 'speech_error'`）→ **就绪态与实际可播不一致**。同日取证定性 + W1a 修（见 §15.1/§15.3） |
| 聊天页语音条回归 | ✅ 已复验（同日 W1b 轮） | 删掉系统识别回退后，聊天页语音钮（本地 SenseVoice 单一路径）真机走通：按下录音 → 再按停止 → `[AudioStore] transcribe ok: 'Hello.'`（logcat 09-05 23:01:59） |
| 音频工坊回归 | ⏳ 本轮未复验 | 同共用 `AudioRecord` 模块、聊天页与电话两路已证，但工坊「导入音频文件转写」这条本轮未单独走一遍（按实登记，不谎报） |

**VAD 数据不得据此下结论**：本轮取证环境为**环境音 / 外放回声**（非受控语音），
`longestSilence=81ms` 恰为一个采样间隔，说明麦克风采到的是连续环声——它**无法回答**
§14.3 决策门①（正常语速的句中停顿分布）。第四组（接新回复那一轮）
`duration=3361ms samples=43 peak=0.2283 avg=0.1331 longestSilence=81ms` 的 peak/avg 明显高于
纯环境音组（0.11–0.14 / 0.058–0.065），但 `longestSilence` 仍是 81ms，同样答不出停顿分布。
要定免手与否，需大王做受控轮次（说一句 → 停 1–2 秒 → 再说一句）重取一组 `[VAD-obs]`。

## 15. 语音链路收口 W1（2026-09-05 大王裁定：只问可不可用）

大王对 6D 全量排查给出三条裁定：① 语种「**默认中文**」+ 按推荐方案执行（不匹配只提示、
不偷改音色）；② 系统能力**只问可不可用**，上不上云不进决策权重；③ 端到端仍按 §12.1 走。

### 15.1 本机实证：系统语音引擎在这台机器上不可用（不是「慢」，是压根起不来）

| 事实 | 证据 |
|---|---|
| 本机唯一系统识别服务 = 小爱 | `cmd package query-services -a android.speech.RecognitionService` → `com.xiaomi.mibrain.speech/.asr.AsrService`；`settings secure voice_recognition_service` 同指 |
| 它需用户先在厂商协议页同意激活 | 用 `RECOGNIZE_SPEECH` 探针拉起 → 停在「系统语音引擎」CTA 页（`.CTAActivity`，本机从未同意）→ 我们侧 `Voice.start()` 点了没反应 |
| 协议页原文自述「我们将联网」 | 「在使用本应用的过程中，我们将联网并向您申请以下权限：录制音频」→ **可用性完全不在我们手里** |
| 同一个包也提供 OS TTS | `android.intent.action.TTS_SERVICE` = `.tts.TtsService` → `SystemEngine` 背后就是它；未激活 → `Failed to initialize TTS engine (speech_error)`（`stop()` 也抛，真机 logcat 实证） |
| 本地 SenseVoice 零网络调用 | `AudioRecord` 落盘 → `AsrModule` sherpa-onnx 本地推理 → **不依赖网络**（本轮改以代码链路判定，**未做断网实测**——系统那条卡在协议页已足以定案，断网实验不再必要） |

口径：**「没网能不能用」这条承诺只能押在本地**；系统那条既未激活又不可控，留着它只会多一条静默失败路径。

**设备授权边界（取证纪律）**：探针拉起小爱「系统语音引擎」协议页后，**只点「退出」**（实测
按钮中心 333,2401），**未替大王点「同意」**——厂商服务激活属用户本人决定，AI 不代签授权。

### 15.2 W1b：语音输入单一路径（删系统识别回退）

- `ChatInput` 删除 `@react-native-voice` 全部使用（`isAvailable` / `onSpeech*` / `start` / `stop` / `destroy`）、
  `isVoiceSupported` 状态、`localAsrRef` 竞态标记与 `handleChangeTextRef`（只服务于旧回调）。
- 语音键显隐 = **`audioStore.asrState === 'ready'` 单一判据**；未就绪即不显示（这是可见状态，不是静默兜底）。
- 录音启动失败 → **不进入 listening 态**（不假装在听），日志 `[ChatInput] local ASR start failed`。
- 电话模式与音频工坊不受影响：二者必须要 PCM / 音频文件，本就是本地链路（系统识别也不给 PCM）。
- **真机复验（装机后）**：冷启动 → 聊天页语音钮（bounds 中心 1074,2495）按下 3s → 再按停止 →
  `[AudioStore] transcribe ok: 'Hello.'`，**删回退后主链正常**；logcat 全程无 `local ASR start failed`、
  无 JavascriptException。语音钮显隐判据改动未在真机上出现「钮该有却没有」的误伤（ASR 已装态）。
- **遗留（下一笔单独收）**：`@react-native-voice/voice` 依赖 + patch + jest mock 现为孤儿；
  移除牵动构建配置，需一次装机验证后收口，不隐性留在仓里。

### 15.3 W1a：播报不骗人（就绪同源 + 默认中文 + 失败可见）

| 项 | 定法 |
|---|---|
| 就绪同源 | `SystemEngine.isInstalled()` 不再硬编码 `true`，改为「系统真给出音色目录」；拿不到即不可用（HyperOS 未激活场景直接落到可见提示） |
| 默认中文 | 新增单一决策点 `services/tts/voiceSelection.ts`：`pickDefaultVoice`（`zh*` 优先，无中文才退回首颗）——旧写法取 `voices[0]` 正是「中文读不出」的根因（全仓中文音色仅 Kokoro 两颗） |
| 不匹配只提示不改选 | `isVoiceMismatchedForText`：中文文本 × 非 zh 音色 → `TTSStore.speakIssue='lang'`，通话页播报行显示「当前语音读不了中文，点此换语音」并可点进 TTS 设置；**不自动跨引擎换音色** |
| 失败必须可见 | `play()` 的 catch 不再只 `console.warn` → `speakIssue='failed'`，同一行显示「播报失败，点此处理」（复用现有 `ttsRow` 容器，不另造 UI） |
| 判定唯一 | 流式与回落两路都在 `TTSStore` 收口判定（chunk 热路径不重复判），UI 只读不改写 |

- l10n 新增 2 key（en + zh，其余语言回退英文）：`components.phoneCall.ttsPlayFailed` / `ttsLangMismatch`。
- 单测：`voiceSelection.test.ts` 4 例钉住契约；ChatInput 语音用例改写为「本地单一路径」三例。

### 15.4 未做（诚实登记，不谎报）

- 输入框「边说边出字」的流式体验：需流式 ASR 资产（zipformer 类），属新增模型资产，**未立项不动**。
- ~~引擎能力位（`supportsLanguage` 等声明式契约）与两套播报门合并：W1a 剩余项，下一波。~~
  **已于同日 §16 做完**（能力位落 `requiresModelFile`；播报门收 `speakBlock` / `speakEntry`）。
- **新发现（本轮真机）**：播报前的 `stop()` 会抛 `Failed to initialize TTS engine (speech_error)`
  但**不影响后续 Kokoro 正常加载与播放**（日志实锤：抛错后紧接
  `[Speech][Api] Initializing engine: kokoro` → `Model loaded in 875ms`）——
  即这是一条**噪音级失败**（OS 引擎从未初始化却被 stop 打了一次）。本轮故意**不把它计入
  `speakIssue='failed'`**（否则会把能播的场景误报为失败）；根治归入上一条「能力位 + 门合并」。
- 真机未触发项：`speakIssue='lang'` / `'failed'` 两条提示本轮**未实际看到**（当前音色是
  Kokoro 中文、播报成功）——判定逻辑有单测钉住，提示文案的可见性待选英文音色时补验。
- ~~`phoneMode` 全链透传（8 条丢标记路径）、录音启停三路径归一、原生侧统一日志：W2。~~
  电话轮判定已于同日 §16.4 收口（改为单一状态源，透传路径全删）；
  **录音启停三路径归一与原生侧统一日志仍未做**（登记为 W2b）。

## 16. W1a 收尾 + W2 电话轮判定收口（2026-09-06，大王指令「按最佳实践依次执行」）

### 16.1 播报门合并：`speakBlock` 单一事实源

旧写法四处各拼一套口径（互不相同，就是「UI 说就绪、实际播不出」的结构根因）：

| 位置 | 旧写法 | 现统一为 |
|---|---|---|
| `TTSStore.play` / `preview` / 流式两入口 | `isTTSAvailable` + `currentVoice == null`（各自手拼） | `canSpeakVoice(voice)`（类型谓词） |
| 通话页状态行 | `isTTSAvailable && currentVoice != null` | `speakBlock` + `speakIssue` |
| 消息页朗读钮 / footer | `isTTSAvailable` | `speakEntry` |
| 长按菜单「全文朗读」 | `isTTSAvailable` + `currentVoice == null → 引导 setup` | `speakEntry` |

- `voiceBlock(voice)` 返回第一个拦路原因：`'device'`（内存/用户开关）→ `'noVoice'` → `'engine'`（引擎未就绪）。
- **`speakBlock` 与 `speakIssue` 分工不重叠**：前者答「门为何不放行」（静态可派生），
  后者答「试着播了但出问题」（语种不匹配 / 引擎报错）；状态行把两者合成一行文案。
- `speakEntry`：`'speak'` 可播 / `'setup'` 只差选音色（点了去设置，**引导不是兜底**：
  播的仍是用户自己选的音色）/ `null` 其余拦路（不显示入口）。
- l10n 新增 1 key：`components.phoneCall.ttsEngineUnavailable`（en+zh）。

### 16.2 就绪同源：探测全部引擎（含 OS 那颗）

- `init()` 改为 `getAllEngines()` 全量并行探测：需模型文件的落 `xxxDownloadState`，
  OS 引擎落新字段 `osTTSReady`（`null` = 未探测）——旧写法只探三颗神经引擎，
  OS 那颗被硬编码 `true` 顶过，于是「播报就绪」与实际能否播完全脱钩。
- HyperOS 实证口径：系统语音引擎未激活 → `getAvailableVoices()` 给不出目录 →
  `osTTSReady=false` → 选系统音色时状态行直接显示「语音引擎不可用，点此处理」（不假装就绪）。

### 16.3 引擎能力位 + 停播归一（噪音根治）

- `Engine` 新增能力位 `requiresModelFile`（true = 需下载端侧模型；system = false），
  门判定只读这一位，`engine !== 'system'` 特判全删（新增引擎不再需要改 store）。
- **删 `Engine.stop()` 接口与四颗实现**：底层 `Speech.stop()` 是全局调用，包成引擎方法
  是假抽象；且它绕过 runtime 的「无活跃引擎」判据——真机每次播报前都抛一条
  `Failed to initialize TTS engine (speech_error)`（§15.4 那条「噪音级失败」）的根因。
- `TTSStore.stop()` 改走 `ttsRuntime.stop()`（无活跃引擎即 no-op，且与 `acquire` 串行）
  → **该噪音从根上消失**，不再需要「故意不计入 speakIssue」的临时口径；
  同时新增一条护栏用例钉住「无活跃引擎不打 stop」。
- 测试契约同步：替身引擎的 `play` 现在包一层 `ttsRuntime.acquire`（与真引擎同契约），
  停播类断言改看原生 `Speech.stop`；`beforeEach` 显式归零引擎安装态与 runtime 活跃槽。

### 16.4 电话轮判定：`metadata.phoneMode` → `phoneCall/inCall` 单一状态源

- **删透传链**，不再要求每条发送路径带标记（旧写法 8 条回复路径丢标记 → 靠 90s
  看门狗当常规收口手段）。新规则：**通话页开着时产生的每一轮回复都属于这一通电话**——
  与 ChatScreen 一直在用的「取最新一条回复」口径完全一致，且以后新增路径自动覆盖。
- 接线：`ChatScreen` 在已有的 `phoneVisible` 保活 effect 里成对调 `setInCall(true/false)`
  （**不留第二份开合状态**）；`useChatSession` 以 `isInCall()` 代替 `message.metadata?.phoneMode`。
- 看门狗职责收缩为**卡死保险**（仅防引擎真挂住），不再是「回调丢了」的常规出口。
- 不用 MobX：无 UI 需订阅它（通话页状态已由 `PhoneCallSession.notify` 驱动），不预先造状态。

### 16.5 未做（诚实登记）

- ~~W2b：录音启停三路径归一（ChatInput / 电话 / 音频工坊各自直调 `NativeModules.AudioRecord`）、
  原生侧统一日志。~~ **已做，见 §17**（2026-09-06）。
- 真机未触发项：`speakBlock='engine'`（需 OS 音色 + 未激活）与 `speakEntry='setup'` 的
  文案可见性，本轮未逐项看到（引擎就绪位有单测钉住，UI 可见性待装机验一次）。

### 16.6 真机复验（K90，覆盖安装 + 冷启动，未卸载）

| 项 | 结果 | 证据 |
|---|---|---|
| 停播噪音消失（§16.3 核心目标） | ✅ **拿到铁证** | 走完整一轮后 logcat 里 `stop failed` / `speech_error` **零条**（上一版每轮必现）；紧接 `[Speech][Api] Initializing engine: kokoro` → `Model loaded in 874ms` |
| 电话轮收口不再靠看门狗（§16.4） | ✅ | `[VAD-obs] duration=3920ms` → `transcribe ok: '我。'` → `chat done in 2693ms, 22 chars` → 播报 → 状态行回到「我在听…」（本轮总耗时远小于 90s，不是看门狗放行） |
| 字幕顺序契约（§14.1） | ✅ 未回退 | 字幕末两行 = 「我。」+ 本轮新回复全文，且贴底 |
| 合并后的播报行 | ✅ 仍判可播 | 当前音色 Kokoro 中文、引擎 ready → 显示 🔊「播报就绪」（与上一版文案一致，仅内部改读 `speakBlock`） |
| 聊天页入口 | ✅ | 朗读钮（▷）与语音钮均在场（`speakEntry` / `asrState` 新判据未误伤） |
| 崩溃面 | ✅ | 全程零 JavascriptException / FATAL / ANR；挂断回聊天页正常 |

### 16.7 端到端 W3 的前置事实（**§17 本轮已推翻其中两条，就地改账**）

1. ~~「只用现有 `.so`」不可复现：唯一来源是 `.tmp/llamarn-jni-backup/`，它在 `.tmp/`
   里、不在 git 里。~~ → 事实修正：**真正丢不得的只有 7 颗 `librnllama_jni*.so`**
   （官方 prebuilt 不提供），其余由 `yarn install --check-files` 让 llama.rn 自己重下。
   备份也已从易失的 `.tmp/` 扩到**仓库外副本** `F:\backups\pp-llamarn-jni-backup\`
   （restore 脚本现按 env → 仓库外 → `.tmp` 三源探测）。**不入 git 是故意的**：216.8MB
   进仓对本仓（有 pack 丢失史、禁 `filter-repo` 清理）不可逆。
2. ~~悬空指针 `yarn build:android-libs`。~~ **已删**：restore 脚本报错现给四条可执行
   路径（仓库外 robocopy / 设备提取 / APK 自动读 / `--check-files`），并明写
   「本仓**没有** build:android-libs，源码重编 llama.rn 属引擎禁区需单独立项」。
3. **仍成立**：备份里 `librnllama.so` 无 `llama_supports_audio_in/out` 符号、
   `rnllamaBuildFromSource` 仍关闭 → 端到端需先重编 llama.cpp/llama.rn，**那是引擎禁区**。
   （本轮另核一条相关事实：`librnllama.so` 的 ELF NEEDED 只有系统库，ggml/llama
   已**静态内联**——不存在也不需要 `libggml.so` 这类伴生库。）

结论不变：**W3 不在本轮动**。阻塞点不是「有没有备份」，而是「要不要进引擎禁区重编」——
需大王点头。原先担心的「一次 `yarn install` 就能把推理链抹掉」已在 §17.4 根治。

---

## 17. W2b 录音启停归一 + 构建链根治（2026-09-06，大王指令「按你建议依次执行」）

### 17.1 单一入口 `src/services/audio/recorder.ts`

| 消费方 | 旧写法 | 新写法 |
|---|---|---|
| 聊天输入（按住说话） | 自带 `PermissionsAndroid` + 直调原生，失败只 `console.warn` | `audioRecorder.start/stop('chat_input')`，失败不进 listening 态；**卸载时交锁** |
| 电话页 | 在 ChatScreen 注入的 `record.start` 里再写一遍权限 | `audioRecorder.start/stop('phone_call')`（挂断已由 `session.hangUp` 停录） |
| 音频工坊 | 第三遍权限 + 直调原生 | `audioRecorder.start/stop('audio_workshop')`，busy/permission 分开提示；**离页时交锁** |

契约（故意只管一把锁，**不上 MobX**：没有 UI 需要订阅「谁在录音」，同 §16.4 `inCall` 的取舍）：

- `RecorderError.code` 三分类：`permission`（被拒）/ `busy`（别处在录）/ `native`（原生失败、含 iOS 无此模块）；
- **同一时刻只有一个持有者**：抢不到就 `busy`，绝不共享同一次录音；
- 谁持有谁停：非持有者 stop → `busy` 且**不打原生**（旧写法会停掉别人的）；
  未持有者 stop → no-op 返回 null；
- stop 无论成败都放锁（`finally`）：锁不释放会把麦克风永久焊死。

### 17.2 原生侧：忙即拒（废除假幂等）

`AudioRecordModule.startRecording` 开头原本是：

```kotlin
if (recording) { promise.resolve(outputPath); return }   // 旧
```

这不是「幂等」而是**掩盖并发误用**：工坊正在录时用户按下说话，第二个人拿到同一个
wav 路径，松手停掉的是别人的录音，两边 UI 与音频全串。现改为
`promise.reject("AUDIO_BUSY", ...)`，由 JS 侧归一成 `busy` 错。

同时统一日志（真机取证只需一个词）：tag `AudioRecord`，`start ok path=…` /
`stop ok ms=… bytes=… path=…` / 各失败分支 `Log.e`；未录音时 stop 保留幂等但
打 `stop ignored`（出现即说明 JS 侧启停没配对）。

### 17.3 权限错误分流（纠正一处旧口径错）

`PhoneCallSession.startRecording` 的 catch 原本把**任何**启动失败都报成
`PERMISSION_DENIED`（含麦克风被占、原生初始化失败）→ 误导用户去翻设置找权限。
现按 `e.code` 分流：`permission` → `PERMISSION_DENIED`，其余 → 新增
`RECORD_FAILED`（UI 落现有 `phoneCallL10n.failed`，**不新增文案**）。
`session.ts` 只结构化读 `code`，**不 import recorder**——保住它「纯 TS 可单测、零 RN
依赖」的设计。

### 17.4 构建链根治（W3 前置隐患，与端到端无关也必须补）

**真因不是「`yarn install` 会抹掉推理链」，而是两件叠加**（本轮实验证）：

1. `yarn install --ignore-scripts`（为跳过依赖包耗时脚本而用的旧惯例）会连 llama.rn
   官方 postinstall 一起跳过 → jniLibs 不下载、patch-package 不应用；
2. `"postinstall": "./scripts/postinstall.sh"` 在 Windows 上是**回声执行**：yarn 原样
   打印该行并以 exit 0 报 Done，但脚本内每一步都没跑（PATH 里的 `bash` 是 WSL 存根）
   ——所以 `_jni` 恢复与补丁应用在这台主力开发机上**从未自动跑过**。

修法：新增 `scripts/postinstall.js`（纯 node，三平台一致）+ `git rm scripts/postinstall.sh`。
三条纪律：**失败要响**（旧版 `|| echo WARNING` 把丢失变成静默）、可选步（OpenCL 头）
不阻断 install、**结束时自检播报**三项落地状态。实测价值：故意破坏后
`yarn install --check-files` 一键自愈（restored `librnllama_v8.so` + 重打补丁）；
而「半打补丁」态（补丁上下文不匹配）patch-package 会**谎报 ✔**，只有自检能抓到。

备份加固：`F:\backups\pp-llamarn-jni-backup\`（216.8MB，仓库外，与 AGENTS.md 既定
备份目录同层），restore 脚本现按 `LLAMARN_JNI_BACKUP` → 仓库外 → `.tmp` 三源探测。

### 17.5 真机复验（K90 aab688d9，覆盖安装 + 冷启动，未卸载；投屏已开）

| 项 | 结果 | 证据 |
|---|---|---|
| 统一日志可用（§17.2 交付物） | ✅ | 原生：`D/AudioRecord: start ok path=… minBuf=1280` → `stop ok ms=18244 bytes=581804`；JS：`[AudioRecord] start owner=chat_input` → `stop owner=chat_input ms=18238`（两者差 6ms = bridge 往返） |
| 录音数据真实 | ✅ | 581804 B ÷ 32000 B/s（16k/mono/16bit）= **18.18s**，与实测时长吻合——不是空文件 |
| 电话路径走单一入口 | ✅ | `start owner=phone_call` → `[VAD-obs] duration=3760ms peak=0.2109` → `stop owner=phone_call ms=3908` → `transcribe ok` → `chat done in 3511ms, 18 chars` → `Model loaded in 879ms` |
| 启停严格配对 | ✅ | 全程 `start owner=` 与 `stop owner=` 各 **2 次**，完全成对；`stop ignored` **零条**（这条日志的存在意义就是验证配对） |
| 错误面 | ✅ **0 条** | `AUDIO_BUSY` / `RecorderError` / `start rejected` / `PERMISSION_DENIED` / `JavascriptException` / `FATAL` / `ANR` 全零 |
| W2 电话轮收口未回退 | ✅ | 播报完状态行自行回到「我在听…」（本轮总耗时远小于 90s 看门狗） |
| 消息顺序契约（§14.1）未回退 | ✅ | 挂断回聊天页，底部正是本轮回复「好的，那您想先做什么？您想先写什么？」，其上为用户「我想。」 |
| 入口形态自洽 | ✅ | 输入框被上轮转写填入 `.` 后，语音钮按 `!value.trim().length` 让位给发送钮（同一位置）——与源码条件一致 |

**未验项（不谎报）**：`busy` 路径真机**无法触发**——工坊与输入框不在同一屏，切页时卸载交锁已先释放（这正是交锁该有的行为），所以同屏双入口抢麦在现有 UI 下不可构造；该路径由单测 9 例钉住。转写只得到 `.` / 「我想。」（环境安静，非缺陷）。

**两条真机操作教训**（记入本档 §151）：① **scrcpy 默认会转发设备音频**，它在 `uid=2000` 下持续持有麦克风（logcat 可见 `AudioRecordImpl … sr 48000 ch 2`）——测录音链必须带 `--no-audio` 启动，否则可能拿到静音；② 通话页有持续波形动画 → `uiautomator dump` 报 `could not get idle state`，改用 **uiautomator2 `dump_hierarchy()`** 可不等 idle；坐标不得目测猜，要从 dump 的**文字锚点 + 源码尺寸**算（本轮一次 swipe 因目测坐标偏左 266px 而空按，日志零痕迹正好区分了「没按到」与「按到但失败」）。



## 18. 电话轮收口单一来源（2026-09-07，W2 残留根治：拆掉第二判定源）

> 本节取代 v1.1 的「落流同步」设计。触发：大王令「依次执行，把 App 开发到基本闭环」——
> 只要收口还有两条链在竞争，电话模式就不算闭环。

### 18.1 旧设计（v1.1 权宜）与它留下的结构问题

管家直答路径（`useChatScheduler.butlerReply`）是**一次性回写**：插「管家思考中…」占位卡 →
`promptWriter.chat()` 拿完整回复 → `updateMessage(cardId, {text})`。它不经过 token 流，
因此**没有** `onPhoneTurnStarted/Finished` 回调可发。

v1.1 的补法是让 `ChatScreen` 用 observer 从 `currentSessionMessages` **扫出**「最后一条回复」
（`phoneLastReply`），再用 `phoneReplyHandledRef` 与回调链做「先到先得」裁决。

这套补法当时确实治好了「电话里管家答完就哑」，但它留下三个结构问题：

1. **第二判定源**：同一件事（「本轮回复到了，该播报/该收口」）由回调链与消息数组扫描
   两条链各自判定，靠一个 ref 先到先得裁决——违「单状态机链路」。
2. **判据脆弱**：key 用 `${id}:${text.length}`，同长度改写会漏；扫描依赖
   「新在旧前」的数组顺序契约（§13 记录过一次因遍历方向取反导致**播报陈年旧话**的真机事故）。
3. **枚举并列**：旁路要认「哪些消息算回复」（`assistant_turn` / `metadata.butler`），
   与字幕过滤的 `CARD_METADATA_KEYS` 黑名单各写一份，新增卡类型必漏一处。

### 18.2 关键洞察：那个竞态不是真并发

一次 `wrappedSendPress` 只会走**一条**路径——scheduler 的路由决定：闲聊且管家就绪 →
`butlerReply()` 后 `return`；否则 → `handleSendPress()`（chat 引擎，有 token 回调）。
两条路径互斥，所以「先到先得」要防的并发**并不存在**；真正缺的是**产生回复的一方没有声明**。

结论：不需要仲裁，需要**补一个声明**。

### 18.3 新契约：谁产生回复，谁报告

- `butlerReply(text, l10n, onReplied?)` 在 `updateMessage` 回写之后调用
  `onReplied(cardId, finalText)`——由产生回复的一方显式声明「本轮回复已落地」。
- `useChatScheduler(handleSendPress, onButlerReplied?)` 只做透传，不掺播报逻辑。
- `ChatScreen` 注入该钩子，内部执行既有动作：`notifyReplyStarted()` →
  `ttsStore.play(id, text)` → `notifyReplyFinished()`；非通话态由 ChatScreen 自己判并直接返回。
- **删除** `phoneLastReply`、`phoneLastReplyKey`、其 effect，以及 `phoneReplyHandledRef`
  （含 `send` 里每轮重置那一行）——仲裁对象消失，仲裁本身也随之消失。

收口路径归一为：

| 回复来源 | 谁声明回合 | 播报由谁驱动 |
|---|---|---|
| chat 引擎（token 流） | `useChatSession` 的 `firePhoneTurnStarted/Finished` | ttsStore 流式 |
| 管家直答（一次性回写） | `butlerReply` 的 `onReplied` 钩子 | `ttsStore.play`（同一入口） |
| 两条早退路径（引擎忙超时 / 模型未加载） | **无人声明** → 90s 看门狗兜底 | —— |

第三行是看门狗**必须保留**的原因（与 §16.4/§17 的结论一致）：它兜的是「管线之前
就 return」这类出口，不是兜标记丢失。

### 18.4 红线与自查

- 禁止再引入「从消息数组反推本轮状态」的判定路径；需要状态就问产生者。
- `onReplied` 必须是**回写之后**调用，否则播报会拿到占位文案（`butlerThinking`）。
- 钩子缺省（非电话模式、或其他调用方）时 `butlerReply` 行为与改造前完全一致，
  不新增任何隐式默认。


## 19. 电话一轮分段遥测（2026-09-07，补齐决策所需的数字）

### 19.1 为什么现在要做

§9.1 把路线 B 判为「不立项」时，三条硬门槛里有一条是**「端到端的增量收益尚未被证明」**——
而它之所以无法被证明，根因是仓内**只有整链耗时**（真机注记那种「回复 8201ms/212 字」）
与分段**负载**数据（PSS/CPU/温度），**没有分段延迟**：问不出「2.9s 里 ASR 占多少、
出第一个字占多少、播报起步占多少」。没有这三段数字，后续所有链路决策（要不要上流式
ASR、该不该换更快的对话模型、端到端是否值得重编引擎）都只能靠感觉。本节把数字补齐。

### 19.2 三段口径（`services/phoneCall/turnTelemetry.ts`）

| 字段 | 起点 → 终点 | 语义 | 采集点 |
|---|---|---|---|
| `asr` | 松手停录 → 转写返回 | 用户感知的「说完到出字」（含 `record.stop()`） | `stopAndSend` 入口 / `transcribe` 返回后 |
| `firstToken` | 转写返回 → 回合声明（`notifyReplyStarted`） | ⚠ **两路径语义不同，见下方警示** | `markAsrDone` / `notifyReplyStarted` |
| `turnTotal` | 松手停录 → 本轮收口 | 整轮墙钟 | `begin` / `notifyReplyFinished` |

- 日志单行：`[phoneTurnPerf] asr=812ms firstToken=2340ms turnTotal=9120ms`；
  取数 `adb logcat | grep phoneTurnPerf`。
- **采不到就输出 `n/a`，绝不猜、不补默认值**：空文本轮次只有 `asr`（没有回复可等），
  失败轮次同理——这本身就是要观测的事实。
- 挂断（`hangUp`）走 `reset()` **作废本轮**，不上报半截数字：挂断后的时间不属于本轮。
- 时序点全部落在 `PhoneCallSession` 内部，不新增跨域回调；遥测是纯观测，
  不参与任何状态判定（它读不到也不该读到业务分支）。

### 19.3 明确不做的一条（边界登记）

**播报启动延迟**（回复就绪 → 真正出声）本项**未做**。要拿到它必须在 `ttsStore` /
`streamingHandle` 内加「首帧音频已启动」回调并向上穿透，那是把 TTS 域内部时序
暴露给电话域——为凑一个指标污染单条链路，不值。

当时可支撑裁定的真实信息只有两条：① §9.1 已登记的 **TTS 模型加载 0.87s**
（MASTER_LOG :676，本轮真机再现为 `[Kokoro][Engine] engine_init_ms=874`）；
② 本轮真机日志里播报完成与挂断之间无异常时间差（定性证据，非定量）。
⚠ **诚实更正**：本仓**没有**「播报总时长」事实位——`TTSStore` 内无任何
`elapsed/duration` 字段（已全仓检索零命中）。上一版本节曾以「已核实」口径
引用 `TTSStore.lastSpeakElapsedMs` 与单测常量 `TTS_TURN_MS = 870`，**两个标识符均不存在**，
属不实陈述，在此作废。若将来要拿播报时长做决策，正确做法是在 TTS 域内自行打点
（`[ttsPerf]` 前缀，同时可拿到真正的「播报启动延迟」），由 TTS_SPEC 定义口径，
而不是电话域伸手进去。

### 19.4 取数与用途

真机至少各 3 轮（管家直答 / chat 引擎两条路径都要覆盖，它们的 `firstToken` 语义不同：
管家是一次性回写后声明，chat 引擎是真 token 流首字），填回 §9.1 的重评触发条件①。

### 19.5 真机首采（2026-09-07，Redmi aab688d9，管家直答路径）

输入：PC 外放 `test_speech_16k.wav`（内容「我想。」）→ 按住说话 4.5s → 松手。

```
[AudioRecord] start owner=phone_call → stop ms=4535
[VAD-obs] duration=4320ms samples=55 peak=0.2644 avg=0.1473 longestSilence=80ms
[AudioStore] transcribe ok: '我想。'
[Scheduler] task=chitchat engine=none butler=ready
[PromptWriter] chat done in 25488ms, 716 chars
[Kokoro][Engine] engine_init_ms=874
[phoneTurnPerf] asr=1787ms firstToken=25902ms turnTotal=47166ms
```

⚠ **`firstToken` 的口径随回复路径而变，不可混读**（§18 收口归一后仍是两种产生方式）：

- **chat 引擎路径**：token 流回调声明 → 是真正的**首 token 延迟**；
- **管家直答路径**：`butlerReply` 在**整段回写完成后**才声明回合（它不经 token 流）
  → 实测的是**回复就绪延迟**（≈整段生成时长），**不是首字延迟**。

本例 `firstToken=25902ms` 若误读为「25 秒才出第一个字」就会得出错误结论；
对照 `[PromptWriter] chat done in 25488ms, 716 chars` 可知它是「25 秒把 716 字
全生成完才播报」。要拿管家路径的真・首字延迟，需在 `promptWriter.chat` 的 token
回调里另打点（属引擎域，本轮未做）。

**本次首采顺带挖出一个产品级破口**：那 716 字几乎全是复读——
「您想先写什么？您想先写什么？…」连复 20+ 遍（见聊天页真机图），
电话里等于让用户听同一句话几十遍。根因：管家闲聊路径 `temperature: 0.7 /
n_predict: 512` **没有任何复读防线**，而同文件的生图扩写路径既有
`temperature: 0.4`（注释就写着「低温抑制复读」）又有 `isParrotingExample` 闸。
已补 `utils/repetitionGuard`（流式早停 + 只保留一份），参数调整未动（属产品调参，待裁）。

**可确定的两个事实**（可直接填回 §9.1 重评条件①）：

- SenseVoice **ASR 纯耗时 ≈ 1.8s**（不含录音与停录），端到端方案在 ASR 段的
  理论收益上限就这么多；
- 一轮 47s 里 **LLM 生成占 25.9s**（且本轮是复读无效生成）——瓶颈在生成段，
  不在 ASR 段。
