---
doc_id: ADR-0002-imagegen-header-right
module: adr
type: adr
status: accepted
version: "1.0"
created: "2026-08-15"
updated: "2026-08-15"
relates: [POCKETPAL_IMAGEGEN_UI_SPEC, POCKETPAL_DESIGN_SPEC]
---

<!-- D-FORMAT:v3 -->

# ADR-0002 生图页模型选择器挂载 AppBar headerRight（D1 顶栏重构）

- 状态：Accepted（已落地）
- 日期：2026-08-15
- 决策人：大王 / 女妖
- 相关：`src/screens/ImageGenScreen/components/ModelPickerPanel.tsx`、`ImageGenScreen.tsx`、Phase 2 D1

## 背景

生图页原顶部模型胶囊占据内容区第一行（约 56dp 垂直空间），导致：
- 图片预览区被压低，**首屏看不到「出图」按钮**，用户需上滑翻页。
- 顶部胶囊与预览区之间无信息层次。

## 决策

1. **拆分 ModelPickerPanel** 为 `ModelPickerTrigger`（紧凑胶囊：域彩 12% 底 + 模型名 + ▾ 箭头 + 未加载时「加载」快捷按钮）与 `ModelPickerDropdown`（屏级悬浮下拉）。
2. **Trigger 挂载到 AppBar headerRight**（`navigation.setOptions({headerRight})`），回收内容区顶部垂直空间。
3. **Dropdown 用 absoluteFill 屏级 overlay**：屏幕根 View 位于 AppBar 之下，天然只盖内容区（不遮顶栏），点外收起；移除 overlayTop 属性（修复 dp/px 单位混用 bug）。
4. 预览区顶到 AppBar 下沿 → **首屏可见 保存/再次生成/删除 + 出图 按钮**。
5. 推理链路代码零触碰；testID 零变更。

## 备选方案

| 方案 | 结论 |
| --- | --- |
| 胶囊留在内容区（原状） | 首屏看不到出图按钮，需翻页；弃 |
| 胶囊做成浮动 FAB | 与卡片语言冲突，遮挡内容；弃 |
| 下拉挂 Modal 层 | 遮顶栏、与抽屉交互冲突；弃（屏级 absoluteFill 更简单） |

## 影响

- 文件：ModelPickerPanel.tsx（拆分）、ImageGenScreen.tsx（setOptions + 编排）、styles.ts（trigger 样式 + dropPanelAbs top:6）、Panels.test.tsx。
- 交互：触发胶囊点按展开下拉，scrim 只盖内容区；加载按钮仅未加载时显示。
- 已知衍生问题：trigger 组贴 AppBar 右缘（加载按钮 bounds 右缘=1080 贴边）→ 已登记 DESIGN_SPEC §8 Gap Ledger B5 批次。

## 验证

- tsc 0 / Panels 14 tests 绿 / Gradle 构建成功 / 真机浅深双模式：胶囊+加载按钮在顶栏右侧、预览顶到顶栏、首屏出图按钮可见、下拉面板 3 模型正常。
