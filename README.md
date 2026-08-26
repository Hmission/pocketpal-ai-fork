<div align="center">

<img src="src/assets/pocketpal-dark-v2.png" alt="Pocket Chick logo" width="120" />

# 小黄鸡 Pocket Chick 🐤

**一款住进手机的开源 AI 伙伴——聊天、生图、玩乐、绘本、冒险，多种玩法全部离线运行在您的设备上**

An open-source AI companion that lives on your phone — chat, image generation, play, picture books and adventures, all running offline on your device.

基于 [llama.cpp](https://github.com/ggml-org/llama.cpp) 与 [llama.rn](https://github.com/mybigday/llama.rn) 构建 · 二开自 [PocketPal AI](https://github.com/a-ghorbani/pocketpal-ai)（MIT License）

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

</div>

---

## 📦 仓库 / Repository

- 开源仓库：https://github.com/Hmission/pocketpal-ai-fork
- 欢迎 Star、Issue 与 Pull Request，共同把「端侧 AI」做得更好。

## 🐣 简介 / Intro

**中文**：与传统「联网问答」不同，小黄鸡的模型运行在您的设备本地——不需要服务器，不需要联网，更不需要把对话上传给任何第三方。您的每一次提问、每一段对话，都只留在您自己的手机里。整个项目已在 GitHub 完全开源——欢迎 Fork、二次开发与共建。

**English**: Unlike cloud-based chatbots, Pocket Chick runs models entirely on your device — no servers, no internet, and no third party ever sees your conversations. Every question and every reply stays on your phone. The entire project is fully open source on GitHub — fork it, extend it, build your own.

## 💡 项目理念 / Why This Project

这个项目把当前手机端能跑的 AI 能力基本都做了进来：多模型聊天、端侧生图（DreamLite / SD3.5 / Z-Image）、图像编辑、图像反推提示词、4× 超分、离线语音（转写 + 合成）、玩具工坊。跑通这些链路的过程，也是不断踩坑和填坑的过程——下面是部分踩坑记录，如果你也在做端侧 AI，也许能帮你少走弯路。

项目定位是「好玩的数字生命玩具」，刻意不追求生产力——AI 不一定是工具，也可以是伙伴。

**This project packs in nearly every AI capability a phone can run: multi-model chat, on-device image generation (DreamLite / SD3.5 / Z-Image), image editing, image-to-prompt, 4× upscaling, offline voice (STT + TTS), and a toy workshop.** Getting these pipelines to work meant hitting — and fixing — a lot of real-device pitfalls. The table below lists the ones most likely to save you a detour.

Pocket Chick is intentionally not a productivity tool. It's a "digital pet" — AI doesn't have to be a tool; it can be a companion.

## 🕳️ 踩坑记录（节选）/ Pitfalls We Hit (Selected)

> 均为真机（Redmi K90 / 小米 13，Adreno）实测记录，细节见 `docs/`（POCKETPAL_PRODUCT_SPEC §2.5、SD35_OPENCL_WHITE_IMAGE_ANALYSIS、POCKETPAL_MODEL_MATRIX）。

| 坑（现象 / 根因） | 我们的做法 |
|---|---|
| Qwen3 TE int8 动态量化毁掉 hidden states 离群通道（余弦相似度 0.17）→ 生图糊图 | TE 改用 fp16 ONNX（余弦 1.0）；若必须量化，验证 kept 区余弦 ≥ 0.97 |
| DMD2 蒸馏模型 sigmas NaN 溢出 → 纯黑图 | VAE 缩放因子对齐官方 1024 基线 |
| OpenCL 算子融合（RMS_NORM+MUL）跳写中间 buffer，split_qkv 的 view 读未初始化内存 → 全 NaN 白图 | 先做融合正确性审计，再用 op 级 NaN 检查（GGML_OPENCL_DEBUG_NAN），不先怀疑设备 |
| 512px VAE 解码 graph 需 1.94GB buffer → OOM | tiled 解码：rel_size=0.5 → 416MB，9 tiles 跑通 |
| Z-Image cross-attn 值域 ±1e4，Adreno fp16 内核累积溢出 → 白图 | 按模型区分 GPU 策略（manifest note）：SD3.5 恢复 Adreno 内核（提速 4.8–13×），Z-Image 保持双禁用保稳定；排查期曾误全局禁用（XMEM=0 + DISABLE=1），根因确认与 GEMM 无关后已恢复 |
| Adreno Vulkan 后端 ErrorDeviceLost，社区零成功案例 | 走 OpenCL（ARM 官方推荐路径），Vulkan 不启用 |
| 量化 embedding（Q6_K）被引擎强制升 F32 → 1483MB 超硬件单次分配上限 → 崩溃 | 改为升 F16（742MB） |
| HyperOS PSS 看护（6GB 阈值）硬杀进程，固定 4GB 预算让 4B 主力只敢给 4096 上下文（装不下工具 schema 基线 ~4.5K，智能体框架跑不开） | 预算改为**设备感知**（启动实测可用内存，上限 9GB，fallback 4GB），策展表重排 4B→16384 / 2B→32768，KV 保持 f16；启动审计自愈降档、用户手调主权不碰 |
| 上下文压缩目标线 70%：80% 触发时只释放 ~10% 容量 → **每 2-4 轮触发一次 LLM 摘要**，priorSummary 增量退化为整段重写、碎片化叠加损耗 | 目标线对齐行业（Claude Code auto-compact / LangChain）：触发 80% → **压到半水位 50%**（COMPACT_TARGET_WATERMARK=0.5），一次顶 10+ 轮 |
| ONNX/Llama session 释放未 await → 内存叠加 OOM | 异步释放统一 await 收口 |

排查过程中的一个可用经验：出现 NaN 或崩溃时，先对比跨设备的 NaN 指纹（K90 与小米 13 指纹一致 → 不是设备问题），再深入算子层定位，避免在设备差异上白费时间。

**One method that kept working:** when a NaN or crash appeared, we compared NaN fingerprints across devices before blaming the hardware (two different Adreno phones showed the identical fingerprint — not a device issue), then dug into operator-level behavior. Details live in `docs/` (POCKETPAL_PRODUCT_SPEC §2.5, SD35_OPENCL_WHITE_IMAGE_ANALYSIS, POCKETPAL_MODEL_MATRIX).

## ✨ 功能特性 / Features

| 中文 | English |
|---|---|
| 🚫 完全离线运行，无网络也能使用 | Fully offline — works without a network |
| 📦 支持多种开源大模型，自由下载、切换与卸载 | Supports many open-source models — download, switch, and remove freely |
| 🎨 端侧本地生图（DreamLite / SD3.5 / Z-Image），创作全程不离开设备 | On-device image generation (DreamLite / SD3.5 / Z-Image) — your creations never leave your phone |
| 🖼️ 图像反推提示词（Qwen3.5-4B 视觉通道），看懂图片、一键复刻再创作 | Image-to-prompt (Qwen3.5-4B vision) — understand any picture, recreate it in one tap |
| 🔍 端侧图像放大（RealESRGAN），一键 4× 超分，内置写实 / 动漫双模型 | On-device upscaling (RealESRGAN) — one-tap 4× super-resolution, with photo & anime models |
| 🖼️ 全屏看图与手势缩放，双指捏合、拖拽、单击关闭 | Full-screen viewer — pinch-to-zoom, pan, tap to close |
| 🎙️ 离线语音全链路：语音转文字 + 语音合成朗读，无网也能说话 | Full on-device voice — offline speech-to-text & text-to-speech, no network needed |
| 🧠 智能体意图与用途标签，按写作 / 代码等场景智能选型 | Agent intent & capability tags — smart model selection by task (writing / coding) |
| ⚡ 轻量启动，即开即用 | Lightweight — ready to use instantly |
| 🌍 多语言界面（14+ 语言） | Localized UI (14+ languages) |
| 🆓 完全开源， 欢迎贡献与二次开发 | Fully open source — contributions and derivative works are welcome |

## ✨ 近期亮点 / Recent Highlights

**v2.0.0 以来（2026-08）我们重做了大量体验，下面是面向用户的关键更新：**

- **创作工坊升级**：图像反推提示词（Qwen3.5-4B 视觉通道，图片 → 提示词 → 一键复刻生图）+ 音频工坊（SenseVoice 音频转写 / Kokoro、Supertonic 语音合成），产物统一入画廊管理。
- **语音朗读**：聊天回复流式朗读，系统音色免安装即用，可选 Kitten / Kokoro / Supertonic 端侧引擎。

- **聊天页体验重做**：意图会话级状态机、助手卡 chrome 合并、顶栏紧凑化、发送钮双态、n_ctx 单一事实源按内存预调、模型用途标签（写作/代码）智能选型。
- **端侧图像放大**：内置 RealESRGAN（x4plus 写实 / animevideov3 动漫），tiled 推理，可在 App 内直接超分任意图片；配套全屏看图与手势缩放（双指捏合、拖拽、单击关闭）。
- **生图任务化与诊断**：每次生成 / 编辑都是持久化任务，失败页支持一键复制完整诊断报告并重试；全 App 报错统一「一键复制」到剪贴板并落盘。
- **模型目录双轨**：下载模型落应用专属目录（零权限、Play 合规），同时支持自定义目录（系统选择器），换机不丢模型。
- **卸载保留开关**：系统设置新增「卸载后保留聊天记录」开关（默认开）。

完整变更详见 [CHANGELOG.md](CHANGELOG.md)。

## 👨‍💻 开发者视角 · 底层改造 / Under the Hood

> 不下载 App 也能看到我们怎么把端侧 AI 做到可用。以下三块是全仓复用价值最高的改造——完整设计与真机数据在 `docs/` 对应 SPEC（见文末文档表）。
> Skip the install — here is how we made on-device AI actually usable. Three areas with the highest reusability; full designs and real-device data live in the SPECs linked below.

### 1) 模型上下文治理：让每个模型用满它的内存空间 / Context Governance

手机端「默认上下文很短」是通病——直接后果是长对话一轮即满、工具调用跑不开。我们的三层治理（[POCKETPAL_CONTEXT_COMPACTION_SPEC](docs/POCKETPAL_CONTEXT_COMPACTION_SPEC.md) + [CHAT_UI_SPEC §18.6](docs/POCKETPAL_CHAT_UI_SPEC.md)）：

- **每模型人工策展默认 n_ctx 表**：模型越小上下文越长（KV 便宜 + 快），上限 = GGUF `context_length`。主力档：Qwen3.5-4B **16384**、Qwen3.5-2B / MiniCPM5-1B **32768**、Ministral-3-3B 24576、Gemma-3-4B 32768……（原 4B 档只有 4096，装不下工具 schema 注入后的提示词基线 ~4.5K，智能体框架直接跑不开）
- **设备感知内存预算** `resolvePssSafeBudget`：预算 = 启动实测可用内存（上限 9GB，fallback 4GB），替代固定 4GB 一刀切；KV cache 保持 f16，不加量化旋钮（锋利不预设）
- **策展表版本化拉齐** `CURATED_TABLE_VERSION`：预设档位随表版本一次性升档（老用户不会被旧短值永久钉死），用户手调主权不碰
- **压缩目标线行业对齐**：触发 80% → **压到半水位 50%**（`COMPACT_TARGET_WATERMARK=0.5`），治「每 2-4 轮触发一次摘要、碎片化叠加损耗」的小额滚动；摘要输入预算随 n_ctx 上探；水位双源校准（字符估算 + 上轮实测钉底）、生成预留、摘要工作集预算化（B19.1 真机血证链路）
- **真机数据（Redmi K90 / 骁龙 8 Elite）**：4B + 16K f16 KV 加载 PSS **4.15GB**、推理全量驻留 **4.74GB**，全程无被杀；5275 tokens prefill 仅占上下文 32%，剩余 ≈ 20+ 轮短对话

### 2) 跑分体系：基准不是实验室玩具，是真机实证仪表盘 / Benchmark & Telemetry

设计：[PERF_BENCHMARK_DESIGN](docs/PERF_BENCHMARK_DESIGN.md)

- **基准总控台三用例**：聊天推理（真实流式链路）/ 生图（DreamLite 同源入口）/ 温控耐久（连跑 3 轮），自动导航到页、真实负载、零新链路
- **1Hz 遥测**：PSS / CPU / 温度 / 功耗 / GPU 负载随采 → 四轴跑分卡 + 段位（走地鸡 → 战斗鸡 → 神鸡），数值全部真机实测、N/A 诚实置灰不编造
- **任务级 JSONL 落盘 + 统一回放**：进程被杀保留断点轨迹可重算跑分卡；聊天回合与生图任务同库同规
- **真机数据**：K90 全套件 LLM 77s（10 tok/s）→ 生图 54s → 耐久 3 轮，总时长 4m23s，综合分 46
- 顺手做过的性能攻坚：Adreno OpenCL 提速 SD3.5 至 10.7 分钟级；Mali 半精度内核 **2.9-3.4×**（[CLPROF] 算子榜单纠偏后命中正确内核，本地内存减半 + fp16 管线）

### 3) 端侧智能体框架：小模型也能跑工具调用 / On-device Agent Framework

从 AIOS 裁剪的完整工具调用栈（[WORKSPACE_SPEC](docs/POCKETPAL_WORKSPACE_SPEC.md) + [WORKSPACE_TOOL_ERROR_FEEDBACK_SPEC](docs/workspace/WORKSPACE_TOOL_ERROR_FEEDBACK_SPEC.md)）：

- **Talent 工具注册表**：pact 声明 → 工具定义 → 多轮 tool loop → 全局重试纪律（同一工具连败 2 次才可放弃，失败先按示例修正重试）
- **错误回传「定位 + 导航」三字段**：工具失败回传模型时不仅给错误描述，还带正确调用示例（guide）——4B 级小模型靠示例自纠，失败不再是终局（真机实证：Hermes 缺 Buffer 的 `WRITE_FAILED` 透传后模型按示例自动重试）
- **产物工作区三协议**：写作 / 冒险 / 玩具统一「目录 + 索引 + 分段读取」——对话是过程、产物是文档，上下文压缩只动过程永不碰产物
- **记忆三段治理（存 → 治 → 用）**：对话落盘 → 事实/事件/见解抽取（事件 30 天 TTL）→ 蒸馏治理按钮 + 时效三闸（瞬时状态/新闻/失败记录不污染记忆）
- **DRC 远程调试**：事件流 + 指南针三字段（定位/导航/深入），真机问题排查不再靠猜

## 🛠 技术栈 / Tech Stack

- **React Native + TypeScript** — 跨平台应用
- **llama.cpp / llama.rn** — GGUF 大模型端侧推理
- **ONNX Runtime** — DreamLite 端侧图像生成引擎（文生图 + 图像编辑）
- **@react-native-voice** — 设备端离线语音输入（STT）
- **@pocketpalai/react-native-speech** — 端侧 TTS 语音合成（Kitten / Kokoro / Supertonic / 系统音色）
- **sherpa-onnx（SenseVoice）** — 端侧 ASR 音频转写
- **OpenCL** — Adreno GPU 加速（SD3.5 生成提速至 10.7 分钟级）

## 📸 截图 / Screenshots

> TODO: 补充截图（欢迎贡献）

## 🚀 快速开始 / Quick Start

```bash
yarn install
# Android
cd android && ./gradlew assembleRelease
# iOS
cd ios && pod install && open PocketPal.xcodeproj
```

开发环境与常用命令详见 [AGENTS.md](AGENTS.md) 与 [docs/getting_started.md](docs/getting_started.md)。

## 🤝 贡献 / Contributing

欢迎任何形式的贡献：提交 [Issue](https://github.com/Hmission/pocketpal-ai-fork/issues)、发起 [Pull Request](https://github.com/Hmission/pocketpal-ai-fork/pulls)、翻译文案或分享使用经验。

- 提交规范：Conventional Commits（见 [CONTRIBUTING.md](CONTRIBUTING.md)）
- 行为准则：[CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md)

## 💬 交流探讨 / Contact

欢迎一起探讨端侧 AI、数字生命玩具，或任何有趣的想法。

Feel free to reach out if you'd like to discuss on-device AI, digital pets, or anything interesting.

- 微信 / WeChat：`YanZhi_CO_Ltd`
- 邮箱 / Email：[qiaomimi1314@gmail.com](mailto:qiaomimi1314@gmail.com)

## 🌍 多语言 / Localization

当前启用 14 种语言：简体中文、繁體中文、English、日本語、한국어、فارسی、עברית、Indonesia、Melayu、Polski、Português (PT/BR)、Русский、Українська。

- 文案维护：`src/locales/*.json` + [docs/APP_INTRO_COPY.md](docs/APP_INTRO_COPY.md)（介绍文案库，三版式 × 多语言）
- 语言注册：`src/locales/index.ts`

## 📄 文档 / Docs

| 文档 | 说明 |
|---|---|
| [docs/POCKETPAL_PRODUCT_SPEC.md](docs/POCKETPAL_PRODUCT_SPEC.md) | 产品文档（定位/里程碑/功能设计/亮点） |
| [docs/POCKETPAL_CONTEXT_COMPACTION_SPEC.md](docs/POCKETPAL_CONTEXT_COMPACTION_SPEC.md) | 上下文压缩机制设计（水位双源校准 / 生成预留 / 半水位目标线） |
| [docs/PERF_BENCHMARK_DESIGN.md](docs/PERF_BENCHMARK_DESIGN.md) | 跑分与遥测设计（三用例总控 / 1Hz 采样 / JSONL 回放 / 跑分卡） |
| [docs/POCKETPAL_WORKSPACE_SPEC.md](docs/POCKETPAL_WORKSPACE_SPEC.md) | 智能体产物工作区（写作/冒险/玩具三协议：目录+索引+分段读取） |
| [docs/workspace/WORKSPACE_TOOL_ERROR_FEEDBACK_SPEC.md](docs/workspace/WORKSPACE_TOOL_ERROR_FEEDBACK_SPEC.md) | 工具调用错误回传协议（定位+导航三字段 + 重试纪律） |
| [CHANGELOG.md](CHANGELOG.md) | 更新日志（Keep a Changelog） |
| [docs/APP_INTRO_COPY.md](docs/APP_INTRO_COPY.md) | App 介绍文案库（三版式 × 多语言） |
| [docs/POCKETPAL_CHAT_UI_SPEC.md](docs/POCKETPAL_CHAT_UI_SPEC.md) | 聊天页 UI 设计规范 |
| [docs/POCKETPAL_IMAGEGEN_UI_SPEC.md](docs/POCKETPAL_IMAGEGEN_UI_SPEC.md) | 生图页 UI 设计规范 |
| [docs/POCKETPAL_MODEL_MATRIX.md](docs/POCKETPAL_MODEL_MATRIX.md) | 模型选型矩阵 |
| [docs/POCKETPAL_IMAGE_GEN_UPGRADE_PLAN.md](docs/POCKETPAL_IMAGE_GEN_UPGRADE_PLAN.md) | 生图升级计划（含 DreamLite 接入全记录） |

## 📝 版本记录 / Changelog

请参阅 [CHANGELOG.md](CHANGELOG.md)。

## 💝 开源声明 / Open Source

本项目基于 [PocketPal AI](https://github.com/a-ghorbani/pocketpal-ai)（MIT License）二次开发，源码已在 GitHub 完全开源，遵循开放、透明的开源精神，欢迎贡献与二次开发。

- 上游作者：Asghar Ghorbani（[a-ghorbani](https://github.com/a-ghorbani)）
- 生图引擎：[stable-diffusion.cpp](https://github.com/leejet/stable-diffusion.cpp)、[DreamLite](https://huggingface.co/LemmeStudio/DreamLite)
- 推理引擎：[llama.cpp](https://github.com/ggml-org/llama.cpp)（MIT）、[llama.rn](https://github.com/mybigday/llama.rn)（MIT）

## 📄 License

[MIT](LICENSE)

Copyright (c) 2024 Asghar Ghorbani（上游）
Copyright (c) 2026 Pocket Chick contributors
