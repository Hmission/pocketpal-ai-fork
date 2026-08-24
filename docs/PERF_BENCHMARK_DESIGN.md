# 专业跑分面板设计（PERF_BENCHMARK_DESIGN）

> 状态：**四阶段已落地（待真机验证）** | 版本：0.3 | 2026-08-23
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
| **GPU 负载%** | `/sys/class/kgsl/kgsl-3d0/gpubusy`（busy/total 两列比值）| Adreno ✅ | Mali/MTK：`/sys/class/devfreq/*.gpu/load` 或 `/proc/mali` |
| **GPU 频率** | kgsl `gpuclk` / `devfreq/cur_freq` | Adreno ✅ | Mali/MTK：devfreq cur_freq |
| **CPU 实时频率** | `/sys/devices/system/cpu/cpuN/cpufreq/scaling_cur_freq` | ✅ 通用 | 取最大核频率（大核代表） |
| **温度细分** | thermal_zone*/type 区分 cpu/gpu/battery 三区 | ✅ 通用 | 现在只取最大，升级为分区分取 |
| **功耗** | `/sys/class/power_supply/battery/current_now`×`voltage_now` | ⚠️ 部分设备可读 | 不可读 N/A（PerfDog 玩法） |
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
│ 性能 ▾  4.2 GB  ▏CPU 87% GPU 76% 42°C 6.2W ▏ Snapdragon │
└──────────────────────────────────────────────────────────┘
  PSS大字(阈值色)   ▏实时指标胶囊(横排)      ▏设备小字(SoC/GPU/NPU)
```

- PSS 大字 + 阈值色（>5GB 橙 / >6GB 红）为**主视觉**，其余指标压缩为胶囊横排
- 设备小字一行放不下时省略（长按折叠头看详情），NPU 型号随设备小字（诚实模式）

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

## 变更日志

| 日期 | 版本 | 变更 |
|------|------|------|
| 2026-08-23 | 0.1 | 首发：写轮眼同行调研（安兔兔/Geekbench/3DMark/PerfDog）+ 自学习缺口实证 + 四阶段方案 |
| 2026-08-23 | 0.2 | 面板形态修正：嵌于预览卡片下半截的横版紧凑布局（折叠头一行 + 迷你曲线条 + 横向指标行），弃竖状全屏图/图片原型，全 md 图表 |
| 2026-08-23 | 0.3 | **四阶段全部落地**（长链执行）：P1 HardwareInfoModule 六指标 sysfs 探测；P2 PerfPanel 横版化（胶囊行/叠加线/指标行/设备小字）；P3 perfRecorder JSONL 落盘 + store 生命周期接线；P4 PerfHistoryModal 回放（播放光标/统计卡/跑分卡）+ perfScore 分数体系。门禁：tsc 0 / jest 23 新增全绿 / Gradle SUCCESS；待真机验证（K90 GPU 负载/功耗读数 + 落盘回放） |
