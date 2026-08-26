# 定时任务登记表与调整入口（SCHEDULED_TASKS SSOT）

> 定位：跨窗口定时任务唯一事实源——任何窗口专工需要"查有哪些定时任务、怎么调"先看本文件。
> 首次创建：2026-08-25（219 文件事故防护配套）
> 更新规则：任务创建/修改/删除时同步更新本表 + 变更记录，禁止只改任务不改文档。

---

## 1. 当前任务

| ID | 标题 | 频率 | 行为 | 状态 |
|---|---|---|---|---|
| `fd945c4a-c22e-4c68-aef8-9bfe8169fb79` | f:\pp tracked 完整性巡检 | **每小时整点**（every-hour, minute=0） | 跑 `cd f:\pp; node scripts/guard_tracked_files.js --quiet`；退出码 0 →「巡检通过」；退出码 1（无声删除）→ 列清单 + 恢复命令 + 事故警告；退出码 2（git 不可用）→ 说明降级。**除巡检外不执行任何其他操作** | ⏳ 运行中（2026-08-25 起） |

## 2. 调整入口（别的窗口专工操作路径）

定时任务运行在 Qoder 会话层（schedule 能力）。**任意窗口**均可调整：

1. 在 Qoder 会话里让 agent 调用 schedule 能力（`/schedule` 命令或 `manage_scheduled_task` 工具），传入本表中的任务 ID
2. 常用操作：
   - **查**：`action=list`（不传 taskId）
   - **改频率**：`action=update` + `taskId` + `patch.schedule`（必须带完整三元组：`startAt` 下一个执行边界 / `timezone`（Asia/Shanghai）/ `repeat`）
   - **改行为**：`action=update` + `patch.payload`（message 为执行指令，同上表"行为"列）
   - **删**：`action=delete` + `taskId`（删前先想清楚：删了谁兜底？）
3. 支持的频率（repeat 结构）：
   - 一次性：`frequency=none`
   - 每 N 分钟：`frequency=interval` + `minutes`（1-525600）
   - 每小时：`frequency=every-hour` + `minute`（0-59）
   - 每日：`frequency=daily` + `time`（HH:mm）
   - 每周：`frequency=weekly` + `time` + `weekdays`（0=周日）
4. **修改纪律**：
   - 改频率不等于改行为——`patch` 里只放要改的字段，其余保持原样
   - 描述里最后一行注明"调整入口见 docs/POCKETPAL_SCHEDULED_TASKS.md"，防止后继者找不到本文档
   - 改完必须同步更新本表 + 变更记录

## 3. 变更记录

| 日期 | 变更 | 执行窗口 |
|---|---|---|
| 2026-08-25 20:20 | 创建：每 30 分钟巡检（事故后首道会话层防线） | 小黄鸡窗口（跑分卡会话） |
| 2026-08-25 23:37 | 频率 30 分钟 → 每小时整点；description 挂本文档入口 | 同上 |

## 4. 关联防线（完整防护链）

```
第 1 层（子仓分身）f:\pp pre-commit 哨兵      —— 提交即拦，已就位
第 2 层（会话层）   本表任务（每小时巡检）     —— 事故 ≤1 小时上报，已就位
第 3 层（母仓全局） F:\AIOS PATROL-30 巡逻     —— 跨仓看门狗，文档已交母仓，待实施
```

**撤除条件**：母仓 PATROL-30 落地并真实验收通过后，本会话层任务可撤（届时先在变更记录标注撤除原因再删）。

## 5. 故障排查

- **到期未执行**：检查 IDE 是否关闭（schedule 依赖 IDE 进程）；母仓 daemon 不依赖此
- **误报/漏报**：先看 `yarn verify:worktree` 结果；脚本逻辑问题去 `scripts/guard_tracked_files.js`（注释含事故背景）；仍异常找小黄鸡窗口
- **与其他窗口冲突**：同仓同文件只允许一个巡检任务（本表唯一登记），新开巡检前先查本表