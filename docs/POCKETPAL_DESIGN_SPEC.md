# PocketPal 设计语言总纲（DESIGN_SPEC）——「暖巢 WarmNest」

> 单一事实源：全 App 色彩 / 排版 / 图标 / 形状材质 / 动效 / 性能预算六大维度的定稿。
> 任何 UI 视觉迭代必须先更新本文档再改代码。版本：v1（2026-08-15，UI 统一+设计语言升级方案 v3 获批）
> 并列文档：POCKETPAL_CHAT_UI_SPEC.md（聊天页）/ POCKETPAL_IMAGEGEN_UI_SPEC.md（生图页）/ POCKETPAL_UI_INTERACTION_SPEC.md（全局交互）
> 代码落点：`src/theme/tokens/`（token 单一事实源）+ `src/components/ui/`（DS 组件）

## 0. 设计原则

**品牌暖黄为魂、功能域彩色为脉、大圆角卡片为体、克制弹簧为动、性能预算为门。**

行业对标（2025-2026）：Apple Liquid Glass（层次感）、HyperOS 3/4 超拟圆与柔光玻璃（大圆角+克制半透明）、HarmonyOS NEXT 和谐美学（一域一色+错峰入场）、M3 Expressive（字号字重对比+弹簧）。共同取舍：**视觉升级必须捆绑性能工程**；Android 端不做真模糊（blur），用半透明+阴影分层替代。

产品红线（不可违背）：
- 不兜底、不补丁：不做降级开关、不加 if 分支兼容旧视觉；token 一步到位。
- UI 为推理让路：内存账本被模型占据（文本槽 ~3GB + 生图槽 ~3.5GB），UI 层每帧 JS 开销必须可忽略。
- testID 零变更；三份既有交互 SPEC 定稿不推翻；零新依赖。

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

## 3. 图标体系（IconTile，文本裸露治理核心）

- 组件 `ui/IconTile`：40x40 圆角容器（radius.m=12，域色 12% 透明底）+ 22px Lucide 线条 icon（域色）。
- 应用位置：设置页全部条目、AIOS 四屏列表行、抽屉底部设置入口。
- 列表行结构（三段式）：IconTile + (标题 bodyM / onSurface + 辅助说明 captionM / onSurfaceVariant) + chevron-right（onSurfaceVariant）。分组用 Surface 卡片包裹（radius.l=20）+ 分组标题 captionM/onSurfaceVariant。
- 触区 44 不变；图标资产沿用 `src/assets/icons/` Lucide 族，不引入 icon-font。

## 4. 形状与材质

- radius 新增 `full`(999)（胶囊）；既有档位（xxs~xxl）不变。卡片=radius.l(20)、小元素=radius.m(12)、胶囊按钮/徽章=full。
- 光影分层（HarmonyOS 材质层思路）：卡片 surface + Android elevation 2（列表卡）/ 4（悬浮层）；悬浮面板 surfaceElevated + elevation 4 + scrim。**零 blur、零新依赖**。
- ConfirmDialog / Sheet / 模型胶囊统一走 surfaceElevated + 大圆角。

## 5. 动效体系（铁律内克制版）

| 动效 | 实现 | 生命周期 | 红线 |
|---|---|---|---|
| 按压反馈 | `ui/PressableScale`：Animated.spring scale 0.97→1 | 按压瞬间（一次性） | JS driver |
| 列表错峰入场 | 行级 opacity+translateY(8) stagger 30ms | 仅首屏一次性 | 不循环、不重复触发 |
| 三点波浪/呼吸 | 既有 useWaveDots | 生成期间 | 已定稿（IMAGEGEN_UI_SPEC） |
| chevron 旋转 | 既有 | 展开瞬间 | 已有 |

铁律：`Animated.loop` 一律 useNativeDriver:false（07a47ed 收口）；一次性短动画允许 native；不引入 Lottie/reanimated 新用法。

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

## 8. 已登记债务（锋利原则：要么完整做，要么登记，不拆半成品）

- **legacy fonts 双轨（部分收口）**：`fontStyles` 导出已删除、ChatInput 迁移到
  `FONT_FAMILIES`（B6 双轨收口第一步，零视觉回归，jest 覆盖）。剩余双轨为
  utils/theme.ts MD3 `fonts` 块/自定义 TextStyle vs `theme.typography.*`：
  消费者含聊天定稿消息样式（TextMessage 的 sentMessageBodyTextStyle 族、
  ChatInput inputTextStyle）——安全删除需先对聊天视觉再定稿（CHAT_UI_SPEC v2）。
  前置条件：聊天消息排版重定稿 + 值映射表验证零回归。
- **生图页 styles.ts 散点数字字号**（12/13/11 等）未 token 化：
  IMAGEGEN_UI_SPEC 已定稿，排版升级需随生图页下一波视觉迭代同改。
- **媒体覆盖层保留黑底白字**（ImageGen styles 的 toastBar/fullscreen/historySel）：
  黑底上的白字属媒体覆盖语义，非主题表面，豁免硬编码禁令并在代码内注释说明。
