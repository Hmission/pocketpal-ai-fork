# PocketPal 聊天页 UI 设计规范（CHAT_UI_SPEC）

> 单一事实源：聊天页/抽屉的配色层次、卡片结构、菜单弹出规范与文本可读性定稿。
> 任何聊天页 UI 迭代必须先更新本文档再改代码。版本：v1（2026-08-14，聊天页+抽屉重设计定稿）
> 并列文档：POCKETPAL_IMAGEGEN_UI_SPEC.md（生图页）/ POCKETPAL_UI_INTERACTION_SPEC.md（全局交互）

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

## 8. 模型选择器过滤规则（2026-08-14）

- 聊天模型选择（ChatPalModelPickerSheet 模型 tab / 长按换模型子菜单）只显示**可聊天的 LLM**：
  `modelType === LLM` **且** 文件名不在 `IMAGE_GEN_MODEL_FILES`（imageGenManifest 导出的生图文件集合）。
- 生图模型（SD3.5 / Z-Image / DreamLite 等 manifest 文件）**永不出现**在聊天选择列表；
  生图模型入口固定在生图页模型下拉（manifest 驱动）。
- 扫描注册层同步隔离：`scanLocalModels` 不把生图文件注册为 LLM（新装机干净），
  `isChatSelectable` 兜底存量数据（DB/预设已注册残留）。
- 若新增生图模型，必须把其 main + companions 文件名加入 `BUILTIN_MANIFESTS`（自动进入过滤集），
  设备端 `*.manifest.json` 扩展模型的过滤待动态化（当前无设备端扩展）。
