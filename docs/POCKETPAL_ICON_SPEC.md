---
doc_id: POCKETPAL_ICON_SPEC
module: root
type: spec
status: active
version: '1.0'
created: '2026-08-14'
updated: '2026-08-25'
relates: [POCKETPAL_DESIGN_SPEC]
---

<!-- D-FORMAT:v3 -->

# POCKETPAL 图标规范（单一事实源）

> 最后更新：2026-08-25 · WorkshopIcon v5.4 意象更新

## 一、规范

所有 `src/assets/icons/*.svg` 必须满足：

1. **画布**：`width="24" height="24" viewBox="0 0 24 24"`
2. **线宽**：stroke 型图标 `stroke-width="2"`
3. **渲染模式**：纯 stroke 单色（禁止 fill 固定色 + stroke 双描边叠加）
4. **颜色**：文件内默认 `#333333` 或 `currentColor`；RN 使用处通过 `stroke=` prop 覆盖

例外（仅这些允许偏离第 3 条）：

- `-sm/-md/-lg` 尺寸变体与彩色 logo（如 `google.svg`）：fill 型，保持填充风格
- `clipPath` 内部 `fill="white"` 属 mask 定义，不违规

## 二、问题背景

归一化前图标库规格漂移：

- 上游图标多为 20×20 viewBox（默认渲染 20px），二开新增多为 24×24（默认 24px）→ 同一 `List.Icon` 容器内大小不一
- `edit-box.svg` 存在 fill+stroke 双描边（#858585 叠加）→ 线条显粗
- `chevron-up.svg` 21vb、`menu.svg` sw 1.5 等个别漂移

## 三、工具

- 归一化：`python scripts/normalize_icons.py [--dry-run]`
  - viewBox 非 24 → 包裹 `scale(k)` 几何缩放（不重绘路径）
  - stroke 型 sw 统一 2；`edit-box` 特判删 fill 层
- 校验（防回归）：`python scripts/check_icons.py`，违规 exit 1
- 新增图标后必须跑校验；批量修改用归一化脚本

## 四、使用约定

- 组件内一律显式传 `width`/`height`（如 16/18/20），或依赖 SVG 默认 24
- 颜色必须传 `stroke={theme.colors.xxx}`（fill 型传 `fill=`）
- 新增图标若为 stroke 型，直接按 24×24 + sw 2 绘制，零缩放

### 4.1 同栏图标**视觉重量**对齐（2026-09-06 大王报障补，MASTER_LOG §157）

资产合规（24×24 / sw2 / 纯 stroke）**不等于**并排观感统一。封闭轮廓类图标
（`phone` / `mic` 这类围合成面的形状）在相同渲染尺寸下，墨迹会填满整个
viewBox 框；而开放线条类图标（`plus` 两笔、`dots-vertical` 三点）墨迹只占框的一部分。
真机像素实测（1200px / 密度 2.75）：同传 `iconSize.m`(20) 时，phone 墨迹 55px=20dp，
plus 墨迹仅 42px=15.3dp——**同尺寸不同重量**。

- 处置：按**墨迹视觉宽度**而非名义尺寸选 token。封闭轮廓图标与开放线条图标同栏时，
  封闭者降一档（如 `m`(20)→`s`(16)），不重绘资产、不改 stroke-width（那会违反第一条）。
- 间距同理：图标插在已校准的容器前，会叠加两侧触区居中留白。补偿沿用既有同族手法
  （`HeaderRight.styles.compactBtnLeft` 的负 margin），**不另造一套间距体系**；
  取值必须经真机截图像素复量迭代，不得推算（本节数据即两轮迭代得出：-6 不足、-11 等距）。
- 反白图标（`onPrimary`/`onError`）只适用于**实心**底衬；底衬改为域彩淡底+描边时，
  图标必须同时改回域彩本色，否则淡底上看不清。

## 五、WorkshopIcon（创造工坊入口，2026-08-22 登记，v5.4 意象更新）

- 用途：抽屉「创造工坊」入口图标（替代原画图 CameraIcon）
- 意象：**魔法棒 + 星芒**（v5.4 大王裁定：扳手工具语义与创造工坊「创作生成」语义错位，换 AI 创作语义；魔法棒沿主对角线、右上主四芒星 + 左上十字火花 + 右下圆点火花三点围合）
- 规格：SVG stroke 语义色 primary，20×20（与「+ 新对话」PlusIcon 22 对齐）；全描边 2px 同族（round cap/join）
- 归属：assets/icons 自绘体系，命名 WorkshopIcon
- 演进：画笔+音符（v5.2）→ 画笔×扳手（v5.3 工具工坊语义）→ 魔法棒+星芒（v5.4 AI 创作语义）
