---
doc_id: POCKETPAL_ICON_SPEC
module: root
type: spec
status: active
version: '1.2'
created: '2026-08-14'
updated: '2026-09-08'
relates: [POCKETPAL_DESIGN_SPEC]
---

<!-- D-FORMAT:v3 -->

# POCKETPAL 图标规范（单一事实源）

> 最后更新：2026-09-07 · v1.1 上色口径根治（大王报「电话图标不镂空」，真因见 §4.2；v1.0 曾把该现象误判为视觉重量）

## 一、规范

所有 `src/assets/icons/*.svg` 必须满足：

1. **画布**：`width="24" height="24" viewBox="0 0 24 24"`
2. **线宽（v1.2 改写）**：**有效描边粗细必须恒为 2.00**，即 `stroke-width × 资产内最大 scale ≈ 2.00`。
   旧条文只写「`stroke-width="2"`」——那是不够的：`normalize_icons.py` 做 viewBox 归一时会把
   20/22 视口的资产包进 `<g transform="scale(k)">`，而 `stroke-width` 写在内层坐标系里会被同一个
   `k` 一起放大。于是 18 件 `scale(1.2)` 资产的实际粗细是 **2.40**，其余是 **2.00**——
   **同屏粗细差 20%，这才是大王报「粗细和其他图标不一致」的真因**（与调用侧尺寸无关）。
   现口径：保留 scale（它是对个别资产墨迹偏小的合法校准，撤了会退回“图标大小不一”问题），
   但必须用 `stroke-width = 2/k` 反向补偿（如 `scale(1.2)` → `stroke-width="1.6667"`）。
   已挂闸：`check_icons.py` 逐件算有效值（容差 0.02），做过两次负向测试（改 stroke-width /
   加 scale）确认能红且报出文件名与具体值。
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
- **已撤销的假挂账（v1.2 自纠，2026-09-08）**：v1.1 曾在此处登记「`copy` / `duplicate` /
  `settings` / `edit-box` 四件的 `fill="white"` 遮罩层**不在** `clipPath` 内而是可见前后景分隔层，
  暗色模式会露白块」——**该陈述为假**。本窗全文实读四件资产（如 `copy.svg:5-9`），白色 `rect`
  均位于 `<defs><clipPath>…</clipPath></defs>` 内，而 clipPath 子元素只定义几何、永不绘制，
  因此**不存在暗色债**，恰好与本节上一条「`clipPath` 内部 `fill="white"` 属 mask 定义，不违规」
  一致。对应 DEV_BACKLOG 项 34 同步撤销。教训：当时我把「分类为 mixed」直接说成了「可见」，
  甚至写了否定式断言（「并不在 clipPath 内」）而未打开文件看一眼。

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

### 4.5 尺寸档位裁定与全仓基线（W9，2026-09-08 实测）

**先纠台账**：上一轮登记项 33 时写「含 18/26/13/10/12 五个离档值」——**量级错了**。本窗探针
（`.tmp/probe_sizes_164.js`，仅扫 `*Icon|*Logo|*Glyph` 的 JSX 数字字面量）实测：

| 类别 | 值×处数 | 合计 |
|---|---|---|
| **在档但硬写**（像素零变化） | 14×20、16×66、20×46、24×16 | **148** |
| **离档**（需裁定） | 10×4、12×6、13×2、15×2、**18×32**、22×10、26×4、32×2、34×6、36×1、48×4 | **73** |

共 221 处。另：`tokens/iconSize.ts` 自注「禁止硬编码 16/18/20/22/24/40」，而 18/22/48 均在仓内
大量存在——**条文与实际早已背离，且无闸拦（本卷唯一图标闸 `check_icons.py` 只管上色）**。

**裁定原则（一句话）**：档位是**角色集合**，不是像素集合；因此优先「承认既成事实并给它一个角色名」，
而不是「拿现有五档去把 32 处 18 推成 20」——后者是用规范名义做视觉重排，风险远大于收益。

**定档（含落地状态列，2026-09-08 补：防止"表里有档、码里没档"再造双份事实源）**：

> `tokens/iconSize.ts` 当前实现 **9 档**：`micro12 / xs14 / s16 / inline18 / m20 / l24 / xl28 / hero34 / display48`。
> 写码前以 `iconSize.ts` 实物为准；本表原标「提案」的三行已随 W9b-lite 落地。

| 档 | 值 | 状态 | 角色 | 收录的离档值 |
|---|---|---|---|---|
| `micro` | **12** | **已落地（W9b-lite）** | 徽章/内嵌小件（LockIcon 徽章、Star 徽章、引导条箭头、菜单内编辑） | 10 / 12 / 13 / 15 |
| `xs` | 14 | **已落地** | 行内辅助 | — |
| `s` | 16 | **已落地** | 内容区小图标 | — |
| `inline` | **18** | **已落地（W9a 新立）** | 行尾指示件与工具条图标（ListItem/Settings 箭头、搜索清除、预览工具条、语音/停止钮内图标） | 18（32 处**转正，零视觉变化**） |
| `m` | 20 | **已落地** | 顶栏栏位（DESIGN_SPEC 触区红线默认值） | — |
| `l` | 24 | **已落地** | 触控/强调主操作 | 22 / 26（需真机目视定方向，不可推） |
| `xl` | 28 | **已落地** | 特大强调 | — |
| `hero` | **34** | **已落地（W9b-lite）** | 空态/装饰级（不属于 chrome 图标语言） | 32 / 34 / 36 |
| `display` | **48** | **已落地（W9b-lite）** | 头像与空态主图 | 48 |

**真机复量（2026-09-08 装机窗 K90 aab688d9，density 480 → 3.0px/dp）**——半峰阈值剖面法
（`.tmp/measure_strokes_v2_164.py` + `.tmp/profile_164.py`；取峰值亮度 50% 为阈，消除颜色与 AA 干扰）：

| 顶栏图标 | 尺寸档 | 实测剖面（亮度） | 几何宽 | 理论 |
|---|---|---|---|---|
| `phone` | m(20) | `113 202 202 202 202 168` | 5.0px | 5.0px |
| `plus`（HeaderRight） | m(20) | `102 202 202 202 202 101` | 5.0px | 5.0px |
| `menu`（汉堡） | m(20) | `101 202 202 202 202 101` | 5.0px | 5.0px |

**结论**：三件剖面逐字节同形（4 个满值像素 + 两侧各半格）→ 大王报障的「粗细不一致」已闭环。
同一档不同图标之间不再差 20%（旧值 2.00 vs 2.40）；不同档之间随尺寸线性变化（inline18 → 4.5px）
是 24-grid 描边语言的**几何必然**，不是不一致。

**执行账（口径先说清：以下「处」= width/height 各计一处 props；一个图标元素 = 2 处）**：

| 阶段 | 动作 | 处数 | 像素变化 |
|---|---|---|---|
| 探针基线 | `probe_sizes_164.js` 扫出硬写尺寸 | **221** | — |
| W9a | 在档值收 token（含 18 转正为 `inline`） | **168** | **零** |
| W9b-lite | 新立 `micro(12)`/`hero(34)`/`display(48)` 并收口 | **16** | **零** |
| W9b-V（余） | 离档值 10/13/15/22/26/32 共 12 个图标元素（24 处）+ 1 处 styles 常量 36 | 25 | 待逐屏目视 |
| W9c（余） | `theme` 不在组件作用域（在档值但仍硬写，6 个元素） | 12 | 零（但需穿参） |

**账平校验**：168 + 16 + 25 + 12 = **221** = 探针基线 ✓（无漏项、无重复计数）。

- **零像素变化的硬证**：W9a 与 W9b-lite 后各跑一轮全量 jest，**350 套 / 4854 过 / 318 快照全过**
  ——快照存的是渲染后 props，全过即证明 184 处输出逐字节相同。
- **安全网确实生效**：codemod 的文件级启发式误判了 12 处（`theme` 在文件里但不在该组件作用域），
  全部由 `tsc` 报 `Cannot find name 'theme'` 拦下并精确回退（`.tmp/revert_untokened_164.js`）。
- **W9b-V 不做的事**：拿「归档」当由头把 22 推成 24、把 10 推成 12——那是用规范名义做视觉重排。
  12 个待裁元素已逐条定位（`.tmp/list_offgrid_164.js` 输出，含 file:line 与元素名），需真机目视：
  `CpuChipIcon`/`LockIcon`(10)、`ArrowRightGlyph`(13)、`EditIcon`(15)、`Browser|Code|Copy|CloseIcon`
  与抽屉 `PlusIcon`(22)、`Pause|PlayIcon`(26)、`UserIcon`(32)。**若目视变差则保留现值并登记理由。**
- **W9c 待做**：6 个元素需先把 `theme` 引入作用域（穿参或组件内 `useTheme()`）再收 token；
  涉及 `ChatGenerationSettingsSheet`、`ContentReportSheet`、`DownloadErrorDialog`、
  `PalGenerationSettingsSheet`、`AuthSheet`、`SettingsScreen`。

## 五、WorkshopIcon（创造工坊入口，2026-08-22 登记，v5.4 意象更新）

- 用途：抽屉「创造工坊」入口图标（替代原画图 CameraIcon）
- 意象：**魔法棒 + 星芒**（v5.4 大王裁定：扳手工具语义与创造工坊「创作生成」语义错位，换 AI 创作语义；魔法棒沿主对角线、右上主四芒星 + 左上十字火花 + 右下圆点火花三点围合）
- 规格：SVG stroke 语义色 primary，20×20（与「+ 新对话」PlusIcon 22 对齐）；全描边 2px 同族（round cap/join）
- 归属：assets/icons 自绘体系，命名 WorkshopIcon
- 演进：画笔+音符（v5.2）→ 画笔×扳手（v5.3 工具工坊语义）→ 魔法棒+星芒（v5.4 AI 创作语义）
