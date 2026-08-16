---
doc_id: POCKETPAL_CHAT_UI_SPEC
module: root
type: spec
status: active
version: "2.2"
created: "2026-08-14"
updated: "2026-08-16"
relates: [POCKETPAL_DESIGN_SPEC, POCKETPAL_UI_INTERACTION_SPEC, ADR-0003-bubble-footer-unification]
---

<!-- D-FORMAT:v3 -->

# PocketPal 聊天页 UI 设计规范（CHAT_UI_SPEC）

> 单一事实源：聊天页/抽屉的配色层次、卡片结构、菜单弹出规范与文本可读性定稿。
> 任何聊天页 UI 迭代必须先更新本文档再改代码。版本：v1（2026-08-14，聊天页+抽屉重设计定稿）；v2（2026-08-15，气泡一体化 + 灰色分层落地，ADR-0003 已实施）
> 并列文档：POCKETPAL_IMAGEGEN_UI_SPEC.md（生图页）/ POCKETPAL_UI_INTERACTION_SPEC.md（全局交互）
> 上位规范：POCKETPAL_DESIGN_SPEC.md（UI 域 SSOT）

## 1. 配色体系（三层视觉层次）

聊天页配色走 theme token，不硬编码色值（深浅色双模式）：

| 层次 | 元素 | token（light / dark） | 语义 |
|---|---|---|---|
| 用户 | 用户气泡背景 | `authorBubbleBackground`（#f2f2f2 / #212121） | 输入侧，中性灰 |
| 助手 | 助手气泡背景 | `assistantBubbleBackground`（#E9F0FB / #20344B） | 输出侧，低饱和暖蓝 |
| 助手 | 气泡上文本 | `onAssistantBubble`（#16324F / #D8E5F5） | 正文 |
| 品牌 | 模型徽章/性能数字 | `brandAccent`（#FFB300 / #FFC54D） | 强调信息（小黄鸡暖黄） |
| 品牌 | 徽章文本 | `onBrandAccent`（#3D2E00 / #332700） | 黄底文本 |
| 常规 | timing 标签/复制 icon | `textSecondary` / `onSurfaceVariant` | 辅助信息 |
| 状态 | interrupted 标签 | `error` | 警示 |

- 用户气泡保持中性灰，与助手暖蓝形成「用户灰 ↔ 助手蓝 ↔ 品牌黄点缀」三层结构。
- 禁止在聊天组件中硬编码颜色（如 `#888`），一律取 token。

## 2. 助手消息卡片结构

```
┌────────────────────────────────────────┐
│ 模型徽章：通义千问 4B（brandAccent 小字）│ ← 仅助手消息；中文简称（modelDisplayNames）
├────────────────────────────────────────┤
│ 文本卡片（assistantBubbleBackground）   │
│  ─ 正文（Markdown，onAssistantBubble）  │
│  ─ footer：▶ 复制  [数字]ms/token …    │ ← 固定高度 24，icon 与文本基线对齐
└────────────────────────────────────────┘
```

- **模型徽章**：来源 `message.metadata.modelName`（原始模型名），渲染时经
  `getModelDisplayName({name})` 换算中文简称；未命中回落去量化族名。
  样式：fontSize 11 / fontWeight 600 / color `brandAccent` / marginLeft 12 / marginBottom 4。
- **footer 统一高度**：容器 `height: 24, flexDirection: row, alignItems: center, gap: 6`；
  复制 icon 16x16、timing 文本 10px，baseline 对齐。
- **timing 数字与标签区分**：数字段用 `brandAccent`（如 `10 ms/token` 中的 `10`、
  `100.00 tokens/s` 中的 `100.00`），标签用 `textSecondary`。

## 3. 抽屉入口区

```
┌ 搜索对话（session-search-input）
├ [+ 新对话]        [📷 画图]      ← 双按钮行：new-chat-button + drawer-imagegen-button
└ 会话列表（日期分组，行尾常驻 ... 按钮）
```

- 生图按钮：**无圆形底框**（删 borderRadius/backgroundColor），图标 20x20 与「+ 新对话」
  PlusIcon(22) 水平对齐；右侧加文本标签「画图」（l10n：imageGenEntry）。
- 新对话行 `alignItems: center`，两按钮水平高度一致。

## 4. 菜单弹出规范（消除闪现/多次点击失效）

根因：受控 `visible` + `anchor={pageX,pageY}` 定位延迟 + 快速点击竞态。

- **点击 … / 三点**：先 `closeMenu()`，再 `requestAnimationFrame(() => openMenu(...))`
  等待上一个 Menu Modal 关闭动画完成，杜绝受控竞态。
- **锚点**：用按钮 `onLayout` 坐标（`{x, y, width, height}`）计算锚点，替代
  `event.nativeEvent.pageX/pageY`（消除定位延迟闪现）。
- **长按**：仍用长按手势坐标弹出（同一次点击语义，不与 … 按钮冲突）。
- 适用范围：SessionListItem（抽屉会话行）、HeaderRight（聊天页右上三点）、
  ChatView 长按消息菜单（同一 Menu 组件族）。

## 5. 顶栏模型名

- ChatHeader 模型名显示 `getModelDisplayName(activeModel)` 中文简称；
  原名（>10 字符）不再截断显示，避免长名挤占顶栏。

## 6. testID 登记（新增）

| testID | 位置 |
|---|---|
| assistant-model-badge | 助手气泡模型徽章 |
| drawer-imagegen-button（既有） | 抽屉生图入口（画图） |
| footer-timing（既有） | footer 性能行 |

## 7. 约束

- 模型简称一律经 `modelDisplayNames` 注册表（弹窗/子菜单/徽章/顶栏共用单一事实源）。
- 新色值必须登记本文档 §1 并走 theme token；深浅色双模式必须同时验证。

## 8. 模型选择器（2026-08-14 收敛）

- 聊天模型选择唯一入口：顶栏 `chat-model-picker-chip` → ChatPalModelPickerSheet（**单列表，无 PAL/模型 tab**）。
- 条目显示：`getModelDisplayNameWithParams` = 中文简称 + 参数标签，如「面壁 MiniCPM（4B_Q4）」；不显示原始文件名。
- 三点菜单（HeaderRight）已去「模型」子菜单：生成设置 → 复制/重命名/删除 → 导出/导入。
- 伙伴切换收敛至设置页 PalsHub，聊天页不再承担 pal 切换职责。
- 过滤规则：只显示可聊天的 LLM（`modelType === LLM` 且文件名不在 `IMAGE_GEN_MODEL_FILES`）；
  生图模型入口固定在生图页模型下拉（manifest 驱动）。
- 扫描注册层同步隔离：`scanLocalModels` 不把生图文件注册为 LLM（新装机干净），
  `isChatSelectable` 兜底存量数据（DB/预设已注册残留）。
- 若新增生图模型，必须把其 main + companions 文件名加入 `BUILTIN_MANIFESTS`（自动进入过滤集），
  设备端 `*.manifest.json` 扩展模型的过滤待动态化（当前无设备端扩展）。

## 9. 语音朗读按钮（2026-08-14 归位）

- 输入栏不再显示语音按钮（VoiceChip 已移除）；自动朗读开关唯一入口：TTS 设置面板（AutoSpeakRow）。
- 朗读按钮渲染于 AI 回复卡片下方（AssistantTurnFooter 内 PlayButton），
  显示条件 `ttsStore.isTTSAvailable && isSpeakableMessage(message)`（单一事实源 `utils/speakable.ts`）；
  生图任务卡片（metadata.imageTask）与词数不足的消息不显示。
- 中文按字符数判定（≥4），空格语言按词数（>1）。

## 10. testID 登记（新增）

| testID | 位置 |
|---|---|
| chat-model-picker-chip | 顶栏模型选择入口 chip |
| playbutton-<messageId> | AI 卡片下方朗读按钮 |
| image-preview-save-button | 图片放大预览「保存到手机」按钮 |

## 11. 气泡一体化与灰色分层（v2 定稿，2026-08-15）

> 依据：DESIGN_SPEC §4c.1（气泡一体化结构图）+ §1.8（一灰一职清单）+ ADR-0003。
> 代码载体：Message.tsx（footer 收进最后一个内容块气泡内）/ Bubble/styles.ts / ChatHeader / SessionStatusBar / ChatInput / GreetingBubble。

### 11.1 气泡一体化（footer 收进卡片）

- footer（朗读 ▶ / 复制 / timing）渲染在**气泡卡片内部**（同底色 assistantBubbleBackground），不再悬浮卡片下方。
- 结构：`气泡卡片(文本 + footer[高 24，底部 padding s8])`；朗读/复制 icon 用 textSecondary，timing 数字 brandAccent 不变。
- 多 step turn：footer 只出现在最后一个内容块的卡片内（turn 级唯一）。
- 图片/文件/用户消息不渲染 footer。

### 11.2 灰色分层（一灰一职）

| 组件 | v1 灰色用法 | v2 定稿 |
|---|---|---|
| 顶栏模型 chip | surfaceVariant | 域彩 12% 底 + primary 文字（withOpacity(primary, 0.12)） |
| SessionStatusBar | surfaceVariant | surface + hairline 分隔（降背景） |
| ChatInput 编辑栏 | surfaceVariant | surface + outline 描边 |
| GreetingBubble | surfaceVariant | surface + accent 左缘 |
| softCapBanner | surfaceVariant | **保留**（信息带唯一保留位） |
| 用户气泡 | authorBubbleBackground | 保持（与 surfaceVariant 用途区隔） |

## 12. 生图任务卡片：生成动效 + 图片撑满（v2.1 定稿，2026-08-16）

> 依据：MASTER_LOG §20。代码载体：ImageTaskProgress / ChatScreen renderTextMessage / ActiveTaskBanner / TextMessage。

### 12.1 生成中动效（任务卡片内嵌）

- 聊天内生图（metadata.imageTask）占位卡（未回写 imageUris/失败标记）在气泡内嵌生成动效：
  三点波浪（复用 ImageGenScreen `useWaveDots`）+ 「正在生成新图…」+ 进度条 +
  「采样 X%（Ys/步） · Zs」+ 阶段行（▸ stage）。
- 数据源唯一：imageGenStore 单状态机（loading/generating/progress/progressText/stepTime/stage/genStartedAt），
  与生图页预览区同源；组件自守卫——引擎空闲（均 false）渲染 null，卡片回写瞬间不闪烁。
- 顶部横幅让位：聊天内联生图进行中（imageGenStore.chatInlineGenerating）ActiveTaskBanner 隐藏，
  卡片动效独占提示；其它引擎任务（加载大模型/生图页出图）横幅照常。

### 12.2 图片展示（单图撑满 / 多图网格）

- 单图（imageUris.length === 1）：宽度撑满卡片内容区（width 100% + aspectRatio 1 方框），
  resizeMode contain 不裁切；点击仍走全屏预览 + 保存到手机。
- 多图（≥2）：保持 80×80 缩略图网格（cover），flexWrap 布局不变。
- 新增 testID：`image-thumbnail-<index>` / `image-content-<index>`。

## 13. 输入框快捷操作行 + 图片编辑闭环（v2.2 定稿，2026-08-16）

> 依据：AIOS_MODEL_SCHEDULING_SPEC §11（P5 聊天内编辑闭环）。
> 代码载体：ChatInput / ChatView / ChatScreen / ImageTaskActions / ImageTaskProgress / chatImageTask。
> 豆包式交互：图片下沉输入框 + 自然语言指令 → 聊天内出编辑结果，零跳转。

### 13.1 快捷生图/编辑入口（下沉 controlBar 图标钮）

- 入口位置：输入卡**控制行**（思考胶囊与发送/语音同一行，leftControls 区），两个 36px 图标钮：
  `[🎨 图像生成]`（image-quick-gen，MaterialCommunityIcons **palette 调色盘**）`[🖼 图片编辑]`（image-quick-edit，image-edit-outline）。
  图标色=主题 `primary`（可用态彩色，禁用观感来源于灰色 token，已弃用）；生成/加载中（busy）才降 0.4 透明度示禁用。
  （2026-08-16 终稿：原独立快捷行改为下沉控制行图标钮——省空间不臃肿，与思考/发送同基准。）
- 图像生成：点击 → 输入区顶部显示**前缀标签 chip**「图像生成：」（primary 彩底白字 + ×，图标语义）：
  不可逐字编辑（× 整体删除——破坏一个字符即失效）；标签不进输入文本 value，发送时拼接为完整消息；
  routeTask 识别前缀并剥离（payload 纯主体），模型只收主体，无主体不发送。
- 图片编辑：弹底部菜单（相册 / 拍照，复用 launchImageLibrary / 相机）→ 选图**下沉输入框**（缩略图 + × 取消）+ **前缀 chip「图片编辑：」**；
  scheduler 编辑分支剥离前缀（指令纯净），用户消息保留原文展示。
- 生成/加载进行中（imageGenStore busy）两按钮禁用防连点。
- 思考胶囊（thinking-toggle）无描边框：状态靠背景填充色表达（激活 onSurfaceColor 背景 / 未激活透明+灰字），与快捷图标钮统一无描边（2026-08-16 去描边）。

### 13.2 编辑模式（输入框下沉态）

- ChatView 持有 `editSourceUri`（编辑源图）单一状态，与视觉问答 `imageUris` 完全隔离。
- 编辑源图存在时输入框 placeholder 变更为「想修改哪里？例如：把背景改成海边」，缩略图可 × 取消。
- 文本为空点发送 → 轻提示补指令；文本非空 → 走 `runEditImageTaskCard` 编辑闭环。

### 13.3 全屏查看器编辑按钮

- 图片全屏预览（ImageView）底部操作区增加 `[编辑此图片]`（image-viewer-edit-button）：
  当前图下沉输入框 + 关闭查看器（保存按钮保留，`image-preview-save-button` 既有）。

### 13.4 编辑任务卡片（editTask）

- 编辑任务卡与生图任务卡同构（metadata.editTask + editSourceUri + editInstruction）：
  分步文案「已识别为编辑任务 → 编码源图 → 编辑中」→ 回写结果图。
- 动作条：成功卡 `[继续编辑此图] [再来一张]`（递归闭环，豆包同款）；失败卡 `[重试]`。
- 管家增强提示词展示：文生图成功卡下方小字「✨ 管家优化为：…」（metadata.imageEnhancedPrompt，可点击展开全文）；
  编辑卡展示中文指令原文（编辑 instruction 为 diptych 语义文本条件，不经过英文扩写）。

### 13.5 testID 登记（新增）

| testID | 位置 |
|---|---|
| image-quick-gen | 输入框快捷行「图像生成」按钮 |
| image-quick-edit | 输入框快捷行「图片编辑」按钮 |
| image-viewer-edit-button | 全屏预览「编辑此图片」按钮 |
| image-task-edit（既有） | 生图任务卡「编辑图片」→ 改道下沉输入框 |

## 变更日志

| 日期 | 版本 | 变更 |
|------|------|------|
| 2026-08-14 | 1.0 | 聊天页+抽屉重设计定稿 |
| 2026-08-15 | 2.0 | 气泡一体化（footer 收进卡片，ADR-0003）+ 灰色分层落地（§11）；legacy fonts/radius 双轨收口同波执行 |
| 2026-08-16 | 2.1 | 生图任务卡片生成动效 + 图片撑满（§12，MASTER_LOG §20） |
| 2026-08-16 | 2.2 | 输入框快捷操作行 + 图片编辑闭环（§13，AIOS SPEC §11 P5）；任务卡「编辑图片」改道下沉输入框 |
