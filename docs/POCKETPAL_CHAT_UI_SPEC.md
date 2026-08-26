---
doc_id: POCKETPAL_CHAT_UI_SPEC
module: root
type: spec
status: active
version: "4.8"
created: "2026-08-14"
updated: "2026-08-24"
relates: [POCKETPAL_DESIGN_SPEC, POCKETPAL_UI_INTERACTION_SPEC, ADR-0003-bubble-footer-unification]
---

<!-- D-FORMAT:v3 -->

# PocketPal 聊天页 UI 设计规范（CHAT_UI_SPEC）

> 单一事实源：聊天页/抽屉的配色层次、卡片结构、菜单弹出规范与文本可读性定稿。
> 任何聊天页 UI 迭代必须先更新本文档再改代码。版本：v1（2026-08-14，聊天页+抽屉重设计定稿）；v2（2026-08-15，气泡一体化 + 灰色分层落地，ADR-0003 已实施）
> 版本：v2.1（2026-08-27，UI 一致性升级，五大类）：① **跑分卡 B43 同步**——PendingIndicator 折线 44→56pt（PSS+CPU 双线 + 温度热力带 + 坐标轴 + 5/6GB 阈值标注 + vivid 演出层），遥测行归一共享 `PerfMiniRow`（折叠头 PSS 大字阈值色 + 内存/CPU/温度胶囊分级色）；AssistantTurnFooter 展开层加 axes/tempBand/vivid（72pt）——与生图页 PerfPanel 同一效果族（紧凑尺度）；② **顶部横幅去灰**——BannerBar neutral 灰底（surfaceVariant）→ surface 实底 + outline hairline，新增 `centered` prop；BenchmarkHudBar 灰底 → 跑分金 brandAccent 12% wash + 文案居中；BannerRow html-soft-cap/context-remote-hedged 灰变体 → info 语义 wash + 居中；③ **场景收敛**——ActiveTaskBanner chat/prompter loading 态隐藏（输入框 placeholder 五分支已表达「加载模型/加载管家模型」，双提示冗余），保留 running/error 与 image 引擎任务；④ **死代码清理**——ModelNotLoadedMessage（无引用仅测试自引用）git rm 留痕；⑤ 阈值/格式器单一事实源 `utils/perfTiers`（IMAGEGEN_UI_SPEC §9 注册表抽取共享）
> 版本：v2.2（2026-08-27，管家提示词增强链路修订）：聊天生图小模型扩写根治「鹦鹉学舌」（画苹果出海边美女——§13.4 增强链路第 4 条）：few-shot 示例由 system 内嵌纯文本改 user/assistant 示范轮 + temperature 0.7→0.4 + isParrotingExample 检测闸（复读=显式失败，任务卡标「提示词未增强」）；「管家优化为」展示语义与契约不变
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
- 增强链路契约（v2.2，2026-08-27 鹦鹉学舌根治）：① 未就绪=原文直出不标记；② 增强成功=展示「管家优化为」；
  ③ 增强失败（异常或复读检测闸命中）=回退原文 + enhancedFailed 标记展示「提示词未增强」（显式失败不静默）；
  ④ 复读闸：promptWriter.writePrompt 输出与 few-shot 示例词重合 ≥70% 判定复读抛错（1B 模型短输入复述示例的根治防线，
  根因与修复详见内部 MASTER_LOG §101）。

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

- 卡片 = 中文简称（参数_量化）+ 徽章［已加载 / 管家驻场］+ 一行入选说明 + 行内「加载/卸载」+ 加载进度行（正在加载 · 已耗时 Xs）；
- 加载动效（v4.7）：加载期卡片显示三点波浪跳动 + 2% 底条（复用 useWaveDots，与生图任务卡 ImageTaskProgress 同款设计语言）——用户可感知加载在进行而非卡死；
- 加载期间 sheet 驻留（进度行可见），加载收尾自动关闭；已加载模型纯选择 = 即关。
- 「本机不可用」徽章属生图域范式（isIncompatible 注入）；聊天域无设备不兼容判定，不虚构死分支（锋利）。
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

## 18. 聊天页八项体验升级（v3.4，2026-08-20 大王裁定）

### 18.1 意图胶囊会话级状态机

- **状态机唯一规则（不兜底）**：`intent == null`（首轮）→ `classifyIntent` 定初值并落库；之后永远沿用会话 intent，直到用户显式切换。
- **落库**：Session 实体新增 `intent` 列（WatermelonDB schema v8，`chat_sessions.intent`，同 `settingsSource` 模式）；复制会话继承 intent。
- **唯一写入口**：意图胶囊可点按 → 四态选择器（闲聊/倾诉/问答/任务，IntentPickerHost App 根挂载，未挂载 fail-fast 不改状态）。
- **同源消费**：system 语气注入（contextAssembler）与胶囊/turnMetrics 快照同读会话 intent；`_lastIntent` 模块变量已删（每轮重判是第二轮回闲聊的根因）。

### 18.2 助手卡 chrome 双行合并（TurnMetricsRow 已删）

- AssistantTurnFooter 纵向双行：**行1** = 播放/复制/重新生成（+ interrupted 状态）；**行2** = 统一指标行：`54ms/token · 18.6 t/s · 16.8s TTFT · 上下文余量29% · 落盘01:58 · 召回0 · 平稳`。
- **统一排版契约**：captionS 字号；数值 brandAccent 600；标签 textSecondary；分隔符 `·`（outlineVariant）。
- **交互保留**：ctx 段点按直达生成设置；召回段点按展开片段预览（默认折叠）。
- **单一存在理由**：TurnMetricsRow 组件删除（含 Message 两处渲染点），能力并入 footer——每卡只有一块 chrome。门控：timings/turnMetrics/内容就绪/interrupted/可朗读 任一成立才渲染。

### 18.3 顶栏紧凑化 + 新建会话换加号

- HeaderRight：新建会话图标 EditBox→**PlusIcon**（testID `reset-button` 不变，a11y「新建会话」）；两按钮改 36px 紧凑触区（margin 0，IconButton 40px 默认容器弃用）。
- ChatHeader 右侧行 gap 6→2，三控件（模型胶囊/新建会话/菜单）收紧为一组。
- a11y 中文属「产品叙事硬编码口径」（同 B18 §17 意图标签裁定，2026-08-20 显式登记）。

### 18.4 发送钮双态描边统一

- SendButton 内置 `enabled` 双态：可用 = primary 实心圆 + onPrimary 图标；不可用 = 透明底 + outlineVariant 圆形描边 + onSurfaceVariant 灰图标。尺寸恒 36px（快捷图标钮/语音钮同基准）。
- ChatInput 删除外层 `opacity 0.4` 包裹，状态表达收进组件内部。
- **图标 20px 同行同尺寸（复查 2026-08-20 定稿）**：SendIcon 22→20 与 controlBar 快捷图标钮图标同尺寸，去 marginLeft 右缘对齐——视觉高度与同行按钮一致，不靠衬底撑大。
- **停止钮同一按钮语言（复查 2026-08-20 定稿）**：StopButton 与 SendButton 同规格（36px 触区 + 20px 图标 + 圆形衬底），仅语义色表达时态——发送=primary 黄、停止生成=error 红（onError 图标）；生成中发送↔停止切换尺寸不跳变；间距由 rightControls gap 8 统一。

### 18.5 输入卡 placeholder 单源决策表（engineStatus 状态中枢）

| 优先级 | 条件 | 文案 |
|---|---|---|
| 1 | chat 引擎 loading | 「正在加载模型…」 |
| 2 | prompter loading | 「正在加载管家模型…」 |
| 3 | chat 引擎 ready（modelStore.engine） | 「输入消息…」 |
| 4 | prompter ready（promptWriter.isLoaded） | 「小黄鸡已就绪，输入即可聊天」（l10n `chat.butlerReady`） |
| 5 | 其余 | 「模型未加载」 |

根因修复：旧链只看 `promptWriter.isLoaded`，管家加载中落入「模型未加载」分支。五分支全部收口 l10n（复查 2026-08-20：第 4 分支硬编码中文收口 `chat.butlerReady`，16 语同步，de/it/et 回退 en）。

**时序缺口修复（复查 2026-08-20）**：冷启动首帧偶发「模型未加载」的根因 = `ensureLoaded` 在 `findModelPath()` await 期间 prompter 相位未设置（保持 idle）→ 首帧落分支 5。修复：loading 相位提前到模型路径扫描之前，未找到路径再回落 idle——加载中语义从首帧即正确。

### 18.6 n_ctx 单一事实源 + 每模型预调

- **两入口收口同一存储**：IncreaseContextSheet confirm 改写 `setModelNCtx(model.id)`（不再全局 setNContext，失败恢复同源）；sheet 与生成设置页的「当前值」读 `getModelNCtx(model.id)`。生成设置页已走该链路 → 一边调了另一边自动同步，持久化跨重启。
- **指标与设置分离（复查 2026-08-20 定稿）**：BannerRow 的「上下文余量」与 turnMetrics 快照继续读**实际加载值**（activeContextSettings.n_ctx）——模型实际按该值跑，指标语义正确；sheet/设置页读**设置值**（getModelNCtx）。两者语义不同，刻意分离，不强行同源。
- **每模型预调**：加载链（proceedWithInitialization）在该模型无覆盖时，按设备内存 ceiling 沿 CONTEXT_LADDER 取最大可装档（封顶 GGUF `context_length`）写入 perModelNCtx——一次预调、持久化；只升不降，ceiling 未知不虚构，REMOTE 不适用。
- **PSS 安全阀（v3.6，2026-08-19 K90 真机血证）**：厂商 PSS 看护（HyperOS 实测 pss threshold 6GB 硬杀，与空闲内存无关）才是进程存活的天花板。预调天花板改取 min(内存 ceiling, `PSS_SAFE_BUDGET` 4GB)；启动新增 `auditPerModelNCtxAgainstPss` 审计——已持久化档位估算超预算者降到最大安全档（自愈旧版预调污染：K90 实证 40960/32768 档 f16 KV 生成中 PSS 6.77GB 被硬杀）。「只升不降」保护的是安全范围内的用户主权，不是必杀值；用户手调不受预算限制（决策可见）。
- **默认上下文提升 + 源跟踪（v3.7）**：全局默认 n_ctx 4096→8192（contextInitParams v2.3 迁移：仅抬旧默认，用户自选值不动）——工具 schema 注入后提示词基线 ~4.5K，旧默认必溢（K90 实证「对话空间已满」）。`perModelNCtxSource`（preset/user）持久化：审计只动 preset/无源档，用户手调=主权不碰；审计覆盖面扩到「无覆盖取全局默认」的模型（8B 默认 8192 越限写安全档夹住）。
- **策展表重排 + 设备感知预算（v3.8，2026-08-26 大王裁定「探索上限」）**：策展预算从固定 `PSS_SAFE_BUDGET` 4GB 改为设备感知 `resolvePssSafeBudget`——K90 实测可用内存 8-9GB 挥霍口径（仅考虑本 App），预算 = 启动实测可用内存（上限 9GB，未知设备回退 4GB）；KV 保持 f16 不加量化旋钮（锋利，不预设）。新策展表：Qwen3.5-4B 4096→**16384**（大王实测 16K 可用）、Qwen3.5-2B 24576→**32768**、MiniCPM5-1B 16384→**32768**（封顶 GGUF 原生 32768）、Ministral-3-3B 12288→**24576**、Gemma-3-4B 16384→**32768**、LFM2.5-8B 12288→**24576**、LFM2.5-2.6B 6144→**16384**；尺寸分档回退 ≤1.5GB→24576、≤4GB→32768、更大→16384。`CURATED_TABLE_VERSION=2` 版本化：preset 源档位随表版本一次性拉齐（解除 `normalizePresetNCtxToCuratedDefaults` 只降不升的历史钉死），user 源主权不碰。死代码清除：`recommendNCtx` 内存梯子（16G→8192）零调用删除。门禁：每档 `getModelMemoryRequirement` 验算 ≤ 设备预算 + 启动 PSS 审计兜底（守卫 hook 语义不变，预算值换设备口径）。

### 18.7 模型用途标签 + 切换弹窗多候选

- **用途标签**：ModelSettingsSheet「用途」多选 chips（写作/代码；玩具复用 code 选型不增第三枚），写入 `model.capabilities`（保留非用途键）。chips 文案与弹窗 TASK_LABEL 属「产品叙事硬编码口径」（同 B18 §17 意图标签裁定，2026-08-20 显式登记）。
- **选型语义（复查 2026-08-20 大王复核定稿）**：`listModelsForTask` 返回**任务族候选**——用户标签命中 + 文件名指纹命中（去重），**上限 3**；任务族为空才兜底单个最大模型（**不甩全量**，推荐要精不要清单）。每个候选带一句话推荐说明（`candidateNote`：MODEL_MATRIX 定位优先，无定位按大小给「更大更强，但加载更慢 / 均衡档，更快上手」）——差异可决策。`findModelForTask` = 首项兼容面。
- **弹窗升级**：ModelSwitchDialog 渲染任务族候选（单选，默认选中推荐项，testID `model-switch-candidate-{id}`）+ 一句话说明行 + 继续当前（场景 A）；返回 `{choice, modelId}`。候选行/加载态模型名走 `getModelDisplayNameWithParams` 中文简称（与选择器同源，不显示原始文件名——K90 真机复查 v4.7）。
- **弹窗内加载（复查定稿，移动端重量级操作最佳实践）**：确认后**弹窗不立即关**——Modal 遮罩保持（全屏模态 → 其他交互天然阻塞，受影响按钮不可操作），内容转「正在加载所选模型…」态；加载完成自动关并恢复；失败在弹窗内显示原因（可取消/重试），**不再插聊天错误卡**（错误归属弹窗，单一承载）。闭环：设置页打标签 → 选型读标签 → 弹窗任务族多候选 → 弹窗内加载 → 会话记住。
- **加载态动效（v4.7）**：三点波浪 + 2% 底条（与生图任务卡同款，useWaveDots 复用）替代 ActivityIndicator 转圈——遮罩阻塞期用户可感知加载在进行而非卡死。

### 18.8 快捷行入口裁定（不加）

日记/绘本/读屏不属「前缀 chip → 输入 → 发送」形态且各有唯一入口（日记=WorkspaceScreen 浏览、绘本=MemoryScreen 按钮、读屏=ToolScreen 行），加图标 = 入口重复，违锋利原则。快捷行维持四图标。

### 18.9 生成进度监控卡（v4.2，2026-08-19 大王裁定）

**问题**：小雾 3B + 思考开启 TTFT 实测 45~226s，旧 PendingIndicator 在 prefill 阶段裸三点无耗时无阶段；引擎真挂时永远转圈——用户无法区分「正在干活 vs 挂了」（K90 血证：16 分钟生成全程无进度反馈）。v4.0 落地后真机复查：指示器仍是一行透明文本，视觉权重不足——大王裁定升级为卡片。

**设计**：原位升级 PendingIndicator（头部槽位，不插消息卡——回复气泡本身在流式，插卡=重复污染）。**v4.2 卡片化**：容器对齐 assistant 卡片设计语言（`assistantBubbleBackground` 底色 + `messageBorderRadius` 圆角 + 内边距），与聊天流卡片同一视觉族。**v4.9（B57）阶段语义化**：思考内容单一事实源 = 气泡 ReasoningBlock（跑分卡不再重复显示思考流）；阶段标签按 `reasoningPhase` 区分思考期/回复期；工具期保留工具名并补 web_search 业务标签。

| 要素 | 数据源（单一事实源=chatSessionStore） | 说明 |
|---|---|---|
| 阶段标签 | `agentUiState.status` → l10n（准备中/正在思考/正在回复/执行工具/工具名） | prefill 不再裸三点；streaming_text 按 `reasoningPhase` 区分思考期（reasoning-only）与回复期（content） |
| 总耗时 | `agentRunStartedAt`（run_started 写入，1s interval） | 覆盖所有阶段含 prefill |
| 阶段语义 | `agentUiState.reasoningPhase`（reducer 在 token 事件按 delta 翻转） | 思考内容单一事实源=气泡 ReasoningBlock，跑分卡不重复；工具执行期由 `pendingTalentNames` 保留工具名驱动业务标签（web_search→「正在联网搜索…」） |
| 心跳判定 | `lastAgentEventAt`（token/工具事件写入）>300s → 「疑似卡住，可点停止」 | 纯告知尊重停止钮，不自动杀 |

- **写入入口唯一**：applyEventToStore（run_started=markAgentRunStarted / token+marker+tool= touchAgentRun（仅心跳，B57 思考尾部已移交气泡）/ run_finished+run_failed=clearAgentRun）；渲染只读，observer 最小化（与 toolCallTokenCount 同策略）。
- **run_failed 收尾**：失败即 clearAgentRun + reducer 已翻转 status='failed'——进度卡立即退出，杜绝「挂了还在转」误报。
- **锋利裁剪（B57 更新）**：思考内容单一交给气泡 ReasoningBlock，跑分卡不滚思考流（重复=臃肿，用户视角两处同显）；阶段语义（思考/回复/搜索）承载业务进度，遥测行+迷你折线承载硬件进度；阈值 300s 定死不配置化（3B 最坏 TTFT 226s 有冗余）。
- **与生图卡同构**：三点波浪 + 阶段文本 + 耗时，同一视觉语言（ResultPreview/ImageTaskProgress 基准）；v4.2 起容器卡片化，与聊天页生图卡片同族。

## 19. 上下文压缩机制（B19，2026-08-19 大王裁定）

> 机制单源：`docs/POCKETPAL_CONTEXT_COMPACTION_SPEC.md`（决策机状态表 + 契约 + 文件清单）。本节只约束**聊天页 UI 表现**。

### 19.1 决策与提示（人机协作）
- 发送前预算 ≥0.8×n_ctx 时按 per-model 策略治理：`compact` 自动压缩（snackbar 提示）、`expand`/`ask` 照发（banner 提示）。
- **banner CTA 即选择入口**：context-warning/full 新增「压缩上下文」按钮（本地模型专属，远程不显示），与「增大上下文」「新聊天」并列；点击即显式选择并记住策略（setContextPolicy）。
- 压缩即时提示：snackbar「已压缩 N 条早期对话」（lastCompaction 消费，4s 自隐）。

### 19.2 压缩占位卡片（CompactedBlock）
- 锚点消息（metadata.compaction）渲染折叠卡片：折叠态「已压缩 N 条早期对话 ▾」，点按展开摘要全文；非锚点被压消息（compacted）从列表隐藏（原文保留库中）。
- 视觉：surfaceVariant 底 + outline 细边 + 12px 标题，与气泡层级区分（卡片属系统层，非对话层）。

### 19.3 指标与设置
- **助手卡指标行**新增「压缩 N」段（turnMetrics.compactedCount，>0 才渲染，老消息不渲染）。
- **生成设置页**「上下文策略」段：三选（扩充/压缩/每次询问，SegmentedButtons）+ 自动压缩开关（Switch，默认开）。

### 19.4 testID 登记
| 元素 | testID |
|---|---|
| warning 压缩 CTA | `context-warning-compact` |
| full 压缩 CTA | `context-full-compact` |
| 压缩占位卡片 | `compacted-block` |
| 压缩 snackbar | `compaction-snackbar` |
| 压缩指标段 | `metrics-compacted` |
| 自动压缩开关 | `auto-compaction-switch` |

## 20. 聊天页 UI 三处优化（2026-08-20，task-6ad）

> 依据：`.qoder/specs/聊天页UI三处优化方案_task-6ad.md`。单一事实源：本节 + 代码载体均为权威。
> 代码载体：`AssistantAuthorRow`（新建）/ `ChatScreen.renderBubble` / `Message.renderAssistantTurn` /
> `Bubble`·`ThinkingBubble`·`PendingIndicator`·`HeaderRight`·`AssistantTurnFooter` styles。

### 20.1 垂直排序：模型徽章行上移到思考卡之前

- **抽取共享组件 `AssistantAuthorRow`**（`src/components/AssistantAuthorRow/`，+ styles + index）：承载
  ① 模型徽章（`message.metadata.modelName` → `getModelDisplayName` 中文简称，brandAccent captionS 600）；
  ② 意图胶囊（`message.metadata.turnMetrics.intent` 四色 12% 底，点按 `askIntentChoice` → `setSessionIntent` 会话级状态机）。
  从 `MessageType.Any` 提取，无徽章无意图不渲染；布局 `marginLeft: spacing.sm` / `marginBottom: spacing.xs` / `gap: spacing.xxs`（与现 renderBubble 作者标签行一致）。
- **`assistant_turn` 渲染器**（`Message.renderAssistantTurn`）：行级顶部（所有 reasoning/content/talent block 之前）
  插入一行 `<AssistantAuthorRow message={turn} />`，每 turn 仅一次；根除原 legacy 多块路径潜在的徽章重复渲染，单一事实源。
- **`text` 类消息**（`renderBubble` 路径）保持「徽章 → 卡片」顺序，复用同一组件；`assistant_turn` 与 `text` 共用 `AssistantAuthorRow`，徽章/意图渲染逻辑收口一处。
- **`renderBubble` 门控（复查定稿 2026-08-20）**：`ChatScreen.renderBubble` 仅对非 `assistant_turn` 消息渲染 `AssistantAuthorRow`（`message.type !== 'assistant_turn'`）——turn 的徽章行已由 `Message.renderAssistantTurn` turn 级渲染一次，若 renderBubble 对每个内容块再渲染即 N+1 重复（P0 修复，`renderBubble.test.tsx` 三用例防回归：turn 不渲染 / text 渲染 / 用户消息永不渲染）。
- 意图胶囊点击行为原样保留（会话级状态机，IntentPickerHost 根挂载点不变）；**选择器初始值 = 会话实时意图** `chatSessionStore.activeSessionIntent`（与胶囊快照解耦，会话中途切换后点旧消息胶囊高亮当前状态）。

### 20.2 圆角区分：用户右下直角 / 大模型系左下直角（尾角下移 v4.3）

- **语义**：用户发出卡片 = 右下角直角（尾角在右下）；大模型回答系卡片 = 左下角直角（尾角在左下）。
  （v4.4 初版为「用户右上 / 回答系左上」，2026-08-20 大王裁定尾角下移：直角随消息流方向收在底部。）
- **`Bubble/styles.ts` contentContainer**：四角显式拆分（删除 `borderRadius` 统一速记——其会覆盖各角显式值，使直角裁剪失效）；
  顶部同侧角保持 `roundBorder` 逻辑（组内最后一条形成同侧全直边）。`overflow: 'hidden'` 已有，直角裁剪自动生效。
- **覆盖范围**：用户文本消息 / assistant 正文卡片 / legacy text / 图片·文件·自定义消息（共用 contentContainer）全族统一。
- **`ThinkingBubble/styles.ts` container**：左下直角（`borderBottomLeftRadius: 0`）+ 其余三角 `theme.radius.l`；
  折叠态 `collapsedRow` 无卡片背景，不动。
- **`PendingIndicator/styles.ts` card**：左下直角（`borderBottomLeftRadius: 0`）+ 其余三角 `theme.borders.messageBorderRadius`。

### 20.3 顶栏三控件水平等距

- **度量基准（复查定稿 2026-08-20）**：等距以「图标间视觉空隙」为度量，**非触区间距**——加号/三点图标在 36px 触区内居中，`gap` 只拉触区间距、图标空隙被触区内部留白放大（初版 gap:10 实测空隙 35px/99px，反而拉大）。
- **最终方案（真机像素验证 delta=1px）**：`HeaderRight/styles.ts`——`headerRightContainer` 不加 gap；新增 `compactBtnLeft`（三点按钮专用）：`width/height 36` + `alignItems: 'flex-start'`（RN column 容器水平方向由 alignItems 控制，justifyContent 只管垂直）+ `marginLeft: -6`（补偿 DotsVerticalIcon viewBox 内三点居中的左侧空白，dp 单位密度无关）；加号保持 `compactBtn` 居中。
- **真机实测（K90，1080×2400）**：胶囊↔加号 35px / 加号↔三点 36px / delta 1px（等距达成）。
- `displayMemUsage` 开启时 UsageStats 同组生效，属预期。

### 20.4 补充（已确认）：正文卡快捷图标间距加大

- **`AssistantTurnFooter/styles.ts` actionsRow**：`gap: 6 → 14`（播放 / 复制 / 重新生成）；图标 16px 与既有 hitSlop 14 不变，防误触。

### 20.5 testID 登记（组件迁移保持，位置变更）

| testID | 位置 |
|---|---|
| assistant-model-badge | `AssistantAuthorRow` 模型徽章（`assistant_turn` / `text` 复用同一组件） |
| assistant-intent-capsule | `AssistantAuthorRow` 意图胶囊（点按触发会话级状态机） |

### 20.6 约束 / 验证

- 颜色一律走 theme token（品牌黄 `brandAccent` / 意图四色 `theme.colors.*`），禁硬编码；深浅色双模式同族同步。
- 无 l10n 文案变更，无需 `validate:l10n`。
- 验证链路：`npx tsc --noEmit` 零错 → `npx jest` 相关套件
  （`Message.assistantTurn` / `ChatView.assistantTurn` / `ThinkingBubble` / `PendingIndicator` / `HeaderRight` / `ChatHeader` / `AssistantTurnFooter`）全绿 →
  真机覆盖安装 + 冷启动目测：① 徽章行 → 思考卡 → 正文卡顺序；② 用户卡右下直角、回答卡/思考卡/进度卡左下直角（v4.6 尾角下移）；③ 顶栏三控件间距等距。

## 变更日志

| 日期 | 版本 | 变更 |
|------|------|------|
| 2026-08-15 | 2.0 | 气泡一体化（footer 收进卡片，ADR-0003）+ 灰色分层落地（§11）；legacy fonts/radius 双轨收口同波执行 |
| 2026-08-16 | 2.1 | 生图任务卡片生成动效 + 图片撑满（§12，MASTER_LOG §20） |
| 2026-08-16 | 2.2 | §13 聊天内闭环：快捷入口下沉 controlBar 图标钮 + 前缀 chip 标签化（原子删除）+ 图片编辑闭环（三入口下沉输入框）+ §13.6 多模态输入边界（产物图不进模型） |
| 2026-08-18 | 2.3 | footer 按钮组升级（开发者预览版）：复制门控改内容完成度（isFinalMessage）+ 重新生成按钮（复用 handleTryAgain）+ 按钮组左对齐正文缩进；顶栏模型胶囊加 primary 描边 |
| 2026-08-17 | 3.0 | §14 语音输入：发送按钮升级为语音优先状态机 + 输入行高度统一 36px（思考/发送/语音同一基线） |
| 2026-08-18 | 3.1 | §15 生成设置参数标签本地化：新增 completionParamsLabels/Controls 两段 + paramLabel() fallback helper，16 语言全覆盖（MASTER_LOG §31.4） |
| 2026-08-18 | 3.2 | §16 顶栏胶囊管家感知 + 选择器卡片化（介绍/徽章/加载卸载/管家禁卸/单槽脚注）；§17 状态栏拆解融合进助手卡片（意图胶囊上移 + 每输出指标行 turnMetrics 快照 + ctx 中文直达 + 召回展开）；思考胶囊 24px 收敛 |
| 2026-08-19 | 3.3 | B18 复查锋利化：加载进度行（正在加载·已耗时 Xs）+ 加载期 sheet 驻留/收尾自动关（关闭单点收敛）；徽章集收口［已加载/管家驻场］（「本机不可用」属生图域范式不虚构）；isChatSelectable GGUF+manifest 名单单规则 |
| 2026-08-20 | 3.4 | §18 聊天页八项升级：意图胶囊会话级状态机（schema v8 + 胶囊点按唯一写入口）；助手卡 chrome 双行合并（删 TurnMetricsRow）；顶栏紧凑化 + 新建会话换加号；发送钮双态描边；placeholder engineStatus 单源决策表；n_ctx 每模型收口 + 预调；模型用途标签 + 弹窗多候选 |
| 2026-08-20 | 3.5 | 复查闭环（六维审计）：placeholder 第 4 分支硬编码中文收口 l10n（chat.butlerReady，16 语）；生成设置失焦显示与保存同源修正；§18.6 指标/设置分离定稿（BannerRow 读实际加载值）；用途标签/a11y 中文「产品叙事硬编码口径」显式登记 |
| 2026-08-20 | 3.6 | §18.6 PSS 安全阀：预调天花板 min(ceiling, PSS_SAFE_BUDGET 4GB) + 启动审计自愈超限档——K90 真机实证厂商 PSS 看护 6GB 硬杀，空闲内存 ceiling 不是存活天花板 |
| 2026-08-20 | 3.7 | 六维复审（8 项需求复盘）：§18.4 发送钮图标 20px 同行同尺寸；§18.5 placeholder 时序缺口修复（prompter loading 前置，冷启动首帧不再「模型未加载」）；§18.7 选型语义重定义（任务族候选上限 3，不甩全量 + 一句话推荐说明）+ 弹窗内加载（遮罩阻塞/失败弹窗承载不插卡） |
| 2026-08-20 | 3.9 | 发送/停止钮同一按钮语言：StopButton 与 SendButton 同规格（36px + 20px + 圆形衬底，停止=error 红），时态切换不跳变；rightControls gap 8 |
| 2026-08-19 | 3.8 | 默认 n_ctx 4096→8192（contextInitParams v2.3 迁移仅抬旧默认）+ perModelNCtxSource 源跟踪（审计不碰用户手调）+ 审计覆盖无覆盖模型——大王裁定「默认上下文必须够工具基线」 |
| 2026-08-19 | 4.0 | §18.9 生成进度监控卡：PendingIndicator 升级四要素（阶段标签/总耗时/思考流预览/300s 心跳）——prefill 不再裸三点，引擎真挂有「疑似卡住」提示；run_failed 收尾防永久转圈 |
| 2026-08-19 | 4.1 | §19 上下文压缩机制（B19）：发送前预算决策机 + banner「压缩上下文」CTA（选择即记忆）+ 压缩占位卡片 + 指标行「压缩 N」+ 设置页策略三选与自动压缩开关（CONTEXT_COMPACTION_SPEC） |
| 2026-08-19 | 4.2 | §18.9 进度监控卡卡片化：容器升级 assistant 卡片设计语言（底色+圆角），K90 真机复查「一行文本视觉权重不足」裁定 |
| 2026-08-26 | 4.3 | §18.6 策展表重排（4B→16384/2B→32768 等）+ 设备感知预算 resolvePssSafeBudget（上限 9GB）+ CURATED_TABLE_VERSION 版本化拉齐 + recommendNCtx 死代码删除——大王裁定「探索上限」，聊天体验极限化（配套 CONTEXT_COMPACTION_SPEC v1.2） |
| 2026-08-21 | 4.7 | §16.2/§18.7 模型加载卡片动效统一：选择器卡片与任务切换弹窗加载态升级三点波浪 + 2% 底条（ImageTaskProgress 同款设计语言，useWaveDots 复用；ModelSwitchDialog 移除 ActivityIndicator 统一） |
| 2026-08-24 | 4.8 | §18.2/§18.9 跑分演出升级规划定稿（B39，PERF_BENCHMARK_DESIGN §10 v0.5）：AssistantTurnFooter 行2 指标行数值接 PerfMotion AnimatedNumber + tok/s 段加 24px 迷你速率条（首 token 后才启动）；PendingIndicator 加实时 tok/s 跳动 + 心跳微波形 + 阶段色（prefill 蓝/streaming 绿/tool 紫）——升级不重造，双行结构/三点动画/300s 心跳卡住语义不变 |
| 2026-08-20 | 4.3 | §19 B19.1 链路根治（小米 13 DRC 血证，CONTEXT_COMPACTION_SPEC v1.1）：触发线含生成预留(512)、水位双源校准（实测钉底估算漂移）、摘要工作集预算化（min(6000, n_ctx−400)）、满态显式失败（饱和跳过压缩，context-full banner 用户主权，不静默不换引擎） |
| 2026-08-20 | 4.4 | §20 聊天页 UI 三处优化（task-6ad）：抽取 `AssistantAuthorRow` 单一事实源（徽章/意图上移助手卡顶行，`assistant_turn` 与 `text` 复用）；圆角区分（用户右上直角 / 回答系左上直角，Bubble·ThinkingBubble·PendingIndicator 同族）；顶栏三控件等距（HeaderRight gap 10）；footer 快捷图标间距 6→14 |
| 2026-08-20 | 4.6 | §20.2 尾角下移（大王裁定）：用户右下直角 / 回答系左下直角（Bubble·Message·ThinkingBubble·PendingIndicator 同族，roundBorder 逻辑镜像至顶部同侧角）；AssistantTurnFooter 按钮栏与信息栏之间加 hairline 分隔横线（与动作槽同分隔语言） |
| 2026-08-20 | 4.5 | §20 复查闭环（task-6ad 全量审计，K90 真机像素验证）：**P0** `ChatScreen.renderBubble` 加 `assistant_turn` 门控（turn 级仅一次，根除徽章行 N+1 重复，新增 `renderBubble.test.tsx` 三用例防回归）；`AssistantAuthorRow` 修正（author.id 硬编码 → 真实 `user.id`、意图选择器初始值改会话实时 `activeSessionIntent`、动态 import 改静态）；§20.3 顶栏等距度量重定义（图标视觉空隙为准，`compactBtnLeft` + `marginLeft -6dp`，真机 35/36px delta=1px） |
| 2026-08-26 | 4.9 | §18.9 进度链路语义化与去重（B57，大王洞察「跑分卡思考流与气泡重复」）：①思考流预览 `streamingReasoningTail` 清退（思考内容单一事实源=气泡 ReasoningBlock，store 字段/触摸方法/touchAgentRun 形参/l10n reasoningLabel 全链删除）；②`AgentUiState` 加 `reasoningPhase`（reducer 在 token 事件按 reasoning/content delta 翻转，引用守卫保流式性能）——streaming_text 标签区分「正在思考…/正在回复…」，200s 思考期用户不再迷茫；③`tool_call_started` 保留 `pendingTalentNames`（执行期工具名不再丢失）+ TALENT_LABEL_KEYS 补 web_search→「正在联网搜索…」——联网搜索全程业务语义可见；阶段色收敛二态（流式期蓝/工具期紫） |
