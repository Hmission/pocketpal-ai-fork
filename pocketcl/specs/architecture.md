# PocketCL 架构落地（v0.3，2026-08-29 R 层调度层）

> 来源：小黄鸡仓 `docs/POCKETPAL_OPEN_KERNEL_PLAN.md` §六 产品定义 → 本文件细化到可执行规格。
> v0.2：公共 API 布局（参考 OpenCL 成熟逻辑，四借四不借）。
> v0.3：新增 R 层（跨引擎资源调度层）——PocketCL 从「决策卡+工具集」升级为「混合计算调度层」。

## 一、L1 设备指纹 DB（devices/）

- **载体**：每设备一张 JSON 设备卡（`devices/<id>.json`），schema 见 `devices/schema.json`。
- **字段三态诚实分级**：
  - `verified`：真机实证（getprop 实锤 / 日志 / 实测数据），带 `source`；
  - `pending`：已判定但未真机验证（待测项，禁止当作事实发布）；
  - `reference`：公开资料口径（厂商/媒体），仅作参考不参与决策。
- **探测源**：`getprop ro.product.marketname / ro.board.platform / ro.build.characteristics`（serial 与身份严禁凭推测对应，先实锤）、OpenCL 特性探测（clGetDeviceInfo + 扩展名单）、运行时探针（CLPROF）。
- **决策语义**：白名单（准入）→ 分级（high-gpu 等）→ 降级（自动回退路径），逐级兜底，缺证据即降级。

## 二、L2 内核集合（kernels/）

- `MANIFEST.json`：资产清单（机读）：归属三态 `upstream-first`（可合回上游）/ `self`（自研增量，本仓主体）/ `experimental`（实验线）。
- **双重守卫模式**（跨厂商正确性第一规则）：任何 vendor-specific 扩展内核（`cl_qcom_*` / qcom 内置函数）必须「编译期宏」+「运行时 `gpu_family` 过滤」双保护，编译期宏控制是否构建，运行时过滤控制是否编译进 context——缺一即在非目标 GPU 上崩溃。
- **fp32 累加铁律**：半精度只在存储/local 缓冲使用，累加恒 fp32（全 fp16 累积已致 NaN 事故）。
- 内核来源合规：凡来自上游（MIT）的修改，开发时在对应 PR/commit 留痕，发布时随包注明上游版本号。

## 三、L3 tuning 回注（Phase 2 占位）

- 数据源：小黄鸡 PerfPanel 任务级 JSONL（PSS/CPU/温度/功耗/GPU 负载 1Hz 随采 + 算子榜单）。
- 语义：设备卡 + 算子 profiling → 内核选择/参数校正 → 下一轮跑分验证（闭环）。Phase 2 接入 AutoTVM 搜索空间收敛。

## 四、API 布局与架构参考（v0.2 决策，2026-08-29）

**决策：借鉴 OpenCL / CUDA 的成熟逻辑，但保持「OpenCL 之上的薄层」定位。**

### 4.1 四借（采纳）

| 参考对象 | OpenCL/CUDA 逻辑 | PocketCL 对应物 |
|---|---|---|
| API 两层分离 | CUDA runtime/driver 分层的稳定接口思想 | `include/pocketcl.h` 公共 API（稳定）+ Core（实现细节）分离 |
| 设备抽象与枚举 | `clGetDeviceIDs` + Platform/Device 分层 | `pc_get_devices()` 枚举 + 设备卡（devices/*.json 三态诚实）——多 GPU 家族共存 = ICD 多厂商共存的同款逻辑 |
| 程序对象 + 编译期错误 | `clBuildProgram` / `clGetProgramBuildInfo` 的编译期失败诊断语义 | `pc_program_create/compile`：双重守卫编译、失败带诊断日志、builtin 缓存 |
| 扩展协商 | `cl_khr_*` 运行时特性协商 | `cl_qcom_*` 等 vendor 扩展运行时特性探测（PC_EXT_* 位掩码），按能力选内核 |

### 4.2 四不借（锋利边界）

1. ❌ 不造平台层/ICD 加载器——我们是 OpenCL 之上的调校层，不是新 OpenCL；
2. ❌ 不造编译链/SPIR-V——直接用厂商 OpenCL C 编译器（`clBuildProgram` 是执行者，不是被替代者）；
3. ❌ 不造复杂对象模型——只保留 4 个对象：`pc_device` / `pc_program` / `pc_kernel` / `pc_policy`；
4. ❌ 不学 CUDA「专有生态」做法——本就站在 Khronos 开放标准上，增量全部开源。

### 4.3 目录布局（对齐 API）

```
pocketcl/
├── include/pocketcl.h   # 公共 C API（v0.1 草案，仿 OpenCL 惯例：pc_* 前缀 + pc_status 错误码）
├── src/device.c         # 设备枚举/指纹卡导出（L1）
├── src/program.c        # 程序对象：双重守卫编译 + 诊断 + 缓存（L2）
├── src/policy.c         # 策略引擎：设备卡 → 内核/编译选项/env 组合（L1+L2 桥）
├── src/profiler.c       # CLPROF 聚合器（L3 探针，PC_PROFILING 开关）
├── cli/                 # 设备卡生成器 + 探针 CLI（Phase 1 T1/T2）
├── devices/             # 设备指纹卡（JSON，见「一」）
├── kernels/             # 内核集合与样板（见「二」）
└── handbook/            # 调优铁律与排查决策树
```

### 4.4 错误码与错误处理惯例（仿 OpenCL）

- `pc_status` 错误码枚举（PC_OK / PC_DEVICE_NOT_FOUND / PC_UNSUPPORTED_GPU / PC_COMPILE_FAIL / PC_INVALID_ARG / PC_PROFILE_UNAVAILABLE...），函数返回码 + 可选 `pcGetErrorString()`；
- 编译失败必须可诊断：错误日志字符串可取得（对齐 `clGetProgramBuildInfo` 心智）；
- 探针不可用时**降级不报错**（PC_PROFILE_UNAVAILABLE → 调用方走无探针路径）。

## 五、非目标（锋利边界，不兜底不补丁）

- 不逆向/不替换官方用户态驱动（驱动内 wave 调度/DVFS/GMEM 分配为黑盒，不碰）；
- 不做 NPU 白盒化（QNN/NeuroPilot 图编译是官方唯一路径）；
- 不维护 ROM 兼容矩阵（只做「探测 → 分级 → 降级」自动兜底）；
- 不造 OpenCL 平台层 / 编译链 / 专有生态（见 4.2）；
- R 层不直接执行内核（引擎执行，R 层做「决定+编排」）。

## 六、R 层：跨引擎资源调度层（v0.3 架构升级）

**定位**：PocketCL 从「决策卡+工具集」升级为「混合计算调度层」——
管 OpenCL/ggml **都不管的事**：App 内跨引擎（聊天 LLM / 生图 / TTS / ASR）的资源仲裁与调度编排。

### 6.1 为什么是这条路径（决策依据）

- 引擎内算子→设备分发（ggml-backend）已存在，重造 OpenCL/调度引擎 = 四不借违例；
- 端侧真正的调度空白在**引擎之间/模型之间**：GPU 时间片、内存池、卸载顺序——现在是手写直觉（6.17 A2 顺序卸载）；
- NPU/驱动黑盒约束下，可把握的榨干面 = 资源仲裁 + 调度纪律 + 内核/队列策略（L-Exposed + L-Configurable）。

### 6.2 五对象规格

| 对象 | 心智来源 | 职责 | 不做什么 |
|---|---|---|---|
| `pc_context` | OpenCL context | 资源域：设备集 + 内存预算 + GPU 时间片配额 + 策略快照 | 不建平台/ICD |
| `pc_queue` | OpenCL command-queue | 队列抽象：前台/后台/串行/并行分级，引擎任务登记 | 不执行内核（引擎 enqueue） |
| `pc_event` | OpenCL event | 依赖链：任务完成触发下一任务；阻塞/通知语义 | 不做细粒度内核级同步（引擎内自管） |
| `pc_memory` | cl_mem 策略 | buffer 策略（大型 buffer/xmem/GMEM）+ **卸载编排**（6.17 A2 迁入）+ OOM 防护 | 不替代引擎内存分配 |
| `pc_scheduler` | — | 分发决策：任务画像 + 设备卡 → 路径（GPU=OpenCL / CPU=ggml / NPU=QNN 递话）+ 排队仲裁 | 不微操驱动调度 |

### 6.3 与既有资产衔接

```
T0 设备卡 ──约束──> pc_scheduler 分发决策
T1 policy ──升级──> 决策卡成为 pc_context 策略快照（调度输入，不再是终点）
T2 CLPROF ──证据──> 任务画像（算子榜/内存驻留/PSS）
L3 tuning ──闭环──> 调度效果回注（PerfPanel JSONL）
业务桥 ──迁移──> setenv 矩阵→policy；taskRouter/engineMutex/顺序卸载→pc_scheduler/pc_memory
```

### 6.4 分层不变量（R 层纪律）

1. R 层只做「决定+编排」，内核执行永远在引擎侧；
2. 任何调度决策必须可观测：决策 JSON 落盘（PC_LOG 通道），PerfPanel 可查；
3. 默认零侵入：R 层规格先行，真实业务迁移按「痛点触发」推进（不装原则）；
4. 新设备/新模型接入 = 设备卡 + 任务画像更新，不改调度器代码（数据驱动）。

### 6.5 API 草案（见 include/pocketcl.h §R 层）

v0.2 草案声明 + 语义注释，**不实现**；实现触发点：①真机出现跨引擎资源冲突事故；②T3.2 编译器试点需要回注。