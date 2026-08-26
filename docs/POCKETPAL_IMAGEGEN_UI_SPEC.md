---
doc_id: POCKETPAL_IMAGEGEN_UI_SPEC
module: root
type: spec
status: active
version: "5.6"
created: "2026-08-14"
updated: "2026-08-24"
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
> 版本：v4（2026-08-21，创作工坊：页内双 tab（生图/音频工坊）+ 反推能力——操作条五按钮、caption 任务化入画廊、复刻生图 Sheet 全参数；音频工坊见 AUDIO_UI_SPEC）
> 版本：v4.1（2026-08-21，新手引导：非 Dream 出图未加载不再灰置——点击弹提示 + 展开模型下拉；预览区有图时非 Dream 也常驻「编辑」按钮——点击确认后自动切 DreamLite）
> 版本：v4.2（2026-08-21，提示形态统一：生图页全部轻提示弃用底部 Paper Snackbar——顶部 BannerBar overlay（白卡实底压预览区顶部，语义色 wash，不挡底部按钮）；编辑锁定提示常驻至预备态结束，其余瞬时 3s 自动消失）
> 版本：v4.3（2026-08-25，大王反馈：横幅改造——弃屏级 absolute top:458 中间浮条，移入预览卡片（ResultPreview 图区）顶部绝对定位，只压预览卡片不压历史区/创作区；**去白卡实底 surfaceElevated（大王：不要灰色底）**，BannerBar 语义色 wash 直接透出；瞬时横幅**整卡点击关闭**（保留 ×）+ 3s 自动消失；预览图信息条（infoOverlay）让位下移不重叠；音频 tab 同一设计语言叠卡片顶部）
> 版本：v5.1（2026-08-22，顶栏滑块按钮：生图/音频双 tab 胶囊合并为单滑块（toggle，点文字段切换、点选中段不动）；模型胶囊缩短 1/3（maxWidth 180→120）保证「加载」按钮永可见）
> 版本：v5.2（2026-08-22 大王反馈收窄）：滑块分段 56→48px/段（两段总宽 96）；抽屉入口文案「画图」→「创造工坊」（zh）/「Studio」（en）/「創造工坊」（zh-Hant，其余语言回退 en）；workshop.svg 重绘（全描边 2px 同族，画笔斜置 + 音符流出于笔尖的对角构图，替代原实心圆散构图）
> 版本：v5.3（2026-08-22 B35 大王裁定）：① workshop.svg 再次重绘——**画笔 × 扳手 X 交叉**（大王：两工具交叉成 X，替代音符；画笔沿主对角线、扳手沿副对角线，交叉点居中，互不侵入对方主体）；② 音频历史条改**横向滚动**（对齐本页相册 HistoryStrip 模式，转写/生成两段隔离）；③ 音频引擎选择**移入顶栏胶囊**（对齐本页模型胶囊语义，高级参数不含模型红线扩展至音频 tab）；④ 转写结果卡对齐反推卡（3 行折叠 + 展开全文 + 三按钮操作条）
> 版本：v5.4（2026-08-22 B36 大王复查）：① **音频引擎选择弃 Menu → 复用本页 ModelPicker 屏级 overlay 交互**（同页双交互模式消灭，dropOverlay/dropBackdrop/dropPanelAbs + 行内下载/删除）；② 音频结果区升级**整卡三态**（running 波浪 / success 全文卡 / failed 三按钮，对齐本页 taskPage 语义）；③ 音频历史条点击**联动结果区切换**（对齐相册翻页联动）；④ 音频 composer 模型管理行删除（三行冗余状态文本 → 并入顶栏下拉行内）——详见 AUDIO_UI_SPEC v1.5
> 版本：v5.5（2026-08-23 B38 大王复查·多模态统一）：① **音频顶栏胶囊弃独立风格 → 与本页 triggerPill 同一设计语言**（primary 12% 底 + full 圆角 + primary 1px 描边 + onSurface 文字 + ▾，就绪点内嵌）——同页不再并存两套胶囊风格；② 音频产物区升级**播放器预览窗口**（方形大卡 + 播放/暂停 + 时间轴跳播 + 时长，对齐本页预览窗口规格）；③ 音频历史卡改**方形卡**（对齐本页相册缩略图 72px 方形），点击加载预览窗口——详见 AUDIO_UI_SPEC v1.7
> 版本：v5.6（2026-08-24 B39 跑分演出升级规划，PERF_BENCHMARK_DESIGN §10 v0.5）：§9 跑分面板演出层升级定稿——① 40pt 条形迷你图 → **折线+渐变面积图**（自绘满宽贴卡片缘，峰值打标，卡片内不溢出红线不变）；② 全数字接 PerfMotion AnimatedNumber（PSS 大字/胶囊/指标行）+ 胶囊负载分档变色 + 步耗时进度环；③ §9 语义色注册表扩编：速率强调色 + 跑分金均**复用既有 brandAccent token**（不造新色，避免双金分裂），阈值语义不变（>5GB 橙/>6GB 红）；数据链路（syncPoll/perfRecorder/perfScore）零改动——详见 PERF_BENCHMARK_DESIGN §10.5/10.6
> 版本：v5.7（2026-08-25 B43 大王反馈收窄）：§9 跑分卡坐标轴升级——① 折线图加坐标轴（左 Y 刻度按维度单位 / 底部 X 时间刻度 / 水平垂直网格 / 5GB·6GB 阈值线端点标注）+ **叠全改复合图**（PSS/功耗折线 + CPU/GPU 负载柱状 + 温度热力带），温度不再与 PSS 主色同橙撞色；② 演出层 vivid 动画（最新点呼吸光圈 + 彗星尾 + 示波器扫掠光）；③ 指标分级色全接入（温度/功耗/频率/步耗时两档阈值，正常继承中性 / 警告橙 / 危险红，不再全黑）；④ 「叠全」chip 移至**最左**（默认项排最前）；⑤ 叠全图例行（色点+通道名，虚线语义由图内端点标注承载）——详见 PERF_BENCHMARK_DESIGN §10.5
> 版本：v5.8（2026-08-26，B59 大王反馈）：① 出图/编辑按钮**任务进行期灰置 + 转圈 + 禁点**——loading（引擎加载）与 generating 同属任务期，disabled 全链路防连点；灰底（surface）+ 文字降级（onSurfaceVariant），转圈色白 → primary（灰底上可见）；此前仅 generating 转圈且无灰底，引擎加载期按钮零反馈（首次出图加载模型最耗时时最需要）；未加载（非 Dream 未选模型）不灰置引导红线不变（v4.1）；② 模型下拉**选中行圆角对齐浮层面板**——modelRow borderRadius inputSmall(8) → surface(32)，选中描边与整卡一致（音频引擎下拉复用同样式一并统一）
> 版本：v5.9（2026-08-27，UI 一致性升级）：① **叠图迷你遥测条**——反推/编辑/放大（叠图模式）挂共享 `PerfMiniRow`（折叠头「性能 ▾ + PSS 大字阈值色 + 内存/CPU/温度胶囊」+ 展开 B43 迷你折线，默认折叠一行少遮挡原图；生成 blank 页维持完整 PerfPanel 不动），跑分完整性三态齐平；② **出图按钮吸底**——出图/编辑按钮移出 ComposerPanel → 新组件 `GenActionBar` 底部吸底条（KeyboardStickyView 键盘跟随 + safe-area），提示词卡折叠后一屏可见；③ **提示词卡折叠**——折叠头单行胶囊（提示词 ▾ + 摘要 + token 计数），编辑预备态强制展开；④ **容器自适应**——running/failed 任务页 taskPage 去 overflow:hidden + 顶对齐 + minHeight 240，根治 PerfPanel 默认展开时内容超高双向裁切（顶部 WaveDots 被切）

> 上位规范：POCKETPAL_DESIGN_SPEC.md（UI 域 SSOT）

## 1. 页面结构（创造工坊 + 顶栏一行 + 单列三区 + 产物区整卡切换）v5

```
┌─────────────────────────────────────────────┐
│ 返回 │ 创造工坊 │ 滑块[生图|音频] │ 上下文操作    │ ← 顶栏一行（滑块在顶栏，上下文随 tab 切换）
│                                            │     生图：模型胶囊(短) + 加载 ｜ 音频：音频操作
├─────────────────────────────────────────────┤
│ ① 结果区（ResultPreview）= 产物区（整卡切换）  │ ← 按任务类型整卡渲染，不做图+文字双区
│    - 生图/编辑：图片（全卡，现状）             │
│    - 反推：提示词卡（✨反推提示词全文+展开收起   │
│       + 顶部 banner 胶囊「反推·模型·耗时」      │
│       + 操作行 复制/复刻生图/删除）            │
│    - 未来视频：视频播放器（同一产物区）         │
│    - 信息条/参数水印（现状）                   │
├─────────────────────────────────────────────┤
│ ② 相册（HistoryStrip）：横向缩略图 + 上传 + 管理 │
├─────────────────────────────────────────────┤
│ ③ 创作区（ComposerPanel）：提示词 + 高级参数卡   │
│    高级参数卡（默认折叠）：画幅/步数/CFG/负面/种子 │ ← 不含模型（模型只在顶栏）
│    底部按钮：[编辑][出图]                      │
└─────────────────────────────────────────────┘
```

> v5.5：音频 tab 顶栏胶囊 = 引擎选择（**与本页 triggerPill 同一设计语言** + 就绪点，屏级 overlay 下拉三选 + 行内下载/删除）；音频历史条 = 横向滚动**方形卡**（转写/生成两段隔离，点击加载预览窗口，见 AUDIO_UI_SPEC v1.7）

- 一屏原则：产物卡 + 相册条 + composer 主按钮始终可见（升级前结构回归）
- tab 状态互不干扰：生图 previewIndex / 音频工坊状态独立；切换不卸载（keep mounted）
- 音频工坊 tab 内部结构：AUDIO_UI_SPEC v1.4
- 入口：抽屉「创造工坊」（WorkshopIcon 画笔+扳手 X 交叉，v5.3 替代原「画图」CameraIcon）


## 2. 按钮组成定稿

### 结果区操作条（v4 五按钮，按任务类型分派）

**生图成功条目**（kind='generated' | 'upscaled'）：
| 按钮 | 语义色 | 动作 |
|---|---|---|
| 保存 | 绿 #2e7d32 | 存入系统相册 Pictures/AIOS |
| 放大 | 蓝 #1565c0 | 打开 UpscalePanel（P6-6） |
| 反推 | 紫 #6a1b9a（v4 登记） | 反推当前图提示词（caption 任务） |
| 再次生成 | 橙 #ef6c00 | 同参数重跑 |
| 删除 | 红 #c62828 | 删除当前图 |

**上传图（0 页编辑槽）操作条**：`反推(紫) 重新上传`——有图即反推，不区分来源。

**反推任务成功条目**（kind='caption'）：`复制(绿) 复刻生图(橙) 删除(红)`

**编辑按钮不在操作条**——编辑唯一入口 = 创作区底部「编辑」按钮（DreamLite 族），避免双入口心智分裂。

**编辑按钮可见性（v4.1，入口常驻）**：
- DreamLite：常驻（无图点击 → 提示 + 拉起相册入编辑槽）
- 通用 SD（SD3.5/Z-Image）：**预览区有可编辑图（0 页编辑槽有图或历史页有图）时同样显示**——点击弹确认「编辑需要 DreamLite」→ 确认后自动切 DreamLite + 锁定当前图 + 进编辑预备态（一次点击闭环）；SD 无编辑引擎，不隐藏入口（功能可见性），改由点按引导切换

### 反推按钮（v4 新增）
- 语义色：紫 #6a1b9a（与模型族徽章紫 #8e24aa 区分：操作按钮深一档）
- 可见性：当前预览图存在即显示（生图成功图 / 上传图）；反推进行中禁用（复用 busy 判定防连点）
- 反推是显式按钮动作（同「图片编辑」语义），不弹窗确认，加载进度可见

### 模型胶囊
- 视觉：primary 12% 底 + primary 1px 描边（与聊天顶栏胶囊同一设计语言，v3.1）
- 宽度：maxWidth 120（v5.1 缩短 1/3，原 180）——模型名超长截断（numberOfLines 1 + flexShrink）；「加载」按钮 flexShrink:0 永不收缩，始终可见（大王红线）
- 文本区（点击）：展开悬浮下拉（盖住下方内容，点外收起）
- 快速加载按钮：仅「未加载 且 不在加载中」时显示，直接加载当前选中模型，不展开下拉
- 状态文案：未加载 / 加载中… / 已就绪

### 出图按钮显式反馈（复查 2026-08-20 真机回归定稿 + v4.1 新手引导）
- **空提示词点「出图」必须显式横幅提示**（「先输入提示词，再点出图」，v4.2 起顶部横幅），不得静默无反应——此前 `if (!p) return` 静默早退导致「有动效无反应」，两台真机稳定复现；显式失败不静默（锋利原则）
- **未加载模型不禁用（v4.1）**：非 Dream 未加载时出图按钮**不再灰置**——点击弹「需要先加载模型」OverlayCard（底座 DESIGN_SPEC §12.1）→「去加载」→ 自动展开模型下拉（行内加载按钮）；再次生成 / 失败页重试走同一 handleGenerate 自动复用引导。DreamLite 未加载点出图维持引擎内部自动加载（generateDreamLiteEntry 兜底）
- **onPress 必须显式无参包装**：`onPress={() => onGenerate()}`，禁止 `onPress={onGenerate}` 直传 async 函数——RN 必传 GestureResponderEvent 作为首参，直传导致 `handleGenerate(event)` 入口 `(event ?? prompt).trim()` 抛 TypeError 被 Bridgeless 事件系统静默吞掉（2026-08-20 两台真机 + DRC 三重复现，回归引入点 commit 44689f8 加 promptOverride 参数）
- **「再次生成」= 当前图同参数重跑**：用任务自带 prompt（与失败页「重试」同源 `handleGenerate(item.prompt)`），不读当前输入框——输入框被清空/编辑预备态清 prompt 后再次生成仍有效
- **任务进行期灰置转圈（v5.8，B59）**：出图/编辑按钮在 loading（引擎加载）与 generating 期 **disabled + 灰底（surface）+ 文字降级（onSurfaceVariant）+ primary 转圈**（原 onPrimary 白圈灰底上不可见，改 primary）；编辑进行中（taskKind=edit）出图按钮灰置显示文字不转圈；未加载引导（v4.1）与空提示词横幅（v4.2）红线不变

## 9. 顶部横幅提示（v4.3，大王裁定：弃用底部 Snackbar）

生图页全部轻提示**不再使用底部 Paper Snackbar**（灰色底 + 遮挡底部按钮），统一为**预览卡片顶部横幅**：

- **形态**：absolute 定位叠在**预览卡片（ResultPreview 图区）顶部**（随卡片滚动、不占文档流），无瓷底——`ui/BannerBar` 自带语义色 12% wash + hairline（DESIGN_SPEC §12.3）直接透出；圆角容器（radius.m + elevation 4 + 阴影）裁剪 BannerBar 上下 hairline
- **两类展示**：
  - **瞬时反馈**（生成完成 / 保存 / 复制 / 反推完成 / 错误提示）：3s 自动消失 + **整卡点击关闭**（原仅 ×，v4.3 升级）+ × 可关闭
  - **状态引导**（编辑锁定「已锁定当前图（sq×sq），输入编辑指令后点「执行编辑」」）：**常驻至编辑预备态结束**（执行编辑 / 翻页 / 切模型 / 出图时随 editArming=false 消失）——由 editArming 派生渲染，不占瞬时 state，不可点关闭（状态横幅与状态同步）
- **边框内缩**：left/right 8 内缩成小卡语义，不横贯全屏宽
- **避让**：横幅显示期间预览图顶部信息条（infoOverlay）自动下移（top 8→52）不重叠
- **语义色**：error=红 / warning=橙 / 其余=info 蓝
- **互斥**：编辑预备态期间只显示常驻锁定横幅，瞬时反馈让位（避免双横幅）
- **音频 tab**：同一设计语言叠音频卡片顶部（瞬时横幅；编辑锁定为生图 tab 专属状态不展示）
- 覆盖范围：原 15 处 Snackbar 调用点全部迁移（详见 MASTER_LOG §68）

## 3. 模型下拉规则

- **DreamLite 固定置顶且默认选中**（当前唯一完整可用：4 步 1024px 约 25s）
- 实验性模型（SD3.5 / Z-Image-Turbo）排在 DreamLite 之后，带琥珀色「[实验性]」徽章
- 行内按钮：加载（主色实底）/ 卸载（红描边，二次确认）
- 族徽章彩色：SD3.5 紫 #8e24aa / Z-Image 青 #00838f / DreamLite 粉 #d81b60
- 选中行仅高亮回填参数，不自动加载（点「加载」按钮才加载）
- 选中行圆角 = 浮层面板同值（shapeRoles.surface 32px，v5.8 B59）：选中描边与整卡圆角一致；音频引擎下拉复用同样式一并统一

## 4. 生成/编辑/反推状态机视觉（v3 任务化 + v4 caption）

每次生成/编辑 = 一个持久化任务（taskId 单一 key，AsyncStorage 落盘，重启后失败任务仍在）：

- **点出图**：先落 `status:'running'` 任务条目并翻到该页 → **空白预览页 + 进度卡**（不再叠在旧图上）；成功 `finishTask` 回填图，失败 `failTask` 回填报错，页面保留。
- **编辑中**（taskKind=edit）：动效仍低不透明度叠在当前图（底图可见）；running 条目在翻页可见时同规格进度卡。
- **failed 任务页**：⚠ 图标 + 「生成失败」+ 一句话摘要（numberOfLines 3）+ 「复制报错信息 / 重试 / 删除」三按钮；复制 = errorReport 完整报告（剪贴板 + AIOS/logs 落盘）；重试 = 回填参数后同提示词重新发起。
- **报错唯一出口**：预览区 failed 任务页；composer 底部不再展示错误文本；加载失败/缺伴侣文件/解码失败同样落 failed 任务条目。
- **历史横条**：只列 success 条目缩略图（保留原始索引供翻页定位）；caption 条目显示缩略图 + 「反推」角标（复用 upload 角标模式）。
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
- 反推链路同样收编 store 单通道（captionEngine 经 imageGenStore 收口），Screen 层零直连

## 7. 反推能力规范（v4）

### 7.1 模型与调度
- 反推 VLM = Qwen3.5-4B + mmproj-BF16（MODEL_MATRIX #3/#4 已装机；社区 2026 验证反推组合）；单次 >3 分钟时评估降 2B
- 引擎 = llama.rn chat 槽：`acquire('chat')` 自动释放 prompter/image → 反推 → 释放回管家（懒恢复）
- 反推 = 显式按钮动作，直接加载 + 进度可见，不弹窗
- 聊天页发图反推与生图页同源（同一套 captionEngine），入口独立（聊天：图片消息 + 反推意图）

### 7.2 caption 任务化（入画廊，与生图任务同管理）
- `kind='caption'` 任务条目：running/success/failed 三态 + taskId 持久化（WatermelonDB）
- running：原图 + 半透明 overlay（taskKind='caption' 同编辑动效）+ 阶段文本（加载视觉模型 → 编码图片 → 生成描述）+ 累计秒数
- success：**预览卡整卡切换为提示词卡**（产物区规则）：
  - 顶部 banner 胶囊：`反推 · 模型 · 耗时`（infoOverlay 形态，点击弹参数详情：模型/耗时/提示词全文 + 「回填到输入框」按钮）
  - 主体：✨ 反推提示词全文（默认 2-3 行折叠 + 展开收起）
  - 操作行：复制 / 复刻生图 / 删除
- failed：复用报错页三按钮（复制报错 / 重试 / 删除）
- 结果同时自动回填 composer 主输入框（用户可见可改，直接点「出图」= 复刻）
- 反推输入图回看：任务信息条 + 画廊缩略图（任务存输入图引用，不占预览卡空间）

### 7.3 复刻生图（v5 并入高级参数卡，RemakeSheet 删除）
- 触发：反推产物卡「复刻生图」→ 提示词已回填主输入框，展开高级参数卡调整（默认取 composer 当前值，遵循「需要动的才暴露」）
- 参数：画幅档位（RATIOS/SD_RATIOS 分流）/ 步数 / CFG / 负面词 / seed（**不含模型**——模型只在顶栏，切模型=顶栏胶囊）
- 确认 → 直接点「出图」（handleGenerate(captionText)），不再弹 Sheet


## 8. 工坊顶栏一行规范（v5.1，滑块按钮替代双 tab 胶囊）

- 位置：AppBar 一行（返回 | 标题「创造工坊」| 滑块按钮 | 上下文操作），不再有独立 tabBar 行
- **滑块按钮（v5.2 再收窄）**：单控件 toggle——同一 pill 容器内「生图 | 音频」两段文字，高亮滑块背景跟随当前 tab（absolute 定位，无动画）；**点未选中段 = 切换，点选中段 = 不动**（防误触反复横跳）；容器整体一个视觉单元，分段宽度 48px/段（v5.2 由 56 收窄——大王反馈原宽度过宽）
- testID 零变更：workshop-tab-image / workshop-tab-audio 保留在文字段（DESIGN_SPEC §11）
- 上下文操作随 tab 切换：
  - 生图：模型胶囊（maxWidth 120，模型名截断）+ 「加载」按钮（flexShrink:0 永可见，现状语义保留）
  - 音频：音频引擎胶囊（**与生图 triggerPill 同一设计语言**：primary 12% 底 + full 圆角 + primary 1px 描边 + onSurface 文字 + ▾；就绪点内嵌；v5.5 弃独立 audioHeaderCapsule 风格；点击展开屏级 overlay 下拉——复用 ModelPickerDropdown 交互模式，行内 = 引擎名+大小+状态点 + 下载/删除按钮；SenseVoice 状态与下载在 tab 内转写段）
- 红线：模型选择不出现在高级参数卡/其他位置（只在顶栏）

## 9. 性能面板（专业跑分式监控，2026-08-23，ADR-0008 + PERF_BENCHMARK_DESIGN v0.2）

生成/加载期间实时显示本机资源占用（跑分软件式玩法，大王定调）：

- **位置与形态**：running 任务页进度卡内（三点波浪 + 进度信息下方）的**横版紧凑布局**（v2 大王裁定：卡片下半截空间，非竖状全屏）；加载期（loading）同样显示；**默认展开**（打开即见实时数据），点按折叠头可收起
- **数据源**：`HardwareInfo.getPerfSnapshot()`（1Hz，与进度轮询同频）——PSS（Debug.getMemoryInfo().totalPss，与 HyperOS 看护硬杀同口径，主指标）+ CPU%（本进程 CPU 时间差分）+ CPU 频率（大核 scaling_cur_freq）+ GPU 负载%（Adreno kgsl gpubusy / Mali devfreq 平台探测）+ GPU 频率 + 温度分区（thermal_zone type 分 cpu/gpu）+ 功耗（power_supply current×voltage，部分设备 N/A）+ 步耗时（已有 stepTime）；NPU 利用率无标准 API → 诚实模式（不编造，不显示型号小字）；所有新指标平台探测 + 失败 N/A（-1 → UI 显 `--`），不报错不兜底
- **视觉（横版三行）**：
  - 折叠头一行：`性能 ▾` + PSS 大字（GB，一位小数，阈值色 >5GB 黄 / >6GB 红）+ 指标胶囊横排（CPU% GPU% 温度 功耗）——**无设备小字行**（v1.2 去除 SoC 型号，卡片变矮）
  - 迷你曲线条：**默认叠全**（B43 复合图：PSS/功耗折线 + CPU/GPU 负载柱状 + 温度热力带（30→60°C 绿→橙→红渐变带）+ 5/6GB 阈值虚线，五通道不糊不撞色；chip 可切回单线）；**坐标轴**（B43）：左 Y 刻度按维度单位（PSS→GB / 负载→% / 温度→°C / 功耗→W）+ 底部 X 时间刻度（1Hz 采样索引差=相对秒）+ 水平/垂直网格（hairline 淡）+ 阈值线端点迷你标注（5GB/6GB）；**图例行**（叠全时色点+通道名一行）；**演出层**（vivid：最新点呼吸光圈 + 彗星尾 + 扫掠光，Animated JS driver）；叠加线 **[叠全][PSS][CPU][GPU][温度][功耗]**（**叠全最左**，大王裁定）点按切换，右端接峰值
  - 指标行：横向排列 CPU%/GPU%/频率/温度/功耗/步耗时（flexWrap 网格，每行 5 项）+ `[历史 ▷]` 入口；v1.2 面板去灰底改 hairline 顶部细线分隔（透明融入预览卡），卡片加宽（taskPage padding 6）+ 字号收紧（胶囊/标签 10pt、数值 11pt）根治手机端截切；**B43 分级色**：温度/功耗/CPU 频/GPU 频/步耗时全部按档变色（阈值见 §9.2），正常继承中性色不再全黑
  - 数据缺失（未就绪）：显示 `--`，不报错不兜底文案
- **落盘与回放**（PERF_BENCHMARK_DESIGN）：任务级 JSONL（`DocumentDirectory/perf/perf_<taskId>.jsonl`，首行 meta）——任务开始建文件、1Hz append、结束补 summary；`[历史 ▷]` → PerfHistoryModal（列表 → 回放曲线 + 统计卡 + 跑分卡）；保留最近 50 条
- **生命周期**：轮询随 syncPoll 启停（generating/loading 驱动）；停止时清空实时历史（落盘数据独立保留）
- **红线**：零新依赖（RN View 自绘 + sysfs/系统 API，无图表库）；Screen 层零直连，数据经 imageGenStore 单通道；颜色走 theme token + 本规范登记语义色
- **testID**：perf-panel / perf-expand / perf-pss / perf-cpu / perf-temp / perf-gpu / perf-history / perf-overlay-chip-* / perf-legend / perf-area-chart / perf-chart-pulse / perf-chart-sweep

### 9.2 B43 指标分级阈值（分级色注册表：正常继承中性 / 警告橙 #F5A623 / 危险红 theme.colors.error，不造新色）

| 指标 | 警告阈 | 危险阈 | 方向 |
|---|---|---|---|
| PSS | >5GB | >6GB | 高于（HyperOS 硬杀线 6291456kb 实测） |
| CPU/GPU 负载 | ≥60% | ≥85% | 高于 |
| 温度 | ≥45°C | ≥55°C | 高于 |
| 功耗 | ≥7W | ≥10W | 高于 |
| CPU 频率 | <2.0GHz | <1.5GHz | 低于（降频警戒） |
| GPU 频率 | <500MHz | <300MHz | 低于（降频警戒） |
| 步耗时 | ≥12s | ≥20s | 高于 |

温度热力带色点：30°C 复用 GPU 绿 #81C784 → 45°C PERF_WARN 橙 #F5A623 → 60°C error 红（三段插值，均既有语义色）。

### 9.3 跑分卡分数体系（PERF_BENCHMARK_DESIGN §4.3）

```
综合分 = w1×内存安全 + w2×温控 + w3×稳定性（无 stepTime 数据时三项）；有同模型速度基线时加 w4×速度
  内存安全：(6GB - PSS峰值)/6GB×100（距硬杀线余量，负值归 0）
  温控：100 - 温升率(°C/min)×10（起点→峰值）
  稳定性：PSS均值/PSS峰值×100（峰均比反向，3DMark 式）
```

每次任务结束产出跑分卡（分项 + 综合），历史按综合分排行（Geekbench 式）。


