---
doc_id: POCKETPAL_DESIGN_SPEC
module: root
type: ssot
status: active
version: "3.4"
created: "2026-08-14"
updated: "2026-08-20"
relates: [DRC_SPEC, POCKETPAL_CHAT_UI_SPEC, POCKETPAL_IMAGEGEN_UI_SPEC, POCKETPAL_UI_INTERACTION_SPEC, POCKETPAL_ICON_SPEC, ADR-0001-ui-ssot-single-source, ADR-0002-imagegen-header-right, ADR-0003-bubble-footer-unification, UI_GATE_VERIFICATION_SOP]
supersedes: []
---

<!-- D-FORMAT:v3 -->

<!-- 文档管理：机制见 docs/DOC_MANAGEMENT.md；AI 用法见 docs/CURSOR_DOC_USAGE.md。
更新时：1) 更新 frontmatter 的 updated/version；2) 同步 type/status/relates 与文末「关联文档」；
3) 若取代/被取代则填 supersedes/superseded_by；
4) SSOT 文档须在「关联」章节指向相关 ADR 与 SOP；
5) 在 docs/INDEX.md 中登记。-->

# PocketPal 设计语言总纲（DESIGN_SPEC）——「暖巢 WarmNest」

**状态**：active | **版本**：3.0 | **更新**：2026-08-15

> **定位**：全 App UI 设计语言唯一真相源（UI 域 SSOT）——色彩 / 排版 / 间距栅格 / 图标 / 形状材质 / 阴影层级 / 组件状态 / 动效 / 文案 / 可访问性 / 性能预算十一大维度定稿，以及遗留债务治理批次（Gap Ledger）。
> **配套**：相关 ADR 见 `docs/adr/ADR-0001-*` 起；操作手册见 `docs/sop/UI_GATE_VERIFICATION_SOP.md`。
>
> 任何 UI 视觉迭代必须先更新本文档再改代码。版本：v3（2026-08-15，全面治理定稿：补齐间距栅格 / 阴影层级 / 组件状态 / 中性色分层 / 可访问性 / 文案六维度；遗留债务全部进入治理批次，批次验收清零，不再登记无批次债务）
> 并列文档：POCKETPAL_CHAT_UI_SPEC.md（聊天页）/ POCKETPAL_IMAGEGEN_UI_SPEC.md（生图页）/ POCKETPAL_UI_INTERACTION_SPEC.md（全局交互）/ POCKETPAL_ICON_SPEC.md（图标）
> 代码落点：`src/theme/tokens/`（token 单一事实源）+ `src/components/ui/`（DS 组件）

## 一、定位与边界

- **负责**：全 App 视觉语言单一事实源——token 体系（颜色/排版/间距/圆角/描边）、DS 组件（IconTile/ListItem/PressableScale/ConfirmDialog）、各屏视觉规范（聊天/生图/设置子页）的权威定义与治理批次。
- **不负责**：交互行为与导航层级（UI_INTERACTION_SPEC）；图标资产绘制（ICON_SPEC）；文案库内容（APP_INTRO_COPY）；引擎/推理链路（llama.cpp / ONNX JNI，UI 改造禁区）。
- **上下游**：被 CHAT/IMAGEGEN/INTERACTION/ICON 四并行 SPEC 引用；被 src/theme/tokens 与 src/components/ui 实现；ADR 提供关键决策证据；SOP 提供验证执行手册。

## 二、核心原则 / 公理

**品牌暖黄为魂、功能域彩色为脉、大圆角卡片为体、克制弹簧为动、性能预算为门。**

行业对标（2025-2026）：Apple Liquid Glass（层次感）、HyperOS 3/4 超拟圆与柔光玻璃（大圆角+克制半透明）、HarmonyOS NEXT 和谐美学（一域一色+错峰入场）、M3 Expressive（字号字重对比+弹簧）。共同取舍：**视觉升级必须捆绑性能工程**；Android 端不做真模糊（blur），用半透明+阴影分层替代。

产品红线（不可违背）：
- 不兜底、不补丁：不做降级开关、不加 if 分支兼容旧视觉；token 一步到位。
- UI 为推理让路：内存账本被模型占据（文本槽 ~3GB + 生图槽 ~3.5GB），UI 层每帧 JS 开销必须可忽略。
- testID 零变更；三份既有交互 SPEC 定稿不推翻；零新依赖。
- **不留债务（v3）**：任何「未完成项」必须挂入 §8 治理批次（含批次号 / 验收标准 / 前置条件），不允许无批次挂账；批次内未完成前不展开同一区域的新视觉特性（锋利原则：要么完整做，要么登记批次，不拆半成品）。

## 1. 色彩体系

### 1.1 交互主色（primary，品牌暖黄）
| token | light | dark | 用途 |
|---|---|---|---|
| primary | #F5A623 | #FFC54D | 按钮/选中态/开关/主交互 |
| onPrimary | #3D2E00 | #332700 | 黄底文本（深棕，对比度达标） |
| primaryContainer | #FDEBC8 | #5C4400 | 主色容器底 |
| onPrimaryContainer | #4A3500 | #FFE29A | 主色容器文本 |

- 原 primary 灰黑（#333333 / #DADDE6）降级：文本职责交给 onSurface/onBackground，不再承担交互色。
- 品牌点缀 brandAccent（#FFB300 / #FFC54D）保留，用于文字级强调（性能数字/徽章文本）。

### 1.2 功能域彩色（一域一色，HarmonyOS Vivid Colour 思路）
`theme.colors.domain.*`，浅色模式用实色、深色模式用提亮变体：

| 域 | token key | light | dark | 应用 |
|---|---|---|---|---|
| 聊天 | domain.chat | #1E4DF6 | #7B9AF7 | 聊天相关入口/空态 |
| 生图 | domain.imageGen | #D81B60 | #F48FB1 | 生图入口/徽章 |
| 记忆 | domain.memory | #00838F | #4DD0E1 | MemoryScreen |
| 知识库 | domain.knowledge | #2E7D32 | #81C784 | KnowledgeScreen |
| 智能体 | domain.workspace | #EF6C00 | #FFB74D | WorkspaceScreen |
| 工具 | domain.tools | #6750A4 | #B39DDB | ToolScreen / ActiveTaskBanner |

用法：IconTile 底色 = withOpacity(域色, 0.12)，icon 线条 = 域色。

### 1.3 语义状态色（收编生图四色按钮等散落硬编码）
| token | light | dark | 语义 |
|---|---|---|---|
| success / onSuccess | #2E7D32 / #FFFFFF | #6BC67E / #0B2E10 | 保存/成功 |
| warning / onWarning | #EF6C00 / #FFFFFF | #FFB74D / #3E2600 | 再次生成/实验性 |
| danger / onDanger | #C62828 / #FFFFFF | #F28B82 / #3B0906 | 删除/破坏性 |
| info / onInfo | #1565C0 / #FFFFFF | #90CAF9 / #0D2744 | 编辑/分享/信息 |

### 1.4 模型族徽章色
badgeSd35 #8E24AA / #CE93D8；badgeZImage #00838F / #4DD0E1；badgeDreamlite #D81B60 / #F48FB1。

### 1.5 表面层次
- 既有 surface / surfaceVariant / surfaceContainer* 不变。
- 新增 surfaceElevated：light rgba(255,255,255,0.96) / dark rgba(30,30,32,0.96) —— 悬浮层（下拉面板/浮层卡）专用，配 Android elevation 投影，**禁 blur**。

### 1.6 硬编码色值映射表（A2 清理依据）
`#fff`→surface、`#f5f5f5`/`#f0f0f0`/`#e8e8e8`→surfaceVariant、`#666`/`#888`→onSurfaceVariant、`#999`→outlineVariant、`#fff3e0`→withOpacity(domain.workspace,0.12)、`#333`文本→onSurface。聊天组件禁硬编码色（CHAT_UI_SPEC §1 既有规则，扩展到全 App）。

### 1.7 色彩应用规范与比例（v2 新增，解决「色彩跳出、无比例」）

**60-30-10 配色比例**（单屏色彩预算，M3 Expressive / 经典平衡法则）：
- **60% 中性表面**：background / surface / surfaceVariant——主背景与大面积留白，承载可读性。
- **30% 容器与文本**：卡片 surfaceContainer、正文 onSurface / 次要 onSurfaceVariant——内容载体与字色。
- **10% 品牌与域彩强调**：primary（CTA/激活）、domain.*（IconTile 底 12% + icon 线条）、semantic（状态）。强调色只出现在「该被注意」处，禁大面积铺品牌黄。

**色彩角色映射**（什么色用在什么地方）：
| 角色 | token | 用在 | 禁忌 |
|---|---|---|---|
| 主交互 | primary / onPrimary | CTA 按钮、选中态、开关激活、返回箭头 | 不做大面积背景 |
| 域识别 | domain.* | 子页 AppBar tint、IconTile、徽章 | 域色不混用（一屏一域） |
| 状态 | semantic.* | 成功/警告/删除/信息提示 | 不做装饰 |
| 文本 | onSurface / onSurfaceVariant / outline | 正文 / 次要 / 分隔 | 不用 primary 做正文 |
| 表面 | surface / surfaceContainer / surfaceElevated | 背景 / 卡片 / 浮层 | —— |

**子页 AppBar 域彩 tint**（沿用 B3）：子页顶栏背景 = surface，返回箭头/标题旁点缀用该页域色（IconTile 或小徽章），headerRight 操作图标用域色。正文一律 onSurface，不用域色做正文。

### 1.8 中性色分层与灰色治理（v3 新增，解决「大量浅灰、灰无层次」）

**问题**：surfaceVariant（#e4e4e6）被 5+ 处不同层级功能共用（模型 chip / 状态条 / 软上限横幅 / 编辑栏 / 问候卡），用户气泡 #f2f2f2 同属灰阶 → 灰色泛滥无分工。

**规则：一灰一职**。每个中性 token 只承担一个层级职责：

| 层级 | token | light | dark | 职责 | 禁用作 |
|---|---|---|---|---|---|
| 页面底 | background | #ffffff | #000000 | 全局/聊天/生图根背景 | 卡片与容器底 |
| 页面面 | surface | #F9FAFB | #0E0E0E | 子页背景、分组卡底 | 悬浮层（用 surfaceElevated） |
| 次级表面 | surfaceVariant | #e4e4e6 | #646466 | **仅「信息带」**：状态条/横幅/编辑栏/搜索底 | 内容卡片、气泡、chip 底 |
| 容器 | surfaceContainer* | 派生 | 派生 | 卡片内高亮区/按压反馈 | 页面级背景 |
| 用户消息 | authorBubbleBackground | #f2f2f2 | #212121 | 仅用户气泡 | 其他任何容器 |
| 助手消息 | assistantBubbleBackground | #E9F0FB | #20344B | 仅助手气泡 | 其他任何容器 |
| 浮层 | surfaceElevated | rgba(255,255,255,0.96) | rgba(30,30,32,0.96) | 下拉面板/Sheet/弹层 | 静态卡片 |

**聊天页灰色用途清单（治理目标，B1 批次落地）**：
| 现用元素 | 现用 token（问题） | 治理去向（B1 批次） |
|---|---|---|
| 顶栏模型 chip | surfaceVariant | 域彩 12% 透明底 + 域色文字（与生图页 trigger 同语） |
| SessionStatusBar 状态条 | surfaceVariant | 降为 surface + 顶部 hairline 分隔；信息带语义改由「文字+彩色圆点」承担 |
| softCapBanner 软上限横幅 | surfaceVariant | 保留信息带职责（surfaceVariant 唯一保留位），验证一灰一职 |
| ChatInput 编辑栏 | surfaceVariant | surface + 边框 |
| GreetingBubble 问候卡 | surfaceVariant | surface 或域彩 12%（随 CHAT_UI_SPEC v2 定稿） |
| 用户气泡 | authorBubbleBackground #f2f2f2 | 保持（语义定稿），与 surfaceVariant 用途区隔后不再撞灰 |

**新增灰规则**：新中性色必须先登记本表再使用；surfaceVariant 严禁用于内容卡片/气泡/chip 底。

## 2. 排版体系

### 2.1 token 全表（theme.typography.*）
| token | 字体 | size/lineHeight | weight | 用途 |
|---|---|---|---|---|
| displayS | Inter-Medium | 28/34 | 500 | 页面大标题（设置页/AIOS 屏顶部） |
| titleL | Inter-Medium | 22/28 | 500 | 区块大标题 |
| titleM | Inter-Medium | 18/24 | 500 | 页面标题/Header |
| titleS | Inter-Medium | 16/22 | 500 | 卡片标题 |
| bodyM | Inter-Regular | 16/24 | 400 | 正文 |
| bodyS | Inter-Regular | 14/20 | 400 | 次要正文 |
| uiM | Inter-Medium | 14/20 | 500 | 按钮文本 |
| uiS | Inter-Medium | 12/16 | 500 | 小按钮/chip |
| captionM | Inter-Regular | 12/16 | 400 | 辅助说明 |
| captionS | Inter-Regular | 11/14 | 400 | 时间戳/footnote |
| numericM | JetBrainsMono-Medium | 16/22 | 500 | 数字强调（timing/参数/统计） |
| headlineH1 | Fraunces-Medium | 36/50 | 500 | Onboarding 大标题（非拉丁换 Inter） |
| styledXs | Fraunces-Italic | 14/14 | 400 | 斜体点缀 |
| codeM / codeS | JetBrainsMono | 14/20, 12/16 | 400 | 代码 |

### 2.2 散点 fontSize 映射表（A3 清理依据）
11→captionS、12→captionM（按钮场景 uiS）、13→bodyS、14→bodyS/uiM、15→bodyM、16→bodyM/titleS、9/10→captionS（最小 11，9/10 一律提到 captionS）。替换时同步 lineHeight 取 token 值。

### 2.3 大标题规范
页面级大标题用 displayS + 域彩色点缀（IconTile 或标题旁徽章）；滚动时不吸附、不动画（性能优先）。

### 2.4 间距与栅格（v3 新增，解决「组件间距无规则」）

**spacing token 全表**（与 `src/theme/tokens/spacing.ts` 一致）：
| token | 值 | 典型用途 |
|---|---|---|
| none | 0 | 无间距 |
| xxs | 2 | 徽章内 padding 垂直 |
| xs | 4 | chip 内 padding、小图标间距 |
| s | 8 | 紧凑间距（icon 与文本、行内元素） |
| sm | 12 | 卡片内次级间距、行间 |
| m | 16 | **页面边距 / 卡片内 padding / 分组间距（默认节奏）** |
| ml | 20 | 段落间距、大卡片内距 |
| l | 24 | 区块间距、输入区 padding |
| xl | 32 | 大区块分隔、空态留白 |
| xxl | 40 | 空态/页尾大留白 |

**栅格规则**：
- 基准节奏 = 4pt（spacing.xs 为最小增量）；所有间距必须落在 token 表内，禁裸数字。
- 页面级：内容区左右边距 m(16)；多分组页面分组间距 m(16)。
- 卡片级：卡片内 padding m(16)、卡片内行间 sm(12)、图标与文本间距 s(8)。
- 行组件：列表行高 56（触区内 44 文本行）；行内 IconTile 40×40。
- 文本行高一律取 typography token 的 lineHeight，不单独设置行距。

## 3. 图标体系（IconTile，文本裸露治理核心）

- 组件 `ui/IconTile`：40x40 圆角容器（radius.m=12，域色 12% 透明底）+ 22px Lucide 线条 icon（域色）。
- 应用位置：设置页全部条目、AIOS 四屏列表行、抽屉底部设置入口。
- 列表行结构（三段式）：IconTile + (标题 bodyM / onSurface + 辅助说明 captionM / onSurfaceVariant) + chevron-right（onSurfaceVariant）。分组用 Surface 卡片包裹（radius.l=20）+ 分组标题 captionM/onSurfaceVariant。
- 触区 44 不变；图标资产沿用 `src/assets/icons/` Lucide 族，不引入 icon-font。

## 4. 形状语言与材质（v2 规范化，解决「圆角矩形/矩形/圆形无逻辑」）

单一 radius 源 `src/theme/tokens/radius.ts`，**按角色取值、不在组件内自定数字**：

| 角色 | radius | 用途 |
|---|---|---|
| 内容卡片 | `l`(20) | 分组 Surface / 结果图卡 / 设置行卡 |
| 浮层表面 | `xl`(32) | 抽屉 / 底部 sheet / 悬浮下拉面板 |
| 矩形 | `none`(0) | 仅分隔线 / 全幅媒体 / 表格细线 |
| 胶囊 | `full`(999) | 主操作按钮 / chip / badge / 模型胶囊 / 圆形容器 |
| 次级容器 | `ml`(16) | 次级按钮 / 输入框容器 |
| 小元素 | `s`(8) | 输入框本体 / 小标签 |
| 图标容器 | `m`(12) 40×40 | IconTile（既有） |
| 圆形 | `full` | 头像 / FAB / IconTile-s |

**规则**：
- 同屏同角色同值；同级容器不混用矩形与圆角。
- 卡片内嵌元素半径递减：card `l`(20) → 内输入框 `s`(8) / 内 chip `full`。
- 唯一允许 `none`(0) 矩形的场景：分隔线（Divider）、全幅媒体图、表格细线。其余容器一律取圆角角色。
- 形状角色锁：`tokens/__tests__/shape-roles` invariant，同角色组件必须取同一 radius token（C1 落地）。
- **消息气泡角色**（v3 明确）：气泡 = 内容卡片角色（radius.l=20，相邻消息组尾角收紧规则见 CHAT_UI_SPEC v2）；气泡内嵌元素（图片/代码块）递减取 s(8)。

**光影分层**（HarmonyOS 材质层 + 柔光玻璃路线）：卡片 surface + Android elevation 2（列表卡）/ 4（悬浮层）；悬浮面板 surfaceElevated + elevation 4 + scrim。**零 blur、零新依赖**。ConfirmDialog / Sheet / 模型胶囊统一走 surfaceElevated + 大圆角。

## 4b. 子页统一模板（v2 新增，解决「子页设计语言不统一」）

设置下所有子页（GenerationSettings / About / Memory / Knowledge / Workspace / Tool）统一走同一模板，以「暖巢 WarmNest」为体：

**标准结构**：
```
AppBar（域彩 tint · 返回箭头 + 标题 · headerRight 域彩操作）
  ↓
ScrollView
  ├─ displayS 页面大标题（可选，域色点缀）
  ├─ section Surface(radius l, elevation 2) 分组卡
  │    ├─ Row: IconTile + 标题(bodyM) + 辅助(captionM) + chevron
  │    └─ Row ... （行间 Divider，触区 44）
  └─ section ... （多分组）
```
**行组件**：`PressableScale` 包裹 `IconTile + 标题 + chevron`（三段式，见 §3），分组用 `Surface radius="l"` 卡片包裹 + 分组标题 `captionM/onSurfaceVariant`。
**统一项**：分组卡片间距 spacing.m、卡片内 padding spacing.m、行高 56、分组标题与卡片间距 spacing.s。Paper `List`/`Card` 在子页一律替换为 DS `Surface` + `IconTile` 行。
**入场**：分组错峰 `useStaggerEntry`（一次性，§5）。

## 4c. 组件状态与结构规范（v3 新增，解决「卡片割裂、组件状态无统一」）



### 4.x 形状使用纪律（B8，2026-08-15 定稿，学习 HarmonyOS Design）

形状是语义层，不是装饰。四条纪律：

1. **成组原则**：同一容器/工具栏内的相邻交互元素形状必须一致，不允许半胶囊半矩形混排（例：生囊顶栏“选择器胶囊 + 动作矩形按钮”合法，两个胶囊并排不合法）。
2. **语义分工**：选择器/状态标签 = 胶囊（chip/badge/模型胶囊）；动作按钮/内容容器 = 圆角矩形。胶囊脱离矩形容器即“漂”，必须挂靠容器边缘（气泡内动作槽）。
3. **顶栏豁免**：导航栏层默认不用胶囊（除非语义是选择器）；动作一律圆角矩形，直角边缘键定右缘、消除视觉右伸。
4. **光学修正**：胶囊组右缘留白按弧线外扩微调；复合元素右缘以直角元素为视觉键。
### 4c.1 消息气泡一体化（聊天页，B1 批次落地）
**现状问题**：气泡卡片（浅蓝/浅灰）与下方 footer 按钮行（朗读 ▶ / 复制 / timing）分离渲染，视觉割裂；CHAT_UI_SPEC §2 图示为「footer 在卡片内」——实现落后于规范。

**定稿结构**：
```
┌──────────────────────────────────────┐
│ 模型徽章（brandAccent 小字）          │ ← 仅助手；气泡外，左对齐
├──────────────────────────────────────┤
│ 气泡卡片（assistantBubbleBackground） │
│  radius.l(20)，内 padding m          │
│  ├─ 正文（Markdown）                 │
│  └─ footer（卡片内底部）             │
│     ▶朗读 · 复制icon · 12ms/token    │ ← height 24，与正文同底色
└──────────────────────────────────────┘
```
- footer 收进气泡卡片内（同底色、底部 padding s），朗读/复制 icon 用 onSurfaceVariant（灰降级为文字级），timing 数字 brandAccent 不变。
- 用户气泡：authorBubbleBackground，无 footer。
- 图片/文件/HTML 预览等媒体卡片：媒体区取 radius.l，内嵌操作条收进卡片底（同波治理）。

### 4c.2 按钮状态机（全局）
| 状态 | 表现 |
|---|---|
| default | primary 实底（radius.full 胶囊）/ 次级 outlined（radius.ml）/ 危险 danger 实底 |
| pressed | PressableScale 弹簧 0.97（JS driver，§5） |
| disabled | surfaceDisabled 底 + onSurfaceDisabled 文本，禁透明度叠两层 |
| loading | 保留文字 + 行内 ActivityIndicator（按钮尺寸不变） |
- 按钮文本：uiM(14)/uiS(12)；高度 ≥44（紧凑场景 ≥36 + hitSlop 补足 44）。

### 4c.3 chip / 胶囊状态机
| 状态 | 表现 |
|---|---|
| default | 域彩 12% 透明底 + 域色/onSurface 文本，radius.full |
| active | 域彩实色底 + onPrimary 文本（选中） |
| disabled | surfaceDisabled 底 + onSurfaceDisabled 文本 |
- 模型选择胶囊（生图页 trigger / 聊天页模型 chip）统一走此规范。

### 4c.4 输入框
容器 radius.ml(16)（对齐既有 `borders.inputBorderRadius=16`），内部输入本体 radius.s(8)；聚焦态 border 用 primary（1.5px = stroke.md）；错误态 danger 边框 + errorContainer 底。

## 5. 动效体系（铁律内克制版）

| 动效 | 实现 | 生命周期 | 红线 |
|---|---|---|---|
| 按压反馈 | `ui/PressableScale`：Animated.spring scale 0.97→1 | 按压瞬间（一次性） | JS driver |
| 列表错峰入场 | 行级 opacity+translateY(8) stagger 30ms | 仅首屏一次性 | 不循环、不重复触发 |
| 页面进入弹簧 | 子页标题/分组卡 fade+translateY(8) stagger（`useStaggerEntry` 推广到六子页） | mount 一次性 | 不循环；聊天流式路径禁用（G5） |
| 行高亮过渡 | 列表行 onPressIn 底色过渡到 primaryContainer 6% | 按压瞬间 | 不新增常驻动画 |
| 三点波浪/呼吸 | 既有 useWaveDots | 生成期间 | 已定稿（IMAGEGEN_UI_SPEC） |
| chevron 旋转 | 既有 | 展开瞬间 | 已有 |

铁律：`Animated.loop` 一律 useNativeDriver:false（07a47ed 收口）；一次性短动画允许 native；不引入 Lottie/reanimated 新用法；新动效一律「一次性 + JS driver」为默认，仅在 `useStaggerEntry`/`PressableScale` 既有模式内推广，**不新增动画基础设施**（G4）。

### 5.x 阴影与层级（v3 新增，解决「层次靠颜色不靠深度」）
| 层级 | elevation（Android） | iOS shadow | 用途 |
|---|---|---|---|
| 0 | 0 | 无 | 页面背景/信息带 |
| 1 | 1 | opacity 0.05 / radius 4 / y 1 | 输入区悬浮条 |
| 2 | 2 | opacity 0.08 / radius 8 / y 2 | 列表卡/分组卡/气泡卡 |
| 4 | 4 | opacity 0.12 / radius 12 / y 4 | 悬浮面板/下拉/Sheet |
| 8 | 8 | opacity 0.16 / radius 16 / y 8 | Modal/弹窗（ConfirmDialog 等） |
- 阴影仅用于「抬升」语义：可交互浮层/卡片，**禁用于静态信息带与纯文本区**。
- 一律走 Android elevation（RN 内置），禁 blur/新依赖。

## 6. 性能门禁（G1-G5，最高优先级）

| 门禁 | 红线 | 验证 |
|---|---|---|
| G1 帧率 | token 流期间 JS 帧 <16ms，动画不阻塞输入 | 真机 token 流 + 按压动效叠加走查 |
| G2 内存 | UI 改造零新增常驻内存；列表图片一律缩略图 | 生成 12 分钟长跑 + dumpsys meminfo 对比 |
| G3 动效 | 循环动画 JS driver；一次性动画短挂载；无 weak-ref 累积 | 长跑后 NativeAnimatedModule weak ref 抽查 |
| G4 依赖 | 零新依赖 | package.json diff 审查 |
| G5 re-render | 聊天流式路径不新增订阅面；新组件 memo 化 | jest 渲染计数抽查 |

违反任一门禁的视觉特性直接裁掉，不做降级兜底开关。

## 7. 迁移规则

- invariants.test.ts 的 token 消费白名单随每波迁移同步扩（`screens/*` 新消费者按波加入 allow-list）。
- 每波改动过五关门禁：tsc 零错 / jest 改动套件绿 / Gradle 构建 / 装机 / 性能走查。
- 既有 Paper 屏（Models/Settings/Pals）不强制换 DS 组件，但颜色/字号一律取 token。
- 治理批次执行顺序见 §8；批次内改动必须先更新对应并行 SPEC 再改代码。

## 8. Gap Ledger（遗留债务治理批次：债务清零计划，不留无批次债务）

**规则**：所有已知未完成项挂入下表；新发现的未完成项必须先补录本表（含验收）再谈实现；批次验收 = 五关门禁 + 深浅双模式真机走查；批次完成后对应并行 SPEC 同步升版记录。

| 批次 | 内容 | 前置条件 | 验收标准 | 状态 |
|---|---|---|---|---|
| B1 | **聊天视觉再定稿**（CHAT_UI_SPEC v2）：① 气泡一体化（footer 收进卡片，§4c.1）② 灰色分层落地（§1.8 清单：模型 chip 域彩化、状态条降 surface、编辑栏 surface+边框等）③ 50+ 处原始 borderRadius 清除（ImageMessage/FileMessage/GreetingBubble/LoadingBubble/HtmlPreviewBubble/ChatView 等 → radius[shapeRoles.*]）④ legacy fonts 双轨收口（fontStyles 剩余消费者：TextMessage sentMessageBodyTextStyle 族、ChatInput inputTextStyle → theme.typography.*） | 本文档 v3 定稿（已就绪） | 聊天页深浅双模式走查零视觉回归 + tsc/jest/Gradle/装机全绿 + invariants 覆盖新 token 消费者 | ✅ 已完成（2026-08-15，ADR-0003 accepted，CHAT_UI_SPEC v2） |
| B2 | **生图页散点字号 token 化**：styles.ts 中 12/13/11 等裸 fontSize → theme.typography（captionS/captionM/uiS 等） | IMAGEGEN_UI_SPEC 已定稿 | 生图页视觉零回归 + token-consumer 白名单更新 | ✅ 已完成（2026-08-15，IMAGEGEN_UI_SPEC v2） |
| B3 | **子页模板收尾**：Memory/Tool 行容器 Surface 化（自定义操作行：Switch/编辑删除）+ GenerationSettings Paper Card → DS Surface 结构换装（Card.Title/Content 重组）+ 六子页错峰入场补全（§4b 统一） | 既有 §4b 模板 | 六子页与模板逐项对照无偏差 | ✅ 已完成（D2 已落地 + 2026-08-15 复核；Switch/List 属 §7 允许范围） |
| B4 | **可访问性落地**（§9）：对比度校验（brandAccent 徽章/文字级强调全查）、触区 44 审查（IconButton/icon 按钮 hitSlop）、content-desc 语义补全（图标按钮无文字场景） | §9 定稿 | 无障碍清单走查表全绿 | ✅ 已完成（2026-08-15，accessibilityLabel + hitSlop） |
| B5 | **生图页顶栏边距修正**：headerRight 触发组（胶囊+加载按钮）加右侧 margin（8~12dp），消除贴边（真机证据：加载按钮 bounds 右缘=1080 贴屏幕边） | 无 | 真机截图：触发组与屏幕右缘间距 ≥8dp | ✅ 已完成（2026-08-15，marginRight 8dp） |
| B6 | **浅灰全量消灭**：抽屉搜索框/会话选中态/生图按钮行/工具页等 21 处 surfaceVariant 容器底 → surface（一灰一职）；Pals 入口与路由裁剪 | §1.8 | 真机 surfaceVariant≈0 | ✅ 已完成 |
| B7 | **生图预览信息条**：seed 行移至预览图顶部 overlay（模型 · 耗时 · 分辨率），旧历史兼容降级 | IMAGEGEN_UI_SPEC v2.1 | 真机截图 | ✅ 已完成 |
| B8 | **圆角语义定稿（学习 HarmonyOS Design）**：胶囊=状态/操作短标签，圆角矩形=内容容器；选中态=域彩 12% + 主色文字；形状使用纪律四条已写入 §4 | §4 shapeRoles | 文档深化 + 走查 | ✅ 已完成 |
| B9 | **记忆徽章可读性**：绿底徽章文字改 onSuccess 白字 | §9 | 真机截图 | ✅ 已完成 |
| B10 | **图标尺寸规范（第一步）**：聊天顶栏右侧图标 24→20px 与左侧吸盘统一；iconSize token 已建（xs14/s16/m20/l24/xl28）挂载 theme，HeaderLeft/Right 已走 token；全 App 散落硬编码待收口 | §4 | 图标一致性走查 | 部分完成（顶栏已 token 化） |
| B11 | **欢迎页插画多语言化**：宣传插画/SVG 内嵌英文文字（PhoneWithPals 等）难随语言切换；文本层已中文（默认 zh），需插画资源分语言化 | §7 | 欢迎项看不到英文文字 | 待执行 |
| B12 | **内置模型挂 HF 链接**：欢迎项/模型页内置模型挂具体 HuggingFace url（HF 下载机制已存在：HFTokenSheet + 模型行下载） | P4 选型矩阵 | 模型页直接下载内置模型 | 待执行 |
| B13 | **存储权限防护（卸载重装事故复盘）**：卸载会清空 MANAGE_EXTERNAL_STORAGE appop → 模型列表空；启动时先检权限再扫描，未授权弹导引去系统设置 | §7 | 卸载后重装模型自动恢复且有提示 | ✅ 已完成 |
| B14 | **聊天记录快照机制（卸载不丢）**：WatermelonDB JSI 私有库进后台导出到共享存储，启动时私有库缺失自动恢复；与模型目录同一持久化策略，仅用户主动清数据才丢 | §7 | 卸载重装聊天记录恢复 | ✅ 已完成 |
| B15 | **存储策略与安卓规范对齐（历史债）**：模型目录双轨已实现（ADR-0004）：HF 下载默认落 getExternalFilesDir（零权限、Play 合规），/Documents/AIOS/models 默认注册为自定义目录续读、卸载不丢；自定义目录走 SAF 系统选择器（只能选文件夹）；权限延迟到用户添加目录时引导 | ADR-0004 | 双轨扫描 + 设置页入口 | ✅ 已实现（2026-08-16） |
| B16 | **开发者预览版描边与诊断面**：①抽屉搜索框描边 1px + 聚焦橙黄（primary）；②聊天/生图顶栏模型胶囊加 primary 1px 描边；③消息卡片 footer 按钮组（朗读/复制/重新生成，左对齐正文缩进，复制门控改内容完成度）；④生图任务化（每次生成=持久化任务：running 空白进度页/success 回填/failed 保留报错页，报错唯一出口=预览区）；⑤报错一键复制（errorReport 统一出口：复制+落盘 AIOS/logs，聊天弹窗+生图失败页共用）；⑥卸载保留闭环（sharedStorageBootstrap 竞态根治 + 写后 debounce 快照 + persistUserData 用户开关）；⑦BuildInfoModule 构建时间注入 | §1.8 / CHAT_UI_SPEC / IMAGEGEN_UI_SPEC | 真机走查 + 测试员分发 | ✅ 已完成（2026-08-18，Developer Preview） |
| B17 | **真机二轮反馈收口**：①关于页构建时间独立成行（防同行溢出）；②生图胶囊底色统一 primary 12%（与聊天胶囊同设计语言）；③思考开关选中态 onSurface 黑底改 primary 底 + onPrimary 前景（全局选中态规范）；④图片编辑快捷钮空锚点根治（按钮即 Menu anchor，真机菜单可弹）；⑤n_ctx 每模型独立（perModelNCtx 持久化覆盖 + 加载链取生效值 + 生成设置操作活动模型 + 状态栏 ctx 胶囊直达入口）；⑥真机取证两根治：快照私有库三候选兼容（watermelondb 实际落私有根目录）、权限引导只探测自定义目录（零权限默认目录混入致判定恒真） | §1.8 / CHAT_UI_SPEC §11 / IMAGEGEN_UI_SPEC §4 | 真机复验 | ✅ 已完成（2026-08-18） |
| B18 | **聊天顶栏重构**：①胶囊管家感知三档显示链（已加载模型→管家 MiniCPM 1B→选模型）；②选择器卡片化（MODEL_MATRIX §1 入选说明 + 徽章 + 行内加载/卸载 + 管家禁卸 + 单槽脚注「加载新模型自动卸载」+ 加载进度行「正在加载·已耗时 Xs」，加载期 sheet 驻留/收尾自动关，关闭单点收敛）；③SessionStatusBar 整行删除、拆解融合进助手卡（意图四色胶囊上移作者行 + 每输出指标行 turnMetrics 快照：上下文余量/落盘/召回展开/情绪 + ctx 中文点按直达生成设置）；④思考胶囊 36→24px 视觉同高收敛；⑤复查锋利化：isChatSelectable GGUF+manifest 名单单规则（sd35 baked 工件收口）+ 死代码清除（engineStatus.summary/getLastExtractionCount） | CHAT_UI_SPEC §16/§17 | 真机复验 | ✅ 已完成（2026-08-19 复查闭环） |
| B19 | **DRC 远程调试（开发者预览版诊断面扩展）**：文件双通道远程调试（adb push actionId 命令 → App 白名单执行 store 动作 → results/events.jsonl/state.json 落盘取证），15 动作注册表 + 13 类事件埋点 + StateCompass 域级 STATE_MAP + CP-APP 报错指南针 + 开发机三工具；门控 __E2E__||BuildInfo.isDevSupport（release 运行时恒不激活）；Skill 化挂测试专工链路（母仓 drc-remote-debug） | DRC_SPEC SSOT（docs/DebugRemoteControl/） | tsc/jest 绿 + 真机 6 命令闭环 + e2e spec 实现 | ✅ 已完成（2026-08-19） |
| B20 | **RealESRGAN 通用图像放大 + 全屏预览交互**：独立通用放大能力（不绑定 DreamLite），双模型内置（x4plus 63MB / animevideov3 2MB）；tiled 推理引擎 + base64 桥传输 + engineMutex 互斥 + UpscalePanel 参数面板；ZoomableImage 全屏查看器（双指缩放 1-4× + 拖动 + 单击关闭 + 浅色 surface 遮罩）——3 轮真机复测闭环（Modal root / worklet 红屏 / onEnd success + Exclusive PhotoZoom 范式） | IMAGE_GEN_UPGRADE_PLAN §6.19 SSOT | tsc/eslint 0 错 + DRC 真机 5 项 + 大王终验通过 | ✅ 已完成（2026-08-20） |
| B21 | **GitHub 开源发布 + 多玩法品牌定位 + v2.0.0 自主版本机制**：①AboutScreen GitHub 入口（openSource.ts 常量 + Linking，16 语言）；②16 语言 about 文案开源定位升级 + APP_INTRO_COPY 三版式 + README 仓库首页；③git 历史重写 Hmission 身份 + master→main + 仓库创建推送；④开源边界清理（.qoder/aios/governance/lora/adr 等内部资产全历史移除 + .gitignore 收口）；⑤多玩法标语（聊天/生图/玩乐/绘本/冒险全离线）替换「部署大语言模型」旧定位，全链路同步（16 语言/README/APP_INTRO_COPY/AGENTS/PRODUCT_SPEC/GitHub description）；⑥v2.0.0 定版（1.16.1 上游遗产 → 2.0.0，versionCode 144 四处同步）+ bump-version.js 单点命令（jest 5/5）+ tag v2.0.0 | PRODUCT_SPEC §1.1/§6.1 SSOT | tsc 0 错 + jest 8/8 + l10n valid + 真机 dex 取证版本实锤 | ✅ 已完成（2026-08-19~20） |
| B22 | **上下文压缩链路根治 + 出图按钮失效修复**：①B19.1 压缩执行死锁根治（小米 13 DRC 血证）六项——水位双源校准（resolveWatermark 消费 lastCompletionResult.used 钉底）+ 生成预留（GENERATION_RESERVE=512）+ 摘要工作集预算化（tokenBudgetToMaxChars 1:1 保守折算）+ 满态显式失败（饱和跳过压缩，context-full banner 用户主权，不静默不换引擎）+ 防抢检查限定显式引擎路径（pre-send 压缩自身 inferencing=true 不被 1ms 拦死）+ createNewSession 快照重置（欠账残留不误伤新会话首条）；真机全链路证据链：send-saturated → 87% 触发 → summary-ok(342字) → context_compacted(7条) → 压缩后 5/5 轮 contextFull=false + 循环二次压缩 + footer「压缩 19」计数 UI 可见；②出图按钮 onPress 直传 async 函数致 GestureResponderEvent 污染 promptOverride → TypeError 静默吞掉（两台真机 + DRC 三重复现），修复 `onPress={() => onGenerate()}` 显式无参包装 + testID + RNTL 回归防线（fireEvent.press 显式注入 event 模拟真机） | CONTEXT_COMPACTION_SPEC v1.1 / IMAGEGEN_UI_SPEC v2.1 | tsc 0 错 + jest 52/52（全量 4498）+ 小米 13 DRC 全链路 5/5 验证 | ✅ 已完成（2026-08-20） |
| B23 | **浮层与横幅体系收敛（单一事实源）**：①§12 契约定稿；②ui/OverlayCard 弹窗底座（4 命令式弹窗 + Memory×2/ImageGen 参数/RenameModal 迁移）；③ui/BannerBar 横幅底座（BannerRow/ActiveTaskBanner/DownloadBanner 收敛，进度条三套合一）；④删除休眠组件 ui/Modal、ui/Sheet、ui/Dialog 与自建 useToast；⑤ErrorSnackbar 图标自绘化 + UpscalePanel 改 Sheet + Sheet 底色 surfaceElevated | §12 定稿 | tsc 0 错 + jest 全绿 + 真机双模式走查（弹窗/横幅/提示面零回归） | ✅ 已完成（2026-08-20） |
| B24 | **聊天卡片尾角下移 + footer 分隔线（大王裁定）**：消息卡片尾角从顶部移到底部——用户卡右下直角、回答系（正文/思考/进度卡）左下直角（Bubble·Message·ThinkingBubble·PendingIndicator 同族，roundBorder 逻辑镜像至顶部同侧角，组内最后一条形成同侧全直边）；AssistantTurnFooter 按钮栏与信息栏之间加 hairline 分隔横线（与动作槽同分隔语言） | CHAT_UI_SPEC §20.2 v4.6 | tsc 0 错 + jest 58 全绿 + 双机真机像素级验证（小米 13 行扫描：AI 卡左上圆角/左下直角、用户卡右上圆角/右下直角、思考卡左上圆角/左下直角、分割线可见；K90 大王目视确认） | ✅ 已完成（2026-08-20） |
| B25 | **模型全平台分发闭环（task-632 延续）**：①魔搭 5 仓 15.1GB（Qwen×2/MiniCPM 镜像 + DreamLite ONNX 自制套件 + 自制 LoRA，全部 206 字节精确匹配）；②HF 3 仓（QDD110 write token 网页创建存 .env：SD35-HumanPose-LoRA + DreamLite-mobile-ONNX 双平台闭环；直连限速 60kB/s 换 Clash 代理 7897 提速 6-10 倍）；③catalog 双源化——Qwen×2/MiniCPM `['hf']→['hf','modelscope']`、DreamLite `[]→['hf','modelscope']`（hfRepo QDD110 + modelscopeRepo zensignGG）、lora 进 sd35 extras（repoBySource 双源，manifest lora 字段对齐）；④baked/merged GGUF 不装机不分发（大王钦定，不建条目）；⑤SOP/MODEL_MATRIX 三方对齐（SOP #14 baked 不装机 / #11 0.6B 禁止推送；MODEL_MATRIX §6.1 补 mmproj-4B + lora 14→16）；⑥token 管道固化（MODELSCOPE_TOKEN + HF_TOKEN 存 .env，脚本自动读取，新窗口免找 token） | MODEL_MATRIX SSOT + DEVICE_DEPLOYMENT_SOP | tsc 0 错 + 全量 jest 4471（预存 invariants 失败未触碰）+ 门禁 13/13 + 远端 206 字节精确匹配（魔搭 5 仓 + HF 3 仓） | ✅ 已完成（2026-08-20~21） |
| B26 | **放大模型升级与双模型可选（A' 定稿）**：①动漫高清档换官方图片级 x4plus_anime_6B（RRDBNet-6 17MB，替换视频级 animevideov3——图片级质量实锤，单 tile ~10s 慢 4.6 倍）；②大王定夺双档可选——anime=动漫高清（RRDBNet-6）/ anime_fast=动漫快速（animevideov3 回归，快约 4 倍），SRStyle 三值 + FILES 三件套 + UpscalePanel 三选项 + actionRegistry/DRC_SPEC enum 扩展；③推理 EP 加 NNAPI（对齐 DreamLite TE 先例，8 Gen 2 回退 CPU 无副作用，K90 收益待设备验证）；④PasSR 无公开权重调查实锤（releases/HF/master 全无）放弃；⑤assets 标记 .v2→.v4 强制重复制 | IMAGE_GEN_UPGRADE_PLAN §6.20 SSOT | tsc 0 错 + 全量 jest 4471（预存 invariants 失败未触碰）+ Gradle SUCCESS + 装机 Success + DRC 全链路（anime_fast 12.0s/anime 47.3s/general 133.6s，画质取证 ch-diff 93-96 无回归） | ✅ 已完成（2026-08-21） |

**批次间依赖**：B1 前置最大（聊天域，含 §8 旧债务 4 项中的 2 项），完成后旧债务全部清零；新债务一律按本表规则补录（批次号 + 验收 + 前置），不允许无批次挂账。

## 9. 可访问性（v3 新增）

- **对比度**：正文/图标 ≥4.5:1（WCAG AA），大字/辅助文本 ≥3:1；品牌黄（#F5A623）只做强调与按钮底，不做正文色；深色模式同样校验。
- **触区**：可交互元素命中区 ≥44×44dp（视觉小于 44 的用 hitSlop 补足）；列表行高 56 已含。
- **字号**：随系统 fontScale 适配，不锁死绝对 fontSize（token 为基准，允许系统缩放）；非拉丁语言字体回退按既有 NON_LATIN_LOCALES 机制。
- **语义标签**：纯图标按钮（复制/朗读/删除等）必须提供 content-desc/accessibilityLabel；列表行组合标签（如「2026-08-15, 对话日志」）保持可读。
- **焦点/朗读**：Modal/Sheet 打开时焦点管理不跳出；长文本消息可朗读（TTS 既有）。

## 10. 文案规范（v3 新增）

- **语言**：界面文案中文为主（l10n 多语言，en 为类型基准，缺失 key 自动回退英文）；标点一律全角（中文语境）。
- **长度**：按钮 ≤6 字；chip/徽章 ≤8 字；标题 ≤12 字；辅助说明 ≤30 字（超出换行需重新措辞）。
- **错误信息结构**：发生了什么 + 用户可做什么（如「模型未加载，请初始化模型。」）；禁止裸技术报错（错误码可作辅助显示）。
- **一致性**：同一动作全 App 同一措辞（保存/再次生成/删除/加载/卸载）；新文案必须同步 `docs/APP_INTRO_COPY.md` 与 `src/locales/*.json`。
- **品牌词**：App 显示名「小黄鸡」（英文 Pocket Chick）；代码标识 name=PocketPal / applicationId=com.pocketpalai 为兼容红线不可改；关于页保留「基于 PocketPal AI（MIT License）开发」署名。

## 11. testID 登记（v3 汇总锚点）

| testID | 位置 | 状态 |
|---|---|---|
| imagegen-model-trigger / imagegen-quick-load | 生图页顶栏胶囊/加载按钮（D1） | 既有 |
| chat-model-picker-chip | 聊天页顶栏模型入口 | 既有 |
| assistant-model-badge / footer-timing / assistant-turn-footer | 助手气泡徽章/性能行/footer | 既有 |
| ui-list-item | DS ListItem 行 | 既有 |

> 新增/变更 testID 必须同步本表；testID 零变更红线不变。

## 12. 浮层与横幅契约（v3.5 新增，2026-08-20 收敛批次）

**问题**：弹窗 5 范式并存（命令式 Host 弹窗族 4 个 / 业务内嵌裸 Modal 4 处 / Paper Dialog / @gorhom Sheet / 休眠 DS 组件 3 个），遮罩 0.35/0.45/0.5/backdrop 四态、圆角 14/16/32 三态、横幅进度条三套实现、图标 emoji/vector-icons/自绘三轨——无单一事实源，新增弹窗只能复制粘贴再微调。

**规则：每种产品语义唯一载体，新增一律走底座，禁止新裸 Modal（全屏查看器豁免且需登记）。**

### 12.1 弹窗四要素（居中卡弹窗 = ui/OverlayCard 唯一底座）

| 要素 | 契约值 | 说明 |
|---|---|---|
| 遮罩 | `theme.colors.backdrop` | 禁 rgba 字面量；深浅双模式随 token |
| 卡底色 | `theme.colors.surfaceElevated` | 浮层专用（§1.5），禁 surface |
| 圆角 | `radius[shapeRoles.surface]` = xl(32) | 浮层表面角色（§4） |
| 层级 | elevation 8 | Modal/弹窗层级（§5.x） |
| 标题 | `theme.typography.titleS` + onSurface，600 | 禁字号硬编码 |
| 正文 | bodyS / onSurfaceVariant，lineHeight 20 | —— |
| 操作区 | ui/OverlayCard Actions（ui/Button 体系） | 禁手写 TouchableOpacity 按钮；destructive 语义保留 |
| 动画 | fade | 居中卡弹窗统一；底部弹出走 Sheet |

### 12.2 底部 Sheet（components/Sheet 唯一载体）

- 底色 `theme.colors.surfaceElevated`（契约化前为 background，已修正）；顶部圆角 xl + elevation 4。
- 新底部弹层一律走 components/Sheet（@gorhom），禁手写 bottom Modal（UpscalePanel 已迁移）。
- **必传 snapPoints 或 displayFullHeight**：Android 真机 enableDynamicSizing（动态尺寸）测量失败会导致 Sheet 不可见（2026-08-20 真机实证，UpscalePanel 曾缺省 snapPoints 不弹出）；现有使用点一律显式传参，新增禁止裸 `<Sheet>`。

### 12.3 横幅三要素（ui/BannerBar 唯一底座）

| 要素 | 契约值 | 说明 |
|---|---|---|
| 底色 | 语义色 12% wash：`withOpacity(语义色, 0.12)` | neutral 用 surfaceVariant；禁 withAlpha 自拼 |
| 边框 | hairline，语义色 25% | —— |
| 文本 | `theme.typography.captionM` / onSurfaceVariant | 禁 fontSize 字面量 |
| 进度条 | BannerBar 内置 Meter（4px / radius 2） | 禁第二套实现 |
| 动作 | BannerBar actions 槽（text 按钮） | —— |
| 图标 | assets/icons 自绘 | 禁 emoji 作 UI 图标 |

### 12.4 轻提示（Paper Snackbar 唯一载体）

- 操作反馈/错误提示一律 Paper Snackbar（ChatView 既有模式）；自建 Animated toast 已删除（useToast）。

### 12.5 图标铁律

- **新增 UI 一律 `src/assets/icons` 自绘**；禁 emoji 作 UI 图标（ActiveTaskBanner/IntentPicker 已清零）；新弹窗/新横幅禁 react-native-vector-icons。
- 存量 vector-icons 消费方（ChatView/ChatInput/SearchView 等 14 处）为 legacy 组件，不在弹窗/横幅收敛范围，随各自改造批次渐进迁移；本批次已迁 ErrorSnackbar。
- 新图标先查存量（alert/alert-triangle/wifi-off/shield/check-circle 等已覆盖错误/网络/认证语义）。

### 12.6 全屏查看器豁免（登记）

HtmlPreviewBubble / ResultPreview / TextMessage 图片全屏 / ZoomableImage：手势与业务差异大，不强行统一组件，但遮罩与关闭图标必须走 token。现状登记（B23 已收敛）：

| 查看器 | 遮罩 | 关闭 |
|---|---|---|
| HtmlPreviewBubble | 整页无遮罩 | CloseIcon + onSurface（既有） |
| TextMessage 图片全屏 | backdrop | XIcon + 深遮罩恒定白前景 |
| ZoomableImage（生图全屏） | surface+94%（浅色遮罩，B20 产品决策） | 单击关闭手势 |
| ResultPreview 编辑按钮 | surfaceElevated 浅色面 | —— |

新增全屏查看器须在此登记。

## 变更日志

| 日期 | 版本 | 变更 |
|------|------|------|
| 2026-08-21 | 3.9 | Gap Ledger 补 B26（放大模型升级与双模型可选，A' 定稿）：anime 高清档换 x4plus_anime_6B（RRDBNet-6 图片级）+ anime_fast 快速档回归（双档可选）+ NNAPI EP + PasSR 不可得实锤；relates 挂 IMAGE_GEN_UPGRADE_PLAN §6.20 |
| 2026-08-20 | 3.7 | Gap Ledger 补 B24（聊天卡片尾角下移 + footer 分隔线，大王裁定）：用户右下直角 / 回答系左下直角（Bubble·Message·ThinkingBubble·PendingIndicator 同族）+ AssistantTurnFooter 按钮栏与信息栏 hairline 分隔；relates 挂 CHAT_UI_SPEC §20.2 v4.6 |
| 2026-08-20 | 3.6 | Gap Ledger B22 修订：B19.1 六项根治（补防抢检查限定显式引擎路径 + createNewSession 快照重置）+ 小米 13 DRC 全链路证据链（87% 触发 → summary-ok 342字 → context_compacted 7条 → 5/5 轮 contextFull=false + 压缩19计数） |
| 2026-08-20 | 3.5 | B23（浮层与横幅体系收敛）：§12 浮层与横幅契约定稿（弹窗四要素/横幅三要素/图标铁律/全屏豁免）；ui/OverlayCard + ui/BannerBar 唯一底座；删除休眠组件 ui/Modal、ui/Sheet、ui/Dialog；轻提示归一 Paper Snackbar |
| 2026-08-20 | 3.2 | Gap Ledger 补 B20（RealESRGAN 通用图像放大 + 全屏预览交互）；relates 挂 IMAGE_GEN_UPGRADE_PLAN §6.19 |
| 2026-08-19 | 3.1 | Gap Ledger 补 B19（DRC 远程调试，诊断面扩展）；relates 挂 DRC_SPEC；关联文档补 DebugRemoteControl |
| 2026-08-14 | 2.0 | Phase 2 规范治理：形状角色表 + 60-30-10 色彩应用 + 子页模板 + 动效目录 |
| 2026-08-15 | 3.0 | 全面治理：补齐间距栅格/阴影层级/组件状态/中性色分层/可访问性/文案六维度；债务全部进入治理批次（Gap Ledger）；升格为 UI 域 SSOT（frontmatter 规范） |

## 关联文档

- [聊天页 UI 规范](./POCKETPAL_CHAT_UI_SPEC.md)（spec）
- [生图页 UI 规范](./POCKETPAL_IMAGEGEN_UI_SPEC.md)（spec）
- [全局交互定稿](./POCKETPAL_UI_INTERACTION_SPEC.md)（spec）
- [图标规范](./POCKETPAL_ICON_SPEC.md)（spec）
- [远程调试协议 DRC_SPEC](./DebugRemoteControl/DRC_SPEC.md)（spec，B19）
- [App 侧指南针注册表 COMPASS_REGISTRY](./DebugRemoteControl/COMPASS_REGISTRY.md)（registry，B19）
- [RealESRGAN 图像放大计划](./POCKETPAL_IMAGE_GEN_UPGRADE_PLAN.md)（spec，§6.19 B20）
- [ADR-0001 UI 规范单源](./adr/ADR-0001-ui-ssot-single-source.md)（adr）
- [ADR-0002 生图顶栏重构](./adr/ADR-0002-imagegen-header-right.md)（adr）
- [ADR-0003 气泡一体化](./adr/ADR-0003-bubble-footer-unification.md)（adr）
- [UI 五关门禁执行手册](./sop/UI_GATE_VERIFICATION_SOP.md)（sop）
- [文档治理总规范](./DOC_GOVERNANCE_SPEC.md)（root）
- [文档索引](./INDEX.md)（root）
