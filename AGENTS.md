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

## 验证门禁纪律（2026-09-06 立；四条都是本仓踩过的坑）

1. **报告任何测试失败前，先抽完整错误文本再分类**（三轮实测后的定稿口径）。本仓曾把一个**确定性缺陷**（全局 mock 落后于 spec，见 MASTER_LOG §154）误登记为「超时型 flake」两轮，教训：
   - **禁止以「看着像 flake」收尾**：全量跑必须落盘完整输出再按错误类型归类（PowerShell 管道会破坏中文，用 node `spawnSync` 捕 stdout/stderr），并统计 `Exceeded timeout of` 命中数；
   - **同一次全量里多个无关套件报同一句错误** → 不是资源竞争，而是**未捕获的异步异常被 jest 归给当时正在跑的随机套件**；真凶通常某个 fire-and-forget 轮询调了不存在的方法；
   - `.catch()` 只接 **promise rejection**，**接不住同步 TypeError**（`foo.bar().catch(...)` 中 `foo.bar` 不存在时直接抛）——「看起来有 catch」不等于「有保护」；
   - **缺口要对出来不要猜**：把 spec/接口的方法全集与实际消费面逐一对比（`git grep -oh -E "NativeX\.[a-zA-Z]+" -- src | Sort-Object -Unique`），只补真实缺口；
   - **称它为 flake 的最小证据**：同一代码连跑两次全量红集合互不重叠 **且** 单套复跑全绿 **且** 错误文本已归类——三条缺一即不得称 flake；`--runInBand` 只降低概率，不是定性手段。
2. **`yarn install` 不要加 `--ignore-scripts`**。它会连 llama.rn 官方 postinstall 一起跳过 → jniLibs 原生库不下载、patch-package 补丁不应用（生图 ONNX 丢 16KB page 对齐与 ORT 锁版本）。后置逻辑由 `scripts/postinstall.js`（跨平台 node）负责，结束时打印**构建链自检**三项；自检 FAIL 则 install 非零退出，**先修再构建，不得用 --ignore-scripts 绕过**。
3. **测试替身必须与被测代码同一模块来源（两个方向都会错）**。仓内同时存在 barrel（`src/store/index.ts`、`src/hooks/index.ts`）与具体文件时，`import` 与 `jest.mock` 的**路径必须逐字一致**，否则两边拿到的是两个不同模块：
   - 反向（§152.2）：全局 `jest.mock('../src/store')` 只换 barrel，测试却 `require('../../store/imageGenStore')` 取到**未被 mock 的真实实例** → spy/赋值打在另一个对象上，被测代码看不见（曾被误判为「错误原文被吞」）；
   - 正向（§153）：测试 mock barrel `'../../../hooks'`，组件却 `from '../../hooks/useTheme'` → **mock 从未生效，测试一直在真环境跑**；不断言具体值时更阴——不红，只是静默失效（本仓 4 处）。
   - **判定顺序**：先对齐两边路径（读被测组件的 import 原文），再谈「坏了/过期」；必要时一句 `console.log('SAME_OBJECT:', a === b)` 定音。另：**组件测试的断言应绑 token 语义（如 `mockTheme.colors.tertiary`）而非 hex 字面量**——色值 SSOT 属主题域，锁 hex 会让「改主题色」错误地惊动组件测试。
4. **断言纪律：正面与否定结论同等对待**。任何结论写进文档/报告或据此动手前，必须有**第二条独立口径实证**（列真实清单 / 读二进制头 / 跑最小实验）；只有一条线索加先验知识时只能写成「待验证假设」。断言「缺失/坏了」最危险——它会立刻引发大动作（入仓/重编/重写）。**自己造成的现场破坏不得归因给仓库**（典型：`--ignore-scripts`、PowerShell `Set-Content` 把 LF 改 CRLF 使补丁永久拒施）。误判一旦发现，立即就地改账并写明「此前结论错误 + 推翻它的证据」，不做无声修正。

## 提交规范

Conventional Commits（Husky commitlint 强制）：

- `feat:` 新功能
- `fix:` 修复 bug
- `docs:` 文档变更
- `chore:` 重构 / 工具 / 配置变更

❗ **类型只能用上述四种**（2026-09-06 实测纠正：旧版本这里写着「`refactor:` `test:` `perf:` 等按常规」，但 `commitlint.config.js` 的 `type-enum` 只放行上列四项，用 `test:` 提交会被 commit-msg 钩直接拒收）。测试修正归 `fix(scope):`，脚本/工具/依赖类改动归 `chore(scope):`。

## UI 复用纪律（2026-08-27 大王报障根治：禁止先造后对齐）

本窗口三次 UI 犯错（重做跑分卡 / 边框卡 / 信息行叠压）根因均为**新建组件前未读规范确认复用关系**。立以下纪律，所有窗口/专工共守：

1. **先读规范后动手**：新建任何 UI 组件/卡片前，先读对应 SPEC（IMAGEGEN_UI_SPEC §1+§6 / DESIGN_SPEC / CHAT_UI_SPEC）确认复用关系，回答三问：①现有容器/组件可复用吗？②与既有设计语言同构吗？③是否违反「不另造一套」？三问皆「否」才可新建。
2. **预览卡片统一模态**：文本/图像/视频等产物一律复用同一标准预览容器（`s.preview`），仅内容不同；禁止为任一模态新建独立卡片容器。
3. **跑分/信息胶囊唯一**：跑分复用 PerfPanel，信息条复用 infoOverlay；禁止新建简化版/叠压第二层。
4. **UI 专工交付前自查**：UI 改动交付前对照 SPEC 红线自查一遍，确认无另造 UI、无叠压、无尺寸不一致。

## Git 仓库铁律（2026-08-24 pack 丢失事故复盘 + 2026-08-30 push 纪律修正）

- **提交不等于落袋（风险警示）**：本地 commit 只是暂存；本地 pack 文件一旦丢失（本仓 2026-08-24 凌晨 3 个 `.pack` 全丢，23 个未推送提交对象全灭），未推送内容即无法按原 SHA 恢复——注意风险，勿让积压失控。
- **push 远端必须大王明确指令（2026-08-30 修正，替代旧「提交后必须尽快 push」）**：本地提交照常；**推送远端只在大王明确说「推送/推远端/push」时才执行**，禁止提交后自动 push、禁止收口时顺手 push；多窗口并行每窗口收口至提交即可，待大王指令统一补推。
- **push 一律直连，禁止走代理（2026-08-30，对齐 MASTER_LOG §128.9）**：`git -c http.proxy= -c https.proxy= push origin main`（仅本次命令生效，不改 git config，禁擅改全局代理配置）；网络不通时按 MASTER_LOG §126.4 惯例留痕（登记待推清单），勿反复撞代理。
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
