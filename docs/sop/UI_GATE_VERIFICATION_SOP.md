---
doc_id: UI_GATE_VERIFICATION_SOP
module: sop
type: sop
status: active
version: "1.0"
created: "2026-08-15"
updated: "2026-08-15"
relates: [POCKETPAL_DESIGN_SPEC, POCKETPAL_IMAGEGEN_UI_SPEC, POCKETPAL_CHAT_UI_SPEC]
---

<!-- D-FORMAT:v3 -->

# 小黄鸡 UI 验证 · SOP（UI Gate Verification Operations）

**状态**：active | **版本**：1.0 | **更新**：2026-08-15

> **定位**：UI 视觉迭代与治理批次的五关门禁执行手册。SSOT 见 [`../POCKETPAL_DESIGN_SPEC.md`](../POCKETPAL_DESIGN_SPEC.md)。

## 一、独立运行验证（standalone smoke）

### 1.1 快速验证

```bash
npx tsc --noEmit          # 期望：exit 0，无错误输出
npx jest <改动套件路径>    # 期望：Tests 全绿
```

### 1.2 验证产物/状态完整性

| 检查点 | 命令 | 期望 |
| --- | --- | --- |
| 类型 | `npx tsc --noEmit` | exit 0 |
| 单测（改动套件） | `npx jest <path>` | 全部通过 |
| 单测（全量） | `npx jest` | 除已知 locales.test.ts 预先失败外全绿 |
| l10n | `yarn validate:l10n` | 通过 |
| 字体 | `yarn verify:fonts`（新增语言时） | 通过 |

### 1.3 退出码 / 状态速查

| 退出码/状态 | 含义 | 排查方向 |
| --- | --- | --- |
| tsc 0 | 类型通过 | — |
| tsc 2 | 类型错误 | 看错误文件/行，修完重跑 |
| jest 失败 | 测试断言失败 | 看失败用例 + 快照差异 |
| GRADLE EXIT: 0 | 构建成功 | — |

## 二、日常操作

### 2.1 检查健康（每次 UI 改动后）

1. `npx tsc --noEmit` → 零错。
2. `npx jest <改动套件>` → 绿（全量 jest 覆盖门槛需全量跑）。
3. `git status` → 确认改动范围与预期一致（只读检查）。

### 2.2 五关门禁（每波 UI 视觉迭代必过）

| # | 门禁 | 命令/操作 | 验收 |
| --- | --- | --- | --- |
| G1 | 类型 | `npx tsc --noEmit` | exit 0 |
| G2 | 单测 | `npx jest <改动套件>`（全量前先局部） | 全绿 |
| G3 | 构建 | `cd android; .\gradlew.bat assembleProdDebug` | BUILD SUCCESSFUL |
| G4 | 装机 | `adb -s <device> install -r app-prod-debug.apk` + `am start` | Success，冷启动正常 |
| G5 | 性能走查 | 真机 token 流 + 按压动效叠加；`dumpsys meminfo` 对比 | JS 帧 <16ms，无新增常驻内存 |

### 2.3 真机操作（人类模拟路径，禁止跑 API 绕过 UI）

1. 拉起投屏（scrcpy）让大王监督全过程。
2. 打开 App → 界面点按/滑动（uiautomator dump + input tap 定位坐标）。
3. 关键走查路径：抽屉（hamburger ≈(86,192)）→ 画图 → 生图页顶栏触发胶囊 → 下拉面板 → 首屏出图按钮。
4. 深浅双模式：设置 → 生成设置 → 深色模式开关（dark-mode-switch），两种模式各截图存档。
5. 截图：`adb shell screencap -p /sdcard/vf.png` + pull（禁 PowerShell 管道直写）。

## 三、故障排查

### 3.1 已知问题与解法

| 症状 | 根因 | 解法 |
| --- | --- | --- |
| jest 全量覆盖门槛失败 | 只跑了局部套件（全局 60% 门槛） | 跑全量 `npx jest` |
| locales.test.ts 14 失败 | section 计数 23 vs 25（预先存在） | 与本轮无关，记录不修（另行治理） |
| uiautomator dump 抓不到抽屉 | dump 会 dismiss drawer overlay | 先 tap hamburger 开抽屉 → dump 拿坐标 → 再开抽屉 → tap |
| 边缘滑动退后台 | 触发系统手势 | 用 hamburger 按钮开抽屉，不用边缘滑动 |
| 截图全黑 | 截图时机在过渡动画中 | 延长 sleep 后重截；用 color_hist.py 验证主色 |
| gate 拦截（GATE_STALE） | session anchor >3600s | `python scripts/agent/agent_router.py gate` 刷新（必要时 route） |

### 3.2 诊断路径

1. 先 `git status` 确认改动范围 → 2. `npx tsc --noEmit` 定位类型错 → 3. jest 失败用例定位逻辑错 → 4. 真机截图/dump 定位视觉错 → 5. logcat 定位运行时错。

## 四、变更操作

### 4.1 变更步骤

1. 先更新对应 SPEC（DESIGN_SPEC 或并行 SPEC）再改代码（文档先行）。
2. 代码改动 → 过五关门禁（§2.2）。
3. 更新文档 frontmatter（updated/version）与 INDEX 登记。
4. 跑文档治理脚本（§五）。

### 4.2 回滚方案

- 代码：`git checkout -- <file>` 或 `git revert <commit>`（仅 UI 层，禁触碰引擎层文件）。
- 装机：`adb install -r` 旧 APK 或重新构建。
- 文档：`git checkout -- docs/` 恢复上次提交状态。

## 五、验收标准

1. 五关门禁全绿（tsc 0 / jest 绿 / Gradle SUCCESS / 装机成功 / 性能走查通过）。
2. 真机浅/深双模式截图存档（存 `.tmp/p2_*.png` 与 canvases 目录）。
3. SPEC/INDEX/frontmatter 同步更新，文档治理脚本无告警。

## 变更日志

| 日期 | 版本 | 变更 |
|------|------|------|
| 2026-08-15 | 1.0 | 首发（基于 Phase 2 D1-D3 验证流程沉淀） |
| 2026-08-15 | 1.1 | B1-B5 批次执行记录：真机浅/深双模式验证闭环（聊天页 surfaceVariant≈0%、生图页加载按钮右缘 1059 离边 21px、深色 #0E0E0E 53%）；gate 过期修复链实验证（route --agent nv-yao） |

## 关联文档

- [UI 设计语言总纲（SSOT）](../POCKETPAL_DESIGN_SPEC.md)（root）
- [文档管理机制](../DOC_MANAGEMENT.md)（root）
- [ADR-0002 生图顶栏重构](../adr/ADR-0002-imagegen-header-right.md)（adr）
