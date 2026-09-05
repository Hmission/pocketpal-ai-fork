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

- **不做端到端语音模型直通**（路线 B：Qwen3-Omni-4B / MiniCPM-o 2.6 + llama.rn vocoder 链路，
  llama.rn 0.12.7 API 已备，列为实验分支后置，数据说话再定）。
- 不做免提/VAD 自动断句（首版 = 按住说话，交互收敛）。
- 不做通话专属气泡/专属消息类型（复用现有消息卡）。
- 不新增 Drawer/设置页入口（单入口 = 聊天页顶栏图标）。
- 不改引擎层（llama.rn / sherpa / ONNX JNI 为 UI 改造禁区，星图红线）。

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
  → 不能断言可直接跑通，“API 在册”≠“能力可用”。

**结论**：路线 B 不是“重编内核”型活（引擎禁区暂时不触发），而是
“选型 + 接线 + 实测”型活，但**可行性尚未验证**，不得先拍工期。按依赖分四步：

| 步 | 内容 | 产物 | 前置/红线 |
|---|---|---|---|
| S1 可行性 spike | 选一颗音频 GGUF（MiniCPM-o 2.6 / Qwen2.5-Omni 3B 系），`initVocoder` 跑通“语音进→语音出”，记 K90 首字延迟/峰值内存/温度 | spike 报告 + 数据 | 只用现有 `.so`；**禁止擅自重编 llama.cpp**（需先立项请示） |
| S2 模型资产与下载 | 模型目录/体积/增量下载 + 与现有 12 模型阵容的内存互斥降级策略 | 模型页可下载可卸载 | 不挤碎现有聊天体验（G1-G5 性能门禁） |
| S3 双引擎路由 | 电话模式可选“级联（现）/端到端”，单点决策不双跑 | 设置页一行开关 | 现有级联不删除（低端设备回退路径） |
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

- `src/**` 全域零命中 `SpeechRecognizer` / `RecognitionListener`；
  `android/app/src/main/java/**` 同样零命中 → **App 从未接入手机系统语音识别**。
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
- **归属口径（v2.4 自查修正）**：不得假设「`type==='text'` 就是我说」——系统提示
  （模型未加载 / `Completion failed: …`）也是 text 且 author=assistant，旧写法会把报错
  当「我说的话」铺进字幕。定法：`metadata.system` 一律**不入流**；其余按 author id 判
  `me`/`partner`，author 缺失才按消息类型回退（与 `contextCompaction.speakerOf` 同口径）。
- 尾窗 12 条（`DIALOGUE_TAIL`）：防长通话无限渲染；上滚看更早历史不在本期范围。
- 视觉：伙伴句 `onSurface`（深）、用户句 `onSurfaceVariant`（浅），左对齐纯文本
  （豆包同构，不用气泡——通话页是“读字幕”不是“翻聊天记录”）；新内容自动滚到底
  （签名 = 句数 + 末句长度，否则逐字增量不跟随）。

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
  （免提场景风险）。**数据不支持就不上免手**，不做“看起来高级”的自欺。

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

- 已落代码 + 单测：§14.1（含归属修正与系统提示不入流）、§14.2、§14.3。
- **待真机终验**（本窗不构建 APK，K90 装机验证下一窗）：验收项 1–4 全部靠单测与链路复核，
  真实振幅波形与 logcat `[VAD-obs]` 数据**尚未取到一条真机证据**——取到前不得称 v2.4 定版。
- 未入本波（回到 §12.2 P1）：转写态防闪驻留（定案见 §13.1）、ASR 增量流式回显、打断提示上行。

