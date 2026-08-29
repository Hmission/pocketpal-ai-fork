# PocketCL Handbook：端侧 GPU 调优五铁律

> 全部来自小黄鸡真机实证（K90 / Adreno 840 + REDMI K Pad / Mali-G925 + 小米 13 / Adreno 740），
> 每条附「现象 → 根因 → 做法 → 证据」。做引擎的朋友直接拿去用。

## 铁律 1：先 profiling 再优化，凭猜必打错靶

- **现象**：首轮凭经验改 `mul_mv` flat 内核，只拿到 1.09×。
- **根因**：热点在 `mul_mm_q4_k/q5_k_f32_l4_lm` tiled GEMM（占 71.1%）+ `mul_mm_f32_f32_l4_lm`（7.6%），flat GEMV 只占 0.1%。
- **做法**：用 CL_QUEUE_PROFILING 算子级探针（编译开关 + 运行 env 门控 + logcat top-N 聚合）先出算子榜单，再动手。
- **证据**：探针命中 tiled GEMM 后同法半精度化 → 2.86×（512²）/ 3.42×（512×768）。

## 铁律 2：编译期宏 ≠ 运行时能力（双重守卫）

- **现象**：Mali 设备编译 OpenCL 报 `unknown extension 'cl_qcom_subgroup_uniform_load'` / `implicit declaration of 'qcom_get_physical_sub_group_id'`。
- **根因**：qcom 专属内核只受 `#ifdef` 编译期宏保护，运行时没有 GPU 家族过滤，所有设备都会尝试编译。
- **做法**：任何 vendor-specific 内核必须「编译期宏 + 运行时 gpu_family 过滤」双保护；样板见 `kernels/guard-template.c`。
- **证据**：加守卫后 Mali 跳过编译、构建成功；Adreno 行为不变。

## 铁律 3：半精度只碰存储，累加恒 fp32

- **现象**：Mali 全 fp16 累积 → NaN 溢出事故（2026-06-18）。
- **根因**：half 乘法精度足够但 **half 累加**范围/精度崩坏；Mali 编译器对标量 half 生成病态代码，向量化即解。
- **做法**：half local 缓冲 + half 乘法 + **fp32 累加**（`PP_MALI_FP16_LM` 门控）；半精度红利只在 tiled GEMM（画幅越大占比越高），flat GEMV 无收益。
- **证据**：转正后 512² 24.2 s/步、512×768 33 s/步，nan=0、值域 ±5 画质无损。

## 铁律 4：NaN 先对比跨设备指纹，再查算子，不先怪设备

- **现象**：SD3.5 白图，第一反应怀疑驱动/设备。
- **根因**：定位方向错误浪费大量时间；K90 与小米 13 NaN 指纹完全一致 → 同源问题在算子层。
- **做法**：出问题先在两台以上异构设备上复现并对比 NaN 指纹（`GGML_OPENCL_DEBUG_NAN` 一类的 op 级 NaN 检查），指纹一致 → 算子层；不一致 → 设备/驱动层。
- **证据**：F16 KQ/KQV 路径 × Adreno fp16 累积内核精度崩坏，最终定位为内核守卫缺失（commit 107ae9c）。

## 铁律 5：Adreno 正确路径是 OpenCL，不是 Vulkan

- **现象**：Vulkan 后端在 Adreno 上 `ErrorDeviceLost`，社区零成功案例。
- **根因**：Adreno 闭源 Vulkan 驱动在 compute 路径不成熟（2026-08 现状）；ARM 官方推荐路径是 OpenCL。
- **做法**：Adreno/Mali 一律 OpenCL（xmem GEMM 激活 + 白名单分级）；Vulkan 只留作实验线（turnip 开源驱动研究）。
- **证据**：SD3.5 CPU 2h+ 不可用 → OpenCL 10.7min（11×+）；Z-Image 双禁用 39.7min → XMEM 真关 + tiled VAE 10.9min（3.6×）。

---

## 排查决策树（速查）

```
白图/NaN/崩溃
 ├─ 跨设备复现（≥2 台异构），对比 NaN 指纹
 │   ├─ 指纹一致 → 算子层：查累加精度（铁律3）/ 守卫缺失（铁律2）/ 融合跳写中间 buffer
 │   └─ 指纹不一致 → 设备/驱动层：跑分面板看 PSS/温度/GPU 负载，查驱动版本
 ├─ 性能不达标
 │   ├─ 出算子榜单（铁律1），按榜单攻热点
 │   └─ 检查设备分级与内核选择（白名单 → xmem/env 组合）
 └─ 内存不足 → tiled 解码（VAE 1.94GB→416MB 先例），再查叠加驻留
```