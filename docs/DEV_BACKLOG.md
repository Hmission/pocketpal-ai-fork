# 待开发清单（DEV_BACKLOG）

> 状态：active | 更新：2026-09-07
> 用途：跨窗口待开发项唯一登记处（任务接力清单）。每项含目标 / 前置 / 验收 / 归属。
> 约定：完成一项即标记 ✅（含 commit），删除前先确认无引用。

## 已完成批次（对照参考）

| 批次 | 内容 | 状态 |
|---|---|---|
| ADR-0008 跑分面板（§75） | PerfPanel PSS/CPU/温度监控 + HardwareInfo 扩展 | ✅ `1535af3` |
| 夜间长任务模式（§76） | 前台服务 + PARTIAL_WAKE_LOCK + AppState 反转 | ✅ `0102b4e`（真机实测 isForeground/WakeLock） |
| DRC 编排对齐 + 电池豁免（§77/§78） | generateDreamLite 同链路 + REQUEST_IGNORE_BATTERY_OPTIMIZATIONS 引导 | ✅ `46af4e5` |
| 记忆时效性三闸（§79） | 写入排除 + 召回免责前缀 + 蒸馏删除指令 | ✅ `aaca505`（真机 G5 待批，见下） |
| 跑分面板真机复验（三修后，P4#16 原账） | v0.4 三修（轮询根治+加宽+换行）真机验证：驻留态 generate 时跑分卡实时数据不再 `--`、卡片宽度不超预览卡、底行 7 指标+历史按钮全可见 | ✅ 2026-08-25 K90 真机通过（截图取证在案，账销） |

## 待开发项

### P1（先做：收尾验证类）

| # | 项 | 目标 | 前置 | 验收标准 | 归属 |
|---|---|---|---|---|---|
| 1 | **跑分面板 UI 视觉真机实测** | PerfPanel 在生成/加载中真实可见：**默认展开**（已修，§82）、PSS 大字跳动、折线/CPU/温度/步耗时 1Hz 刷新、>5GB 橙 >6GB 红阈值色 | 投屏（.tmp/scrcpy/）+ 大王监督；加载任一模型或出图触发 | 截图取证 3 态（正常/橙/红）+ 数值跳动 + MASTER_LOG 补登 | ✅ 2026-08-25 K90 验证已过（CHANGELOG 基准套件真机全链路）+ 2026-08-26 复查销账 |
| 2 | **记忆三闸真机 G5 验证** | K90 治理按钮验证污染库蒸馏清除 + 新会话 web_search 不复读旧闻/失败状态 | 重打包（aaca505 已含） | 污染条目消失 + 新会话回答不含已过时事实 | 新窗口 |
| 3 | **电池豁免真机验证** | 首次夜间长任务弹系统电池优化豁免弹窗；拒绝后生图不阻断 | 装机（46af4e5 已含） | 弹窗出现 + 拒绝后前台服务/WakeLock 仍生效 | 新窗口 |
| 31 | **W5/W6/W7 可感知项真机目视**（挂账：历窗 `adb devices` 为空，契约测试已钉住输出，缺目视一遍）| 装机后目视：① 生图队列面板徽章显示 `SD3.5`/`Z-Image`（不再小写族键）② 吸底胶囊与「开始队列」同为「N 项 · M 抽」③ 跑分横幅/HUD 三赛道名正常 ④ 音频工坊步数 chip 六档正常 ⑤ **图标根治后**：顶栏电话钮与通话页挂断/麦克风/喇叭均**镂空**、描边色随主题（重点看暗色模式 volume 系）⑥ 定电话钮尺寸档（s16 还是回 m20，像素复量定）| 装机（含 `0caf0cc` 及 W7 提交）| 六项各拍一张截图（暗色模式至少一张）+ MASTER_LOG 补登 | 接机后的窗口 |

### P2（视频玩具三前置 + 端到端）

| # | 项 | 目标 | 前置 | 验收标准 | 归属 |
|---|---|---|---|---|---|
| 4 | ~~**断点续跑（引擎 checkpoint）**~~ **已作废（2026-09-08 改判，CHAIN_AUDIT_B §3.3/§六）** | 原计：sd.cpp 采样循环每 5 步 latent+sigma 落盘续跑。**作废理由**：引擎无 save/resume 公开 API（已审计），实现必须改引擎源码（禁区）且将在引擎外养第二份采样状态。**改判为**：片段（clip）粒度重跑——单段失败只重跑该段，不进禁区、不建第 2 状态源 | — | — | **不再做**（能力并入项 7 的片段策略） |
| 5 | **分段加载（双 ctx 交替）** → **条件触发，且本窗重新定义触发条件**（§164 自纠） | 原计：TE-only ctx 编码后释放 → DiT+VAE ctx 采样。**上一轮写的「先验现有 `te=disk` 就能免做」前提不成立**：`ImageGenJNI.cpp:483-485` 的 `te=disk` 整块在 `if (isMaliGpu())`（`:466`）内，而目标机 K90 经 `adb` 实查为 **Adreno 840（SM8850）**→ 该路径根本走不到 | 新前置：把 `te=disk` 从 Mali 分支提为可配开关（改 `ImageGenJNI.cpp`，**禁区外**）并在 K90 实测 | 实测后：若开 `te=disk` 已使峰值 <4GB 且速度代价可接受→本项销账；否则才做双 ctx 且两阶段 PSS <4GB。**本窗已拿到基线**（非估算）：K90/Adreno 840 上 Z-Image-Turbo Q4 单图 512×768×8 步实测 **PSS 峰值 2.7GB**（未开 te=disk，OpenCL 路径），1405s 出图——即**当前单 ctx 在本机未碰 4GB 红线**，双 ctx 的必要性需在此数据上重评（高分辨率/SD3.5 仍需另测） | 待实测（本窗数据倾向于“免做”，但需高分辨率与 SD3.5 两例反证） |
| 6 | **HyperOS 白名单人工引导 UI** | App 内引导页：「电池省电→不限制」+「最近任务锁定」操作指引 | 系统弹窗已落地（§78）；此为人工步骤引导 | 引导页可达 + 步骤截图可对照 | 新窗口 |
| 7 | **Wan 2.1 1.3B 端到端** | 模型推机（DiT Q4 ~1GB + UMT5 Q3 ~3GB + VAE ~0.7GB）→ 夜间跑通一条 5s 480p 视频 = 跑分成功 | ~~项 4/5/6~~ → **CHAIN_AUDIT_B 新序：W10（nativeGenVideo JNI 桥）→ W11（帧→容器裁定）→ W12（任务形态入既有队列 + Wan manifest）**；项 6 仍为并行体验项 | 真机输出完整可播文件 + 全程零被杀 + 片段失败可重跑 | 主线终点 |

### P3（观望/备选）

| # | 项 | 目标 | 前置 | 验收标准 | 归属 |
|---|---|---|---|---|---|
| 8 | ~~**LTX-Video 2B 备选评估**~~ → **已验伪作废**（VIDEO_GEN_SPEC §9.6.1，2026-09-08） | 原设想“Wan 不行则换 LTX 跑”——换不了：本仓 vendored 引擎的 LTX 分支**硬编码** `LLMArch::GEMMA3_12B`（`conditioner.hpp:2991-2992`）且无 T5 回落分支（`stable-diffusion.cpp:1129-1134`）→ 能跑的 2B（T5 编码）**加载不了**，能加载的 LTX-2（19B/22B + Gemma3-12B）**内存不可能** | — | —（要接 2B 需改引擎 conditioner，**禁区不议**）；ANALYSIS §八“首选 LTX”已同步勘误 | **已作废** |
| 9 | **触发条件监控** | Wan 2.x/LTX 系 ≤16 步蒸馏版且全链 ≤4GB 出现时重新评估（ONDEVICE_VIDEO_GEN_ANALYSIS §8） | 社区模型发布 | 条件满足即立项 | 观望 |

### P5（专业跑分面板升级，✅ 已落地 + 真机已过：PERF_BENCHMARK_DESIGN v1.3）

| # | 项 | 目标 | 前置 | 验收标准 | 归属 |
|---|---|---|---|---|---|
| 18 | **P1 数据扩展** | ✅ HardwareInfoModule 六指标 sysfs 探测（CPU/GPU 频率、GPU 负载、温度分区、功耗）+ TS spec | 无 | K90 真机复验已过（B40-B43 演进后 v1.x 终态） | ✅ 已落地 |
| 19 | **P2 面板升级** | ✅ PerfPanel 横版化 + B40-B43 演进（坐标轴/复合图/演出层/三修） | 项 18 | 真机复验已过（08-25 截图在案） | ✅ 已落地 |
| 20 | **P3 落盘 + 历史** | ✅ perfRecorder JSONL + B42 聊天页统一回放（chat-turn 标签） | 项 19 | 落盘契约测试全绿；真机已过 | ✅ 已落地 |
| 21 | **P4 回放 + 跑分卡** | ✅ PerfHistoryModal + perfScore + B41 跑分仪式 + B43 坐标轴 | 项 20 | B39-B43 门禁全绿 + 真机已过 | ✅ 已落地 |

### P4（链路排查欠账，2026-08-23 审计 · 来源：[POCKETPAL_CHAIN_AUDIT_20260823](./POCKETPAL_CHAIN_AUDIT_20260823.md)）

| # | 项 | 目标 | 前置 | 验收标准 | 归属 |
|---|---|---|---|---|---|
| 10 | **搜索精简收口（开放环）** | ✅ 内置 Bing+Wikipedia 复合引擎已落地（2026-08-24 整合提交在案，原提交 35f3ede） | — | 已闭环（遗留孤儿文件见 #18） | ✅ |
| 11 | **TTS 三引擎切 hf-mirror 镜像** | constants.ts L33/97/120/137/168 huggingface.co → hf-mirror.com（对齐 asrEngine.ts） | 无 | 真机下载 TTS 模型成功 | **2026-08-25 落码** |
| 12 | **文档销账 7 项** | B11/B12/B37/§7 挂账/视频陈述/矩阵口径/变更日志（见审计 §五） | 无 | 七项账实一致 | **2026-08-25 落码** |
| 13 | **WS-1 写作项目 tab** | KnowledgeScreen Tab 枚举补 writing + 列表页 | 写作产物已落盘 | 写作产物可见可进 | **2026-08-25 落码** |
| 14 | **B10 图标硬编码收口** | components 下 ≥18 处 size={2x} 改 iconSize token（ChatInput 6 处） | token 已建 | grep 零残留 + tsc/jest 绿 | **2026-08-25 落码** |
| 15 | **TTS 全文朗读收口** | 全文朗读 API + 长按菜单项（UI_INTERACTION §7） | 项 11 | 长按消息可全文朗读 | **2026-08-25 落码** |
| 16 | **InfoDialog 统一** | 约 20 文件多套弹窗收编一套（UI_INTERACTION §7） | 无 | InfoDialog 全域唯一 + 旧组件删除 | **2026-08-25 落码** |
| 17 | **P1 单槽 v2 + P3 肥文件拆分** | engineMutex 生图槽⇒管家联动；ModelStore 3736 行等三肥件拆分 | 架构评审 | PRODUCT_SPEC §6.2 销账 | 择期 |
| 18 | **孤儿文件清理（2026-08-25 审计新增）** | `src/components/SearchProviderKeySheet/styles.ts` 全仓库零引用、组件主体已删（搜索精简的残留孤儿） | 无 | 文件删除 + git 干净 | **2026-08-25 落码** |
| 32 | **`video` 一名四义收名**（CHAIN_AUDIT_B N17，W8a + W8b 均已闭环） | 实为**四义**（初稿漏计 `EmbeddedVideoView` 内嵌播放）：① `VideoTaskService*`（夜间长任务保活，**真歧义**）② 摄像头围观 pal ③ 消息内嵌视频播放 ④ 文生视频。**W8a 已做**：星图新增「词面消歧登记」节定四义归属 + 为④预留 `genVideo`/`kind:'video'`/`videoGen*` 并禁用 `VideoTask*` 前缀；误读位点加名实指针注释；不动 native。**W8b 已做并真机验收（2026-09-08 装机窗）**：`VideoTaskService*`→`NightTask*` 全量改名（Kotlin 三类 git mv + manifest + ReactModule 名 + `NativeModules` 键 + 错误码 + 通知渠道迁移 `deleteNotificationChannel(LEGACY_CHANNEL_ID)`） | 覆盖安装（严禁卸载） | **已过**：`dumpsys activity services` 见 `com.pocketpalai/com.pocketpal.NightTaskService` `isForeground=true`、通知绑 `night_task_channel`；旧渠道 `video_task_channel` 已 `mDeleted=true`（本次启动删除，不造孤儿）；WakeLock `PocketChick:NightTask` ACQ/REL 成对；src 内 `VideoTask` 仅剩历史说明注释 | **已闭环** |
| 33 | **B10 图标尺寸裸数字残余**（CHAIN_AUDIT_B N19，W9a/W9b）——**本窗实测修正量级** | 上一轮写「含 18/26/13/10/12 五个离档值」**错了，低估一个量级**。探针 `.tmp/probe_sizes_164.js` 实测：共 **221 处**，其中 **148 处在档但硬写**（14×20/16×66/20×46/24×16，换 token 像素零变化），**73 处离档**（10×4/12×6/13×2/15×2/18×32/22×10/26×4/32×2/34×6/36×1/48×4，即 **11 个离档值**）。另 `tokens/iconSize.ts` 自注“禁硬编码 16/18/20/22/24/40”而 18/22/48 大量存在——条文与实际早已背离且无闸拦 | 定档已裁并**已落地 9 档**（ICON_SPEC v1.2 §4.5：`micro`12 / `xs`14 / `s`16 / `inline`18 / `m`20 / `l`24 / `xl`28 / `hero`34 / `display`48，角色命名而非像素堆砌） | **W9a 已做 168 处 + W9b-lite 已做 16 处（共 184 处，两轮 jest 318 快照全过 = 零像素硬证）**；余 **W9b-V 25 处**（离档 10/13/15/22/26/32 共 12 个元素 + 1 处 styles 常量 36，已逐条 file:line 入册）需逐屏目视，**W9c 12 处**（6 个元素）需先穿参。账平：168+16+25+12 = 221 = 基线 | W9a/W9b-lite 本窗已交；W9b-V/W9c 择期 |
| 34 | ~~**图标白底遮罩层的暗色债**~~ → **不成立，本窗撤销**（CHAIN_AUDIT_B N25） | 上一轮我写四件资产（`copy`/`duplicate`/`settings`/`edit-box`）的 `fill="white"`「**并不在** `clipPath` 内，而是直接可见的前后景分隔层，暗色会露白块」——**假账**。本窗全文实读 `copy.svg:5-9` 等四件：白色 `rect` 全在 `<defs><clipPath>` 内，而 clipPath 子元素只定义几何、永不绘制，**暗色债根本不存在**（与 ICON_SPEC 自己上一条文一致） | 无需 | 无需（本项作废）；ICON_SPEC v1.2 已就地标自纠 | **已撤销** |
| 36 | **生图 native 桥四项挂账**（CHAIN_AUDIT_B N26，本窗实读取证，**不当波动手**） | ① `ImageGenModule.kt:65-71` `unloadModel` 同步执行与 `:521` 抢同一把 `g_mutex`，生成中卸载会阻塞 RN 线程分钟级（txt2img 已包 Thread，这一条漏包）；② `ImageGenJNI.cpp:390` 把 `GGML_OPENCL_KERNEL_CACHE_DIR` 写到 `/data/data/com.pocketpal/files/cl-cache`，而 `applicationId=com.pocketpalai` → 该目录不属于本 App，疑 kernel cache 从未命中（待真机 `run-as` 取证）；③ `:97-99` stderr `dup2` 无轮转，夜间长跑可写满私有分区；④ `:580 batch_count = 1` 硬编 + `:630` 只取 `images[0]`，改 batch 会静默丢图不报错 | 无（但 ② 需真机取证后才能定性） | 逐项独立修 + 真机取证（不得夹在视频波次里顺手改） | 择期 |
| 35 | **星图不入 git 的恢复风险**（CHAIN_AUDIT_B N24，2026-09-08 W8a 实撞） | `docs/POCKETPAL_STARMAP_DOMAINS.md` 被 `.gitignore:194` 显式屏蔽（同 `INDEX.md`/`DOC_GOVERNANCE_SPEC.md`/`docs/internal/`）。它是「全量排查的域切分依据」，却无历史、无 object 备份——磁盘事故即不可恢复（本仓 08-24 丢过 3 个 pack）；且 `git add` 会静默跳过它，提交信息极易误写“已入库”（本窗已误写一次并 amend 更正） | **需大王裁定**（不擅改项目/母仓约定的 ignore 策略）：① 纳入 git 跟踪；② 维持屏蔽但加仓外备份（`F:\backups\` 或母仓）；③ 保持现状并在每次改动后手工双写 | 三选一落地后：星图改动可从版本库或备份恢复；且提交信息不再出现不实入库陈述 | **部分已做**：2026-09-08 装机窗先做仓外备份（`F:\backups\pp_docs\20260908\`，星图 + INDEX.md，SHA256 `773E9C2D…BE6DB017`）——备份不改 ignore 策略、不待裁；**是否纳入 git 跟踪仍待裁** |
| 37 | **W10 视频桥：阻塞不是“选型待裁”，是“缺资产下载 + 缺页面”**（VIDEO_GEN_SPEC v0.3 §八/§九 更正） | 上一窗本项写“需大王裁定选型”是把**已有结论的事重复上报**：ANALYSIS §5.2 早已列出全链文件清单与 city96 源，§七 也已定 Wan 2.1 1.3B 为主候选；本窗再逐行读引擎又推翻了 §八的 LTX 首选路径（见项 8）→ **Wan 2.1 T2V-1.3B 是唯一可加载路线，无可选空间**。另本项原写“全盘无 Wan/LTX GGUF”为**不实陈述**：检索只用了含连字符的官方名，实物是下划线命名——设备早已有 `wan_2.1_vae.safetensors`（253MB），PC 有 `wan2.1_t2v_1.3B_bf16.safetensors`（2.64GB）。**又纠正一处伪风险**：§166 一度把真机日志 `wan.hpp:78` 的 `dim=2048/ffn=8192/heads=16` 读成“文件自报元数据与引擎 1.3B 强制值冲突”，实为 `WanConfig` **结构体默认值**（`wan.hpp:23/24/28`）在覆盖**之前**打印（覆盖在 `:830-836`，`:870` 才打 desc）——该疑点撤销 | **资产已到位**（2026-09-08 11:18）：`Wan2.1-T2V-1.3B-Q4_K_M.gguf`（982,716,640B）+ `umt5-xxl-encoder-Q3_K_M.gguf`（3,055,097,696B）已推 `/sdcard/Documents/AIOS/models/`，**设备侧 sha256sum 与源站 LFS oid 逐位一致**；VAE（253,815,318B）08-26 即在。三步进度：**① P0.5 已做**（§166：JNI/Kotlin/TS 全链 `t5xxl` 槽 + `CompanionPaths` 类型收口，顺带把 `is_split_model` 补上 t5xxl 免双重量化）；**② P1 已做**（manifest + `modelCatalog` + MODEL_MATRIX §2 同波登记，件数 5→6）；**③ 剩 `nativeGenVideo` 桥 + 页面形态** | 里程碑已达成（§166 真机）：Wan 可被扫到、`[视]` 可见、行按钮变「卸载」、logcat 出 `stable-diffusion.cpp:759 loading t5xxl from …` + `Wan2.1-T2V-1.3B` + `running in FLOW mode`；余下 P2 真机跑 V-1~V-7 + U-1~U-5 | **P0.5/P1 已完成并取证；剩 P2 桥 + 页面形态**（本窗一次真实视频生成也未跑过，不得当“已可用”） |
| 39 | **视频页面形态实现**（VIDEO_GEN_SPEC §九，2026-09-08 大王追问后补的设计） | 页面与交互此前是**真空**：全仓唯一一句相关描述是 ANALYSIS §八“若触发立项→生图页扩展‘视频’tab”，无规格；本卷 v0.1 §七 还把 UI 明列“不做”。现裁定：**不新增 tab**（宽度硬账 400dp 已贴满），模态由 `manifest.modality` 驱动——**用户只选模型，不切模态**；页面全部复用现有容器（ModelPicker/taskPage/PerfPanel/HistoryStrip/GenActionBar） | **P0 已交**（§165 契约 + §166 真机：`[视]` 徽章在下拉行与顶栏胶囊均可见）；另修一处显示不实——就绪文案原硬编码“CPU 后端”，现按 `backend` 单点透传且视频分支明说“视频生成尚未接入，不能出图” | U-1~U-5（§9.8），尤其 U-2“不新增 tab/不新增顶栏控件”需截图尺寸作证；U-1（参数面帧数/fps/尺寸）需 P2 | **P0 完成，U-1~U-5 待 P2** |
| 38 | **运行时重建把正在跑的任务误判为「生成中断」（装机窗实捕）** | 真机现象：从聊天页发起一次 DreamLite 生图后退到桌面，约 40 分钟后回 app，该任务显示「生成失败 / 生成中断」（`errorDetail` 为「应用在上次生成中被强制退出」）。但 **pid 全程未变**（`pidof` 前后同为 19767）——不是强杀，是 MIUI 回收了 Activity：bridgeless RN 下最后一个 ReactContext 销毁会重建运行时，store 重新水合，而 ghost 治理（`imageGenStore.ts:293-312`）只看「水合时 status=running」就判死——**原生/ONNX 线程其实还在跑**，产物可能已落盘却对用户显示假失败 | 无（现象已实捕；同 prompt 同引擎重试立即成功，可排除引擎侧） | 锋利做法：ghost 判定加一个存活凭据（如 native 侧单调心跳时间戳/在飞任务计数），只标真孤儿；不得用「延长超时」这种兜底 | 择期（需真机，本窗已取证） |

### P6（聊天体验极限化，2026-08-26 大王裁定「探索上限」）

| # | 项 | 目标 | 前置 | 验收标准 | 归属 |
|---|---|---|---|---|---|
| 19 | **上下文策展极限化** | 策展表重排（4B→16384/2B→32768/1B→32768 等）+ 设备感知预算 `resolvePssSafeBudget`（可用内存口径上限 9GB）+ `CURATED_TABLE_VERSION` 版本化拉齐 + `recommendNCtx` 死代码删除 | 无 | tsc 0 错 + jest 全绿 + K90 真机各档加载 PSS 实测 ≤ 设备预算 | **2026-08-26 落码 + 真机验证通过**（n_ctx=16384 原生铁证 + 加载 4.15GB/推理后 4.74GB 全程存活） |
| 20 | **压缩大块化** | `COMPACT_TARGET_WATERMARK=0.5`（触发 0.8 → 压到半水位）+ 摘要输入预算上限 6000→12000 + `TOOL_BASELINE_TOKENS=4500` 常量与策展断言 | 项 19 | 16K 档连续 10+ 轮触顶仅 1 次压缩；摘要一次吃下压到半水位的 slice | **2026-08-26 落码**（多轮压缩触发实测转观察项：单轮含思考耗时 5.6min，10+ 轮成本过高；逻辑推算 16K 余量 ≈ 20+ 轮） |

### P7（祖传债与明确不做，2026-09-07 来源：[POCKETPAL_CHAIN_AUDIT_20260907](./POCKETPAL_CHAIN_AUDIT_20260907.md) W6）

审计定的口径：**只登记不扩面**。本波唯一动的一处祖传代码已动（项 25）；其余均为
「知道它在，但不顺手改」的债，需专项才能接。禁止以「反正登记了」为名义去改引擎层。

| # | 项 | 目标/现状 | 前置 | 验收标准 | 归属 |
|---|---|---|---|---|---|
| 25 | **`find(id)` 区分「不存在」与 DB 真故障**（本波已落） | 旧写法 10 处 `find(id).catch(() => null)` 把两件事折成一个 null：`removeMessagesFromId` 在 DB 读故障时走 `updatedSession?.messages \|\| []`，**把用户的聊天记录在屏上清空而 DB 未动**；`deleteSession` 故障时静默 return、store 照样删列表项。现收为单点 `notFoundOk(table, id)`：不存在→null（静默），其他异常→落 DRC 事件流 `db.findFault` + 抛出 | 无 | 4 条新单测钉住（not-found/真故障抛+上报/非法 id 不当不存在吞/mock resolve undefined 仍算不存在）；仓库 24 测全绿 | ✅ 2026-09-07 本窗落码 |
| 26 | **DB 故障的用户可见出口**（项 25 的尾巴） | 抛出后：读/删路径的调用者已在 try/catch 内（performLoadSessionList / loadSessionMessages / deleteSession / bulkDeleteSessions / createNewSession）；但 4 处乐观写入（`setSessionIntentFor` / `updateSessionTitle` / `updateSessionSettingsSource` / `setActivePal`）与 `ChatView` 未 await 的 `removeMessagesFromId` 无 catch → 故障仅进日志与事件流，用户无提示 | 需新增错误文案与 UI 出口（至少 2 条 l10n 键×16 语） | 故障时用户看得到「保存失败，重启后可能回到旧值」，不静默 | 择期（本波不做：造 6 处新文案属扩面） |
| 27 | **跑分页国际化与 28 个闲置 `benchmark.*` 键** | 跑分页大量中文硬编码（段位名/回放标题等），同时 28 个已翻译键零消费者——属“该接线未接线”而非可删死键 | 产品先定跑分页是否进 16 语 | 逐键裁定：接线或删除（删不得反悔，16 语共 400+ 行） | 择期；取证脚本与陷阱见 PERF §10.7 挂账 |
| 28 | **`BenchmarkResult.uuid` 写而不读** | 每例 `uuidv4()` 入库并持久化，全仓唯一读者是已删的 `markAsSubmitted`（云提交残留） | 改已落盘记录形状需同步 5 个夹具 + orchestrator | 字段删除且旧记录不致炸（JSON 多余键可忽） | 择期（独立小宗） |
| 29 | **两处并存的用户设置 `supertonicSteps`** | `ttsStore.supertonicSteps`（播报链）与 `audioStore.supertonicSteps`（工坊生成链）各自可变，无文档裁定是否刻意；本波只做到共读同一默认值常量，**未合并** | 产品裁定（合并会改变用户已有设置行为） | 要么写明“两个链路各自调档”，要么收单一设置源 | 择期 |
| 30 | **fork 债（登记不排期）** | ① `HFStore` 空结果节流；② `loadReleaseMethods` 路径探测兜底；③ ChatView `istanbul ignore` 群；④ `theme: any`（`ImageGenScreen/styles.ts` 旧签名，它曾吞下 token 面漂移——类型面已收，签名待改）；⑤ `dreamLiteEngine` 11 处 `as any`（引擎契约未类型化，碰它=碰引擎禁区）；⑥ core 域四采集零消费者（`readStarmap`/`readIterations`/`readEmotions`/`WakeCheckResult`，仅测试引用，属采集侧双标） | ④ 需全仓 `useTheme()` 调用点体检；⑥ 需 SPEC 标注“供未来消费”或按无消费方裁剪 | 各自单项闭环，不捆做 | 观望（明确不排期） |

## 关联

- [ONDEVICE_VIDEO_GEN_ANALYSIS.md](./ONDEVICE_VIDEO_GEN_ANALYSIS.md)（分析依据：§7 玩具专项 / §8 触发条件）
- MASTER_LOG §75-79（已完成批次登记，docs/internal/ 留档）
- [ADR-0008](./adr/ADR-0008-benchmark-style-monitor.md)（跑分面板立项，docs/adr/ 留档）
- [PERF_BENCHMARK_DESIGN](./PERF_BENCHMARK_DESIGN.md)（专业跑分面板设计 v1.3：B40-B43 演进 + 真机复验已过）
- [POCKETPAL_CHAIN_AUDIT_20260823.md](./POCKETPAL_CHAIN_AUDIT_20260823.md)（P4 批次审计依据：欠账 7 / 销账 7 / 开放环 1）
