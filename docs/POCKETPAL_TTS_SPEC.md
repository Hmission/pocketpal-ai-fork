---
doc_id: POCKETPAL_TTS_SPEC
module: root
type: spec
status: active
version: '1.0'
created: '2026-09-06'
updated: '2026-09-06'
relates:
  [POCKETPAL_PHONE_SPEC, POCKETPAL_AUDIO_UI_SPEC, POCKETPAL_TEST_INFRA_SPEC]
---

<!-- D-FORMAT:v3 -->

# POCKETPAL 播报（TTS）规范（单一事实源）

> 2026-09-06 立。起因：主线 W1a「stop 噪音根治」取证时发现——播报门、引擎能力门、
> OS 就绪位三件事已在代码里各自成型，但**没有任何文档描述它们的口径**，且
> `TTSStore.ts` 注释长期指向一份**不存在的** `architecture/tts.md`（悬空指针）。
> 本文件补上这个空洞，并钉死 stop 的语义。

## 一、四颗事实位（每件事只有一个源头，UI 只读不改写）

| 事实             | 唯一源头                                    | 答的问题                                             | 位置                          |
| ---------------- | ------------------------------------------- | ---------------------------------------------------- | ----------------------------- |
| 能不能播         | `TTSStore.speakBlock` → `voiceBlock(voice)` | 设备档位 / 有无音色 / 引擎是否就绪                   | `src/store/TTSStore.ts`       |
| 引擎就绪         | `TTSStore.engineIsReady(id)`                | 需要模型文件的取下载状态；**OS 引擎取 `osTTSReady`** | 同上                          |
| OS 合成器就绪    | `TTSStore.osTTSReady`（`null`=未探测）      | 那颗系统引擎到底能不能用                             | 同上                          |
| 谁在 native 占位 | `ttsRuntime.getActiveEngineId()`            | 此刻原生层装载的是哪颗引擎                           | `src/services/tts/runtime.ts` |

红线：① 不得再出现第二套「能不能播」判定（历史上 `isTTSAvailable` /
`isTTSAvailable && currentVoice` / 通话页自拼 三套并存，口径互异，造成
「UI 说就绪、实际播不出」）。② `engineIsReady` 不得散落 `!== 'system'` 特判，
一律走 `requiresModelFile` 能力位。

## 二、stop 的语义：什么算真失败

`Speech.stop()` 是 fork 库的**合体 API**：先同步置 neural 引擎的停止标志，
再 `await TurboSpeech.stop()` 打系统合成器。**本仓拿不到只停 neural 的 API**
（引擎对象是库内私有变量），所以无法在 JS 侧拆分派发。

由此产生本仓必须承担的义务——**按事实给这次失败定性**，而不是按 API 返回值一刀切：

| 活跃引擎 | `osTTSReady`     | 这次 stop 的 OS 半段失败意味着              | 处置                                               |
| -------- | ---------------- | ------------------------------------------- | -------------------------------------------------- |
| `system` | 任意             | **真失败**：系统合成器是唯一发声通道        | 抛出 → `speakIssue='failed'` 让用户可见            |
| neural   | `true`           | **真失败**：OS 侧确实可能还有东西在播       | 同上                                               |
| neural   | `false` / `null` | **无事可停**：OS 从未就绪，本仓也没经它发声 | 不得冒充「stop 失败」；neural 已同步置位，意图达成 |

判定函数抽为纯函数 `ttsStopFailureIsReal(activeEngineId, osTTSReady)`。
**理由不是整洁**：这三行分支在真机上不可构造（要弄坏系统 TTS 引擎或换档位才碰得到），
按 `POCKETPAL_TEST_INFRA_SPEC` 四条自查第 4 条，单测是唯一防线。

禁止形态：在 catch 里无差别 `console.warn` 或 `.catch(() => {})` 吞掉。
两者都把「本仓的意图是否达成」这个信息丢掉了——前者制造假失败噪音，
后者掩盖真失败。

## 三、串行链纪律（唯一原生停止出口）

`ttsRuntime.opMutex` 是全仓唯一的原生 TTS 串行链。任何触碰原生 stop 的操作
都必须排在它上面，否则会出现「fire-and-forget 的 stop 杀掉后发起的新流首句」。

- `acquire` / `release` / `stop` 已串行。
- **流式 `cancel` 也必须串行**：`streamingHandle.cancel()` 内部动作
  （清 chunker 缓冲、释放 stopSignal、等 loopPromise、清理进度订阅）**一个都不能少**，
  所以收口方式是把整段 `stream.cancel()` 纳入 runtime 串行链，
  **不是**用 `ttsRuntime.stop()` 替换它（替换会漏掉上述四件事）。
- 库在创建流时把 `stop: () => Speech.stop()` 绑进了 stream 内部，
  这是绕过串行链的历史通道，本仓不得再新增同类用法。

## 四、上游库已知缺陷（禁止本地 patch）

`@pocketpalai/react-native-speech@2.5.0`（上游仓库 `a-ghorbani/react-native-speech`，
非本组织 fork，本机无源码）存在两处缺陷：

1. `RNSpeechModule.kt` 的 `stop()` 套在 `ensureInitialized` 里 → 未初始化时**现场
   new 一颗 `TextToSpeech`** 并把 stop 挂成 pending；3 次重试（退避 1s/2s/4s +
   每轮 5s 超时）全败后 `rejectPendingOperations()` 回以
   `"Failed to initialize TTS engine"` / code `speech_error`。
   只读与停止类操作不该顺手建引擎。
2. `Speech.js` 注释断言 `OS TTS stop is always safe to call`——在第 1 条的实现下**不成立**。

处置纪律：**不打 `patch-package` 本地魔改**（本仓 `patches/` 只用于确有必要的
上游依赖适配，用它绕过语义缺陷会退化成红线禁止的补丁形态）；正确出口是上游 PR。
本仓侧只承担第二、三节的义务：按事实定性 + 唯一串行出口。

## 五、真机取证（Redmi 25102RKBEC / Android 16 / 设备 aab688d9）

```
settings get secure tts_current_engine  →  null
pm list packages | grep -iE 'tts|speech' →  com.xiaomi.mibrain.speech（包在，未设为默认）
dumpsys texttospeech                     →  空输出
```

即：系统 TTS 引擎从未被用户设为默认，OS 合成器 init 必然失败；而本仓播报走
neural 引擎（Supertonic/Kokoro/Kitten）。**每一次 stop 打向 OS 都是纯多余派发**，
这就是 `[ttsRuntime] stop failed` 噪音的完整因果链。

## 六、已知债与口径更正（登记不掩盖）

1. **注释悬空指针**：`TTSStore.ts` 多处引用 `architecture/tts.md §4a / §4a.1 / §4a.5 / §4e`，
   该文件在本仓**从不存在**。本轮起以本文件为播报架构事实源，注释指针同步改指此处。
2. **母仓任务记录数值错误**：主线登记称「phoneMode 不再靠 **10s** 看门狗兜底」，
   实际代码是 `REPLY_TIMEOUT_MS = 90_000`（`src/services/phoneCall/session.ts:31`），
   全仓电话/音频链上无 10000 字面量。
3. **W1a 三项状态核实**：「引擎能力门」与「两套播报门合并」**均已完工并有单测**
   （`engineIsReady` 能力位驱动 / `speakBlock` 单一事实源 + 四条契约测试）；
   唯「stop 噪音根治」只完成一半——`TTSStore.stop()` 挡住了"无活跃引擎"，
   未挡住"neural 活跃 + OS 从未就绪"，即本文件第二节的场景三。
4. **W2 两项核实**：「phoneMode 全链透传」已被**更优方案取代**（删除透传链，
   改单一状态源 `isInCall()`，见 `src/services/phoneCall/inCall.ts`）；
   「录音启停归一」已完工（三处直调原生收敛为 `recorder.ts` 一把 owner 锁）。
   看门狗**不可删除**：引擎忙超时 / 模型未加载两条早退路径发生在电话管线之前，
   看门狗是那些出口的唯一收口手段。
5. **残留双状态源**（下一波候选）：电话轮收口除回调链外，还有
   `ChatScreen` 的 `phoneLastReply` observer 派生 + `phoneReplyHandledRef`
   先到先得，构成第二判定源，违「单状态机链路」。
