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

## ✨ 功能特性 / Features

| 中文 | English |
|---|---|
| 🚫 完全离线运行，无网络也能使用 | Fully offline — works without a network |
| 📦 支持多种开源大模型，自由下载、切换与卸载 | Supports many open-source models — download, switch, and remove freely |
| 🎨 端侧本地生图（DreamLite / SD3.5 / Z-Image），创作全程不离开设备 | On-device image generation (DreamLite / SD3.5 / Z-Image) — your creations never leave your phone |
| 🔍 端侧图像放大（RealESRGAN），一键 4× 超分，内置写实 / 动漫双模型 | On-device upscaling (RealESRGAN) — one-tap 4× super-resolution, with photo & anime models |
| 🖼️ 全屏看图与手势缩放，双指捏合、拖拽、单击关闭 | Full-screen viewer — pinch-to-zoom, pan, tap to close |
| 🎙️ 离线语音输入，设备端语音转文字，无网也能说话 | Offline voice input — on-device speech-to-text, no network needed |
| 🧠 智能体意图与用途标签，按写作 / 代码等场景智能选型 | Agent intent & capability tags — smart model selection by task (writing / coding) |
| ⚡ 轻量启动，即开即用 | Lightweight — ready to use instantly |
| 🌍 多语言界面（14+ 语言） | Localized UI (14+ languages) |
| 🆓 完全开源， 欢迎贡献与二次开发 | Fully open source — contributions and derivative works are welcome |

## ✨ 近期亮点 / Recent Highlights

**v2.0.0 以来（2026-08）我们重做了大量体验，下面是面向用户的关键更新：**

- **聊天页体验重做**：意图会话级状态机、助手卡 chrome 合并、顶栏紧凑化、发送钮双态、n_ctx 单一事实源按内存预调、模型用途标签（写作/代码）智能选型。
- **端侧图像放大**：内置 RealESRGAN（x4plus 写实 / animevideov3 动漫），tiled 推理，可在 App 内直接超分任意图片；配套全屏看图与手势缩放（双指捏合、拖拽、单击关闭）。
- **生图任务化与诊断**：每次生成 / 编辑都是持久化任务，失败页支持一键复制完整诊断报告并重试；全 App 报错统一「一键复制」到剪贴板并落盘。
- **模型目录双轨**：下载模型落应用专属目录（零权限、Play 合规），同时支持自定义目录（系统选择器），换机不丢模型。
- **卸载保留开关**：系统设置新增「卸载后保留聊天记录」开关（默认开）。

完整变更详见 [CHANGELOG.md](CHANGELOG.md)。

## 🛠 技术栈 / Tech Stack

- **React Native + TypeScript** — 跨平台应用
- **llama.cpp / llama.rn** — GGUF 大模型端侧推理
- **ONNX Runtime** — DreamLite 端侧图像生成引擎（文生图 + 图像编辑）
- **@react-native-voice** — 设备端离线语音输入（STT）
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

## 🌍 多语言 / Localization

当前启用 14 种语言：简体中文、繁體中文、English、日本語、한국어、فارسی、עברית、Indonesia、Melayu、Polski、Português (PT/BR)、Русский、Українська。

- 文案维护：`src/locales/*.json` + [docs/APP_INTRO_COPY.md](docs/APP_INTRO_COPY.md)（介绍文案库，三版式 × 多语言）
- 语言注册：`src/locales/index.ts`

## 📄 文档 / Docs

| 文档 | 说明 |
|---|---|
| [docs/POCKETPAL_PRODUCT_SPEC.md](docs/POCKETPAL_PRODUCT_SPEC.md) | 产品文档（定位/里程碑/功能设计/亮点） |
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
