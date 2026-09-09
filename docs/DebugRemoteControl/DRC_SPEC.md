---
doc_id: DRC_SPEC
module: root
type: spec
status: active
version: '1.2'
created: '2026-08-19'
updated: '2026-08-23'
relates:
  [
    COMPASS_SYSTEM_SSOT,
    STATE_COMPASS_ENGINE_SELF_NAVIGATION_SSOT,
    POCKETPAL_CHAT_UI_SPEC,
  ]
---

<!-- D-FORMAT:v3 -->

# 小黄鸡远程调试 DRC（Debug Remote Control）协议规范

> 单一事实源：App 远程调试双通道（命令注入 + 事件观测）的协议、动作注册表、事件清单与安全边界。
> 任何 DRC 协议变更必须先更新本文档再改代码。
> 版本：v1.1（2026-08-19，P0-P4 落地 + v1.1 流式进度补全）

> v1.1（2026-08-19）：chat.assistant_delta 触发点扩到 updateActiveStepStreaming（assistant_turn
> 流式路径）——此前只在 updateMessage（整条落库）发，agent 环流式增量 token 在涨但事件流死寂，
> 开发侧看不到生成进度（K90 真机血证）。text=步骤累计内容，drc-tail --follow 可实时观测 token 增长。

## 0. 设计哲学

**目标**：让 AI 测试时「发送调用值直接驱动 App，读落盘日志替代读屏幕」。

**锋利原则**（与产品哲学一致）：

- 不新增网络协议 / 不新增原生代码 / 不加按钮埋点层
- 复用共享存储（`/sdcard/Documents/AIOS/`）+ MobX store 层（UI 按钮本质是 store action 的薄封装）
- 观测不为 SPOF（BT07）：DRC 任何环节失败静默降级，绝不阻断业务

**与母仓对齐**：事件/状态/错误全部三字段指南针格式（定位/导航/深入），与 `COMPASS_SYSTEM_SSOT`、`STATE_COMPASS` 同构；编号体系见 [COMPASS_REGISTRY.md](COMPASS_REGISTRY.md)。

## 1. 架构：文件双通道

```
开发机 (Windows, adb)                真机 App
─────────────────────────          ─────────────────────────
输入通道:  adb push 命令 JSON ──→   AIOS_ROOT/drc/commands/<cmdId>.json
                                  DrcService 轮询(1s) → actionRegistry 执行
                                  执行后删除命令文件
输出通道:  ←─ 事件流 ── AIOS_ROOT/logs/events.jsonl  (appendFile 追加)
          ←─ 状态快照 ─ AIOS_ROOT/logs/state.json    (节流覆盖写)
          ←─ 命令结果 ─ AIOS_ROOT/drc/results/<cmdId>.json
```

- 输入通道：命令 JSON 文件投递（adb 天然支持 WiFi 远程 `adb connect`，无需额外代码）
- 输出通道：`events.jsonl` 追加式（调试视图）；`state.json` 覆盖写（节流 1s）；DB（WatermelonDB）为事实源，事件流为增量观测视图

## 2. 命令协议

### 2.1 命令文件（输入）

路径：`AIOS_ROOT/drc/commands/<cmdId>.json`（文件名即 cmdId，二者必须一致）

```json
{
  "cmdId": "cmd_1755000000000",
  "actionId": "chat.send",
  "params": {"text": "你好"},
  "timeoutMs": 30000
}
```

| 字段      | 类型   | 必填 | 说明                                      |
| --------- | ------ | ---- | ----------------------------------------- |
| cmdId     | string | 是   | 唯一命令 id（文件名一致；重复执行会覆盖） |
| actionId  | string | 是   | 动作注册表内 id（白名单，未知拒绝）       |
| params    | object | 否   | 动作参数（zod schema 校验）               |
| timeoutMs | number | 否   | 超时，默认 30000                          |

### 2.2 结果文件（输出）

路径：`AIOS_ROOT/drc/results/<cmdId>.json`

```json
{
  "cmdId": "cmd_1755000000000",
  "actionId": "chat.send",
  "ok": true,
  "durationMs": 320,
  "data": {"sent": true, "text": "你好"},
  "ts": 1755000000123
}
```

失败时 `ok=false`，`error` 为可读原因（含 CP 指南针编号提示）。

### 2.3 消费语义

- App 轮询到命令 → 先删除命令文件（防重复）→ 执行 → 写结果
- 命令 JSON 解析失败 / cmdId 不一致 → 写失败结果，不执行
- 轮询仅在 App 前台 + drcEnabled 时进行

## 3. 事件流协议

路径：`AIOS_ROOT/logs/events.jsonl`（每行一个 JSON 事件）

```json
{
  "ts": 1755000000000,
  "seq": 12,
  "domain": "chat",
  "type": "chat.user_msg",
  "payload": {"sessionId": "abc", "messageId": "m1", "text": "你好"}
}
```

| 字段    | 类型   | 说明                                                    |
| ------- | ------ | ------------------------------------------------------- |
| ts      | number | 时间戳（ms）                                            |
| seq     | number | 单调递增序号（每次 App 启动从 0 起）                    |
| domain  | string | 功能域：app/nav/chat/imagegen/model/engine/error/system |
| type    | string | 事件类型（见 §4）                                       |
| payload | object | 事件负载                                                |

### 事件清单（埋点 6 处统一出口）

| 域       | 类型                      | 触发点                                                                                       | 负载要点                                                    |
| -------- | ------------------------- | -------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| app      | app.drc_ready             | DrcBridge 挂载                                                                               | enabled                                                     |
| nav      | nav.go                    | actionRegistry nav.go                                                                        | route                                                       |
| chat     | chat.user_msg             | ChatSessionStore.addMessageToCurrentSession（user）                                          | sessionId/messageId/text                                    |
| chat     | chat.assistant_msg        | 同上（assistant）                                                                            | sessionId/messageId/text                                    |
| chat     | chat.assistant_delta      | ChatSessionStore.updateMessage / updateActiveStepStreaming（节流 300ms/消息，text=累计内容） | sessionId/messageId/text                                    |
| chat     | chat.turn_done            | useChatSession run_finished                                                                  | sessionId/messageId/hitMaxTurns/tokensPredicted/contextFull |
| chat     | chat.tool.error           | AgentRunner.executeOne 工具错误分支（WORKSPACE_TOOL_ERROR_FEEDBACK_SPEC §3.7）               | tool/errorMessage/hasGuide                                  |
| imagegen | imagegen.start            | imageGenStore.generate / generateDreamLiteEntry                                              | prompt/seed/steps/cfg/width/height                          |
| imagegen | imagegen.stage            | pullSnapshot（SD 1Hz）与 DreamLite 采样回调（节流）                                          | progress/stage/stepTime                                     |
| imagegen | imagegen.done             | generate / generateDreamLiteEntry 成功                                                       | uri/seed/prompt/durationMs                                  |
| imagegen | imagegen.failed           | generate / generateDreamLiteEntry 失败                                                       | error/seed/prompt                                           |
| engine   | state.change              | engineStatus.setPhase/setProgress/setError（节流）                                           | kind/phase/progress/stage/error                             |
| error    | error.reported            | errorReport.buildErrorReport                                                                 | scope/summary/cpId                                          |
| system   | command.start/done/failed | drcService 命令生命周期                                                                      | cmdId/actionId/error                                        |

## 4. 状态快照（状态指南针）

路径：`AIOS_ROOT/logs/state.json`

```json
{
  "ts": 1755000000000,
  "appVersion": "v2.0.0 (144)",
  "currentRoute": "Chat",
  "activeSessionId": "abc",
  "engines": {
    "prompter": {
      "state": "ready",
      "nextAction": "run_task",
      "label": "引擎就绪",
      "terminal": false,
      "evidence": {"progress": -1, "stage": "", "error": null}
    },
    "chat": {
      "state": "idle",
      "nextAction": "load_model",
      "label": "引擎空闲",
      "terminal": true,
      "evidence": {}
    },
    "image": {
      "state": "idle",
      "nextAction": "load_model",
      "label": "引擎空闲",
      "terminal": true,
      "evidence": {}
    }
  },
  "lastError": {"cpId": "CP-APP-001", "summary": "...", "ts": 1755000000000},
  "lastCommand": {"cmdId": "cmd_1", "actionId": "nav.go", "ts": 1755000000000}
}
```

StateCompass 五字段与母仓 `STATE_COMPASS` 同构：state（定位）/ nextAction（导航）/ label（人类可读）/ evidence（深入）/ terminal（终态）。未知状态降级 `unknown`，观测失败静默（BT07）。

## 5. 动作注册表

白名单注册（新增在此登记，id 语义永久稳定——BT05 向前兼容，不改名不删除）。

> **BT05 的兼容承诺只覆盖「已登记者」**：未进本表的 id 不构成对外契约，可随时收并/删除。
> 本窗实测发现：`audio.transcribe` 与 `audio.ttsGenerate` 自 `3143a3a`（2026-08-24 pack 丢失事故后的
> 「整合 23 个本地提交重建 main」）**就已存在于代码但从未登记本表**——事故重建是登记漏口的根源。
>
> 🔴 **本表与代码的一致性不再靠人眼：已挂 `yarn audit:drc-actions`（见 §10）**。它与 `audit:compass`
> 同构——登记面/执行面任一侧漂移即红。本窗之所以能发现「25 行 vs 27 个」这类错，完全靠临时脚本，
> 面下次新增动作仍会漏。

**当前注册数：27 个**（由 `audit:drc-actions` 与代码双向校验，不得手工改此数）。

| actionId                   | 参数（zod）                                                                                                    | 说明                                                                                                                                                                                                                                                                                                             |
| -------------------------- | -------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| system.ping                | -                                                                                                              | 连通性探测                                                                                                                                                                                                                                                                                                       |
| system.state               | -                                                                                                              | 返回状态快照                                                                                                                                                                                                                                                                                                     |
| system.events              | last(1-500)                                                                                                    | 读事件流尾部（默认 20 行，JSON 解析）                                                                                                                                                                                                                                                                            |
| nav.go                     | route（ROUTES 枚举）/ params                                                                                   | 页面跳转                                                                                                                                                                                                                                                                                                         |
| chat.send                  | text(1-20000)                                                                                                  | 发消息（走 ChatScreen 调度链路：意图路由/管家直答；需 ChatScreen 在岗）                                                                                                                                                                                                                                          |
| chat.switchPal             | palId                                                                                                          | 切换会话 Pal                                                                                                                                                                                                                                                                                                     |
| chat.newSession            | title(≤100)                                                                                                    | 新建会话                                                                                                                                                                                                                                                                                                         |
| imagegen.generate          | prompt/steps(1-64)/cfg(0-20)/width/height(64-2048)/seed/negativePrompt/loraPath/loraMultiplier(0-2)/modelLabel | SD 生图（需 SD 模型已加载）                                                                                                                                                                                                                                                                                      |
| imagegen.generateDreamLite | prompt/width/height(64-2048)/steps(1-64)                                                                       | DreamLite 文生图（4 步 DMD2；未加载时自动加载）——**与 UI「出图」按钮同链路**：走 beginTask/scrollToPreview/finishTask 编排（建 running 任务页 + PerfPanel 进度卡可达），非 raw 引擎直调（2026-08-23 编排对齐，MASTER_LOG §77）                                                                                   |
| imagegen.upscale           | uri/scale(2\|4)/style(general\|anime\|anime_fast)                                                              | RealESRGAN 通用放大（P6-6，CPU 耗时较长；自动释放 DreamLite/SD）；style：通用写实/动漫高清（RRDBNet-6）/动漫快速（animevideov3，快约 4 倍）——2026-08-21 双模型可选登记                                                                                                                                           |
| imagegen.loadModel         | modelPath/clipL/clipG/llm/vae/backend                                                                          | 加载 SD 模型                                                                                                                                                                                                                                                                                                     |
| imagegen.loadDreamLite     | -                                                                                                              | 加载 DreamLite 引擎（unet/vae/TE）                                                                                                                                                                                                                                                                               |
| imagegen.unloadModel       | -                                                                                                              | 卸载 SD 模型                                                                                                                                                                                                                                                                                                     |
| imagegen.recoverHistory    | -                                                                                                              | 相册记录一次性恢复（B27 开发工具：扫描磁盘图文件重建 legacy 条目，非产品兜底）——2026-08-21 登记                                                                                                                                                                                                                  |
| models.scan                | -                                                                                                              | 扫描本地模型                                                                                                                                                                                                                                                                                                     |
| models.load                | modelId                                                                                                        | 加载模型并设为活动（displayModels 内）                                                                                                                                                                                                                                                                           |
| models.unload              | -                                                                                                              | 释放当前活动模型上下文                                                                                                                                                                                                                                                                                           |
| server.list                | -                                                                                                              | 列出已配置远程服务器（id/name/url/serverType）——义肢链路取证入口 ——2026-09-09 登记                                                                                                                                                                                                                               |
| server.add                 | name(≤100)/url/apiKey?/serverType?/requestTimeoutMs(1s-600s)?                                                  | 登记服务器（同 ServerDetailsSheet 落库链：`addServer` + `setApiKey`）。回显 `storedUrl` 供确认未被加工；apiKey 走 Keychain，不落命令文件回显 ——2026-09-09 登记                                                                                                                                                   |
| server.probe               | serverId                                                                                                       | 对已登记服务器探连通（复用 `serverStore.testServerConnection`，与 UI「测试连接」同链路）。额外回传 `inputUrl` + `requestUrl`：后者即 `${normalizeUrl(url)}/v1/models`，是 /v1 幂等铁律的可观测面；失败 `error` 携诊断文案（如铁律 8.2 的 401 专属域提示）——不提供裸 URL 变体，避免开第二状态路 ——2026-09-09 登记 |
| server.remove              | serverId                                                                                                       | 移除服务器（测试收尾用，防真验痕迹污染用户配置）：走 `removeServer`连带清 Keychain ——2026-09-09 登记                                                                                                                                                                                                             |
| server.models              | serverId/contains?/limit(1-500)?                                                                               | 列该服务器**已拉取**的模型 id（可按子串过滤）。必要性：`/v1/models` 可能回上百条（百炼专属域实测 249），全量回显会抢爆结果文件 ——2026-09-09 登记                                                                                                                                                                 |
| server.addModel            | serverId/remoteModelId                                                                                         | 把一个已拉取的远端模型加入可见集（同 UI「添加模型」：`addUserSelectedModel`）。**没有这一步义肢永远离线**：`modelStore.remoteModels` 只派生自 `userSelectedModels`，直接决定 `resolveLimbTier` 是否短路 ——2026-09-09 登记                                                                                        |
| server.removeModel         | serverId/remoteModelId                                                                                         | 从可见集移出单个远端模型（`removeUserSelectedModel`），测试收尾用 ——2026-09-09 登记                                                                                                                                                                                                                              |
| audio.generateTts          | engine(kokoro/supertonic/kitten)/text/voiceId/speed/numSteps                                                   | TTS 音频生成（与音频工坊「生成音频」按钮同链路：audioStore.generateTask；**voiceId 缺省才用首音色，传了不存在的 id 则报错并列可用集**（旧写法 `?? voices[0]` 会静默换音色——传错也「成功」）；kitten 为 HyperOS 配额内轻量引擎）——2026-08-22 登记；音色校验收口 2026-09-09                                                                                                                           |
| audio.transcribe           | path                                                                                                            | 转写 wav 音频（SenseVoice，`audioStore.transcribeTask`，任务化入画廊 kind=transcribe）。代码自 `3143a3a` 即存在但**从未登记**，本次补账——它是独立能力（ASR），与 generateTts 不重复 ——2026-09-09 补登记                                                                                                              |
| memory.list                | limit(1-500)?/contains?/type?                                                                                   | 读端侧记忆库（复用既有 `aiosMemory.listMemories`，**不开第二路**）。立项理由：G3/G4 全在记忆域，但记忆面**零 emit、零 DRC 动作**，provenance 写了没人能查 → 验收只能人工翻设备 JSON，与「链路可观测」自相矛盾 ——2026-09-09 登记                                                              |

> **已删除动作（留痕，2026-09-09）**：`audio.ttsGenerate`。它从未登记本表（不受 BT05 保护）、零使用方，
> 且与 `audio.generateTts` **同走 `audioStore.generateTask` 一条 store 路径**，只是引擎集更窄（无 kitten）、
> 并用 `{id, name, engine}` 合成音色对象**绕过音色校验**——属同语义双路径中的劣化那条，违反「同一语义只允许一条实现路径」。
> 删除而非保留兼容别名：别名仍是两条路。

## 6. 门控与安全

- 门控：`DRC_ENABLED = __E2E__ || NativeModules.BuildInfo.isDevSupport === true`
  - `__E2E__`：编译期注入（e2e 构建 true，prod release 折叠 false）
  - `BuildInfo.isDevSupport`：原生 `BuildConfig.USE_DEV_SUPPORT`（debug=true / release=false）——**Hermes 预编译 assets bundle 下 `__DEV__` 恒折叠 false，JS 侧无法区分构建类型，必须依赖原生信号**（2026-08-19 真机实证：RN 0.82 的 assets bundle 以 dev=false 编译，`__DEV__`/`process.env.NODE_ENV` 均不可靠）
- 剥离契约：release 构建运行时恒 false（isDevSupport=false），DRC 功能不可达；代码保留于 bundle（Hermes 预编译无法静态 DCE 区分 debug/release），验证口径为「运行时不激活」
- 安全边界：
  - 纯本地零网络面（命令/结果均走共享存储文件）
  - actionId 白名单 + zod 参数校验（未知 actionId 拒绝）
  - 不含文件删除/系统命令类动作
  - 命令消费后即删；结果含 cmdId 防串扰

### 环境陷阱（真机实证 2026-08-19）

- **Metro dev bundle 在部分设备上启动即崩**：`[runtime not ready]: TypeError: Cannot read property 'level' of undefined`（React Refresh + worklets logger 时序，与 DRC 无关——已隔离实验证明）。现象：Metro 连接后 App 红屏，`PocketPal has not been registered`。**对策**：真机验证用 assets fallback（删 `run-as com.pocketpalai rm -f files/BridgelessReactNativeDevBundle.js` 后冷启动），DRC 依赖 BuildInfo 原生门控仍可工作
- **RN 0.82 debug 构建的 assets bundle 是 dev=false 编译**：`__DEV__` 恒 false、DevToolsScreen 不显示。任何「按 **DEV** 区分构建类型」的 JS 逻辑均失效，必须用原生 BuildConfig 信号
- **E2E（WebdriverIO/Appium）在 HyperOS 设备上被安装拦截**：UiAutomator2 server APK 安装触发 `INSTALL_FAILED_USER_RESTRICTED`（HyperOS USB 安装确认），session 创建失败。**对策**：e2e/specs/drc.spec.ts 的核心断言（命令→results→events.jsonl）已由真机人工验证覆盖；HyperOS 上如需跑 E2E 需先人工确认 UiAutomator2 server 安装

## 7. 开发机工具

| 工具                                                                                                           | 用途                                                                                                            |
| -------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `node scripts/drc/drc-push.js <actionId> [jsonParams] [--device <id>] [--timeout <ms>] [--params-file <path>]` | 发送命令并等待结果（--timeout 默认 30000；--params-file 从 JSON 文件读参数，Windows PowerShell 引号易错时首选） |
| `node scripts/drc/drc-tail.js [--last N] [--follow]`                                                           | 读事件流                                                                                                        |
| `node scripts/drc/drc-state.js`                                                                                | 读状态快照                                                                                                      |

示例：

```bash
node scripts/drc/drc-push.js system.ping
node scripts/drc/drc-push.js nav.go '{"route":"ImageGen"}'
node scripts/drc/drc-push.js chat.send '{"text":"你好"}'
node scripts/drc/drc-push.js imagegen.generate '{"prompt":"apple","steps":4,"seed":42}'
node scripts/drc/drc-push.js imagegen.generateDreamLite --params-file ./gen.json --timeout 300000
node scripts/drc/drc-tail.js --last 20
node scripts/drc/drc-state.js
```

adb 文件 push/pull 属允许的非 UI 操作；真机过程仍可叠加 scrcpy 供监督（不冲突）。

## 8. 代码结构

| 文件                        | 职责                                                        |
| --------------------------- | ----------------------------------------------------------- |
| src/debug/drcTypes.ts       | 共享类型（命令/事件/快照/结果）                             |
| src/debug/eventStream.ts    | 事件流落盘（emit + 节流）                                   |
| src/debug/actionRegistry.ts | 动作白名单 + zod 校验 + 执行                                |
| src/debug/drcService.ts     | 命令轮询执行器                                              |
| src/debug/stateSnapshot.ts  | 状态快照（StateCompass 映射）                               |
| src/debug/stateCompass.ts   | 域级 STATE_MAP（engine/chat/imagegen/model + unknown 降级） |
| src/debug/errorRegistry.ts  | 错误模式注册表（CP-APP-NNN）                                |
| src/debug/DrcBridge.tsx     | 挂载点（导航槽 + 订阅接线）                                 |
| scripts/drc/\*.js           | 开发机侧 adb 工具                                           |

## 9. 跨窗口智能体调用（Skill 入口）

其他窗口的智能体要用 DRC 做真机测试，读 pp 仓 `.cursor/skills/drc-remote-debug/SKILL.md`（已挂测试专工啄木鸟链路 v1.1.2）。

标准调用提示词（交给其他窗口智能体照抄，v3）：

> 小黄鸡真机测试走 DRC 远程调试：读 pp 仓 `.cursor/skills/drc-remote-debug/SKILL.md` 与
> pp 仓 `docs/DebugRemoteControl/DRC_SPEC.md`，按其中「标准测试序列」执行（system.ping
> 探连通 → 发 actionId → 读事件流/state.json 取证）。禁止卸载 App；release 包门控恒关。

细节全部收敛在文档（前置/参数/陷阱/CP 处置），提示词不重复。

约束：DRC 驱动的是与用户点按钮同一链路的 store action（非绕 UI 跑 API），操作过程屏幕有真实可见变化，叠加 scrcpy 投屏监督。新增动作先登记 §5 再改代码（BT05）。

> ⚠ **`.cursor/` 不入库**（`.gitignore` 有一条 `.cursor/`，整目录被排除）：
> `.cursor/skills/drc-remote-debug/SKILL.md` 只是本机的智能体触发入口，**新克隆 / 拉 origin 的其他窗口拿不到它**
> （与本文 §早期提到的 `.github/workflows/` 陷阱同类）。本文档（已 tracked）才是唯一持久事实源：
> 上面那段提示词已自带全部可执行信息（三工具 + 标准序列 + 红线），不依赖 skill 文件存在。

## 10. 登记面与执行面的对账闸（`audit:drc-actions`）

本窗实测撞到的账目偏差：§5 表登记 25 个，而 `actionRegistry.ts` 实际注册 27 个
（`audio.transcribe` / `audio.ttsGenerate` 自 `3143a3a` 事故重建起就漏登）。我能在本轮发现它，
**完全靠临时写脚本枚举对比**——这意味着下次新增动作仍会漏。按 AGENTS.md 纪律 5：
*新工具/闸门后要拿探针自证它能报错，空转的闸门比没有更险*。

| 项 | 口径 |
|---|---|
| 脚本 | `scripts/audit-drc-actions.js`（与 `audit-native-mocks.js` / `audit-async-timers.js` / `audit-gate-reentry.js` 同取 kebab 命名），出口 `AUDIT_DRC_ACTIONS doc=N code=M missing=[…] stale=[…] countLine=K` |
| 双向 | 代码有而表里无 → `missing`（BT05 违规：未登记即不得消费）；表里有而代码无 → `stale`（死登记） |
| 计数自证 | 表头「当前注册数：N 个」必须等于代码实际数，否则红（防“只手改表不改数”——本窗我自己就错过一次：加 `memory.list` 后表已 27 行而计数仍留 26，由闸门首跑撞出） |
| 挂点 | `.husky/pre-commit`（与其余闸门同列）+ `package.json` scripts |
| 探针自证 | `scripts/__tests__/audit-drc-actions.test.js`：给纯函数 `audit(codeText, docText)` 喂四种脏态（代码多一个 / 表少一行 / 计数失真 / §5 标题被改名）均必须判红；**同时断言净态判绿**——只会红的闸门与只会绿的闸门一样无用 |
| 红时行为 | **非零退出阻断提交**，不兼容“警告后放行”——警告等于没有 |
