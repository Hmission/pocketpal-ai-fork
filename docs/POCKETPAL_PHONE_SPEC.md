---
doc_id: POCKETPAL_PHONE_SPEC
module: chat
type: spec
status: active
version: "2.1"
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
