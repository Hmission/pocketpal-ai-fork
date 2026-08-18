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
| footer-regenerate | footer 重新生成按钮 |

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

- footer（朗读 ▶ / 复制 / 重新生成 / timing）渲染在**气泡卡片内部**（同底色 assistantBubbleBackground），不再悬浮卡片下方。
- 结构：`气泡卡片(文本 + footer[高 24，底部 padding s8])`；朗读/复制/重新生成 icon 用 textSecondary，timing 数字 brandAccent 不变。
- **水平对齐**：footer 容器 `marginHorizontal: messageInsetsHorizontal`（与正文同一缩进 token，按钮组对齐文本左缘）+ `paddingBottom: 6`。
- **复制按钮门控**：内容非空且已完成（`isFinalMessage`，utils/chat.ts 单一事实源，PlayButton 同源）；不再依赖 metadata.copyable（旧消息缺字段不再丢按钮）。
- **重新生成按钮**（footer-regenerate）：复用长按菜单同一 handleTryAgain 完整能力链（回溯上一条用户消息→删除其后全部→重发）；agent 运行中或无激活模型时禁用（与长按菜单 disabled 规则一致）。
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

### 11.3 二轮交互契约（v2.4，2026-08-18 真机反馈收口）

- **思考开关选中态**：primary 底 + onPrimary 前景（替代旧 onSurface 黑底），与全局选中态规范（发送钮/胶囊）同一设计语言。
- **图片编辑快捷钮**：按钮即 Menu anchor（修复空 `<View/>` 锚点致真机菜单不弹）；点按弹「拍照/相册」→ 选图下沉输入框 + 「图片编辑」前缀 chip → 发送走编辑任务卡（scheduler P5 链路）。
- **n_ctx 每模型独立**：ModelStore.perModelNCtx（持久化）覆盖全局默认；加载链 getEffectiveContextInitParams(filePath, modelId) 取生效值。入口：①生成设置上下文输入框操作活动模型（标签带模型名，无模型=全局默认）；②聊天状态栏 ctx 胶囊点按直达生成设置（SessionStatusBar onTapContext → ChatView navigate）。

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

### 13.6 多模态输入边界（产物图不进模型，2026-08-16 崩溃修复）

- **规则**：`convertToChatMessages`（src/utils/chat.ts）仅对**用户主动视觉问答**消息（`metadata.multimodal===true`，由 handleSendPress 标记）转 `image_url` 进多模态输入；
  **生图/编辑产物图**（metadata.imageTask/editTask）与**编辑指令源图**只作聊天展示，不进模型输入。
- **根因**：聊天内生图/编辑结果回写带图消息进 history；出图后再发普通消息时，history 全部转 llama.rn 消息，
  产物图被转 image_url 触发视觉编码路径 → clip 空指针崩溃（真机 SIGSEGV 实证）。
- **收益**：产物图进模型输入既浪费 token 又必然走视觉编码路径；过滤后产物仅展示，视觉问答功能不受影响。
- **判定标准**：是否进多模态输入 = `metadata.multimodal === true`（用户主动上传），与消息是否带图无关。

## 14. 语音输入（v3.0 定稿，2026-08-17）

### 14.1 发送按钮状态机（单状态机链路）

发送按钮区域按优先级渲染，任一时刻只有一种形态：

停止按钮 → 编辑模式视频按钮 → **录音中红色停止钮** → **麦克风（空输入且有识别服务）** → 发送按钮

- 麦克风仅在 `value` 为空 + 设备有语音识别服务（`Voice.isAvailable()`）时显示；**一打字立即切换为发送钮**
- 录音中 TextInput 禁用（`editable=false`），红色停止钮可打断；
  识别结果（`onSpeechResults` / `onSpeechPartialResults`）实时填入输入框 → 立即切换发送钮
- **降级规则**：无语音识别服务的设备自动隐藏麦克风、回退纯发送按钮（真机 66b1777f 实证：SpeechRecognizer 无服务）
- 语音按钮在视频模式 / 相机激活 / 生成中 / 停止可见时均不出现（不抢占既有形态）

### 14.2 高度基线（2026-08 大王裁定）

输入第二行所有主控件统一 **36px**：思考胶囊（`thinkingToggleLeft`） / 发送按钮 / 语音按钮，
同一基线（真机 bounds 验证：`[y2249][y2343]` = 94px = 36dp，三钮一致）。

### 14.3 权限与隐私

- Android：`RECORD_AUDIO`（系统语音识别自动请求）；iOS：`NSMicrophoneUsageDescription`
- 音频仅走系统 SpeechRecognizer，**不上传外部服务器**（离线隐私口径与全 App 一致）

### 14.4 testID 登记

| testID | 位置 |
|---|---|
| voice-input-button | 空输入时麦克风按钮 |
| voice-stop-button | 录音中红色停止按钮 |
| quick-prefix-clear（§13 既有） | 前缀 chip × 清除 |

## 15. 生成设置参数标签本地化规范（v3.1，2026-08-18）

### 15.1 问题与根因

聊天页/伙伴设置生成设置 sheet（CompletionSettings）的参数**描述**走 l10n（`completionParams` 段），但**标签**硬编码为 `name.toUpperCase().replace('_',' ')`（如 TEMPERATURE / INCLUDE THINKING IN CONTEXT / N PREDICT），中文 UI 下呈现大量大写英文。

### 15.2 规范

- 标签文案源：`completionParamsLabels`（18 个参数标签）+ `completionParamControls`（off / unlimited / custom / palPrefix）
- 组件经 `paramLabel()` helper 取值，带大写英文 fallback（无该段的语言自动回退 en，不显示 undefined）
- **ML 专有名词全语言保留英文**：Top K / Top P / Min P / Typical P / XTC / Mirostat / Jinja；描述性词必须翻译（temperature→温度、seed→随机种子、n_predict→预测长度）
- 控制词禁硬编码：Off / Unlimited / Custom / Pal(名字) 一律走 completionParamControls
- 共用组件约束：CompletionSettings 同时被 ChatGenerationSettingsSheet 与 PalGenerationSettingsSheet 消费，改标签需双场景验证

### 15.3 覆盖

16 语言全覆盖（zh/zh_Hant/en/ja/ko/fa/he/id/ms/pl/pt/pt_BR/ru/uk/de/fr），每语言 18 标签 + 4 控制词；zh_Hant 另补齐 modelDirs 10 key 后缺失清零。

## 16. 顶栏胶囊管家感知 + 选择器卡片化（v3.2，2026-08-18 大王裁定）

### 16.1 胶囊显示链（单点决策）

| 优先级 | 状态 | 文案 |
|---|---|---|
| 1 | 聊天槽模型已加载 | 中文简称（modelDisplayNames 单一事实源） |
| 2 | 仅管家驻场（默认态） | 「管家 MiniCPM 1B」 |
| 3 | 均未加载 | 「选模型」 |

引擎就绪信息融入胶囊——SessionStatusBar 引擎项随整行删除（§17）。

### 16.2 选择器卡片化（与生图页 ModelPickerPanel 同范式）

- 卡片 = 中文简称（参数_量化）+ 徽章［已加载 / 管家驻场 / 本机不可用］+ 一行入选说明 + 行内「加载/卸载」+ 加载进度行；
- 说明单一事实源 `getModelNote()`（modelDisplayNames 注册表），文案取自 MODEL_MATRIX §1 入选理由：
  - 通义千问 2B（Q8_0）：写作/聊天主力，Q8 近无损；配对视觉伴侣可看图
  - 通义千问 4B：日用均衡档，质量上限更高
  - Liquid 2.6B：任务/工具调用优化，低延迟
  - Liquid 8B（MoE 激活~1.5B）：复杂任务质量上限
  - 小雾 3B：代码专长
  - 面壁 MiniCPM 4B：轻量聊天备选
  - 管家 MiniCPM 1B：常驻管家（意图/扩写/记忆收尾），自动加载、不占聊天槽
- **管家卡卸载禁用**（核心链路，卸了意图/扩写全断）；
- **单槽脚注**（大王裁定标注）：「聊天模型单槽：加载新模型会自动卸载当前模型；管家常驻不占槽。」

## 17. 状态栏拆解融合进助手卡片（v3.2，2026-08-18 大王裁定）

- **SessionStatusBar 整行删除**；引擎项删除（已融胶囊，§16.1）；
- **意图胶囊上移**：闲聊/问答/任务/倾诉 四色小胶囊 → 助手卡作者标签行（模型徽章后），同高；硬编码 hex 收口 DS token；
- **每输出指标行**：助手卡底部（footer 下一行）：`上下文余量 x% · 落盘 HH:mm · 召回 n · 情绪`；
  - ctx 改中文「上下文余量」，点按直达生成设置（入口不丢）；
  - 召回点按展开片段预览（既有能力平移，默认折叠）；
  - **快照语义**：run_finished 时写入 `metadata.turnMetrics`（ctxPct/writeTime/recallCount/recallPreview/sentimentLabel/intent），每卡各记各的；老消息无快照=不渲染该行（锋利不兜底）；
- **思考胶囊高度收敛**：选中胶囊 36→24px（与两边图标按钮视觉同高），行基线仍 36（hitSlop 补触区）。

## 变更日志

| 日期 | 版本 | 变更 |
|------|------|------|
| 2026-08-15 | 2.0 | 气泡一体化（footer 收进卡片，ADR-0003）+ 灰色分层落地（§11）；legacy fonts/radius 双轨收口同波执行 |
| 2026-08-16 | 2.1 | 生图任务卡片生成动效 + 图片撑满（§12，MASTER_LOG §20） |
| 2026-08-16 | 2.2 | §13 聊天内闭环：快捷入口下沉 controlBar 图标钮 + 前缀 chip 标签化（原子删除）+ 图片编辑闭环（三入口下沉输入框）+ §13.6 多模态输入边界（产物图不进模型） |
| 2026-08-18 | 2.3 | footer 按钮组升级（开发者预览版）：复制门控改内容完成度（isFinalMessage）+ 重新生成按钮（复用 handleTryAgain）+ 按钮组左对齐正文缩进；顶栏模型胶囊加 primary 描边 |
| 2026-08-17 | 3.0 | §14 语音输入：发送按钮升级为语音优先状态机 + 输入行高度统一 36px（思考/发送/语音同一基线） |
| 2026-08-18 | 3.1 | §15 生成设置参数标签本地化：新增 completionParamsLabels/Controls 两段 + paramLabel() fallback helper，16 语言全覆盖（MASTER_LOG §31.4） |
| 2026-08-18 | 3.2 | §16 顶栏胶囊管家感知 + 选择器卡片化（介绍/徽章/加载卸载/管家禁卸/单槽脚注）；§17 状态栏拆解融合进助手卡片（意图胶囊上移 + 每输出指标行 turnMetrics 快照 + ctx 中文直达 + 召回展开）+ 思考胶囊 24px 收敛 |
