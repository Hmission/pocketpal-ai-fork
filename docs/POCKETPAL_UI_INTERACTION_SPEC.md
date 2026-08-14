# PocketPal 全局交互定稿规范（UI_INTERACTION_SPEC）

> 单一事实源：抽屉/导航层级/弹窗体系/消息长按菜单的交互定稿。
> 任何交互迭代必须先更新本文档再改代码。版本：v1（2026-08-14，11 项 UI 优化定稿）
> 并列文档：POCKETPAL_IMAGEGEN_UI_SPEC.md（生图页）

## 1. 抽屉（会话中心，唯一主入口）

```
┌ 搜索对话（session-search-input）
├ [+ 新对话]          [📷 生图]   ← 双按钮行：new-chat-button + drawer-imagegen-button
├ 会话列表（日期分组）
│   每行：标题 + 常驻 ... 按钮（session-more-{id}）
│   ... / 长按 → 同一菜单：重命名 / 基于此会话新建 / 导出 / 删除 / 选择
└ 底部固定：齿轮 + 设置（drawer-item-settings）
```

- 抽屉只承载会话能力，不放功能导航（功能入口全在设置页入口中心）
- ... 菜单与长按菜单单一事实源（SessionListItem 内同一 Menu）
- 「基于此会话新建」= duplicateSession（复制消息与设置，新会话自动激活并进入聊天页）
- 触区规范：... 按钮 40x40 + hitSlop，生图按钮 44x44

## 2. 导航层级（三级后退）

- 一级：聊天页（根级，headerShown:false）
- 二级：设置页入口中心（从抽屉底部齿轮进入）
- 三级：具体设置项（生成设置等，GENERATION_SETTINGS 路由）
- **HeaderLeft 规则**：`state.index > 0 且当前非聊天根级` → 后退箭头（goBack）；否则汉堡（openDrawer）
- testID：header-back-button（后退）/ menu-button（汉堡）

## 3. 弹窗体系（统一设计语言）

### 确认弹窗（ConfirmDialog，替代系统 Alert 确认框）
- 组件：`src/components/ui/ConfirmDialog.tsx`（App 根挂载 ConfirmDialogHost）
- API：`const ok = await confirmDialog({title, message, confirmText?, cancelText?, destructive?})`
- 视觉：居中卡片（surface 底色、圆角 12、padding 20）；按钮高 44；
  destructive 确认按钮=警示红，普通=主色；点遮罩/返回键=取消
- Host 未挂载时返回 false（fail-fast，破坏性操作不执行）
- **已替换路径**：会话删除/批量删除（抽屉）、会话删除（HeaderRight）、
  模型卸载（生图页）、模型删除/projection 删除/移除/远程模型删除（ModelCard）
- **分批清单（暂留系统 Alert）**：信息型单按钮弹窗（权限提示、错误通知、导入成功等）
  ——ChatInput/HeaderRight 信息提示/ModelsScreen 下载提示/AboutScreen 等约 20 文件

### 底部弹层（Sheet）
- 模型选择/生成设置等既有 BottomSheet 体系不变（已统一）

## 4. 聊天页交互

### 模型选择弹窗（ChatPalModelPickerSheet）
- **仅显示 LLM**（isChatSelectable 过滤，projection/vision 嵌入模型不显示）
- **中文简称**（modelDisplayNames 注册表）：命中→简称主标题+原名小字副标题；
  未命中→回落去量化后缀族名。注册表为弹窗/换模型子菜单共用单一事实源

### 消息气泡
- 助手气泡：语义点缀色（assistantBubbleBackground token，深浅双模式低饱和暖蓝）
- 用户气泡：authorBubbleBackground
- 文本左右缩进：助手与用户同规格（messageInsetsHorizontal ≈2 字符当量），不贴气泡边缘

### 长按消息菜单（定稿）
| 消息类型 | 菜单项 |
|---|---|
| 助手消息 | 复制 / 重新生成 / 换模型重新生成 / 从此处删除 / 报告内容 |
| 用户消息 | 复制 / 编辑 / 从此处删除 |

- 「从此处删除」= 移除该条及其后所有消息（二次确认，ConfirmDialog）
- 朗读（TTS 全文）：登记为 TTS 专项（当前 TTS 仅流式 auto-speak，无全文朗读 API）

### LLM 就绪等待（engineReady）
- 发送门控：engineIsBusy（inferencing/isStreaming/isGenerating/isStopping）时
  轮询等待（200ms，超时 8s）；等待中显示「模型准备中，请稍候…」横幅；
  超时系统消息「模型繁忙，请稍后重试」。无静默重试

## 5. 全局 testID 登记表（e2e 依赖）

| testID | 位置 |
|---|---|
| session-search-input / new-chat-button | 抽屉顶部 |
| drawer-imagegen-button | 抽屉新对话行右侧 |
| session-more-{id} | 会话行 ... 按钮 |
| drawer-item-settings | 抽屉底部设置 |
| header-back-button / menu-button | HeaderLeft |
| imagegen-quick-load | 生图页模型胶囊快速加载 |
| confirm-dialog-confirm / confirm-dialog-cancel | 全局确认弹窗 |
| imagegen-button | 聊天头部生图入口（既有） |

## 6. 遗留债务（待后续迭代）

- 信息型弹窗（约 20 文件）统一为 InfoDialog 体系（分批替换清单见 §3）
- ChatScreen.test/useChatSession.test 既有失败与新架构对齐专项
- TTS 全文朗读 API + 长按菜单朗读项
- GenerationSettingsScreen 1321 行等肥文件瘦身
