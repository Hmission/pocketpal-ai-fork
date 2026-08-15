# POCKETPAL 图标规范（单一事实源）

> 最后更新：2026-08-14 · 全库归一化落盘

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
