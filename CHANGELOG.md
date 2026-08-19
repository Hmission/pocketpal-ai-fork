# Changelog

本项目所有重要变更均记录在此文件。

格式基于 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，
版本号遵循[语义化版本](https://semver.org/lang/zh-CN/)（.version / package.json / Android build.gradle / iOS project.pbxproj 四处同步）。

## [Unreleased]

### 新增
- DRC 能力 Skill 化挂测试链路（2026-08-19）：母仓新增 drc-remote-debug Skill（动作表/标准测试序列/观测三出口/CP 失败处置），挂啄木鸟测试专工链路 v1.1.2；DRC_SPEC 新增 §9 跨窗口智能体调用（最小提示词模板）；INDEX.md 登记 debug 模块（DRC_*）；DESIGN_SPEC B19 登记
- DRC 远程调试能力（2026-08-19，src/debug/）：文件双通道（adb push 命令 → App 执行 → 结果/事件落盘）——AI 测试发送 actionId 直接驱动 App（nav.go/chat.send/imagegen.generate 等 9 个动作白名单 + zod 校验），读 events.jsonl/state.json 替代读屏幕；状态指南针（StateCompass 五字段：state/nextAction/label/evidence/terminal，engineStatus 增强）；CP 报错机制（errorRegistry 六模式 + errorReport 报告附指南针编号）；门控 __DEV__||__E2E__（prod release DCE 剥离 + DRC_BRIDGE marker 契约）；开发机工具 scripts/drc/（drc-push/drc-tail/drc-state）；规范文档 docs/DebugRemoteControl/（DRC_SPEC + COMPASS_REGISTRY）
- DRC 方案补完（2026-08-19，Spec 对照审计）：动作注册表扩至 15 个（补 chat.newSession/models.load/models.unload/system.events/imagegen.loadDreamLite/imagegen.generateDreamLite——DreamLite 真机 39s 出图全链路验证，事件流完整记录 start→stage 25/50/75/100%→done）；事件流补 chat.turn_done（useChatSession run_finished）与 imagegen.stage（SD 1Hz 轮询 + DreamLite 采样回调）；独立 src/debug/stateCompass.ts（域级 STATE_MAP：engine/chat/imagegen/model + 未知降级 unknown）；门控改为 __E2E__||BuildInfo.isDevSupport（Hermes 预编译 __DEV__ 恒 false 真机实证）；drc-push.js 增 --params-file（Windows PowerShell 引号易错）；单测 5 套 37 用例（+stateCompass/新动作）

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
