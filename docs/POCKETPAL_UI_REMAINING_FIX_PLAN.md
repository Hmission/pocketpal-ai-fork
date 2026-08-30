---
doc_id: POCKETPAL_UI_REMAINING_FIX_PLAN
module: root
type: planning
status: active
version: "1.3"
created: "2026-08-26"
updated: "2026-08-26"
relates: [POCKETPAL_UI_FIX_UPGRADE_PLAN, POCKETPAL_DESIGN_SPEC, POCKETPAL_STARMAP_DOMAINS, DEV_BACKLOG]
---

<!-- D-FORMAT:v3 -->

# UI 遗留收口 · 全面修复升级方案（全量排查后定稿）

> 方法：门禁基线（三闸全绿）→ 三专工并行深查（B59 拆分 / 尺寸域盘点 / worker 泄漏，均携规则包）→ 6D 洋葱诊断 → 星图域核对
> 定位：B55/B56/B57/B58/B60 主体已闭合后的**剩余全量清单**与**可执行方案**——不兜底、不补丁，结构性断根
> 门禁基线：三闸全绿 + tsc 0 错（本轮）；并行窗口另有 3 提交在途（上下文极限化/审计 20260827）

---

## 一、总账（剩余全清单 · 一页纸）

**已完成（此前波次）**：B52-B58、B60 主体——系统 Alert 全仓归零、token 卫生 ~1500 处、DS 五件套单一事实源、单槽 v2 联动、标题族补档。

**剩余 5 批（按锋利优先级）**：

| 批 | 内容 | 性质 | 窗口 |
|---|---|---|---|
| **R1** | size 常量域补全（`minTapTarget=44` + `controlHeight=36`，29 处统一引用） | 断根 | ✅ 已完成 |
| **R2** | 底部留白结构修复（100/120/150 共 8 处 → insets 表达式/布局分区） | 结构 | ✅ 已完成（conservative 表达式版；完整布局分区待后续） |
| **R3** | B59 肥件拆分（ModelStore 3766 行 + 2 肥件，分期） | 架构 | ✅ P1 已完成（GenerationSettingsScreen -84% / ModelStore -460 / resolver 抽取）；P2-P5 待后续 |
| **R4** | 测试基建三板斧（hooks 桶瘦身 / mock 边界收口 / utils 桶拆） | 基建 | 专用窗 |
| **R5** | 需裁定 4 项 + 豁免登记 43 处（尺寸域/裁定值/工具屏） | 登记 | ✅ 4 项已裁定；豁免清单逐批登记中 |

**执行进度（2026-08-26）**：① 当场批次落地（专工 2 处泄漏 + 4 处等值修复）；② **R1 ✅ 完成**（size 域：size.ts + types×2 + theme 集成 + 29 处替换，裸 44/36 仅剩 8 处登记豁免）；③ **R5 ✅ 完成**（4 项技术裁定执行：28→xl / 行高 52→56 / emptyState 64 豁免 / 空态卡 28→l+xs）；④ **R2 ✅ 完成**（bottomOffset 双语义实证非底缘留白——8 处结构修复：insets 表达式 / xxl+xl 表达式，无新魔法数）。

---

## 二、6D 洋葱诊断（机制性根因）

| D | 层 | 发现 |
|---|---|---|
| D1 表象 | 用户/工程可见 | ModelStore 3766 行肥件；样式尺寸裸值 83 处；全量测试随机红（并行 5 / 串行 8，集合每次不同） |
| D2 数据 | 实测 | 44 触区 10 处、36 控件高 12 处、底部留白 100/120/150 共 8 处；堆内存串行 9 套件 173→407MB 单调爬升（逼近 512 限制）；--detectOpenHandles 零句柄报告（排除句柄泄漏） |
| D3 机制 | 流程缺口 | ①ModelStore 方法未分域（历史快迭代未拆）；②**token 体系缺「尺寸（size）」域**——只有间距/圆角/色，无控件高度/触区档 → 44/36 人人自造；③测试基建 barrel import（hooks/utils 桶）把整个真实业务图拖进每个组件套件 |
| D4 根因 | 治理 | 「无档则人人自造」在尺寸域重现（同 spacing 野档病灶）；测试 mock 边界未收口，直连 store 绕过 barrel mock |
| D5 行动 | 方案 | R1-R5 五批（见 §四）——补 size 常量断根 / 结构修复 / 分期拆分 / 基建收口 |
| D6 验证 | 判据 | R1：22 处 grep 零裸值；R3：ModelStore facade <1000 行 + ModelStore.test.ts 3875 行全绿；R4：组件套件堆基线显著下降 + 全量无随机红 |

---

## 三、星图域核对

| 批次 | 主域 | 触达 |
|---|---|---|
| R1 size 常量 | theme/DS | tokens/types + invariants + 22 消费点 |
| R2 底部留白 | 生图域/模型域/聊天域 | ImageGenScreen/PalsScreen/ModelsScreen/HFModelSearch/EnhancedSearchBar |
| R3 肥件拆分 | models 域 + 聊天域 | ModelStore/ChatSessionStore/GenerationSettingsScreen（引擎层 initContext 签名不动，禁区遵守） |
| R4 测试基建 | 基建（跨域） | hooks 桶/utils 桶/jest mock 边界 |
| R5 登记 | theme/DS + Gap Ledger | DESIGN_SPEC Gap |

**禁区核对**：全程不触碰引擎层（llama/ONNX JNI）；R3 迁出的只是编排壳，`initLlama` 调用签名不动。✓

---

## 四、分批详细方案

### R1：size 常量域补全（断根，首选当场做）

**病灶**：44/36 裸值靠「人人记得写」维系——同 spacing 野档病根。补常量即断根。

```
新增 src/theme/tokens/size.ts：
  export const size = { minTapTarget: 44, controlHeight: 36 };
types.ts 补 TokenSize；tokens/index + theme builder 集成；invariants 白名单登记
```
**替换 22 处**（等值，零视觉回归）：
- `minTapTarget=44`（10 处）：HeaderLeft 图标容器 / SearchableSelectSheet 行 / LanguageSelector / TTSSetup heroLanguageTrigger / RenameModal / ui/Dropdown / ui/IntentPicker / ui/ModelSwitchDialog / ImageGen inputSmall / EnhancedSearchBar 让位距
- `controlHeight=36`（12 处）：ChatInput quickIcon/voice/compactVideo / HeaderRight compactBtn×2 / EnhancedSearchBar searchInput / IncreaseContextSheet slider / ImageGen audioSlider / Send·StopButton / MemoryScreen typeBadge
- **例外豁免**：workshopSliderSeg 36（大王裁定段宽）、ResponseBubble chevronIndicator 36（指示线）

**与 hitSlop 分工**：行/输入/触发器用 `minTapTarget` 实体高度；紧凑图标钮用视觉尺寸 + hitSlop 补偿（`28 + (44-28)/2`）。**附带 Gap 发现**：SquarePalCard chatButton、ChatInput 28px 图标钮族未配 hitSlop，实际触区 <44——登记 Gap 待后续。

### R2：底部留白结构修复（8 处，三策）

值耦合「被遮挡物高度 + 设备安全区」，换静态档必漏/过量——只有 insets 表达式或布局分区是结构性答案（B58 已证同文件族可取 insets，`captionFab` 样板已在）。

| 宿主 | 处数 | 改法 |
|---|---|---|
| 非悬浮同屏栏（PalsScreen 100） | 1 | 列表 flex:1 在上 + actionBar 在下的**布局分区**（内容让位改分区）；若必须悬浮叠层 → 常量 `BOTTOM_BAR_CLEARANCE` 以 actionBar `minHeight:70` 为单一事实源 |
| 悬浮 FAB（ModelsScreen 150） | 1 | `FAB高(56)+底距+insets.bottom` 表达式 |
| Sheet 底缘（HFModelSearch×2 / ModelScopeAddSheet / EnhancedSearchBar） | 5 | **先核实 `bottomOffset` 语义**：若已含底缘补偿 → `paddingBottom` 归零（HF 两处疑似双倍留白，真机可见过量空白）；若只管键盘 → `insets.bottom + spacing.xl`；Sheet 内底部按钮根治法=移出滚动容器进 Sheet footer 槽 |
| 输入上限（ChatInput maxHeight:150） | 1 | 非留白（防无限增高），归尺寸域豁免 |

### R3：B59 肥件拆分（分期，风险递增）

**ModelStore 3766 行**（比 §98 涨 453；策展表已入库，约束解除；第一期 projectionMethods/reasoningMethods 已迁出，facade+mixin pattern 实证可行）→ 7 方法组 / 6 文件 / **facade 降至 ~800 行（-78%）**：

| 期 | 域 | 风险 | 判据 |
|---|---|---|---|
| P1 contextConfig（含策展三件套，~450） | 低 | 纯 setter，**可当场** | ModelStore.test settings 段 + GenerationSettings/IncreaseContext/ModelSettings |
| P2 crud（~420） | 低中 | deleteModel 跨域调接口不变 | ModelStore/ModelsScreen/ModelCard |
| P3 download（~280） | 中 | constructor 回调留 facade | ModelsScreen/HFModelSearch |
| P4 catalogScan+localScan（~690） | 中 | 启动链顺序敏感，避并行窗口在途 | ModelStore 启动段/modelCatalog/Onboarding |
| P5 loadRelease+lifecycle（~930） | **高** | mutex/last-one-wins/Stop-Await-Release/benchmark 四组内存安全不变式，**必须专用窗** | useChatSession×4/ChatView×2/BenchmarkRunner/engineMutex/invariants 约 20 套件 |

**ChatSessionStore 1753**：抽 `completionSettingsResolver`（P1 纯函数，可当场）+ `chatStreamingUpdater`（P2，30ms 节流时序防步骤错位，专窗）+ `sessionGroups`（凑足 -34% 验收线）。
**GenerationSettingsScreen 1230**：2 hooks + 7 卡片 → 装配壳 ~120 行（**-89%，三肥件最优，无 MobX/时序，单套件影响，可当场**）。
**纪律**：每期 atomic 提交（剪切-粘贴 + this→store，零行为变化）可回滚；private 迁出变公开实例属性（接受，不造访问控制补丁）；index 3 缺失不补号（防动画序回归）。

### R4：测试基建三板斧（根治随机红，专用窗）

**真话**（专工实证）：非句柄泄漏，是「共享基建把整个真实业务图拖进每个组件套件」的累积内存压力。
1. **hooks 桶瘦身**：208 处 `from '.../hooks'` 改直连（多数只取 useTheme），或拆 `hooks/index`(轻)+`hooks/chat`(重)；配 eslint 禁桶导入防回归——组件套件基线从 ~170MB 大降
2. **mock 边界收口**：14 处 `store/imageGenStore` 直连改走 `src/store` barrel（jest.setup mock 全覆盖，满屏 `[ImageGenStore] migration failed` 警告消失）；需真 store 的套件显式 `jest.unmock`
3. **utils 桶拆**：UserContext/L10nContext 独立模块，test-utils 直连，切断 lodash/dayjs/RNFS/hf 族
- **运行口径**（非补丁）：全量快跑默认 `--coverage=false`（instrumentation 是内存大头，覆盖率只在专门门禁跑）；`workerIdleMemoryLimit:512MB` 保留为哨兵——三板斧后触发频率应趋零，若仍频触发=还有残余继续追
- **当场已修 2 处**（本轮专工）：PendingIndicator.Dot `Animated.loop` 补 `loop.stop()` cleanup；MarkdownProvider 直连 `hooks/useTheme`（切污染链第一环）——验证 47/47 绿

### R5：需裁定 + 豁免登记（收口）

- **需大王裁定 4 项**：TextMessage 保存钮 `paddingHorizontal:28`（归 xl32 或豁免）、TTSSetupSheet `primaryRow minHeight:52`（§2.4 行高规范是 56）、PalsScreen emptyState `paddingVertical:64`（超 xxl40）、ImageGen 空态卡 `paddingVertical:28`
- **豁免登记 43 处**：28 钮族 13 / 64 头像缩略 6 / 66·120·150 裁定与尺寸帽 14 / 组件内成对常量 4（ResponseBubble/ThinkingBubble，提文件内具名常量防镜像漂移）/ 工具屏与功能尺寸若干——全部进 DESIGN_SPEC Gap Ledger
- **typography 已收**：headlineH2.lineHeight 30→28（对齐现有使用，等值替换零回归的前提）

---

## 五、执行顺序与门禁判据

| 序 | 批 | 窗口 | 说明 |
|---|---|---|---|
| 1 | R1 size 常量 | 当场/小窗 | 断根首选，等值零回归 |
| 2 | R3-P1（GenerationSettings 全件 + ChatSession resolver + ModelStore contextConfig） | 小窗 | 三项低风险打包 |
| 3 | R2 底部留白 | 小窗 | 先核实 bottomOffset 语义 |
| 4 | R5 裁定 + 登记 | 收口 | 大王裁定 4 项 + Gap 登记 |
| 5 | R3-P5 / R2-sheet / R4 三板斧 | **专用窗** | 高风险/跨域大改 |

**总原则**：不兜底不补丁；每期原子提交可回滚；每期走五关门禁（tsc/jest/eslint/prettier/装机）；真机验证用**小米 13**（K90 被并行窗口占用）；并行窗口在途区（ModelStore P4/上下文极限化相关）避开冲突。

**提醒**：本窗口累计改动未提交（git status ~153 项）+ 并行窗口在途——提交前需核对两窗口边界；本地提交照常，push 远端等大王明确指令（AGENTS.md Git 铁律 2026-08-30 修正）。