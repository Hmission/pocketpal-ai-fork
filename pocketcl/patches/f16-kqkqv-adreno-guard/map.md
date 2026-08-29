# F16 KQ/KQV Adreno 守卫 — 改动地图（f16-kqkqv-adreno-guard）

> 载体：ggml-opencl.cpp + kernels/mul_mm_f16_f32_kq_kqv.cl
> 整理：2026-08-29。对应：handbook 铁律 4（NaN 先跨设备指纹对比）
> ⚠️ 当前代码形态 = **修复后**（commit 107ae9c）；本地图记录修复内容与对位要点。

## 事故链（为什么需要这个守卫）

- 现象：SD3.5 生图白图（NaN），首查怀疑驱动/设备；
- 指纹：K90（Adreno 840）与小米 13（Adreno 740）**NaN 指纹完全一致** → 同源问题在算子层；
- 根因：F16 KQ/KQV 路径（`mul_mm_f16_f32_kq/kqv` 内核）在 Adreno 上触发 fp16 累积精度崩坏，
  且该 Adreno 专用路径缺少守卫（非 Adreno/非匹配条件下可能被错误路径命中或行为未定义）。

## 修复形态（当前代码快照）

**声明（503-504 / 589-590）**：

```cpp
cl_program program_mul_mm_f16_f32_kqv;
cl_program program_mul_mm_f16_f32_kq;
...
cl_kernel kernel_mul_mm_f16_f32_kqv;
cl_kernel kernel_mul_mm_f16_f32_kq;
```

**构建（2252-2269）**：同源 `mul_mm_f16_f32_kq_kqv.cl` 双编译——KQV 变体带 `-DKQV`（内核内 `#ifdef KQV` 切换入口）。

**dispatch 守卫（14332-14356）——核心修复位**：

```cpp
#ifdef GGML_OPENCL_USE_ADRENO_KERNELS
    if(src0t == GGML_TYPE_F16 && src1t == GGML_TYPE_F32 && use_adreno_kernels(backend_ctx, src0)){
        if (ne01 >= 64 && ne1 >= 32 && ne00 >= 16 && (ne12 % ne02) == 0 &&
            // dst is wrapped with image1d_buffer, the size limit applies, also src0
            (ne0 * ne1 * dst->ne[2] * dst->nb[0] / 4 <= backend_ctx->image_max_buffer_size)) {
            // For KQ
            if (ggml_is_permuted(src0) && ggml_is_permuted(src1) &&
                ((nb01 * ne01 / 4)/4 <= backend_ctx->image_max_buffer_size) &&
                nb00 <= nb02 && nb02 <= nb01 && nb01 <= nb03 &&
                nb10 <= nb12 && nb12 <= nb11 && nb11 <= nb13) {
                ggml_cl_mul_mat_kq_kqv_adreno(backend, src0, src1, dst);
                return;
            }
            // For KQV
            if (!ggml_is_contiguous(src0) && ggml_is_contiguous(src1) &&
                ((nb02 * ne02 / 4)/4 <= backend_ctx->image_max_buffer_size)) {
                ggml_cl_mul_mat_kq_kqv_adreno(backend, src0, src1, dst);
                return;
            }
        }
    }
```

- 三重复合守卫：①编译期宏（ADRENO 内核族开关）②运行时 `use_adreno_kernels()`（GPU 家族 + 允许清单）
  ③形状/内存布局条件（image1d_buffer 尺寸上限、排列判定）；
- **回归要点**：任一层失败必须走通用 mul_mat 路径，不得 fallthrough 到 Adreno 内核。

## 上游 PR 建议

1. 以「本次为何从无条件 Adreno 路径改为守卫 dispatch」为 PR 主体，附白图事故 + 双设备 NaN 指纹对比证据；
2. 若上游已有同族守卫（qcom-double-guard 合并后），复用其判定函数，不另造；
3. `use_adreno_kernels()` 的 allow 清单语义要写清（哪些 src0 类型准入 F16 路径）。