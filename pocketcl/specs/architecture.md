# PocketCL 架构落地（v0.1，Phase 1 T0 实体化）

> 来源：小黄鸡仓 `docs/POCKETPAL_OPEN_KERNEL_PLAN.md` §六 产品定义 → 本文件细化到可执行规格。

## L1 设备指纹 DB（devices/）

- **载体**：每设备一张 JSON 设备卡（`devices/<id>.json`），schema 见 `devices/schema.json`。
- **字段三态诚实分级**：
  - `verified`：真机实证（getprop 实锤 / 日志 / 实测数据），带 `source`；
  - `pending`：已判定但未真机验证（待测项，禁止当作事实发布）；
  - `reference`：公开资料口径（厂商/媒体），仅作参考不参与决策。
- **探测源**：`getprop ro.product.marketname / ro.board.platform / ro.build.characteristics`（serial 与身份严禁凭推测对应，先实锤）、OpenCL 特性探测（clGetDeviceInfo + 扩展名单）、运行时探针（CLPROF）。
- **决策语义**：白名单（准入）→ 分级（high-gpu 等）→ 降级（自动回退路径），逐级兜底，缺证据即降级。

## L2 内核集合（kernels/）

- `MANIFEST.json`：资产清单（机读）：归属三态 `upstream-first`（可合回上游）/ `self`（自研增量，本仓主体）/ `experimental`（实验线）。
- **双重守卫模式**（跨厂商正确性第一规则）：任何 vendor-specific 扩展内核（`cl_qcom_*` / qcom 内置函数）必须「编译期宏」+「运行时 `gpu_family` 过滤」双保护，编译期宏控制是否构建，运行时过滤控制是否编译进 context——缺一即在非目标 GPU 上崩溃。
- **fp32 累加铁律**：半精度只在存储/local 缓冲使用，累加恒 fp32（全 fp16 累积已致 NaN 事故）。
- 内核来源合规：凡来自上游（MIT）的修改，开发时在对应 PR/commit 留痕，发布时随包注明上游版本号。

## L3 tuning 回注（Phase 2 占位）

- 数据源：小黄鸡 PerfPanel 任务级 JSONL（PSS/CPU/温度/功耗/GPU 负载 1Hz 随采 + 算子榜单）。
- 语义：设备卡 + 算子 profiling → 内核选择/参数校正 → 下一轮跑分验证（闭环）。Phase 2 接入 AutoTVM 搜索空间收敛。

## 非目标（锋利边界，不兜底不补丁）

- 不逆向/不替换官方用户态驱动（驱动内 wave 调度/DVFS/GMEM 分配为黑盒，不碰）；
- 不做 NPU 白盒化（QNN/NeuroPilot 图编译是官方唯一路径）；
- 不维护 ROM 兼容矩阵（只做「探测 → 分级 → 降级」自动兜底）。