---
version: "0.2"
created: "2026-08-29"
updated: "2026-08-29"
status: "草案"
relates: [PERF_BENCHMARK_DESIGN, IMAGEGEN_OPENCL_OPT, POCKETPAL_PRODUCT_SPEC]
---

<!-- D-FORMAT:v3 -->

# 开源端侧内核工具方案（PocketCL）草案

> 状态：**草案 v0.1（2026-08-29 调研立档）** | 定位：把「手机 SoC 纸面算力 → 实际吞吐」的差距吃回来，开源化、社区化，且不被官方驱动迭代淘汰
> 方法论：写轮眼（高通天玑调度设计 + 开源社区实践调研）+ 自学习（本项目真机内核优化实证：OpenCL SD3.5 11×、Mali 半精度 2.86×、Z-Image XMEM 3.6×）

---

## 一、背景与动机

1. **纸面算力富余，实际吞吐不足**：K90 / Adreno 840 纸面 FP32 ≈ 3.7 TFLOPS（18MB GMEM、12 CU），但我们的 OpenCL 推理路径实测只跑出百分之几利用率——瓶颈在算子内核与调度表达，不在硬件。
2. **厂商驱动闭源，优化黑盒**：高通/ARM 用户态 GPU 驱动与 NPU 固件全部闭源，驱动内部 wave 调度、occupancy、DVFS、GMEM 分配策略无文档、不可改。他们的进化（新驱动、新内核调度）我们既看不到也追不上。
3. **官方开放的口子比想象大**：OpenCL 3.0（Khronos 开放标准 + `cl_qcom_*` 供应商扩展含 GMEM 计算直通）、Vulkan 1.3、QNN SDK（公开下载、本地编译、无需账号/云端）、NeuroPilot SDK 均开放；阻塞点在「API 之上的榨干层」没有开源工具。
4. **窗口期**：2024-2026 开源社区三股潮流同时成熟——freedreno/turnip 支持 Adreno Gen8（830/840）、Mesa rusticl 在 freedreno 上启用 OpenCL、TVM/MLC LLM 编译器路线打到手机。此时入场是站在肩膀上，不是开荒。

## 二、调研结论：开放面与封锁面（高通天玑）

| 层 | 高通（K90 / Adreno 840 + Hexagon HTP v81） | 天玑（K Pad / Mali-G925 + APU） |
|---|---|---|
| CPU | ISA 开放（ARMv9），核设计闭源 | 同左 |
| GPU 内核驱动 | kgsl 基础模块开源（GPL） | kbase 开源（GPL，ARM 提供） |
| GPU 用户态驱动 | 闭源 blob | 闭源 blob（libGLES_mali.so 半闭源） |
| GPU 硬件文档 | 部分开放（freedreno wiki：架构 + IR3 汇编） | 部分开放（Mesa 文档可参考） |
| NPU SDK | QNN：公开下载、主机端本地编译 context binary、HTP/GPU/CPU/LPAI/DSP 全后端 C API；HTP 内部黑盒 | NeuroPilot 8.0：公开（NNAPI+扩展、Neuron Studio、ModelHub、Flexible LLM Toolkit）；APU 内 MDLA/MVPU 黑盒 |
| 第三方开源驱动通道 | 有：turnip/freedreno/rusticl（Magisk/KernelSU 模块，需 root） | Android 无（社区实测无选项） |
| 官方性能工具 | Snapdragon Profiler / AGI / Adreno Control Panel | Neuron Studio |

## 三、核心判定：可做性分四层

| 层 | 内容 | 判定 | 依据 |
|---|---|---|---|
| L-Exposed | OpenCL/Vulkan/NNAPI/QNN API 之上的算子内核、编译过滤、tuning | ✅ **主战场** | OpenCL 3.0 + qcom 扩展（on-chip global memory = GMEM 计算直通，本项目 xmem GEMM 已实证）；Khronos 跨代稳定 |
| L-Configurable | HTP `backend_ext_config.json`（性能模式/核心数/精度）、NeuroPilot 扩展开关 | ⚠️ 只能递话不能改逻辑 | SDK 公开、图编译在主机侧（QNN 无需云端），但调度实现黑盒 |
| L-Black-box | 驱动内 wave 调度/occupancy/寄存器分配/DVFS/温控 | ❌ 不可行 | 签名固件 + 无文档；官方也「知道但没做完」，我们够不着 |
| L-Driver | turnip/panvk 开源驱动替换 | ⚠️ 实验线 | Adreno 830/840 已支持（2026-01 实测）；需 root + 模块替换；Android 系统更新可能覆盖；Mali 无通道 |

**结论**：产品建立在 L-Exposed 层，L-Driver 只做实验数据反哺，L-Black-box 明确不碰。

## 四、开源社区先例盘点（证据链）

| 项目 | 状态（2026-08） | 启示 |
|---|---|---|
| freedreno/turnip（Mesa） | **Adreno 830/840 已支持**（高通工程师 Rob Clark 主导；一加 15/Adreno 840 实测跑通，与 K90 同款） | 开源 GPU 驱动的天花板比想象高；计算负载实测与闭源差距 <10%（Adreno 650：RealESRGAN 18.4s vs 18.9s 打平） |
| rusticl（Mesa） | Mesa 24.3 起 freedreno 上启用 OpenCL（CI 覆盖 A618/660/750） | **开源 OpenCL on Adreno 已萌芽** = 手机端「开源 CUDA」底座 |
| panfrost/panvk（Mesa） | 主线；Mesa 25.1 支持 Mali Gen5 + OpenCL C 基础；Mesa 26.2 支持 Mali v14/G1 Pro | 天玑 Linux 侧可行；Android 无通道 |
| TVM / MLC LLM | Apache 开源 ML 编译器 + 端侧推理（Vulkan/Metal/OpenCL 代码生成、自动调优） | 「开源的 CUDA 编译器」现成骨架 |
| ggml/llama.cpp/sd.cpp | 开源手写内核栈（OpenCL/Vulkan/Metal 后端） | 我们已在此深度改造，资产可直接开源 |

## 五、自有资产盘点（开门立柜）

| 资产 | 内容 | 复用方式 |
|---|---|---|
| 探针方法论 | ggml-opencl `CL_QUEUE_PROFILING` 编译开关 + env 门控 + logcat top-N 聚合 | 固化为工具内置 profiler |
| 内核资产 | xmem GEMM（Adreno）、tiled VAE、Mali half-prec 三内核（half local + fp32 累加）、qcom 内核双重过滤（编译期宏 + 运行时 gpu_family） | 内核集合 L2 |
| 设备指纹能力 | getprop 实锤（socModel/GPU 家族）、requiresHighGpu 分级、Mali 白名单、OpenCL 特性探测 | 设备 DB L1 |
| 跑分回注链路 | PerfPanel 四轴遥测 + 任务级 JSONL 落盘 + 回放 | tuning 回注 L3 |
| NaN 指纹排查法 | 跨设备 NaN 指纹对比 → 算子层定位 | 工具诊断手册 |

## 六、产品定义：PocketCL 三层架构

```
┌─ L3 tuning 回注：跑分面板数据 → 内核选择/参数自动校正（可复现基准） ┐
├─ L2 内核集合：OpenCL C 内核 + 编译期宏×运行时家族双重守卫 + vendor 扩展封装 ┤
├─ L1 设备指纹 DB：socModel/GPU 家族/特性探测/白名单分级（自动降级兜底） ┤
└─ 底座：OpenCL 3.0 / Vulkan 1.3 / NNAPI / QNN（Kotlin/JNI 绑定，进程内加载） ┘
```

- **命名与许可**：PocketCL，Apache-2.0，独立 Git 仓 + 上游回流（ggml/sd.cpp 补丁优先合入主仓）。
- **非目标（锋利边界，不兜底不补丁）**：
  - 不逆向/不替换官方用户态驱动（L-Black-box、L-Driver 不做产品依赖）
  - 不做 NPU 白盒化（QNN/NeuroPilot 图编译是官方唯一路径，我们做的是其上的开源 backend/调度层）
  - 不维护 ROM 兼容矩阵（只做「探测 → 分级 → 降级」自动兜底）

## 七、路线图

### Phase 1（2-3 周）：资产封装 + 发布 + 社区探路
1. T0（3 天）：从本项目代码中瘦身提炼内核集合与双重守卫（独立目录、零业务依赖）；
2. T1（5 天）：设备指纹探测模块（getprop + OpenCL 特性 + NaN 指纹），输出 JSON 设备卡；
3. T2（5 天）：CLPROF 内置探针 + top-N 聚合（运行时零开销开关）；
4. T3（3 天）：README/示例/许可，发布 GitHub（Hmission 组织或独立 org）；
5. T4（2 天）：ggml/sd.cpp 上游提交 1-2 个高价值补丁（Mali half-prec、qcom 双重过滤），社区 PR 探路。

**验收**：K90 + K Pad 两份真机基准报告随仓发布；上游至少 1 个 PR 被接受或获 maintainer 回复。

### Phase 2（1-2 月）：编译器路线
- 以 TVM/rusticl 为上游，把 AutoTVM 搜索空间收敛到我们的内核集合（Adreno/Mali compute）；
- 产出「模型 → 内核选择 → 可复现基准」的端到端流水线（模型矩阵对标本项目 MODEL_MATRIX）。

### Phase 3（实验线，不设期限）：开源驱动对比基准
- K90 挂 turnip 模块（同款 840 已有成功案例），OpenCL/Vulkan compute 对比闭源 blob；
- 数据（性能/功耗/稳定性）只用于反哺 Phase 1-2 的内核调度启发，不构成产品依赖。

## 八、稳定性论证：为什么不会被官方迭代掉

| 立足层 | 官方驱动迭代影响 | 结论 |
|---|---|---|
| OpenCL/Vulkan/QNN API 之上 | OpenCL 3.0 / Vulkan 1.3 跨代稳定；驱动更新不破坏 ABI | ✅ 不被迭代掉 |
| 硬件代际演进 | API 不变、硬件参数变 → 设备指纹 DB + tuning 回注自动适配 | ✅ 折旧的是官方 blob，不是我们 |
| turnip/panvk 实验线 | 跟随 Mesa 上游，但绑内核版本、OTA 可能覆盖 | ⚠️ 仅实验 |
| 驱动内部调度 | 闭源固件 + 签名 | ❌ 不追 |

**护城河**：开源 + 真机实测数据库 + 社区（官方永远闭源，QNN SDK 免费但黑盒）。

## 九、风险与边界

1. **工程体量**：厂商驱动团队百人级 → 我们不做「重写驱动」，做「API 之上的榨干层」，目标是理论性能 40-70%（ggml/MLC 已证明可达）；
2. **平台碎片**：各 ROM 驱动版本差异 → 设备 DB 自动分级降级（白名单 + 回退路径，本项目已有完整经验）；
3. **官方跟进**：高通 GENIE/AI Hub 免费化是抢跑 → 开源 + 基准数据是我们的差异点；
4. **合规**：QNN/NeuroPilot SDK 随附许可需在分发链路口径中标注；OpenCL/Vulkan 为 Khronos 开放标准无此问题；
5. **真机策略**：一切优化以真机实测为准（本仓铁律），不发布无真机数据的性能声明。

## 十、验收标准（Phase 1 MVP）

- [ ] PocketCL 仓库发布（Apache-2.0，含 README 双语 + 示例）
- [ ] K90 与 K Pad 两份真机基准报告随仓（CLPROF 算子榜单 + 前后对比）
- [ ] ggml/sd.cpp 至少 1 个 PR 合入或获 maintainer 明确回复
- [ ] 设备指纹卡 JSON 生成器可复现（getprop 实锤口径）
- [ ] 本文档状态「草案 → 已立项」并登记 MASTER_LOG

## 十一、参考来源

- Mesa 24.3 release notes（rusticl enable on freedreno / OpenCL CI A618/660/750）
- Mesa 25.1（panfrost Mali Gen5 + OpenCL C 基础）、Mesa 26.2（Mali v14）
- turnip/freedreno Adreno 830/840 支持实测（lfdevs/mesa-for-android-container，2026-01）
- Qualcomm AI Engine Direct（QNN SDK）公开文档：本地编译 context binary、HTP backend 配置
- MediaTek NeuroPilot 8.0 开发者资源（天玑开发者中心）
- Adreno OpenCL 白皮书：OpenCL 3.0 + 供应商扩展（recordable command queue / on-chip global memory）
- 本项目真机实证（记忆库：OpenCL GPU 实证、天玑 9400+ 根因定论、设备分级、NNAPI 适配）
- 上游 PocketPal AI（a-ghorbani/pocketpal-ai）GitHub README/贡献指南（MIT，活跃维护，欢迎 More Languages 等五个方向）

---

## 十二、开源战略与身份基准（内部，不对外宣传）

> **本节为本项目开源发布的内部基准**：定义我们以什么身份存在于生态、如何避免「又一个 fork」的鄙视链位、以及如何回馈上游。README 等对外物料只执行本节结论，不宣传本节的战略推理。

### 12.1 身份定义

- **定位**：Android 端侧异构性能工程的**调校层（tuning layer）**——上游引擎解决「跨平台能跑」，PocketCL 解决「在 Adreno/Mali 上榨干」。
- **不是**：不是引擎分支、不是驱动替代、不是 NPU 白盒化。内核资产大多是上游代码的改造（MIT 合法），因此独立仓只放「不属于任何上游」的增量（探针、设备 DB、tuning、基准、手册）——这是避开「另一个优化分支」鄙视链的根本。

### 12.2 Upstream-First 铁律

1. 能合回上游的代码**全部合回上游**（ggml/sd.cpp/llama.rn/llama.cpp），合入即进入每个下游使用者手中，比任何 README 都值钱；
2. 内核以 `patches/` 补丁集形态按上游版本号对齐发布（如 `llama.cpp-b4xxx-mali-hp.patch`），**不 fork 全仓**；
3. 增量层许可证 MIT，与上游同牌，减少合并摩擦（Apache-2.0 兼容但 MIT 更顺）；
4. 对外身份以 commit log 里的名字 + 公开发布物立碑，不靠宣言。

### 12.3 帮到人的定义（反自嗨判定）

| 判定维度 | 标准 |
|---|---|
| 可运行 | CLI 拿来即用（一行命令接入 sd.cpp/llama.cpp），不是库 |
| 可引用 | 真机基准/设备卡公开可复现，允许任何人引用（社区最缺可信移动端数据） |
| 可无感受益 | 补丁合入上游，用户不知道我们存在 |
| 可查证 | 失败案例库 + 排查决策树（症状→根因→做法）随仓，对照代码可验证 |
| 被生态引用 | MLC/llama.cpp 文档链接我们的实践是自然结果，不强求 |

### 12.4 发布形态

```
pocketcl/
├── patches/          # 按上游版本号对齐的补丁集（Mali half / xmem / 双重守卫）
├── cli/              # 探针（CLPROF 聚合）+ 设备指纹卡生成器（JSON）
├── devices/          # 设备指纹 DB + 真机基准报告（社区可提交新设备数据）
├── handbook/         # 失败案例库 + 排查决策树
└── integration/      # 环境变量开关集 + 接入脚本（零侵入三层：env 开关 → 补丁 → 深度接入）
```

### 12.5 成功定义（不 star 化）

- Phase 1 验收即成功标准：上游 ≥1 个 PR 被接受/明确回复；两份真机基准（K90/K Pad）可复现并被引用；设备卡生成器可用。
- 维护成本是最大杀手（开源项目死于不维护）：scope 写死「不做什么」、设备 DB 众筹（社区提交模板）、拒绝功能蔓延。

### 12.6 关系矩阵

- 对上游=贡献者；对厂商（高通/ARM）=免费 QA 与压力面；对 MLC/MNN 等同行=共建者（设备 DB 他们也能用）；对终端用户=无感受益。

### 12.7 产品-开源飞轮

Pocket Chick 试验田产数据 → PocketCL 萃取公共品 → 社区反馈 → 反哺产品方案。不为开源而开源，开源是产品研发副产物的蒸馏。

### 12.8 PocketPal 上游回馈策略（同一审视的标准答案）

**现状核查（2026-08-29 实锤）**：上游 a-ghorbani/pocketpal-ai 为 MIT，**活跃维护中**；贡献指南明确欢迎 New Models / UI/UX / Documentation / Performance Optimization / **More Languages**；提交规范 Conventional Commits 与本仓一致。

**分叉点实测（2026-08-29）**：本仓基线 `46d43b0`（2026-08-12 快照重建，孤儿根提交，无 parent）——二开仓库未保留上游历史（291 自研提交全部独立）；上游 08-12 之后 ≥100 提交（per_page 封顶，最新 `ed680864` 2026-08-25，iOS 上架合规迭代中）。**结论**：与上游无共享历史 → merge 不可行，同步只能 cherry-pick/手动移植（这正是上游修复长期缺失的根因）；**回馈 PR 不受影响**（PR 是 diff 级，直接在 GitHub 新 fork 即可）。

**风险判定**：合规零风险（署名+LICENSE 保留、免费开源、深度自研差异巨大）；唯一薄弱点是**社区关系面的「回馈记录为零」**——「你们 fork 了 pocketpal，回馈了什么？」的答案不能是零。

**回馈分层（按接受概率排序）**：

1. **l10n 语言包**：官方点名欢迎的方向，PR 接受概率最高；只筛「通用 key」的翻译，品牌/私有 key 不进上游；
2. **bug fix**：共享代码层的通用修复（键盘避让、Menu 竞态、SafeArea 等，若修复点在未重构的共享代码上可回削）；
3. **引擎层优化**：OpenCL 补丁走 llama.rn/llama.cpp 上游（与 PocketCL Phase 1 T4 同轨），合入后 PocketPal 自动受益——「帮到所有人」的最优解；
4. **功能级**（生图/智能体/音频工坊）：遵循社区规则**先问后动**——发 Issue/Discussion 提案「we're a fork, built X, aligned with roadmap?」；若无意纳入，独立定位完全正当。

**行动清单**：

- [x] `git remote add upstream https://github.com/a-ghorbani/pocketpal-ai.git` + 分叉点分析（2026-08-29 已执行：基线 46d43b0 / 上游 ≥100 提交；全量 fetch 因本机代理 127.0.0.1:7897 未运行而挂起，待代理恢复后补全对象）
- [ ] 审 `src/locales/`，筛通用 key 组 upstream 兼容 PR（与 l10n 维护纪律同轨）
- [ ] 引擎层补丁走 llama.rn 上游（与 PocketCL T4 合并排期）
- [ ] 上游发「fork 介绍 + 贡献意向」Discussion（以通用能力表述，不带小黄鸡品牌 IP）

---

## 十三、Phase 1 T0 内核资产剖面（2026-08-29）

> 摸底结论：可合回上游的通用资产 5 项（A 类），项目自研/设备策略 4 项（B 类），在途不剖面 1 项（C 类）。

### 13.1 A 类：可合回上游（ggml/sd.cpp，通用正确性/性能修复）

| 资产 | 载体提交 | 实证 | 上游价值 |
|---|---|---|---|
| Mali half-prec tiled GEMM 变体（mul_mm_q4_k/q5_k_f32_l4_lm + PP_MALI_FP16_LM 门控，half local + fp32 累加） | f3b3f2b | 512² 采样 2.86×、512×768 3.42×（画质无损 nan=0） | ★★★★★ 全 Mali 手机受益 |
| CLPROF 算子级探针（CL_QUEUE_PROFILING 编译开关 + env 门控 + logcat top-N 聚合，运行时零开销） | f3b3f2b | 凭猜 mul_mv flat 1.09× → 探针命中 tiled GEMM 2.86× | ★★★★ 通用优化方法论工具 |
| qcom 内核运行时 gpu_family 双重守卫（编译期宏 + 运行时家族过滤，Mali 编译 qcom 扩展必炸） | 本仓历史 | 跨厂商编译失败根治 | ★★★★★ 跨平台正确性 |
| F16 KQ/KQV 路径 use_adreno_kernels 守卫 | 107ae9c | SD3.5 白图 NaN 终极根因修复 | ★★★★ 数值正确性 |
| 512px VAE tiled 解码（graph 1.94GB→416MB，9 tiles） | f69df2a | OOM 根治 | ★★★★ 内存受限设备通用 |

### 13.2 B 类：项目自研/设备策略（不进上游，归 PocketCL 设备层与调度层）

| 资产 | 载体提交 | 说明 |
|---|---|---|
| ggml-opencl 设备白名单（Mali 准入） | e2ad204 | 硬件列表属产品策略，上游不采纳；归设备 DB |
| q4_0 半精度变体 + te=disk + gpuPolicy 声明式门控 | 1efb267 | klein 平板准入；归 manifest/设备分级 |
| Adreno 840 xmem/noshuffle/q5/q6 l4_lm 内核族适配 | 本仓历史 | 上游已有基础，我们做适配+修复（DISABLE_ADRENO_KERNELS/XMEM env 组合）；归内核集合 |
| NaN 指纹排查法（跨设备指纹对比→算子层） | 历次事故复盘 | 归 handbook 排查手册 |

### 13.3 C 类：在途未提交（并行窗口），不剖面

- 工作区 18 文件 +618/−68（mul_mv_q5/q6_k_f32.cl 等），非本窗改动；待对应窗口收口后归入清单。

### 13.4 剖面结论

- A 类 5 项即 Phase 1 T4「上游 PR 探路」的首选载荷（先 Mali half-prec + 双重守卫两枚高价值补丁）；
- B 类 4 项直接映射 PocketCL 三层（设备 DB / 内核集合 / handbook）；
- 真正「瘦身提炼独立目录」工作（T0 实体化）待 Phase 1 立项后开工。