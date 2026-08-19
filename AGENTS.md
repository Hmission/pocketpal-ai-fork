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
yarn validate:l10n        # 多语言 JSON 校验
yarn verify:fonts         # 字体子集校验（新增语言必跑）
```

## 提交规范

Conventional Commits（Husky commitlint 强制）：

- `feat:` 新功能
- `fix:` 修复 bug
- `docs:` 文档变更
- `chore:` 重构 / 工具 / 配置变更
- `refactor:` `test:` `perf:` 等按常规

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
