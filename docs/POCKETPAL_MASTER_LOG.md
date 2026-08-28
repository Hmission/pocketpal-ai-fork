---
doc_id: POCKETPAL_MASTER_LOG
module: root
type: log
status: active
version: '1.0'
created: '2026-08-27'
updated: '2026-08-28'
relates:
  [
    POCKETPAL_UI_REMAINING_FIX_PLAN,
    POCKETPAL_CHAIN_AUDIT_20260826,
    POCKETPAL_CHAIN_AUDIT_20260827,
  ]
---

<!-- D-FORMAT:v3 -->

# 主工作日志 MASTER_LOG（§89-§109 归档合订）

> 背景：MASTER*LOG 此前以 .tmp/master_log*\*.txt 临时文件形式维护（§89-§109），
> 未归档到正式文档——2026-08-27 治理补课：合订为正式文档并登记 INDEX。
> 段号 §89-§98 含并行窗口记录（§96 Krea2 端侧接入评估等），§99-§109 为本窗口批次记录。
> 后续主日志段号从 §110 起，直接写入本文档。

---

## §89 跑分演出升级与基准测试总控（B39，2026-08-24）——大王裁定：跑分是安慰剂，过程才是药效

### 89.1 裁定

- 小黄鸡在跑分软件赛道深耕：数字要动、图谱要帅、色彩要丰富；分享不发公网，能发朋友圈即可。
- 基准测试 = 总测试入口 + 用例集，自动导航到聊天页/生图页跑真实负载；平时使用也有超跑感。
- 执行纪律：走门禁、文档先行、一次性规划分波长链、不挤牙膏。

### 89.2 方案（6D 洋葱排查收敛，零另造 SSOT）

- 排查发现并纠正：新建编排 store = 另造 SSOT（改为扩展既有 BenchmarkStore 瞬态字段）；bench() 合成负载无头不可见与"可见过程"裁定冲突（砍）；RNDeviceInfo 与 NativeHardwareInfo PSS 双内存通道（统一单通道）；云提交链（整体砍）。
- 锋利裁剪：用例 4→3（推理/生图/耐久，PSS 随采不单设内存用例）；雷达 6→4 轴（对齐 perfScore SSOT 不造新公式）；砍成图水印/HUD 开关/步耗时进度环（无分母不画假环）；跑分金复用 brandAccent 不造新 token。
- 新增登记：指南针 CP-APP-012（编排中断/渲染失败/分享不可用）；星图 benchmark 域。

### 89.3 代码（W1-W6 全落地）

- PerfMotion 演出引擎（三页共用）：AnimatedNumber 追式缓动（首帧锚定不演假动画、保留真实毛刺）/ OdometerNumber 逐位翻滚 / ScoreReveal 揭幕（0 狂飙→光圈+震动）。
- 聊天页：AssistantTurnFooter 行2 数值接动效 + tok/s 迷你速率条；PendingIndicator 阶段色条（二态，既有 token）+ 心跳波形（卡住/停止平坦=诚实）+ 工具期差分速率（复用 1s 心跳 interval 零新定时器）。
- 生图页：PerfPanel 条形图 → SVG 折线渐变面积图（5/6GB 阈值虚线 + 峰值打标）+ 全数字动效 + 胶囊负载分档变色；预览卡片内不溢出红线保持；数据链零改动。
- 总控台：BenchmarkScreen 原地改造（一键跑分/运行横幅/失败诚实报错/四轴雷达/段位走地鸡·战斗鸡·神鸡）；benchmarkOrchestrator 三用例状态机（复用 registerChatSender 完整调度链 + imageGenStore.generate，零新链路；1Hz 随采轨迹 → computePerfScore）；HUD 条挂聊天页/生图页（可终止）；testID 契约保留（start-test-button）。
- 砍除落地：src/api/benchmark.ts 删除、UIStore.benchmarkShareDialog 删除、bench()/高级参数 Dialog/滑杆删除、死样式清除、旧协议结果诚实标记不洗数据。
- 跑分卡分享：纯 JS 像素光栅化（七段数码管 + 5×7 点阵字，像素风致敬《牛来》）→ 既有 encodePng → RN 内置 Share（url+文本双带，url 失效文本仍带分数）；卡面零用户内容。
- l10n：benchmark.suite 段 en/zh/zh_Hant 三语落地，其余语言自动回退英文（既有机制）。

### 89.4 门禁

- tsc 0 错；jest 新增 40+ 全绿（PerfMotion 7 / PerfPanel 10 / PendingIndicator 12 / Benchmark 14 / 光栅化 4）；全量回归仅 modelCatalog 旧基线恒败（已登记）+ 全量态跨套件抖动（单跑全绿）；l10n validate 通过。
- G3/G4/G5（构建+装机+性能走查）与真机浅深双模式截图：待下窗口执行（人类模拟路径，scrcpy 监督）。

### 89.5 闭环

- 文档：PERF_BENCHMARK_DESIGN v0.6 + CHAT_UI_SPEC v4.8 + IMAGEGEN_UI_SPEC v5.6 + DESIGN_SPEC v3.20（Gap Ledger B39）+ COMPASS CP-APP-012 + 星图域登记。
- Git：commit + push（提交≠落袋，push 才闭环）。

---

## §90 基准套件真机全链路验证 + 标准负载契约三次修订（B39 收尾，2026-08-25）

### 90.1 裁定延续

- §89 跑分演出升级（B39）W1-W6 代码落地后，本窗口完成 G3-G5 真机门禁与全套件走查（K90 25079RPDCC，人类模拟路径 + DRC nav.go 导航，scrcpy 监督）。

### 90.2 真机血证三次契约修订（§10.8 定稿）

1. **新会话**：LLM 用例原在当前会话发送，历史上下文 3595 tokens 携带 → 300s 超时；改新建「基准测试」会话，干净基线。
2. **思考钉死关**：同机同模型思考开 >600s 超时 / 关 77s——跑分要可比基线不是思考链长度；`newChatThinkingOverride` 不入会话参数（真机实证），改显式 `completionSettings`（enable_thinking=false + reasoning.enabled=false）。
3. **生图同源入口**：生图赛道改 `generateDreamLiteEntry` 页面同源入口（自带按需加载），砍「预载检查」——双引擎常驻触发 OEM 内存配额（实测 HyperOS signal 9 杀进程 + PSS 5.76GB 逼近 6GB 硬杀线）。

### 90.3 全套件验证结果（10:42-10:47）

- LLM 用例 77s（10.0 tok/s）→ 生图用例 54.0s（11.6 s/步，4 步 512×512）→ 耐久 42.4/46.7/42.5s（3 轮），总时长 4m23s。
- 结果页：ScoreReveal 揭幕综合分 46 + 段位「走地鸡」+ 四轴雷达（MEM 0 / SPD -- 无基线诚实置灰 / THM 100 / STB 53）+ 套件结果卡。
- 诚实失败路径 ×3 验证：聊天模型未加载 / 生图模型未加载 / 推理超时（600s），均复位无半态。
- 分享链路：系统分享面板唤起 + 文本摘要「Pocket Chick Benchmark — Total 46/100 (MEM 0 · SPD -- · THM 100 · STB 53) · FREE RANGE CHICK」。
- 浅深双模式截图存档（.tmp/b39_result.png / b39_dark.png / b39_console.png / b39_hud_running.png / b39_llm_running.png）。
- G5：双引擎常驻 PSS 5.76GB（dumpsys meminfo）；动画 JS driver 走查无卡顿。
- HUD 用例标签修复：raw key → l10n 标签（推理速度/生图速度/温控耐久）。

### 90.4 门禁与闭环

- G3 BUILD SUCCESSFUL ×3（迭代包）；G4 覆盖安装（禁卸载纪律保持）；G5 PSS 实证。
- tsc 0 错；相关套件 18/18、40+ 新增用例全绿；l10n validate 通过。
- 文档：PERF_BENCHMARK_DESIGN v0.7（§10.8 契约定稿 + 变更日志）+ CHANGELOG Unreleased 补真机闭环行。
- Git：commit + push（提交≠落袋）。

---

## §91 生图页横幅改造：预览卡片顶部 + 整卡点击关闭 + 弃灰底（大王反馈，2026-08-25）

### 91.1 大王反馈

- 生成任务完成后的弹窗横幅出现在页面中间（屏级 absolute top:458 硬编码），且压住历史区/创作区；要求：移到生图预览卡片顶部弹出（只压预览卡片）、点卡片即消失、不要灰色底；同时扫描全页同类弹窗卡片。

### 91.2 扫描结论（全页弹窗盘点）

- **BannerBar 轻提示横幅**（本次改造）：①瞬时 banner（生成完成/编辑完成/保存/复制/反推/警告/错误，showBanner 3s）；②编辑锁定常驻横幅（editArming 派生）——两处原共用一个 bannerWrap（top:458 屏级 + surfaceElevated 灰卡底）。
- **正规弹窗/面板**（不动）：OverlayCard 居中弹窗 ×2（图片参数/未加载引导）、UpscalePanel 底部 Sheet、confirmDialog、ModelPicker 屏级下拉、音频引擎下拉、全屏查看 Modal。

### 91.3 改造落地

1. **位置**：横幅从屏级 absolute 移入 ResultPreview 图区（resultWrap）顶部绝对定位——只压预览卡片，不压历史区/创作区；随卡片滚动，不再硬编码 top。
2. **弃灰底**：bannerOverlay 容器删除 backgroundColor surfaceElevated——BannerBar 语义色 12% wash 直接透出（error 红/warning 橙/info 蓝）。
3. **整卡点击关闭**：瞬时横幅 BannerBar onPress=onDismissBanner（保留 ×）；编辑锁定常驻横幅 dismissable=false 不可点（状态与 editArming 同步）。
4. **避让**：横幅显示期间预览图顶部信息条（infoOverlay）下移（top 8→52）不重叠；caption 反推卡信息条同步处理。
5. **音频 tab**：AudioWorkshopTab 新增 banner/onDismissBanner props，同设计语言叠卡片顶部；编辑锁定为生图 tab 专属状态不展示。

### 91.4 门禁与闭环

- tsc 0 错；Panels/AudioWorkshopTab 测试 29/29 全绿（新增横幅渲染 + 整卡点击关闭 + 常驻不可点回归用例）。
- 文档：IMAGEGEN_UI_SPEC v4.3（§9 重写 + 版本行）+ DESIGN_SPEC 3.19（§12.4 修订 + 版本记录）+ CHANGELOG Unreleased 改进段补行。
- 结构：ImageGenScreen 派生 previewBanner（editArming 常驻优先）→ ResultPreview/AudioWorkshopTab 消费；styles.ts bannerWrap → bannerOverlay + infoOverlayPushed。
- 待真机 K90 验证：浅深双模式横幅观感（语义色 wash 叠图上可读性）与信息条避让。

---

## §92 UI 规范全局整理 + 工程基建根因修复（大王决策四项，2026-08-25）

### 92.1 大王决策（AskUserQuestion 四项拍板）

1. 基建根因：修（.gitattributes + 全仓行尾归一）；2. 文档更新：升版+登记批次；3. 顺手修复：修小项；4. 治理优先级：按风险排期。

### 92.2 全仓 UI 体检（三 Agent 并行扫描 + eslint 全量统计）

- **token 背离**：间距裸数字 1,105（~220 无档位 6/10/14/3/18/28）、圆角 145（~45 无档）、字号 261（22 处 9/10px 破可访问性红线）、颜色 16；最密集 ImageGenScreen styles 163 / ModelCard 65 / TTSSetupSheet 61 / ChatInput 58；整文件裸奔 DatabaseInspectorScreen（47 vs token 1）。
- **弹窗范式**：主航道已收敛（OverlayCard 7/Sheet 13/BannerBar 8/Snackbar 8），遗留 Paper Dialog ×2、原生 Alert ×10、未登记裸 Modal ×1（PerfHistoryModal）。
- **布局/重复**：94 处 absolute 定位（高危 3：EmbeddedVideoView bottom:180、DownloadOverlay 左右不对称、全屏查看器锚点族无 safe-area）；三点加载动画 ×3、chip 样板复制（ui/Chip 零引用）、进度条 4 套 + paper 混用。
- **基建黑洞**：无 .gitattributes + autocrlf=true → 检出 CRLF vs prettier 期望 LF → eslint 152,659 错误中 152,443（99.9%）为行尾噪音，质量门禁完全失效。

### 92.3 本次落地

1. **B44 基建门禁恢复（✅）**：新增 .gitattributes（文本 eol=lf + 二进制白名单 + bat/ps1 保留 CRLF）+ .editorconfig；全仓 2,968 个跟踪文件行尾归一（git 索引本就全 LF，diff 零污染）；**7 个误转二进制（3 onnx + 4 webm）git checkout 恢复 + hash-object 逐一对账无损**；CRLF 噪音归零，eslint 152,659→1,498（真 prettier 1,282 挂 B50）。
2. **B45 字号红线（✅）**：22 处 9/10px → captionS（11/14），覆盖 8 文件；tsc 0 错 + 7 套件 130 用例全绿。
3. **B46 首项（✅）**：PerfHistoryModal 裸 Modal → Sheet 底座（列表/回放双态 + 二级导航 + 不可见不渲染同 OverlayCard 契约；hooks 顺序守卫）；PerfPanel/BenchmarkScreen 28 用例全绿。
4. **DESIGN_SPEC v3.20→v3.21**：正文版本行 3.0 不一致修正；Gap Ledger 补 B44-B50 + B39 翻 ✅；变更日志合并上轮误登记 3.19 为 3.21 综合条目。
5. 文档：CHANGELOG 改进段补行；CURSOR_DOC_USAGE 无需改（索引不变）。

### 92.4 遗留（登记批次，待大王排期执行）

- B46（执行中）：Paper Dialog ×2 迁移 + Alert ×10 裁定 + Sheet 直连旁路评估
- B47：token 野档清理（间距/圆角/字号档位对齐 + 整文件裸奔重点）
- B48：重复组件收敛（三点加载三合一/chip 样板/进度条统一）
- B49：布局安全锚点（查看器族 safe-area/DownloadOverlay 不对称/EmbeddedVideoView 混排）
- B50：存量 prettier 1,282 处格式化清理 + lint 入 pre-commit
- SquarePalCard 字号恢复 11 后固定高度卡片待真机复核

---

## §93 B46/B50 执行：prettier 清零 + 弹窗范式收尾（2026-08-25，承接 §92 治理批次）

### 93.1 B50 存量 prettier 清理 + 门禁固化（✅）

- 全仓 src（ts/tsx/js/jsx/json）prettier --write：**1,282 处存量格式差异清零**（195 文件；未动 md/json 全仓，避免无关大 diff）。
- 门禁：package.json 新增 `lint:prettier`（prettier --check src）+ husky pre-commit 追加该检查（commitlint/worktree guard 保留）；.gitattributes 补 `.husky/* eol=lf`。
- 结果：eslint src 152,659 → 216（全部为规则问题，prettier 0）；tsc 0 错；广谱回归 131 套件 1460 通过（2 skip）。

### 93.2 B46 弹窗范式收尾（①②③✅，④待裁定）

- **Paper Dialog 4 处全迁 OverlayCard**：ModelsResetDialog（2 动作，测试的 backdrop onDismiss 用例改点 scrim）、DownloadErrorDialog（多动作槽→primary/secondary 两档 + viewOnHuggingFace 下沉 body 链接）、BenchmarkScreen×2（删除确认 + 清空确认，testID 保留）；**OverlayCard Actions 增 testID 字段**（ui/Button 支持，DS 向后兼容）。
- **休眠 components/Dialog 删除销账**：4 文件（Dialog.tsx/index/styles + 测试），全仓引用清零（BenchmarkScreen 批量导入已改）。
- **4 套件测试同步用户存量 Alert→infoDialog 迁移**：ModelsScreen/ModelFileCard/ProjectionModelSelector/ChatGenerationSettingsSheet——用户工作区存量改动（Alert→infoDialog）未同步测试导致全红；逐一同步断言（infoDialog mock + 参数形状），全绿。
- **B46 ④遗留**：Alert.alert ~25 处源码使用点（ChatInput 5/HeaderRight 4/EmbeddedVideoView 2/ContentReportSheet 3/ModelErrorReportSheet 2/ModelsScreen 2/ModelFileCard 2/ProjectionModelSelector 2/PalGenerationSettingsSheet 1 等）——多按钮确认与通知语义，统一迁移或豁免需大王裁定（机会：用户存量已在动手迁移 Models 域）。
- ⑤Sheet 直连旁路（ChatPalModelPickerSheet/SearchView @gorhom 直连）评估未做，挂账。

### 93.3 文档

- DESIGN_SPEC v3.21→3.22：Gap Ledger B46/B50 状态更新 + **新增 B51**（eslint 规则问题 216：no-inline-styles 59/no-bitwise 42/no-void 32/no-unused-vars 31/no-useless-escape 18/exhaustive-deps 13 等，76 文件，完成后 eslint 全量入 pre-commit）+ 变更日志 3.22。
- CHANGELOG 改进段补行。

### 93.4 门禁现状

- pre-commit：guard:worktree + lint:prettier（格式防线）
- CI：yarn lint（eslint .）+ typecheck + jest（既有）
- eslint 全量入 pre-commit：待 B51（216 规则问题清零）
- B51 / B47（token 野档）/ B48（重复组件）/ B49（布局锚点）执行待排期

---

## §94 B51 执行：eslint 216 规则问题清零 + 门禁完整闭环（2026-08-25，承接 §93）

### 94.1 达成

- **eslint . 全仓 0 错误 0 警告**（进度：152,659（CRLF 噪音）→ 1,498（B44）→ 216（B50）→ 0（B51））。
- pre-commit 三闸：guard:worktree + lint:prettier + eslint 全量 lint（B50/B51 完成条件全部兑现）。

### 94.2 修复明细（216 = 按类）

1. **no-inline-styles 59**：30 文件内联样式迁 styles（2 agent 并行：A 组 components 15 文件 / B 组 ui+screens 19 文件）；动态样式（opacity/宽度百分比/条件 fontWeight）走「基+态」样式键 + 组件内构造变量；IconTile 测试改用 StyleSheet.flatten 断言适配数组形态。
2. **no-bitwise 42**：PerfAreaChart（SVG 颜色通道解析）/ pngUtil.test（PNG IHDR）/ sherpaConvert（sherpa .bin 契约）——二进制解析正当用途，文件级 eslint-disable 注释带理由。
3. **no-void 32**：eslintrc `allowAsStatement: true`（void promise 语句级 fire-and-forget 惯用法合法化，表达式形式仍拦）。
4. **no-unused-vars 31**：删 import/死代码（kept 已被 realKept 取代、conversationCache 已迁 searchEngine）；参数 \_ 前缀；5 处「赋值有副作用」保留调用去变量名（beginTask spy/toyChest saveToy 等）。
5. **no-useless-escape 18**：字符串 \" 与正则字符类 \- 字面量安全去转义（jest.config 两处已注明匹配范围理论扩宽、实际零影响）。
6. **exhaustive-deps 13**：MobX observer 本地读桥接（observable 属性→渲染局部变量入依赖，ChatPalModelPickerSheet/ChatScreen/ImageGenScreen/AudioWorkshopTab）；handleQuickLoad 用 latest-ref；header effect 样式键移除 + 单行 disable；AudioWorkshopTab 复杂表达式提取变量。
7. **unstable-nested 9**：SessionListItem×4/MemoryScreen×3/ToolScreen×2 → 模块级 render helper（render prop 改函数调用表达式）；App.tsx 3 处 React Navigation API 契约函数豁免注释。
8. **其余 7**：no-shadow 6（重命名）+ dot-notation 2 + unused-disable 1 + valid-expect 1（补 await）+ control-regex 1（sanitize 有意排除 C0，豁免注释）+ deep-imports 1（Blob 深导入→RN 全局 polyfill）。
9. **连带根文件**：scripts/App.tsx/根 mocks prettier 清理 + .eslintrc overrides 补 scripts node+es2021 env（Atomics 在新版 globals 归 es2017+）。

### 94.3 同期测试同步（用户存量迁移闭环 +2）

- IconTile.test：样式数组 flatten 断言（Agent 迁移后 props.style 形态变化）。
- useDeepLinking.hubRun.test：Alert.alert→infoDialog 断言同步（源文件为工作区存量迁移）。

### 94.4 门禁现状（最终态）

- **pre-commit**：guard:worktree + lint:prettier + eslint 全量 lint
- **CI**：yarn lint（eslint .）+ typecheck + jest + l10n/fonts 校验（既有）
- **eslint .**：全仓 0 错误 0 警告；tsc 0 错；广谱回归 142 套件 1549 用例全绿（2 skip）

### 94.5 遗留

- B46 ④：Alert.alert ~23 处源码使用点（本轮又同步 2 处测试，源码迁移数未变）待大王裁定
- B47（token 野档 1105+145）/ B48（重复组件）/ B49（布局锚点）执行待排期
- DESIGN_SPEC v3.20→3.23，变更日志 3.23，CHANGELOG 改进段补行

---

## §95 全量链路审计 + B52 收尾（2026-08-26，产出 CHAIN_AUDIT_20260826 全面方案报告）

### 95.1 门禁走查（守卫 hook 指南针全链路）

- pre-commit 三闸（guard:worktree / lint:prettier / lint=eslint .）✅ 全绿；tsc ✅；l10n:validate ✅；verify-fonts ✅
- jest 全量：4559 通过 / 8 失败 7 套件——invariants（本次引入，已修）+ ModelStore/AboutScreen/modelCatalog/contextCompaction/modelContextDefaults/exportUtils/androidPermission（全部与用户并行窗口在途改动同源，工作区 diff 实证）
- git：219 文件消失事件已恢复（全量干净，仅 Dialog 4 文件留痕删除）；B44-B51 改动未提交（窗口收口必 push 待执行）

### 95.2 上轮欠账复核（08-25 → 08-26 代码实证）

- ✅ 真落码：TTS 镜像（constants.ts hf-mirror）/ 写作 tab（KnowledgeScreen 'writing'）/ 孤儿删除（SearchProviderKeySheet 不存在）/ 文档销账 7 项
- ⚠️ 部分：InfoDialog 信息型已收编、确认型 Alert ~23 处无批次挂账（已挂 B52③）；全文朗读 API 在、长按菜单缺（B52② 本次已落）
- ❌ 账实不符：图标收口声称零残留 vs 实际 12 处（B52① 本次已清）
- ❌ 未动：肥件拆分/单槽 v2（挂 B54）

### 95.3 本窗口（B44-B51）闭环确认 + 自纠

- B44/B45/B46①②③/B50/B51 全部 ✅（证据：eslint 0/0、字号 grep 清零、prettier 全绿可复现）
- 自纠：invariants 白名单补 DownloadErrorDialog（B46 迁移引入，DESIGN_SPEC §7 要求每波同步——已修复 4/4 绿）

### 95.4 B52 执行（CHAIN_AUDIT_20260826 发布即执行）

- ① 图标收口 12 处 `size={20/24}` → `theme.iconSize.m/l`（ChatInput 7/EnhancedSearchBar 3/ChatView 1/ModelsHeaderRight 1+useTheme 补齐）；grep 零残留
- ② 长按菜单「全文朗读」：ChatView menuItems speak 项（isSpeakableMessage+isFinalMessage+ttsStore.play 复用，voice 缺失引导 setup）+ l10n speak 三语（en/zh/zh_Hant）+ 测试 mock 补 iconSize（ChatInputThinking/EnhancedSearchBar）
- ③ 确认型 Alert 迁移 confirmDialog：Gap Ledger 挂 B52③ 子批（UI_INTERACTION_SPEC §7 既有规范）
- 门禁：prettier 6 文件（含并行窗口 2 个未格式化文件）修复；52 套件 716 用例全绿

### 95.5 文档治理

- DESIGN_SPEC 3.24（Gap Ledger 挂 B52/B53/B54 + 变更日志；「v3.24 起挂账必挂批次号」）
- 新审计报告 POCKETPAL_CHAIN_AUDIT_20260826.md（6D 洋葱诊断 + 行动方案 B52-B54 + 防误伤边界 + 正向确认）
- INDEX 补 20260825/20260826 审计登记；DEV_BACKLOG P1#1 销账（08-25 K90 依据）；星图勘误补治理批次 + 219 事件
- CHANGELOG 补行

### 95.6 双证制（机制落账）

- 「落码 = 代码证据（grep/测试）+ 测试绿」双证校验后才许预记账；挂账必挂 Gap Ledger 批次号；每窗口收口必 push（防 219 事件/预记账/挂账断链再犯）
- 遗留：B53（红测试，待并行窗口收口对齐）/ B54（肥件+单槽）/ B52③（确认型 Alert）

---

## §96 Krea2 端侧接入评估窗口闭环（2026-08-26，本机验证 + K90 真机基准 + badge 纠错）

### 96.1 背景与动因

- 用户提出：新模型（Krea2 Turbo 12.9B）无手机端侧版本，量化算力成本如何、本地能否自量化、能否针对手机 SoC 定制。
- 侦察结论先行：引擎 stable-diffusion.cpp fork 已于 2026-06-25 合入 Krea2 支持（krea2.hpp 797 行，28 层×6144 宽/GQA/gated sigmoid attention/3D axial RoPE），本机 sd-cli 可跑；量化 RTN（Q4_K_M）本地 1 小时内可完成（RTX 3090Ti 24GB + 32GB RAM）。

### 96.2 本机桌面验证（Windows / 3090Ti）

- 模型源：realrebelai/KREA-2_GGUFs（社区 GGUF）+ Qwen3-VL-4B-Instruct-GGUF（官方 TE）+ Comfy-Org Wan2.1 VAE（魔搭 37MB/s 秒下，hf-mirror xet 链不稳定）。
- **Q4_K_M sha256 与 HF 官方一致（273a98be...）**；Q8_0 首下 sha256 MISMATCH（43f588 ≠ b98b33，多线程断传重试合并错位）→ 删除重下中（断点续传工具已沉淀 v3：手动跟随重定向 + 签名缓存 TTL + part 截断合并）。
- CPU 出图链路全通：Q4 三 prompt（人像/街景/文字牌）全健康（均值 ~114/std ~47/无白图），8 步 512px 全链 CPU 约 8 分钟/张。
- **桌面 CUDA 后端缺陷（上游未修，非端侧问题）**：DiT 在 CUDA 上 step 1 即全 NaN（Q4/Q8、FA 开/关、新旧源码均复现）→ 白图；TE 在 CUDA 上 91% NaN（--backend te=cpu 可规避）；分诊证明 VAE CUDA 正常。与手机 OpenCL 路径无关，真机不受影响。
- 量化工具链沉淀：llama-cpp-python 0.3.35（llama_model_quantize API，架构无关）+ gguf 库（GGUF 元数据/完整性校验）。

### 96.3 K90 真机基准（Adreno 840 / 16GB RAM（Pro Max，大王纠正）/ 可用 ~10GB / HyperOS 配额线待实测）

- 接入三件套：ImageGenJNI.cpp 把 krea2 并入 qwen_flow_family OpenCL 治理组（DISABLE_ADRENO_KERNELS=1 + XMEM 真关）；manifest/catalog 新增 krea2-turbo-q4 条目（gpuPolicy high-adreno-only + experimental）。
- **加载成功**：`Version: Krea2` + 架构识别正确；参数预算 **9938.26MB 全映射 OpenCL VRAM**（TE 2813.50 + DiT 6882.66 + VAE 242.10），而设备 OpenCL 全局内存仅 **7506MB**（单次分配上限 2048MB）。
- **生成三连杀（三次均 OOM 强杀，无 native crash）**：
  - 08:35:05 pid 28447 die（fg TOP）/ 08:41:58 pid 22154 / 08:46:02 pid 5473
  - debug.log 均在 `generate_image begin` 后戛然而止（人证：UI 进度转圈后 App 消失，回到系统桌面）
  - 根因：9.9GB 预算 + 采样 compute buffer（UMA 共享物理内存）超设备承载 → lmkd 杀前台；"回到天气页面"为系统回桌面行为，非 App 导航。
- **最终判定（修订）：K90 实为 16GB RAM（可用 ~10GB），初始判定基于 12GB RAM 假设有误；9.9GB 全驻留仍超 10GB 可用 + buffer → 三连杀事实不变，但 te=disk（省 TE 2.8GB）+ 图切段后峰值 ~9-10GB 贴线有戏 → 降为"待第二轮治理验证"（96.7 已执行），不再维持"不可用"断言**；其他 12GB 机型维持不可用。

### 96.4 badge 纠错（大王指正）

- Krea2 是 Krea AI 自研模型，与 FLUX 无关；原 family='flux' 导致徽章误标 [FLUX.2]。
- 修复：ModelFamily 独立 'krea2'；FAMILY_BADGE[Krea2]；双主题色 badgeKrea2（亮 #E65100 / 暗 #FFAB91）；styles/渲染分支/PROMPT_TOKEN_LIMIT（256）同步；tsc 零错误。

### 96.5 Klein 速度异常发现（顺带取证）

- K90 debug.log 中 Klein（steps=4 cfg=1.00）存在 **backend=CPU 段耗时 4.92 小时（17717556ms → UI 显示 17717.9s）**——用户"最近一次执行时间好长"的来源。
- 同一日志前一 Klein 段为 **backend=OpenCL 且 4.4 分钟成功**（265549ms）→ OpenCL 正常、CPU 异常慢；慢因是**后端降级为 CPU**（疑似 OpenCL hang/失败后 JS 侧显式回退，imageGenStore backend 保存机制），**与 Mali 兼容改动无关**（Mali 分支仅影响 Mali 设备）。需 B 后续跟进：查 Klein 加载为何回退 CPU（超时窗口/OpenCL 失败重试路径取证）。

### 96.6 后续待办

- B-Krea2-1：Q8_0 重下（首次 sha MISMATCH）——hf-mirror 网络抖动暂败，待网络恢复重试；完成后本机 Q8/Q4 画质对比（可选）。
- B-Krea2-2：Klein backend 回退 CPU 根因调查（96.5）。
- B-Krea2-3（已执行）：16GB 实机 te=disk 治理验证（96.7）。

### 96.7 第二轮治理（B-Krea2-3 执行结果：失败定论）

- 大王纠正：K90 实为 **16GB RAM（Pro Max），可用 ~10GB**（非 12GB）→ 重启验证。
- 方案：JNI 对 krea2（Adreno 非 Mali）启用 `params_backend="te=disk"`（TE 2.8GB 流式）→ 构建、安装、真机再测。
- **结果：仍崩，但性质变了——从 OOM 强杀变为 native SIGABRT**：
  - 10:29:46 `ggml_vec_dot_f16 ... assertion "!isnan(sumf) && !isinf(sumf)" failed`（tombstone_26）
  - 根因：te=disk 把 TE 赶到 CPU；Krea2 TE 值域极端（cond 输出 ±1e10，桌面 CPU 已验证），
    ARM CPU 的 f16 中间存储（超 65504 → Inf）→ 点积断言炸。桌面 x86 fp32 路径无此问题。
  - 即：**TE 在 OpenCL = 总内存 9.9GB 超 10GB 可用 → OOM；TE 在 CPU = ARM f16 精度溢出 → SIGABRT**。
- **最终判定（定稿）：Krea2 12.9B Q4_K_M 在 K90/16GB 上双门槛不可用**（内存 + ARM CPU 精度）；
  除非上游修 ggml ARM f16 中间精度 + 更大内存设备（≥24GB）才有再试价值。te=disk JNI 改动已回滚（防误用）。
  维持 experimental + high-adreno-only，catalog 保留条目（文件已在三台设备）。

### 96.8 遗留项收尾（2026-08-26）：Klein CPU 根因实锤 + 三台模型目录归一 + Q8 下载受限

- **B-Krea2-2 实锤（Klein 4.9h CPU 段根因）**：K90 设备端 `klein-q4km.manifest.json` 声明
  `"backend": "CPU"`——8-25「CPU 终极对照实验」残留配置，覆盖 manifest 内置 OpenCL 单点决策
  （note 原文自证）；并非旧 APK / 回退机制 / Mali 兼容改动。修复：K90 的 unsloth 文件
  改名为标准名 `flux-2-klein-4b-Q4_K_M.gguf` 并删除 CPU 残留清单（设备端 mv/rm，按留痕规约登记于本行）。
- **三台模型目录归一**（删除理由：leejet Q4_0 已双端定罪马赛克废弃；K90 另有 03-29 旧 q4km 无引用）：
  - aab688d9（K90）：删 `flux_klein_4b_q4_0.gguf`、`flux_klein_4b_q4km.gguf`、`klein-q4km.manifest.json`、空 krea2/ 目录；`flux2_4b_unsloth.gguf` → 改名标准名。
  - 66b1777f（13 Ultra）：删 `flux_klein_4b_q4_0.gguf`。
  - P7AAJZS8Q4C6BAUC（K Pad）：删 `flux_klein_4b_q4_0.gguf`、冗余扩展清单 `flux-klein-4b-q4km.manifest.json`（与内置条目重复会出双 Klein）。
  - 归一后三台生图模型件完全一致：Krea2 三件套 + Klein 标准名 + flux2_vae + sd35/zimg 既有件。
- **Q8_0 重下受限**：hf-mirror 连接持续被中止（ConnectionError 10053 连续 4 轮 × 12 次重试），
  非工具问题（Q4 同链路已成功）；网络恢复后再试；Q8/Q4 画质对比为纯本机可选任务，不阻塞。
- 母仓 F:\klein_dl\flux_klein_4b_q4_0.gguf 未动（电脑端源，如清理另行登记）。

### 96.9 Q8/Q4 对比终止（2026-08-26）：Krea2 Q8_0 上游缺陷定案

- Q8_0 重下成功：改走**魔搭源**（modelscope.cn/models/realrebelai/KREA-2_GGUFs，resolve 200），
  13.6GB / 587s / 23.2MB/s 稳定；**sha256 复核 MATCH（b98b3390...）**——文件完整正确。
  （经验：hf-mirror 对 xet 文件当日持续 ConnectionError 10053 抖动 4 轮 × 12 次重试全败；
  魔搭 resolve 稳定且快，后续大文件下载优先魔搭。）
- **Krea2 + Q8_0 + CPU = step 1 起全 NaN（65536/65536），与 FA 开关无关**（有 FA/无 FA 均复现）；
  CUDA 后端对 Krea2 本就全 NaN（96.2 已录）。即 Q8_0 格式在 Krea2 推理路径双侧不可用——
  上游 stable-diffusion.cpp 对 Krea2 Q8_0 权重的支持缺陷（Q4_K_M 同链路正常，排除引擎/文件其它因素）。
- **结论：Q8/Q4 画质对比终止**（Q8 无法出图），不阻塞（纯本机可选任务）。
  后续若上游修复 Q8_0 路径，已备好 run_q8_cmp.ps1 + 完整 prompt 集可直接重跑。

### 96.10 Git 提交核验（2026-08-26）：并行提交后补漏闭环

- 并行窗口收口后，大王指示核验本窗口变更是否被回滚覆盖 → 核查结论：
  - 本窗口 12 文件**全部落库无丢失**（7 项关键标记逐一比对 HEAD：krea2-turbo-q4 / family krea2 /
    badgeKrea2 / modelCatalog Krea / JNI Krea 治理 / InfoDialog 路径 / DESIGN_SPEC 徽章表），
    随并行提交 3f7d02a（B59）入库。
  - 发现两处本窗口遗漏并补交（**302dac3**，docs+test）：① MODEL_MATRIX §2 登记 Krea2 第 5 件
    （B53 所指中间态）＋Klein 行同步 08-25 换源（leejet Q4_0 → unsloth Q4_K_M）；② modelCatalog.test
    断言 4→5 + Krea2 extras 断言（jest 13 passed / tsc 0 错 / prettier 通过）。
  - guard 剩余 ⚠️ 规则 SSOT 缺失 6/6 为仓库级 warn（治理规则文件待建），不影响提交。
  - 提交信息草案已用；工作区本窗口相关残留为零。窗口闭环。

---

## §97 B52③ Alert 迁移收尾 + B53/B54 状态（2026-08-26，承接 §95）

### 97.1 B52③ 执行（✅ 两子批完成）

- **信息型 → infoDialog（19 处）**：HeaderRight 4 / PalHeaderRight 3 / EmbeddedVideoView 2 / AuthSheet 9（校验/认证/成功提示）/ PalDetailSheet 2 / ContentReportSheet 3 / SidebarContent 4 / ChatInput 5 / exportUtils 2 / ModelErrorReportSheet 2 / PalGenerationSettingsSheet / DevTools 1 等（1 agent 并行 + 本窗口补齐）
- **二元确认型 → confirmDialog（17 处）**：MemoryScreen 3（删除/治理/清空，destructive 语义保留）/ ModelDirs 1 / ModelFileCard 2 / ProjectionModelSelector 2（删除+重载）/ ProfileSheet 登出 / VoicePicker 引擎删除 / DevTools Reset Migration / GenerationSettings 清缓存 / SquarePalCard 3（下载/切模/删除）/ ServerDetails 删服务器（去掉 native alert setTimeout(300) hack——confirmDialog 为 RN Modal 层）
- **测试 12+ 套件全量同步**（ConfirmDialog mock resolve(true) + infoDialog 断言）：ProjectionModelSelector 11 / ServerDetails / PalGenerationSettings / ModelFileCard / SquarePalCard 28 / AuthSheet / PalHeaderRight / exportUtils / EmbeddedVideoView / PalDetailSheet / ChatInput 等——277 用例全绿
- **特殊保留 8 处（挂 B55 专项）**：ModelsScreen 148 服务器多选列表 / 226 文件三选一（Promise 封装）/ ModelStore 2087（用户并行窗口在途文件，不碰）/ exportUtils 343·400 带动作按钮（分享/保存）/ androidPermission 152 带动作（去设置）/ safeAlert 封装（平台守卫）
- 门禁：eslint . 0 错 + prettier 全绿 + tsc 0 错

### 97.2 B53 状态（🔵 在途确认）

- modelCatalog 断言 4 vs catalog 5：**Krea2 Turbo 为并行窗口 08-26 新准入**（§96 记录在案：Krea2 端侧接入评估窗口；modelCatalog.ts 已加入、MODEL_MATRIX 未登记）——在途中间态，**不擅自改断言**，待 MODEL_MATRIX 登记后同步
- 并行窗口在途测试（ModelStore 策展表 v2 24576→32768 / AboutScreen 134 行改动等）待收口对齐

### 97.3 B54 评估完成（✅ 实施待并行窗口收口）

- engineMutex 纯协调器无需改（EXCLUSIVE_PAIRS 已含 prompter↔chat / chat↔image）
- 单槽 v2 联动（生图加载 ⇒ 文本槽管家就绪）应在**编排层**（imageGenStore.loadModel 前置管家检查）实施
- ModelStore 正被并行窗口在途修改（策展表 v2，08-26）——窗口末不做高风险架构改动（锋利原则），肥件拆分同挂后续

### 97.4 文档

- DESIGN_SPEC 3.24→3.25：B52 ✅（③两子批+特殊保留挂 B55）/ B53 在途 / B54 评估完成 + 变更日志 3.25
- CHANGELOG 补 B52③ 条目
- 遗留批次：B55（特殊保留 8 处专项）/ B53（并行窗口收口后）/ B54（并行窗口收口后）/ B47（token 野档）/ B48（重复组件）/ B49（布局锚点）

---

## §98 遗留队列全量排查 + UI 修复升级方案（2026-08-26，产出 POCKETPAL_UI_FIX_UPGRADE_PLAN）

### 98.1 方法

门禁基线（三闸全绿 + tsc 0 错 + 关键套件 110 用例绿）→ 三专工路由（带规则包：红线/星图域/文档指针/交付契约）分部调研 → 6D 洋葱诊断 → 星图域切分核对。

### 98.2 关键调研结论

- **B53 修正**：红测试 7 套件 → 2 套件（B52③ 测试同步后 exportUtils/contextCompaction/modelContextDefaults 已恢复 PASS）；剩余 2 项全确证**并行窗口在途**（modelCatalog Krea2 目录 81 行未暂存 + androidPermission InfoDialog 迁移链拉爆 RNFS mock），我方零引入
- **B47**：间距 1110（无档 230）/ 圆角 144（无档 48）/ 字号 267（越档 27 含 40px 大标题）/ 颜色 116 处 64 值；9/10px 清零确认
- **B48**：LoadingBubble 零引用僵尸（删一合一）；ui/Chip 缺 outline 变体 = 零引用根因；进度条 6+1 套；paper Switch 14 处直用（ui/Switch 零引用）——DS"建而不用"机制性根因
- **B49**：4 文件（TextMessage/ChatView/DownloadOverlay/EmbeddedVideoView）insets 方案 + 2 小锚点 spacing 表达式；EmbeddedVideoView flex-end 流式重构
- **B54**：ModelStore facade+mixin 拆分 5 模块（MobX 约束：字段/computed/persistable 留 facade，切分点绕过在途策展表）；单槽 v2 = imageGenStore 两入口前置 promptWriter.ensureLoaded()（幂等+显式降级非硬闸门）

### 98.3 方案产出

- docs/POCKETPAL_UI_FIX_UPGRADE_PLAN.md：B55-B60 六批完整设计（含验收标准/豁免登记）+ 6D 诊断 + 机制修正两条（DS 落地闭环 + invariants 裸数字巡检）+ 执行波次
- INDEX 登记
- 待大王裁定：①token 档位补档（spacing 6/10/14/3、radius 若干、40px 大标题档）②执行波次确认

### 98.4 门禁现状

三闸全绿；遗留队列全部可执行、无挂账断点；B59 需专用窗口（涉 ModelStore 在途边界）。

---

## §99 B55①带动作迁移 + B58 布局锚点 + 弹窗函数/呈现拆分（2026-08-26，承接 §98）

### 99.1 B55① 带动作 Alert → confirmDialog（✅ 3 处）

- exportUtils 343/400（File Saved+分享 / SaveOptions）→ confirmDialog（分享为主动作，取消=关闭/知道了）
- androidPermission 152（去设置）→ confirmDialog（去设置为主动作）

### 99.2 架构修复：命令式弹窗函数与呈现层拆分（✅ B58 附带）

- 新建 ui/ConfirmDialog/api.ts + ui/InfoDialog/api.ts（零 React 依赖：options/listener/register/命令式函数）
- Host 组件经 register 挂接（unregister 注销）；对外 re-export 保持 API 兼容（isolatedModules 下类型 export type）
- 工具层（exportUtils/androidPermission）改引 api 路径——根治 utils→呈现链（hooks→theme→paper）import 期崩溃（此前 exportUtils/androidPermission 测试 suite failed to run）

### 99.3 B58 布局安全锚点（✅ 全 6 处）

- TextMessage 查看器 close/save 钮 → insets.top/bottom + spacing.m（刘海机不贴槽）；right 归 spacing.ml
- ChatView viewerEditButton → insets 透传（createStyles 增参），与 TextMessage 保存钮同表达式归一
- DownloadOverlay left/right 50/45→spacing.xxl 对称化
- EmbeddedVideoView 三层 absolute（5%/11%/180px）→ flex-end 流式（response→interval→controls + margin token），单锚点
- 小锚点：infoOverlayPushed top:52 → spacing.xxl+sm；captionFab bottom:44 → spacing.xxl+xs
- 测试：EmbeddedVideoView mock 补 spacing 面（13 用例曾以 reading undefined 崩，已修复全绿）

### 99.4 token 档位裁定（技术自决，§98 待裁定项闭合）

- spacing 不扩档：6/10/14/3 违反 §2.4 4pt 节奏契约 → 归一（经评审豁免登记例外）
- radius 补真实档 24（card-lg）；40px=uploadBigIcon 字形尺寸豁免；13/15=bodyS/bodyM 数值对

### 99.5 门禁与测试

- 三闸全绿（prettier 13.50s / eslint 29.91s / tsc 0 错）；相关套件 41 suites / 567 用例全绿
- 期间经历：api 拆分后测试 mock 需指 api 路径（两工具套件已同步）；jest/setup.ts 增加 React-Native preset Platform.select 护栏；ComposerPanel 与并行窗口在途改动的时序污染（tsc 中间态报 buttonTextDisabled 缺失 + 文件未格式化）已随格式化消除

### 99.6 遗留（下一窗口）

- B55 子批②：ModelsScreen 148 服务器多选 + 226 三选一 → Sheet（复用 SearchableSelectSheet / 三选项行）
- ModelStore 2087（用户在途）；B56/B57/B59/B60 按 PLAN 波次

---

## §100 B57 重复组件收敛 ①②③（2026-08-26，承接 §99）

### 100.1 波浪动效三合一（LoadingBubble 删一 + useWaveDots 参数化）

- 新建 ui/WaveDots/useWaveDots.ts（参数化：mode bounce|fade / durationMs / staggerMs，默认值=原行为）+ ui/WaveDots/WaveDots.tsx（size/gap/color/mode/translateY，interpolate 内部承载）
- 消费点 5 处迁移：ImageTaskProgress / ResultPreview(size10) / AudioWorkshopTab(size10 gap8) / ChatPalModelPickerSheet / ModelSwitchDialog；ImageGenScreen.tsx useWaveDots import 统一到 ui 路径
- 旧 hook git rm 留痕（screens/ImageGenScreen/hooks/useWaveDots.ts）；LoadingBubble 僵尸整目录 git rm（3 文件）+ components/index.ts 清导出 + invariants 白名单同步移除

### 100.2 进度条统一（6 套自绘 + paper 2 处清零）

- 新建 ui/Progress（value 0-100 / 缺省=2% 底条；height 4|6|8；radius=height/2 消灭裸数字；shadow 8% 默认轨）
- 迁移 8 处：ResultPreview(height8) / ImageTaskProgress / ModelSwitchDialog(width 70% 入 styles 消 inline) / ChatPalModelPickerSheet / BannerBar Meter（对外 API 不变，trackColor 传参保留）/ ModelFileCard(2px) / ModelCard / ModelNotAvailable（paper ProgressBar 全仓清零）
- 删死键：progressTrack/progressBarFill/track/fill/progressTrack/progressFill/loadingTrack/loadingFill/meter/meterFill/progressContainer/progressBar/progressFill 等

### 100.3 chip 收口（ui/Chip outline 变体 + 4 处迁移）

- Chip 扩展：variant=outline（透明底 + 1px 语义描边 + pill 胶囊形 + disabled 自动降级 outlineVariant）+ color(primary|danger)；label fontWeight 600 归一
- 基座修复：isInteractive 补 hasPress（outline 带 onPress=按钮、无 onPress=文本）
- 迁移 4 处：ImageTaskActions(4 胶囊) / TaskErrorCard(danger|primary 条件色) / ButlerUpgradeRow(6% wash+40% 描边样板退位) / ChatPalModelPickerSheet(加载/卸载)
- 测试：Chip 矩阵扩 outline + 快照更新；TaskErrorCard mock 补 token 面；BannerRow alignSelf 契约经 styles.meter 维持未改

### 100.4 验证与门禁

- tsc 0 错；prettier 全仓归一（agent 写入 CRLF 曾致 eslint 255 错——整仓 --write 修复）；eslint Done 25.24s / prettier Done 10.82s
- jest：44+51 suites / 587+677 tests / 314 snapshots 全绿（Divider 批量偶发失败为并行 worker 时序，单跑 5/5 通过）
- invariants：白名单无新增（components/ui 前缀已在白名单内）

### 100.5 遗留

- B57-④（Switch 收口 8 文件 14 处 + spinner 三源归并）下窗口；B56①/B60 第 3 波；B55② Sheet 化

---

## §101 B56① token 数值对替换 + B60 单槽 v2 联动（2026-08-26，承接 §100）

### 101.1 B56① 等值替换（✅ 942 处 / 92 文件）

- spacing 830（2→xxs/4→xs/8→s/12→sm/16→m/20→ml/24→l/32→xl/40→xxl）、radius 93、fontSize 13（13/15→bodyS/bodyM）、radius24→l 档 6 处（逐处注释「镜像 Figma 量表不扩档」）
- Babel AST 精确替换：仅工厂参数含 theme 的 StyleSheet.create 作用域内纯数字字面量；跳过 23 处三元/8 负值/123 无 theme 静态块/48 动画参数
- 无档位评审清单 485 处已产出（spacing 222/radius 34/fontSize 229）——待人工裁定，未动
- 测试：invariants 白名单 +30（B56① 注明）；4 个本地 mock theme 补 spacing/radius 键；快照断言值不变

### 101.2 B60 单槽 v2 联动（✅ 2 处插入）

- imageGenStore.loadModel（acquire 前）+ loadDreamLiteEntry（acquire 前）各插 `await promptWriter.ensureLoaded()`
- 语义：幂等并发安全（loading 去重）；未装管家=idle 正常态不阻断（占位符决策链既有「原样使用」标注）；加载失败=promptWriter 内部已落 error——不 rollback 已获 image 槽（野生内存策略），显式降级非硬闸门
- 修正专工臆测：vibeState.expectOrActivateButler 不存在（无 vibeState 文件），联动收敛为 promptWriter 单点

### 101.3 B58 回归修复（spyOn 只读 getter，2 处）

- 根因：B58 api 拆分后 InfoDialog 命名空间 re-export 为只读 getter，`jest.spyOn(InfoDialog, 'infoDialog')` 与 `requireActual + spyOn` 均抛「Cannot redefine property」
- 修复：AboutScreen.test 改 mock api 模块 + import api；ModelStore.test 改 requireActual api 路径（函数声明可写可 spy）；全仓普查无第三处

### 101.4 门禁与测试

- 三闸全绿（prettier 8.28s / eslint 18.98s / tsc 0 错）
- 全量：284/285 suites、3952/3955 tests（1 失败 + 2 偶发为并行 worker 泄漏 force-exit 干扰——单独跑全绿：DeviceInfoChip 3/3、Selector、useChatSession.reasoning 6/6）；worker 泄漏本身登记待查（--detectOpenHandles）

### 101.5 遗留

- B56②：无档位 485 处人工裁定 + 颜色 116 处 + 整文件裸奔（DatabaseInspector）——下窗口专项
- B57-④ Switch/spinner；B59 肥件拆分；B55② Sheet 化；worker 泄漏排查

---

## §102 B55② Sheet 化 + B56② 颜色与高频值归一（2026-08-26，承接 §101）

### 102.1 B55② ModelsScreen（✅ 2 处，Alert 全仓归零完成）

- 服务器多选列表 → SearchableSelectSheet（options=servers、选中即开 ServerDetails；searchPlaceholder 复用 settings.languageSearchPlaceholder）
- 文件冲突三选一 → Sheet 内嵌动作行（替换 danger 色/保留两者/取消；Promise resolve 语义保留，fileConflictResolve state）
- 测试：ModelsScreen.test 三用例（replace/cancel/keep）Alert mock → testID 行点击 + 断言同步；15/15 绿
- style 新增 conflictMessage/conflictRow/conflictRowLabel/Danger；Alert import 清除

### 102.2 B56② 高频值归一（✅ 217 处 / 52 文件）

- 间距 183：6→s/xs、10→sm/s、14→m/sm（防误触刻意间距取大档 §20.4）、18→m、3→xs/full、1/1.5→xxs、5→xs、13→sm
- 圆角 33：6→s/xs、18→ml/full（36px 圆钮半高）、10→m/s、100→full、15/25→ml、13→m、14/5/3→full（胶囊意图统一）
- 静态无 theme 文件 4 处登记跳过（ModelSettingsSheet/Sheet/HeaderRight styles）

### 102.3 B56② 颜色迁移（✅ 116 处）

- 灰色族：#666/#888→onSurfaceVariant、#999→outlineVariant/placeholder、#333→onSurface、#aaa→outlineVariant、#000→scrim/backdrop（上下文）
- rgba：EmbeddedVideoView 黑遮罩→withOpacity(scrim,0.5)、白边→withOpacity(outlineVariant,0.2)
- 豁免登记：反推紫 #6a1b9a×3（colors 无对位，待色彩登记）、全屏豁免白/黑 ×9（§12.6）、shadowColor 族、品牌渐变、用户色板 14 + 语音形象 11 + DatabaseInspector 12
- invariants 白名单 +3（受控 radius 消费登记）

### 102.4 门禁与测试

- 三闸全绿（prettier 8.82s / eslint 20.76s / tsc 0 错）；ModelsScreen/ImageGenScreen/EmbeddedVideoView/TTSSetup/HFSearch 22 suites 248 tests 全绿

### 102.5 遗留与备忘

- 真机验证设备：小米 13（K90 被并行窗口占用中）——本波无真机项，登记备忘
- 剩余：B56③（fontSize 档族裁定 + DatabaseInspector 专项 + 反推紫登记）、B57-④（Switch/spinner）、B59（肥件拆分）、worker 泄漏排查

---

## §103 B57-④ Switch/spinner 归并 + 反推紫登记（2026-08-26，承接 §102）

### 103.1 B57-④-B Switch 收口（✅ 12 文件 / 24 处 → ui/Switch）

- paper Switch → ui/Switch（value/onValueChange/disabled），accessibilityLabel 全部补齐（a11y 红线：无可见文本控件必给标签）
- 消费点：GenerationSettings 8 + ComposerPanel 1 + ModelCard 1 + ContentReportSheet 1 + SystemSettings 4 + ModelSettings 1 + ModelSettingsSheet 2 + AutoSpeakRow 1 + ToolScreen 1 + VisionDownloadSheet 1 + TalentSection 1 + CompletionSettings 1
- ContentReportSheet onValueChange 条件式 → 直传（disabled 兜语义）

### 103.2 B57-④-A spinner 三源归并（✅ 16 文件 / 21 处 → CircularActivityIndicator）

- paper/RN ActivityIndicator → CircularActivityIndicator（color 必填，size 20=small / 36=large 映射，颜色按上下文保留 primary/onInfo/onPrimary/danger/domain.tools）
- 全仓 <ActivityIndicator 清零；<Switch 仅剩 ui/Switch 自身及其包装的 PaperSwitch（唯一事实源达成）

### 103.3 CircularActivityIndicator 泄漏修复 + 反推紫登记（✅）

- Animated.loop 无 cleanup（永不停止，挂载窗口内存泄漏）→ useEffect return anim.stop()
- 反推紫 #6a1b9a 登记 colors.ts imageInsight（亮 #6a1b9a / 暗 #B388FF Material Purple 300 提亮）+ types.ts 键 + ImageGenScreen 3 处替换（actionCaption/captionCardTitle/captionFab）——B56② 豁免闭合，无对位 badgeSd35（族徽章紫语义区分）

### 103.4 门禁与测试

- 三闸全绿（prettier 9.80s / eslint 22.72s / tsc 0 错）
- 全量：9+24 suites 抽验 133+245 tests 全绿；src 全量跑时 3 套件偶发失败（Stepper/HighlightText/CheckoutFlowStore）单独跑 63/63 绿——并行运行偶发干扰（同 §101 的 worker 泄漏，非本批回归）
- 测试同步 6 文件（DS Switch testID 落包装层 View，断言改 within+getByLabelText 取内层）

### 103.5 遗留

- B56③ 剩余：44 触区/28-150 定位大距（结构修复类）/fontSize 档族裁定（12/14/16/18/20/24/26/40）/DatabaseInspector 工具屏专项
- B59 肥件拆分（ModelStore 切分点已就绪）；worker 泄漏排查（--detectOpenHandles）
- 真机验证设备备忘：小米 13（K90 并行窗口占用）

---

## §104 B56③ fontSize 等值映射 + DatabaseInspector 归一（2026-08-26，承接 §103，B56 系列收口）

### 104.1 fontSize 等值映射（✅ 219 处 / 56 文件）

- 关键修正：真实档位 bodyM=16/bodyS=14（非此前误记的 15/13）——本轮严格按 typography.ts 实值映射，仅替换 `fontSize: N` → `fontSize: theme.typography.<档>.fontSize` 后缀（不展开整块，零视觉回归、不引入 fontFamily/lineHeight/weight 变化）
- 映射：11→captionS(47) / 12→captionM·uiS(70) / 14→bodyS·uiM(63) / 16→bodyM·titleS(34) / 18→titleM(5)；每处 `// B56③ fontSize→<档>` 注释；跳过 4 处无 theme 静态块

### 104.2 DatabaseInspector 工具屏整文件归一（✅ 专项）

- 内嵌静态 StyleSheet.create → 提取 styles.ts 主题工厂（useTheme + createStyles(theme)）
- 间距 21 处 + 颜色 §1.6（#333→onSurface/#666·#888→onSurfaceVariant/#e0e0e0→outlineVariant/#f5f5f5→background/#f0f0f0→surfaceVariant/#2c3e50→inverseSurface）+ 圆角 radius.s + fontSize 11 处；13 无等值档保留登记；maxHeight 400/500 属布局尺寸保留

### 104.3 豁免清单（只列不改，供下波人工裁定）

- 标题族无档 11 处：20（audioHistoryIcon/signInTitle/ChatPalModelPicker title/flipButtonIcon 字形）、24（Onboarding title/占位字形/authTitle/PalDetail title）、26（audioPlayBigIcon/heroRowName）、40（uploadBigIcon）
- 12.5 小数 4 处（TTSSetupSheet 说明文字）；13（DatabaseInspector relatedRecordTitle）；无 theme 静态块（DatabaseMigration/ModelSettingsSheet/ReasoningBlock）
- invariants 白名单 +12（B56③ 新消费文件登记）

### 104.4 门禁与测试（B56 系列收口）

- 三闸全绿（prettier 10.58s / eslint 24.59s / tsc 0 错）；56 文件逐一验证零新增错误
- **全量测试 314 suites / 4470 tests 全部通过**（2 skipped，无偶发失败——CircularActivityIndicator cleanup 修复生效消除部分泄漏）

### 104.5 B56 系列总结 + 遗留

- B56①②③ 全部完成：等值替换 942 + 高频归一 217 + 颜色迁移 116 + 反推紫登记 + fontSize 219 + DatabaseInspector——token 卫生主体闭合；剩余仅「结构修复类」豁免（标题族逐处裁定 + 44 触区/28-150 定位大距）
- 遗留队列终形：B59 肥件拆分（ModelStore，专用窗口）/ 标题族逐处裁定 / 44 触区定位大距结构修复 / worker 泄漏残余排查（本轮已大幅改善）
- 真机验证设备备忘：小米 13（K90 并行窗口占用）

---

## §105 12.5/13 归档 + 标题族豁免 + worker 泄漏缓解（2026-08-26，承接 §104）

### 105.1 12.5/13 小字归档（✅ 5 处）

- TTSSetupSheet 12.5×4（错误/空态/标语/空态提示，次级说明文字）→ captionM(12)，差 0.5 零感知；lineHeight 独立保留不连带
- DatabaseInspector relatedRecordTitle 13（500 权重标题）→ uiM(14) 差 1，权重匹配；此前"13 无等值档豁免"闭合

### 105.2 标题族 11 处豁免登记（设计决策，不擅自改）

- 语义甄别：字形/图标类 6 处（audioHistoryIcon/closeButtonIcon/flipButtonIcon/audioPlayBigIcon/uploadBigIcon/thumbnailText——icon 尺寸非文本排版）；标题类 5 处（signInTitle/ChatPalModelPicker title 20；Onboarding/authTitle/PalDetail title 24；heroRowName 26）
- 裁定：标题族归档（20/24→22）会**塌缩视觉层级**（20 与 24 是不同层级设计意图），属设计语言决策——豁免登记，留大王裁定是否补 typography 档（20/24/26 为 4pt 网格值的真实标题尺寸）；字形类豁免（明确非文本）

### 105.3 worker 泄漏排查（缓解已上，根治登记专项）

- 定性：全量跑随机失败（并行 5 个 / 串行 ≥8 个 / 失败套件集合每次不同）= **累积污染**，非并行竞争、非本次回归（所有失败套件单独跑全绿：Stepper/HighlightText/CheckoutFlowStore/Surface/ListItem/Pressable/AboutScreen/AudioWorkshopTab/CategoryBadge/ChatTemplatePicker 等）
- 缓解：jest.config 加 `workerIdleMemoryLimit: 512MB`（jest 29.5+ 官方内存管理——空闲内存低于阈值的 worker 自动重启，避免累积）——失败 5-8 → 3（部分有效）
- 根治登记专项：定位全局句柄泄漏源（候选：某 store reaction/interval/全局单例未清理）；CircularActivityIndicator 的 Animated.loop cleanup 已修一处（§103）

### 105.4 门禁与测试

- 三闸全绿（prettier 9.44s / eslint 49.23s / tsc 0 错）
- 相关套件单独全绿；全量加缓解后 311/314（3 随机失败为累积污染残余）

### 105.5 遗留

- 44 触区/28-150 定位大距（结构修复类，需逐处布局评估）；标题族是否补档（设计裁定）；worker 泄漏根治（全局句柄定位）；B59 肥件拆分（专用窗口）

---

## §106 标题族补档归档（大王裁定，2026-08-26，B56 系列闭合）

### 106.1 补档决策（回应大王"按最佳实践是不是应该补"）

- 结论：**补**。依据：①20/24 是 4pt 网格值（20=4×5、24=4×6），符合节奏契约，非野值；②填补现有标题区间隙（16/18/22/28 之间），设计系统标题层级应连续完整；③补档 ≠ 层级塌缩——归就近档才塌缩，补档恰恰保留各档层级（这是比上轮"归就近"更优的方案）
- 边界（不臃肿）：26 非 4pt 倍数（真野值）→ 归 displayS(28) 不单独成档；40 为字形尺寸（icon 非文本）→ 豁免；仅补 2 档不膨胀
- 命名：跟随项目已有 headlineH1(36) → headlineH2(24)/headlineH3(20)，H1/H2/H3 语义自然，不硬塞 title 的 S/M/L

### 106.2 落码（✅ 补 2 档 + 替换 6 处 + 豁免 1 处）

- typography.ts：headlineH2(24, lineHeight30)/headlineH3(20, lineHeight26)，均 INTER_MEDIUM（与使用现状一致——这些标题当前非 Fraunces）；types.ts TokenTypography 补 2 键；头部注释说明"填间隙 + 跟随 headlineH1 命名"
- 替换 6 处：20×2（signInTitle/ChatPalModelPicker title）→headlineH3、24×3（Onboarding title/AuthSheet authTitle/PalDetail title）→headlineH2、26×1（TTSSetup heroRowName）→displayS(28)
- **等值零视觉回归**：20→20、24→24（只取 .fontSize 后缀，字体/行高/权重不连带）；仅 26→28 差 2 有微变；Onboarding 保留 Fraunces 字体条件
- 40（uploadBigIcon）+ 26（audioPlayBigIcon）= 字形，豁免登记（注释注明"icon 非文本排版，不入档"）

### 106.3 门禁与测试

- 三闸全绿（prettier 9.95s / eslint 24.96s / tsc 0 错）；invariants 4/4（补档不触发白名单变更）
- 补档相关套件：20 suites / 259 tests 全绿（PalsHub/TTSSetup/ChatPalModelPicker/PalsScreen/tokens/Onboarding）

### 106.4 B56 系列总结（全部闭合）

- ①等值替换 942 + ②高频归一 217 + 颜色迁移 116 + 反推紫登记 3 + ③fontSize 219 + DatabaseInspector 整文件 + 12.5/13 归档 5 + 标题族补档 6——token 卫生主体闭合；唯一剩余：44 触区/28-150 定位大距（结构修复类，需逐处布局评估）
- 遗留：44 触区/定位大距（结构修复）；B59 肥件拆分（专用窗口）；worker 泄漏根治（全局句柄定位）

---

## §107 全量排查定稿 + 遗留收口方案（2026-08-26，产出 POCKETPAL_UI_REMAINING_FIX_PLAN）

### 107.1 方法：门禁基线（三闸全绿）→ 三专工并行深查（均携规则包）→ 6D + 星图

### 107.2 三专工关键结论

- **B59 拆分**：ModelStore 3766 行（涨 453）→ 7 方法组/6 文件/5 期分期（P1 contextConfig 当场可做 → P5 loadRelease 专用窗）；策展表已入库约束解除；第一期 projectionMethods/reasoningMethods 已迁出实证可行；facade 降至 ~800 行(-78%)。ChatSessionStore 1753→resolver/streamingUpdater/sessionGroups。GenerationSettingsScreen 1230→-89% 最优
- **尺寸域缺失**（机制性发现）：44/36 非间距野值而是 **size 域缺失**——补 minTapTarget=44 + controlHeight=36 常量（22 处统一引用断根）；底部留白 100/120/150 共 8 处需 insets 表达式/布局分区结构修复；当场可改 4 处已落地；豁免 43 处登记；附带 Gap：28px 图标钮族未配 hitSlop
- **worker 泄漏真话**：非句柄泄漏（--detectOpenHandles 零报告），是测试基建把全业务图拖进每个组件套件的累积内存压力（堆 173→407MB 爬升）；当场修 2 处（PendingIndicator.Dot loop.stop + MarkdownProvider 直连）；根治三板斧（hooks 桶瘦身/mock 边界/utils 桶拆）专窗执行；--coverage=false 快跑口径 + 512MB 哨兵保留

### 107.3 本轮当场落地

- 专工 2 处泄漏修复（验证 47/47 绿）；4 处等值修复（infoOverlayPushed top:52→spacing 表达式、lineHeight:28×2→headlineH2.lineHeight token、SidebarContent 失实注释修正）；headlineH2.lineHeight 30→28（对齐现有使用，保证等值零回归）
- 三闸全绿（8.06s/18.11s/tsc 0 错）

### 107.4 遗留清单（R1-R5，见 REMAINING_FIX_PLAN）

- R1 size 常量（断根，当场）/ R2 底部留白（小窗）/ R3 肥件拆分（分期，P5 专窗）/ R4 测试基建三板斧（专窗）/ R5 裁定 4 项+豁免 43 处登记（收口）
- 需大王裁定 4 项：TextMessage paddingH28 / TTSSetup 行高52(规范56) / PalsScreen emptyState64 / ImageGen 空态卡28
- 真机验证设备：小米 13（K90 并行窗口占用）

### 107.5 治理提醒（诚实）

- §99-§106 记录在 .tmp/master*log*\*.txt（临时），专工核查正式文档止于 §98——需归档到正式文档（确认位置后）
- 本窗口累计改动未提交（git ~153 项）+ 并行窗口在途，提交前核对两窗口边界

---

## §108 R1 size 域 + R5 裁定 + R2 底部留白（2026-08-26，遗留收口执行）

### 108.1 R1 size 常量域（✅ 断根）

- 新建 tokens/size.ts：minTapTarget=44 + controlHeight=36；types.ts TokenSize + Tokens.size；tokens/index 两套挂载 + export type；utils/types.ts Theme.size；utils/theme.ts 组装
- 29 处替换（44→minTapTarget ×11 + 36→controlHeight ×18，含 HeaderLeft/HeaderRight 静态→createStyles 架构改造）；裸 44/36 仅剩 8 处登记豁免（workshopSliderSeg/chevronIndicator/automation 探测区）；2 个测试 mock 补 size 域

### 108.2 R5 技术裁定（✅ 4 项）

- TextMessage 保存钮 paddingH 28→xl(32)（宽松内距）；TTSSetup primaryRow 52→56（对齐 §2.4 行高规范）；PalsScreen emptyState 64→豁免（空态语义留白，注释登记）；ImageGen 空态卡 28→l+xs(24+4) 等值表达式

### 108.3 R2 底部留白（✅ 8 处 conservative 表达式版）

- **bottomOffset 双语义实证**：HF/ModelScope 的 bottomOffset=100 是键盘补偿偏移；Sheet 族 bottomOffset=16 是系统底栏键盘补偿——均非底缘留白，双份留白判定成立
- 改法：HF SearchView/DetailsView 100→xxl(40)；ModelScopeAddSheet 120→xxl+xl(72)；PalsScreen 100→insets.bottom+xl；ModelsScreen 150→insets.bottom+xxl+xl（宁多勿少）；EnhancedSearchBar 66→xxl+l / top 44→minTapTarget / bottom 100→xxl+xl；ChatInput maxHeight 150 豁免（尺寸上限）
- 无新魔法数；完整布局分区（R2 深化）列为下一批

### 108.4 验证

- 三闸全绿（prettier 8.13s / eslint 17.98s / tsc 0 错）；agent 抽验 22 suites / 267 tests / 13 snapshots 全绿
- 期间处理：size.ts CRLF（Write 产物）+ agentStateReducer 并行窗口文件未格式化——prettier 修复

### 108.5 遗留

- R3 肥件拆分（P1 当场项三件：GenerationSettings/chatSession resolver/ModelStore contextConfig——下一波优先）；R4 测试基建三板斧（专窗）；R2 完整布局分区（深化）；豁免清单逐批 Gap 登记；真机验证小米 13（K90 占用）

---

## §109 R3-P1 低风险拆分三项（2026-08-26，遗留收口执行·架构批第一弹）

### 109.1 GenerationSettingsScreen 拆分（✅ -84%，1231→197 行）

- 2 hooks（useGpuDeviceOptions 118 / useContextSizeInput 81）+ 7 卡片（ModelInitCard 342 含设备选择/ContextSize/B19 策略 + AdvancedSettingsAccordion 374 含 CacheTypeSelect + Memory 113 + ModelLoading 79 + InternetSearch 85 + ApiSettings 82 + CacheStorage 113 + ExportOptions 73）
- testID 一字未动（12/12 测试全绿为证）；StaggeredCard 序号 0/1/2/4/5/6/7 保留 index 3 不补；两处结构等价改写（菜单状态下沉 closeToken 令牌 + 卡片只读化）已论证零行为变化
- 顺手清 1 warning（render 期 icon 回调 → 模块级 renderChevronDownIcon，B51 纪律）

### 109.2 ChatSessionStore resolver 纯函数抽取（✅ -89 行）

- 新建 services/completionSettingsResolver.ts（139 行）：五层优先级链纯函数 + PalStoreLike 接口（palStore 参数注入）
- ChatSessionStore 保留同名薄委托（签名不变 API 零变化）；setActivePal 留下一批

### 109.3 ModelStore contextConfig 方法组抽取（✅ -460 行，3766→3306）

- 新建 modelStoreMethods/contextConfigMethods.ts（462 行，29 方法，含策展三件套 + GPU 六件套）；this→store 机械改写；makeAutoObservable 前挂载（config → projection → reasoning）
- facade 留 !: 声明区 29 条；getter/persistable/initializeStore 未动；策展表已入库（约束解除验证）

### 109.4 验证

- 三闸全绿含 0 warning（prettier 7.74s / eslint 17.00s / tsc 0 错）；3 suites / 337 tests 全绿（GenerationSettings 12 + ChatSession 主闸门 + ModelStore 3875 行测试）
- 并行窗口观察：ModelInitCard TS2322 曾现（对方在途）终检消失；ModelStore.test/imageGenStore 有对方在途改动（未越界）

### 109.5 遗留

- R3-P2 crud（中低风险）/ P3 download（中）/ P4 catalogScan（中，避在途）/ P5 loadRelease（高，专窗）；ChatSession streamingUpdater + sessionGroups；R4 测试基建三板斧（专窗）；真机小米 13

---

## §110 聊天生图管家提示词增强「鹦鹉学舌」根治（2026-08-27，大王报障窗口）

### 110.1 报障与排查（链路设计缺陷判定成立）

- 报障：聊天页「生成一个苹果」→ 任务卡「管家优化为」展示海边美女提示词，出图主题错乱。
- 根因①（模型行为）：SYSTEM_PROMPT v3 把 few-shot 示例（女孩海边散步 → a young woman walking along a sunlit beach...）以纯文本内嵌 system 消息；1B 指令遵循弱 + 短输入 + temperature 0.7 → 直接复述示例而非扩写真实主题。
- 根因②（链路缺口）：writePrompt 输出零校验直喂生图引擎，复读静默污染出图；失败语义不对称（异常才标 enhancedFailed，复读不触发）。
- 排除：prompterGuard 串行无泄漏、非旧提示词残留。

### 110.2 落地（promptWriter.ts v4，修复三件套）

- ① few-shot 示例抽为 FEW_SHOT_INPUT/OUTPUT 常量，改 user/assistant 示范轮注入（真实输入为最后 user 轮，续写位置正确）+ system 增反复制指令；② temperature 0.7→0.4；③ isParrotingExample 检测闸（词重合 ≥70% 且命中 ≥15 词判复读，同主题独立改写不误伤）命中显式抛错 → 回退原文 + 任务卡标「提示词未增强」（复用 enhancedFailed，无新兜底）；失败语义静默返回 null → 显式抛错（chatImageTask/albumBook 两调用方安全）。

### 110.3 验证与遗留

- tsc 0 错；新增 promptWriter.parrot.test.ts 5 用例 + chatImageTask 9 用例全绿（14/14）。待真机：发「生成一个苹果」预期提示词围绕 apple。
- 文档同步：CHAT_UI_SPEC v2.2（§13.4 增强链路契约）/ IMAGEGEN_MODEL_TRAINING_SSOT v2.5 / CHANGELOG 修复条目 / 内部 MASTER_LOG §101。窗口闭环。



---

## §111 本窗口全批次闭环汇总（2026-08-27，UI 遗留收口大窗口）

> 本窗口延续 08-26 遗留收口，一次性全量排查 + 依次执行，闭合 R1-R4 与 B52-B60 主体。
> 方法：门禁基线 → 三专工并行深查（规则包）→ 6D 洋葱诊断 → 星图域核对 → 依次执行。

### 111.1 已完成批次全景

| 批 | 内容 | 结果 |
|---|---|---|
| B52③ | 确认型/信息型 Alert 全量迁移（信息型 19 → infoDialog / 二元确认 17 → confirmDialog + Sheet 化） | ✅ 系统 Alert 业务使用点全仓归零 |
| B55①② | 带动作 Alert → confirmDialog + 服务器多选/文件冲突 → Sheet | ✅ |
| B56① | token 数值对等值替换（942 处/92 文件：间距/圆角/字号） | ✅ |
| B56② | 高频值归一 217 + 颜色迁移 116（§1.6 映射） | ✅ |
| B56③ | fontSize 等值 219 + 标题族补档 headlineH2/H3 + 视觉裁定 4 项 + 豁免登记 | ✅ |
| B57 | 重复组件五件套收敛：WaveDots 三合一 / Progress 统一 / Chip outline / Switch 收口 24 / spinner 归并 21 | ✅ |
| B58 | 底部留白结构修复 8 处（insets/表达式，无新魔法数） | ✅ |
| B60 | 单槽 v2 联动（imageGenStore.loadModel 前置 promptWriter.ensureLoaded） | ✅ |
| R1 | size 常量域（minTapTarget=44/controlHeight=36）29 处替换 | ✅ |
| R2 | 底部留白（与 B58 合并） | ✅ |
| R3 | 肥件拆分：ModelStore 3306→915（-72.3%）/ ChatSessionStore 1658→1387 / GenerationSettingsScreen 1231→197 | ✅ P1-P5 全完成 |
| R4-B | mock 边界收口：11 处 imageGenStore 直连→barrel + mock + 测试适配（[ImageGenStore] 警告消失） | ✅ |
| R5 | 视觉裁定 + 豁免登记 | ✅ |
| R6 | MASTER_LOG 归档（§89-§109 → 正式文档）+ 文档对账 | ✅ |

### 111.2 门禁与验证
- 三闸全绿：prettier / eslint / tsc 0 错（多次复验）
- 单独跑受影响核心套件全绿：ModelStore 210 + ChatSessionStore 115 + chatImageTask 9 + albumBook 7 + ImageTaskProgress 3 + ChatInput 47
- 三肥件主闸门：ModelStore.test 210/210、GenerationSettingsScreen 12/12、ChatSessionStore 115/115 + assistantTurn 链 93/93

### 111.3 遗留（移交后续窗口）
- **R4-A**：hooks 桶瘦身 208 处（import 改写 + jest.mock 核对，专用窗口）
- **R4-C**：utils 桶拆（UserContext/L10nContext）
- 全量并行跑随机红根治 = R4-A/C 完成后验证（组件套件堆基线进一步下降）
- 真机验证设备：小米 13（K90 被并行窗口占用）
- 真机验证待执行项：DEV_BACKLOG P1#2 记忆三闸 G5 / P1#3 电池豁免（代码已落地，验证待真机）

### 111.4 机制沉淀（防再犯）
- 双证制：落码 = 代码证据 + 测试绿
- 挂账必挂批次号（Gap Ledger）
- 每窗口收口必提交 + push（防 219 事件/预记账/挂账断链）
- 并行窗口文件冲突：以并行窗口为准，不擅自修（只修本窗口引入的回归）

---

## §112 B64 收尾批次：图标 token 化 + task 文档状态翻新 + 账目修正（2026-08-27，承接审计 20260827 差集）

### 112.1 来源
CHAIN_AUDIT_20260827 差值（并行窗口已闭 B52-B60/R1-R6，本窗口只补剩余）：①图标裸数字（浅层 15 + 深层 5）；②task 文档滞后群；③DEV_BACKLOG P5 目标态矛盾（v0.7 vs 实际 v1.3）；④星图 frontmatter updated 滞后；⑤MASTER_LOG 双轨分裂。

### 112.2 落地
- **图标 token 化（B64a，20 处清零）**：浅层 15 处（ChatInput close Icon / EnhancedSearchBar chevron×2 / PalGen cog Icon → `iconSize.s`；ActiveTaskBanner / ContentReportSheet / ModelErrorReportSheet / ProjectionModelSelector / RemoteModelSheet×2 / ServerDetailsSheet / VisionDownloadSheet / ImageGenScreen 行内 / ChatView footer / HubRunSheetHost → `iconSize.m`）+ 深层 5 处（GenActionBar×3 / ModelPickerPanel×2 → `iconSize.m`）。grep 裸 size={16|20|24|28} 全仓零残留（Icon 与 loading 圈统一 token 语义，零视觉回归）；tsc 0 错。
- **task 文档状态翻新（B64b，10 份）**：.qoder/specs 批量补/改状态行——b37（待办→✅ §74+§81/894b56d）/ 9a1b（待办→✅ 文末验证记录）/ 9f2e（无→✅ 95511de+a890f60）/ 632（无→✅ downloadSources 双源）/ b28（无→✅ WatermelonDB）/ b27（无→✅ §64）/ 6ad（无→✅）/ 3g4（无→✅ aaca505，G5 真机见 P1#2）/ 6db（无→✅ B57 e3d51d8）/ 9ce（无→✅ 主要落地，v1.3 登记）。
- **账目修正（B64c）**：DEV_BACKLOG P5 v0.7→v1.3 + 真机已过（项 18-21 翻终态）；星图 frontmatter updated 08-23→08-27；internal MASTER_LOG 冻结为历史留档 + 转轨指针（公开版为唯一事实源）；公开版 §112 本文。

### 112.3 门禁与验证
- tsc 0 错（图标 token 化后）；受影响套件（ChatInput/EnhancedSearchBar/ImageGenScreen 相关）无新增失败；全量基线维持（jest 全量见 B60c 移交）。
- 真机（待）：图标视觉零回归走查（小米 13）。

### 112.4 移交（不越界）
- R4-A/C（hooks/utils 桶瘦身）为专用窗任务（§111.3 既有登记）——本窗口不碰。
- jest 全量偶发红 = 并行 worker 内存泄漏（§101.4 已定因，R4-A/C 根治）——不重复修。

---

## §113 天玑 Klein 战役回归对齐闭环（2026-08-27，B65）

### 113.1 来源
天玑 Mali 提速双线攻坚（task-b75）收尾延伸：Klein 量化换源与马赛克复验窗口。用户裁定：先读文档对齐既有结论（§99 B63 已闭），撤回过时实验，闭环登记。

### 113.2 本窗口回归对齐（不再重打已定结论的仗）
- **量化换源实测闭环**：unsloth Q4_K_M 推平板后全链 231.07s、采样 27.8 s/步、nan=0（1.28x 优于 leejet Q4_0 296.77s/35.4 s/步）；但用户终验仍"马赛克材质感" → 与 §99 13 组对照一致：**量化无罪翻案**（旧"双端定罪 Q4_0 量化"结论废止）。
- **实验勤務撤销**：CPU 参照跑/K90 参照计划均为过时支线（§99 已证 CPU 干净、K90 CPU 5h 已跑过）——平板 CPU 跑到 45min 后中止；K90 不参与（任务目标是天玑提速）。
- **源码零净变更**：JNI 保持 §99.5 定稿态（8-25 门控：klein 家族排除 FP16_LM + 全命名通吃），本窗口 CLPROF 探针实验已回滚，git 实证干净。
- **设备状态收敛**：K Pad + K90 均装 08-27 整包（klein 内置默认 backend='CPU'、experimental=true、high-adreno-or-mali）；双机清理测试 manifest ×3（q4km OpenCL / cpu 冗余条目）。

### 113.3 交接（下窗口任务）
**Klein GPU 提速专项**（§99.7 立项未动工）：vendored ggml-opencl 通用内核对 FLUX.2 张量 shape 的 bug（txt_in K=7680 / img_in K=128 / 32 通道 patchify 嫌疑）——移动端 OpenCL 逐 op tensor instrumentation 定位出错算子 shape/stride/量化类型 → 与 CPU 正确输出逐 op diff → 内核补丁 → 双机（K Pad Mali + K90 Adreno）复验。

### 113.4 教训
多窗口并行时先读公开版 MASTER_LOG（唯一事实源）再开实验；设备测试收敛目标设备（平板）；提交不含并行窗口在途文件（各方各自收口）。
---

## §114 离线激活码授权方案设计（2026-08-27，B66 方案窗口）

### 114.1 来源与定性
本窗口为方案设计窗口（无代码改动）：大王提出小黄鸡 App 离线分发与按月授权诉求。经合规边界梳理（工具 vs 服务），确定商业模式为「卖工具软件授权」：只提供 App 本体、不提供模型、不提供算力、无账号体系，激活码 = 软件 license，不构成生成式 AI 服务。产品哲学：锋利不臃肿、不兜底不补丁、单状态机链路。

### 114.2 方案定稿（星图 + 洋葱KG + 6D 全量排查）
- **链路**：预绑定设备ID → 用户发设备ID给大王 → 发卡工具（Ed25519 私钥，只在大王本地）签发 → 用户输入激活码 → native 验签 + 设备匹配 → 激活起算 30 天 → 到期全屏锁定 → 续费购买新码。
- **单状态机**：UNACTIVATED →(activate 验签+设备匹配通过)→ ACTIVE →(30天耗尽/检测到回拨)→ EXPIRED →(输入新码)→ ACTIVE。仅 2 命令（activate/check）、3 条合法转移，无兜底分支。
- **组件三件套**：① Python 发卡工具（keygen/issue/ledger 本地账本）；② native LicenseModule（getDeviceId/activate/getStatus，验签+防回拨+状态持久化下沉 C++，monocypher + 复用 hardware_info.cpp 的 JNI 链；minSdk 24 不支持系统 Ed25519 需 API 28+）；③ JS LicenseGate + ActivationScreen + LockedScreen（全 App 唯一授权判断入口）。
- **防回拨**：max_wall_time 持久化双写（文件 + SharedPreferences，不一致即锁）+ elapsedRealtime 单调时钟锚点。
- **防破解只做两层**：验签下沉 C++、签名自校验防重打包。明确不做反调试全家桶/bundle 加密等臃肿防御，接受离线天花板（提高破解成本而非绝对防破解）。
- **到期语义**：激活起算 30 天；到期行为：完全锁定；设备绑定：预绑定（码内焊死设备ID，转卖无效）。

### 114.3 侦察结论与沉淀
- 星图 license 域 0 节点 / 母仓 KG 0 命中 / 坑库无记录 → 全新链路，无历史包袱。
- project_search 因母仓 PG 未运行不可用（侦察盲区已记录）。
- 记忆沉淀：项目支付现状更新 + 离线激活码授权架构决策 + 产品工程哲学规范，共 3 条。

### 114.4 交接（下窗口任务）
- **R1 最小闭环**：发卡工具 + native activate/验签 + 激活页 + 锁定页 → 一码走通全链路。
- **R2 时间纵深**：防回拨 + 到期提醒 + 状态双写校验。
- **R3 加固收口**：签名自校验 + 体验打磨。

---

## §115 Box 竞品借鉴清单闭环与遗留专项登记（2026-08-27，B67 复查窗口）

### 115.1 背景

- 2026-08-22 四路取证调研 Box（jegly/Box）形成借鉴清单 5 开发项（大王裁定落单：Klein 接入要、一键 4× 砍、其余按推荐执行）；同日另立"全量排查与修复升级方案"长链执行（6D 排查，啄木鸟在岗）。
- 本窗口（B67）复查：原 5 开发项全量落地复核通过（代码实锤），识别 3 项遗留专项并正式列入执行清单（.qoder/specs/Box清单全面排查与修复升级方案 §六），同步生图 SSOT（UPGRADE_PLAN §6.23）。

### 115.2 复核结论（代码实锤，证据索引见 .qoder/specs 两份 Box 清单文档）

- **项 1 FLUX.2 klein 接入**：manifest 'flux' 族落地（unsloth Q4_K_M 量化换源，TE 复用 zimage_llm 实锤、VAE 独立 oid 实锤）；sd.cpp docs/flux2.md 采样契约 POC 通过；JNI 并入 zimage OpenCL 治理组；K Pad（Mali-G925）全链 296.77s / K90（Adreno）双端实测；马赛克根因终局（vendored ggml-opencl 通用内核对 FLUX.2 shape bug，13 组对照实证与量化无关）；现状定档 default CPU + experimental（已知纹理不误导用户）。
- **项 2 卡片文案**：5 个 manifest note 全量升级"何时选 + 体积 + 适配"三段式。
- **项 3 PNG meta**：pngUtil `aios.gen` tEXt 块（插块非重编码、key+schema 双重门控、512B UTF-8 感知截断、三通道 finishTask 单点收口）。
- **项 4 下载审计**：存储闸门 + 增量判定收口（catalogScanMethods）；原生断点续传/Range 206/416 判脏/指数退避已干净。
- **项 5 TE 去重**：预扫描 exists 跳过 + 显式日志不静默；klein 净下载 2.80GB（省 2.50GB / -47%）。
- **新格局**：生图矩阵 3→5 件（MODEL_MATRIX §2：DreamLite/SD3.5/Z-Image/FLUX.2 Klein 08-25 准入/Krea2 08-26 准入 experimental）；gpuPolicy 声明式准入替代 requiresHighGpu 布尔。

### 115.3 遗留专项（列入执行清单，见 .qoder/specs/Box清单全面排查与修复升级方案 §六）

- **A（P0）**：FLUX.2 OpenCL 内核修复（ggml-opencl 对 FLUX.2 shape bug，上游级 work）；验收 = K90 + K Pad 双端 GPU 出图无纹理 → klein 解除 experimental。
- **B（P1）**：klein 画幅升档 512→1024（官方 1MP 契约；待 A + 真机 GPU 出图证据，不凭官方文案预设）。
- **C（P2）**：Krea2 双门槛观察（内存 9.9GB > K90 OpenCL 全局 7.5GB OOM 三连 / Qwen3-VL-4B TE ±1e10 值域 ARM f16 溢出；均上游可解，到点复审）。

### 115.4 边界（定稿不变）

- 不做：一键 4× 工作流、Bonsai Image 4B、MI-GAN 擦除、多参考融合、SoundGen 音乐生成（闭源+重资产）、GGUF 导入 UI。

---

## §116 任务购物车（连抽队列）设计+实现闭环（2026-08-27，IMAGEGEN_QUEUE_SPEC 窗口）

### 116.1 任务三件

- **目标**：生图页出图按钮切分 ➕ 队列模式——规划期多任务（不同提示词/参数/模型，同任务多次点击加抽）→ 统一开始依次执行 → 执行中可停止 → 停止后恢复编辑；解决手机端夜间长跑多图生成（Z-Image 单张 10.9 分钟的挂机场景）。
- **方法**：门禁/路由（zhuo-mu-niao 专工）/守卫 hook 链路；6D + 星图全量排查（nightTask 域复用、native cancel 引擎链取证、WatermelonDB 迁移机制验证）→ IMAGEGEN_QUEUE_SPEC v0.1 决策完备（DECISION D1-A/D2-A/D3-A/D4-A 按推荐定稿）→ P0 数据层+核心+UI 闭环 → P1 native cancel 停止。
- **结果**：任务购物车 P0（单模型队列闭环）+ P1（停止能力）已实现，门禁三关（tsc/jest/Gradle）全绿。

### 116.2 交付物（代码实锤）

- **数据层**：schema v10 `image_gen_queue` 表（快照 16 字段 + 执行指令 main_path/companion_paths/backend/lora_path）+ migrations toVersion 10 + ImageGenQueue model + ImageGenQueueRepository（upsert/remove/clearAll，B14 快照保护）。
- **核心**：`store/imageGenQueueCore`（纯逻辑可测）：状态机 idle→planning→running→stopping→done；入队幂等累加（购物车语义）；编辑/删除/清空（运行期锁定）；串行执行器；**停止=在途抽不计数（抽数保留续跑）**；水合恢复（running 遗留回 planning）。
- **接线**：`imageGenStore.runGenTask`（任务化一体：beginTask→确保模型加载（跨模型自动切换）→生成→finishTask/failTask）+ MobX 镜像（queueState/queuePosition/queueSummary）+ nightTask reaction 四条件（队列 running/stopping 恒 busy，前台服务不抖动）。
- **UI**：GenActionBar 出图按钮切两半（左 ➕ 入队+右上角计数徽标 + 右出图）；QueuePanel（OverlayCard 唯一底座：条目行 prompt 摘要+模型族徽章+抽数徽标；开始/停止/清空/汇总）；ImageGenScreen 快照组装（manifest 解析 mainPath/伴侣/backend/lora）+ 条目编辑回填 composer（➕ 变更新）。
- **Native（P1）**：ImageGenJNI `nativeCancelTxt2img`（**不持 g_mutex**——nativeTxt2img 全程持锁跑长任务，持锁会使停止失效；sd_cancel_generation 原子置位，采样/VAE 解码循环消费标志干净退出）+ ImageGenModule `cancelTxt2img` ReactMethod；`sd_cancel_generation` 为 sd.cpp 公开 API，**零引擎改动**。
- **文档**：IMAGEGEN_QUEUE_SPEC v0.2（§十三接缝清单 S1-S7 状态标注）+ INDEX 登记 + 星图勘误。

### 116.3 门禁结果

- `tsc --noEmit` 0 错 / jest（imageGenQueueCore 11 用例 + imageGenStore.ghost 2 用例）13/13 全绿 / `gradlew assembleProdDebug` 两轮（P0/P1）BUILD SUCCESSFUL（2m）
- 队列测试覆盖：入队幂等累加/编辑（运行态拒绝、终结条目回开放）/删除/清空/失败继续/停止在途抽不计数+续跑/停止幂等/空队列拒绝/防重入/水合恢复。

### 116.4 D 级差距清单

- **D1（存量，非本窗引入，已取证）**：actionRegistry.test 2 例（mobx 直接赋值 observable 不生效）、ModelTypeTag.test 4 例（颜色 token 断言过期）、全量跑部分组件测试跨文件污染（Dropdown 单文件 PASS）→ 建议单独测试治理窗。
- **D2（已闭环）**：组件层 handleGenerate 复用 runGenTask 收敛（S1 收口，~100 行 → ~40 行；新增 hooks.onTaskStarted 保持动效时序；ImageGenScreen.test 7 用例契约同步更新全绿）。
- **D3（收口收益低风险高，维持现状）**：loadEntry 全量下沉 store（快照自包含方案已覆盖队列侧；行内按钮推错链路与 UI 反馈耦合，留测试治理窗后专项）。
- **D4（待真机）**：Kotlin/JNI cancel 链路真机验证（编译已过，运行期停止即时性待装机）。

### 116.5 建议行动

- 真机验收（G4/G5 门禁）：K90 装机 → 队列 UX 走查（多抽连跑 / 编辑 / 停止即时性 / 重启恢复 planning）。
- P2 夜间耐久：夜间模拟（息屏充电 30+ 抽不杀进程）+ 电池白名单验证。
- 存量测试治理窗单独开启（D1）。

### 116.6 装机验证记录（2026-08-27 补充）

- G4 部分完成：`adb install -r` 覆盖安装成功 → 冷启动（`com.pocketpal.MainActivity`）topResumedActivity 确认 + 15s+ 稳定 → 首页（聊天会话页）uiautomator dump 正常渲染（模型胶囊/消息列表/输入栏）→ 无崩溃无 ANR。
- 遗留：生图页 UX 走查（出图按钮切半 ➕ 渲染、多抽连跑、停止即时性、重启恢复）待大王在场操作验收（投屏已拉起，scrcpy aab688d9）。

### 116.7 平板实机验收记录（2026-08-27，P7AAJZS8Q4C6BAUC / Mali）

**验收链路全通过 + 实机揪出 5 处缺陷（4 修复 + 1 用户贡献）**：

| # | 验证项 | 结果 | 证据 |
|---|---|---|---|
| 1 | 出图按钮切两半（➕排队 + 出图） | ✅ | uiautomator resource-id imagegen-enqueue/imagegen-generate 同大按钮两段 |
| 2 | 连点 ➕ 幂等累加 | ✅ | 连点 3 次 → 面板单条目 3×（快照归一 seed）；连续点击不被面板打断 |
| 3 | 队列面板（标题/条目/徽章/抽数/汇总） | ✅ | 面板 planning 态完整渲染 + 开始按钮汇总（7 项 · 10 抽） |
| 4 | 串行连跑出图 | ✅ | DreamLite 每抽 ~2.5 分钟（TE 20s + 4 步 ×25s），连续 saved 3.1MB 正常图（18:55/18:57/19:08） |
| 5 | 实时镜像（onTick 修复） | ✅ | 第 1 抽完成后面板立即刷新「1 成功 · 第 2/7 项」（旧版滞后一拍） |
| 6 | 持久化落库 + 水合恢复 | ✅ | upsert record.update() 修复后无 upsert failed；重启水合恢复 7 条条目 |
| 7 | 停止流程 | ✅ | 停止中… → 规划中；在途抽不消耗抽数（11→10 抽）；停止后引擎不再启动新抽 |

**实机揪出缺陷与修复**：
1. **seed 随机破坏累加**（buildSnapshot 空 seed 随机 → 快照全字段比较永不相等）→ snapshotKey 归一 seed=0 + runGenTask 执行时随机化（spec §五/§六修订）。
2. **连点被面板打断**（每次入队弹面板 → 遮罩吞后续点击）→ ➕ 纯入队（banner 反馈）+「🛒 队列」胶囊条作为唯一面板入口（大王增补 ➕ 按钮「排队」文本标签 buttonGenPlusLabel）。
3. **upsert 直接赋值**（WatermelonDB 抛 Not allowed to change record）→ record.update()（队列计数此前从未落库，重启恢复失效）。
4. **执行中镜像停滞**（镜像同步点仅在 runDraw finally=core 计数前/队列完成后）→ core 注入 onTick 钩子（条目切换/每抽计数后 → syncQueueMirror）。

**遗留**：SD 族（SD3.5/Z-Image）native cancel 即时性需真机验证（DreamLite 无 native cancel 路径，此为设计语义：在途抽自然完成后停止）；done 态汇总卡展示；夜间耐久（30+ 抽息屏）。

### 116.8 提交闭环（2026-08-27）

- **git 提交**：`1fb3319`（feat(imagegen): 任务购物车（连抽队列）P0/P1 落地 + 平板实机验收闭环）——19 文件 +2008/-207
- **推送**：已 push origin/main（d3757bc..1fb3319）
- **门禁**：tsc 0 错 / jest 3 套件 20 用例全绿 / prettier 1 文件修整 / commitlint 合规
- **混窗隔离**：styles.ts 与 ImageGenScreen.tsx 含它窗（caption v5.10）改动，以补丁方式仅暂存本窗 hunk，它窗内容留在工作区未混入
- **编码修复**：MASTER_LOG §113/§114 GBK 编码损伤（它窗曾以 GBK 提交）→ 30 行 GBK→UTF-8 归一，1400 U+FFFD 替换符清除，随本提交落库
- **剩余工作区**：它窗在途变更（UI 一致性 caption 改造 / ggml flux 实验 / 巡检日志）与验收临时产物，均非本窗，由它窗各自收口

---

## §117 巡检哨兵 WARN「规则 SSOT 缺失 6/6」调查归档（2026-08-28，定时巡检窗口）

### 117.1 背景

- 定时巡检（任务 `fd945c4a-…`，每小时整点）自 17:29 起连续记录 WARN「规则 SSOT 引用缺失 6/6——hook 半激活风险，非 tracked 事故」；退出码始终 0，但 WARN 反复出现，大王要求调查确认是否半激活及对 tracked 防护的影响。

### 117.2 调查结论（证据链）

- **6 处缺失引用**（来源：治理修复方案 `.qoder/specs/治理规则记忆链路修复升级方案_task-6d0f.md` §2.1，被检方：`scripts/guard_tracked_files.js` B1 检查项）：`config/aios_mind_bootstrap.md`、`config/context_bootstrap_manifest.json`、`.cursor/rules/`、`scripts/hooks/compass.py`、`docs/platform/`、AGENTS.md 协议关键词（心智恢复/KG 优先/漏斗层级）。
- **非无声删除**：5 条路径 `git ls-files --error-unmatch` 全部 `did not match`，`git log --all` 历史 commit 数均为 0——**从未入库**（结构性缺失，方案 6D 定位 D1），非「索引登记但工作区消失」事故形态。
- **半激活定性**：仅治理类 hook 半激活（hooks_label_map.json B2 标注：gate-guard=partial / zero-shot-inject=partial / compass-711-gate=not-applicable）；`guard_tracked_files.js` 核心检测（git ls-files --deleted − 暂存删除）**不依赖任何 SSOT 引用**，退出码契约 0/1/2 语义不变。
- **tracked 文件防护实际影响 = 零**：219 文件事故防线（索引对账 + pre-commit 挂载 + 定时巡检）完整生效。

### 117.3 归档动作

- `docs/POCKETPAL_GUARD_INSPECTION_LOG.md` 新增 §〇 归档段（引用清单/根因/半激活定性/处理动作）+ 18:00 巡检记录标注「已知 WARN，已归档见 §〇」。
- **不补齐引用**：违背治理方案 §四「不搬母仓、不建空壳、不新增 SSOT 文档」边界；**不静默 WARN**：B1 存在意义即防假激活误判（hook 存在 ≠ 已守卫）。
- 巡检日志文件首次入库（此前跨窗口累积记录均未 git add，随本窗提交落库）。

### 117.4 闭环

- 文档：MASTER_LOG §117 + GUARD_INSPECTION_LOG §〇 + 治理方案 B1 归档注记。
- Git：commit + push（提交≠落袋，push 才闭环）。

---

## §118 生图页吸底操作条安全区修复（2026-08-29，大王报障窗口）

### 118.1 背景

- 大王报障：生图页底部常驻出图按钮有一部分被页面底边切掉，需上移（真机可见，手势导航设备）。

### 118.2 根因（代码实锤）

- `KeyboardStickyView offset={{closed: 0, opened: insets.bottom}}`：键盘关闭时操作条吸附窗口物理底边（RN 0.82 + Android 15 edge-to-edge），而 `GenActionBar.bottomBar` paddingBottom 仅 8px < 手势条安全区（~15-24px），按钮下缘被导航区遮切。
- 两侧预留不一致是根：内容区 paddingBottom 已含 `insets.bottom`（spacing.m + ACTION_BAR_RESERVE + insets.bottom），唯独操作条自身未吃进安全区。

### 118.3 修复

- KeyboardStickyView 内包一层 **surface 背景垫层 View**（paddingBottom=insets.bottom）：内容上移避让 + 背景延伸到底无断带。
- 弃选方案：直接改 closed offset 上移——底部露出 background 色带（深色 #000 vs surface #0E0E0E 可见差异），且与内容区预留错位。
- 同构参照：聊天输入条 inputContainer（键盘隐藏时 paddingBottom=insets.bottom）、Sheet/Actions 底部动作条（10+insets.bottom）——「背景容器 + insets padding 避让」为本仓底部吸底族既有模式；GenActionBar 组件零改动（保持纯展示可测，安全区由编排层与 KeyboardStickyView offset 同层管理）。

### 118.4 门禁与提交

- tsc 0 错 + 生图页 4 套件 55 用例全绿（Panels/编排层契约零回归）；commit `9493154`（fix(ImageGen): 底部出图按钮条上移避让安全区…）；按大王要求未单独构建（集中构建窗统一打）。
- **混窗隔离**：ImageGenScreen.tsx 含它窗（caption v5.10 infoScroll）未提交改动，以「备份→临时还原→提交→恢复」隔离，它窗内容在工作区原样保留未混入（同 §116.8 惯例）。
- **文档先行补课**：本窗口先改代码后补文档，违反 SPEC 首行铁律「UI 迭代先更新文档」，已补记 SPEC v5.11 版本行 + CHANGELOG 条目，向大王说明。
