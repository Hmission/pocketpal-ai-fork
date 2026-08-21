---
doc_id: APP_INTRO_COPY
module: root
type: copy
status: active
version: "1.2"
created: "2026-08-14"
updated: "2026-08-22"
relates: []
---

<!-- D-FORMAT:v3 -->

# 小黄鸡（Pocket Chick）App 介绍文案库

> **状态**：进行中 | **维护**：AIOS | **最后更新**：2026-08-22
> 本文档是 App 对外介绍文案的唯一权威来源（single source of truth）。

## 维护契约

1. **版本二（标准版）已落地 App 关于页**，文案存储于 `src/locales/*.json` 的 `about` 段（key：`description` / `body` / `featuresTitle` / `features` / `openSourceBody` / `basedOn` / `githubRepoDescription` / `githubButton`），UI 位于 `src/screens/AboutScreen/AboutScreen.tsx`（含 GitHub 仓库入口按钮）。
2. **引导页（onboarding）文案**存储于 `src/locales/*.json` 的 `onboarding` 段，UI 位于 `src/screens/Onboarding/`（Splash + S1~S6）。S5 的 6 个 topic 键与 S6 的 5 个 pal / 3 个 tier 由代码驱动，键集合不可增删，只改内容。
3. **改文案 = 改两处**：① `src/locales/*.json`（关于页 / 引导页实际展示） ② 本文档（对外文案存档）。
4. **新增语言**：参考 `src/locales/index.ts` 的 languageRegistry 注册流程，并同步本文档。

## 版本矩阵

| 版本 | 用途 | 落地状态 |
|---|---|---|
| 版本一：简短版 | 商店简介 / 官网首页 / 宣传物料 | 📋 文档存档 |
| 版本二：标准版 | App 内"关于"页面正文 | ✅ 已落地（l10n + AboutScreen） |
| 版本三：极简版 | 一行式签名 / 分享卡片 / 社交简介 | 📋 文档存档 |
| 引导页文案 | App 初次装机引导（Splash + S1~S6） | ✅ 已落地（l10n `onboarding` 段 + Onboarding 屏） |

## 语言清单

- **已启用（14）**：zh（简体）、zh_Hant（繁体）、en、ja、ko、fa、he、id、ms、pl、pt、pt_BR、ru、uk
- **已翻译未注册（2）**：de、fr（l10n 文件已补齐，未加入 languageRegistry）
- **残缺未启用（2）**：et、it（l10n 文件只有 common 段，待完整翻译后再启用）
- 引导页（onboarding）段覆盖：14 个已启用语言全部有完整 onboarding 段；de / fr / et / it 无该段，运行时自动回退英文（`en` 为类型基准）
- 版本号占位：`v2.0.0 (144)` · `llama.cpp 10054 (ac2557c)`（迭代时同步更新）

---

## Onboarding 引导页文案

> **落地位置**：`src/locales/*.json` 的 `onboarding` 段 · **UI**：`src/screens/Onboarding/`（`OnboardingStack.tsx`：SPLASH → STEP_1 ~ STEP_6）
> **基线语言**：en（类型基准，缺失 key 自动回退英文）/ zh（简体中文）。其余 12 个已启用语言在各自 locale 文件内按同一 key 结构落地。
> **零 key 增删原则**：本次文案迭代不增删任何 key，S5 的 6 个 topic 键（`smartchat` / `coding` / `education` / `roleplay` / `creative_writing` / `else`）与 S6 的 5 个 pal（`pip` / `codie` / `sage` / `echo` / `muse`）、3 个 tier（`quick` / `balanced` / `best`）由代码驱动，键集合不可变。

### 屏幕结构总览

| 屏 | 组件 | 叙事定位 |
|---|---|---|
| Splash | `SplashScreen.tsx` | 品牌亮相：Logo + 品牌名「Pocket Chick / 小黄鸡」 |
| S1 | `Onboarding1Screen.tsx` | 欢迎页：点明「住进手机的 AI 伙伴」+ 五大玩法（聊天、生图、玩乐、绘本、冒险） |
| S2 | `Onboarding2Screen.tsx` | 多种玩法页：不止聊天——生图 / 绘本 / 冒险 / 语音 / 拍照放大 4× |
| S3 | `Onboarding3Screen.tsx` | 完全离线 + 小而精：无网也能用；比云端大模型轻，但快、私密、属于您 |
| S4 | `Onboarding4Screen.tsx` | 隐私承诺：无账户 / 无云端 / 无追踪 + 完全开源；附存储权限说明（storageNote） |
| S5 | `Onboarding5Screen.tsx` | 用途选择：6 个 topic chip，点击即进入 S6 |
| S6 | `Onboarding6Screen.tsx` | 下载模型：按用途展示 pal + 设备信息 + 3 档模型（quick / balanced / best） |

### 文案明细（en / zh 基线）

#### Splash

| key | en | zh |
|---|---|---|
| `brand` | Pocket Chick | 小黄鸡 |

#### S1 欢迎页（screen1）

| key | en | zh |
|---|---|---|
| `eyebrow` | Welcome to Pocket Chick | 欢迎使用小黄鸡 |
| `title` + `titleAccent` | Meet your **pals.** | 认识一下你的**小伙伴。** |
| `body` | Smart little friends that live inside your phone — chat, draw, play, stories, adventure.\nLet's get you set up, it'll take a minute. | 住进你手机的 AI 伙伴——聊天、生图、玩乐、绘本、冒险。\n花一分钟把它们设置好吧。 |
| `cta` | Show me Around | 带我看看 |

#### S2 多种玩法页（screen2）

| key | en | zh |
|---|---|---|
| `eyebrow` | More to explore | 多种玩法 |
| `title` + `titleAccent` | More than\n**a chat app.** | 不止\n**聊天。** |
| `body` | Chat, draw pictures, read stories, play adventures, talk to them and hear them talk back — all generated right on your phone. Even photos you take can be upscaled 4× or turned back into prompts. | 聊天、生图、讲故事、玩冒险、开口说、听它说——全部在你的手机上完成。拍的照片能放大 4 倍，还能反推成提示词再创作。 |
| `highlight` | all generated right on your phone | 全部在你的手机上完成 |
| `cta` | Next | 下一步 |

#### S3 完全离线 + 小而精（screen3）

| key | en | zh |
|---|---|---|
| `eyebrow` | Fully offline | 完全离线 |
| `title` + `titleAccent` | Anytime,\n**Anywhere.** | 随时，\n**随地。** |
| `body` | No internet, no signal, no problem — on a plane, in an elevator, in a remote village, your pals are still right there.\nSmall and sharp, a touch lighter than the cloud's big brains — but fast, private, and always yours. | 不用联网、没有信号也没关系——在飞机上、在电梯里、在偏远村庄，你的小伙伴都还在。\n小而精，比云端大模型轻一点——但快、私密，永远属于你。 |
| `highlight` | No internet, no signal | 不用联网、没有信号 |
| `cta` | Got it | 知道了 |

#### S4 隐私承诺（screen4）

| key | en | zh |
|---|---|---|
| `eyebrow` | Privacy promised | 隐私承诺 |
| `title` + `titleAccent` | Nothing **leaves** your phone. | 一切\n**留在你的手机里。** |
| `body` | No accounts. No cloud. No tracking. Your chats and pictures stay yours.\nFully open source — anyone can check the code. | 无需账户。没有云端。不做追踪。你的对话和图像，只属于你。\n完全开源——任何人都能查看代码。 |
| `highlight` | No accounts. No cloud. No tracking. | 无需账户。没有云端。不做追踪。 |
| `cta` | Get Started | 开始使用 |
| `storageNote` | On first launch we ask for "All files access" — used only to read your model folder and back up chats. You can change this anytime in system settings. | 首次启动时会请求「所有文件访问权限」——仅用于读取模型文件夹与备份聊天记录。你可随时在系统设置中更改。 |

#### S5 用途选择（screen5）

| key | en | zh |
|---|---|---|
| `title` | What's your pal for? | 你的小伙伴用来做什么？ |
| `body` | Pick what you'd like to discuss — we'll match a pal that fits your phone. | 选一个你想聊的方向——我们会为你匹配一款适合你手机的小伙伴。 |
| `topic.smartchat` | Smart Chat | 日常聊天 |
| `topic.coding` | Coding | 编程 |
| `topic.education` | Education | 学习成长 |
| `topic.roleplay` | Roleplay | 角色扮演 |
| `topic.creative_writing` | Creative Writing | 创意写作 |
| `topic.else` | Looking for something else? | 都想试试 |
| `topicDescription.smartchat` | Friendly everyday companion | 聊天、问答、日常陪伴 |
| `topicDescription.coding` | Code, debug, explain | 写代码、调 bug、讲原理 |
| `topicDescription.education` | Learn, explain, quiz | 学习、讲解、测验 |
| `topicDescription.roleplay` | Characters, scenarios | 角色、情景、故事 |
| `topicDescription.creative_writing` | Stories, ideas, drafts | 故事、灵感、初稿 |
| `topicDescription.else` | Browse all pals later in the app | 进入 App 后可浏览全部小伙伴 |

#### S6 下载模型（screen6）

| key | en | zh |
|---|---|---|
| `cta` | Download {{name}} | 下载 {{name}} |
| `ctaTemplate` | Download {{name}} ({{size}}) | 下载 {{name}}（{{size}}） |
| `useTemplate` | Use {{name}} | 使用 {{name}} |
| `deviceRamSuffix` | GB RAM | GB 内存 |
| `deviceFreeSuffix` | GB free | GB 可用 |
| `recommended` | Recommended | 推荐 |
| `downloaded` | Downloaded | 已下载 |
| `modelTier.quick` | Quick | 快速 |
| `modelTier.balanced` | Balanced | 均衡 |
| `modelTier.best` | Best | 最佳 |
| `subtitleTemplate` | Your pal runs on a small AI model, and you can switch anytime. Pick one that fits your phone. | 你的小伙伴靠小型 AI 模型思考，之后随时可以更换。挑一个适合你手机的吧。 |
| `pal.pip.body` | We found a perfect pal for you — a friendly everyday companion. Smart enough for most things, light enough for any phone. | 我们为你找到了最对味的小伙伴——友好的日常陪伴。大部分事情都够用，任何手机都带得动。 |
| `pal.codie.body` | Meet Codie — your local pair-programmer. Reads code, writes code, explains tricky bits without ever leaving your phone. | 认识一下 Codie——你的本地结对编程伙伴。读代码、写代码、讲清难点，全程不出你的手机。 |
| `pal.sage.body` | Sage is patient, curious, and walks you through ideas step by step. A study buddy you keep in your pocket. | Sage 耐心、好奇，会一步步带你理解想法。一个装进口袋的学习搭子。 |
| `pal.echo.body` | Echo is a versatile roleplay companion — stays in character, paints scenes, follows wherever your story leads. | Echo 是全能角色扮演伙伴——不脱离人设、会描绘场景，跟着你的故事走到哪算哪。 |
| `pal.muse.body` | Muse helps you write. Suggests phrasing, finds the rhythm, and keeps your tone intact. | Muse 帮你写作。给措辞建议、找节奏，同时保住你的语气。 |

### 改动记录（v1.2 · 2026-08-22，新增音频与图像反推能力介绍）

| 位置 | 相对上一版的文案改动 |
|---|---|
| S2 | `body`：玩法清单加入「听它说（语音合成朗读）」与「照片反推成提示词再创作」，与音频工坊 / 图像反推能力对齐 |
| 版本一（全部 16 语言） | `🎨 本地生图` 后新增 2 个 bullet：🖼️ 图像反推提示词、🔈 离线语音（转写 + 合成） |
| 版本二（全部 16 语言） | `features` 在「端侧本地生图」后新增 2 条：图像反推提示词、端侧语音全链路 |
| `about.features`（l10n） | 同步新增上述 2 条特性（zh/zh_Hant/en/ja/ko/fa/he/id/ms/pl/pt/pt_BR/ru/uk 14 个启用语言 + de/fr 翻译存档） |
| `onboarding.screen2.body`（l10n） | 同步 S2 body 更新（14 个启用语言；de/fr/et/it 无 onboarding 段不涉及） |

### 改动记录（v1.1 · 2026-08-20，对齐 README 最新介绍口径）

| 屏 | 相对上一版的文案改动 |
|---|---|
| S1 | `body`：从泛称「聪明的小伙伴」改为点明五大玩法（聊天、生图、玩乐、绘本、冒险），与 README 一句话定位对齐 |
| S2 | 由「离线页」重排为「多种玩法页」：`eyebrow` The idea→More to explore、`title` 改为「More than a chat app / 不止聊天。」、`body` 改为五大玩法 + 拍照放大 4× |
| S3 | 原 S2 离线内容迁入并合并「小而精」预期管理：`eyebrow` → Fully offline / 完全离线，`body` 合并「无网场景 + 比云端轻但快、私密、属于你」 |
| S4 | `body`：补充「图像」覆盖范围与「完全开源——任何人都能查看代码」一句 |
| S5 | `topic.smartchat` Smart Chat→日常聊天 口径统一、`topic.education` → 学习成长 / Education、`topic.else` → 都想试试 / Looking for something else?；`topicDescription.*` 全部润色为更具体的能力描述 |
| S6 | `subtitleTemplate`：补充「之后随时可以更换」，消除下载即绑定的误解；其余键不动 |

> 其余 12 个已启用语言（zh_Hant / ja / ko / fa / he / id / ms / pl / pt / pt_BR / ru / uk）按本表 en/zh 基线在各自 locale 文件内同步翻译，key 结构完全一致。

---

## zh 简体中文

### 版本一：简短版

> **小黄鸡 —— 把大模型装进口袋**
>
> 一款住进手机的开源 AI 伙伴——聊天、生图、玩乐、绘本、冒险，多种玩法全部离线运行在您的设备上。基于 llama.cpp 与 llama.rn 构建。模型本地运行，完全离线，聊天数据不出手机，隐私由您掌控。项目完全开源，源码托管于 GitHub。
>
> - 🐣 完全离线：断网也能聊
> - 🆓 完全开源：基于 PocketPal AI（MIT License）开发，欢迎 Star 与共建
> - 📦 多模型自由切换：按需下载、随时卸载
> - 🎨 本地生图：一句话生成图片，全程端侧完成
> - 🖼️ 图像反推：看懂图片，反推提示词一键复刻
> - 🔈 离线语音：语音转写 + 语音合成，听会说会

### 版本二：标准版

> **小黄鸡（Pocket Chick）**
>
> 小黄鸡（Pocket Chick）是一款住进手机的开源 AI 伙伴——聊天、生图、玩乐、绘本、冒险，多种玩法全部离线运行在您的设备上。基于 llama.cpp 与 llama.rn 构建。
>
> 与传统“联网问答”不同，小黄鸡的模型运行在您的设备本地——不需要服务器，不需要联网，更不需要把对话上传给任何第三方。您的每一次提问、每一段对话，都只留在您自己的手机里。整个项目已在 GitHub 完全开源——欢迎 Fork、二次开发与共建。
>
> **特性**
> - 完全离线运行，无网络也能使用
> - 支持多种开源大模型，自由下载、切换与卸载
> - 端侧本地生图，创作全程不离开设备
> - 图像反推提示词：看懂图片，一键复刻再创作
> - 端侧语音全链路：离线转写 + 语音合成朗读
> - 完全开源，欢迎贡献与二次开发
> - 轻量启动，即开即用
>
> **开源**
> 本项目基于 PocketPal AI（MIT License）二次开发，源码已在 GitHub 完全开源——欢迎提交 Issue、Pull Request 与二次开发。
>
> **仓库**
> https://github.com/Hmission/pocketpal-ai-fork
>
> **版本信息**
> 版本：v2.0.0 (144) · 引擎：llama.cpp 10054 (ac2557c)

### 版本三：极简版

> **小黄鸡** — 住进手机的开源 AI 伙伴：聊天、生图、玩乐、绘本、冒险，全部离线。
>
> 基于 llama.cpp 与 llama.rn 构建 · 二开自 PocketPal AI（MIT License）· 完全离线 · 完全开源
>
> v2.0.0 (144) · llama.cpp 10054 (ac2557c)

---

## zh_Hant 繁體中文

### 版本一：簡短版

> **小黃雞 —— 把大模型裝進口袋**
>
> 一款住進手機的開源 AI 夥伴——聊天、生圖、玩樂、繪本、冒險，多種玩法全部離線運行在您的裝置上。基於 llama.cpp 與 llama.rn 構建。模型本地運行，完全離線，聊天數據不出手機，隱私由您掌控。專案完全開源，原始碼托管於 GitHub。
>
> - 🐣 完全離線：斷網也能聊
> - 🆓 完全開源：基於 PocketPal AI（MIT License）開發，歡迎 Star 與共建
> - 📦 多模型自由切換：按需下載、隨時卸載
> - 🎨 本地生圖：一句話生成圖片，全程端側完成
> - 🖼️ 圖像反推：看懂圖片，反推提示詞一鍵復刻
> - 🔈 離線語音：語音轉寫 + 語音合成，聽會說會

### 版本二：標準版

> **小黃雞（Pocket Chick）**
>
> 小黃雞（Pocket Chick）是一款住進手機的開源 AI 夥伴——聊天、生圖、玩樂、繪本、冒險，多種玩法全部離線運行在您的裝置上。基於 llama.cpp 與 llama.rn 構建。
>
> 與傳統「聯網問答」不同，小黃雞的模型運行在您的裝置本地——不需要伺服器，不需要聯網，更不需要把對話上傳給任何第三方。您的每一次提問、每一段對話，都只留在您自己的手機裡。整個專案已在 GitHub 完全開源——歡迎 Fork、二次開發與共建。
>
> **特性**
> - 完全離線運行，無網路也能使用
> - 支援多種開源大模型，自由下載、切換與卸載
> - 端側本地生圖，創作全程不離開裝置
> - 圖像反推提示詞：看懂圖片，一鍵復刻再創作
> - 端側語音全鏈路：離線轉寫 + 語音合成朗讀
> - 完全開源，歡迎貢獻與二次開發
> - 輕量啟動，即開即用
>
> **開源**
> 本專案基於 PocketPal AI（MIT License）二次開發，原始碼已在 GitHub 完全開源——歡迎提交 Issue、Pull Request 與二次開發。
>
> **倉庫**
> https://github.com/Hmission/pocketpal-ai-fork
>
> **版本資訊**
> 版本：v2.0.0 (144) · 引擎：llama.cpp 10054 (ac2557c)

### 版本三：極簡版

> **小黃雞** — 住進手機的開源 AI 夥伴：聊天、生圖、玩樂、繪本、冒險，全部離線。
>
> 基於 llama.cpp 與 llama.rn 構建 · 二開自 PocketPal AI（MIT License）· 完全離線 · 完全開源
>
> v2.0.0 (144) · llama.cpp 10054 (ac2557c)

---

## en English

### Version 1: Short

> **Pocket Chick — AI in your pocket**
>
> A fully open-source AI companion that lives on your phone — chat, image generation, play, picture books and adventures, all running offline on your device. Built on llama.cpp and llama.rn. Models run locally and fully offline — your chats never leave your device, and your privacy stays yours.
>
> - 🐣 Fully offline: works without a network
> - 🆓 Free & open source: built on PocketPal AI (MIT License)
> - 📦 Many models, free to switch: download and remove anytime
> - 🎨 On-device image generation: create from a sentence, end to end on your phone
> - 🖼️ Image-to-prompt: understand any picture, recreate it in one tap
> - 🔈 On-device voice: offline transcription & speech synthesis

### Version 2: Standard

> **Pocket Chick**
>
> Pocket Chick is a fully open-source AI companion that lives on your phone — chat, image generation, play, picture books and adventures, all running offline on your device. Built on llama.cpp and llama.rn.
>
> Unlike cloud-based chatbots, Pocket Chick runs models entirely on your device — no servers, no internet, and no third party ever sees your conversations. Every question and every reply stays on your phone. The entire project is fully open source on GitHub — fork it, extend it, build your own.
>
> **Features**
> - Fully offline — works without a network
> - Supports many open-source models — download, switch, and remove freely
> - On-device image generation — your creations never leave your phone
> - Image-to-prompt — turn any picture into a generation prompt
> - Full on-device voice — offline transcription & speech synthesis
> - Fully open source — contributions and derivative works are welcome
> - Lightweight — ready to use instantly
>
> **Open Source**
> This project is a fork of PocketPal AI (MIT License). The source code is fully open on GitHub — issues, pull requests and derivative works are all welcome.
>
> **Repository**
> https://github.com/Hmission/pocketpal-ai-fork
>
> **Version**
> Version: v2.0.0 (144) · Engine: llama.cpp 10054 (ac2557c)

### Version 3: Minimal

> **Pocket Chick** — The open-source AI companion that lives on your phone: chat, image generation, play, picture books and adventures, all offline.
>
> Built on llama.cpp & llama.rn · Fork of PocketPal AI (MIT License) · Fully offline · Free & open source
>
> v2.0.0 (144) · llama.cpp 10054 (ac2557c)

---

## ja 日本語

### バージョン1：ショート版

> **Pocket Chick —— AIをあなたのポケットへ**
>
> 大規模言語モデルをスマートフォン上で直接実行するAIアプリ、llama.cppとllama.rnをベースに構築。モデルは端末内で完全オフライン動作し、会話データは端末から出ません。プライバシーはあなたの手の中に。
>
> - 🐣 完全オフライン：ネットワーク不要
> - 🆓 無料＆オープンソース：PocketPal AI（MIT License）ベース
> - 📦 多モデル対応：ダウンロード・切替・削除は自由
> - 🎨 端末内で画像生成：一言で画像を生成、すべて端末内で完結
> - 🖼️ 画像からプロンプト逆引き：画像を読み取り、ワンタップで再生成
> - 🔈 端末内音声：オフライン文字起こし & 音声合成

### バージョン2：スタンダード版

> **Pocket Chick**
>
> 言語モデルをスマートフォンで直接利用できるアプリです、llama.cppとllama.rnをベースに開発されています。
>
> クラウド型チャットボットとは異なり、Pocket Chickのモデルはお使いの端末上で完全に動作します。サーバーもインターネットも不要で、会話が第三者に送信されることもありません。すべての質問と回答は、あなたのスマートフォンの中だけに残ります。
>
> **特徴**
> - 完全オフライン動作 — ネットワークがなくても利用可能
> - 多数のオープンソースモデルに対応 — 自由にダウンロード・切り替え・削除が可能
> - 端末内で画像生成 — 創作の過程が端末から離れない
> - 画像からプロンプト逆引き — 画像を読み取り、ワンタップで再生成
> - 端末内で完結する音声 — オフライン文字起こし & 音声合成
> - 軽量で起動が速い
>
> **オープンソース**
> 本プロジェクトは PocketPal AI（MIT License）のフォークであり、ソースコードは GitHub で完全に公開されています。Issue・Pull Request・二次開発を歓迎します。
>
> **リポジトリ**
> https://github.com/Hmission/pocketpal-ai-fork
>
> **バージョン情報**
> バージョン：v2.0.0 (144) · エンジン：llama.cpp 10054 (ac2557c)

### バージョン3：ミニマル版

> **Pocket Chick** — 大規模言語モデルをスマートフォンに直接デプロイするAIアプリ。
>
> llama.cppとllama.rnベース · PocketPal AI（MIT License）フォーク · 完全オフライン · 無料＆オープンソース
>
> v2.0.0 (144) · llama.cpp 10054 (ac2557c)

---

## ko 한국어

### 버전 1: 짧은 버전

> **Pocket Chick —— AI를 당신의 주머니로**
>
> 대규모 언어 모델을 스마트폰에서 직접 실행하는 AI 앱, llama.cpp와 llama.rn 기반. 모델이 기기에서 완전 오프라인으로 실행되며 대화 데이터가 기기를 떠나지 않습니다. 프라이버시는 당신의 손안에.
>
> - 🐣 완전 오프라인: 네트워크 없이도 사용 가능
> - 🆓 무료 & 오픈소스: PocketPal AI(MIT License) 기반
> - 📦 다양한 모델 자유 전환: 필요할 때 다운로드, 언제든 제거
> - 🎨 기기 내 이미지 생성: 한 문장으로 생성, 전 과정 기기에서
> - 🖼️ 이미지 프롬프트 역추론: 이미지를 읽고 원터치로 재생성
> - 🔈 기기 내 음성: 오프라인 전사 & 음성 합성

### 버전 2: 표준 버전

> **Pocket Chick**
>
> 대규모 언어 모델(LLM)을 모바일 기기에서 직접 구동하는 앱입니다. llama.cpp 및 llama.rn 라이브러리를 기반으로 구축되었습니다.
>
> 클라우드 기반 챗봇과 달리, Pocket Chick의 모델은 사용자의 기기에서 완전히 실행됩니다. 서버도, 인터넷도 필요 없으며 대화 내용이 제3자에게 전송되는 일도 없습니다. 모든 질문과 답변은 오직 사용자의 휴대폰 안에만 남습니다.
>
> **기능**
> - 완전 오프라인 실행 — 네트워크 없이도 사용 가능
> - 다양한 오픈소스 모델 지원 — 자유롭게 다운로드, 전환, 제거 가능
> - 기기 내 이미지 생성 — 창작 과정이 기기를 떠나지 않음
> - 이미지에서 프롬프트 역추론 — 이미지를 읽고 원터치로 재생성
> - 기기 내 음성 완결 — 오프라인 전사 & 음성 합성
> - 가벼운 시작 — 켜자마자 사용 가능
>
> **오픈소스**
> 이 프로젝트는 PocketPal AI(MIT License)의 포크이며, 소스 코드가 GitHub에 완전히 공개되어 있습니다. Issue와 Pull Request, 2차 개발을 환영합니다.
>
> **저장소**
> https://github.com/Hmission/pocketpal-ai-fork
>
> **버전 정보**
> 버전: v2.0.0 (144) · 엔진: llama.cpp 10054 (ac2557c)

### 버전 3: 미니멀 버전

> **Pocket Chick** — 대규모 언어 모델을 스마트폰에 직접 배포하는 AI 앱.
>
> llama.cpp & llama.rn 기반 · PocketPal AI(MIT License) 포크 · 완전 오프라인 · 무료 & 오픈소스
>
> v2.0.0 (144) · llama.cpp 10054 (ac2557c)

---

## fa فارسی

### نسخه ۱: نسخه کوتاه

> **پاکت چیک — هوش مصنوعی در جیب شما**
>
> یک اپلیکیشن هوش مصنوعی که مدل‌های زبانی بزرگ را مستقیماً روی گوشی شما اجرا می‌کند، ساخته‌شده بر پایه llama.cpp و llama.rn. مدل‌ها به‌صورت کاملاً آفلاین روی دستگاه اجرا می‌شوند و داده‌های گفتگو از گوشی خارج نمی‌شوند.
>
> - 🐣 کاملاً آفلاین: بدون شبکه هم کار می‌کند
> - 🆓 رایگان و متن‌باز: بر پایه PocketPal AI (مجوز MIT)
> - 📦 جابه‌جایی آزادانه مدل‌ها: هر وقت دانلود کنید، هر وقت حذف کنید
> - 🎨 تولید تصویر روی دستگاه: با یک جمله تصویر بسازید
> - 🖼️ تبدیل تصویر به پرامپت: تصویر را بفهمید و با یک لمس بازآفرینی کنید
> - 🔈 صدای روی دستگاه: رونویسی آفلاین و سنتز گفتار

### نسخه ۲: نسخه استاندارد

> **پاکت چیک (Pocket Chick)**
>
> برنامه‌ای که مدل‌های زبانی را مستقیماً به گوشی شما می‌آورد. بر پایه llama.cpp و llama.rn ساخته شده.
>
> برخلاف چت‌بات‌های ابری، مدل‌های Pocket Chick کاملاً روی دستگاه شما اجرا می‌شوند؛ بدون سرور، بدون اینترنت و بدون ارسال گفتگوها به شخص ثالث. هر پرسش و هر پاسخ فقط در گوشی شما می‌ماند.
>
> **ویژگی‌ها**
> - کاملاً آفلاین — بدون شبکه هم کار می‌کند
> - پشتیبانی از مدل‌های متنوع متن‌باز — دانلود، تغییر و حذف آزادانه
> - تولید تصویر روی دستگاه — آثار شما هرگز از گوشی خارج نمی‌شوند
> - تبدیل تصویر به پرامپت — تصویر را بفهمید و با یک لمس بازآفرینی کنید
> - صوت کامل روی دستگاه — رونویسی آفلاین و سنتز گفتار
> - سبک و آماده استفاده
>
> **متن‌باز**
> این پروژه فورک PocketPal AI (مجوز MIT) است و کد منبع آن به‌طور کامل در GitHub منتشر شده است. Issue، Pull Request و توسعه مشتق خوش‌آمد است.
>
> **مخزن**
> https://github.com/Hmission/pocketpal-ai-fork
>
> **اطلاعات نسخه**
> نسخه: v2.0.0 (144) · موتور: llama.cpp 10054 (ac2557c)

### نسخه ۳: نسخه مینیمال

> **پاکت چیک** — اپلیکیشن هوش مصنوعی که مدل‌های زبانی بزرگ را مستقیماً روی گوشی شما اجرا می‌کند.
>
> بر پایه llama.cpp و llama.rn · فورک PocketPal AI (مجوز MIT) · کاملاً آفلاین · رایگان و متن‌باز
>
> v2.0.0 (144) · llama.cpp 10054 (ac2557c)

---

## he עברית

### גרסה 1: קצרה

> **פאקט צ'יק — AI בכיס שלכם**
>
> אפליקציית AI שמריצה מודלי שפה גדולים ישירות על הטלפון שלכם, מבוססת על llama.cpp ו-llama.rn. המודלים רצים במצב לא מקוון לגמרי על המכשיר, ונתוני השיחה לא עוזבים את הטלפון.
>
> - 🐣 לא מקוון לגמרי: עובד גם ללא רשת
> - 🆓 חינם וקוד פתוח: מבוסס על PocketPal AI (רישיון MIT)
> - 📦 מעבר חופשי בין מודלים: הורידו ומחקו מתי שתרצו
> - 🎨 יצירת תמונות על המכשיר: צרו תמונה ממשפט אחד
> - 🖼️ הפיכת תמונה לפרומפט: הבינו את התמונה וצרו אותה מחדש בנגיעה אחת
> - 🔈 קול על המכשיר: תמלול לא מקוון וסינתזת דיבור

### גרסה 2: סטנדרטית

> **פאקט צ'יק (Pocket Chick)**
>
> אפליקציה שמביאה מודלי שפה ישירות לטלפון שלך. מבוססת על התשתית של llama.cpp ו-llama.rn.
>
> בניגוד לצ'אטבוטים מבוססי ענן, המודלים של Pocket Chick רצים כולו על המכשיר שלכם — ללא שרתים, ללא אינטרנט וללא העברת שיחות לצד שלישי. כל שאלה וכל תשובה נשארות רק בטלפון שלכם.
>
> **תכונות**
> - עבודה מלאה במצב לא מקוון — פועל גם ללא רשת
> - תמיכה במגוון מודלים בקוד פתוח — הורידו, החליפו והסירו בחופשיות
> - יצירת תמונות על המכשיר — היצירות שלכם לעולם לא עוזבות את הטלפון
> - הפיכת תמונה לפרומפט — הבינו את התמונה וצרו אותה מחדש בנגיעה אחת
> - קול מלא על המכשיר — תמלול לא מקוון וסינתזת דיבור
> - קל ומהיר להפעלה
>
> **קוד פתוח**
> פרויקט זה הוא Fork של PocketPal AI (רישיון MIT); קוד המקור פתוח לחלוטין ב-GitHub. Issue, Pull Request ופיתוח נגזר יתקבלו בברכה.
>
> **מאגר**
> https://github.com/Hmission/pocketpal-ai-fork
>
> **מידע גרסה**
> גרסה: v2.0.0 (144) · מנוע: llama.cpp 10054 (ac2557c)

### גרסה 3: מינימלית

> **פאקט צ'יק** — אפליקציית AI שמריצה מודלי שפה גדולים ישירות על הטלפון שלכם.
>
> מבוסס על llama.cpp ו-llama.rn · פורק של PocketPal AI (רישיון MIT) · לא מקוון לגמרי · חינם וקוד פתוח
>
> v2.0.0 (144) · llama.cpp 10054 (ac2557c)

---

## id Bahasa Indonesia

### Versi 1: Pendek

> **Pocket Chick — AI di saku Anda**
>
> Aplikasi AI yang menjalankan model bahasa besar langsung di ponsel Anda, dibangun di atas llama.cpp dan llama.rn. Model berjalan sepenuhnya offline di perangkat, data percakapan tidak pernah meninggalkan ponsel.
>
> - 🐣 Sepenuhnya offline: tetap berfungsi tanpa jaringan
> - 🆓 Gratis & open source: dibangun di atas PocketPal AI (Lisensi MIT)
> - 📦 Bebas ganti model: unduh dan hapus kapan saja
> - 🎨 Generasi gambar di perangkat: buat gambar dari satu kalimat
> - 🖼️ Gambar ke prompt: pahami gambar dan buat ulang sekali sentuh
> - 🔈 Suara di perangkat: transkripsi offline & sintesis suara

### Versi 2: Standar

> **Pocket Chick**
>
> Aplikasi yang membawa model bahasa langsung ke ponsel Anda. Dibangun di atas llama.cpp dan llama.rn.
>
> Berbeda dengan chatbot berbasis cloud, model Pocket Chick berjalan sepenuhnya di perangkat Anda — tanpa server, tanpa internet, dan tanpa mengirim percakapan ke pihak ketiga. Setiap pertanyaan dan jawaban hanya tersimpan di ponsel Anda.
>
> **Fitur**
> - Sepenuhnya offline — tetap berfungsi tanpa jaringan
> - Mendukung banyak model open source — unduh, ganti, dan hapus dengan bebas
> - Generasi gambar di perangkat — karya Anda tidak pernah meninggalkan ponsel
> - Gambar ke prompt — pahami gambar dan buat ulang sekali sentuh
> - Suara on-device lengkap — transkripsi offline & sintesis suara
> - Ringan dan siap pakai
>
> **Sumber Terbuka**
> Proyek ini adalah fork PocketPal AI (Lisensi MIT); kode sumber sepenuhnya terbuka di GitHub. Issue, pull request, dan pengembangan turunan sangat diterima.
>
> **Repositori**
> https://github.com/Hmission/pocketpal-ai-fork
>
> **Info Versi**
> Versi: v2.0.0 (144) · Mesin: llama.cpp 10054 (ac2557c)

### Versi 3: Minimal

> **Pocket Chick** — Aplikasi AI yang menjalankan model bahasa besar langsung di ponsel Anda.
>
> Dibangun di atas llama.cpp & llama.rn · Fork dari PocketPal AI (MIT License) · Sepenuhnya offline · Gratis & open source
>
> v2.0.0 (144) · llama.cpp 10054 (ac2557c)

---

## ms Bahasa Melayu

### Versi 1: Ringkas

> **Pocket Chick — AI di dalam poket anda**
>
> Aplikasi AI yang menjalankan model bahasa besar terus pada telefon anda, dibina di atas llama.cpp dan llama.rn. Model berjalan sepenuhnya di luar talian pada peranti, data perbualan tidak pernah meninggalkan telefon.
>
> - 🐣 Luar talian sepenuhnya: tanpa rangkaian pun boleh digunakan
> - 🆓 Percuma & sumber terbuka: dibina berdasarkan PocketPal AI (Lesen MIT)
> - 📦 Tukar model dengan bebas: muat turun dan alih keluar bila-bila masa
> - 🎨 Penjanaan imej pada peranti: cipta imej daripada satu ayat
> - 🖼️ Imej ke prompt: fahami imej dan cipta semula sekali sentuh
> - 🔈 Suara pada peranti: transkripsi luar talian & sintesis pertuturan

### Versi 2: Standard

> **Pocket Chick**
>
> Aplikasi yang membawa model bahasa terus ke telefon anda. Dibina di atas llama.cpp dan llama.rn.
>
> Berbeza dengan chatbot berasaskan awan, model Pocket Chick berjalan sepenuhnya pada peranti anda — tanpa pelayan, tanpa internet, dan tanpa menghantar perbualan kepada pihak ketiga. Setiap soalan dan setiap jawapan kekal dalam telefon anda.
>
> **Ciri-ciri**
> - Berfungsi sepenuhnya di luar talian — tanpa rangkaian pun boleh digunakan
> - Menyokong pelbagai model sumber terbuka — muat turun, tukar dan alih keluar dengan bebas
> - Penjanaan imej pada peranti — karya anda tidak pernah meninggalkan telefon
> - Imej ke prompt — fahami imej dan cipta semula sekali sentuh
> - Suara on-peranti lengkap — transkripsi luar talian & sintesis pertuturan
> - Ringan dan sedia digunakan
>
> **Sumber Terbuka**
> Projek ini adalah fork PocketPal AI (Lesen MIT); kod sumber terbuka sepenuhnya di GitHub. Isu, pull request dan pembangunan terbitan dialu-alukan.
>
> **Repositori**
> https://github.com/Hmission/pocketpal-ai-fork
>
> **Maklumat Versi**
> Versi: v2.0.0 (144) · Enjin: llama.cpp 10054 (ac2557c)

### Versi 3: Minimal

> **Pocket Chick** — Aplikasi AI yang menjalankan model bahasa besar terus pada telefon anda.
>
> Dibina berdasarkan llama.cpp & llama.rn · Fork PocketPal AI (Lesen MIT) · Luar talian sepenuhnya · Percuma & sumber terbuka
>
> v2.0.0 (144) · llama.cpp 10054 (ac2557c)

---

## pl Polski

### Wersja 1: Krótka

> **Pocket Chick — AI w Twojej kieszeni**
>
> Aplikacja AI, która uruchamia duże modele językowe bezpośrednio na Twoim telefonie, zbudowana na bazie llama.cpp i llama.rn. Modele działają w pełni offline na urządzeniu, dane rozmów nigdy nie opuszczają telefonu.
>
> - 🐣 W pełni offline: działa bez sieci
> - 🆓 Darmowe i open source: oparte na PocketPal AI (licencja MIT)
> - 📦 Swobodna zmiana modeli: pobieraj i usuwaj, kiedy chcesz
> - 🎨 Generowanie obrazów na urządzeniu: stwórz obraz z jednego zdania
> - 🖼️ Obraz na prompt: zrozum obraz i odtwórz jednym dotknięciem
> - 🔈 Głos na urządzeniu: transkrypcja offline i synteza mowy

### Wersja 2: Standardowa

> **Pocket Chick**
>
> Aplikacja, która umożliwia działanie modeli językowych bezpośrednio na Twoim telefonie. Opiera się na bibliotekach llama.cpp i llama.rn.
>
> W przeciwieństwie do chatbotów chmurowych, modele Pocket Chick działają w całości na Twoim urządzeniu — bez serwerów, bez internetu i bez przekazywania rozmów osobom trzecim. Każde pytanie i każda odpowiedź pozostają tylko w Twoim telefonie.
>
> **Funkcje**
> - W pełni offline — działa bez sieci
> - Obsługa wielu modeli open source — swobodnie pobieraj, przełączaj i usuwaj
> - Generowanie obrazów na urządzeniu — Twoje prace nigdy nie opuszczają telefonu
> - Obraz na prompt — zrozum obraz i odtwórz jednym dotknięciem
> - Pełny głos na urządzeniu — transkrypcja offline i synteza mowy
> - Lekki start — gotowy do użycia od razu
>
> **Open Source**
> Projekt jest forkiem PocketPal AI (licencja MIT); kod źródłowy jest w pełni otwarty na GitHub. Issue, pull requesty i rozwój pochodny są mile widziane.
>
> **Repozytorium**
> https://github.com/Hmission/pocketpal-ai-fork
>
> **Informacje o wersji**
> Wersja: v2.0.0 (144) · Silnik: llama.cpp 10054 (ac2557c)

### Wersja 3: Minimalna

> **Pocket Chick** — Aplikacja AI, która uruchamia duże modele językowe bezpośrednio na Twoim telefonie.
>
> Oparta na llama.cpp & llama.rn · Fork PocketPal AI (MIT License) · W pełni offline · Darmowe i open source
>
> v2.0.0 (144) · llama.cpp 10054 (ac2557c)

---

## pt Português

### Versão 1: Curta

> **Pocket Chick — IA no seu bolso**
>
> Uma app de IA que executa grandes modelos de linguagem diretamente no seu telemóvel, construída sobre o llama.cpp e o llama.rn. Os modelos funcionam totalmente offline no dispositivo e os dados das conversas nunca saem do telemóvel.
>
> - 🐣 Totalmente offline: funciona sem rede
> - 🆓 Grátis e open source: baseada no PocketPal AI (Licença MIT)
> - 📦 Troque de modelos livremente: descarregue e remova quando quiser
> - 🎨 Geração de imagens no dispositivo: crie imagens a partir de uma frase
> - 🖼️ Imagem para prompt: entenda a imagem e recrie com um toque
> - 🔈 Voz no dispositivo: transcrição offline e síntese de fala

### Versão 2: Padrão

> **Pocket Chick**
>
> Uma app que traz modelos de linguagem diretamente para o seu telemóvel. Construído sobre o llama.cpp e o llama.rn.
>
> Ao contrário dos chatbots baseados na nuvem, os modelos do Pocket Chick funcionam inteiramente no seu dispositivo — sem servidores, sem internet e sem conversas enviadas a terceiros. Cada pergunta e cada resposta ficam apenas no seu telemóvel.
>
> **Funcionalidades**
> - Totalmente offline — funciona sem rede
> - Suporta vários modelos de código aberto — descarregue, alterne e remova livremente
> - Geração de imagens no dispositivo — as suas criações nunca saem do telemóvel
> - Imagem para prompt — entenda a imagem e recrie com um toque
> - Voz completa no dispositivo — transcrição offline e síntese de fala
> - Leve e pronto a usar
>
> **Open Source**
> Este projeto é um fork do PocketPal AI (Licença MIT); o código-fonte está totalmente aberto no GitHub. Issues, pull requests e obras derivadas são bem-vindos.
>
> **Repositório**
> https://github.com/Hmission/pocketpal-ai-fork
>
> **Informações da Versão**
> Versão: v2.0.0 (144) · Motor: llama.cpp 10054 (ac2557c)

### Versão 3: Mínima

> **Pocket Chick** — Uma app de IA que executa grandes modelos de linguagem diretamente no seu telemóvel.
>
> Construída sobre o llama.cpp & llama.rn · Fork do PocketPal AI (MIT License) · Totalmente offline · Grátis e open source
>
> v2.0.0 (144) · llama.cpp 10054 (ac2557c)

---

## pt_BR Português (Brasil)

### Versão 1: Curta

> **Pocket Chick — IA no seu bolso**
>
> Um app de IA que executa grandes modelos de linguagem diretamente no seu celular, construído sobre o llama.cpp e o llama.rn. Os modelos rodam totalmente offline no dispositivo e os dados das conversas nunca saem do celular.
>
> - 🐣 Totalmente offline: funciona sem rede
> - 🆓 Grátis e open source: baseado no PocketPal AI (licença MIT)
> - 📦 Troque de modelos livremente: baixe e remova quando quiser
> - 🎨 Geração de imagens no dispositivo: crie imagens a partir de uma frase
> - 🖼️ Imagem para prompt: entenda a imagem e recrie com um toque
> - 🔈 Voz no dispositivo: transcrição offline e síntese de fala

### Versão 2: Padrão

> **Pocket Chick**
>
> Um app que traz modelos de linguagem diretamente para o seu celular. Construído sobre o llama.cpp e o llama.rn.
>
> Ao contrário dos chatbots baseados em nuvem, os modelos do Pocket Chick rodam inteiramente no seu dispositivo — sem servidores, sem internet e sem conversas enviadas a terceiros. Cada pergunta e cada resposta ficam apenas no seu celular.
>
> **Recursos**
> - Totalmente offline — funciona sem rede
> - Suporta vários modelos de código aberto — baixe, alterne e remova livremente
> - Geração de imagens no dispositivo — suas criações nunca saem do celular
> - Imagem para prompt — entenda a imagem e recrie com um toque
> - Voz completa no dispositivo — transcrição offline e síntese de fala
> - Leve e pronto para usar
>
> **Open Source**
> Este projeto é um fork do PocketPal AI (licença MIT); o código-fonte está totalmente aberto no GitHub. Issues, pull requests e obras derivadas são bem-vindos.
>
> **Repositório**
> https://github.com/Hmission/pocketpal-ai-fork
>
> **Informações da Versão**
> Versão: v2.0.0 (144) · Motor: llama.cpp 10054 (ac2557c)

### Versão 3: Mínima

> **Pocket Chick** — Um app de IA que executa grandes modelos de linguagem diretamente no seu celular.
>
> Construído sobre o llama.cpp & llama.rn · Fork do PocketPal AI (MIT License) · Totalmente offline · Grátis e open source
>
> v2.0.0 (144) · llama.cpp 10054 (ac2557c)

---

## ru Русский

### Версия 1: Краткая

> **Pocket Chick — ИИ у вас в кармане**
>
> AI-приложение, которое запускает большие языковые модели прямо на вашем телефоне, построенное на llama.cpp и llama.rn. Модели работают полностью офлайн на устройстве, данные разговоров никогда не покидают телефон.
>
> - 🐣 Полностью офлайн: работает без сети
> - 🆓 Бесплатно и с открытым кодом: на основе PocketPal AI (лицензия MIT)
> - 📦 Свободная смена моделей: скачивайте и удаляйте когда угодно
> - 🎨 Генерация изображений на устройстве: создайте изображение по одной фразе
> - 🖼️ Изображение в промпт: поймите картинку и воссоздайте одним касанием
> - 🔈 Голос на устройстве: офлайн-транскрипция и синтез речи

### Версия 2: Стандартная

> **Pocket Chick**
>
> Приложение, которое приносит языковые модели прямо в ваш телефон. Работает на базе llama.cpp и llama.rn.
>
> В отличие от облачных чат-ботов, модели Pocket Chick работают полностью на вашем устройстве — без серверов, без интернета и без передачи диалогов третьим лицам. Каждый вопрос и каждый ответ остаются только в вашем телефоне.
>
> **Возможности**
> - Полностью офлайн — работает без сети
> - Поддержка множества открытых моделей — свободно скачивайте, переключайте и удаляйте
> - Генерация изображений на устройстве — ваши работы не покидают телефон
> - Изображение в промпт — поймите картинку и воссоздайте одним касанием
> - Полный голос на устройстве — офлайн-транскрипция и синтез речи
> - Лёгкий запуск — готов к работе сразу
>
> **Открытый код**
> Проект является форком PocketPal AI (лицензия MIT); исходный код полностью открыт на GitHub. Приветствуются Issue, Pull Request и производные разработки.
>
> **Репозиторий**
> https://github.com/Hmission/pocketpal-ai-fork
>
> **Информация о версии**
> Версия: v2.0.0 (144) · Движок: llama.cpp 10054 (ac2557c)

### Версия 3: Минимальная

> **Pocket Chick** — AI-приложение, которое запускает большие языковые модели прямо на вашем телефоне.
>
> На базе llama.cpp & llama.rn · Форк PocketPal AI (MIT License) · Полностью офлайн · Бесплатно и с открытым кодом
>
> v2.0.0 (144) · llama.cpp 10054 (ac2557c)

---

## uk Українська

### Версія 1: Коротка

> **Pocket Chick — ШІ у вашій кишені**
>
> AI-застосунок, який запускає великі мовні моделі прямо на вашому телефоні, створений на базі llama.cpp та llama.rn. Моделі працюють повністю офлайн на пристрої, дані розмов ніколи не покидають телефон.
>
> - 🐣 Повністю офлайн: працює без мережі
> - 🆓 Безкоштовно та з відкритим кодом: на основі PocketPal AI (ліцензія MIT)
> - 📦 Вільна зміна моделей: завантажуйте та видаляйте будь-коли
> - 🎨 Генерація зображень на пристрої: створіть зображення за однією фразою
> - 🖼️ Зображення в промпт: зрозумійте картинку та відтворіть одним дотиком
> - 🔈 Голос на пристрої: офлайн-транскрипція та синтез мовлення

### Версія 2: Стандартна

> **Pocket Chick**
>
> Додаток, що дозволяє використовувати мовні моделі безпосередньо на вашому телефоні. Створено на базі llama.cpp та llama.rn.
>
> На відміну від хмарних чат-ботів, моделі Pocket Chick працюють повністю на вашому пристрої — без серверів, без інтернету та без передачі розмов третім сторонам. Кожне питання й кожна відповідь залишаються лише у вашому телефоні.
>
> **Можливості**
> - Повністю офлайн — працює без мережі
> - Підтримка багатьох відкритих моделей — вільно завантажуйте, перемикайте та видаляйте
> - Генерація зображень на пристрої — ваші роботи не покидають телефон
> - Зображення в промпт — зрозумійте картинку та відтворіть одним дотиком
> - Повний голос на пристрої — офлайн-транскрипція та синтез мовлення
> - Легкий запуск — готовий до роботи одразу
>
> **Відкритий код**
> Проєкт є форком PocketPal AI (ліцензія MIT); вихідний код повністю відкритий на GitHub. Вітаються Issue, Pull Request та похідні розробки.
>
> **Репозиторій**
> https://github.com/Hmission/pocketpal-ai-fork
>
> **Інформація про версію**
> Версія: v2.0.0 (144) · Двигун: llama.cpp 10054 (ac2557c)

### Версія 3: Мінімальна

> **Pocket Chick** — AI-застосунок, який запускає великі мовні моделі прямо на вашому телефоні.
>
> На базі llama.cpp & llama.rn · Форк PocketPal AI (MIT License) · Повністю офлайн · Безкоштовно та з відкритим кодом
>
> v2.0.0 (144) · llama.cpp 10054 (ac2557c)

---

## de Deutsch

### Version 1: Kurz

> **Pocket Chick — KI in Ihrer Tasche**
>
> Eine KI-App, die große Sprachmodelle direkt auf Ihrem Smartphone ausführt, basierend auf llama.cpp und llama.rn. Die Modelle laufen vollständig offline auf dem Gerät — Gesprächsdaten verlassen niemals Ihr Telefon.
>
> - 🐣 Komplett offline: funktioniert ohne Netzwerk
> - 🆓 Kostenlos und Open Source: basierend auf PocketPal AI (MIT License)
> - 📦 Freie Modellwahl: jederzeit herunterladen und entfernen
> - 🎨 Bildgenerierung auf dem Gerät: erstellen Sie Bilder aus einem Satz
> - 🖼️ Bild zu Prompt: verstehen Sie das Bild und erstellen Sie mit einem Tipp neu
> - 🔈 Stimme auf dem Gerät: Offline-Transkription und Sprachsynthese

### Version 2: Standard

> **Pocket Chick**
>
> Eine App, die Sprachmodelle direkt auf Ihr Smartphone bringt. Sitzt auf den Schultern von llama.cpp und llama.rn.
>
> Anders als cloudbasierte Chatbots laufen die Modelle von Pocket Chick vollständig auf Ihrem Gerät — keine Server, kein Internet, keine Übertragung Ihrer Unterhaltungen an Dritte. Jede Frage und jede Antwort bleibt auf Ihrem Smartphone.
>
> **Funktionen**
> - Komplett offline — funktioniert ohne Netzwerk
> - Unterstützt viele Open-Source-Modelle — frei herunterladen, wechseln und entfernen
> - Bildgenerierung auf dem Gerät — Ihre Kreationen verlassen nie Ihr Telefon
> - Bild zu Prompt — verstehen Sie das Bild und erstellen Sie mit einem Tipp neu
> - Komplette Stimme auf dem Gerät — Offline-Transkription und Sprachsynthese
> - Leichtgewichtig und sofort einsatzbereit
>
> **Open Source**
> Dieses Projekt basiert auf PocketPal AI (MIT License) und folgt dem offenen, transparenten Geist der Open Source. Beiträge und Weiterentwicklungen sind willkommen.
>
> **Versionsinformationen**
> Version: v2.0.0 (144) · Engine: llama.cpp 10054 (ac2557c)

### Version 3: Minimal

> **Pocket Chick** — Die KI-App, die große Sprachmodelle direkt auf Ihrem Smartphone ausführt.
>
> Basierend auf llama.cpp & llama.rn · Fork von PocketPal AI (MIT License) · Komplett offline · Kostenlos und Open Source
>
> v2.0.0 (144) · llama.cpp 10054 (ac2557c)

---

## fr Français

### Version 1 : Courte

> **Pocket Chick — L'IA dans votre poche**
>
> Une application d'IA qui exécute de grands modèles de langage directement sur votre téléphone, construite sur llama.cpp et llama.rn. Les modèles fonctionnent entièrement hors ligne sur l'appareil, et vos conversations ne quittent jamais votre téléphone.
>
> - 🐣 Entièrement hors ligne : fonctionne sans réseau
> - 🆓 Gratuit et open source : basé sur PocketPal AI (licence MIT)
> - 📦 Changez librement de modèle : téléchargez et supprimez à tout moment
> - 🎨 Génération d'images sur l'appareil : créez une image à partir d'une phrase
> - 🖼️ Image vers prompt : comprenez l'image et recréez-la d'une touche
> - 🔈 Voix sur l'appareil : transcription hors ligne et synthèse vocale

### Version 2 : Standard

> **Pocket Chick**
>
> Une application qui apporte des modèles de langage directement sur votre téléphone. Repose sur llama.cpp et llama.rn.
>
> Contrairement aux chatbots cloud, les modèles de Pocket Chick s'exécutent entièrement sur votre appareil — pas de serveur, pas d'internet, aucune conversation transmise à un tiers. Chaque question et chaque réponse restent sur votre téléphone.
>
> **Fonctionnalités**
> - Entièrement hors ligne — fonctionne sans réseau
> - Prend en charge de nombreux modèles open source — téléchargez, changez et supprimez librement
> - Génération d'images sur l'appareil — vos créations ne quittent jamais votre téléphone
> - Image vers prompt — comprenez l'image et recréez-la d'une touche
> - Voix complète sur l'appareil — transcription hors ligne et synthèse vocale
> - Léger et prêt à l'emploi
>
> **Open Source**
> Ce projet est basé sur PocketPal AI (licence MIT) et suit l'esprit ouvert et transparent de l'open source. Contributions et œuvres dérivées sont les bienvenues.
>
> **Informations de version**
> Version : v2.0.0 (144) · Moteur : llama.cpp 10054 (ac2557c)

### Version 3 : Minimale

> **Pocket Chick** — L'application d'IA qui exécute de grands modèles de langage directement sur votre téléphone.
>
> Construite sur llama.cpp & llama.rn · Fork de PocketPal AI (MIT License) · Entièrement hors ligne · Gratuit et open source
>
> v2.0.0 (144) · llama.cpp 10054 (ac2557c)
