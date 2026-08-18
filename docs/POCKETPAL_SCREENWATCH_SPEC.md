---
doc_id: POCKETPAL_SCREENWATCH_SPEC
module: root
type: spec
status: active
version: "1.0"
created: "2026-08-18"
updated: "2026-08-18"
relates: [POCKETPAL_PLAY_SPEC, POCKETPAL_INNERLIFE_SPEC, POCKETPAL_ALBUM_SPEC, POCKETPAL_PRODUCT_SPEC]
---

<!-- D-FORMAT:v3 -->

# 读屏围观 · 玩法 SPEC（SCREENWATCH_SPEC）

**状态**：active | **版本**：1.0 | **更新**：2026-08-18

> **定位**：device_control 只读子集——让小鸡「看见」大王当前屏幕（无障碍 a11y 树），
> 写作模型以围观者口吻点评。**只围观，不干活**：读屏的用途是陪伴，不是自动化。
> **配套**：原生 AccessibilityService（唯一新增原生工程）+ DeviceControlEngine.read_screen。

## 一、定位与边界

- **负责**：
  - **原生只读读屏**：Kotlin AccessibilityService 抓取当前窗口 a11y 精简树（文本+类名，截断防塞爆上下文），RN NativeModule 桥接
  - **工具落地**：DeviceControlEngine 实现 `read_screen`（读当前屏）+ `find_app`（树中查应用）；写作模型点评（围观叙事）
  - **权限引导**：ToolScreen 显示读屏状态，未授权可跳系统无障碍设置页
- **不负责**（明确排除，永久边界）：
  - **不做写操作**：tap / swipe / input_text / 全局动作一律不实现（dispatchGesture 零存在）
  - 不做跨应用自动化、不做点击执行（那是「干活」，违反玩具定位与安全红线）
  - 不做截屏（无障碍只读树不含像素，隐私最小面）
- **上下游**：原生 AccessibilityService → RN 桥 → DeviceControlEngine → AgentRunner 工具循环 → 模型点评注入会话

## 二、核心原则 / 公理

1. **只读围观**：服务只 `getRootInActiveWindow` 读树，零 `dispatchGesture`/`performAction` 写路径——代码里不存在，不是禁用而是没有。
2. **隐私最小面**：精简树只取文本+类名（不含包名详情之外的任何元数据），截断 60 节点/2000 字符；不截屏、不存盘、不落日志内容。
3. **显式授权**：无障碍服务需用户在系统设置手动开启（系统安全红线，App 不代授）；未授权时工具返回显式引导文案（不静默）。
4. **围观不是干活**：工具描述只暴露 read_screen/find_app；模型 fragment 引导「看一眼、说两句」，禁止指导用户操作（女妖围观，不越位）。
5. **无兜底无补丁**：服务未连接/读树失败 → 显式错误码；树为空（非文本界面）→ 如实说明，不编造屏幕内容。

## 三、架构概要

```
Android 无障碍服务（ScreenReaderService，BIND_ACCESSIBILITY_SERVICE）
   onAccessibilityEvent（窗口变化节流）→ 缓存精简树
        ↓ NativeModule（ScreenReaderModule）
readScreen() / isServiceEnabled() / openAccessibilitySettings()
        ↓ JS 桥（src/utils/screenReader.ts）
DeviceControlEngine（read_screen / find_app）
        ↓ AgentRunner 工具循环
写作模型：看到屏幕 → 围观点评（1-2 句俏皮）→ 不指导操作
        ↓ 权限引导
ToolScreen：device_control 行显示「读屏」状态 + 未授权跳转按钮
```

## 四、状态模型

| 维度 | 说明 |
|------|------|
| 输入 | 用户问「我在干嘛/看看我的屏幕」等（模型自主调 read_screen） |
| 输出 | 精简 a11y 树文本 → 模型点评 |
| 持久状态 | 无（读屏结果即时消费，不落盘） |
| 权限 | 系统无障碍服务（用户手动开启，App 引导跳转） |

## 五、契约

- **原生 ScreenReaderService**：`onAccessibilityEvent` 监听 TYPE_WINDOW_STATE_CHANGED + TYPE_WINDOW_CONTENT_CHANGED（1s 节流），缓存 `rootInActiveWindow` 精简树；`readScreen()` 现场重抓（保证新鲜）。
- **精简规则**：深度优先，收集 text 非空节点为 `[className] text`，上限 60 节点 / 2000 字符；窗口包名置顶一行。
- **ScreenReaderModule**：`isServiceEnabled(): Promise<boolean>`（查 Settings.Secure 已启用服务列表）；`readScreen(): Promise<string>`（服务未启用抛 `SCREEN_READER_DISABLED`）；`openAccessibilitySettings(): void`（跳 `android.settings.ACCESSIBILITY_SETTINGS`）。
- **DeviceControlEngine**：`read_screen` → 读屏返回树文本，summary 提示模型点评；`find_app` → 树中匹配包名/类名返回；tap/scroll/input_text 从 ToolDefinition 枚举移除（不暴露未实现动作）。
- **ToolScreen**：device_control 行徽标改「读屏围观」；描述含授权引导；行尾按钮跳系统无障碍设置。
- **systemPromptFragment**：注入围观人设——看到屏幕内容时以女妖口吻点评 1-2 句，可吐槽可关心，**不指挥大王操作**。

## 六、健康指标

| 指标 | 阈值 / 说明 |
|------|-------------|
| tsc | 零错误 |
| jest | DeviceControlEngine 用例全绿（read_screen 成功/未授权/未知动作） |
| Gradle | BUILD SUCCESSFUL |
| 真机验收 | 授权后问「我在干嘛」→ 小鸡说出当前 App 并点评；未授权时提示引导开启 |

## 七、Gap Ledger

| Gap ID | 现象 | 补齐路径 |
|--------|------|----------|
| SCREEN-1 | a11y 树对非文本界面（纯 canvas/游戏）信息少 | 如实说明「屏幕是画的，我看不太清」——不编造（公理 5） |
| SCREEN-2 | 系统无障碍设置跳转后用户手动操作 | 返回后 App 内状态刷新（ToolScreen focus 重查 isServiceEnabled） |

## 八、关联

- **同层子系统**：tools（DeviceControlEngine/ToolScreen）、chat（AgentRunner 工具循环）、pals（女妖 pact.talents 已含 device_control）
- **相关 ADR**：无（玩法层；写操作边界沿用 PRODUCT_SPEC P7 判定）
- **操作手册 (SOP)**：UI_GATE_VERIFICATION_SOP（验证门禁沿用）+ AIOS_POCKETPAL_BUILD_INSTALL_VERIFY_SOP（装机）

## 变更日志

| 日期 | 版本 | 变更 |
|------|------|------|
| 2026-08-18 | 1.0 | 首发：原生只读读屏 + read_screen/find_app + 围观点评 + 权限引导 |
| 2026-08-19 | 1.1 | 闭环收口：清除 ToolScreen isPhase2 死代码残留（写操作已永久移除，Phase 2 叙事删除） |

## 关联文档

- [玩具工坊玩法](./POCKETPAL_PLAY_SPEC.md)（spec，波次 1）
- [内心生活玩法](./POCKETPAL_INNERLIFE_SPEC.md)（spec，波次 2）
- [记忆绘本玩法](./POCKETPAL_ALBUM_SPEC.md)（spec，波次 3）
- [产品路线图（P 系列）](./POCKETPAL_PRODUCT_SPEC.md)（positioning）
