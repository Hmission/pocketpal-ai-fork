# 待开发清单（DEV_BACKLOG）

> 状态：active | 更新：2026-08-23
> 用途：跨窗口待开发项唯一登记处（任务接力清单）。每项含目标 / 前置 / 验收 / 归属。
> 约定：完成一项即标记 ✅（含 commit），删除前先确认无引用。

## 已完成批次（对照参考）

| 批次 | 内容 | 状态 |
|---|---|---|
| ADR-0008 跑分面板（§75） | PerfPanel PSS/CPU/温度监控 + HardwareInfo 扩展 | ✅ `1535af3` |
| 夜间长任务模式（§76） | 前台服务 + PARTIAL_WAKE_LOCK + AppState 反转 | ✅ `0102b4e`（真机实测 isForeground/WakeLock） |
| DRC 编排对齐 + 电池豁免（§77/§78） | generateDreamLite 同链路 + REQUEST_IGNORE_BATTERY_OPTIMIZATIONS 引导 | ✅ `46af4e5` |
| 记忆时效性三闸（§79） | 写入排除 + 召回免责前缀 + 蒸馏删除指令 | ✅ `aaca505`（真机 G5 待批，见下） |

## 待开发项

### P1（先做：收尾验证类）

| # | 项 | 目标 | 前置 | 验收标准 | 归属 |
|---|---|---|---|---|---|
| 1 | **跑分面板 UI 视觉真机实测** | PerfPanel 在生成/加载中真实可见：**默认展开**（已修，§82）、PSS 大字跳动、折线/CPU/温度/步耗时 1Hz 刷新、>5GB 橙 >6GB 红阈值色 | 投屏（.tmp/scrcpy/）+ 大王监督；加载任一模型或出图触发 | 截图取证 3 态（正常/橙/红）+ 数值跳动 + MASTER_LOG 补登 | 新窗口 |
| 2 | **记忆三闸真机 G5 验证** | K90 治理按钮验证污染库蒸馏清除 + 新会话 web_search 不复读旧闻/失败状态 | 重打包（aaca505 已含） | 污染条目消失 + 新会话回答不含已过时事实 | 新窗口 |
| 3 | **电池豁免真机验证** | 首次夜间长任务弹系统电池优化豁免弹窗；拒绝后生图不阻断 | 装机（46af4e5 已含） | 弹窗出现 + 拒绝后前台服务/WakeLock 仍生效 | 新窗口 |

### P2（视频玩具三前置 + 端到端）

| # | 项 | 目标 | 前置 | 验收标准 | 归属 |
|---|---|---|---|---|---|
| 4 | **断点续跑（引擎 checkpoint）** | sd.cpp 采样循环每 5 步 latent+sigma 落盘；被杀后从最近 checkpoint 续跑（最多重跑 5 步） | 引擎无 save/resume API（已审计）；需 JNI 导出接口 + 采样循环钩子（估 1-2 天） | 真机模拟杀进程后重启续跑，输出完整视频 | 新窗口 |
| 5 | **分段加载（双 ctx 交替）** | TE-only ctx 编码后释放 → DiT+VAE ctx 采样；峰值 4.8GB→~3GB（PSS 硬线内） | sd.cpp 公开 API 模块级构建（内部已按 TE/DIFFUSION/VAE 分模块，需小改） | 加载/采样两阶段 PSS 峰值均 <4GB | 新窗口 |
| 6 | **HyperOS 白名单人工引导 UI** | App 内引导页：「电池省电→不限制」+「最近任务锁定」操作指引 | 系统弹窗已落地（§78）；此为人工步骤引导 | 引导页可达 + 步骤截图可对照 | 新窗口 |
| 7 | **Wan 2.1 1.3B 端到端** | 模型推机（DiT Q4 ~1GB + UMT5 Q3 ~3GB + VAE ~0.7GB）→ 夜间跑通一条 5s 480p 视频 = 跑分成功 | 项 4/5/6 完成 + SD_WEBM 开启 | 真机输出完整 WebM + 全程零被杀 + 断点续跑验证 | 新窗口 |

### P3（观望/备选）

| # | 项 | 目标 | 前置 | 验收标准 | 归属 |
|---|---|---|---|---|---|
| 8 | **LTX-Video 2B 备选评估** | 8 步蒸馏为速度路线唯一候选；若 Wan 端到端不可用则换 LTX 验证 | 项 7 结论为否时触发 | 对比 Wan 出片速度/质量 | 观望 |
| 9 | **触发条件监控** | Wan 2.x/LTX 系 ≤16 步蒸馏版且全链 ≤4GB 出现时重新评估（ONDEVICE_VIDEO_GEN_ANALYSIS §8） | 社区模型发布 | 条件满足即立项 | 观望 |

### P5（专业跑分面板升级，✅ 已落地：PERF_BENCHMARK_DESIGN v0.3，待真机验证）

| # | 项 | 目标 | 前置 | 验收标准 | 归属 |
|---|---|---|---|---|---|
| 18 | **P1 数据扩展** | ✅ HardwareInfoModule 六指标 sysfs 探测（CPU/GPU 频率、GPU 负载、温度分区、功耗）+ TS spec | 无 | K90：GPU 负载>0、温度分区有值、功耗可读或 N/A（待真机） | ✅ 已落地 |
| 19 | **P2 面板升级** | ✅ PerfPanel 横版化（折叠头胶囊行 + 叠加线切换 + 横向指标行 + 设备小字 + 历史入口） | 项 18 | 真机：卡片内不溢出 + 叠加线可切换（待真机） | ✅ 已落地 |
| 20 | **P3 落盘 + 历史** | ✅ perfRecorder JSONL（begin/append/finish + 50 条保留）+ store 生命周期接线 + Modal 列表 | 项 19 | 真机：任务结束文件存在 + 历史列表可见（待真机） | ✅ 已落地 |
| 21 | **P4 回放 + 跑分卡** | ✅ PerfHistoryModal（播放光标/统计卡）+ perfScore 分数体系（内存安全/温控/稳定性） | 项 20 | 真机：回放曲线与实时一致 + 跑分卡展示（待真机） | ✅ 已落地 |

### P4（链路排查欠账，2026-08-23 审计 · 来源：[POCKETPAL_CHAIN_AUDIT_20260823](./POCKETPAL_CHAIN_AUDIT_20260823.md)）

| # | 项 | 目标 | 前置 | 验收标准 | 归属 |
|---|---|---|---|---|---|
| 10 | **搜索精简收口（开放环）** | ✅ 内置 Bing+Wikipedia 复合引擎已落地（2026-08-24 整合提交在案，原提交 35f3ede） | — | 已闭环 | ✅ |
| 16 | **跑分面板真机复验（三修后）** | v0.4 三修（轮询根治+加宽+换行）真机验证：驻留态 generate 时跑分卡实时数据不再 `--`、卡片宽度不超预览卡、底行 7 指标+历史按钮全可见 | 重打包装机（K90） | 截图取证：生成中跑分卡数值跳动 + 底行完整 + 宽度合规 | 新窗口 |
| 11 | **TTS 三引擎切 hf-mirror 镜像** | constants.ts L33/97/120/137 huggingface.co → hf-mirror.com（对齐 asrEngine.ts） | 无 | 真机下载 TTS 模型成功 | 新窗口 |
| 12 | **文档销账 7 项** | B11/B12/B37/§7 挂账/视频陈述/矩阵口径/变更日志（见审计 §五） | 无 | 七项账实一致 | 新窗口 |
| 13 | **WS-1 写作项目 tab** | KnowledgeScreen Tab 枚举补 writing + 列表页 | 写作产物已落盘 | 写作产物可见可进 | 新窗口 |
| 14 | **B10 图标硬编码收口** | components 下 ≥18 处 size={2x} 改 iconSize token（ChatInput 6 处） | token 已建 | grep 零残留 + tsc/jest 绿 | 新窗口 |
| 15 | **TTS 全文朗读收口** | 全文朗读 API + 长按菜单项（UI_INTERACTION §7） | 项 11 | 长按消息可全文朗读 | 新窗口 |
| 16 | **InfoDialog 统一** | 约 20 文件多套弹窗收编一套（UI_INTERACTION §7） | 无 | InfoDialog 全域唯一 + 旧组件删除 | 新窗口 |
| 17 | **P1 单槽 v2 + P3 肥文件拆分** | engineMutex 生图槽⇒管家联动；ModelStore 3736 行等三肥件拆分 | 架构评审 | PRODUCT_SPEC §6.2 销账 | 择期 |

## 关联

- [ONDEVICE_VIDEO_GEN_ANALYSIS.md](./ONDEVICE_VIDEO_GEN_ANALYSIS.md)（分析依据：§7 玩具专项 / §8 触发条件）
- MASTER_LOG §75-79（已完成批次登记，docs/internal/ 留档）
- [ADR-0008](./adr/ADR-0008-benchmark-style-monitor.md)（跑分面板立项，docs/adr/ 留档）
- [PERF_BENCHMARK_DESIGN](./PERF_BENCHMARK_DESIGN.md)（专业跑分面板设计 v0.1：四阶段 P1-P4 + 原型图）
- [POCKETPAL_CHAIN_AUDIT_20260823.md](./POCKETPAL_CHAIN_AUDIT_20260823.md)（P4 批次审计依据：欠账 7 / 销账 7 / 开放环 1）
