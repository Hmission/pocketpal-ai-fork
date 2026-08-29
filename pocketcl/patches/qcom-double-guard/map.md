# qcom 扩展双重守卫 — 改动地图（qcom-double-guard）

> 载体：ggml-opencl.cpp + 9+ 个 qcom 专属内核 .cl（gemm_*_ns.cl 家族 + gemm_xmem_f16_f32_os8.cl）
> 整理：2026-08-29。对应：handbook 铁律 2 + 样板 `kernels/guard-template.c`

## 设计意图

qcom 专属内核依赖 `cl_qcom_subgroup_uniform_load` / `qcom_get_physical_sub_group_id()` 等
**非 Khronos 标准扩展**：Mali（或任何非 Adreno 驱动）上只要尝试编译就会
`unknown extension` / `implicit declaration` 崩溃。守护 = **编译期宏 + 运行时 gpu_family 过滤**双保护。

## 双守卫实装（ggml-opencl.cpp）

**① 编译期宏层**（4188-4193）：

```cpp
#ifdef GGML_OPENCL_USE_ADRENO_KERNELS
    GGML_LOG_INFO("ggml_opencl: using kernels optimized for Adreno (GGML_OPENCL_USE_ADRENO_KERNELS)\n");
    ...
#endif // GGML_OPENCL_USE_ADRENO_KERNELS
```

**② 运行时过滤层**（4413-4421）：

```cpp
#ifdef GGML_OPENCL_USE_ADRENO_KERNELS
    // determine whether to use Adreno xmem GEMM
    backend_ctx->adreno_xmem_gemm_enabled = getenv("GGML_OPENCL_ADRENO_XMEM_GEMM") != nullptr &&
                                             backend_ctx->gpu_family == GPU_FAMILY::ADRENO;
#endif

    // determine whether to use large buffer for Adreno
    backend_ctx->adreno_use_large_buffer = getenv("GGML_OPENCL_ADRENO_USE_LARGE_BUFFER") != nullptr &&
                                           backend_ctx->gpu_family == GPU_FAMILY::ADRENO;
```

- 意图：env（编译期宏语义）**且** gpu_family==ADRENO 才启用——缺一即关；
- 内核源（9+ 个 .cl）头部的 `#pragma OPENCL EXTENSION cl_qcom_*` 无条件声明，
  由上层守卫拦截"是否把这些源喂给 clBuildProgram"，Mali 永不接触。

## qcom 内核家族清单（同守卫覆盖）

`gemm_xmem_f16_f32_os8.cl`（118 行 `qcom_get_physical_sub_group_id()` 调用源）、
`gemm_moe_q4_0/q4_1/q4_k/q5_0/q5_1/q5_k/q6_k/mxfp4_f32_ns.cl`（头部 4 行 qcom 扩展 pragma）。

## 事故与修复证据

- 现象：Mali 设备编译 OpenCL 报 `unknown extension 'cl_qcom_subgroup_uniform_load'` /
  `implicit declaration of 'qcom_get_physical_sub_group_id'`；
- 根因：qcom 内核只受编译期宏保护，运行时无 GPU 家族过滤，所有设备都尝试编译；
- 修复：双守卫补上后 Mali 跳过编译、构建成功；Adreno 行为不变（各走各的）。

## 上游 PR 建议

1. upstream ggml 对 vendor 扩展内核已有 gpu_family 判定的惯例（`GPU_FAMILY::ADRENO` 枚举已在上游），
   本 PR 即以该判定统一收紧 qcom 内核编译条件；
2. 附 guard-template.c 的说明性节选（模式文档化，帮助 reviewer 理解多厂商约束）。