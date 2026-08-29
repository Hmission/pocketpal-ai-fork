# 专业跑分面板设计（PERF_BENCHMARK_DESIGN）

> 状态：**v1.3 UI 一致性升级（叠图迷你遥测条 / PerfMiniRow 共享 / 聊天页 B43 同步 / 容器自适应）** | 版本：1.3 | 2026-08-27
> 定位：生图/视频「跑分软件」玩法升级——从 4 指标实时面板 → 专业多维跑分 + 数据落盘回放
> 方法论：写轮眼（同行调研）+ 自学习（内部基线实证）
> v0.2：面板形态修正——嵌于预览卡片下半截的**横版紧凑布局**（md 图表，弃竖状全屏/图片原型）
> v0.4（2026-08-24 三修）：①实时数据恒 `--` 根治——`syncPoll()` 挂入 `nightTaskReaction`（`loading||generating` 翻转处），一处覆盖 DreamLite generate/edit/upscale/caption 驻留态入口（原手动调用模式在驻留态从不触发轮询）；②卡片加宽（`taskPage` padding 16→10）；③底行显示不全根治——指标行横向 ScrollView → `flexWrap` 换行网格（4 项/行×2 行）

---

## 一、目标

1. **面板专业化**：从「PSS/CPU/温度/步耗时」4 指标 → 10+ 指标（CPU/GPU/NPU/内存/温度细分/功耗/频率）
2. **数据落盘**：每次任务完整性能轨迹落盘（JSONL），可跨会话回放
3. **回放查看**：历史任务列表 + 曲线回放 + 统计摘要 + 跑分卡
4. **跑分灵魂**：任务级分数体系（安兔兔式综合分），历史可对比

## 二、写轮眼：同行性能测试软件面板调研（2026-08-23）

| 软件 | 面板设计要点 | 可借鉴 |
|---|---|---|
| **安兔兔** | 五维测试（CPU/GPU/MEM/UX/稳定性）+ 模块化设备信息卡（37 项参数）+ 实时监控 18 项运行指标（帧率/温度曲线）+ PDF 报告 | 设备信息卡 + 多维实时指标行 + 综合分 |
| **Geekbench 6** | 单核/多核分数 + Compute Benchmark（GPU 计算）+ 保存数据/图表化报告 + 机型对比排行 | 分数体系 + 历史对比排行 |
| **3DMark** | 压力测试：FPS 曲线 + 温度曲线 + 稳定性百分比 | 曲线 + 稳定性指标（峰均比） |
| **PerfDog** | 功耗/能效比曲线（CPU/GPU 功耗分项）+ 空载对比基线 | 功耗维度（电池 current×voltage） |
| **AIDA64/DevCheck** | 传感器面板：CPU 各核频率/温度 + GPU 频率/负载 + NPU 型号（不显示利用率） | **NPU 诚实展示模式**（型号可见、利用率无标准 API） |

**核心共识**：专业面板 = 多维实时数据 + 时间曲线 + 历史落盘回放 + 分数/对比。当前 PerfPanel 缺：GPU/NPU 维度、频率、功耗、落盘、回放、分数。

## 三、自学习：内部基线实证

### 3.1 已有能力（HardwareInfoModule 实证）

| 能力 | 现状 |
|---|---|
| PSS/RSS/CPU%/温度 | ✅ getPerfSnapshot（1Hz，PSS 与 HyperOS 硬杀同口径） |
| GPU 型号/厂商 | ✅ getGPUInfo（GL_RENDERER，已有 hasAdreno/hasMali 判定） |
| CPU 核数/最大频率/特性 | ✅ getCPUInfo |
| SoC 型号 | ✅ Build.SOC_MODEL |
| 1Hz 轮询链路 | ✅ imageGenStore.pullSnapshot + syncPoll |
| 落盘基建 | ✅ RNFS + AIOS/logs（errorReport 先例）+ WatermelonDB |

### 3.2 缺口与数据源（平台探测 + N/A 降级）

| 指标 | 数据源 | 可用性 | 备注 |
|---|---|---|---|
| **GPU 负载%** | `/sys/class/kgsl/kgsl-3d0/gpubusy`（busy/total 两列比值）| Adreno ✅ | Mali/MTK：`/sys/class/devfreq/*.gpu/load` 或 `/proc/mali`（2026-08-29 节点名放宽含 kgsl/mali——MTK 节点如 `13000000.mali` 不含 "gpu"，旧匹配漏探致 K Pad GPU 读不到） |
| **GPU 频率** | kgsl `gpuclk` / kgsl `devfreq/cur_freq` / `/sys/class/devfreq/*/cur_freq` 多源候选 | Adreno ⚠️ | 逐源轮换：骁龙 8 Gen 2+ 实测 `gpuclk` 受限/恒 0（K90 复现），命中 0 自动换 `cur_freq`；Mali/MTK：devfreq cur_freq |
| **CPU 实时频率** | `/sys/devices/system/cpu/cpuN/cpufreq/scaling_cur_freq` | ✅ 通用 | 取最大核频率（大核代表） |
| **温度细分** | thermal_zone*/type 区分 cpu/gpu/battery 三区 | ✅ 通用 | 现在只取最大，升级为分区分取 |
| **功耗** | `/sys/class/power_supply/battery/current_now`×`voltage_now` 多源链：current_avg→其它节点（main/bms/fg_*）→power_now 直读 | ⚠️ 部分设备可读 | 2026-08-29 增强：K90/HyperOS 实测 battery/current_now 常为 0/受限→恒 -1；任一源有效即返回，全败 N/A（PerfDog 玩法） |
| **NPU 利用率** | **无标准 API**（QNN/NeuroPilot 需厂商 SDK） | ❌ | 诚实模式：设备卡显示 NPU 型号（SOC_MODEL），实时区显示「—」+ 说明 |

**原则**：每个新指标 = 平台探测 + 失败 N/A 降级（不报错不兜底文案），与现有 perf 链路同哲学。

## 四、数据模型

### 4.1 PerfSnapshot v2（实时）

```ts
interface PerfSnapshotV2 {
  pssKb: number; rssKb: number;          // 内存（已有）
  cpuPct: number; cpuFreqMhz: number;    // CPU 占用 + 大核频率
  gpuLoadPct: number; gpuFreqMhz: number;// GPU 负载 + 频率（N/A=-1）
  tempC: number;                          // 整机最大（已有）
  tempCpuC: number; tempGpuC: number;     // 分区温度（N/A=-1）
  powerMw: number;                        // 功耗毫瓦（N/A=-1）
  stepTime: number;                       // 已有
}
```

### 4.2 落盘格式（任务级 JSONL）

路径：`<DocumentDirectory>/perf/perf_<taskId>.jsonl`（RNFS，与 errorReport 同基建）

```jsonl
{"ts":1786330000,"pssKb":4200000,"cpuPct":87,"cpuFreqMhz":3200,"gpuLoadPct":76,"gpuFreqMhz":840,"tempC":41.2,"tempCpuC":43.1,"tempGpuC":40.5,"powerMw":6200,"stepTime":12.3,"stage":"采样 3/8"}
```

任务元信息（首行 `#meta` 注释或同目录 `perf_<taskId>.json`）：taskId / 模型 / 任务类型（gen/edit/caption） / 起止时间 / 总耗时 / 结果（success/failed）。

### 4.3 跑分卡（分数体系，Phase 4）

```
综合分 = Σ wᵢ × 分项（0-100）
  分项1 内存安全：PSS 峰值距离硬杀线的余量率（6GB 线，>5GB 扣分）
  分项2 速度：1/平均步耗时（按模型基线归一）
  分项3 温控：1/温度爬升率（起点→峰值）
  分项4 稳定性：1/峰均比（3DMark 式）
```

每次任务产出跑分卡（含分项），历史按综合分排行（Geekbench 式对比）。

## 五、架构

```
┌─ 采集（原生 1Hz，HardwareInfoModule 扩展）─────────────┐
│ getPerfSnapshotV2：PSS/RSS/CPU/GPU/温度分区/功耗/频率    │
└──────────────┬──────────────────────────────────────┘
               ▼
┌─ 编排（imageGenStore.pullSnapshot 同频）────────────────┐
│ perfV2/perfHistoryV2（内存 60 点，已有模式）            │
│ PerfRecorder：任务开始建文件 → 每点 append → 结束 flush │
└──────────────┬──────────────────────────────────────┘
               ▼
┌─ 落盘（RNFS JSONL）→ 回放（PerfHistoryScreen）─────────┐
│ 历史列表（模型/时长/PSS 峰值/综合分）→ 点开曲线回放     │
│ 曲线区：PSS 主图 + CPU/GPU/温度/功耗多线叠加可切换      │
│ 统计卡：峰值/均值/稳定性 + 跑分卡（Phase 4）            │
└─────────────────────────────────────────────────────┘
```

## 六、UI 原型（预览卡片下半截 · 横版紧凑）

**形态约束**：面板嵌于 ResultPreview 进度卡下半截（进度信息下方），空间=屏宽 × 约 180-220pt——设计为**横版两行**：折叠头一行 + 展开体一行指标 + 一条迷你曲线。

### 6.1 折叠头（一行，常驻）

```
┌──────────────────────────────────────────────────────────┐
│ 性能 ▾  4.2 GB  ▏CPU 87% GPU 76% 42°C 6.2W              │
└──────────────────────────────────────────────────────────┘
  PSS大字(阈值色)   ▏实时指标胶囊(横排)      （v1.2 去设备小字行：不显 SoC）
```

- PSS 大字 + 阈值色（>5GB 橙 / >6GB 红）为**主视觉**，其余指标压缩为胶囊横排
- 设备小字已去除（v1.2 大王裁定不显 SoC）；NPU 无标准 API 诚实省略

### 6.2 展开体（下半截空间内，两区块）

```
┌──────────────────────────────────────────────────────────┐
│ PSS 4.2GB  ▁▂▃▄▅▆▇████▇▆▅▄▃▂▁▏6.0G限  峰值 4.9GB 88分 │
│ CPU 87% · GPU 76% · 3.2GHz · 42°C · 6.2W · 步12.3s      │
│ [叠加:CPU][GPU][温度][功耗]                    [历史 ▷]  │
└──────────────────────────────────────────────────────────┘
   迷你曲线条(横向主图,6GB满量程)      ▏统计(峰值/跑分卡)
   指标行(横向滚动,含频率/功耗)         ▏叠加线切换 + 回放入口
```

- **迷你曲线条**：PSS 历史曲线（60 点，横向压扁到 ~40pt 高），右端接峰值/跑分卡数字
- **指标行**：横向排列 CPU%/GPU%/频率/温度/功耗/步耗时，放不下横向滚动（FlatList horizontal，与音频历史条同模式）
- **叠加线切换**：迷你曲线上叠加 CPU/GPU/温度/功耗线（点按切换，曲线重绘）
- **[历史 ▷]**：进回放页入口（历史任务列表 + 曲线回放）

### 6.3 回放页（PerfHistoryScreen，独立页不受卡片约束）

任务列表（模型/时长/PSS 峰值/综合分摘要行）→ 点开 = 静态全览曲线 + 播放按钮（逐点动画）+ 拖动时间轴 + 统计卡 + 跑分卡排行。

## 七、实施阶段

| 阶段 | 内容 | 前置 | 验收 |
|---|---|---|---|
| **P1 数据扩展** | HardwareInfoModule 扩展：GPU 负载/频率（kgsl+devfreq 平台探测）+ CPU 频率 + 温度分区（cpu/gpu/battery）+ 功耗探测；PerfSnapshotV2 | 无 | 真机 K90：GPU 负载>0、温度分区有值、功耗可读或 N/A 降级 |
| **P2 面板升级** | PerfPanel 横版化：折叠头一行（PSS 大字 + 胶囊指标）+ 展开体（迷你曲线条 + 横向指标行 + 叠加切换 + 设备小字 SoC/GPU/NPU）+ 历史入口 | P1 | 面板显示 GPU/频率/功耗；叠加线可切换；卡片下半截内不溢出 |
| **P3 落盘 + 历史** | PerfRecorder（JSONL 任务级落盘）+ 历史列表页（摘要行） | P2 | 任务结束文件存在且可读；历史页列出任务 |
| **P4 回放 + 跑分卡** | 回放页（曲线播放/拖动/统计卡）+ 分数体系（内存安全/速度/温控/稳定性综合分）+ 排行 | P3 | 回放曲线与实时一致；跑分卡可对比多任务 |

**零新依赖红线**：全部 RN View 自绘 + Android sysfs/系统 API；不引入图表库。

## 八、风险与边界

- **GPU 数据源平台差异**：Adreno（kgsl）✅ / Mali（devfreq/proc/mali）⚠️ / 其他 ❌ → 平台探测（已有 hasAdreno/hasMali）+ N/A 降级
- **功耗读取限制**：部分设备 SELinux 拦截 → 探测 + N/A
- **NPU 无标准 API**：诚实模式（型号可见 + 说明），不编造利用率
- **文件体积**：1Hz × 10+ 字段 ≈ 200B/点；10 分钟任务 ≈ 120KB——可接受；历史保留策略（最近 N 条，超出清理）
- **与现有 PerfPanel 兼容**：PerfSnapshot v2 向后兼容（v1 字段保留），PerfPanel 增量扩展

## 九、关联

- [IMAGEGEN_UI_SPEC §9](./POCKETPAL_IMAGEGEN_UI_SPEC.md)（现状 4 指标面板，本设计为其专业版）
- [DEV_BACKLOG](./DEV_BACKLOG.md)（项 1 面板实测，本设计为扩展项）
- [ONDEVICE_VIDEO_GEN_ANALYSIS §7](./ONDEVICE_VIDEO_GEN_ANALYSIS.md)（玩具定位依据）

## 十、演出层升级与基准测试总控（v0.5，2026-08-24 大王裁定）

> 产品洞察：跑分是安慰剂，**过程才是药效**——手机性能过剩，用户跑分买的是「我的手机很厉害、我很有眼光」的自我确认。数字要动、图谱要帅、色彩要丰富。分享不发公网，能发朋友圈即可。
> 本章为 W2-W6 执行 SSOT；经 6D 洋葱排查（UI→状态→执行→协议→回传→模型）收敛，零新建 store、零新协议。

### 10.1 6D 排查结论（锋利裁剪依据）

| 层 | 发现 | 收敛决策 |
|---|---|---|
| D1 UI | 入口=设置页入口中心（`settings-item-benchmark`）；抽屉已是纯会话中心 | 入口不动 |
| D2 状态 | `BenchmarkStore` 已存在（mobx-persist-store） | 扩展不新建：瞬态编排字段不入持久化 `properties` |
| D3 执行 | ① 祖传 `bench()` 合成负载无头不可见，与「自动导航可见过程」裁定冲突；② `RNDeviceInfo.getUsedMemory` 与 NativeHardwareInfo PSS 双内存通道 | ① 砍 bench()+pp/tg 高级参数，用例=真实负载；② 统一 PSS 单通道 |
| D4 协议 | 云提交链：`api/benchmark.ts` + `uiStore.benchmarkShareDialog` + `submitted/markAsSubmitted` | 整体砍除（不发公网）；`BenchmarkResult` 扩展不新建类型 |
| D5 回传 | 诚实模式（N/A='--'）已就位 | 不动；旧版结果诚实标「旧协议」，不洗数据 |
| D6 模型 | 引擎层禁区（llama.rn / ONNX JNI） | 零触碰 |

### 10.2 演出红线（全局）

1. **升级不重造**：聊天页=`AssistantTurnFooter`（CHAT_UI_SPEC §18.2 双行）+`PendingIndicator`（§18.9）；生图页=`PerfPanel`（本文档 §6，预览卡片内不溢出）；基准页=`BenchmarkScreen` 原地改造。
2. **演出层不动数据层**：数值全部来自真实采集（1Hz PerfSnapshot / perfRecorder / perfScore），动效只做呈现；可夸张呈现、绝不造假。
3. **动画纪律**：一律 Animated JS driver（全局规范）；重渲染图谱（雷达/热力）500ms 节流门控；JS 帧 <16ms（G5 验收）。
4. **零新依赖**：自绘图表（RN View / 手绘路径），不引图表库/动效库。

### 10.3 统一数字动效引擎（PerfMotion，W2）

`src/components/PerfMotion/`（组件层，非 store），三页共用：

| 能力 | 规格 |
|---|---|
| AnimatedNumber | 300ms「追」式缓动插值（新快照到达后数值追赶真实值）；**保留真实毛刺**（不平滑抹抖，抖动=活着） |
| odometer 翻滚 | 关键大数字（综合分 / tok/s）逐位滚动 |
| 揭幕动画 | 0 狂飙→最终值（ease-out）→定住瞬间光圈 + `react-native-haptic-feedback`（复用现有依赖） |
| 首帧门控 | 速率类数字在首个有效事件（首 token / 首步）前显 `--`，不演假数 |

### 10.4 聊天页跑分感（W3，升级既有两面）

- **AssistantTurnFooter 行2**（指标行）：数值接 AnimatedNumber；tok/s 段加 24px 迷你速率条（跑分图示）；布局/分隔符/点按交互（ctx 直达、召回展开）不变。
- **PendingIndicator**（§18.9 监控卡）：阶段色（流式期信息蓝=info / 工具期紫=domain.tools，既有 token）+ 心跳微波形（5 根错峰小条，卡住/停止时平坦隐去——诚实）+ 工具期实时速率（toolCallTokenCount 差分 / 1s 既有心跳 interval，不新增定时器）；保留三点动画、300s 心跳卡住语义、run_failed 收尾。B57 阶段语义化：`reasoningPhase` 区分思考期（「正在思考…」）/回复期（「正在回复…」）——TTFT 长思考不再裸「生成中」；执行期保留工具名补业务标签（web_search→「正在联网搜索…」）；思考文本单一交给气泡 ReasoningBlock，跑分卡不重复。
  - **落地收敛（W3，B41/B57 修订）**：①流式期遥测卡常驻（B41 放开流式期门控，见 CHAT_UI_SPEC §18.9 v4.9），故阶段色收敛为二态（流式期蓝/工具期紫）、速率只在工具期差分成立后显示；②tok/s 主视觉归 footer 行2（完成态时序链），不造假场景。

### 10.5 生图页跑分感（W4，PerfPanel 留预览卡片内）

- 40pt 条形迷你图 → **折线 + 渐变面积图**（自绘，满宽贴卡片缘，峰值点打标）；卡片宽度/下半截高度红线不变。
- 全数字接 AnimatedNumber（PSS 大字/胶囊四指标/指标行七项）；胶囊按负载分档变色（>=60 橙逼近 / >=85 红危险，阈值色语义同源）。
- ~~步耗时迷你进度环~~ **落地收敛（W4）：砍除**——单步进度无分母数据，画环必造假（诚实红线）；步耗时接 AnimatedNumber 追式缓动已足够演出。
- 面积图阈值线：PSS 叠加时画 5GB 逼近线（橙虚线）+ 6GB 硬杀线（红虚线）——把「安全率」画进图里；`syncPoll`（v0.4 挂 nightTaskReaction）数据链路零改动。
- 横屏形态同步验证（面板为横版紧凑布局）。

#### 10.5.1 B43 坐标轴 + 复合图 + 演出层（2026-08-25 大王反馈收窄，v0.8）

- **坐标系**（PerfAreaChart 新 props `axes`；B43 时为避免聊天页零回归默认关，**v1.3（2026-08-27）起聊天页已同步开启**——PerfMiniRow/Footer 展开层同源码）：左 Y 刻度 4 档按维度单位（PSS→GB / 负载→%/温度→°C/功耗→W）+ 底部 X 时间刻度（1Hz 采样索引差=相对秒，不编造）+ 水平/垂直网格（hairline 淡）；阈值虚线端点加迷你标注 **5GB/6GB**——「虚线是什么意思」可读化（大王疑问实答：紫实线=功耗 #BA68C8，橙虚线=5GB 逼近线，红虚线=6GB 硬杀线）。
- **叠全改复合图**（解决 B40 五折线同屏糊 + PSS/温度同橙撞色）：PSS/功耗折线 + CPU/GPU 负载柱状（画布底部柱区，各自满量程）+ 温度热力带（画布底 2px 渐变带 30→60°C 绿→橙→红，30°C 复用 GPU 绿/45°C PERF_WARN/60°C error 三段插值，不造新色）——**不是所有通道都要折线**，按量纲分层呈现。
- **图例行**（叠全时）：色点+通道名一行（PSS/CPU/GPU/温度带/功耗），紫色线=功耗一眼可读。
- **演出层 vivid**（Animated JS driver 纪律，循环动画生命周期随组件卸载回收）：最新点呼吸光圈（1.7s 脉冲）+ 彗星尾（尾 8 点渐隐 + 尾 3 点加亮）+ 示波器扫掠光（3.4s 从左到右循环）——「超跑感」：数字狂飙（AnimatedNumber 已有）+ 曲线活体感 + 扫描节奏。
- **指标分级色全接入**：温度/功耗/CPU 频/GPU 频/步耗时全部两档阈值变色（阈值表登记 IMAGEGEN_UI_SPEC §9.2），正常继承中性色，不再全黑。
- **「叠全」chip 置最左**（默认项排最前）；chip 顺序：叠全→PSS→CPU→GPU→温度→功耗。

### 10.6 色彩扩编（登记 IMAGEGEN_UI_SPEC §9 语义色注册表）

| 色 | 值 | 语义 |
|---|---|---|
| CPU 青 | #4FC3F7 | 保留（已有） |
| GPU 绿 | #81C784 | 保留（已有） |
| 温度橙 | #F5A623 | 保留（PERF_WARN） |
| 功耗紫 | #BA68C8 | 保留（已有） |
| 速率强调色 | theme brandAccent | 新增：tok/s 迷你条/速率数字 |
| 跑分金 | **复用 brandAccent**（浅 #FFB300 / 深 #FFC54D，已有 token） | 综合分/段位主视觉——锋利裁定：不造新 token，避免与速率强调色双色分裂 |
| 阶段色 | **复用既有 token**：info（prefill 蓝）/ domain.tools（工具期紫） | 新增：PendingIndicator 阶段色条——锋利收敛：流式期监控卡隐藏故无第三态，不造新 token |
- 阈值语义不变：>5GB 橙 / >6GB 红（theme.colors.error）；深浅双模式验证；禁裸 hex 散落（全部登记）。

### 10.7 基准测试总控台（W5，改造 BenchmarkScreen + 扩展 BenchmarkStore）

**砍除清单（整体）**：`src/api/benchmark.ts`、`uiStore.benchmarkShareDialog`（字段+setter）、`submitted/markAsSubmitted`、分享提交 Dialog 链、`bench()` 调用 + 高级参数 Dialog/滑杆（pp/tg/pl/nr）、`RNDeviceInfo` 内存轮询；l10n 与测试同步清理。

**三用例（编排状态机在 BenchmarkStore 瞬态字段）**：

| 用例 | 场景 | 引擎 | 主指标 | 演出 |
|---|---|---|---|---|
| 推理速度 | 自动导航聊天页，固定 prompt 真实流式 | 现有时序链（metadata.timings） | tok/s + TTFT | 心电图波形 + 翻滚数字 |
| 生图速度 | 自动导航生图页，固定负载 | 现有 generate 链 | 步耗时 | 折线面积图 + 进度环 |
| 温控耐久 | 生图用例连跑 N 轮 | 同上 | 温升率/降频时刻 | 热力色带 + 可终止 |

- 随采指标：PSS 峰值/安全率/峰均比由 `perfRecorder` 伴随采集（**不单设内存用例**——锋利裁剪）。
- 自动导航横幅：「测试 N/3 · 切换 XX 赛道…」；被征用页顶部挂「基准测试进行中」HUD 条。
- 结果页：**四轴雷达**（= perfScore 四分：内存安全/速度/温控/稳定性，SSOT 不造新公式）→ 揭幕 → 综合分 → 段位（走地鸡/战斗鸡/神鸡）→ 跑分卡。
- 边界：与 e2e `BenchmarkRunnerScreen`（__E2E__ 独占，`benchmarkActive`）互不干涉；`start-test-button` / `settings-item-benchmark` testID 契约保留（e2e selectors 依赖）。
- `BenchmarkResult` 扩展：新增 `suiteCase/tokAvg/stepAvg/pssPeakKb/tempRise/scoreParts`；旧 pp/tg 字段可选保留，旧结果标「旧协议」（诚实，不洗数据）。
- **模型加载时长不入分**：用例直跑当前已加载模型；无模型时引导加载，加载时长单列显示。
- **温控耐久**：热量事前告知 + 随时可终止。

### 10.8 标准负载契约（全链只读；v0.7 真机血证三次修订）

| 项 | 值 |
|---|---|
| 聊天用例 prompt | 「用一段话介绍小黄鸡。」（固定，不改写不追加） |
| 聊天用例会话 | **新建「基准测试」会话**（旧会话历史上下文不可控：实测 3595 tokens 携带致 300s 超时） |
| 聊天用例思考模式 | **钉死关**（显式 completionSettings：enable_thinking=false + reasoning.enabled=false；同机思考开 >600s / 关 77s，override 不入会话参数是真机实证） |
| 聊天用例模型 | 当前已加载激活模型（不切换）；超时 600s |
| 生图用例引擎 | DreamLite，走 `generateDreamLiteEntry` 页面同源入口（自带按需加载，避免双引擎常驻预载） |
| 生图用例规格 | 512×512 · 4 步 · 无显式 seed（DreamLite flow matching 契约，页面同口径） |
| 耐久轮数 | N=3（温升采样起点→每轮结束） |
| 分数口径 | perfScore §4.3 公式（不新增分项；速度轴无同模型基线时诚实为 null，雷达置灰「—」） |

### 10.9 跑分卡分享（W6，全链路新建——全仓当前无 Share 通道，生图分享已移除）

- 卡面 = 设备型号 + 四轴雷达 + 分项 + 综合分 + 日期（**零用户内容**：无 prompt、无聊天文本）。
- 渲染：SVG → `src/services/pngUtil.encodePng`（既有纯 JS 编码）。
- 通道：RN 内置 `Share` + FileProvider（W6 前置验证门禁；不可行则降级存相册 + Snackbar 引导，诚实告知）。
- 成绩全部本地（benchmarkStore 持久化）：「别人的跑分偷你数据，我们的成绩只住你手机里」。

### 10.10 执行波次与指南针登记

| 波 | 内容 | 验收 |
|---|---|---|
| W1 | 本文档定稿 + COMPASS/星图登记 + CHAT_UI_SPEC/IMAGEGEN_UI_SPEC/DESIGN_SPEC 版本追加 | 文档治理无告警 |
| W2 | PerfMotion（AnimatedNumber + odometer + 揭幕）+ 单测 | G1+G2 |
| W3 | 聊天页（footer 行2 + PendingIndicator） | G1+G2 + 真机 token 流走查 |
| W4 | 生图页（折线面积图 + 全数字动效 + 色彩登记） | G1+G2 + 真机生图走查（卡片内不溢出） |
| W5 | 总控台（改造 + 编排 + 砍除清单） | G3+G4 装机 |
| W6 | 跑分卡分享 + G5 + MASTER_LOG/CHANGELOG/SPEC 闭环 + commit & push | 五关全绿 + 浅深双模式截图 |

- 指南针：新增 **CP-APP-012**（基准编排中断 / 跑分卡渲染失败 / 分享不可用）。
- 星图：新增 **benchmark 域**（总控台 + PerfMotion + 跨 chat/imageGen 编排）。

## 十一、B40 跑分仪式化升级（2026-08-25 大王裁定：过程才是药效，核心是跑分）

> 裁定背景：超跑感未全面落地——待回复卡太矮只有一行点点、完成后卡片消失、回复卡指标纯文本无图形、折线只有一层、预览卡高度有余量没用上；另卡片顶部描边被判 AI 风红线，已移除。
> 推送纪律（2026-08-25）：本地 commit 照常，**push 远端等大版本测试通过后统一推**，避免开源仓库中间态灾难。

### 11.1 本窗口已落地（B40 第一波）
1. **红线修复**：PendingIndicator 卡片顶部 2px 描边移除（AI 风装饰禁令）；阶段信息改由心跳波形/文案承载。
2. **GPU 负载/频率偶发 `--` 根治**：根因 = kgsl gpubusy 在 GPU 电源域切换瞬间偶发读失败/返 0 即降 -1；对策 = 原生侧 3s 防抖保持（最近有效值保持返回，传感器防抖非造假；从未读到才诚实 -1）——待重建真机验。
3. **折线多层叠加**：PerfAreaChart 支持 `series` 多规格（各自满量程归一 + 分色），PerfPanel 新增「叠全」chip：PSS/CPU/GPU/温度/功耗五层同屏（PSS 阈值线保留，N/A 点落底不编造）。
4. **预览卡纵向余量利用**：图表 60→88pt（真机验不溢出后再定是否继续加高）。
5. **OdometerNumber 落地复查结论**：已实现但**无消费点**（死代码风险）——B40 第二波接入待回复仪式卡与结果页大数字。
6. **像素跑分卡分享复查结论**：文本分享已真机验通；**图片附件走 file:// 未配 FileProvider**，图片能否附到分享面板存疑——列入欠账（方案见 11.4）。

### 11.2 第二波：待回复仪式卡（PendingIndicator 升级，聊天域）——**已落地（w2）**
目标：等待回复的每一秒都是跑分现场；完成后卡片不消失，折叠可展开。
- **形态三段**（单状态机，随 agentUiState.status 演进）：
  1. 模型加载中：加载阶段文案 + 百分比（modelStore.isContextLoading/loadingModel）；
  2. prefill/工具期：阶段标签 + 实时遥测行（PSS/CPU/温度，1Hz）+ 心跳波形 + 耗时；
  3. 完成：折叠为一行「本轮跑分摘要」（耗时 · tok/s · 峰值 PSS），点开展开本轮曲线。
- **数据链缺口（诚实披露）**：聊天域当前无按回合遥测采集（perfHistory 属 imageGenStore 单通道）——需新增 `chatTurnPerf`：回合开始→ 1Hz 采样→回合结束冻结为本轮轨迹（复用 PerfPoint 结构，不落盘不持久化，内存态随回合生命周期）。
- **红线**：无顶描边、无渐变光晕类 AI 风；仪式感只来自真实数据 + 动效节奏。
- **SSOT 约束**：AssistantTurnFooter 行2 文本指标不变（唯一事实源），仪式卡是运行态面，完成态归并到 footer 展开层（见 11.3）。

### 11.3 第三波：回复卡指标图形化展开（聊天域）——**已落地（w3）**
- AssistantTurnFooter 行2 保持文本为主，末尾加「▾ 图」展开钥：展开后内嵌迷你图表区（复用 PerfAreaChart：本轮 PSS/CPU 双层 + 峰值打标）。
- 数据来源 = 11.2 的 chatTurnPerf 本轮轨迹；无轨迹的旧消息诚实不显展开钥。
- tok/s 大数字接 OdometerNumber（消化 11.1-5 死代码）。

### 11.4 分享图片附件欠账方案（择一波次）
- 正解：Android FileProvider + content:// URI（需 android 资源声明 + RN Share url 改 content 协议）；落地前分享维持文本主带 + 图片落盘路径提示（诚实告知）。
- 不做：为了“能发图”而引入第三方分享库（零新依赖红线）。

### 11.5 验收口径（B40 整体）
- 真机（K90）：叠全渲染五层分色、GPU 无闪 `--`、图表 88pt 不溢出、待回复卡三段演进、完成后折叠可展开、分享面板带图。
- 门禁：tsc 0 / jest 全绿（除既有登记项）/ Gradle SUCCESS / 覆盖安装 / 浅深双模式截图。
- push 纪律：全部本地提交，大版本测试通过后统一推。
- **w2/w3 落地补充（2026-08-25）**：①待回复卡已接 1Hz 实时遥测行（内存/CPU/温度）+ 模型加载阶段行；②「完成后不消失」按 §11.2 归并决策实现：完成态收敛到 footer 展开层（▾ 图）而非监控卡驻留，避免双面板冗余；③chatTurnPerf 内存态服务落地（begin/finish/cancel，<2 点诚实返 null，采样失败跳过不造假），接线 run_started/finished/failed 三事件；④footer 展开层 = PSS+CPU 双层曲线（复用 PerfAreaChart series）+ 峰值/温升/采样点摘要 + tok/s OdometerNumber 翻滚（消化 §11.1-5 死码）；⑤门禁：tsc 0 + 新增 7 用例 + 受影响套件 266 全绿。
- **小米 13 真机终验（2026-08-25，红米平板已腾出）**：①聊天回合遥测实证：「count to 20」回合 footer 展开层完整渲染（峰值 2.1G · 温升 +0.0°C · 32 采样点 + tok/s 翻滚带）；②生图页生成中面板实证：DreamLite 按需自载 + 512×512 出图 52.7s/50.9s 两张，面板显示 PSS 7.6GB 红字 + 叠全 chip 在场 + 5/6GB 阈值虚线 + GPU 6% 非闪 `--`（3s 防抖生效）；③**跨设备阈值差异实证**：小米 13（15.2GB RAM）进程 PSS 7.6GB 未被杀，K90 实测 6291456kb（6GB）即硬杀——6GB 阈值线为 K90 口径，跨设备分级属未来校准项（不在此波改）；④管家直答路径无回合遥测（诚实正确，非缺陷）；⑤发现项：1B 管家对计数类任务退化复读（质量项，另立项）。

## 十二、B41 聊天域跑分仪式化（大王提醒：思考中 + 流式期也要跑分，跑分是本体）

> 裁定：等待的每一秒都是跑分现场。不仅生图页，聊天页的「思考中」与「流式输出」两段等待也要亮跑分。回答问题是附带赠品。
>
> **落地（三处，全部升级不重造，复用共享 `PerfAreaChart`）**：
1. **PendingIndicator 遥测卡升级**：单点遥测 → 滚动历史（最近 60 点）+ 迷你折线（复用生图页同款 `PerfAreaChart`，PSS 主图 + 5/6GB 阈值虚线）。等待期内存/CPU/温度 + 曲线同屏。
2. **流式期门控放开**：`isPending` 加 `streaming_text`——流式输出时遥测卡常驻（不再与 token 流互斥），隐藏仅限 done。
3. **管家直答接遥测**：管家直答绕过 agent 状态机，`butlerReply` 手动点亮 `status='prefill'` + 答完复位，同一张遥测卡也亮。
4. **依赖倒置根治**：`PerfAreaChart` 从 `screens/ImageGenScreen/components/` 迁到 `components/PerfAreaChart.tsx` 共享层，三处（生图页/待回复卡/回复卡展开层）统一引用，消除 components→screens 倒置。
>
> **真机验证（小米 13，人类模拟路径）**：①prefill 期遥测 + 折线在场（内存 1.9G · CPU 0% · -1°C + 蓝渐变折线）；②流式期遥测卡常驻；③回复卡「▲ 图」展开层完整渲染（7.1 tok/s 翻滚 + 峰值 2.0G · 温升 +0.0°C · 30 采样点 + 双层曲线：橙虚线+金 PSS 线+蓝 CPU 线）。
>
> **诚实口径**：温度 -1（tempC N/A）不造假显原值；采样失败跳过该点不插值；管家路径无回合遥测（非缺陷）。
>
> **门禁**：tsc 0 + 受影响套件 309 全绿（含 invariants 加 PendingIndicator 进 token 表面 allow-list）+ 全量除既有 modelCatalog/并行污染外全绿 + Gradle SUCCESS。

## 变更日志

| 日期 | 版本 | 变更 |
|------|------|------|
| 2026-08-29 | 1.4 | **K90 GPU 频率/功耗多源探测增强（大王报障：频率/功耗恒 --）**：①GPU 频率改多源候选链（kgsl gpuclk → kgsl devfreq/cur_freq → /sys/class/devfreq 全目录兜底），单源读数 0/受限自动轮换——骁龙 8 Gen 2+ gpuclk 受限恒 0（K90 复现）实锤；②devfreq 节点名放宽含 kgsl/mali（旧匹配仅含 "gpu"，MTK `13000000.mali` 漏探→K Pad 平板 GPU 负载/频率一并覆盖）；③功耗多源链（current_now→current_avg→其它 power_supply 节点 main/bms/fg_*→power_now 直读 mW），K90/HyperOS battery current_now 常 0/受限实锤；④首次探测路径 println 留痕供新窗口构建后 logcat 实证。门禁：Kotlin 层修改待新窗口 Gradle 构建后真机验证（本窗口不构建） |
| 2026-08-27 | 1.3 | **UI 一致性升级（大王五问裁定 + 真机复审三条）**：①**反推=生图流程**——反推/编辑/放大与生成同一路径：beginTask 后即滚入 running 空白任务页（taskPage 自适应）+ **完整 PerfPanel 默认展开**（叠图 overlay 全删：genOverlay/genOverlayEdit/genOverlayBottom 移除，旧 absolute 叠图与任务页双渲染内容叠加根治）；②**聊天页 B43 同步**——PendingIndicator 折线 44→56pt 双线+热力带+坐标轴+演出层（归一共享 `PerfMiniRow`，聊天域自适应形态保留），AssistantTurnFooter 展开层加 axes/tempBand/vivid（72pt）；③**容器自适应**——taskPage 去 overflow:hidden + 顶对齐 + minHeight 240，根治 PerfPanel 默认展开时内容超高双向裁切（顶部 WaveDots 被切）；④阈值/格式器抽取 `utils/perfTiers` 单一事实源（PerfPanel/PerfMiniRow/Footer 三方共用）；⑤**折叠层级平级**——高级参数折叠独立于提示词折叠；⑥顶部横幅去灰——BenchmarkHudBar 灰底 → 跑分金 brandAccent 12% wash + 文案居中。门禁：tsc 0 错 + 受影响 7 套件 178 用例全绿；真机（K90）：折叠/吸底大王确认通过，生成 running 页铁证（标题顶部完整不切 + PerfPanel 完整默认展开：性能 ▴ 4.8GB/CPU/GPU/61°C/峰值 5.5GB/指标行全在场） |
| 2026-08-25 | 1.2 | **生图页面板四修（大王真机反馈）**：①去 SoC 型号小字行（卡片变矮，底部被切根治）；②弃灰色底面板（shadow 5% 底）→ hairline 顶部细线分隔（与聊天页指标行同一分隔语言，透明融入预览卡）；③卡片加宽（taskPage padding 10→6）+ 字号收紧（PSS 大字 18→16、胶囊/标签 10pt、数值 11pt，胶囊内距 6→4，指标项宽 62→58）——手机端一行内容不再截切；④默认叠全（overlay 默认 'all'，五曲线分色同屏，chip 可切回单线）。另修复 jest 基建：modulePathIgnorePatterns 排除 .tmp（wt-klein 副本 __mocks__ 与根同名致 haste-map duplicate mock 拒绝运行）",
| 2026-08-23 | 0.1 | 首发：写轮眼同行调研（安兔兔/Geekbench/3DMark/PerfDog）+ 自学习缺口实证 + 四阶段方案 |
| 2026-08-23 | 0.2 | 面板形态修正：嵌于预览卡片下半截的横版紧凑布局（折叠头一行 + 迷你曲线条 + 横向指标行），弃竖状全屏图/图片原型，全 md 图表 |
| 2026-08-23 | 0.3 | **四阶段全部落地**（长链执行）：P1 HardwareInfoModule 六指标 sysfs 探测；P2 PerfPanel 横版化（胶囊行/叠加线/指标行/设备小字）；P3 perfRecorder JSONL 落盘 + store 生命周期接线；P4 PerfHistoryModal 回放（播放光标/统计卡/跑分卡）+ perfScore 分数体系。门禁：tsc 0 / jest 23 新增全绿 / Gradle SUCCESS；待真机验证（K90 GPU 负载/功耗读数 + 落盘回放） |
| 2026-08-24 | 0.4 | 三修：①实时数据恒 `--` 根治（syncPoll 挂入 nightTaskReaction）；②卡片加宽（taskPage padding 16→10）；③底行显示不全根治（flexWrap 换行网格） |
| 2026-08-24 | 0.5 | **演出层升级与基准测试总控规划定稿**（§10）：6D 排查收敛——零新建 store（扩展 BenchmarkStore）、砍 bench() 合成负载与双内存通道、砍云提交链、用例 4→3、雷达 4 轴对齐 perfScore；PerfMotion 统一动效引擎；标准负载契约；CP-APP-012 + 星图 benchmark 域登记；W1-W6 波次 |
| 2026-08-24 | 0.6 | **W1-W6 代码全部落地**：①PerfMotion 三件（AnimatedNumber 追式缓动首帧锚定不演假动画 / OdometerNumber 逐位翻滚 / ScoreReveal 揭幕狂飙+光圈+震动，三页共用；跑分金复用 brandAccent 不造新 token）；②聊天页 footer 行2 数值接动效 + tok/s 迷你速率条；PendingIndicator 阶段色条（info/domain.tools 二态）+ 心跳波形（卡住平坦）+ 工具期差分速率；③PerfPanel 折线渐变面积图（5/6GB 阈值虚线 + 峰值打标）+ 全数字动效 + 胶囊负载分档变色（砍步耗时环：无分母不画假环）；④总控台：benchmarkOrchestrator 三用例真实负载（复用 registerChatSender 槽 + imageGenStore.generate，零新链路）+ 四轴雷达 + 段位 + HUD 条（聊天/生图页挂载）；砍除链落地：api/benchmark.ts 删除、UIStore.benchmarkShareDialog 删除、bench()/高级参数/双内存通道删除、旧协议诚实标记；⑤跑分卡分享：纯 JS 像素光栅化（七段码 + 5×7 点阵，零依赖零用户内容）+ RN 内置 Share（url+文本双带）；⑥l10n benchmark.suite 段 en/zh/zh_Hant 三语。门禁：tsc 0 / jest 新增 40+ 全绿 / l10n validate 通过；待真机验证（套件全流程 + 分享 + 浅深双模式） |
| 2026-08-25 | 1.1 | **B42 跑分数据留存（大王诉求：跑完的实时数据要留存可回看）**：根因——chatTurnPerf 纯内存态跑完即失、无回看入口。①chatTurnPerf 逐点委托 perfRecorder 增量落盘（JSONL，进程被杀也留断点轨迹，与生图同库）；失败回合 removeSession 不留残迹；②PerfHistoryModal 提共享层（components/，样式随迁）+ 加 `chat-turn`→「聊天」标签，聊天回合与生图任务统一回放；③总控台加「性能回放历史」入口（perf-history-button）。真机验：聊天回合落盘 perf_<messageId>.jsonl（taskType chat-turn，29 行，跑分卡综合 85）+ 回放面板列表/回放态/统计卡/跑分卡全通。门禁：tsc 0 + 受影响 325 全绿 + Gradle SUCCESS |
| 2026-08-25 | 1.0 | **B41 聊天域跑分仪式化**（大王提醒：思考中 + 流式期也要跑分，跑分是本体）：①PendingIndicator 单点遥测→滚动历史（最近 60 点）+ 迷你折线（复用共享 PerfAreaChart，PSS 主图 + 5/6GB 阈值虚线）；②流式期门控放开（isPending 加 streaming_text，遥测卡常驻，隐藏仅限 done）；③管家直答 butlerReply 点亮 prefill 态接遥测 + 答完复位；④PerfAreaChart 迁 components 共享层，三处（生图页/待回复卡/回复卡展开层）统一引用，消除 components→screens 倒置。真机验证（小米 13）：prefill 遥测+折线 / 流式期遥测常驻 / 展开层 7.1tok/s+峰值 2.0G+30 采样点+双层曲线。门禁：tsc 0 + 受影响套件 309 全绿（含 invariants）+ Gradle SUCCESS |
| 2026-08-25 | 0.9 | **B40 第二/三波落地**：待回复卡 1Hz 实时遥测行 + 模型加载阶段行（w2）；chatTurnPerf 回合遥测服务（内存态，接线 run_started/finished/failed）+ footer「▾ 图」展开层（PSS+CPU 双层曲线 + 峰值/温升摘要 + tok/s OdometerNumber 翻滚，消化死码）；门禁 tsc 0 + 受影响套件 266 全绿；待真机终验 |
| 2026-08-25 | 0.8 | **B40 跑分仪式化规划定稿 + 第一波落地**（§11）：①红线修复——PendingIndicator 卡片顶描边移除（AI 风禁令）；②GPU 负载/频率偶发 `--` 根治——kgsl 电源域切换瞬时读失败，原生侧 3s 防抖保持（传感器防抖非造假，待重建真机验）；③折线多层叠加落地——PerfAreaChart `series` 多规格 + 「叠全」chip（PSS/CPU/GPU/温/功耗五层分色同屏）；④图表 60→88pt 利用预览卡余量；⑤落地复查披露两项欠账：OdometerNumber 无消费点（第二波消化）、像素分享卡 file:// 未配 FileProvider（11.4 方案）；⑥第二/三波规划：待回复仪式卡（含 chatTurnPerf 数据链缺口披露）+ 回复卡指标图形展开；⑦推送纪律：本地 commit 照常，push 等大版本测试通过后统一推 |
| 2026-08-25 | 0.7 | **真机全链路验证通过（K90，人类模拟路径 + DRC 导航，scrcpy 监督）**：①诚实失败路径 ×3 验证（聊天模型未加载/生图模型未加载/推理超时，均复位无半态）；②标准负载契约真机血证三次修订：旧会话 3595 tokens 致 300s 超时 → 新会话；思考开 >600s/关 77s → completionSettings 钉死（override 不入会话参数实证）；生图赛道改 generateDreamLiteEntry 同源入口（自带按需加载，免双引擎常驻预载）；超时 300→6000s；③全套件跑通：LLM 77s（10.0 tok/s）→ 生图 54.0s（11.6 s/步）→ 耐久 42.4/46.7/42.5s，总时长 4m23s，综合分 46 · 段位走地鸡（MEM 0=双引擎常驻 PSS 峰值破 6GB 硬杀线 / THM 100 / STB 53 / SPD -- 无基线诚实置灰）；④分享面板验证：系统分享唤起 + 文本摘要「Pocket Chick Benchmark — Total 46/100 (MEM 0 · SPD -- · THM 100 · STB 53) · FREE RANGE CHICK」；⑤浅深双模式截图存档（.tmp/b39_*.png）；⑥G5：双引擎常驻 PSS 5.76GB 实证（逼近硬杀线，印证内存分项口径）；⑦HUD 用例标签 l10n 映射修复（raw key → 推理速度/生图速度/温控耐久）；设备侧铁证：HyperOS 双引擎常驻触发 OEM 内存配额 signal 9 杀进程（跑分软件本身成为内存安全分的活证据） |
