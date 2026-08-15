---
doc_id: ADR-0004
module: storage
type: adr
status: accepted
version: 1.0
created: 2026-08-16
updated: 2026-08-16
relates:
  - docs/POCKETPAL_DESIGN_SPEC.md
  - docs/adr/ADR-0001-ui-ssot-single-source.md
---

# ADR-0004 模型存储分层：规范默认目录 + 用户自定义目录

D-FORMAT:v3 · 决策记录 · 2026-08-16

## 背景

模型目录 /sdcard/Documents/AIOS/models（共享存储）需 MANAGE_EXTERNAL_STORAGE
「所有文件访问」特殊权限——不符合 Google Play 生态规范（普通应用申请该权限会被拒上架），
且卸载重装后 appop 清空导致模型列表空（B13 事故根因）。但业务要求「升级不重装模型」，
模型不能放卸载即删的应用私有目录。现状选择是有意的业务取舍，却从未文档化（B15 历史债）。

## 决策

**双轨模型目录架构**：

1. **默认下载目录（规范路径）**：getExternalFilesDir(models)
   （RNFS.ExternalDirectoryPath，即 /sdcard/Android/data/<pkg>/files/models）
   —— HF 等平台下载的模型落此处，零权限、完全符合 Play 规范。
   覆盖安装（升级）保留，卸载时由系统清理（用户主动卸载的代价，可接受）。
2. **自定义目录列表（扩展路径）**：用户手动添加的模型目录，读取时合并扫描。
   默认注册 /sdcard/Documents/AIOS/models 为第一个自定义目录——现状无缝迁移，
   存量模型不挪动，继续支持「卸载不丢模型」。
3. **权限策略（最小化 + 延迟）**：默认目录读写永不申请权限；
   仅当用户主动添加/读取自定义目录时才触发「所有文件访问」引导
   （MANAGE 是特殊权限，系统不支持 request，只能跳设置，Android 平台限制）。
   启动检测只做「默认目录可读」判定，永不短路扫描（B13 修订版契约）。
4. **扫描范围** = 默认目录 ∪ 自定义目录，去重按文件名。

## 理由与权衡

- Play 合规：默认路径无需任何权限，MANAGE 从「启动即要」降为「用户动作时才要」，
  权限请求时机合理化，满足政策「合理用途 + 最小化」要求。
- 业务诉求双满足：升级不重装模型（两条路径覆盖安装均保留）；卸载不丢模型
  （自定义目录在共享存储，卸载保留——除非用户主动清除）。
- 现状零迁移成本：现有 Documents/AIOS/models 作为默认自定义目录直接读取，
  存量用户无感。

## 被否决的替代方案

- **维持现状（全部 Documents + MANAGE）**：Play 上架硬伤，权限事故反复（B13）。
- **全部迁到 getExternalFilesDir**：卸载丢模型，违背「模型与 App 分离」核心诉求。
- **全部迁到 MediaStore/Downloads**：大文件（GGUF 数 GB）不适合媒体库语义，且路径不可控。

## 适用与到期条件

- 适用：侧载 / 国产商店分发（当前）与未来 Play 上架均成立；自定义目录功能交付后
  现有 Documents 路径自动兼容。
- 到期：无。若未来引入「模型市场」类功能，下载目录沿用默认目录，不新增特例。
