---
doc_id: POCKETPAL_IMAGEGEN_UI_SPEC
module: root
type: spec
status: active
version: "2.1"
created: "2026-08-14"
updated: "2026-08-20"
relates: [POCKETPAL_DESIGN_SPEC, ADR-0002-imagegen-header-right]
---

<!-- D-FORMAT:v3 -->

# PocketPal 生图页 UI 设计规范（IMAGEGEN_UI_SPEC）

> 单一事实源：生图页（ImageGenScreen）的布局、按钮组成、状态机视觉与交互定稿。
> 任何生图页 UI 迭代必须先更新本文档再改代码，杜绝「改过没记录」。
> 版本：v1（2026-08-14，W3 定稿）| 代码实现：src/screens/ImageGenScreen/
> 版本：v2（2026-08-15，B2 批次：散点字号/圆角 token 化，styles.ts 字面量清零）
> 版本：v2.1（2026-08-15，预览卡信息条定稿：seed 行从卡片下方移除，改为预览图顶部 overlay「模型 · 耗时 · 分辨率」；顶栏右缘对齐内容区右边距）
> 版本：v3（2026-08-18，开发者预览版：生成任务化——每次生成/编辑 = 一个持久化任务（running/success/failed 三态预览页）；报错唯一出口 = 预览区 failed 任务页（一键复制完整报错）；顶栏胶囊加 primary 描边）
> 版本：v3.1（2026-08-18 真机二轮：顶栏胶囊底色统一为 primary 12%（与聊天页胶囊同设计语言，替代旧 domain.imageGen 粉底））
> 上位规范：POCKETPAL_DESIGN_SPEC.md（UI 域 SSOT）

## 1. 页面结构（单列三区 + 顶部模型胶囊）

```
┌───────────────────────────────┐
│ 模型状态胶囊（ModelPickerPanel）│ ← 点文本区展开悬浮下拉；未加载时右侧有「加载」快速按钮
├───────────────────────────────┤
│ ① 结果区（ResultPreview）      │ ← 横向分页：[0页编辑槽] + 任务页（running/success/failed 三态）
│   操作条：保存 / 再次生成 / 删除 │ ← 定稿三按钮（仅成功图；编辑不在此处）
│   参数水印                     │
├───────────────────────────────┤
│ ② 相册（HistoryStrip）         │ ← 横向缩略图 + 上传 + [管理]多选删除
├───────────────────────────────┤
│ ③ 创作区（ComposerPanel）      │ ← 提示词（≤120字）+ 折叠高级参数 + 底部按钮
│   底部按钮：DreamLite=[编辑][出图]；通用SD=[出图]
└───────────────────────────────┘
```

## 2. 按钮组成定稿

### 结果区操作条（三按钮，不多不少）
| 按钮 | 语义色 | 动作 |
|---|---|---|
| 保存 | 绿 #2e7d32 | 存入系统相册 Pictures/AIOS |
| 再次生成 | 橙 #ef6c00 | 同参数重跑 |
| 删除 | 红 #c62828 | 删除当前图 |

**编辑按钮不在操作条**——编辑唯一入口 = 创作区底部「编辑」按钮（DreamLite 族），避免双入口心智分裂。

### 模型胶囊
- 视觉：primary 12% 底 + primary 1px 描边（与聊天顶栏胶囊同一设计语言，v3.1）
- 文本区（点击）：展开悬浮下拉（盖住下方内容，点外收起）
- 快速加载按钮：仅「未加载 且 不在加载中」时显示，直接加载当前选中模型，不展开下拉
- 状态文案：未加载 / 加载中… / 已就绪

### 出图按钮显式反馈（复查 2026-08-20 真机回归定稿）
- **空提示词点「出图」必须显式 toast 提示**（「先输入提示词，再点出图」），不得静默无反应——此前 `if (!p) return` 静默早退导致「有动效无反应」，两台真机稳定复现；显式失败不静默（锋利原则）
- **onPress 必须显式无参包装**：`onPress={() => onGenerate()}`，禁止 `onPress={onGenerate}` 直传 async 函数——RN 必传 GestureResponderEvent 作为首参，直传导致 `handleGenerate(event)` 入口 `(event ?? prompt).trim()` 抛 TypeError 被 Bridgeless 事件系统静默吞掉（2026-08-20 两台真机 + DRC 三重复现，回归引入点 commit 44689f8 加 promptOverride 参数）
- **「再次生成」= 当前图同参数重跑**：用任务自带 prompt（与失败页「重试」同源 `handleGenerate(item.prompt)`），不读当前输入框——输入框被清空/编辑预备态清 prompt 后再次生成仍有效

## 3. 模型下拉规则

- **DreamLite 固定置顶且默认选中**（当前唯一完整可用：4 步 1024px 约 25s）
- 实验性模型（SD3.5 / Z-Image-Turbo）排在 DreamLite 之后，带琥珀色「[实验性]」徽章
- 行内按钮：加载（主色实底）/ 卸载（红描边，二次确认）
- 族徽章彩色：SD3.5 紫 #8e24aa / Z-Image 青 #00838f / DreamLite 粉 #d81b60
- 选中行仅高亮回填参数，不自动加载（点「加载」按钮才加载）

## 4. 生成/编辑状态机视觉（v3 任务化）

每次生成/编辑 = 一个持久化任务（taskId 单一 key，AsyncStorage 落盘，重启后失败任务仍在）：

- **点出图**：先落 `status:'running'` 任务条目并翻到该页 → **空白预览页 + 进度卡**（不再叠在旧图上）；成功 `finishTask` 回填图，失败 `failTask` 回填报错，页面保留。
- **编辑中**（taskKind=edit）：动效仍低不透明度叠在当前图（底图可见）；running 条目在翻页可见时同规格进度卡。
- **failed 任务页**：⚠ 图标 + 「生成失败」+ 一句话摘要（numberOfLines 3）+ 「复制报错信息 / 重试 / 删除」三按钮；复制 = errorReport 完整报告（剪贴板 + AIOS/logs 落盘）；重试 = 回填参数后同提示词重新发起。
- **报错唯一出口**：预览区 failed 任务页；composer 底部不再展示错误文本；加载失败/缺伴侣文件/解码失败同样落 failed 任务条目。
- **历史横条**：只列 success 条目缩略图（保留原始索引供翻页定位）。
- **overlay 设计语言**：浅色圆角（助手气泡点缀色 + 高不透明度，borderRadius 8 与卡片统一；深浅色模式自适应），禁用黑色直角矩形
- **进度指示**：三点波浪呼吸动效（错峰 150ms，纯 Animated + useNativeDriver），禁用圆形 orb 缩放
- 进度信息：采样 x/y + 步耗时 + 累计秒数 + 当前阶段文本

## 5. 编辑模式（DreamLite 专属）

- 入口：创作区底部「编辑」按钮（预备→执行单按钮两态）
- 预览区 0 页 = 编辑槽（上传大按钮 / 已上传图 + 重新上传）
- 流程：锁定当前预览图 → 输入编辑指令 → 执行编辑 → 新图入历史并翻页
- 上传图按较大边压缩至画幅短边（官方画幅七档见 constants.ts RATIOS）

## 6. 约束（实现红线）

- Screen 层零直连 dreamLiteEngine，全部经 imageGenStore 单通道
- 提示词限长 ≤120 字（端侧约束，超限红色警告但可提交）
- 所有色值走 theme token 或本规范登记的语义色，新增色必须登记本文档
- testID 稳定：imagegen-quick-load（快速加载）等，e2e 依赖不变
