# AGENTS.md — Pocket Chick（小黄鸡）开发指南

本文件为 AI 编码助手与本仓库的协作契约，公开仓库同样适用。

## 项目简介

**Pocket Chick（小黄鸡）** 是一款住进手机的开源 AI 伙伴——聊天、生图、玩乐、绘本、冒险，多种玩法全部离线运行在设备上；基于 [llama.cpp](https://github.com/ggml-org/llama.cpp) 与 [llama.rn](https://github.com/mybigday/llama.rn) 构建，二开自 [PocketPal AI](https://github.com/a-ghorbani/pocketpal-ai)（MIT License）。

核心能力：完全离线本地聊天、端侧图像生成（DreamLite ONNX 引擎 / SD3.5 / Z-Image-Turbo）、多模型自由切换、隐私本地化。

## 技术栈

- React Native + TypeScript（跨平台，Android 为当前主力平台）
- llama.cpp / llama.rn：GGUF 模型推理
- ONNX Runtime：DreamLite 生图引擎（UNet + TE）
- react-native-paper UI 体系 + 自建 token 体系

## 目录结构

| 路径 | 说明 |
|---|---|
| `src/` | 业务代码（screens / components / stores / services / locales / utils） |
| `src/locales/` | 多语言（en 为类型基准，缺失 key 自动回退英文） |
| `docs/` | 公开设计文档（SPEC 系列、文案库 APP_INTRO_COPY） |
| `android/` `ios/` | 原生工程（含生图 JNI 层） |
| `e2e/` | WebdriverIO 端到端测试 |
| `scripts/` | 工具脚本（l10n 校验、图标生成等） |

## 常用命令

```bash
yarn install              # 安装依赖
yarn start                # 启动 Metro
npx tsc --noEmit          # 类型检查（改代码后必跑）
npx jest <path>           # 单测（jest.config.js 配置覆盖率门槛）
yarn l10n:validate        # 多语言 JSON 校验
yarn verify:fonts         # 字体子集校验（新增语言必跑）
```

## 提交规范

Conventional Commits（Husky commitlint 强制）：

- `feat:` 新功能
- `fix:` 修复 bug
- `docs:` 文档变更
- `chore:` 重构 / 工具 / 配置变更
- `refactor:` `test:` `perf:` 等按常规

## UI 复用纪律（2026-08-27 大王报障根治：禁止先造后对齐）

本窗口三次 UI 犯错（重做跑分卡 / 边框卡 / 信息行叠压）根因均为**新建组件前未读规范确认复用关系**。立以下纪律，所有窗口/专工共守：

1. **先读规范后动手**：新建任何 UI 组件/卡片前，先读对应 SPEC（IMAGEGEN_UI_SPEC §1+§6 / DESIGN_SPEC / CHAT_UI_SPEC）确认复用关系，回答三问：①现有容器/组件可复用吗？②与既有设计语言同构吗？③是否违反「不另造一套」？三问皆「否」才可新建。
2. **预览卡片统一模态**：文本/图像/视频等产物一律复用同一标准预览容器（`s.preview`），仅内容不同；禁止为任一模态新建独立卡片容器。
3. **跑分/信息胶囊唯一**：跑分复用 PerfPanel，信息条复用 infoOverlay；禁止新建简化版/叠压第二层。
4. **UI 专工交付前自查**：UI 改动交付前对照 SPEC 红线自查一遍，确认无另造 UI、无叠压、无尺寸不一致。

## Git 仓库铁律（2026-08-24 pack 丢失事故复盘）

- **提交 ≠ 落袋，push 才闭环**：本地 commit 只是暂存；本地 pack 文件一旦丢失（本仓 2026-08-24 凌晨 3 个 `.pack` 全丢，23 个未推送提交对象全灭），未推送内容即无法按原 SHA 恢复。提交后必须尽快 push；多窗口并行开发每窗口收口即 push，禁止积压超过一天。
- **工作仓库禁止历史重写/对象清理**：`git filter-repo`、`git gc --aggressive`、`git prune`、手工删 `.git/objects/pack/*` 一律禁止在 F:\pp 工作仓库执行；确需历史重写时先在 `git bundle` 全量备份后再操作。
- **动 git 前先备份**：任何 reset/init/fetch-重建 类操作前，先 tar 工作区（排除 node_modules/.tmp/build 产物）到仓库外（`F:\backups\`）。
- **恢复预案**：远程 origin（Hmission/pocketpal-ai-fork）是第一恢复源；`git reflog` + `filter-repo/commit-map` + `commit-graph` 是本地审计线索（对象丢失后仅作记录，不作恢复源）。

## 多语言维护

1. 新增语言：`src/locales/index.ts` 的 `languageRegistry` 注册 + 放置 JSON + `requireLanguageData` 加 case + `l10n` 加 getter + `initLocale` 加 dayjs locale
2. 改文案：同步修改 `src/locales/*.json` 与 `docs/APP_INTRO_COPY.md`（介绍文案库）
3. 新增语言后必须 `yarn verify:fonts`（非拉丁语言需在 `src/theme/tokens/typography.ts` 的 `NON_LATIN_LOCALES` 登记）

## 品牌红线

- App 显示名：小黄鸡（英文 Pocket Chick）；代码标识 `name=PocketPal`、`applicationId=com.pocketpalai` 为兼容红线，不可改
- 关于页保留「基于 PocketPal AI（MIT License）开发」署名

## 发布流程

1. 版本号四处同步（单点命令，禁止手工改）：`node scripts/bump-version.js <major|minor|patch|x.y.z>`，自动同步 `.version` / `package.json` / Android `build.gradle`（versionName + versionCode 自增）/ iOS `project.pbxproj`（MARKETING_VERSION + CURRENT_PROJECT_VERSION）
2. `CHANGELOG.md` 把 `[Unreleased]` 收编为定版段 + 顶部新开空 `[Unreleased]`（Keep a Changelog 风格）
3. 验证：`tsc` 零错 → jest 全绿 → 真机装机验证
4. git tag + Release（GitHub）

## AIOS 宿主协议接入（母仓联源，2026-08-29 恢复连仓）

本仓是 AIOS 母仓（F:\AIOS）登记子仓（`subrepo_registry.json`），以下机制经 junction 只读接入（`config/` `.cursor/` `scripts/hooks/` `docs/platform/` 指向母仓，不入本仓 git，见 `.gitignore` 连仓预留区）：

- **心智恢复**：`config/aios_mind_bootstrap.md`（§0 心智锚点三步：心智锚点 / 能力扫描 / 视野校验，每轮开始输出）
- **门禁路由**：`scripts/agent/agent_router.py` gate → route → return（LLM 首个 tool_call 必须 gate）
- **记忆桥接**：`config/context_bootstrap_manifest.json` + zero-shot-inject 注入（零样本注入器）
- **漏斗指针**：`config/aios_funnel_tier2_exec.md` / `tier3_guards.md` / `tier4_refs.md`（层级按需加载）
- **KG 优先**：知识图谱检索（kg_wenpu.py）与星图定界（starmap-scope-guard）
- **指南针**：`scripts/hooks/compass.py`（compass-711-gate，CP-002 系）

接入分级：L0 文件挂载 ✅（guard 6/6 消除）；L1 hook 激活（`.qoder/hooks/` + `scripts/agent/` 挂载点已预留在 .gitignore）——**待 gate 依赖面验证后启用**；L2 全协议（gate→route→return 全链）。

**优先级**：本文件（Pocket Chick 开发指南）为业务契约；与母仓 AIOS 协议冲突时以本文件为准——AIOS 机制服务业务，不覆盖业务。
