---
doc_id: INDEX
module: root
type: index
status: active
version: "1.0"
created: "2026-08-15"
updated: "2026-08-18"
relates: [DOC_GOVERNANCE_SPEC, DOC_MANAGEMENT, CURSOR_DOC_USAGE, POCKETPAL_DESIGN_SPEC]
---

<!-- D-FORMAT:v3 -->

# 文档索引（INDEX）

**状态**：active | **版本**：1.0 | **更新**：2026-08-18

> 全仓权威导航。第一读链：本索引 → 模块文档 → `relates` 扩散。新增文档必须在本文件登记。

## 一、治理元文档（module: root）

| 文档 | type | 状态 | 简介 |
| --- | --- | --- | --- |
| [DOC_GOVERNANCE_SPEC](./DOC_GOVERNANCE_SPEC.md) | spec | active | 文档治理总纲：A/B/C/D 分层、三文档体系、铁律 |
| [DOC_MANAGEMENT](./DOC_MANAGEMENT.md) | spec | active | 文档管理机制：frontmatter、命名、登记、模板、三文档哲学 |
| [CURSOR_DOC_USAGE](./CURSOR_DOC_USAGE.md) | doc | active | AI 使用手册：如何读、定位、改文档 |
| [INDEX](./INDEX.md) | index | active | 本文件：全仓权威导航 |

## 二、全局规范（A 层 / B 层，docs/ 根）

| 文档 | type | 状态 | 简介 |
| --- | --- | --- | --- |
| [POCKETPAL_DESIGN_SPEC](./POCKETPAL_DESIGN_SPEC.md) | ssot | active | **UI 域 SSOT**：暖巢 WarmNest 十一维度定稿 + 债务治理批次（A 层） |
| [POCKETPAL_CHAT_UI_SPEC](./POCKETPAL_CHAT_UI_SPEC.md) | spec | active | 聊天页 UI 规范（B 层分册） |
| [POCKETPAL_IMAGEGEN_UI_SPEC](./POCKETPAL_IMAGEGEN_UI_SPEC.md) | spec | active | 生图页 UI 规范（B 层分册） |
| [POCKETPAL_UI_INTERACTION_SPEC](./POCKETPAL_UI_INTERACTION_SPEC.md) | spec | active | 全局交互定稿（B 层分册） |
| [POCKETPAL_ICON_SPEC](./POCKETPAL_ICON_SPEC.md) | spec | active | 图标规范（B 层分册） |
| [POCKETPAL_STARMAP_DOMAINS](./POCKETPAL_STARMAP_DOMAINS.md) | spec | active | 星图域清单：域边界声明（B 层） |
| [POCKETPAL_MODEL_MATRIX](./POCKETPAL_MODEL_MATRIX.md) | spec | active | 模型矩阵（B 层） |
| [POCKETPAL_PRODUCT_SPEC](./POCKETPAL_PRODUCT_SPEC.md) | positioning | active | **产品文档**：产品概述/开发里程碑/功能设计/亮点/路线图 |
| [APP_INTRO_COPY](./APP_INTRO_COPY.md) | copy | active | 介绍文案库（多语言同步基准） |
| [getting_started](./getting_started.md) | howto | active | 开发环境与启动流程 |
| [POCKETPAL_IMAGE_GEN_UPGRADE_PLAN](./POCKETPAL_IMAGE_GEN_UPGRADE_PLAN.md) | planning | superseded | 生图升级历史规划（已执行完毕，历史证据） |
| [POCKETPAL_PLAY_SPEC](./POCKETPAL_PLAY_SPEC.md) | spec | active | 玩具工坊玩法：play 路由 + 玩具匠人格 + 玩具箱 + 玩法引导（B 层） |
| [POCKETPAL_INNERLIFE_SPEC](./POCKETPAL_INNERLIFE_SPEC.md) | spec | active | 内心生活玩法：收尾三件套（小结+晨间独白+小鸡日记）（B 层） |
| [POCKETPAL_ALBUM_SPEC](./POCKETPAL_ALBUM_SPEC.md) | spec | active | 记忆绘本玩法：周度故事 + DreamLite 封面 → 成长相册（B 层） |
| [POCKETPAL_SCREENWATCH_SPEC](./POCKETPAL_SCREENWATCH_SPEC.md) | spec | active | 读屏围观玩法：无障碍只读读屏 + 写作模型点评（B 层） |

## 三、ADR 库（module: adr，决策证据链）

| 文档 | 状态 | 简介 |
| --- | --- | --- |
| [ADR-0001-ui-ssot-single-source](./adr/ADR-0001-ui-ssot-single-source.md) | accepted | UI 规范单源：DESIGN_SPEC 升格为 SSOT |
| [ADR-0002-imagegen-header-right](./adr/ADR-0002-imagegen-header-right.md) | accepted | 生图页模型选择器挂 AppBar headerRight（D1） |
| [ADR-0003-bubble-footer-unification](./adr/ADR-0003-bubble-footer-unification.md) | accepted | 气泡一体化：footer 收进卡片（B1 决策） |
| [ADR-0004-model-storage-layered](./adr/ADR-0004-model-storage-layered.md) | accepted | 模型存储双轨：规范默认目录 + 用户自定义目录（B15） |
| [ADR-0005-sd35-lora-training-route](./adr/ADR-0005-sd35-lora-training-route.md) | accepted | SD3.5 LoRA 微调：烘焙合并路线 + 端侧零代码部署 |

## 四、SOP 库（module: sop，操作手册）

| 文档 | 状态 | 简介 |
| --- | --- | --- |
| [UI_GATE_VERIFICATION_SOP](./sop/UI_GATE_VERIFICATION_SOP.md) | active | UI 五关门禁执行手册（tsc/jest/Gradle/装机/性能） |
| [IMAGEGEN_MODEL_TRAINING_SOP](./sop/IMAGEGEN_MODEL_TRAINING_SOP.md) | active | 生图模型训练 SOP：SD3.5 LoRA 四段流水线操作手册 |

## 五、模块文档（docs/<module>/）

> 当前模块文档均以全局规范形式位于 docs/ 根（过渡期）；新增单一业务模块文档放对应模块目录。

| 模块 | 前缀 | 权威入口 |
| --- | --- | --- |
| chat | CHAT_* | POCKETPAL_CHAT_UI_SPEC（根） |
| imagegen | IMAGEGEN_* | POCKETPAL_IMAGEGEN_UI_SPEC（根）；模型训练域 SSOT：[IMAGEGEN_MODEL_TRAINING_SSOT](./imagegen/IMAGEGEN_MODEL_TRAINING_SSOT.md) |
| ui | UI_* | POCKETPAL_DESIGN_SPEC（根，SSOT） |
| engine | ENGINE_* | （llama.cpp / ONNX JNI，UI 改造禁区） |

## 关联文档

- [文档治理总规范](./DOC_GOVERNANCE_SPEC.md)
- [文档管理机制](./DOC_MANAGEMENT.md)
- [AI 文档使用说明](./CURSOR_DOC_USAGE.md)
