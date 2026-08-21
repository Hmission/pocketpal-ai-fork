# Changelog

本项目所有重要变更均记录在此文件。

格式基于 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，
版本号遵循[语义化版本](https://semver.org/lang/zh-CN/)（.version / package.json / Android build.gradle / iOS project.pbxproj 四处同步）。

## [Unreleased]

### 生图性能
- 放大模型升级与双档可选（2026-08-21，A' 定稿，IMAGE_GEN_UPGRADE_PLAN §6.20）：动漫高清档换官方图片级 x4plus_anime_6B（RRDBNet-6 17MB，静态图质量实锤优于视频级 animevideov3，代价单 tile ~10s）；保留 animevideov3 为「动漫快速」档（快约 4 倍）双档可选（SRStyle 三值 + FILES 三件套 + UpscalePanel 三选项）；推理 EP 加 NNAPI（K90 实测全档收益 1.7-2.7 倍——anime_fast 22.3s/anime 67.6s/general 218.5s vs 小米 13 55.4s/185.0s/~370s；8 Gen 2 回退 CPU 无副作用）；PasSR 无公开权重调查实锤放弃；assets 标记 .v4 强制重复制；真机 DRC 全链路：anime_fast 2× 12.0s / anime 2× 47.3s / 4× 56.4s / general 2× 133.6s，像素取证三档彩色无回归
- DreamLite TE 切 NNAPI EP（K90 实测 TE 编码 -38.5%、全流程 -29.1%；小米 13 持平自动回退，单配置保留）

### 修复
- DreamLite 生图灰纹理回归根治（2026-08-21，大王复查双机灰纹理）：编辑链路 mask 边界修复（real-dropIdx）只覆盖 edit 分支——generate 分支未设置 real（保持 0）→ realKept=0 → 条件与 mask 全零 → UNet 零条件去噪=灰纹理；修复 generate 分支补 `real = ids.length`（kept 从 0 恢复 seq-34）；K90 真机红苹果木桌图验证非灰（kept=34）；提交 0378b84
- 相册历史覆盖事故根治 + 持久化架构对齐（2026-08-21，大王发现定调，B27）：imageGenStore 持久化迁移 `mobx-persist-store`（构造即水合/写自动持久化/水合前不写盘——磁盘永不被空数组覆盖），删手写 persistHistory；旧 key 一次性迁移；DRC 直调放大（upscale）不再覆盖相册（真机 46→47 追加实锤）；数据恢复：新增 DRC `imagegen.recoverHistory`（开发工具）扫描磁盘重建 legacy 条目——小米 13 恢复 41 条 + K90 恢复 57 条（8/19-8/20 丢失记录全部找回，图文件本未丢失）；MASTER_LOG §64 复盘留档
- DreamLite 编辑链路根治（2026-08-21，task-9f2e 闭环）：编辑出图与源图完全无关——完整根因链三处：① TE 缺视觉通道 + 指令截断 128（官方 edit 模式用 Qwen3-VL ViT 把 512² 源图编码为 256 视觉 token 注入 prompt_embeds）→ 双段 ONNX 对齐（te_vision_visual 视觉编码 + te_vision_lm 融合 LLM，M-RoPE position_ids 端侧构造，桌面逐值验证）；② **原生解码 HWC/NCHW 排布错乱**（ImageGenModule.kt 返回 HWC 交错，VAE 条件与视觉通道按 NCHW 读 → 双通道错乱）→ 改按通道平面输出；③ **prompt mask 边界错**（用 kept=456 含 LM pad 区 hidden，官方只标真实 token real-drop=297）→ 边界改 real-dropIdx。桌面同契约三 seed 稳定对照 + 真机端到端验证（K90：make it snowy → 红苹果保留+背景保留+雪层，与桌面一致）；TE 双段定稿 CPU EP；提交 95511de + a890f60
- 聊天页 UI 三处优化复查修复（2026-08-20，task-6ad 复查闭环）：① **P0 徽章行 N+1 重复渲染根治**——168823b 在 `Message.renderAssistantTurn` turn 级插入徽章行但 `ChatScreen.renderBubble` 未加类型门控，每个内容块再渲染一行（单块 turn 双徽章）；修复 `message.type !== 'assistant_turn'` 门控，新增 `renderBubble.test.tsx` 三用例防回归（turn 不渲染/text 渲染/用户消息永不渲染，反向验证有效）；② **AssistantAuthorRow 逻辑修正**——author.id 硬编码 `'user'` 改真实 `user.id`（实际 userId='y9d7f8pgn'，原判断恒真致用户消息被误判为助手）、意图选择器初始值从消息快照改会话实时 `activeSessionIntent`（消除行为漂移）、非必要动态 import 改静态（实证 store 无 components 引用、无循环依赖）；③ **顶栏等距度量修正**——初版 gap:10 以触区间距为度量，图标视觉空隙实测 73→99px 越修越大；改 `compactBtnLeft`（alignItems flex-start + marginLeft -6dp 补偿 DotsVerticalIcon viewBox 内留白），真机像素验证胶囊↔加号 35px / 加号↔三点 36px / delta 1px。tsc 零错 + 相关套件全绿
- 出图按钮失效根治（2026-08-20，两台真机 + DRC 三重复现）：`onPress={onGenerate}` 直传 async 函数，RN 把 GestureResponderEvent 作为首参传入——`handleGenerate(event)` 入口 `(event ?? prompt).trim()` 抛 TypeError 被 Bridgeless 事件系统静默吞掉（有按压缩放动效但出图零响应）。回归引入点 commit 44689f8 加 `promptOverride?: string` 参数（供 reroll 用），此前无参时 event 被忽略不炸。修复 `onPress={() => onGenerate()}` 显式无参包装 + testID="imagegen-generate"；RNTL fireEvent.press 传 0 参（源码 handler(...data) 实验实锤）与真机必传 event 的系统性盲区——回归防线 `fireEvent.press(el, {nativeEvent: {touches, changedTouches}})` 显式注入 event 模拟真机
- B19.1 上下文压缩链路根治（2026-08-20，小米 13 DRC 真机血证，全链路验证通过）：决策 compact 正确但压缩执行死锁（摘要请求与主生成双硬错 Context is full）。6D 排查定位：估算与实测双源脱节（banner 用 native 实测 vs 治理用字符估算）、无生成预留可单轮跳满、摘要工作集按字符不限 token 可自身溢出（llama.rn ctx_shift 默认 false 硬错）、防抢引擎检查拦死调度链路自身的摘要请求（handleSendPress 先置 inferencing=true，pre-send 压缩同流程内被 1ms 拦截）。根治六项：水位双源校准（resolveWatermark 消费 lastCompletionResult.used 钉底）+ 生成预留（GENERATION_RESERVE=512 触发线含本轮生成预算）+ 摘要工作集预算化（tokenBudgetToMaxChars 1:1 保守折算 min(6000, n_ctx−400)）+ 满态显式失败（饱和跳过压缩直接照发，context-full banner 用户主权，不静默不换引擎——大王裁定换模型不是正道）+ summarizer 防抢检查限定自动选引擎路径（显式引擎=调用方已裁决）+ createNewSession 重置会话级 ephemeral 快照（欠账会话残留致新会话首条误判 saturated）；撤销错误字符串匹配回退补丁；释放量校验（保护区外全压仍不达缺口诚实 null，target 驱动突破 20 条上限）。真机证据链：send-saturated 满态跳过 → 水位 39%→87% 实测钉底爬升 → summary-ok(342字) → context_compacted(7条) → 压缩后 5/5 轮 contextFull=false + 循环二次压缩 + footer「压缩 19」计数 UI 可见

### 改进
- 生图页新手引导交互闭环（2026-08-21，大王思路裁定，IMAGEGEN_UI_SPEC v4.1）：① 非 Dream（SD3.5/Z-Image）未加载时出图按钮不再灰置禁用——点击弹「需要先加载模型」提示 +「去加载」自动展开模型下拉，一步引导加载（再次生成 / 失败重试同链路自动复用）；② 非 Dream 下预览区有图时创作区常驻「编辑」按钮——点击确认后自动切换 DreamLite + 锁定当前图进入编辑预备态（一次点击闭环）；③ 切换模型即清空编辑预备态（防状态残留）；DreamLite 未加载自动加载引擎行为维持不变
- 模型加载卡片动效统一（2026-08-21，大王反馈）：聊天页两处模型加载卡片——顶栏选择器卡片（ChatPalModelPickerSheet，原纯文本）与任务切换弹窗加载态（ModelSwitchDialog，原 ActivityIndicator 转圈）——升级为生图任务卡同款动效（三点波浪跳动 + 2% 底条，复用 useWaveDots，JS driver 合规），消除「加载中像卡死」误判；ModelSwitchDialog 移除 ActivityIndicator 统一设计语言；K90 真机复查二次优化——弹窗候选行/加载态模型名改中文简称（getModelDisplayNameWithParams 与选择器同源，替代完整 gguf 文件名）+ 加载态布局重构（三点波浪独立行 + 模型名单行截断防溢出），真机全链路验证通过
- 进度监控卡卡片化（2026-08-19，CHAT_UI_SPEC §18.9 v4.2）：PendingIndicator 容器升级为 assistant 卡片设计语言（assistantBubbleBackground 底色 + messageBorderRadius 圆角），与聊天流卡片同一视觉族；K90 真机三截图验证
- 代码/玩具匠终局选型 LFM2.5-2.6B（2026-08-20，大王钦定）：替代 Ministral-3-3B（迭代合规不稳 PLAY-6）；LFM2.5 族工具调用专长 + 1.67GB PSS 安全（LFM8B 5.16GB 被 K90 HyperOS PSS 看护 6GB 硬杀，厂商锁死不可关）；K90 真机三点验收全绿（选型生效 + 加载 2s + 玩具生成落盘）

### 新增
- 产物工作区与上下文治理升级（2026-08-21，WORKSPACE_SPEC v1，task-012）：①**策展表重排（小模型长上下文）**——MiniCPM5-1B 8192→16384、Qwen3.5-2B/LFM2.5-2.6B 16384→24576、Ministral-3-3B 8192→16384（GGUF 元数据验算 ≤4GB PSS 预算，KV 便宜即长上下文红利）；Qwen3.5-4B 保持（KV 大户 128KB/token 审计自动降档诚实档 4096）、LFM2.5-8B-A1B 保持（K90 PSS 硬杀）；②**产物工作区三协议**（src/services/workspace/）——目录（workspace/writing/<project>/ 大纲+人设+正文分章）+ 索引（每域 index.json 写后置顶）+ 分段读取（`##` 分节只读目标段，单文件 ≤20KB 超限显式拒绝开新章）；③**写作链路闭环（WritingDocEngine 九动作）**——init/list/new_chapter/read_section/read_all/list_sections/append/update_outline/update_persona，产物落盘 + 记忆 fact「在写《X》」+ DRC 埋点 workspace.writing_doc；④**路由与恢复双触发**——WRITE_RE 续写意图（继续写/续写/接着写/写下去）+ 快捷前缀「新建写作项目：/写作项目：」；恢复链路索引命中 → 框架文档注入 → 续写，未命中静默；⑤**上下文按需读取**——框架文档内联注入、正文/剧情永不预注入（contextAssembler workspaceContext 参数）；⑥**压缩修正**——输入截断与标记一致性（超预算先裁 slice 本身，杜绝静默丢失；不达缺口诚实 null）+ 摘要产物指针语义（只记「产物已落盘」不复述正文）+ 手动压缩可压全区间；⑦**冒险/玩具补齐**——AdventureStateEngine 增 read/append 多文档（世界设定/角色卡/剧情，白名单防任意路径写盘 + workspace.adventure_state 埋点 + 城主人设引导开档建档/续档先读）；toyChest 既有单层索引直读不动（read_html/玩具箱即消费端）。门禁：tsc 零错 + jest 全绿（workspace 三协议/WritingDocEngine/AdventureStateEngine/taskRouter/压缩 12 新套件）+ 文档同步（POCKETPAL_WORKSPACE_SPEC.md 新建 + PRODUCT_SPEC §4.11 + COMPASS_REGISTRY §4.1）
- 管家记忆闭环 + 用户主权升级（2026-08-21，AIOS_MODEL_SCHEDULING_SPEC §9.7）：① L1 管家直答记忆读侧闭环——butlerReply 注入 buildButlerContext（今日状态/记忆 top4/召回 top3/意图语气，复用既有记忆函数零新逻辑），promptWriter.chat 增 systemExtra 可选参；管家回合对齐会话意图状态机（classifyIntent + setSessionIntent）；② L2 用户主权升级——butler 卡片「✨ 回答不满意？换个更聪明的模型」升级行（ButlerUpgradeRow），chat 任务族选型（与 write 同源）复用懒切换链路，加载成功自动重发同一问题（引擎驻留防抖动）；③ L3 l10n 收口——chat.butlerThinking/butlerUpgrade/taskErrorTitle 等 7 新 key ×15 语 + common.retry，TaskErrorCard title/detail 按 code 渲染端单点生成（调度层零文案），insertTaskError 瘦身（只存 code/retryText/modelName）；④ B23 登记遗漏补录（AssistantAuthorRow 入 invariants 白名单）。门禁：tsc 零错 + jest 313 套件 4486 通过 + l10n:validate 全绿
- 模型全平台分发闭环（2026-08-20~21，B25）：①魔搭 5 仓 15.1GB——Qwen3.5-2B/4B 与 MiniCPM5-1B 管家镜像上传（zensignGG 账号，与 HF 原仓逐字节一致）+ DreamLite ONNX 自制套件 + 自制 HumanPose LoRA；②HF 3 仓（QDD110 账号 write token）——SD35-HumanPose-LoRA + DreamLite-mobile-ONNX 双平台闭环；③catalog 全条目双源化（Qwen×2/MiniCPM/DreamLite 在线可下载，模型页不再「请本地导入」；自制 LoRA 挂 sd35 条目 extras 双源下载）；④baked/merged GGUF 不装机不分发（大王钦定）；⑤SOP/MODEL_MATRIX 对齐（0.6B 标禁止推送、§6.1 补 mmproj-4B + lora 14→16）；⑥token 管道固化 .env（MODELSCOPE_TOKEN/HF_TOKEN，新窗口免找）——远端 206 字节精确匹配（魔搭 5 仓 + HF 3 仓，全量 ~23GB）
- RealESRGAN 通用图像放大能力（2026-08-19，独立通用，不绑定 DreamLite）：双模型内置（x4plus 63MB 通用写实 / animevideov3 2MB 动漫插画）；tiled 推理引擎（256 tile + 16px overlap 羽化 + 输入解码限 1024 + 大图防护 4096 上限）；桥传输 base64（3.1M 装箱过桥峰值 ~150MB OOM 风险 → 改 ~4MB base64 串 + 纯 JS 解码器）；engineMutex 互斥纳入；UpscalePanel 纯参数面板 + 任务化进度；DRC 动作 imagegen.upscale
- 全屏图片查看器 ZoomableImage（2026-08-19→20，3 轮真机复测闭环）：双指捏合缩放（1-4×）+ 拖动平移 + 单击关闭；浅色主题遮罩；Modal 内 GestureHandlerRootView 重新 root；reanimated worklet 指令 + runOnJS；Gesture.Exclusive(composed, tap) 官方 PhotoZoom 范式

### 优化
- 聊天卡片尾角下移 + footer 分隔线（2026-08-20，大王裁定，CHAT_UI_SPEC §20.2 v4.6）：消息卡片尾角从顶部移到底部——用户卡右下直角、回答系（正文/思考/进度卡）左下直角（Bubble·Message·ThinkingBubble·PendingIndicator 同族，四角显式拆分，roundBorder 逻辑镜像至顶部同侧角，组内最后一条形成同侧全直边）；AssistantTurnFooter 按钮栏与信息栏之间加 hairline 分隔横线（与动作槽同分隔语言）。tsc 零错 + jest 58 全绿 + 双机真机验证（小米 13 像素级行扫描 + K90 目视确认）
- 浮层与横幅体系收敛（2026-08-20，B23，DESIGN_SPEC §12 契约 v3.5）：弹窗/横幅/提示面单一事实源——新建 `ui/OverlayCard` 居中弹窗底座（backdrop 遮罩 + surfaceElevated + xl 圆角 + elevation 8 + titleS + Actions 槽），4 命令式弹窗（ConfirmDialog/ModelSwitchDialog/ErrorReportDialog/IntentPicker）+ 业务弹窗（Memory×2/ImageGen 参数/RenameModal）全部迁移；新建 `ui/BannerBar` 横幅底座（语义色 12% wash + hairline + captionM + 统一 Meter），BannerRow/ActiveTaskBanner/DownloadBanner 收敛、进度条三套合一；删除休眠组件 ui/Modal、ui/Sheet、ui/Dialog 与自建 useToast（Paper Snackbar 唯一轻提示）；ErrorSnackbar 图标自绘化（vector-icons 清零）；emoji 清零（IntentPicker ✓/ActiveTaskBanner ⚠️⚙️/BenchResultCard/ToolScreen）；Sheet 底色 surfaceElevated；UpscalePanel 改走 components/Sheet；真机双模式走查 + 修复迁移回归（Sheet 必传 snapPoints，Android enableDynamicSizing 不可用）
- 聊天页 UI 三处优化（2026-08-20，task-6ad，CHAT_UI_SPEC §20）：① 抽取 `AssistantAuthorRow` 单一事实源（模型徽章 + 意图胶囊），`assistant_turn` 与 `text` 消息共用，徽章行置于思考卡/正文卡之前（turn 级仅一次，根除多块路径潜在重复渲染）；② 圆角区分（用户卡右上直角 / 回答系卡片左上直角，Bubble·ThinkingBubble·PendingIndicator 同族同步，删 `borderRadius` 速记改四角显式）；③ 顶栏三控件水平等距（HeaderRight `gap:10`）；④ 补充：正文卡快捷图标间距 6→14 防误触。tsc 零错 + 相关 jest 套件全绿
- DRC 能力 Skill 化挂测试链路（2026-08-19）：母仓新增 drc-remote-debug Skill（动作表/标准测试序列/观测三出口/CP 失败处置），挂啄木鸟测试专工链路 v1.1.2；DRC_SPEC 新增 §9 跨窗口智能体调用（最小提示词模板）；INDEX.md 登记 debug 模块（DRC_*）；DESIGN_SPEC B19 登记
- DRC 远程调试能力（2026-08-19，src/debug/）：文件双通道（adb push 命令 → App 执行 → 结果/事件落盘）——AI 测试发送 actionId 直接驱动 App（nav.go/chat.send/imagegen.generate 等 9 个动作白名单 + zod 校验），读 events.jsonl/state.json 替代读屏幕；状态指南针（StateCompass 五字段：state/nextAction/label/evidence/terminal，engineStatus 增强）；CP 报错机制（errorRegistry 六模式 + errorReport 报告附指南针编号）；门控 __DEV__||__E2E__（prod release DCE 剥离 + DRC_BRIDGE marker 契约）；开发机工具 scripts/drc/（drc-push/drc-tail/drc-state）；规范文档 docs/DebugRemoteControl/（DRC_SPEC + COMPASS_REGISTRY）
- DRC 方案补完（2026-08-19，Spec 对照审计）：动作注册表扩至 15 个（补 chat.newSession/models.load/models.unload/system.events/imagegen.loadDreamLite/imagegen.generateDreamLite——DreamLite 真机 39s 出图全链路验证，事件流完整记录 start→stage 25/50/75/100%→done）；事件流补 chat.turn_done（useChatSession run_finished）与 imagegen.stage（SD 1Hz 轮询 + DreamLite 采样回调）；独立 src/debug/stateCompass.ts（域级 STATE_MAP：engine/chat/imagegen/model + 未知降级 unknown）；门控改为 __E2E__||BuildInfo.isDevSupport（Hermes 预编译 __DEV__ 恒 false 真机实证）；drc-push.js 增 --params-file（Windows PowerShell 引号易错）；单测 5 套 37 用例（+stateCompass/新动作）
- 多玩法品牌标语（2026-08-19~20，大王钦定语）：「住进手机的开源 AI 伙伴——聊天、生图、玩乐、绘本、冒险，多种玩法全部离线运行在您的设备上」替换「部署大语言模型」旧定位；16 语言 about.description + README + APP_INTRO_COPY 三版式 + AGENTS.md + PRODUCT_SPEC §1.1 + GitHub 仓库 description 全链路同步
- 开源边界清理（2026-08-19~20）：.qoder/settings.json 从全 git 历史清除（filter-repo）+ force push；scripts/aios、scripts/governance、scripts/sd35_lora、docs/adr、docs/_templates 及内部治理文档共 38 文件移除（-4552 行）；.gitignore 扩充 14 条防回潮（只开源工程，不开源开发工具）
- 版本同步单点命令（2026-08-19~20）：scripts/bump-version.js 一处命令四处同步（.version/package.json/build.gradle/pbxproj，versionCode 自增 +1，同版本显式失败）；jest 5/5；AGENTS.md 发布流程改为「单点命令，禁止手工改」；git tag v2.0.0

## [2.0.0] - 2026-08-19

### 新增
- fork 首个自主版本号（2026-08-19）：版本号告别上游 PocketPal AI 遗产（1.16.1）——产品已具备聊天/生图/玩具工坊/记忆绘本/TRPG 冒险/完全开源全新面目，按 semver 定为 2.0.0（versionCode 144）；同步确立版本机制：每次发版四处同步（.version / package.json / build.gradle / pbxproj）+ CHANGELOG 收编定版，开发迭代以构建时间戳区分
- 聊天页八项体验升级（2026-08-20）：①意图会话级状态机——Session 新增 intent 列（schema v8），首轮 classifyIntent 定值落库后沿用，意图胶囊点按四态选择器为唯一写入口（system 语气注入/胶囊/快照同源）；②助手卡 chrome 双行合并——AssistantTurnFooter 行1 动作/行2 统一指标行（captionS + 数值 brandAccent 600 + `·` 分隔），TurnMetricsRow 删除（每卡一块 chrome）；③placeholder 单源决策表——engineStatus 状态中枢五级优先（含管家 loading 分支「正在加载管家模型…」）；④顶栏紧凑化——新建会话 EditBox→加号、双钮 36px 紧凑触区、右侧行 gap 2；⑤发送钮双态描边——不可用=透明底+outlineVariant 圆形描边（删外层 opacity 包裹）；⑥n_ctx 单一事实源+每模型预调——上下文不足弹窗改写 setModelNCtx（与生成设置页同存储自动同步），加载链按内存 ceiling 沿 CONTEXT_LADDER 预调最大可装档（一次预调持久化）；⑦模型用途标签体系——设置页「用途」多选 chips（写作/代码）写 capabilities，选型升级 listModelsForTask（用户标签>指纹>兜底）弹窗多候选单选；⑧快捷行日记/绘本/读屏裁定不加（各有唯一入口，加入口违锋利原则）
- PSS 安全预算（2026-08-19 K90 真机血证）：n_ctx 每模型预调天花板取 min(内存 ceiling, PSS_SAFE_BUDGET 4GB)——厂商 PSS 看护（HyperOS 实测 ~6GB 硬杀）是进程存活真正天花板，估算为理论值宁少勿杀；启动审计 auditPerModelNCtxAgainstPss 自愈旧版预调写入的超限档；用户手调不受限（决策可见）
- 聊天顶栏重构（B18，2026-08-18）：模型胶囊管家感知三档显示（已加载模型→「管家 MiniCPM 1B」→选模型）；选择器卡片化（MODEL_MATRIX 入选说明+徽章+行内加载/卸载+管家禁卸+单槽脚注「加载新模型自动卸载」）
- 状态栏拆解融合进助手卡（B18）：SessionStatusBar 整行删除；意图四色胶囊上移作者行；每输出指标行（上下文余量·落盘·召回展开·情绪）run_finished 快照 turnMetrics；ctx 中文点按直达生成设置；思考胶囊 24px 视觉同高收敛
- B18 复查锋利化（08-19）：选择器加载进度行（正在加载·已耗时 Xs）+ 加载期 sheet 驻留/收尾自动关（关闭单点收敛）；isChatSelectable 收口 GGUF+manifest 名单（sd35 baked 工件不再混入聊天选择器）；死代码清除（engineStatus.summary / getLastExtractionCount）
- 关于页构建时间（开发者预览版，2026-08-18）：Android BuildInfoModule 注入 BUILD_TIMESTAMP，关于页显示「开发者预览版 · 构建于 yyyy-MM-dd HH:mm」并纳入版本复制串，便于同版本号迭代对比
- 生图任务化（2026-08-18）：每次生成/编辑 = 一个持久化任务（running 空白进度页 / success 回填图 / failed 保留报错页）；生成进度不再叠在旧图上；失败页含摘要 + 复制报错/重试/删除按钮
- 报错一键复制（errorReport 统一出口，2026-08-18）：完整诊断报告（摘要/错误/上下文/版本/设备/时间）复制到剪贴板并落盘 /sdcard/Documents/AIOS/logs/；聊天完成失败弹报错弹窗，生图报错唯一出口收敛到预览区（composer 底部不再显示）
- 消息卡片 footer 重新生成按钮（2026-08-18）：复用长按菜单 handleTryAgain 完整能力链（agent 运行中/无激活模型禁用）
- 卸载保留用户开关（2026-08-18）：系统设置「卸载后保留聊天记录」（默认开；关 = 停止快照导出并删除已有快照）
- 描边强化（2026-08-18）：抽屉搜索框 1px 描边 + 聚焦橙黄（primary）；聊天/生图顶栏模型胶囊加 primary 描边
- 测试分发（2026-08-18）：仓库根产出 PocketChick-devpreview-*.apk + pocketchick-preset-models-*.zip（MODEL_MATRIX 全量 17 件，含 TESTER_GUIDE）
- 聊天输入语音输入（设备端 STT，2026-08-17）：发送按钮升级为「空输入显示麦克风 → 录音中变红色停止 → 识别结果实时填入 → 打字后恢复发送」状态机；基于 @react-native-voice/voice 3.2.4（patch-package 适配 AGP8 namespace），Android RECORD_AUDIO / iOS 麦克风权限说明；无语音识别服务的设备自动降级为纯发送按钮（真机实证）
- 聊天输入第二行高度统一 36px（思考胶囊 / 发送 / 语音按钮同一基线，真机 bounds 验证一致）
- 关于页标准版文案（多语 16 语言）：详细介绍段落 + 特性列表 + 开源说明
- 生成设置参数标签 16 语言本地化（completionParamsLabels / completionParamControls，ML 术语保留英文）
- 开源发布准备（2026-08-19）：README 重写（中英双语 + 贡献指南 + 仓库地址）、LICENSE 追加 fork 版权、AGENTS.md 公开版、内部 AIOS 文档移出跟踪；关于页新增 GitHub 仓库入口按钮（16 语言，Linking 直达仓库）；about 文案全面升级为开源定位（description/body/features/openSourceBody 完全开源表述 + 新增 githubRepoDescription）；APP_INTRO_COPY 三版式同步开源定位与仓库地址
- 模型目录双轨架构（ADR-0004 / B15）：HF 等平台下载的模型默认落应用专属规范目录（getExternalFilesDir/models，零权限、Play 合规）；设置页新增「模型目录」入口，自定义目录走系统目录选择器（SAF，只能选文件夹），默认注册 AIOS 共享目录（/sdcard/Documents/AIOS/models）续读存量模型

### 修复
- 聊天页八项复查闭环（2026-08-20）：placeholder 决策表第 4 分支硬编码中文收口 l10n（chat.butlerReady 16 语，de/it/et 回退 en）；生成设置失焦显示与保存同源（读 getModelNCtx，修回跳）；GenerationSettingsScreen 测试模拟路径对齐 setModelNCtx 每模型覆盖（banner 不再改全局）；mock chatSessionStore.taskModelChoice 补 play 槽对齐真实 store；intentLoading 测试时间耦合修复（独白路径硬编码日期翻页即挂，改动态今日）
- 真机反馈五项修复（2026-08-18 二轮）：关于页构建时间独立成行（不再与版本按钮同行溢出）；生图胶囊底色统一为 primary 12%（与聊天页同）；思考开关选中态黑底改标准橙黄底；图片编辑按钮空锚点致真机菜单不弹的根因修复（按钮即锚点，点按弹拍照/相册）
- n_ctx 每模型独立（2026-08-18）：ModelStore.perModelNCtx 覆盖表（持久化）+ 加载链按模型取生效值；生成设置上下文输入框操作活动模型（标签带模型名）；聊天页状态栏 ctx 胶囊点按直达生成设置
- 卸载保留快照路径根治（2026-08-18 真机取证）：watermelondb native 实际落私有根目录（getDatabasePath().replace("/databases","")），旧硬编码 files/ 致导出静默失效；改三候选兼容（根目录/files//databases/）导出取先存在者、恢复多写，K90 实证进后台快照落盘 AIOS/database/
- 权限引导判定根治（2026-08-18 真机取证）：ensureStorageAccess 探测列表混入零权限默认目录（getExternalFilesDir 恒可读）致判定恒真、引导永不弹；改只探测自定义目录（含默认注册 AIOS），全不可读才弹「所有文件访问」引导
- 消息卡片复制按钮丢失（2026-08-18）：门控从 metadata.copyable 改为「内容非空且已完成」（isFinalMessage 单一事实源，PlayButton 同源），旧消息不再缺按钮；按钮组左对齐正文缩进（不再贴卡片边缘）
- 卸载重装快照竞态根治（2026-08-18）：sharedStorageBootstrap 单门（memoized），DB 首查（ensureReady）必先 await 快照恢复，杜绝空库先建导致恢复条件失效；聊天写入后 10s debounce 追加快照导出（前台被杀最多丢 10s 窗口）
- 关于页硬编码中文 MIT 署名行 l10n 化（此前英文界面也显示中文）
- 生成设置参数标签硬编码大写英文（TEMPERATURE/N PREDICT 等）改为多语言文案
- zh_Hant 补齐 modelDirs 10 key（模型文件夹繁中，缺失清零）
- llama.rn 原生库缺失防御（2026-08-17）："JSI bindings not installed" 根因 = llama.rn 0.12.7 上游发布不一致（npm 包代码期望 librnllama_jni_*.so，官方 prebuilt 无 _jni），jniLibs 被重装依赖删除后无法自动恢复；新增 scripts/restore-llamarn-jnilibs.js（三级恢复：.tmp 滚动备份 → gradle 构建缓存 → release APK 纯 Node zip 提取）挂接 postinstall，丢失自动修复或显式报错
- 聊天记录卸载丢失（B14）：WatermelonDB JSI 私有库快照机制——进后台导出到共享存储，启动时私有库缺失自动恢复；聊天记录与模型目录同一持久化策略，仅用户主动清数据才丢
- 存储权限设计重做（B13）：以「目录实际可读」判定权限（PermissionsAndroid.check 对 MANAGE 特殊权限不可靠），系统请求优先、永不短路扫描，修复「已授权仍扫不到模型」
- 聊天顶栏图标尺寸统一（B10）：HeaderRight 24→20px 与左侧对齐，新增 iconSize token（xs14/s16/m20/l24/xl28）

## [v1.16.1] - 2026-08-15

### 新增
- 本地生图能力（P5 系列）：DreamLite 端侧图像生成引擎（ONNX 导出，4 步 flow-matching 蒸馏，1024px 输出，纯 JS PNG 编码），支持文生图与图像编辑（VAE Encoder 条件路径）
- SD3.5 / Z-Image-Turbo 模型入场（实验性徽标），模型管理 Manifest 声明式链路
- 模型智能调度（P4）：常驻管家 + 任务驱动 + 聊天内闭环生图，冷却期防错机制 + 内存预设 n_ctx
- 聊天页 UI 重设计（W1-W4）：模型徽章、画图入口、全局 ConfirmDialog 统一弹窗体系、操作条三按钮、返回按钮对齐、品牌色点缀
- 侧拉抽屉与设置页信息架构重构：会话中心 + 聊天头部生图入口 + 三级导航后退
- 品牌二次改名：口袋八哥 → 小黄鸡（英文 Pocket Chick），人设/空态/思考卡片文案全链联动
- 情绪系统（M7）：词库情感打分 + 状态栏展示
- 智能体仪式四件套：开场仪式、意图状态机、收尾协议、自检开关
- 生图历史持久化、存相册、全屏查看/管理、崩溃落盘日志埋点
- 启动恢复上次会话、顶栏模型下拉入口

### 修复
- DreamLite 纯黑图回归：sigmas NaN 溢出根因 + VAE 缩放因子对齐官方 1024
- Vulkan 真机崩溃（Adreno 双后端 hang）→ OpenCL 正确路径 + 失败回退 CPU
- TE 编码后内存释放（降低生成峰值内存），ONNX/Llama session 释放 await
- 生图页 50 张全尺寸大图解码风暴致全页空白
- 本地模型 modelType 未标注导致聊天页列表为空（adoptExisting 补全）
- 长按"从此处删除"、Pal 模型切换确认统一 ConfirmDialog
- 安卓状态栏安全区、抽屉图标差异、输入框分隔线
- 记忆提取真机复测修复（剥离 BOS / 禁用 thinking / JSON 兜底）

### 性能
- OpenCL GPU 加速实证：SD3.5 从 CPU 2h+ 提速到 10.7 分钟（Adreno）
- 全 App 循环动效收口 JS driver（弱引用溢出崩溃根治：推拉反转架构替代节流补丁）
- TE 编码后释放降内存峰值

### 技术架构
- DreamLite 端侧接入全闭环：真实文生图（ONNX TE + llama.rn tokenize + ORT UNet）+ 编辑落地
- 生图引擎单通道 + 同槽互斥（EngineMutex），backend 单点决策上 manifest
- sd.cpp 源码入库（1616 文件，含 ggml）替代 gitlink
- 聊天任务调度链抽 useChatScheduler hook，ChatScreen 瘦身

### 文档
- 产品/技术文档体系：CHAT_UI_SPEC、IMAGEGEN_UI_SPEC、MODEL_MATRIX（模型选型唯一事实源）、MASTER_LOG 主日志（§15 改名 SOP / §18 窗口闭环）、APP_INTRO_COPY（介绍文案库）
- 装机 SOP 定稿：备用机黄金标准核对清单 + 换机铁律 + 存储授权 EACCES 根因

### 其他
- onnxruntime 锁版本 1.28.0 防动态版本漂移
- 生图模型与 LLM 列表双层过滤隔离（Manifest 文件集合）
- 撤回 DeepSeek Hermes 错误登记，模型清单管辖边界明确

## [PocketPal AI v1.16.1] - 上游基线

- 本项目基于 [PocketPal AI](https://github.com/a-ghorbani/pocketpal-ai)（MIT License）v1.16.1 fork 二开
- 上游功能基线：本地 GGUF 模型聊天、Pals 角色、TTS、Hugging Face 模型下载、CPU/GPU/NPU 加速
