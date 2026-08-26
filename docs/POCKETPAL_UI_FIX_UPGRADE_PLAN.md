---
doc_id: POCKETPAL_UI_FIX_UPGRADE_PLAN
module: root
type: planning
status: active
version: "1.8"
created: "2026-08-26"
updated: "2026-08-26"
relates: [POCKETPAL_CHAIN_AUDIT_20260826, POCKETPAL_DESIGN_SPEC, POCKETPAL_STARMAP_DOMAINS, DEV_BACKLOG]
---

<!-- D-FORMAT:v3 -->

# UI 修复升级方案（遗留队列全量闭合，2026-08-26）

> 方法：门禁走查 → 三专工路由（带规则包）分部调研 → 洋葱三层对账（文档承诺→代码实现→质量闭环）→ 6D 洋葱诊断 → 星图域切分核对
> 范围：遗留队列 B55（ALert 特殊保留）/ B53（红测试）/ B54（肥件+单槽）/ B47（token 野档）/ B48（重复组件）/ B49（布局锚点）+ TODO 17 处
> 基线：门禁三闸全绿（eslint . 0 错 / prettier 全绿 / tsc 0 错）+ 关键套件 110 用例绿

---

## 一、总账（一页纸）

**遗留队列已全部完成调研与方案设计，可执行批次 B55-B60；其中 B53 现状大幅优于预期——红测试由 7 套件降至 2 套件，且该 2 项均确证为并行窗口在途（Krea2 目录新增 / InfoDialog 迁移链），我方零引入，待收口自然闭合。**

- **门禁基线**：三闸全绿；tsc 0 错；本轮 B52③ 迁移后相关套件 277 用例全绿（已收进审计）
- **B47 数据**：间距裸数字 1110（无档位 230）/ 圆角 144（无档位 48）/ 字号 267（越档 27）/ 颜色非登记 116 处 64 值（9/10px 红线已清零 ✓）
- **B48 关键修正**：LoadingBubble 为**零引用僵尸**（三合一实为"删一合一"）；ui/Chip 缺 outline 变体是零引用根因（扩展即可收敛 4 处）；进度条六套 + paper 一套，UI 域无 Progress 基石（新建即可全收）
- **B49 定位**：4 文件可修（TextMessage/ChatView/DownloadOverlay/EmbeddedVideoView），全部宿主在 SafeAreaProvider 内可直接取 insets；另有 2 个小锚点以 spacing 表达式消解
- **B54 设计**：ModelStore 拆分沿用现役 facade+mixin 模式（5 个新文件，MobX 约束明确，切分点绕过在途策展表字段）；单槽 v2 = imageGenStore 两处加载入口前置 `promptWriter.ensureLoaded()`（幂等）+ 显式降级标注（非硬闸门）
- **B55 设计**：多选/三选一 → Sheet 列表选择底座；带动作按钮 → confirmDialog 两按钮语义；safeAlert 保留

**产品判断**：无"大件没做"。剩余全部是"收尾与去臃肿"——按锋利哲学，B55+B58（产品可感知）先行，B57（去臃肿）随后，B56（token 面大机械）与 B60（内存治理）并行，B59（架构）需专用窗口。

---

## 二、门禁与星图域核对

| 项 | 结果 |
|---|---|
| guard:worktree / lint:prettier / lint | ✅ 全绿（eslint . Done 26.27s / prettier Done 8.04s） |
| tsc --noEmit | ✅ 0 错 |
| 关键套件（invariants/ChatView/ImageGenScreen） | ✅ 110 用例全绿 |
| 星图域 <-> 遗留批次映射 | theme/DS 域：B47/B48/B56/B57；（聊天域）TextMessage/ChatView：B49/B58；（生图域）ResultPreview/ImageGenScreen styles：B47；models 域 ModelStore：B54/B59；（工具域）safeAlert：B55 保留；无引擎层触碰 ✓ |

---

## 三、6D 洋葱诊断（遗留队列机制性根因）

| D | 层 | 发现 |
|---|---|---|
| D1 表象 | 用户可见 | 挖孔屏查看器按钮贴槽（top:50 无 insets）；EmbeddedVideoView 短屏按钮重叠；系统 Alert 与 App 卡片混用（B55 剩 8 处）；加载动效/进度条视觉各异 |
| D2 数据 | 工程可见 | token 裸数字 1500+；重复实现 6+4+3 套；ModelStore 3313 行超肥；红测试 2 套件（在途） |
| D3 机制 | 流程 | DS 组件"建而不用"（ui/Chip 零引用、ui/Switch 零引用、LoadingBubble 僵尸）；token 档位表不全（间距无 6/10/14/3，圆角无 5/18/15/6/10/3）——无档位则人人自造 |
| D4 根因 | 治理 | **DS 组件缺乏"落地闭环"机制**（建组件≠被使用）；**token 档位缺口**导致野档合理化；**监测缺失**（无自动巡检"零引用 DS 组件/裸数字"） |
| D5 行动 | 方案 | B55-B60 六批（见 §四）+ 机制两条（§五） |
| D6 验证 | 判据 | grep 零残留、paper ProgressBar/Alert 全清、ModelStore <2000 行、invariants 绿、CI jest 全绿 |

---

## 四、可执行批次（B55-B60，锋利优先排序）

### B55：ALert 特殊保留专项（8 处）——✅ 全部主体完成（2026-08-26）：带动作 3 处 → confirmDialog + ModelsScreen 服务器多选 → SearchableSelectSheet + 文件冲突三选一 → Sheet 动作行（Promise 语义保留，测试 15/15 同步）

| 处 | 语义 | 方案 | 底座 |
|---|---|---|---|
| ModelsScreen:148 服务器多选列表 | 列表选择（N 选 1） | Sheet 内嵌列表行（对齐 SearchableSelectSheet 模式，服务器项 + cancel） | Sheet |
| ModelsScreen:226 文件三选一（replace/keep/cancel） | 三选动作 | Sheet 内嵌三选项行（replace/keep/cancel，destructive 高亮 replace） | Sheet |
| exportUtils:343（File Saved+分享）/ :400（保存失败+分享） | 信息+动作 | confirmDialog（confirmText=分享 / cancelText=取消） | confirmDialog |
| androidPermission:152（去设置） | 信息+动作 | confirmDialog（confirmText=去设置 / cancelText=取消） | confirmDialog |
| ModelStore:2087 | 删除确认（用户在途文件） | **在途：等并行窗口收口后随 B59 迁移** | — |
| safeAlert 封装 | 平台守卫（Android 双弹窗防抖） | **保留**（工具非范式，登记豁免） | — |
| 验收 | ModelsScreen 两处 Alert 清零 + Sheet 选择可达 + 两处 confirmDialog 语义保留 | | |

### B56：token 野档全量迁移（B47，门禁内最大面）——✅ B56①+② 已执行（2026-08-26）：B56① 等值替换 942 处/92 文件；B56② 高频值归一 217 处/52 文件 + 颜色迁移 116 处（灰色族→onSurfaceVariant/outlineVariant 等 §1.6 映射，反推紫/全屏白/色板族登记豁免）；B56③ 反推紫已登记 theme.colors.imageInsight + fontSize 等值映射 219 处/56 文件（11→captionS/12→captionM·uiS/14→bodyS·uiM/16→bodyM·titleS/18→titleM，零视觉回归）+ DatabaseInspector 工具屏整文件归一——本轮再收口：12.5 小数 4 处 + 13 无档 1 处归档（12.5→captionM、13→uiM）；大王裁定补档后：**标题族补档归档**——补 headlineH2(24)/headlineH3(20)（填补 16/18/22/28 间隙，跟随 headlineH1 命名），20×2→headlineH3、24×3→headlineH2（等值，零视觉回归）、26→displayS(28)（非 4pt 值归就近）、40 字形豁免登记；至此 B56 token 卫生系列全部闭合。剩余仅：44 触区/28-150 定位大距（结构修复类）

1. **补档位表**（token 层一次补齐——这是根，不补则野档合理化）：
   - spacing 补 `6/10/14/3` 档（新值登记 spacing.ts + DESIGN_SPEC §2.4 表）；`28/36/44/64/66/100/120/150` 属语义化专用值，逐处评估（100=底部留白 hack 改百分比/insets 结构）
   - radius 补 `6/18/15/10/24/5/3/14/13/25` 档或映射（多数可映射 radius 既有档：24→l? 需裁定——**体检口径：无档位值经大王裁定后补档或映射，禁直接裸用**）
   - typography 越档 27 处：13→bodyS、15→bodyM、20/24/26/40（40=ImageGenScreen 大标题，改 displayS 或登记 displayXL）→ 裁定映射
2. **机械替换**：数值对 880 间距 + 96 圆角 → token 引用（脚本化批量 + 逐文件 review）
3. **颜色迁移**：§1.6 映射表内灰度（#000/#fff/#666/#999/#333 等）→ token；反推紫 #6a1b9a（4 处）→ colors.ts 登记「caption 域色」；EmbeddedVideoView 遮罩 rgba 族 → backdrop 等 token
4. **整文件裸奔重点**：DatabaseInspectorScreen（47 处 vs 1 token）单独子批（工具屏低风险）
5. 验收：体检口径裸数字归零（豁免表登记）+ 新档位 token 有测试 + invariants 白名单同步

### B57：重复组件收敛（B48）——✅ ①②③④ 全部完成（2026-08-26）：①三点动画三合一（ui/WaveDots）②进度条统一（ui/Progress）③chip outline（ui/Chip）④Switch 收口 24 处 + spinner 三源归并 21 处（全仓 paper/RN ActivityIndicator 与直用 Switch 清零）；附带 CircularActivityIndicator 动画 cleanup 泄漏修复

1. **三点动画三合一**：删 LoadingBubble 僵尸（index.ts 导出 + invariants 白名单同步清除）；useWaveDots 参数化（mode: fade|bounce + duration/stagger/minOpacity）迁入 `components/ui/WaveDots/`（保留名称与 7 处引用注释）；新建 `ui/WaveDots.tsx` 渲染组件吃掉 4 个重复渲染点（ImageTaskProgress/ResultPreview/AudioWorkshopTab/ChatPalModelPickerSheet/ModelSwitchDialog）
2. **chip 收口**：ui/Chip 增 `outline` 变体 + `color(primary|danger)` + full 半径归一；迁移 ImageTaskActions/TaskErrorCard/ButlerUpgradeRow/ChatPalModelPickerSheet 4 处（disabled 换 DS 语义顶替 opacity 0.4 hack）
3. **进度条统一**：新建 `ui/Progress`（默认 6px/xxs/shadow8%，height 4|6|8 参数化，内部 radius=height/2 消灭裸数字）；迁移 7 处（ResultPreview/ImageTaskProgress/BannerBar Meter/ModelFileCard 2px 特例/ModelSwitchDialog/ChatPalModelPickerSheet/paper×2 清零）
4. **Switch 收口**：paper Switch 14 处直用 → ui/Switch 包装（8 文件）
5. **spinner 归并**：CircularActivityIndicator 入 ui 域（size|color props，保留 JS driver 纪律注释），paper/RN ActivityIndicator ~11 文件归并
6. 豁免登记：workshopSlider（tab 切换语义，非开关）、空态占位族（语义差异大，收一轮净值低）
7. 验收：grep 零残留（LoadingDot/paper ProgressBar/paper Switch/Chip 使用点≥4）+ 相关套件全绿

### B58：布局安全锚点（B49）——✅ 已执行（2026-08-26）

| 文件 | 现值 | 改造 |
|---|---|---|
| TextMessage.tsx + styles | closeBtn top:50/right:20；saveBtn bottom:56 | 组件取 `insets` → `top: insets.top + spacing.m`；`bottom: insets.bottom + spacing.m`（与 ChatView 同表达式归一） |
| ChatView.tsx + styles | viewerEditButton bottom:56 | createStyles 透传 insets → `bottom: insets.bottom + spacing.m` |
| DownloadOverlay/styles | left:50/right:45 不对称 | 对称化 `left/right: spacing.xxl(40)`（宿主已取 insets，0 新依赖） |
| EmbeddedVideoView/styles | bottom 5%/11%/180px 三层混排 | 根容器 flex-end 流式（controls→interval→response 自下而上 + marginBottom: spacing.m）；删 3 锚 |
| 小锚点 | infoOverlayPushed top:52；captionFab bottom:44 | spacing 表达式（xxl+sm / xxl+xs） |
| 验收 | 深浅双模式真机：刘海机按钮不贴槽、短屏三层不重叠（K90 走查） | |

### B59：肥件拆分（B54 架构批，需专用窗口）

- **ModelStore 3313 行**：facade + mixin 模式（现役），5 新文件：contextConfigMethods(~330)/catalogScanMethods(~680)/downloadMethods(~240)/crudMethods(~620)/loadReleaseMethods(~780)；MobX 约束：observable 字段 + computed（activeModel 等 5 个）+ makePersistable 白名单留 facade；方法组箭头函数在 makeAutoObservable 前挂载（现役做法）；**切分点绕过** `normalizePresetNCtxToCuratedDefaults/auditPerModelNCtxAgainstPss/curatedTableVersion`（在途）
- **ChatSessionStore 1754 行**：抽 `chatStreamingUpdater`（节流域 L792-1061）+ `completionSettingsResolver`（L1659-1750）
- **GenerationSettingsScreen 1218 行**：抽 2 hooks + 6 卡片子组件，Screen 变装配壳
- 验收：三肥件各降 30%+；全量 jest 绿（ModelStore 测试 3000+ 断言）；逐批 atomic 提交

### B60：单槽 v2（编排层联动）——✅ 已执行（2026-08-26）：imageGenStore.loadModel 与 loadDreamLiteEntry 两入口前置 `await promptWriter.ensureLoaded()`（幂等并发安全，未装管家=idle 不阻断、失败=内部已落 error 标注，非硬闸门）

- 插入点：imageGenStore.loadModel（acquire('image') 前）+ loadDreamLiteEntry 头部
- 动作：`await promptWriter.ensureLoaded()`（幂等并发安全）→ 就绪则 engineStatus.setPhase('prompter','ready') + vibeState.expectOrActivateButler()
- 失败行为（显式降级、非硬闸门）：管家未装=idle 保持 + UI 标注「提示词原样使用」；加载失败=生图照常 + 显式提示；不 rollback 已获 image 槽（野生内存策略）
- 验收：生图加载时管家自动就绪（聊天生图闭环 5 分支占位符可见）；未装管家机型生图不阻断

### B53：红测试（并行窗口收口后执行，非本窗口）

- modelCatalog：待并行窗口合入后补 `toHaveLength(5)`（Krea2 目录新增，81 行未暂存 diff 在途实证）
- androidPermission：待并行窗口 InfoDialog 迁移链合入后自然闭合（未跟踪文件 + RNFS mock enumerable 脆弱点，归属测试基建非业务）
- 我方零引入（已实证）

---

## 五、机制修正（防再犯，随 B56/B57 落地）

1. **DS 组件落地闭环**：新 DS 组件登记时附「首批消费点清单」，B57 验收时把 ui/ 零引用组件清零（现状：ui/Chip 零引用、ui/Switch 零引用、LoadingBubble 僵尸）
2. **token 档位缺口自动暴露**：invariants.test.ts 扩一条「样式属性裸数字巡检」（间距/圆角/字号不在档位表 → 报错），把 B56 的结果固化为门禁——野档再犯在提交前被拦
3. **并行窗口账实互扰**：保持「落码=代码证据+测试绿」双证制 + 挂账必挂批次（既有，续执行）

---

## 六、执行顺序建议（锋利优先）

| 波次 | 批次 | 理由 |
|---|---|---|
| 第 1 波（本窗口可做） | B55 + B58 | 产品可感知（选择交互 + 布局安全），改动面小 |
| 第 2 波 | B57 | 去臃肿（重复组件清零），中等面 |
| 第 3 波 | B56 子批①（档位补全+机械替换）+ B60 | 面大但机械 / 内存治理小改 |
| 第 4 波 | B56 子批②（颜色+整文件）+ B59 | 需专用窗口的架构批 |
| 待并行 | B53 | 收口后闭 |

**token 档位裁定（2026-08-26 技术自决）**：①spacing 不扩档——6/10/14/3 违反 §2.4 的 4pt 节奏契约，主值归一（6→4/8、10→8/12、14→12/16、3→2/4），确有视觉必要处评审豁免登记；②radius 不扩档（与 spacing 同原则——镜像 Figma 量表契约）：24 归 l(20) 档并逐处注释（已随 B56① 落码 6 处）；③40px「标题」实为上传图标字形尺寸（uploadBigIcon），豁免登记不造档；④13/15 字号为 bodyS/bodyM 数值对，机械替换。

**B58 附带架构修复**：命令式弹窗函数（infoDialog/confirmDialog）与呈现层拆分——新建 ui/ConfirmDialog/api.ts + ui/InfoDialog/api.ts（零 React 依赖），Host 经 register 挂接；工具层（utils/exportUtils、utils/androidPermission）改引 api 路径，杜绝「utils → 呈现链（hooks→theme→paper）」的 import 期崩溃（exportUtils/androidPermission 测试曾以 suite 崩溃暴露）。

**总原则**：不兜底、不补丁。每个批次走五关门禁（tsc/jest/lint/装机/真机走查）闭环；B59 拆文件 atomic 提交可回滚；B56 新档位经大王裁定后写入 §2.4 表（文档先行代码随行）。