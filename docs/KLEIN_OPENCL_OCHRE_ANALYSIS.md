---
doc_id: KLEIN_OPENCL_OCHRE_ANALYSIS
module: root
type: analysis
status: active
version: "1.0"
created: "2026-08-29"
updated: "2026-08-29"
relates: [POCKETPAL_MASTER_LOG, SD35_OPENCL_WHITE_IMAGE_ANALYSIS, POCKETPAL_SCHEDULED_TASKS]
---

<!-- D-FORMAT:v3 -->

# FLUX.2 Klein OpenCL 赭石输出根因分析（进行中）

> 状态：排查中 · 病灶收窄至 convert/转置 · 终审探针 q5K-CONV 已就绪待真机
> 设备：红米 K90（Adreno 840）· 后端：OpenCL · 模型：FLUX.2 Klein Q4_K_M（unsloth 量化）
> 症状：OpenCL 后端输出赭石/纯色（非内容图）；同一模型桌面 CPU 输出正确、SD3.5 同机 OpenCL 输出正确
> 同 seed 对照范式：seed=1718095322 + prompt=`a red apple on a wooden table, soft light` + 512×768/4 步/cfg 1.0

---

## 一、问题定位（组合性 bug，非硬件）

| 对照轴 | 结果 | 结论 |
|---|---|---|
| Klein × OpenCL（K90） | 赭石/纯色 | **病灶组合** |
| Klein × CPU（桌面参照） | 正确红苹果（latent ±4.9） | 模型文件本身正确 |
| SD3.5 × OpenCL（K90） | 正常 | 平台/后端健康 |
| 设备 GGUF vs 桌面 GGUF | 逐字节相同（4096B 段比对） | 模型文件分发一致 |

→ **bug 只在 Klein(FLUX.2 架构、Q5_K 混合量化) × ggml-opencl 使用路径上**。

## 二、证据链（逐轮实锤）

| 轮次 | 探针/实验 | 结论 |
|---|---|---|
| probeE 全 op 探针 | 节点输出 std 双端对比 | 压缩自 blk2 开始、blk3 最狠（≤0.23x）；blk0/1 正常 |
| probeH 双端 MULPROBE/CPUMUL | gate/up 激活按行 stride 双端同构 | **split→silu→mul 链无罪**（0.83-1.37 双端一致） |
| probeI q5K-DST | GEMM 后同步读 dst（无延迟污染） | **GEMM 输出确凿压缩**：node_604(step4)=18.15 vs CPU 77.9 |
| probeK q5K-A | 权重数组读回 + 全量 d/dm 统计 | 权重数据自洽（小块 d≈7e-5、dm≈1e-3，无 NaN）；与转换后数组一一对应 |
| probeL/M q5K-RAW | host 侧 data 指针直读（零 enqueue） | **加载层洗清**：GGUF data_offset=10816（32 对齐，规范正确），真机 data 与文件逐字节一致 |
| 本地手算 | convert+转置全链模拟（noshuffle/shuffle/trans4/不转置 4 假设） | 与真机 q5K-A 读数**全不符**（仅 block0 首项 03 30 / ed 吻合） |

**排除清单（都已实证或代码审查洗清）**：
1. ✗ 硬件（对照轴表）
2. ✗ 模型文件（逐字节相同 + CPU 出正确图）
3. ✗ 加载层（q5K-RAW：data=文件原样；`offset = data_offset + gguf_get_tensor_offset` 直读字段）
4. ✗ 权重量化/双重量化（未见重量化痕迹：data=文件原样时刻即 d=7e-5）
5. ✗ 激活值链（gate/up 双端一致）
6. ✗ 布局参数（d/dm 用 K/256 转置，QK_K=256 超块语义正确）
7. ✗ 输入 B（CLEAN 探针 GEMM 前读 b 正常）

## 三、当前病灶（收窄到两个函数）

- **convert 内核（q/qh 重排）或紧随其后的 transpose 转置**：
  - 真机 q5K-A 读到的 q/qh（GEMM 实际输入）与「按 cvt.cl 源码语义的模拟」（noshuffle 低半/高半分离、shuffle 直拷、trans4、不转置）全部不符；
  - 只有第一项吻合（block0 的 `03 30` 与 `ed`），后续全不同 → 变换结构相似但局部不同；
  - 免疫区：d/dm/s（直拷，无重排）全部吻合 → 病灶在带重排的 q/qh 通道。

## 四、终审计划（q5K-CONV 二分，一轮定谳）

探针已编译进包（set_tensor 的 convert 之后、转置之前直读 q/qh/s/d/dm 原始 32B）：

| q5K-CONV vs 本地手算参照 | 结论 | 后续动作 |
|---|---|---|
| 一致（03 30 6d e7 84 0a 18 1c / ed a9 dd dc …） | convert 正确 → **转置 bug** | 查转置参数/内核执行 |
| 不一致 | **convert 实际执行版本 ≠ 源码语义** | 比对 shuffle/trans4/老版内核与编译产物 |

> 本地参照已固化：block0 手算 q=`03 30 6d e7 84 0a 18 1c 47 48 67 6b cd 2f ee 33 b6 a0 1e 45 6d cb 26 fd f8 e4 d7 f5 81 73 60 57`、qh=`ed a9 dd dc e5 32 5d ad 6b 85 b0 9a 87 cb 76 0a …`。

## 五、排查弯路复盘（血泪账，全部归档防重蹈）

1. **GGUF data_offset 解析错误引发的两轮假结论（最重）**：以非对齐起点（1056）解析数据段 → 伪造出「txt_mlp.2 块头 d=-1.9795」的期望值 → 真机 d=7e-5 被判为「加载错位 9764B」→ 又据此判定「wtype 双重量化」为元凶。**真相**：数据段按 GGUF 规范 32 对齐后为 10816，d=7e-5 就是文件真实内容（q 区权重值合理，桌面 CPU 同文件出正确图）。教训：**解析器必须先 self-check（offset 字段链与对齐规范验证）再对表**；两次伪实锤均源于此单一错误。
2. **QK_K=256 认知缺失（K/64 误改致全 NaN 纯白）**：按 QK_K=64 旧系假设把 d/dm 转置参数改 K/64 → 越界读 → GEMM 全 NaN → 已回滚并留下警示注释。教训：fork 的 K 系列超块=256；改参数前先读 ggml-common.h 的 block 定义。
3. **探针登记条件过宽致 SIGABRT ×2**：全 op 登记使读回函数误读量化权重（extra 自定义结构被当 data_device）→ 登记限定 `node_`/`ggml_runner_cut` 前缀 + 排除 `.weight` + data_device 空检查。
4. **延迟读污染**：CLDUMP（延迟 1-enqueue）会把跨行/复用数据混入 → 改 GEMM 后同步读（q5K-DST）才干净。
5. **连续区间读 view 混读**：MULPROBE v1 连续读非连续 view → 每两行混读 → 改按行 stride 逐行读（CPU/OpenCL 双端同构）。

## 六、可复用知识点（fork 特有，勿再踩）

| 知识点 | 值 | 出处 |
|---|---|---|
| K 系列超块 | QK_K=**256**，K_SCALE_SIZE=12，block_q5_K=176B（d+dm+s[12]+qh[32]+qs[128]） | ggml-common.h |
| fork ggml 枚举 | Q4_K=12、Q5_K=13、Q6_K=14（标准 llama.cpp 差 1）；gguf.cpp 读 type 直接当 ggml_type | ggml.h |
| GGUF v3 数据段 | header 尾 32 对齐（本例 10803→10816）；offset 字段为相对数据段 | GGUF 规范 |
| d/dm 转置参数 | 每行 K/256 个（每超块 1 个 half），勿用 K/64 | set_tensor Q5_K 分支 |
| 双端同构探针 | CPU（ggml-cpu.c）+ OpenCL 同格式打印，才是链路分段金标准 | 本次 |
| host 直读 | 加载链最上游证据：set_tensor 的 data 指针直读，零 enqueue | 本次 |

## 七、环境与探针现状

- 设备离线中（2026-08-29 上午）；探针环境：kgN 挂法 `nohup logcat -v time -f /data/local/tmp/kgN.log`
- 探针代码（q5K-RAW/CONV/DST/A、MULPROBE、CPUMUL、CLPROF）已随 `99b07d1` 提交，终审定谳后按惯例撤除