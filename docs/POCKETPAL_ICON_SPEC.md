---
doc_id: POCKETPAL_ICON_SPEC
module: root
type: spec
status: active
version: '1.1'
created: '2026-08-14'
updated: '2026-09-07'
relates: [POCKETPAL_DESIGN_SPEC]
---

<!-- D-FORMAT:v3 -->

# POCKETPAL 图标规范（单一事实源）

> 最后更新：2026-09-07 · v1.1 上色口径根治（大王报「电话图标不镂空」，真因见 §4.2；v1.0 曾把该现象误判为视觉重量）

## 一、规范

所有 `src/assets/icons/*.svg` 必须满足：

1. **画布**：`width="24" height="24" viewBox="0 0 24 24"`
2. **线宽**：stroke 型图标 `stroke-width="2"`
3. **渲染模式**：纯 stroke 单色（禁止 fill 固定色 + stroke 双描边叠加）
4. **颜色（v1.1 收紧）**：描边色一律写 `#333333`，RN 使用处通过 `stroke=` prop 上色；
   **禁止 `stroke="currentColor"`**——`.svgrrc` 的 `replaceAttrValues` 只认颜色字面量，
   写 currentColor 的资产拿不到调用侧颜色（元素自身属性还会覆盖继承），等于开了
   **第二套上色机制**。旧 `speaker` / `volume-off` / `volume-on` / `waves` 4 件即此：
   调用侧传 `stroke=` 完全无效、描边恒黑，暗色模式下几乎不可见（已于 W7 归一）。
5. **描边型资产必须自带 `fill="none"`**（v1.1 加，2026-09-07）：每个可绘制元素
   （`path`/`circle`/`rect`/…）都要显式声明 `fill="none"`。因为 svgr 把调用侧 props
   展在 root 且**覆盖资产自带的** `fill="none"`（机制详 §4.2），元素若不显式自证，
   就会继承泄漏进来的 fill 而被**填成实心块**——大王报的「电话图标不镂空」即此。
   例外：dual-use 资产（见 §4.3）按其语义保留可填充。

例外（仅这些允许偏离第 3 条）：

- `-sm/-md/-lg` 尺寸变体与彩色 logo（如 `google.svg`）：fill 型，保持填充风格
- `clipPath` 内部 `fill="white"` 属 mask 定义，不违规
- **挂账（本轮发现未修，非本波范围）**：`copy` / `duplicate` / `settings` / `edit-box` 四件的
  `fill="white"` 遮罩层并**不在** `clipPath` 内，而是直接可见的前后景分隔层——写死白色在
  暗色模式下会露白块。现无闸拦它（`check_icons.py` 的双描边正则只匹 `#hex`），属
  「条文说的例外比实际窄 + 暗色适配」两宗债，需单独裁定（要么改成主题 token 背景色，
  要么重绘为真 mask），**不得顺手改**（会改变四个图标观感）。

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

- 组件内一律显式传 `width`/`height`（取 `theme.iconSize.*`，不写裸数字，见 DESIGN_SPEC B10），或依赖 SVG 默认 24
- **上色口径硬规（v1.1，与 DESIGN_SPEC §3 传参红线同一套，不再两卷互斥）**：
  - **描边（stroke）型资产**：只传 `stroke={theme.colors.xxx}`，**禁止单独传 `fill=`**
    ——传 fill 不会“换个位置上色”，而是把封闭轮廓**填实**（机制见 §4.2）。
  - **面性（fill）型资产**（`-sm/-md/-lg` 变体、彩色 logo）：只传 `fill=`。
  - **dual-use 资产**（同一图标既有描边态又有实心态，如 `star` 评分）：必须 `stroke=` 与
    `fill=` **同传**并在调用处注明“实心语义”，否则按上一条只能描边。
  - 新增图标若为 stroke 型，直接按 24×24 + sw 2 绘制 + 每元素 `fill="none"`，零缩放。
- 本仓全量实测基线（v1.1 登记）：144 资产 = 67 描边型 + 76 面性型 + 1 待定性；
  调用侧 143 处已走 `stroke=`（正确），11 处 `fill=` 已于本波收口（见 §4.4）。

### 4.1 同栏图标**视觉重量**对齐（v1.1 修订：原「封闭轮廓降一档」口径作废）

本节原为 2026-09-06 大王报障（「电话钮面积较大」，MASTER_LOG §157）所补，当时结论是
“资产合规但封闭轮廓墨迹满框，因此同栏时降一档尺寸（`m`(20)→`s`(16)）”。

- **该结论已推翻**：事后的真机报障与本轮实测证实，当时看到的“满框大”不是轮廓封闭造成的，
  而是该图标被 `fill=` **填成了实心块**（开放线条图标填不出面积，故只有它显重）。
  拿降尺寸去盖住一个调用错误，属**补丁**；把补丁写成通则，会诱导下一个人在新位置重复犯错。
- 保留的本节正确部分：
  - **间距**：图标插在已校准的容器前会叠加两侧触区居中留白；补偿沿用既有同族手法
    （`HeaderRight.styles.compactBtnLeft` 负 margin），**不另造一套间距体系**；
    取值必须经真机截图像素复量迭代，不得推算（-6 不足、-11 等距即两轮量出）。
  - **反白**：`onPrimary`/`onError` 反白图标只适用于**实心**底衬；底衬改为域彩淡底+描边时，
    图标必须同时改回域彩本色，否则淡底上看不清。
- **尺寸现状**：`ChatHeader` 电话钮暂保留 `iconSize.s`(16)，但性质已从「规则」降为
  **待复量值**（填实消除后重量需重新量）；禁止引用本旧数据作为新图标的选型依据（W7-V 装机窗定档）。

### 4.2 上色机制（实测，不是推演）

探针：`.tmp/probe_svgr_output_162.js`（配置逐字对齐 `react-native-svg-transformer@1.5.1`
的 `defaultSVGRConfig`）。以 `phone.svg` 为例，实际产物：

```jsx
<Svg xmlns fill="none" viewBox="0 0 24 24" {...props}>
  <Path stroke={props.fill} strokeWidth={2} d="…" />   {/* 无 fill 声明 → 继承 */}
</Svg>
```

三条后果：

1. `.svgrrc` 的 `replaceAttrValues` **不分属性**：颜色字面量无论长在 `fill` 还是 `stroke` 上，
   都被换成 `{props.fill}` → 描边型资产的**描边色由 `fill` 驱动**（名实错位）。
2. `{...props}` 展在 root 且**在资产自带 `fill="none"` 之后** → 调用侧传 `fill` 会覆盖它，
   而被描边元素继承 → **封闭轮廓被填实**（大王报障真因）。
3. 只传 `color=` 确实无效（描边取不到值且无默认 stroke → 不可见）；但由它推出
   「只能传 fill」是错的——正解是传 `stroke=`（root 往下继承，与 143 处现有用法一致）。
4. 资产内 `fill="none"` 写在**可绘制元素上能存活 svgo**（实测）；本仓关于图标的结论一律以测代猜。

### 4.3 dual-use 资产登记（允许可填充，不在 §一 第 5 条强制范围内）

| 资产 | 为什么必须保留 fill | 调用处 |
|---|---|---|
| `star.svg` | 评分/选中态靠 fill 做实心星，与描边态同图标两语义 | `SquarePalCard`、`PalDetailSheet`（stroke+fill 同传） |

新增 dual-use 资产必须先在本表登记，否则会被 `check_icons.py` 的上色口径校验拦下
（宁可多登一条，不允许口头例外）。

### 4.4 本波收口清单（fill= 违规点，2026-09-07）

- 可见故障（封闭轮廓被填实）：`ChatHeader` 电话钮、`PhoneCallOverlay` 挂断/按住说话/喇叭开/喇叭关
- 口径错但无可见差：`EnhancedSearchBar` 清除钮、`HeaderRight`/`PalHeaderRight` 菜单钮
- 不属违规：`HeaderLeft`（`arrow-left-md` 是面性资产）、`SquarePalCard`/`PalDetailSheet`（dual-use）

## 五、WorkshopIcon（创造工坊入口，2026-08-22 登记，v5.4 意象更新）

- 用途：抽屉「创造工坊」入口图标（替代原画图 CameraIcon）
- 意象：**魔法棒 + 星芒**（v5.4 大王裁定：扳手工具语义与创造工坊「创作生成」语义错位，换 AI 创作语义；魔法棒沿主对角线、右上主四芒星 + 左上十字火花 + 右下圆点火花三点围合）
- 规格：SVG stroke 语义色 primary，20×20（与「+ 新对话」PlusIcon 22 对齐）；全描边 2px 同族（round cap/join）
- 归属：assets/icons 自绘体系，命名 WorkshopIcon
- 演进：画笔+音符（v5.2）→ 画笔×扳手（v5.3 工具工坊语义）→ 魔法棒+星芒（v5.4 AI 创作语义）
