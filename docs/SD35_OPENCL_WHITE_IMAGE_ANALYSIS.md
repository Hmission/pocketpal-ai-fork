# SD3.5 OpenCL 白图根因分析与路线决策（2026-08-16）

> 状态：分析定稿 · 方案待裁决
> 设备：红米 K90（Adreno 840）· 后端：OpenCL · 模型：sd35_medium_q4_k_m.gguf（512×512）
> 症状：OpenCL 后端出纯白图（latent 全 NaN）；CPU 后端数值健康但 2h+/张不可用

---

## 一、问题全链路（自底向上）

```
VAE 解码 ← 采样器(rectified flow/Euler) ← MMDiT×24 JointBlock ← patch_embed ← 文本条件
                                                     ↑
                                    joint attention: qkv=concat(context_qkv, x_qkv, dim=1)
                                                     ↑
                            NaN 污染链（OpenCL 后端实测）：
                            concat(node_90) 首个污染源
                              → score MUL_MAT (context 行 NaN, 13.07%=154/1178)
                              → SOFT_MAX 全 NaN → cond_out 全 NaN → latent 全 NaN
```

**数据流实证**：CLIP-L/G 文本编码（OpenCL 与 CPU 输出一致 ±800）→ MMDiT 第一步 qkv 拼接即出现 NaN → 污染下游全部计算。

## 二、证据链（逐轮实锤，非推断）

| 轮次 | 实验 | 结论 |
|---|---|---|
| CPU 二分 | CPU 后端 denoised min/max 健康 | **NaN 是 OpenCL 特有** |
| CLIP 对比 | c_crossattn ±793/837 双端一致 | 文本编码链路正常 |
| v4 | SOFT_MAX 输入(SCALE)正常、输出全 NaN | **softmax kernel bug 实锤** |
| softmax 修复 | 换 local memory 全组 reduce 后仍 NaN | 输入(score/SCALE)本身已被污染 |
| v5 | score MUL_MAT context 行 NaN（154/1178） | 污染源在 concat 或更上游 |
| v8 | **concat 输入 nan=0、输出 NaN+垃圾值** | **concat kernel 是首个污染源** |
| v9 | NaN 全在 context 行，每行 24 个，坐标 i0≡3(mod 64) | **local_id=3 的 work-item 读 src0 出错** |

## 三、根因分析（底层）

### 3.1 concat kernel（首个污染源，v8/v9 实锤）
- 现象：`kernel_concat_f32` 输入 src0/src1 内容全部正常（hook 连续读 nan=0），输出含 3696 个 NaN + 巨大垃圾值（±2.7e37，近 float 溢出）。
- 坐标模式：NaN 全在 context 行（i1∈[0,154)），每行 24 个，i0 = 3, 67, 131…（i0 ≡ 3 mod 64）→ **恰好是 get_local_id(0)=3 的 work-item 写的位置**。
- 参数核验：src0/src1/dst 的 offset、view_offs、nb 全部正确（v8 打印实测），数据布局连续——**排除数据问题，锁定 work 映射**。
- 本质：kernel 用 `get_group_id(0)`=行、`get_local_id(0)` 循环列。Adreno 驱动在特定 work-group 布局下单个 lane 读写错位（未初始化内存读到垃圾/NaN）——**驱动级 work-group 语义与 kernel 假设不一致**。

### 3.2 softmax kernel（已修复，独立问题）
- `sub_group_reduce_max/add` 只覆盖 wave 局部；Adreno work-group(64) 拆多个 wave 时 reduce 不完整。
- 全 -inf 的 wave → max=-inf → exp(NaN)。
- 修复：local memory + barrier 全 work-group tree reduce（wave 大小无关），已落地 softmax_f32.cl。

### 3.3 共性
- **两个 kernel 都是"wave/group 语义假设"问题**——ggml 的 OpenCL kernel 按"work-group=完整处理单元"编写，而 Adreno 驱动对 work-group 的 wave 拆分/调度有自己的行为。
- llama.cpp 上游对 Adreno OpenCL 的持续专项修复（见 §4.3）印证这是**已知的、持续的适配战场**。

## 四、外部调研情报（写轮眼/学习引擎 2026-08-16）

### 4.1 官方 stable-diffusion.cpp 支持基线
- 官方 sd.cpp **支持 SD3（MMDiT 架构）**，有 Mac/Linux 实测案例；SD3.5 与 SD3 的 transformer 结构"基本相同"（官方 diffusers 文档），SD3.5 Large 在 sd.cpp Mac 端有高质量生成案例。
- **结论**：MMDiT 引擎适配有官方基线，不是"无中生有的自研架构"；但**官方 OpenCL 后端从未在 Adreno 移动 GPU 上验证过 SD3.5**。

### 4.2 concat 算子在 OpenCL 后端的历史
- ggml concat 是**较新算子**（stable-diffusion 引入，2023 年才有 ggml_concat 文档）；**f16/bf16 支持 2025 年才合入 llama.cpp**（#24724）——**concat 是 OpenCL 后端的薄弱算子**，移动 GPU 上几乎无真实用例。
- 未检索到"SD3.5 + Adreno OpenCL 白图"的公开直接案例——**我们是先行者，无现成答案可抄**。

### 4.3 llama.cpp Adreno OpenCL 适配活跃度（近两周）
- #26331 opencl: add Adreno xmem SDPA path（2026-08 开放）
- #26476 opencl: fix q6_K flat mul_mat for Adreno A6x/A7x（2026-08）
- #26477 opencl: quant GEMV / medium-batch GEMM optimizations（2026-08）
- #26383 opencl: limit local workgroup size for GLU operation
- **结论**：Adreno OpenCL 是上游持续投入的适配战场；**任何"修完就稳定"的假设都不成立**，补丁链不可控。

### 4.4 通用经验
- SD 系列 NaN 经典归因（webui 半精度问题）在我们的场景**已排除**（F32 主路径 + CPU 对照健康）。
- OpenCL 精度/驱动问题在移动 GPU（Adreno/Mali）普遍存在，Paddle-Lite 等框架为 Adreno 单独维护两套 conv 实现——**移动 GPU 适配成本高是行业共识**。

## 五、产品视角决策（锋利不臃肿 · 不兜底不补丁）

### 候选路线

| 路线 | 做法 | 成本 | 收益 | 风险 |
|---|---|---|---|---|
| **A. SD3.5 标记实验性（推荐基线）** | SD3.5 保留但 UI 标注"实验性·慢速"；**Z-Image-Turbo 为端侧主力**（待验证）；不为 Adreno 打 kernel 补丁 | 低 | 链路干净，不陷入补丁泥潭 | 依赖 Z-Image 验证通过；SD3.5 端侧价值未兑现 |
| **B. 修 concat kernel（一步验证）** | 扁平化 1D 索引重写 concat kernel（已写好），实测一次 | 中（一次构建+一次真机） | 若通过，SD3.5 OpenCL 全链路通 | 不确定是否还有其他 Adreno kernel 问题（softmax 已修，concat 修复后下一个未知） |
| **C. 升级内嵌 ggml** | 0.15.3 → 上游最新（含 concat/softmax/Adreno 全部修复） | 高（重工程，与 RN 编译链/embed_kernel 耦合） | 一劳永逸吸收上游适配 | 编译链风险大，需回归全模型（SDXL/Z-Image/DreamLite） |

### 推荐执行顺序

1. **B 先行**（低垂果实）：现有 concat 扁平化修复 + softmax 修复已验证方向，**一次真机实测**即可裁决。
   - 通过 → SD3.5 OpenCL 可用，收尾（清诊断代码、门禁 return）。
   - 失败（下一个 kernel 又炸）→ **停止打补丁，转 A**。
2. **A 兜底**（产品裁决）：Z-Image-Turbo 验证出图 → 标记 SD3.5 为"实验性"（仅 CPU 可用，UI 标注慢速），端侧主力切 Z-Image。
3. **C 排期**（长期）：记录技术债，与母仓引擎升级合并评估（不建议本迭代做）。

### 锋利原则检查
- ❌ 不做的：为 Adreno 逐个 kernel 打补丁（softmax→concat→下一个，补丁链无限）；不引入"混合后端按算子路由"这类兜底架构。
- ✅ 要做的：单次验证裁决（B）→ 失败即产品降级（A）；每个模型 manifest 明确"后端可用性"声明，UI 诚实标注。

## 六、遗留技术债（本次排查发现）

| 债 | 说明 | 建议 |
|---|---|---|
| GGML_OPENCL_KERNEL_CACHE_DIR 死变量 | JNI 设置但引擎无代码读取，每次重编译 kernel（数分钟） | 移除或实现真缓存 |
| embed_kernel.py 用 GBK 读 .cl | 中文注释触发 UnicodeDecodeError | 换 UTF-8 或全英文注释 |
| Adreno F16 KQ/KQV 特殊路径 | use_adreno_kernels 守卫，无真机性能基准 | 归入 A/C 路线后统一评估 |
| onnxruntime-react-native 版本漂移 | 1.24.3 patch 需手动重放（本次构建事故） | 登记 patch-package 后置钩子 |

## 七、待确认项（2026-08-16 已查）

- [x] **Z-Image-Turbo：未验证通过**（已查日志/文档）——模型已推送，但升级计划 L315 记录 "Z-Image 512×2/8 步，停 `generate_image begin` 无法跑"（OpenCL 卡加载）；**无成功出图记录 → 路线 A 当前不成立，B 的验证价值更高**
- [x] concat 扁平化修复真机结果（决定走 B 还是 A）——**已否决：concat kernel 无辜（v12 字节级一致），污染源在 concat 输入**
- [ ] 内嵌 ggml 0.15.3 与上游最新版差异清单（为 C 排期）

## 八、最终根因与修复（2026-08-16 小米 13 Adreno 740 全自动真机闭环）

### 根因（跨设备复现：K90 Adreno 840 + 小米 13 Adreno 740 相同 NaN 指纹）

**OpenCL 后端 RMS_NORM+MUL 融合跳过中间输出 + split_qkv view 引用 = 未初始化 buffer 读**

```
qkv Linear ✓ → permute/CONT ✓（健康）→ split_qkv 对 RMS_NORM 输出做 ggml_view_3d
★ ggml_opencl_can_fuse 将 RMS_NORM+MUL 融合成 kernel_rms_norm_mul（跳过 RMS_NORM 单独执行）
★ RMS_NORM 中间 buffer 从未写入 → split view 读未初始化内存（0+NaN+巨大值，c≡3 mod 64 模式）
→ RESHAPE → concat 忠实拷贝 → 下游全 NaN → 白图
```

**为何早期修复全部无效**：改 concat kernel（v12 字节级一致）、改 rms_norm kernel（v15 NaN=3696 不变）——因为 RMS_NORM kernel **根本没执行**（被融合吞掉），改它当然无效。

**修复（ggml-opencl.cpp + rms_norm.cl）**：
1. `ggml_opencl_can_fuse` RMS_NORM 分支：扫 cgraph 检查 RMS_NORM 输出是否被 view 引用，是则**禁用融合**（RMS_NORM 单独跑修复版 kernel_rms_norm）
2. `kernel_rms_norm` 改用 local memory + barrier tree reduce（消除 `get_max_sub_group_size()` 依赖，Adreno wave 实际尺寸不可靠）
3. **launch 的 local buffer 大小修正**：`sizeof(float)*nth/sgs`（=1 float！）→ `sizeof(float)*nth`（原代码 local memory 越界写，与 softmax 同源 bug）
4. `kernel_rms_norm_mul` 同步改 tree reduce + sum=nth（防御融合路径）

### 验证（三次独立运行全部 nan/inf=0）

| 运行 | 步数 | 尺寸 | 结果 |
|---|---|---|---|
| v15-1 | 28 | 512 | step 1 cond_out nan/inf=0 ✓（ANR 冻结中断） |
| v15-2 | 2 | 512 | step 1/2 采样 nan/inf=0 ✓，VAE 解码 1.94GB 分配失败 ✗ |
| v15-3 | 2 | 256 | **全流程成功：generate_image completed 1566s + 出图 256×256 0% 白 19408 色** ✓ |

### 遗留：VAE 解码 OpenCL 内存

512px VAE 解码需 1.94GB 单 buffer（Adreno 740 分配失败，可用内存 5.6GB 仍失败——疑 GPU 单分配/ION 限制）。256px 只需 416MB ✓。**待 K90（Adreno 840）验证 512px 是否可分配**。

> **2026-08-20 闭环更新**：Mali-G925 平板（天玑 9400+，红米平板）已实测 512px SD3.5 全流程成功（4 步 ~10.4 分钟，含 tiled VAE 解码）——512px VAE 在 Mali 上经 tiled 降级（rel_size=0.5，416MB/tile）可正常解码；Adreno 740 的失败为驱动单分配上限差异，非通用问题。

### 测试期临时配置（需恢复）

- `imageGenManifest.ts` sd35-medium-q4：steps 10→2、size 512→256（**验证后需恢复**）

> **2026-08-20 闭环更新**：正式参数已恢复（steps 10 / size 512，见 manifest defaults），K90/小米13/Mali 平板三设备全流程跑通。

---

## 九、512px VAE 解码内存修复 + Z-Image 跑通（2026-08-16 闭环）

### 9.1 问题：512px VAE 解码 1.94GB buffer 分配失败

- 采样（steps=2）本身正常（nan/inf=0），但 VAE 解码 graph 需 **2080637184 字节（1.94GB）** OpenCL buffer
- 小米 13（Adreno 740）：可用 5.6GB 仍失败——diffusion 2.1GB + conditioner 0.6GB 权重常驻 GPU，VAE 解码需额外 1.94GB → 超 GPU 单分配上限
- 256px 只需 416MB ✓（这就是 256px 能出图、512px 不能的根因）

### 9.2 修复（三层递进）

| 尝试 | 方案 | 结果 |
|---|---|---|
| ① | decode 前 unregister diffusion/conditioner 权重 | ✗ freed 0（active_prepare_count>0 拒绝） |
| ② | tiled 解码降级（去掉 auto_fit_enabled 条件，decode 失败自动重试） | 触发但 tile=64×64=全图（rel_size 默认 1.0） |
| ③ | **prepare_vae_decode_retry_tiling 设 rel_size=0.5**（tile=latent 一半=256px 像素） | ✓ **1.94GB → 416MB，9 tiles 解码成功** |

**文件**：
- stable-diffusion.cpp decode_first_stage：if (decoded.empty())（去掉 auto_fit_enabled 条件）
- backend_fit.cpp prepare_vae_decode_retry_tiling：rel_size_x/y = 0.5f

### 9.3 双设备验证结果（2026-08-16）

| 设备 | 芯片 | 512px VAE 解码 | 全流程耗时 | 出图 |
|---|---|---|---|---|
| 小米 13 (66b1777f) | Adreno 740 | tiled 降级（416MB，9 tiles） | 77.6 分钟（2 步） | ✓ 0% 白，64822 色 |
| **K90 (aab688d9)** | **Adreno 840** | **直接分配 1664MB（无需 tiled）** | **15.8 分钟（2 步）** | ✓ 0.029 白，53109 色 |

K90 max mem alloc size = 2048MB > 1.94GB → 单 buffer 直接分配成功。

### 9.4 Z-Image 跑通（K90，首次完整出图）

- 模型：z_image_turbo_q4_k.gguf (3.5G) + zimage_llm.gguf (2.3G) + ae.safetensors
- 总权重 6.9GB（VRAM），**之前 K90 卡 generate_image begin**——本次正常
- LLM 条件编码：141s（cond c_crossattn min=-4448 max=13423，nan/inf=0）
- 采样 8 步：2033s（33.9 分钟），**全部 step nan/inf=0**
- VAE 解码：1664MB 直接分配，206s
- **全流程 39.7 分钟，出图 0% 白、62342 色** ✓

### 9.5 收尾状态

- imageGenManifest.ts sd35-medium-q4：**已恢复正式参数 steps=10, cfg=4.5, size=512**
- Z-Image：实验性保留（OpenCL 端侧已可用）
- 采样超时（ANR）说明：512px 每步 12 分钟（Adreno 740）主线程无响应弹 ANR 对话框，用 .tmp/anr_killer.ps1 自动按 BACK 解除（循环 900 次=2 小时）；Adreno 840（K90）每步 ~3-6 分钟无此问题

---

## 十、正式参数完整跑 + Z-Image 可用性评估（2026-08-17 收尾）

### 10.1 SD3.5 正式参数（steps=10, cfg=4.5, size=512）K90 完整跑

- 采样 10 步 2425s（40.4 分钟），**全部 step nan/inf=0**（每步 ~3.8-4 分钟，Adreno 840）
- VAE 解码 1664MB 直接分配，79.4s
- **全流程 2748s（45.8 分钟），出图 0.4% 白、58445 色** ✓
- 结论：SD3.5 正式参数在 K90（Adreno 840）端侧完全可用

### 10.2 Z-Image 可用性评估（双设备）

| 设备 | 结果 | 说明 |
|---|---|---|
| **K90（Adreno 840）** | ✅ **可用** | 全流程 2380s（39.7 分钟）：LLM 编码 141s + 8 步采样 2033s（全 nan/inf=0）+ VAE 206s；出图 0% 白 62342 色 |
| 小米 13（Adreno 740） | ❌ 进程被杀 | Z-Image 总权重 6.9GB（LLM 2.3G + diffusion 3.3G + VAE），Adreno 740 GPU 内存不足 → 系统 LMK 杀进程（无 FATAL，ImageGen 日志中断） |

**结论**：
- Z-Image 端侧可用性以 **K90 为准**（6.9GB 权重需 Adreno 840 级 GPU 内存）
- 小米 13 适合 SD3.5（2.8GB 权重）或轻量模型，不适合 Z-Image（6.9GB）
- manifest experimental 标记建议保留（设备兼容性限制），note 更新为"K90 可用，小米 13 内存不足"

### 10.3 可用性现状总表

| 模型 | 设备 | 权重 | 512px 全流程 | 状态 |
|---|---|---|---|---|
| SD3.5 (10 步) | K90 | 2.8GB | 45.8 分钟 | ✅ 正式参数可用 |
| SD3.5 (2 步) | 小米 13 | 2.8GB | 77.6 分钟（tiled） | ✅ 可用（慢） |
| SD3.5 (4 步) | Mali 平板（Mali-G925） | 2.8GB | 10.4 分钟（fp32 通用路径） | ✅ 可用（2026-08-20 新增） |
| Z-Image (8 步) | K90 | 6.9GB | 39.7 分钟 | ✅ 可用 |
| Z-Image (8 步) | 小米 13 | 6.9GB | — | ❌ 内存不足 |
| Z-Image | Mali 平板（Mali-G925） | 6.9GB | — | ❌ GDN 内核不支持（引擎级，不做） |

### 10.4 技术债：排查期环境变量待恢复对照验证

- ImageGenJNI.cpp nativeLoadModel 中 GGML_OPENCL_ADRENO_XMEM_GEMM=0 与 GGML_OPENCL_DISABLE_ADRENO_KERNELS=1 为白图排查期禁用配置（注释："确认后决定禁用或修复"）
- **最终根因是 RMS_NORM+MUL 融合跳写（与 GEMM 无关）**——这两个禁用可能不再需要，恢复 Adreno 专用内核可能提升性能
- 待办：对照验证恢复后双设备出图无 NaN 再提交移除

> **2026-08-20 闭环更新**：6.17 已恢复默认内核对照验证（SD3.5 提速 4.8 倍且 nan/inf=0）；Z-Image 因 cross-attn 值域 ±1e4 在 Adreno fp16 累积溢出需 DISABLE=1 保精度、XMEM 真关防 VAE 内存峰值（8-20 XMEM 定稿 3.6 倍提速）——按模型族分治已定稿，非遗留待办。

### 10.5 GPU 分配能力佐证（max mem alloc）

- K90（Adreno 840）：ggml_opencl: max mem alloc size: 2048 MB，512px VAE 解码 1664MB **直接分配成功**
- 小米 13（Adreno 740）：VAE 解码时 ailed to allocate 1152.00 MiB（当时已占 2.7GB 权重）→ 峰值 GPU 分配能力明显低于 K90 → Z-Image 6.9GB 权重被杀的原因（GPU 等级差异，两台均 16GB RAM）
