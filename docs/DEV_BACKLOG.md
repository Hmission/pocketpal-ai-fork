# 待开发清单（DEV_BACKLOG）

> 状态：active | 更新：2026-09-07
> 用途：跨窗口待开发项唯一登记处（任务接力清单）。每项含目标 / 前置 / 验收 / 归属。
> 约定：完成一项即标记 ✅（含 commit），删除前先确认无引用。

## 已完成批次（对照参考）

| 批次 | 内容 | 状态 |
|---|---|---|
| ADR-0008 跑分面板（§75） | PerfPanel PSS/CPU/温度监控 + HardwareInfo 扩展 | ✅ `1535af3` |
| 夜间长任务模式（§76） | 前台服务 + PARTIAL_WAKE_LOCK + AppState 反转 | ✅ `0102b4e`（真机实测 isForeground/WakeLock） |
| DRC 编排对齐 + 电池豁免（§77/§78） | generateDreamLite 同链路 + REQUEST_IGNORE_BATTERY_OPTIMIZATIONS 引导 | ✅ `46af4e5` |
| 记忆时效性三闸（§79） | 写入排除 + 召回免责前缀 + 蒸馏删除指令 | ✅ `aaca505`（真机 G5 待批，见下） |
| 跑分面板真机复验（三修后，P4#16 原账） | v0.4 三修（轮询根治+加宽+换行）真机验证：驻留态 generate 时跑分卡实时数据不再 `--`、卡片宽度不超预览卡、底行 7 指标+历史按钮全可见 | ✅ 2026-08-25 K90 真机通过（截图取证在案，账销） |

## 待开发项

### P1（先做：收尾验证类）

| # | 项 | 目标 | 前置 | 验收标准 | 归属 |
|---|---|---|---|---|---|
| 1 | **跑分面板 UI 视觉真机实测** | PerfPanel 在生成/加载中真实可见：**默认展开**（已修，§82）、PSS 大字跳动、折线/CPU/温度/步耗时 1Hz 刷新、>5GB 橙 >6GB 红阈值色 | 投屏（.tmp/scrcpy/）+ 大王监督；加载任一模型或出图触发 | 截图取证 3 态（正常/橙/红）+ 数值跳动 + MASTER_LOG 补登 | ✅ 2026-08-25 K90 验证已过（CHANGELOG 基准套件真机全链路）+ 2026-08-26 复查销账 |
| 2 | **记忆三闸真机 G5 验证** | K90 治理按钮验证污染库蒸馏清除 + 新会话 web_search 不复读旧闻/失败状态 | 重打包（aaca505 已含） | 污染条目消失 + 新会话回答不含已过时事实 | 新窗口 |
| 3 | **电池豁免真机验证** | 首次夜间长任务弹系统电池优化豁免弹窗；拒绝后生图不阻断 | 装机（46af4e5 已含） | 弹窗出现 + 拒绝后前台服务/WakeLock 仍生效 | 新窗口 |
| 31 | **W5/W6 可感知项真机目视**（2026-09-07 挂账：本窗 `adb devices` 为空，契约测试已钉住输出，缺目视一遍）| 装机后目视四项：① 生图队列面板条目徽章显示 `SD3.5` / `Z-Image`（不再出现小写族键）② 吸底胶囊与「开始队列」按钮都是同一格式「N 项 · M 抽」③ 跑分横幅/HUD 三赛道名正常 ④ 音频工坊步数 chip 六档 `1/2/3/5/10/20` 正常 | 装机（含 `0caf0cc` 及之后提交）| 四项各拍一张截图 + MASTER_LOG 补登 | 接机后的窗口 |

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

### P5（专业跑分面板升级，✅ 已落地 + 真机已过：PERF_BENCHMARK_DESIGN v1.3）

| # | 项 | 目标 | 前置 | 验收标准 | 归属 |
|---|---|---|---|---|---|
| 18 | **P1 数据扩展** | ✅ HardwareInfoModule 六指标 sysfs 探测（CPU/GPU 频率、GPU 负载、温度分区、功耗）+ TS spec | 无 | K90 真机复验已过（B40-B43 演进后 v1.x 终态） | ✅ 已落地 |
| 19 | **P2 面板升级** | ✅ PerfPanel 横版化 + B40-B43 演进（坐标轴/复合图/演出层/三修） | 项 18 | 真机复验已过（08-25 截图在案） | ✅ 已落地 |
| 20 | **P3 落盘 + 历史** | ✅ perfRecorder JSONL + B42 聊天页统一回放（chat-turn 标签） | 项 19 | 落盘契约测试全绿；真机已过 | ✅ 已落地 |
| 21 | **P4 回放 + 跑分卡** | ✅ PerfHistoryModal + perfScore + B41 跑分仪式 + B43 坐标轴 | 项 20 | B39-B43 门禁全绿 + 真机已过 | ✅ 已落地 |

### P4（链路排查欠账，2026-08-23 审计 · 来源：[POCKETPAL_CHAIN_AUDIT_20260823](./POCKETPAL_CHAIN_AUDIT_20260823.md)）

| # | 项 | 目标 | 前置 | 验收标准 | 归属 |
|---|---|---|---|---|---|
| 10 | **搜索精简收口（开放环）** | ✅ 内置 Bing+Wikipedia 复合引擎已落地（2026-08-24 整合提交在案，原提交 35f3ede） | — | 已闭环（遗留孤儿文件见 #18） | ✅ |
| 11 | **TTS 三引擎切 hf-mirror 镜像** | constants.ts L33/97/120/137/168 huggingface.co → hf-mirror.com（对齐 asrEngine.ts） | 无 | 真机下载 TTS 模型成功 | **2026-08-25 落码** |
| 12 | **文档销账 7 项** | B11/B12/B37/§7 挂账/视频陈述/矩阵口径/变更日志（见审计 §五） | 无 | 七项账实一致 | **2026-08-25 落码** |
| 13 | **WS-1 写作项目 tab** | KnowledgeScreen Tab 枚举补 writing + 列表页 | 写作产物已落盘 | 写作产物可见可进 | **2026-08-25 落码** |
| 14 | **B10 图标硬编码收口** | components 下 ≥18 处 size={2x} 改 iconSize token（ChatInput 6 处） | token 已建 | grep 零残留 + tsc/jest 绿 | **2026-08-25 落码** |
| 15 | **TTS 全文朗读收口** | 全文朗读 API + 长按菜单项（UI_INTERACTION §7） | 项 11 | 长按消息可全文朗读 | **2026-08-25 落码** |
| 16 | **InfoDialog 统一** | 约 20 文件多套弹窗收编一套（UI_INTERACTION §7） | 无 | InfoDialog 全域唯一 + 旧组件删除 | **2026-08-25 落码** |
| 17 | **P1 单槽 v2 + P3 肥文件拆分** | engineMutex 生图槽⇒管家联动；ModelStore 3736 行等三肥件拆分 | 架构评审 | PRODUCT_SPEC §6.2 销账 | 择期 |
| 18 | **孤儿文件清理（2026-08-25 审计新增）** | `src/components/SearchProviderKeySheet/styles.ts` 全仓库零引用、组件主体已删（搜索精简的残留孤儿） | 无 | 文件删除 + git 干净 | **2026-08-25 落码** |

### P6（聊天体验极限化，2026-08-26 大王裁定「探索上限」）

| # | 项 | 目标 | 前置 | 验收标准 | 归属 |
|---|---|---|---|---|---|
| 19 | **上下文策展极限化** | 策展表重排（4B→16384/2B→32768/1B→32768 等）+ 设备感知预算 `resolvePssSafeBudget`（可用内存口径上限 9GB）+ `CURATED_TABLE_VERSION` 版本化拉齐 + `recommendNCtx` 死代码删除 | 无 | tsc 0 错 + jest 全绿 + K90 真机各档加载 PSS 实测 ≤ 设备预算 | **2026-08-26 落码 + 真机验证通过**（n_ctx=16384 原生铁证 + 加载 4.15GB/推理后 4.74GB 全程存活） |
| 20 | **压缩大块化** | `COMPACT_TARGET_WATERMARK=0.5`（触发 0.8 → 压到半水位）+ 摘要输入预算上限 6000→12000 + `TOOL_BASELINE_TOKENS=4500` 常量与策展断言 | 项 19 | 16K 档连续 10+ 轮触顶仅 1 次压缩；摘要一次吃下压到半水位的 slice | **2026-08-26 落码**（多轮压缩触发实测转观察项：单轮含思考耗时 5.6min，10+ 轮成本过高；逻辑推算 16K 余量 ≈ 20+ 轮） |

### P7（祖传债与明确不做，2026-09-07 来源：[POCKETPAL_CHAIN_AUDIT_20260907](./POCKETPAL_CHAIN_AUDIT_20260907.md) W6）

审计定的口径：**只登记不扩面**。本波唯一动的一处祖传代码已动（项 25）；其余均为
「知道它在，但不顺手改」的债，需专项才能接。禁止以「反正登记了」为名义去改引擎层。

| # | 项 | 目标/现状 | 前置 | 验收标准 | 归属 |
|---|---|---|---|---|---|
| 25 | **`find(id)` 区分「不存在」与 DB 真故障**（本波已落） | 旧写法 10 处 `find(id).catch(() => null)` 把两件事折成一个 null：`removeMessagesFromId` 在 DB 读故障时走 `updatedSession?.messages \|\| []`，**把用户的聊天记录在屏上清空而 DB 未动**；`deleteSession` 故障时静默 return、store 照样删列表项。现收为单点 `notFoundOk(table, id)`：不存在→null（静默），其他异常→落 DRC 事件流 `db.findFault` + 抛出 | 无 | 4 条新单测钉住（not-found/真故障抛+上报/非法 id 不当不存在吞/mock resolve undefined 仍算不存在）；仓库 24 测全绿 | ✅ 2026-09-07 本窗落码 |
| 26 | **DB 故障的用户可见出口**（项 25 的尾巴） | 抛出后：读/删路径的调用者已在 try/catch 内（performLoadSessionList / loadSessionMessages / deleteSession / bulkDeleteSessions / createNewSession）；但 4 处乐观写入（`setSessionIntentFor` / `updateSessionTitle` / `updateSessionSettingsSource` / `setActivePal`）与 `ChatView` 未 await 的 `removeMessagesFromId` 无 catch → 故障仅进日志与事件流，用户无提示 | 需新增错误文案与 UI 出口（至少 2 条 l10n 键×16 语） | 故障时用户看得到「保存失败，重启后可能回到旧值」，不静默 | 择期（本波不做：造 6 处新文案属扩面） |
| 27 | **跑分页国际化与 28 个闲置 `benchmark.*` 键** | 跑分页大量中文硬编码（段位名/回放标题等），同时 28 个已翻译键零消费者——属“该接线未接线”而非可删死键 | 产品先定跑分页是否进 16 语 | 逐键裁定：接线或删除（删不得反悔，16 语共 400+ 行） | 择期；取证脚本与陷阱见 PERF §10.7 挂账 |
| 28 | **`BenchmarkResult.uuid` 写而不读** | 每例 `uuidv4()` 入库并持久化，全仓唯一读者是已删的 `markAsSubmitted`（云提交残留） | 改已落盘记录形状需同步 5 个夹具 + orchestrator | 字段删除且旧记录不致炸（JSON 多余键可忽） | 择期（独立小宗） |
| 29 | **两处并存的用户设置 `supertonicSteps`** | `ttsStore.supertonicSteps`（播报链）与 `audioStore.supertonicSteps`（工坊生成链）各自可变，无文档裁定是否刻意；本波只做到共读同一默认值常量，**未合并** | 产品裁定（合并会改变用户已有设置行为） | 要么写明“两个链路各自调档”，要么收单一设置源 | 择期 |
| 30 | **fork 债（登记不排期）** | ① `HFStore` 空结果节流；② `loadReleaseMethods` 路径探测兜底；③ ChatView `istanbul ignore` 群；④ `theme: any`（`ImageGenScreen/styles.ts` 旧签名，它曾吞下 token 面漂移——类型面已收，签名待改）；⑤ `dreamLiteEngine` 11 处 `as any`（引擎契约未类型化，碰它=碰引擎禁区）；⑥ core 域四采集零消费者（`readStarmap`/`readIterations`/`readEmotions`/`WakeCheckResult`，仅测试引用，属采集侧双标） | ④ 需全仓 `useTheme()` 调用点体检；⑥ 需 SPEC 标注“供未来消费”或按无消费方裁剪 | 各自单项闭环，不捆做 | 观望（明确不排期） |

## 关联

- [ONDEVICE_VIDEO_GEN_ANALYSIS.md](./ONDEVICE_VIDEO_GEN_ANALYSIS.md)（分析依据：§7 玩具专项 / §8 触发条件）
- MASTER_LOG §75-79（已完成批次登记，docs/internal/ 留档）
- [ADR-0008](./adr/ADR-0008-benchmark-style-monitor.md)（跑分面板立项，docs/adr/ 留档）
- [PERF_BENCHMARK_DESIGN](./PERF_BENCHMARK_DESIGN.md)（专业跑分面板设计 v1.3：B40-B43 演进 + 真机复验已过）
- [POCKETPAL_CHAIN_AUDIT_20260823.md](./POCKETPAL_CHAIN_AUDIT_20260823.md)（P4 批次审计依据：欠账 7 / 销账 7 / 开放环 1）
