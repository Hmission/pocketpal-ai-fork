---
doc_id: POCKETPAL_GUARD_INSPECTION_LOG
module: root
type: log
status: active
version: "1.0"
created: "2026-08-27"
updated: "2026-08-28"
relates: [POCKETPAL_SCHEDULED_TASKS, POCKETPAL_MASTER_LOG, INDEX]
---

<!-- D-FORMAT:v3 -->

# tracked 完整性巡检日志

> 定位：每小时整点 guard 巡检（`cd f:\pp; node scripts/guard_tracked_files.js --quiet`）的执行流水账。
> **铁律（2026-08-27 大王定规）**：每次巡检完成后**必须**在本文件追加一条记录，任何窗口/定时任务巡检后必打，退出码 0 也要留痕。
> 与 POCKETPAL_MASTER_LOG 分工：本文件只记巡检结论（时间/退出码/结论/异常摘要），不展开工程细节；事故处置细节仍走 MASTER_LOG。
> 任务定义与调整入口见 [POCKETPAL_SCHEDULED_TASKS](./POCKETPAL_SCHEDULED_TASKS.md)（任务 `fd945c4a-…`）。

---

## 一、记录约定

- 每次巡检**无论退出码 0/1/2** 完成后必须追加一条记录：时间（yyyy-MM-dd HH:mm）+ 退出码 + 结论 + 异常摘要（无异常留 `—`）。
- 结论映射：**0**=通过；**1**=事故（无声删除，须另附丢失文件清单与恢复命令并警告）；**2**=降级（git 不可用，说明原因）。
- 长期缺记录 = 巡检可能漏跑（哨兵自身告警信号），其他窗口发现缺记录须补查。

## 〇、WARN「规则 SSOT 引用缺失 6/6」归档（2026-08-28 调查定论）

> 18:00 起巡检日志连续记录 WARN「规则 SSOT 引用缺失 6/6」——经全量调查确认：**结构性已知项，非事故信号，guard 核心防护不受影响**，本段归档后后续巡检可照常登记 WARN（保留哨兵自证）或注明「已知 WARN（见 §〇）」。

- **6 处缺失引用**（来源：治理修复方案 `.qoder/specs/治理规则记忆链路修复升级方案_task-6d0f.md` §2.1；被检方：`scripts/guard_tracked_files.js` B1 检查项）：`config/aios_mind_bootstrap.md`、`config/context_bootstrap_manifest.json`、`.cursor/rules/`、`scripts/hooks/compass.py`、`docs/platform/`、AGENTS.md 协议关键词（心智恢复/KG 优先/漏斗层级）。
- **根因**：上述路径 git 索引与历史均为 0 commits（从未入库）——这些规则 SSOT 属母仓 AIOS（docs/platform、config、.cursor/rules 等），f:\pp 连仓按治理方案 §四「不搬母仓、不建空壳」决策刻意不复制，属结构性缺失（方案 6D 定位 D1），**不是无声删除**（无声删除判定 = 索引仍登记但工作区消失，此处索引本无）。
- **半激活定性**：半激活的是治理类 hook（hooks_label_map.json B2 标注：gate-guard=partial、zero-shot-inject=partial、compass-711-gate=not-applicable），**与 tracked 文件防护无关**。guard_tracked_files.js 核心检测（git ls-files --deleted − 暂存删除）不依赖任何 SSOT 引用，退出码契约 0/1/2 不受影响。
- **处理动作**：确认无害，归档为已知项；不补齐引用（违背不建空壳边界）、不静默 WARN（B1 的存在意义即防假激活误判）。

## 二、巡检记录

| 时间 | 退出码 | 结论 | 异常摘要 |
|---|---|---|---|
| 2026-08-27 17:29 | 0 | 通过 | 无无声删除。附 WARN：规则 SSOT 引用缺失 6/6（config/aios_mind_bootstrap.md、config/context_bootstrap_manifest.json、.cursor/rules、scripts/hooks/compass.py、docs/platform、AGENTS.md）——hook 半激活风险，非 tracked 事故，见治理修复方案 §2.1（连接仓存放） |
| 2026-08-27 18:00 | 0 | 通过 | 无无声删除。附 WARN：规则 SSOT 引用缺失 6/6（同 17:29 清单）——hook 半激活风险，非 tracked 事故 |
| 2026-08-27 19:00 | 0 | 通过 | 无无声删除。附 WARN：规则 SSOT 引用缺失 6/6（同 17:29 清单）——hook 半激活风险，非 tracked 事故 |
| 2026-08-27 20:00 | 0 | 通过 | 无无声删除。附 WARN：规则 SSOT 引用缺失 6/6（同 17:29 清单）——hook 半激活风险，非 tracked 事故 |
| 2026-08-28 00:00 | 0 | 通过 | 无无声删除。附 WARN：规则 SSOT 引用缺失 6/6（同 17:29 清单）——hook 半激活风险，非 tracked 事故 |
| 2026-08-28 01:00 | 0 | 通过 | 无无声删除。附 WARN：规则 SSOT 引用缺失 6/6（同 17:29 清单）——hook 半激活风险，非 tracked 事故 |
| 2026-08-28 02:00 | 0 | 通过 | 无无声删除。附 WARN：规则 SSOT 引用缺失 6/6（同 17:29 清单）——hook 半激活风险，非 tracked 事故 |
| 2026-08-28 03:00 | 0 | 通过 | 无无声删除。附 WARN：规则 SSOT 引用缺失 6/6（同 17:29 清单）——hook 半激活风险，非 tracked 事故 |
| 2026-08-28 05:00 | 0 | 通过 | 无无声删除。附 WARN：规则 SSOT 引用缺失 6/6（同 17:29 清单）——hook 半激活风险，非 tracked 事故 |
| 2026-08-28 06:00 | 0 | 通过 | 无无声删除。附 WARN：规则 SSOT 引用缺失 6/6（同 17:29 清单）——hook 半激活风险，非 tracked 事故 |
| 2026-08-28 07:00 | 0 | 通过 | 无无声删除。附 WARN：规则 SSOT 引用缺失 6/6（同 17:29 清单）——hook 半激活风险，非 tracked 事故 |
| 2026-08-28 08:00 | 0 | 通过 | 无无声删除。附 WARN：规则 SSOT 引用缺失 6/6（同 17:29 清单）——hook 半激活风险，非 tracked 事故 |
| 2026-08-28 09:00 | 0 | 通过 | 无无声删除。附 WARN：规则 SSOT 引用缺失 6/6（同 17:29 清单）——hook 半激活风险，非 tracked 事故 |
| 2026-08-28 12:00 | 0 | 通过 | 无无声删除。附 WARN：规则 SSOT 引用缺失 6/6（同 17:29 清单）——hook 半激活风险，非 tracked 事故 |
| 2026-08-28 13:00 | 0 | 通过 | 无无声删除。附 WARN：规则 SSOT 引用缺失 6/6（同 17:29 清单）——hook 半激活风险，非 tracked 事故 |
| 2026-08-28 14:00 | 0 | 通过 | 无无声删除。附 WARN：规则 SSOT 引用缺失 6/6（同 17:29 清单）——hook 半激活风险，非 tracked 事故 |
| 2026-08-28 15:00 | 0 | 通过 | 无无声删除。附 WARN：规则 SSOT 引用缺失 6/6（同 17:29 清单）——hook 半激活风险，非 tracked 事故 |
| 2026-08-28 16:00 | 0 | 通过 | 无无声删除。附 WARN：规则 SSOT 引用缺失 6/6（同 17:29 清单）——hook 半激活风险，非 tracked 事故 |
| 2026-08-28 17:00 | 0 | 通过 | 无无声删除。附 WARN：规则 SSOT 引用缺失 6/6（同 17:29 清单）——hook 半激活风险，非 tracked 事故 |
| 2026-08-28 17:26 | 0 | 通过 | 无无声删除。附 WARN：规则 SSOT 引用缺失 6/6（同 17:29 清单）——hook 半激活风险，非 tracked 事故 |
| 2026-08-28 18:00 | 0 | 通过 | 无无声删除。附 WARN：规则 SSOT 引用缺失 6/6（同 17:29 清单）——hook 半激活风险，非 tracked 事故。**已知 WARN，已归档见 §〇（2026-08-28 调查定论：结构性缺失，无害，guard 核心不受影响）** |
| 2026-08-28 19:00 | 0 | 通过 | 无无声删除。附 WARN：规则 SSOT 引用缺失 6/6（同 17:29 清单）——hook 半激活风险，非 tracked 事故。**已知 WARN，已归档见 §〇（2026-08-28 调查定论：结构性缺失，无害，guard 核心不受影响）** |