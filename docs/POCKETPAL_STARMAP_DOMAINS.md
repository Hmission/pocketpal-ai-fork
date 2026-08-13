# PocketPal 星图域清单（Starmap Domain Registry）

> 本仓（F:\pp，PocketPal 二开）游离于母仓 Wenpu KG 索引之外（KG 只索引母仓代码）。
> 本清单以声明式登记本仓核心域的模块与依赖边，供星图查询（starmap_query）与后续
> KG 索引器扩展消费。风格对齐 imageGenManifest.ts 的声明式哲学：单点事实、无运行时逻辑。

## 域：imagegen（生图域）

### 模块清单

| 文件 | 职责 |
|---|---|
| `src/screens/ImageGenScreen/ImageGenScreen.tsx` | 编排层：预览区分页单状态机 + 业务动作 + 四区组装 |
| `src/screens/ImageGenScreen/components/ModelPickerPanel.tsx` | 顶部模型胶囊 + 悬浮下拉 + 行内加载/卸载 |
| `src/screens/ImageGenScreen/components/ResultPreview.tsx` | 结果区 + 进度 overlay + 操作条 + 全屏 |
| `src/screens/ImageGenScreen/components/HistoryStrip.tsx` | 历史横条 + 多选管理 |
| `src/screens/ImageGenScreen/components/ComposerPanel.tsx` | 创作区 + 提示词限长 + 高级参数 |
| `src/screens/ImageGenScreen/hooks/useToast.ts` / `usePulse.ts` | toast / 呼吸脉冲动效 |
| `src/screens/ImageGenScreen/constants.ts` / `styles.ts` | 域内常量 / 样式 |
| `src/store/imageGenStore.ts` | 生图单通道状态机（SD/Z-Image + DreamLite 收编） |
| `src/store/engineMutex.ts` | 引擎互斥协调器（chat↔image，回调注入无循环依赖） |
| `src/store/engineStatus.ts` | 引擎阶段状态总线（ActiveTaskBanner 消费） |
| `src/services/dreamLiteEngine.ts` | DreamLite 纯 engine 层（仅被 imageGenStore 引用） |
| `src/services/chatImageTask.ts` | 聊天内联生图 runner（image 任务执行器） |
| `src/utils/imageGenManifest.ts` | 模型 manifest 声明式注册（设备端扩展点） |

### 依赖边（单向）

```
ImageGenScreen → imageGenStore → dreamLiteEngine / NativeModules.ImageGen
                              → engineMutex / engineStatus
ImageGenScreen → imageGenManifest（扫描/伴侣配对）
ChatScreen → useChatScheduler → chatImageTask → imageGenStore（聊天→生图桥，有意单向）
modelStore → engineMutex（chat 侧互斥）
```

### 约束

- 生图域禁止反向引用聊天域（chatSessionStore/useChatSession）。
- Screen 层禁止直连 dreamLiteEngine（必须经 imageGenStore 单通道）。
- 引擎互斥一律经 engineMutex，调用方不得自管释放时序。

## 域：chat（聊天域）

### 模块清单

| 文件 | 职责 |
|---|---|
| `src/screens/ChatScreen/ChatScreen.tsx` | 聊天页编排（VideoPal 分支 + 调度挂载） |
| `src/hooks/useChatScheduler.ts` | 任务驱动调度（image/write/code/chitchat 分支链） |
| `src/hooks/useChatSession.ts` | 会话发送/停止/流式处理 |
| `src/store/ChatSessionStore.ts` | 会话 CRUD + 选择模式 + 消息流 |
| `src/store/taskRouter.ts` | 任务规则快筛（只判不执） |
| `src/store/modelCapabilityRegistry.ts` | 任务→模型能力注册表 |
| `src/services/promptWriter.ts` | 常驻管家（提示词增强 + chitchat 直接回答） |
| `src/components/SidebarContent/` | 抽屉会话中心（搜索/会话列表/选择模式/设置入口） |
| `src/components/ChatView.tsx` / `ChatHeader.tsx` / `ChatInput.tsx` | 聊天三件套 |
| `src/components/ActiveTaskBanner/` | 任务进度横幅（数据源唯一：engineStatus） |

### 依赖边（单向）

```
ChatScreen → useChatScheduler → taskRouter / chatImageTask / promptWriter / modelStore
ChatScreen → useChatSession → chatSessionStore / modelStore
SidebarContent → chatSessionStore（会话中心只承载会话能力）
```

### 约束

- 抽屉只承载会话能力；功能入口一律进设置页入口中心；生图入口固定在聊天页头部（imagegen-button）。
- taskRouter 只判断不执行；调度执行由 useChatScheduler 受控。

## 备注

- 星图命中已落地：母仓 `docs/pocketpal-imagegen-domain.md` / `pocketpal-chat-domain.md` 指针文件使 `starmap_query subgraph imagegen|chat` 可命中本仓域。
- 母仓 KG 索引本仓需扩展 Wenpu 索引器（跨仓专项），本清单即为其输入源。
- 两域共享基建：engineMutex / engineStatus（引擎层闭环，不属于任一 tab 域）。
