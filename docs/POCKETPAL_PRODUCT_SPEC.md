---
doc_id: POCKETPAL_PRODUCT_SPEC
module: root
type: positioning
status: active
version: "1.0"
created: "2026-08-17"
updated: "2026-08-17"
relates: [INDEX, POCKETPAL_DESIGN_SPEC, POCKETPAL_MODEL_MATRIX, APP_INTRO_COPY, POCKETPAL_CHAT_UI_SPEC, POCKETPAL_IMAGEGEN_UI_SPEC, ONDEVICE_IMAGE_GEN_MILESTONE]
---

<!-- D-FORMAT:v3 -->

<!-- 文档管理：机制见 docs/DOC_MANAGEMENT.md；AI 用法见 docs/CURSOR_DOC_USAGE.md。
更新时：1) 更新 frontmatter 的 updated/version；2) 同步 type/status/relates 与文末「关联文档」；
3) 若取代/被取代则填 supersedes/superseded_by；
4) SSOT 文档须在「关联」章节指向相关 ADR 与 SOP；
5) 在 docs/INDEX.md 中登记。-->

# 小黄鸡 Pocket Chick 产品文档（PRODUCT_SPEC）

**状态**：active | **版本**：1.0 | **更新**：2026-08-17

> **定位**：全 App 产品视角的唯一入口文档——回答「我们做的是什么、做到哪了、为什么好」。技术细节见各域 SPEC/ADR；本文档聚焦产品概述、开发里程碑、功能设计与产品亮点。

---

## 一、产品概述

### 1.1 一句话定位

**小黄鸡（Pocket Chick）是一款住进手机的完全开源 AI 伙伴——聊天、生图、玩乐、绘本、冒险，多种玩法全部离线运行在设备上；无审查、有人设，对话与创作全程不离开设备。**

### 1.2 品牌

- **App 显示名**：小黄鸡（英文 Pocket Chick，2026-08-13 大王钦定，历经「默认 → 口袋八哥 → 小黄鸡」两次更名）
- **代码兼容红线**：`name=PocketPal`、`applicationId=com.pocketpalai` 为兼容红线不可改
- **开源署名**：二开自 [PocketPal AI](https://github.com/a-ghorbani/pocketpal-ai)（MIT License），关于页保留署名

### 1.3 产品理念

| 理念 | 说明 |
|---|---|
| **完全离线** | 模型 mmap 本地文件，无任何网络调用；对话、生图、记忆全部在设备内闭环 |
| **隐私主权** | 不联网 → 不上传 → 不追踪；每次提问只留在自己手机里 |
| **锋利不臃肿** | 不兜底不补丁、不堆无用功能；每项能力完整交付，做不了就明确不做 |
| **单状态机链路** | 引擎调度一条链走到底：启动即就绪、任务即加载、聊天内闭环、状态永远可见 |
| **进化型智能体** | 从「聊天工具」向「寄宿型口袋智能体」演进：人设（SOUL）+ 记忆（MEMORY）+ 规范（AGENTS）+ 调度 |

### 1.4 目标用户与场景

- 注重隐私的用户：不愿把对话交给云端
- 离线场景：无网络/弱网络环境下的智能助手
- 创作者：端侧无审查生图，创作素材不出设备
- 模型爱好者：多模型自由切换、自由下载 GGUF

---

## 二、开发里程碑

> 全部开发自 2026-08-11 至 2026-08-17 密集完成，从「上游源码」到「端侧生图三模型全通 + 开源发布就绪」。

### 2.1 里程碑总览

| 阶段 | 时间 | 主题 | 关键成果 |
|---|---|---|---|
| P1 | 08-11 | 源码编译 | Debug APK 产出；七大坑解法存档（镜像墙/路径限制/NDK 版本等） |
| P2 | 08-11 | 模型注入 | 2.6GB 模型入机；「>500MB 一律 UI 导入」铁律 |
| P3 | 08-11 | 灵魂注入 | 408 字符人设 + 代码级注入（PERSONA_BLOCK） |
| P4 | 08-11~14 | 模型选型 | 选型四铁律 + 七件套落盘 + MODEL_MATRIX 唯一事实源与推送门禁 |
| UI 迭代 | 08-12~14 | 产品化 | 状态栏/抽屉/弹窗/输入框修复；暖巢 WarmNest 设计语言定稿 |
| 智能调度 | 08-12 | 调度架构 | 常驻管家 + 任务驱动 + 聊天内闭环 + 冷却期防错 |
| 生图引擎 | 08-12 | P5.1/P5.2 | stable-diffusion.cpp 编入 + JNI 桥接 + 生图页落地 |
| 品牌定名 | 08-12~13 | 品牌 | 口袋八哥 → 小黄鸡（Pocket Chick），图标全套重生成 |
| DreamLite | 08-14 | 生图主线 | 端侧文生图 + 图像编辑全闭环（ONNX TE + ORT UNet） |
| SD3.5/Z-Image | 08-16~17 | 攻坚 | 白图根因根治 + tiled 内存降级 + Adreno 内核恢复提速 4.8 倍 |
| 聊天闭环 | 08-14~16 | 豆包化 | 聊天内插卡生图/编辑/再来一张；多模态崩溃根治 |
| 发布准备 | 08-15~17 | 发布 | 文档体系、开源准备、装机 SOP、端侧生图三模型里程碑 |

### 2.2 P1-P4 基础期（2026-08-11）

**P1 源码编译**：JDK 17 + Android SDK（android-36 / NDK 27.3 / CMake 3.22.1）+ Yarn + Node v25 构建 Debug APK。七坑存档：

| # | 坑 | 解法 |
|---|---|---|
| 1 | Maven 镜像墙 | 全局 Gradle Init Script 注入阿里云镜像 |
| 2 | Gradle 9 移除 VersionNumber | 手改 onnxruntime build.gradle 补 import |
| 3 | Windows 260 字符路径限制 | 注册表 LongPathsEnabled + 项目移 F:\pp + CMAKE_OBJECT_PATH_MAX 999 |
| 4 | Firebase google-services.json 缺失 | 构造占位 JSON 绕过校验 |
| 5 | NDK/CMake 版本钉死 | sdkmanager 补装指定版本 |
| 6 | libworklets.so 冲突 | packagingOptions pickFirst |
| 7 | HyperOS USB 安装限制 | 开发者选项开启「USB 安装」 |

**P2 模型注入**：三条失败路径存档（PowerShell 重定向 / Python 管道 / adb exec-in 均不可靠）→ 最终方案「模型推 /sdcard + App 内 UI 手动导入」，定下铁律：**run-as 对 stdin 截断是系统级限制，>500MB 文件一律走 UI 导入**。

**P3 人设注入**：压缩为 408 字符 System Prompt + 大王画像；交付方式=剪贴板 → scrcpy 粘贴（RN 按钮在 uiautomator2 层级树不可见，自动化不可行）。后升级为代码级注入（PERSONA_BLOCK + 记忆碎片每轮拼入）。

**P4 模型选型**（大王实测 + 评测核查）四铁律：
1. **3GB 红线**：GGUF >3GB 明显变慢，速度 ∝ 内存带宽 ÷ 文件体积
2. **小模型量化敏感**：<3B 选高量化（Q5_K_M/Q6_K/Q8_0），不堆参数压低量化
3. **MoE 例外**：LFM2.5-8B-A1B 文件 5.16GB 但每 token 只激活 ~1.5B——速度按小模型算、智力按大模型算
4. **Qwen 必须无限制**：只用 Uncensored/Abliterated 版

### 2.3 产品化迭代期（2026-08-12 ~ 08-14）

- **App UI 四项修复**：安卓状态栏安全区（双渲染根因：ChatScreen 与 ChatHeader 各渲染一个 SessionStatusBar → 删冗余实例）；抽屉图标从「全齿轮」到一域一图标；抽屉 11 项平铺 → 三组分层；输入框两栏加分隔线
- **换标（MIT 合规）**：Android 5 density × 2 + iOS 11 尺寸全替换
- **品牌一次改名**：口袋八哥（英文 Pocket Myna）
- **模型智能调度（P4 产品升级）**：命题「启动即就绪 · 任务即加载 · 聊天内闭环 · 状态永远可见」
  - llama.rn 原生多 context 验证 → 管家模型与大模型共存，硬门槛解除
  - engineStatus（三引擎统一状态源）/ taskRouter（规则快筛只判不执）/ chatImageTask（聊天内联生图）/ ActiveTaskBanner（实时任务横幅）
  - engineGuard：推理串行化 + 400ms 冷却窗 + HostFunction 退避重试
  - recommendNCtx：按内存预设上下文（16G→8192/12G→4096/8G→2048）
- **生图引擎打通（P5.1）**：stable-diffusion.cpp 编入 CMake（CPU 后端静态链接），JNI 写 PNG
- **生图桥接（P5.2）**：ImageGenModule.kt + imageGenStore（单例引擎与聊天模型互斥）+ ImageGenScreen
- **豆包化（M6）**：聊天发送前检测「画/绘/生成…图」→ 跳生图页预填
- **情绪系统（M7）**：规则词库情感打分 -2..+2，状态栏展示 愉悦/平稳/低落
- **SD3.5 + Z-Image-Turbo 入场（P5.1 迭代）**：拆分式模型通道（DiT GGUF + clip_l/clip_g/llm/vae 四参自动分流）
- **Tab 解耦拆分**：ImageGenScreen 1399 行 → 编排层 + 4 区组件；抽屉会话中心组件化；useChatScheduler hook 抽取
- **UI 交互四波（W1-W4）**：抽屉导航 / 聊天体验（模型徽章、画图入口）/ 生图页（操作条三按钮、DreamLite 置顶）/ 全局 ConfirmDialog 弹窗体系

### 2.4 DreamLite 端侧闭环期（2026-08-14）

- **真实文生图全链路**：ONNX TE（fp16，真实文本条件 hidden_states）+ llama.rn tokenize + ORT UNet（fp32 带 attention_mask）+ TinyVAE + 纯 JS PNG 编码
- **图像编辑落地**：VAE Encoder 编码源图作为条件（unet_masked 路径）
- **黑图回归修复**：sigmas NaN 溢出根因 + VAE 缩放因子对齐官方 1024
- **聊天内闭环（豆包式）**：任务卡插卡→出图→回写；[再来一张][编辑图片][重试] 动作条；编辑深链（相册/聊天同入口）
- **糊图根因修复**：两次生成并发踩踏 TE（encodePrompt 静默返回 null）→ genQueue 串行队列 + TE 失败显式 throw
- **模型清单治理**：MODEL_MATRIX 唯一事实源 + 推送门禁；生图模型与 LLM 列表双层过滤隔离；淘汰 SDXL/0.6B 清理

### 2.5 SD3.5 / Z-Image 攻坚期（2026-08-16 ~ 08-17）

**SD3.5 白图根因（最曲折）**：
1. OpenCL 后端 RMS_NORM+MUL 融合跳过中间 buffer 写入 → split_qkv 的 view 读未初始化内存 → 全 NaN → 白图
2. 排查方法论：先证明 kernel 是否执行（被融合吞掉根本没跑）→ op 级 NaN 检查（GGML_OPENCL_DEBUG_NAN）→ 跨设备指纹复用（K90 与小米 13 相同 NaN 指纹 c≡3 mod 64 → 判定非设备问题）
3. 512px VAE 内存墙：解码 graph 需 1.94GB buffer → prepare_vae_decode_retry_tiling 设 rel_size=0.5 → 416MB，9 tiles 成功

**Z-Image-Turbo**：三件套（DiT 3.86GB + Qwen3-4B LLM 条件 2.5GB + FLUX VAE）总权重 6.9GB——端侧最重模型，仅 Adreno 840 级 GPU 可承载。

**Adreno 内核恢复对照验证（08-17，重大提速）**：
- 白图排查期曾误全局禁用 Adreno 内核（ADRENO_XMEM_GEMM=0 + DISABLE_ADRENO_KERNELS=1）→ 根因确认与 GEMM 无关 → 恢复对照
- **SD3.5：采样 2425s → 283.58s（8.5 倍），全流程 45.8 → 9.6 分钟（4.8 倍）**；小米 13 每步 12 分钟 → 54 秒（13 倍）
- **Z-Image 相反**：cross-attn 值域大（±1e4 vs SD3.5 ±7）→ Adreno fp16 内核累积溢出 → 保持双禁用保稳定（39.7 分钟）
- 结论沉淀：**按模型区分 GPU 策略**（manifest note 标注每模型速度）

**端侧生图三模型全通里程碑（08-17）**：

| 模型 | 架构 | 权重 | 默认参数 | K90 (Adreno 840) 实测 | 状态 |
|---|---|---|---|---|---|
| DreamLite | DMD2 蒸馏 UNet | ~0.4GB | 4 步 / 1024px / 无 CFG | ~2.5 分钟 | ✅ 主线主力 |
| SD3.5 Medium | MMDiT | 2.8GB | 10 步 / 512px / cfg 4.5 | ~10 分钟（Adreno 恢复） | ✅ 画质升级 |
| Z-Image-Turbo | DiT + LLM 条件 | 6.9GB | 8 步 / 512px / cfg 1.0 | ~40 分钟（双禁用） | ✅ 中文 + 无审查 |

关键数字：三模型全部 step nan/inf = 0（白图/黑图根治）；512px 出图 0% 白、5-6 万色；全程离线。

### 2.6 发布准备期（2026-08-15 ~ 08-17）

- **文档体系**：CHAT_UI_SPEC / IMAGEGEN_UI_SPEC / MODEL_MATRIX / DESIGN_SPEC（暖巢 SSOT）/ APP_INTRO_COPY / MASTER_LOG 主日志 / ADR 库 / 装机 SOP
- **开源发布准备**：README 重写（中英双语）、LICENSE 追加 fork 版权、AGENTS.md 公开版
- **模型目录双轨架构（ADR-0004 / B15）**：HF 下载默认落应用专属目录（零权限、Play 合规）；设置页「模型目录」入口 + SAF 自定义目录；默认注册 AIOS 共享目录续读存量
- **聊天记录卸载丢失修复（B14）**：WatermelonDB JSI 私有库快照机制——进后台导出共享存储，启动时私有库缺失自动恢复
- **存储权限设计重做（B13）**：以「目录实际可读」判定权限，永不短路扫描
- **多模态输入崩溃根治（08-16）**：产物图误转 image_url 喂视觉模型致 SIGSEGV → 仅限用户主动视觉问答（metadata.multimodal）进模型输入
- **聊天生图全流程动效**：ImageTaskProgress 组件（三波点动画 + 进度 X% + 阶段文案），与生图页同源状态
- **模型显示标签修复**：MiniCPM5-1B 误显 5B（正则 \b 边界被下划线吞掉）→ 前瞻断言修复，全文件名回归无影响

---

## 三、功能设计

### 3.1 功能全景

```
小黄鸡 Pocket Chick
├── 聊天（Chat）—— 核心
│   ├── 离线 LLM 推理（llama.cpp / llama.rn，CPU/GPU）
│   ├── 多模型切换（7 件入选 LLM + 视觉伴侣）
│   ├── 常驻管家（MiniCPM5-1B：启动即就绪，chitchat 直答）
│   ├── 任务驱动路由（chitchat / image / write / code 规则快筛）
│   ├── 聊天内闭环生图（插卡→出图→回写，再来一张/编辑/重试）
│   ├── 图片消息（全屏查看、编辑深链、导出）
│   ├── 情绪状态栏（愉悦/平稳/低落）
│   └── 会话管理（新建/重命名/删除/基于此会话新建/搜索）
├── 生图（ImageGen）—— 创作
│   ├── 三模型：DreamLite（主线）/ SD3.5（画质）/ Z-Image（中文无审查）
│   ├── 文生图 + 图像编辑（VAE Encoder 条件路径）
│   ├── 模型族徽章 / 实验性标记 / 行内加载卸载
│   ├── 参数面板（尺寸/步数/CFG/种子）
│   ├── 生图历史持久化 + 存相册 + 全屏查看/管理
│   └── 引擎单通道互斥（EngineMutex，与聊天模型同槽互斥）
├── 智能体（AIOS）—— 进化
│   ├── 本地记忆体（fact/episode/insight 三类，每轮提取注入）
│   ├── Workspace 文件系统（SOUL/USER/AGENTS/MEMORY + conversations/）
│   ├── 智能体仪式四件套（开场仪式/意图状态机/收尾协议/自检开关）
│   └── 记忆/知识库/Workspace/工具 管理页（一域一色）
├── 模型管理
│   ├── 模型列表（LLM/生图双层过滤隔离）
│   ├── 下载（HF/ModelScope 断点续传）+ UI 导入
│   ├── 目录双轨（规范目录 + SAF 自定义目录）
│   └── 基准测试（Benchmark）
└── 系统
    ├── 14+ 语言（en 类型基准，缺 key 回退英文）
    ├── 深色/浅色模式（暖巢 WarmNest 设计语言）
    ├── 崩溃落盘日志埋点 + 错误报告
    ├── 启动恢复上次会话
    └── 关于页（品牌 + 开源署名）
```

### 3.2 核心交互设计

**聊天内生图（豆包式）**：输入区快捷入口（画图/编辑图标钮）→ 前缀 chip 标签（「图像生成：/图片编辑：」，原子删除）→ 发送 → 任务卡插入聊天流 → 分步文案（识别→管家优化→出图）→ 增强提示词入卡展示 → 成功插图 / 失败重试。全程在聊天流内可见，不跳页。

**模型加载 UX（行内按钮 + 二次确认）**：模型卡片行内「加载/卸载」按钮；卸载/删除等破坏性操作统一 ConfirmDialog 命令式弹窗。

**引擎状态永远可见**：SessionStatusBar（管家就绪 + 引擎全景一行 + 剩余 tokens）+ ActiveTaskBanner（加载/生成进度 + 出错引导去生图页）。

**图片编辑闭环**：三入口（快捷按钮 / 全屏查看器「编辑此图片」/ 任务卡改道）→ 图片下沉输入框 → 编辑任务卡 → 继续编辑递归。

### 3.3 多语言与文案体系

- 当前 14+ 语言：简体中文、繁體中文、English、日本語、한국어、فارسی、עברית、Indonesia、Melayu、Polski、Português (PT/BR)、Русский、Українська
- `src/locales/*.json` + `docs/APP_INTRO_COPY.md`（介绍文案库：三版式 × 多语言）
- en 为类型基准，缺失 key 自动回退英文

---

## 四、产品亮点

### 4.1 端侧生图三模型全通（业界罕有）

在手机 GPU（Adreno OpenCL 后端）完整跑通三个生图模型——DreamLite / SD3.5 / Z-Image，**全部推理在设备内闭环，零依赖外部服务**。从模型识别、加载、采样到 VAE 解码的完整链路无网络调用。

### 4.2 OpenCL GPU 加速实证

| 阶段 | SD3.5 全流程耗时 | 提速 |
|---|---|---|
| CPU 基线 | 2h+ | 1× |
| OpenCL 后端 | 10.7 分钟 | ~12× |
| OpenCL + Adreno 内核恢复 | 9.6 分钟（K90）；小米13 每步 12 分钟→54 秒 | 4.8× / 13× |

### 4.3 白图/黑图问题根治方法论

NaN 指纹跨设备一致（c≡3 mod 64）→ 判定非设备特定 → fusion 正确性审计（RMS_NORM+MUL 融合跳写被 view 消费）→ op 级 NaN 检查定位 → 根因修复。**方法论沉淀**：排查（op 级 NaN 检查、跨设备指纹）、修复（fusion 审计、tiled 参数）、守护（ANR killer）、管理（调试开关清理）。

### 4.4 内存墙突破

- 512px VAE 解码需 1.94GB buffer → tiled 降级 416MB，9 tiles 成功——低端 GPU 也能出图
- 引擎单通道 + 同槽互斥（EngineMutex）：文本槽 ~3GB + 生图槽 ~3.5GB 内存账本治理
- TE 编码后释放降内存峰值；ONNX/Llama session 释放 await
- 设备分级认知：**GPU 能力 ≠ RAM 大小**（两台 16GB 机，Adreno 840 可分配 2048MB，Adreno 740 连 1152MB 都失败）

### 4.5 模型智能调度架构

常驻管家（1B）+ 任务驱动（规则快筛）+ 聊天内闭环 + 冷却期防错（400ms 冷却窗 + HostFunction 退避）+ 内存预设 n_ctx。**启动即就绪**：App 打开即有管家可聊；**任务即加载**：发任务自动选型加载；**状态永远可见**：横幅/状态栏/任务卡三处同源。

### 4.6 稳定性工程

- **weak-ref 溢出崩溃根治**：全 App 循环动效收口 JS driver（推拉反转架构替代节流补丁）
- **聊天记录卸载不丢**：WatermelonDB JSI 私有库快照（进后台导出共享存储，启动自动恢复）
- **崩溃取证体系**：落盘日志埋点 + ANR killer 守护（长时生成不冻结）+ 双机交叉验证
- **onnxruntime 锁版本 1.28.0**：防动态版本漂移（曾致 extractLibs 双版本并存漂移）
- **多模态崩溃根治**：产物图与主动视觉问答严格区分（metadata.multimodal）

### 4.7 暖巢 WarmNest 设计语言

品牌暖黄为魂、功能域彩色为脉、大圆角卡片为体、克制弹簧为动、性能预算为门。要点：
- **60-30-10 配色比例**：60% 中性表面 / 30% 容器文本 / 10% 品牌与域彩强调
- **一域一色**：聊天/生图/记忆/知识库/智能体/工具六域各司其职
- **一灰一职**：每个中性 token 只承担一个层级职责
- **性能预算为门**：UI 为推理让路，UI 层每帧 JS 开销可忽略（禁 blur，半透明+阴影替代）

### 4.8 隐私与合规

- 模型与数据共享存储分离设计（/sdcard/Documents/AIOS/）：升级不重装模型，卸载不毁用户设备状态
- 模型目录双轨：规范目录零权限、Play 合规
- 开源 MIT：完全透明的代码，欢迎审计

### 4.9 模型用途标签体系（用户主权选型，2026-08-20）

- **产品定义**：用户在模型设置页给模型打用途标签（写作/代码；玩具复用代码选型），标签随模型持久化；写作/代码任务触发模型切换时，打标签的模型最优先推荐，弹窗给出任务族候选由用户单选。
- **选型优先级**（MODEL_MATRIX §1.1 单源）：用户标签命中 > 文件名指纹（入选清单）；任务族候选上限 3，不甩全量；无命中才兜底单个最大模型。
- **差异可决策**：每个候选带一句话推荐说明（MODEL_MATRIX 定位 / 大小档位「更大更强但加载更慢 / 均衡档更快上手」）。
- **重量级操作最佳实践**：弹窗内完成模型加载——确认后遮罩保持（交互阻塞），加载完成/失败才关闭；失败在弹窗内展示（可取消/重试），不插聊天错误卡。
- **锋利约束**：标签仅两枚（不增同构第三枚）；无候选显式失败不兜底；管家/projection/远程模型不参与选型。

### 4.10 n_ctx 每模型预调策略（2026-08-20）

- **问题**：默认 2048 太小，长对话频繁触顶；两处调整入口（上下文不足弹窗/生成设置）数值不同步。
- **策略**：每模型独立 n_ctx（perModelNCtx，持久化白名单）；两入口收口同一存储，一边调了另一边自动同步。
- **预调**：模型首次加载且无覆盖时，按设备内存上限沿档位梯取最大可装档（封顶模型训练上下文），一次预调、持久化；只升不降（不覆盖用户手调）、上限未知不虚构。
- **PSS 安全阀（2026-08-19 K90 真机血证）**：厂商 PSS 看护（HyperOS 实测 6GB 硬杀）与空闲内存无关，才是存活天花板。预调天花板取 min(内存上限, 4GB 安全预算)，启动审计自愈超限档；自动档永不越预算，用户手调不受限（决策可见）。详见 CHAT_UI_SPEC §18.6 v3.6。

---

## 五、技术架构概述

```
┌──────────────────────────── 应用层（React Native + TypeScript） ────────────────────────────┐
│  Screens: Chat / ImageGen / Memory / Knowledge / Workspace / Models / Settings / ...        │
│  Components: ChatView / ImageTaskCard / ImageTaskProgress / ConfirmDialog / IconTile / ...  │
│  Stores: ChatSessionStore / imageGenStore / ModelStore / PalStore / UIStore / engineStatus  │
│  Hooks: useChatScheduler / useChatSession / engineReady / ...                               │
│  Services: aiosMemory / promptWriter / chatImageTask / taskRouter / dreamLiteEngine / ...   │
├──────────────────────────── 原生层（Android 主力） ────────────────────────────────────────┤
│  llama.rn（GGUF 文本推理，多 context 共存）                                                 │
│  ONNX Runtime（DreamLite UNet / TE fp16）                                                  │
│  stable-diffusion.cpp（SD3.5 / Z-Image，OpenCL/CPU 后端）                                   │
│  WatermelonDB（会话持久化，JSI 快照）                                                       │
│  ImageGenJNI（JNI 桥接：加载/生成/进度回调/PNG 写盘）                                       │
└────────────────────────────────────────────────────────────────────────────────────────────┘
```

**引擎互斥**：聊天引擎与生图引擎单通道 + 同槽互斥（EngineMutex）；backend 单点决策上 manifest。
**数据落盘**：AIOS 共享目录（models/ + dreamlite/ + workspace/ + database/ + memories/），App 首次运行自建。

---

## 六、版本与路线图

### 6.1 当前版本

- **版本号**：2.0.0（fork 首个自主版本，versionCode 144；版本号四处同步：.version / package.json / Android build.gradle / iOS project.pbxproj）
- **上游基线**：PocketPal AI v1.16.1（MIT，2026 fork）
- **模型阵容**：LLM 入选 7 件（Qwen3.5-2B Q8_0+mmproj / 4B Q4_K_M / LFM2.5-2.6B / LFM2.5-8B-A1B / Ministral-3-3B / MiniCPM5-1B 管家）；生图入选 3 件（DreamLite / SD3.5 / Z-Image）

### 6.2 未开发项规划（按锋利产品哲学排序）

| 优先级 | 项目 | 说明 |
|---|---|---|
| P1 | 文本单槽 v2 | engineMutex 联动约束：生图槽加载⇒文本槽必须管家（架构级内存治理） |
| P2 | 记忆提取复测闭环 | 代码已完成，提取 prompt 待真机复测验证 |
| P3 | 肥组件债务分期拆分 | GenerationSettingsScreen / ModelStore / ChatSessionStore / ChatView 按域分期 |
| P4 | 测试与架构对齐专项 | ChatScreen 既有失败用例 + ImageGenScreen 编排层测试覆盖 |
| P5 | 生图提速评估 | TAESD 预览、Q3_K 量化下探、LeMiCa4Z-Image 缓存（观望态） |
| P6 | AIOS 仪式与玩法扩展 | 梦境模式/双人格/语音养成——防臃肿边界内按需评估 |
| P7 | Phase2 预留 | device_control（无障碍权限）、sqlite-vec——明确「不做的事」边界 |
| P8 | **玩具工坊（✅ 已落地 2026-08-18）** | play 路由「做个玩具」→ 代码模型 render_html 出可玩成品 → 玩具箱存档重玩；玩法引导（输入卡快捷按钮 + 知识库玩具箱 tab），见 [PLAY_SPEC](./POCKETPAL_PLAY_SPEC.md) |
| P9 | **内心生活（✅ 已落地 2026-08-18）** | 收尾三件套：小结+明日晨间独白+小鸡日记（写作模型现编，非规则模板）；开场注入模型独白；Workspace 浏览日记，见 [INNERLIFE_SPEC](./POCKETPAL_INNERLIFE_SPEC.md) |
| P10 | **记忆绘本（✅ 已落地 2026-08-18）** | 周度故事（记忆+日记素材 → 写作模型现编）+ DreamLite 封面插画 → memories/album/ 成长相册；MemoryScreen 手动生成+浏览，见 [ALBUM_SPEC](./POCKETPAL_ALBUM_SPEC.md) |
| P11 | **读屏围观（✅ 已落地 2026-08-18）** | device_control 只读子集：原生 AccessibilityService 读 a11y 树 → read_screen/find_app → 写作模型围观点评；写操作永久边界外，见 [SCREENWATCH_SPEC](./POCKETPAL_SCREENWATCH_SPEC.md) |
| P12 | **TRPG 城主（✅ 已落地 2026-08-18）** | 聊天即冒险：adventure 路由 + adventure_state 工具化状态管理（HP/位置/背包 JSON 落盘）+ 城主叙事；模型剧团（多模型辩论）因内存账本观望，见 [ADVENTURE_SPEC](./POCKETPAL_ADVENTURE_SPEC.md) |

### 6.3 技术债与待办

| # | 事项 | 优先级 |
|---|---|---|
| 1 | ADRENO_XMEM_GEMM / DISABLE_ADRENO_KERNELS 对照验证（SD3.5 已恢复，Z-Image 保持双禁用） | 中 |
| 2 | 低端设备（Adreno 740）SD3.5 提速（已从 12 分钟/步 → 54 秒/步） | 中 |
| 3 | Z-Image 低端设备策略（6.9GB 超 Adreno 740 承载） | 低 |
| 4 | SD3.5 experimental 标记复核（低端设备性能限制） | 待定 |

---

## 关联文档

- [文档索引（INDEX）](./INDEX.md)（root）
- [设计语言总纲（DESIGN_SPEC）](./POCKETPAL_DESIGN_SPEC.md)（root，UI 域 SSOT）
- [模型选型唯一事实源（MODEL_MATRIX）](./POCKETPAL_MODEL_MATRIX.md)（root）
- [介绍文案库（APP_INTRO_COPY）](./APP_INTRO_COPY.md)（root）
- [聊天页 UI 规范（CHAT_UI_SPEC）](./POCKETPAL_CHAT_UI_SPEC.md)（root）
- [生图页 UI 规范（IMAGEGEN_UI_SPEC）](./POCKETPAL_IMAGEGEN_UI_SPEC.md)（root）
- [端侧生图三模型里程碑（ONDEVICE_IMAGE_GEN_MILESTONE）](./ONDEVICE_IMAGE_GEN_MILESTONE.md)（root）
- [文档管理机制](../docs/DOC_MANAGEMENT.md)（root）
