# Mali 半精度 tiled GEMM — 改动地图（mali-half-prec-tiled-gemm）

> 载体：ggml-opencl 的 4 个 `l4_lm` tiled GEMM 内核 + ggml-opencl.cpp 编译门控
> 整理：2026-08-29（行号以当日工作副本为准，rebase 后按注释标志对位——禁止按行号迁移）
> 对应：handbook 铁律 3（半精度只碰存储，累加恒 fp32）；样板：`kernels/mali-half-prec-template.cl`

## 设计意图

Mali tiled GEMM 热点（CLPROF 实锤 71.1%）提速：**half 只用于 local 缓冲与乘法**（local 带宽减半），
累加器恒 fp32。全 fp16 累积在 2026-06-18 出过 NaN 事故（half 累加范围/精度崩坏），
故铁律：**乘法可以 half，累加必须 float**。编译期 `PP_MALI_FP16_LM` 宏 + 运行期
`GGML_OPENCL_MALI_FP16_LM` env 双重门控，unset 时行为与上游原版完全一致。

## Hunk 1+2：4 个内核 .cl 文件（同构改动 x4）

载体（4 文件，改动完全同构）：
1. `kernels/mul_mm_q4_k_f32_l4_lm.cl`（CLPROF 55.6%）
2. `kernels/mul_mm_q5_k_f32_l4_lm.cl`（CLPROF 15.5%）
3. `kernels/mul_mm_q4_0_f32_l4_lm.cl`（Klein DiT Q4_0，8-25 同法跟进）
4. `kernels/mul_mm_f32_f32_l4_lm.cl`（CLPROF 7.6%）

**1a. 缓冲类型抽象（每文件头，31-37 行或 12-19 行）**：

```c
// 8-25 B2-correct: Mali fp16 variant for the tiled GEMM hot path ([CLPROF] 55.6%).
// half local buffers (halves local-mem traffic) + half multiply, fp32 accumulate.
// Gate: -DPP_MALI_FP16_LM, runtime env GGML_OPENCL_MALI_FP16_LM (unset = original).
#ifdef PP_MALI_FP16_LM
typedef half pp_buf_t;
#define PP_STORE(x) ((half)(x))
#else
typedef float pp_buf_t;
...
```

**1b. 累加路径（各文件 accumulate 段 195-197 / 208-210 / 155-157 / 138-140）**：

```c
#ifdef PP_MALI_FP16_LM
// half multiply on the fp16 pipe, fp32 accumulate (6.18 NaN lesson).
sums[sums_idx] += (float)(cache_a[cr] * cache_b[cc]);
#else
sums[sums_idx] = mad(cache_a[cr], cache_b[cc], sums[sums_idx]);
```

- 意图：half×half 走 fp16 pipe（算力翻倍），立即升 float 累加——**sums 恒 float**。
- 回归要点：`sums` 声明处保持 fp32（不可引入 half acc）；`PP_STORE` 仅作用于从 global
  反量化后写入 local 的缓冲类型，不碰输出 C 的类型。

## Hunk 3：编译门控（ggml-opencl.cpp 1213-1217 行）

```cpp
// 8-25 B2-correct：[CLPROF] 实锤热点是 mul_mm_q4_k/q5_k_f32_l4_lm（71%）——
// tiled GEMM 半精度变体（half 缓冲 + half 乘法 + fp32 累加），同样 env 门控。
if (getenv("GGML_OPENCL_MALI_FP16_LM") != nullptr) {
    compile_opts += " -DPP_MALI_FP16_LM";
}
```

- 意图：env 门控把编译宏注入内核编译选项；unset = 原 float 路径零差异。
- 回归要点：与 CLPROF 探针（Hunk 4 的 env）彼此独立可组合；Mali 专属语义——
  建议上游侧以 gpu_family 过滤（Adreno 不受影响，各走各的；见 qcom-double-guard 资产）。

## 证据（真机实证）

- K Pad（Mali-G925 / turner，2026-06-18 转正）：512² 24.2 s/步（原 2.86×）、512×768 33 s/步（原 3.42×）；
- 回归：nan=0、输出值域 ±5 画质无损；
- 事故史：2026-06-18 全 fp16 累积 NaN 溢出——本资产的存在前提就是「累加恒 fp32」；
- 半精度红利只在 tiled GEMM（画幅越大 GEMM 占比越高）；flat GEMV 无收益（实测 0.1% 热点，未开）。

## 上游 PR 建议

1. 单 PR 一粒；message 必须含：Mali fp16 pipe 动机 + 6.18 NaN 事故教训 + 门控语义 + 加速证据；
2. 与 clprof 探针 PR 解耦（探针是工具，本资产是优化，reviewer 心智不同）；
3. 四个内核同构改动同 PR 提交（q4_0 Klein 变体可并）；
4. 建议附 `mali-half-prec-template.cl` 模式说明（PocketCL 已开放完整样板）。