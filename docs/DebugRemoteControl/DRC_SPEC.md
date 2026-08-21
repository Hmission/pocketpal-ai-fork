---
doc_id: DRC_SPEC
module: root
type: spec
status: active
version: "1.1"
created: "2026-08-19"
updated: "2026-08-19"
relates: [COMPASS_SYSTEM_SSOT, STATE_COMPASS_ENGINE_SELF_NAVIGATION_SSOT, POCKETPAL_CHAT_UI_SPEC]
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

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| cmdId | string | 是 | 唯一命令 id（文件名一致；重复执行会覆盖） |
| actionId | string | 是 | 动作注册表内 id（白名单，未知拒绝） |
| params | object | 否 | 动作参数（zod schema 校验） |
| timeoutMs | number | 否 | 超时，默认 30000 |

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
{"ts": 1755000000000, "seq": 12, "domain": "chat", "type": "chat.user_msg", "payload": {"sessionId": "abc", "messageId": "m1", "text": "你好"}}
```

| 字段 | 类型 | 说明 |
|---|---|---|
| ts | number | 时间戳（ms） |
| seq | number | 单调递增序号（每次 App 启动从 0 起） |
| domain | string | 功能域：app/nav/chat/imagegen/model/engine/error/system |
| type | string | 事件类型（见 §4） |
| payload | object | 事件负载 |

### 事件清单（埋点 6 处统一出口）

| 域 | 类型 | 触发点 | 负载要点 |
|---|---|---|---|
| app | app.drc_ready | DrcBridge 挂载 | enabled |
| nav | nav.go | actionRegistry nav.go | route |
| chat | chat.user_msg | ChatSessionStore.addMessageToCurrentSession（user） | sessionId/messageId/text |
| chat | chat.assistant_msg | 同上（assistant） | sessionId/messageId/text |
| chat | chat.assistant_delta | ChatSessionStore.updateMessage / updateActiveStepStreaming（节流 300ms/消息，text=累计内容） | sessionId/messageId/text |
| chat | chat.turn_done | useChatSession run_finished | sessionId/messageId/hitMaxTurns/tokensPredicted/contextFull |
| imagegen | imagegen.start | imageGenStore.generate / generateDreamLiteEntry | prompt/seed/steps/cfg/width/height |
| imagegen | imagegen.stage | pullSnapshot（SD 1Hz）与 DreamLite 采样回调（节流） | progress/stage/stepTime |
| imagegen | imagegen.done | generate / generateDreamLiteEntry 成功 | uri/seed/prompt/durationMs |
| imagegen | imagegen.failed | generate / generateDreamLiteEntry 失败 | error/seed/prompt |
| engine | state.change | engineStatus.setPhase/setProgress/setError（节流） | kind/phase/progress/stage/error |
| error | error.reported | errorReport.buildErrorReport | scope/summary/cpId |
| system | command.start/done/failed | drcService 命令生命周期 | cmdId/actionId/error |

## 4. 状态快照（状态指南针）

路径：`AIOS_ROOT/logs/state.json`

```json
{
  "ts": 1755000000000,
  "appVersion": "v2.0.0 (144)",
  "currentRoute": "Chat",
  "activeSessionId": "abc",
  "engines": {
    "prompter": {"state": "ready", "nextAction": "run_task", "label": "引擎就绪", "terminal": false, "evidence": {"progress": -1, "stage": "", "error": null}},
    "chat": {"state": "idle", "nextAction": "load_model", "label": "引擎空闲", "terminal": true, "evidence": {}},
    "image": {"state": "idle", "nextAction": "load_model", "label": "引擎空闲", "terminal": true, "evidence": {}}
  },
  "lastError": {"cpId": "CP-APP-001", "summary": "...", "ts": 1755000000000},
  "lastCommand": {"cmdId": "cmd_1", "actionId": "nav.go", "ts": 1755000000000}
}
```

StateCompass 五字段与母仓 `STATE_COMPASS` 同构：state（定位）/ nextAction（导航）/ label（人类可读）/ evidence（深入）/ terminal（终态）。未知状态降级 `unknown`，观测失败静默（BT07）。

## 5. 动作注册表

白名单注册（新增在此登记，id 语义永久稳定——BT05 向前兼容，不改名不删除）。

| actionId | 参数（zod） | 说明 |
|---|---|---|
| system.ping | - | 连通性探测 |
| system.state | - | 返回状态快照 |
| system.events | last(1-500) | 读事件流尾部（默认 20 行，JSON 解析） |
| nav.go | route（ROUTES 枚举）/ params | 页面跳转 |
| chat.send | text(1-20000) | 发消息（走 ChatScreen 调度链路：意图路由/管家直答；需 ChatScreen 在岗） |
| chat.switchPal | palId | 切换会话 Pal |
| chat.newSession | title(≤100) | 新建会话 |
| imagegen.generate | prompt/steps(1-64)/cfg(0-20)/width/height(64-2048)/seed/negativePrompt/loraPath/loraMultiplier(0-2)/modelLabel | SD 生图（需 SD 模型已加载） |
| imagegen.generateDreamLite | prompt/width/height(64-2048)/steps(1-64) | DreamLite 文生图（4 步 DMD2；未加载时自动加载） |
| imagegen.upscale | uri/scale(2\|4)/style(general\|anime\|anime_fast) | RealESRGAN 通用放大（P6-6，CPU 耗时较长；自动释放 DreamLite/SD）；style：通用写实/动漫高清（RRDBNet-6）/动漫快速（animevideov3，快约 4 倍）——2026-08-21 双模型可选登记 |
| imagegen.loadModel | modelPath/clipL/clipG/llm/vae/backend | 加载 SD 模型 |
| imagegen.loadDreamLite | - | 加载 DreamLite 引擎（unet/vae/TE） |
| imagegen.unloadModel | - | 卸载 SD 模型 |
| imagegen.recoverHistory | - | 相册记录一次性恢复（B27 开发工具：扫描磁盘图文件重建 legacy 条目，非产品兜底）——2026-08-21 登记 |
| models.scan | - | 扫描本地模型 |
| models.load | modelId | 加载模型并设为活动（displayModels 内） |
| models.unload | - | 释放当前活动模型上下文 |

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
- **RN 0.82 debug 构建的 assets bundle 是 dev=false 编译**：`__DEV__` 恒 false、DevToolsScreen 不显示。任何「按 __DEV__ 区分构建类型」的 JS 逻辑均失效，必须用原生 BuildConfig 信号
- **E2E（WebdriverIO/Appium）在 HyperOS 设备上被安装拦截**：UiAutomator2 server APK 安装触发 `INSTALL_FAILED_USER_RESTRICTED`（HyperOS USB 安装确认），session 创建失败。**对策**：e2e/specs/drc.spec.ts 的核心断言（命令→results→events.jsonl）已由真机人工验证覆盖；HyperOS 上如需跑 E2E 需先人工确认 UiAutomator2 server 安装

## 7. 开发机工具

| 工具 | 用途 |
|---|---|
| `node scripts/drc/drc-push.js <actionId> [jsonParams] [--device <id>] [--timeout <ms>] [--params-file <path>]` | 发送命令并等待结果（--timeout 默认 30000；--params-file 从 JSON 文件读参数，Windows PowerShell 引号易错时首选） |
| `node scripts/drc/drc-tail.js [--last N] [--follow]` | 读事件流 |
| `node scripts/drc/drc-state.js` | 读状态快照 |

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

| 文件 | 职责 |
|---|---|
| src/debug/drcTypes.ts | 共享类型（命令/事件/快照/结果） |
| src/debug/eventStream.ts | 事件流落盘（emit + 节流） |
| src/debug/actionRegistry.ts | 动作白名单 + zod 校验 + 执行 |
| src/debug/drcService.ts | 命令轮询执行器 |
| src/debug/stateSnapshot.ts | 状态快照（StateCompass 映射） |
| src/debug/stateCompass.ts | 域级 STATE_MAP（engine/chat/imagegen/model + unknown 降级） |
| src/debug/errorRegistry.ts | 错误模式注册表（CP-APP-NNN） |
| src/debug/DrcBridge.tsx | 挂载点（导航槽 + 订阅接线） |
| scripts/drc/*.js | 开发机侧 adb 工具 |

## 9. 跨窗口智能体调用（Skill 入口）

其他窗口的智能体要用 DRC 做真机测试，直接读母仓 Skill：`.cursor/skills/drc-remote-debug/SKILL.md`（已挂测试专工啄木鸟链路 v1.1.2）。

标准调用提示词（交给其他窗口智能体照抄，v3）：

> 小黄鸡真机测试走 DRC 远程调试：先读母仓 `.cursor/skills/drc-remote-debug/SKILL.md` 与
> pp 仓 `docs/DebugRemoteControl/DRC_SPEC.md`，按其中「标准测试序列」执行（system.ping
> 探连通 → 发 actionId → 读事件流/state.json 取证）。禁止卸载 App；release 包门控恒关。

细节全部收敛在文档（前置/参数/陷阱/CP 处置），提示词不重复。

约束：DRC 驱动的是与用户点按钮同一链路的 store action（非绕 UI 跑 API），操作过程屏幕有真实可见变化，叠加 scrcpy 投屏监督。新增动作先登记 §5 再改代码（BT05）。
