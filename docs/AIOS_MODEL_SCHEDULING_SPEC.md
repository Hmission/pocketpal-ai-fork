# AIOS 模型智能调度产品规格（口袋八哥）

> 版本: v1.0 · 2026-08-12
> 定位: 常驻管家模型 + 任务驱动引擎加载 + 聊天内闭环生图 + 统一状态显示
> 原则: 锋利不臃肿 · 无兜底无补丁 · 分层收敛

## 1. 产品命题

**口袋八哥 = 一个有手有脑的管家。启动即就绪，任务即加载，聊天内闭环，状态永远可见。**

## 2. 现状缺陷（6D 排查结论）

| 维度 | 缺陷 | 根因 |
|---|---|---|
| D1 启动 | 冷启动无 Pal 概念时不加载任何模型，空态干等用户手选 | 无"常驻管家自动加载"概念 |
| D1 发送 | 无引擎时只插系统消息"模型未加载"，无引导无自动加载 | 发送链路无调度叙事 |
| D3 路由 | M6 正则命中"画图"且未加载 → 跳转生图页，打断聊天流 | 硬编码正则 + 无聊天内加载能力 |
| D2 依赖 | EngineMutex 仅 chat/image 两槽；promptWriter 游离于互斥体系外 | 无统一引擎注册表 |
| D4 状态 | imageGenStore 进度通道只有生图 Tab 消费；SessionStatusBar 只反映 chat 引擎 | 无统一状态源 |
| D5 异常 | 聊天内 generate 失败 → null → 静默吞掉 | 无失败卡片 |
| D6 性能 | fp16 6.9GB 加载 13min（已由量化模型解决） | 依赖量化 |

**根因一句话**：引擎生命周期（加载/卸载/进度/失败）散落在各页面，产品层没有统一的"调度叙事"。

## 3. 目标架构（四组件）

### 3.1 EngineRegistry（引擎注册表）

三槽位声明式注册，替代零散 store：

| 槽位 | 引擎 | 内存 | 生命周期 | 说明 |
|---|---|---|---|---|
| `prompter` | MiniCPM5-1B-heretic (llama.rn) | ~1GB | **启动常驻** | 意图路由/提示词撰写/轻闲聊 |
| `chat` | 大聊天模型 (llama.rn) | ~3GB | 按需 | 写作/深度问答/代码 |
| `image` | sd.cpp (SD3.5/Z-Image) | ~3-4GB | 按需 | 文生图 |

**互斥规则**：`prompter` 永驻（1GB 可共存）；`chat` ↔ `image` 互斥（EngineMutex 扩槽）。

### 3.2 TaskRouter（任务路由）

规则快筛（中英关键词）→ 输出任务信号 → 任务→引擎映射：

```
chitchat（闲聊）   → prompter 直接答
image（生图）      → image 引擎（触发加载）
write（写作）      → chat 大模型（触发加载）
code（代码）       → chat 大模型（触发加载）
```

路由只做"判断"，不做"执行"——调度执行由 EngineRegistry 受控完成（模型不直接驱动 native）。

### 3.3 聊天内闭环（改造 wrappedSendPress）

任务卡片三态贯穿聊天流：
1. **loading**：`🎨 正在加载生图引擎 ▓▓▓░░ 45%`（复用 imageGenStore.progress 通道）
2. **running**：`生成中 step 3/8`
3. **result**：图片/文字插入聊天流
4. **error**：红色卡片「失败原因」+ 重试 + 跳转排查

**删除**："未加载→跳转生图页"逻辑（反补丁）。

### 3.4 统一状态源 EngineStatus

mobx 单例：`{engine: 'prompter'|'chat'|'image', phase: 'idle'|'loading'|'ready'|'running'|'error', progress, stage}`

SessionStatusBar 扩展为全景一行显示（常驻引擎 + 阶段 + 进度），聊天流任务卡片为详细展示。

## 4. 关键交互

### 4.1 启动即就绪
冷启动 → 自动 `ensurePrompter()`（~2-5s，状态栏"管家加载中…"）→ 就绪 → 空态显示"口袋八哥就绪，试试：画一只红龙 / 写一首诗…"。用户零操作进入可用状态。

### 4.2 聊天闭环
输入「画一只红龙」→ 路由命中 image → 聊天流插入加载卡片 → 加载完自动生成 → 图片插入聊天流 → 卡片收尾。全程不离开聊天页。

### 4.3 失败路径
加载失败 → 红色卡片 + 重试按钮 + 「去生图页排查」。不再静默。

### 4.4 生图 Tab
保留升级为专业工作台（高级参数/历史画廊），与聊天页共享 EngineStatus 同一状态源——一处加载，处处可见。

## 5. 分期实施

| 期 | 内容 | 验收标准 | 状态 |
|---|---|---|---|
| P1 验证 | llama.rn 双实例共存 | 源码确认多 context 支持 | ✅ 通过（contextId 索引 + setContextLimit） |
| P2 调度骨架 | EngineRegistry 三槽 + prompter 启动常驻 + EngineStatus + SessionStatusBar 全景 | 启动即“管家就绪” | ✅ engineStatus + promptWriter + App 启动加载 |
| P3 聊天闭环 | TaskRouter + 任务卡片 + 生图聊天内闭环 + 失败卡片 | 聊天页“画→加载→出图→插入”零跳转 | ✅ taskRouter + chatImageTask + ActiveTaskBanner + ChatScreen |
| P4 扩展 | 写作/代码任务接入 + 生图页专业工作台升级 | 多任务类型可路由 | ✅ modelCapabilityRegistry 自动选模型加载；prompter 提示词增强 + chitchat 管家兜底 |

## 6. 不做清单（防臃肿）

- 不做 LMK 兜底监控（系统自治）
- 不做加载超时取消（前台任务无需）
- 不做模型热缓存（内存账本不成立时再议）
- 不做语音/动画花活

## 7. 依赖

1. 🔴 P1 双实例验证（llama.rn bridge 多 context）——硬门槛
2. 🟡 量化模型就绪（并行窗口已 push）
3. 🟡 MiniCPM5-1B GGUF 下载完成

## 8. 文件清单

| 文件 | 动作 | 说明 |
|---|---|---|
| `src/store/engineMutex.ts` | 改 | EngineKind 扩槽 prompter |
| `src/store/engineRegistry.ts` | 新增 | 引擎注册表 |
| `src/store/engineStatus.ts` | 新增 | 统一状态源 |
| `src/store/taskRouter.ts` | 新增 | 任务路由 |
| `src/services/promptWriter.ts` | 改 | 接入 EngineRegistry（prompter 槽） |
| `src/components/SessionStatusBar/SessionStatusBar.tsx` | 改 | 全景扩展 |
| `src/screens/ChatScreen/ChatScreen.tsx` | 改 | wrappedSendPress 改造（任务卡片闭环） |
| `src/components/ChatView/TaskCard.tsx` | 新增 | 任务卡片三态 |
| `App.tsx` | 改 | 启动自动加载 prompter |
