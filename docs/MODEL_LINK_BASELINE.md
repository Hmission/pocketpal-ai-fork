# 模型执行链路基线（MODEL_LINK_BASELINE）

> 目的：每条生图/聊天模型链路的**已修好状态**精确固化，任何窗口/专工改动某条链路时
> **不得影响其它已验证链路**；链路被破坏时按本文档的「恢复方法」立即还原，禁止重新研发。
> 登记基线：2026-08-31（SD3.5 回归事故教训，见 §事故台账）。

---

## 0. 总规则（防串扰红绿线）

1. **单模型改动隔离**：修改任一条链路的引擎/env/内核/文件，必须先确认改动面**不出该链路域**
   （同文件被多链路共享时 = 改动面全链，必须跑全模型回归矩阵，见 §6）。
2. **回归门槛**：任何影响 `android/app/src/main/cpp/stable-diffusion.cpp/`（引擎）或
   `ImageGenJNI.cpp`（env 指纹）的提交，合入前必须跑 §6 回归矩阵（至少启动级/短步数冒烟）。
3. **基线即恢复点**：每条链路标注「基线 commit + 文件清单」，破坏后按 §恢复方法 精确还原，
   还原后跑该链路的验证用例（真机出图）确认闭环。
4. **改动链路的正确姿势**：新实验先在链路内做（env 门控/独立文件），**不留永久未门控改动**；
   实验探针用后即撤（本次 Q5_K 探针残留拖慢 SD3.5 出货的教训）。
5. **链路图谱图例**：下文 `▸ 决策链` = 该链路从 UI 到内核的完整路径；`▸ env 指纹` =
   JNI `nativeLoadModel` 实际 setenv/unsetenv 结果（权威在 ImageGenJNI.cpp）。

---

## 1. DreamLite（ONNX，编辑链路）

- **引擎**：ONNX Runtime（非 ggml）
- **入口**：`src/services/dreamLiteEngine.ts`
- **EP 指纹**：txt2img TE = `['nnapi','cpu']`（08-20/08-21 定稿，K90 TE 编码 -38.5%）；
  编辑链路 TE 定稿 **CPU**（NNAPI 数值失真，08-21 实证）
- **文件**：`dreamlite/unet_masked.onnx` + `vae_decoder/encoder.onnx` + `te_fp16.onnx(.data)` / `te_q8.gguf`
- **已验证基线**：三设备（K90/13U/K Pad）出图正常；13U 2026-08-31 复验正常
- **恢复方法**：引擎与 ggml 无关；若退化查 `dreamLiteEngine.ts` 的 executionProviders 与 ONNX 文件 md5

## 2. SD3.5（MMDiT，Q4_K_M）

- **引擎**：vendored sd.cpp → ggml-opencl（`stable-diffusion.cpp/`）
- **决策链**：manifest `sd35` 条目 defaults → ImageGenScreen（m.manifest.defaults.backend）→
  loadModel extras.backend → JNI params.backend → 引擎
- **env 指纹（8-17 已验证语义，2026-08-31 起为 A/B 对象）**：非 Mali 非 qwen_flow 分支 =
  `unset GGML_OPENCL_DISABLE_ADRENO_KERNELS` + `unset GGML_OPENCL_ADRENO_XMEM_GEMM`
  （= Adreno 专用内核线；备选恢复：DISABLE=1 通用 fp32 路径，K90 Z-Image 等效已验证）
- **内核**：Q4_K 转置/GEMM（Adreno 专用 gemm_noshuffle_q4_k_f32 / l4_lm 变体 / 通用 mul_mat），
  K 系列超块 QK_K=256（勿改 64）
- **文件**：`models/sd35_medium_q4_k_m.gguf` + `sd35_clip_l/clip_g/vae.safetensors`
  （+ `lora_humanpose.safetensors` 为 LoRA 选项）。md5 出厂基线 =
  sd35_medium `325156927c177795f3aae4af590f3292`、clip_l `81b87e64…`、clip_g `5e540a9d…`、vae `37c6102f…`（2026-08-31 核对）
- **已验证基线**：08-17 双设备（K90 ~10 分钟 / 13U ~40 分钟，0% 白图，大王确认去实验性标记）；
  08-20 K90 10 分钟复核
- **⚠️ 8-30 事故**：2.0.0（HEAD）双机（13U/K90）首次复跑 → 马赛克/纯灰（见 §7 事故台账）
- **恢复方法（2026-08-31 定稿，双机各行其道）**：引擎还原 `git checkout 43560227 -- android/app/src/main/cpp/stable-diffusion.cpp/`
  + ImageGenJNI 设备分流：
  - **K90（Adreno 8 系）＝ 8-17 引擎 + Adreno 专用内核线（DISABLE unset）→ ~10min ✅**
  - **13U（Adreno 740）＝ 8-17 引擎 + 通用 fp32 路径（DISABLE=1，与 Z-Image 同配置）→ ~3h ✅**（慢但正确）
  - 分流逻辑在 ImageGenJNI `else` 分支（设备名含 "740" → DISABLE=1）；**待 13U 快线找回专项（固件/CMake 层二分）成功后移除特判**

## 3. Z-Image（FLUX.1 系，Q4_K）

- **引擎**：vendored sd.cpp → ggml-opencl（与 SD3.5 同引擎、不同 env 指纹！）
- **env 指纹（8-20 定稿，勿动）**：`qwen_flow_family` + 非 klein 分支 =
  `setenv GGML_OPENCL_DISABLE_ADRENO_KERNELS=1` + `unset GGML_OPENCL_ADRENO_XMEM_GEMM`
  （**XMEM 必须真关**：存在即 =0/=1 等效，实测提速 3.6 倍 39.7→10.9 分钟）
- **文件**：`z_image_turbo_q4_k.gguf` + `zimage_llm.gguf`（TE，与 Klein 共享）+ `ae.safetensors`
- **已验证基线**：K90 08-20 XMEM 真关后 655.5s（10.9 分钟），nan/inf=0；08-24 复审通过；
  ✅ **08-31 引擎还原后复验通过（K90）**——证 8-17 引擎与 XMEM env 对 Z-Image 兼容，还原无损
- **恢复方法**：env 指纹来自 ImageGenJNI qwen_flow_family 分支；引擎还原同 §2 恢复方法

## 4. FLUX.2 Klein（Q5_K，DiT）

- **引擎**：vendored sd.cpp → ggml-opencl（Q5_K 专用路径）
- **env 指纹（8-28 拆分，勿与 Z-Image 混淆）**：`is_klein` → **不设 DISABLE**（走 Adreno 内核线）
  + `unset XMEM`；`defaults.backend='CPU'`（8-30 定稿：GPU 已知纹理不误导，CPU 兜底正确但 ~5h）
- **内核**：Q5_K gemm_noshuffle_q5_k_f32 + trans4_ns 布局（2fef8b2 重写，Q5_K 专用；
  **Q5_K convert 恒走 trans4_ns 由 `if(true)` 强制**——改此处波及全 Q5_K 链路）
- **文件**：`flux-2-klein-4b-Q4_K_M.gguf` + `flux2_vae.safetensors`（TE 复用 `zimage_llm.gguf`）
- **状态**：GPU 马赛克未修（Q5_K 压缩专项暂停，§125/§130）；**CPU 纯后端可用（~5h/张，8-30 定稿为 defaults.backend）**
- **⚠️ 8-29~8-30 Q5_K 专项（99b07d1/2fef8b2）提交了探针 + trans4 重写，而 8-17 后本链路外
  （SD3.5）未回归 → 2.0.0 首跑暴露 SD3.5 回归。教训见 §0.2

## 5. Krea2（Q4_K_M，experimental）

- **引擎**：vendored sd.cpp（llama TE）→ ggml-opencl
- **env 指纹**：`qwen_flow_family` + 非 klein = DISABLE=1 + XMEM unset（同 Z-Image 分支）
- **状态**：未调通（§96.7 定论：全驻留 9.9GB 超 OpenCL 7.5GB → OOM 三连；TE f16 ARM 溢出 SIGABRT）。
  文件已从真机删除（8-30），manifest experimental 保留；**恢复前禁止准入**

## 6. 回归矩阵（改动引擎/ImageGenJNI 必跑）

| 被改动链路 | 必回归链路 | 验证方式 |
|---|---|---|
| Q5_K（Klein）/K 系列转置 | SD3.5 + Z-Image | 双机出图（短步数冒烟 ≥1 张，全链路 ≥1 张） |
| Q4_K（SD3.5/Z-Image） | 另一条 Q4_K 链路 | 同上 |
| env 指纹（ImageGenJNI 分支） | 全部五条链路 env 复核 | 逐分支核对 setenv/unsetenv 清单 |
| 探针/编译选项（CMakeLists） | 全部（性能 + 数值） | 出图 + 无 cl_profiling.csv 残留 |
| TE/VAE 文件 | 引用该文件的链路 | md5 基线核对 |

冒烟基线（8-31 起）：DreamLite 25s 出图（全设备）×1；SD3.5 双机出图 ×1；K90 Z-Image ×1（可选）。

## 7. 事故台账

### 7.1 SD3.5 双机回归（2026-08-30/31，本次）
- 症状：13U + K90 的 2.0.0 SD3.5 首跑两张 均「马赛克 / 纯灰」；DreamLite 正常
- 时间线：8-17 双设备验证 OK（43560227）→ 8-18~8-30 引擎 6 笔提交（Mali/探针/Q5_K trans4，
  全部审计为对 SD3.5 数值等价）→ 8-30 2.0.0 首跑暴露 → 8-31 K90 复现（同 2.0.0）
- 已排除：模型 md5（三方一致）、提示词超长（54-token 复现）、NNAPI（仅 DreamLite）、
  kernel 缓存（无实现）、设备驱动（双机同错）
- 处置（**2026-08-31 闭环**）：K90 = 8-17 引擎 + Adreno 线 ← 10min ✅；13U = 8-17 引擎 + 通用路径 ← 3h ✅；
  双机策略定格：ImageGenJNI 按设备分流（Adreno 740 → DISABLE=1；其余 Adreno → DISABLE=0）
- 已证排除：引擎代码（A/B 双机一好一坏・K90 恢复）、模型 md5（三源一致）、系统驱动 .so（8-14→8-31 未变，
  0676.76.1）、提示词、NNAPI、kernel 缓存
- 挂起专项（13U 快线找回）：13U Adreno 专用内核线数值坍缩根因 = GPU 固件无声更新（驱动 so 未变但
  固件无可见时间戳）或 8-17 后 JS/Kotlin/CMake 层差异——待跑 8-17 全量包 A/B + 逐层二分，成功后移除
  740 特判（另注：8-17→HEAD 引擎 diff「数值等价」审计被 A/B 实测推翻，定向精准 diff 一并挂起）

### 7.2 教训登记
- 调 Klein（Q5_K 专项）时，探针/重写提交未跑 SD3.5 回归 → 出厂包首跑暴露（§0.2/§6 由此而来）
- 8-17 后 13 天 SD3.5 无真机回归 = 幽灵回归窗口；**链路基线文档 + 回归矩阵** 根治此类