---
doc_id: AIOS_POCKETPAL_BUILD_INSTALL_VERIFY_SOP
module: lab/pocketpal-ai
type: sop
status: active
created: 2026-08-12
updated: 2026-08-12
author: zhuo-mu-niao
D-FORMAT: v3
---

<!-- D-FORMAT:v3 -->

# AIOS PocketPal 编译→安装→验证 SOP

> 适用：PocketPal AIOS 集成版（F:\pp 工程副本）。真机始终连接，直接推送验证。

## 前置条件

| 项 | 要求 | 确认命令 |
|---|---|---|
| 工程路径 | `F:\pp`（短路径，绕过 Windows 260 字符 RN 编译限制） | `Test-Path F:\pp\android` |
| ADB | platform-tools 在 PATH 或全路径 | `C:\Users\90897\AppData\Local\Android\Sdk\platform-tools\adb.exe` |
| 设备 | USB 调试已连接 | `adb devices` |
| 包名 | `com.pocketpalai`（生产 flavor 无 .dg 后缀） | — |

## 步骤

### Step 1: TypeScript 类型检查
```powershell
cd F:\pp
npx tsc --noEmit
```
- 成功标准：无输出（零错误）
- 失败：根据 TS 报错修复，不可跳过

### Step 2: Gradle 构建
```powershell
cd F:\pp\android
.\gradlew.bat assembleProdDebug
```
- 成功标准：`BUILD SUCCESSFUL`
- 产物：`F:\pp\android\app\build\outputs\apk\prod\debug\app-prod-debug.apk`（~303MB）
- 常见失败：NDK 版本不匹配 / cmake 长路径 → 确认 F:\pp 短路径 + cmake-inject 补丁

### Step 3: 安装 APK
```powershell
$adb = "C:\Users\90897\AppData\Local\Android\Sdk\platform-tools\adb.exe"
& $adb install -r "F:\pp\android\app\build\outputs\apk\prod\debug\app-prod-debug.apk"
```
- 成功标准：`Success`
- HyperOS 限制：可能需手机端手动点击"USB安装"确认，否则超时取消

### Step 4: 授权存储访问
```powershell
& $adb shell appops set com.pocketpalai MANAGE_EXTERNAL_STORAGE allow
```
- 成功标准：无报错输出
- 作用：允许 App 访问 `/sdcard/Documents/AIOS/` 共享目录

### Step 5: 启动应用
```powershell
& $adb shell am start -n com.pocketpalai/.MainActivity
```
- 成功标准：应用启动到主界面

### Step 6: 真机 UI 验证
```powershell
# Dump UI 层次结构
& $adb shell uiautomator dump /sdcard/ui_dump.xml
& $adb pull /sdcard/ui_dump.xml .\ui_dump.xml
```
- 解析 XML 验证以下元素：
  - 抽屉导航入口（content-desc="Open drawer"）
  - MemoryScreen/KnowledgeScreen/WorkspaceScreen/ToolScreen 文本
  - SessionStatusBar（上下文% / 落盘时间 / 召回预览 / 模型状态）

### Step 7: 生成即落盘验证
```powershell
# 对话后在共享目录检查
& $adb shell ls /sdcard/Documents/AIOS/workspace/conversations/
& $adb shell cat /sdcard/Documents/AIOS/workspace/conversations/$(Get-Date -Format 'yyyy-MM-dd').md
```
- 成功标准：文件存在且包含 `## HH:MM:SS` + `大王:` + `女妖:` 格式条目

### Step 8: Workspace 文件验证
```powershell
& $adb shell ls /sdcard/Documents/AIOS/workspace/
# 预期: SOUL.md USER.md AGENTS.md MEMORY.md conversations/ memory/
& $adb shell cat /sdcard/Documents/AIOS/workspace/SOUL.md
```

## 验证矩阵对照
| 维度 | SOP 步骤 | 证据 |
|---|---|---|
| 生成即落盘 | Step 7 | conversations/日期.md 存在 |
| 前端管理入口 | Step 6 | UI dump 含面板文本 |
| 数据独立化 | Step 8 | workspace/ 四文件 + 两目录 |
| 人设稳定 | Step 6 | 对话回复自称奴家/称大王 |

## 故障排除
- **adb 不在 PATH**：用全路径 `$adb = "C:\Users\...\platform-tools\adb.exe"`
- **INSTALL_FAILED**：检查手机存储空间 / HyperOS USB 安装开关
- **tsc 报错**：工作区外文件用"复制到 .tmp→SearchReplace→复制回 F:\pp"工作流
- **Gradle OOM**：`org.gradle.jvmargs=-Xmx4G` in gradle.properties

## 参考链路
- SSOT: [AIOS_POCKETPAL_SPEC_V3_SSOT](./AIOS_POCKETPAL_SPEC_V3_SSOT.md)
- ADR: [ADR-20260812-AIOS_POCKETPAL_SEVEN_LAYER_ARCH](./ADR-20260812-AIOS_POCKETPAL_SEVEN_LAYER_ARCH.md)
- 原始工程: `F:\pp` | 只读副本: `lab/pocketpal-ai/`
