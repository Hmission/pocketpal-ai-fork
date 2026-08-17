# 端侧生图三模型跑通里程碑（2026-08-17）

> 本地端侧（无网络、无云端）完整跑通三个生图模型：**DreamLite / SD3.5 / Z-Image**。
> 全部推理在手机 GPU（Adreno OpenCL 后端）完成，零依赖外部服务。
> 本文档汇总成果、路线、经验教训与技术债。

---

## 一、成果总览

| 模型 | 架构 | 权重体积 | 默认参数 | 真机实测 | 状态 |
|---|---|---|---|---|---|
| **DreamLite** | DMD2 蒸馏 UNet | ~0.4GB | 4 步 / 1024px / 无 CFG | 分钟级出图 | ✅ 正式 |
| **SD3.5 Medium** (Q4_K_M) | MMDiT | 2.8GB | 10 步 / 512px / cfg 4.5 | K90 45.8 分钟；小米13 tiled 兜底 | ✅ 正式参数可用 |
| **Z-Image-Turbo** (Q4_K) | DiT + LLM 条件 | 6.9GB | 8 步 / 512px / cfg 1.0 | K90 39.7 分钟 | ✅ 可用（去实验性标记） |

**关键数字**：
- 采样质量：三模型全部 step `nan/inf = 0`（白图/黑图问题根治）
- 出图质量：512px 出图 0% 白、5-6 万色（色彩丰富）
- 全程离线：模型 mmap 本地文件，无任何网络调用

---

## 二、三模型落地路线

### 2.1 DreamLite（早期，P5 系列任务）
- 端侧 UNet（ONNX/MNN）+ TinyVAE + Qwen-VL TE
- 经历：黑图回归（sigmas NaN + VAE 缩放因子）→ 修复
- 默认 1024px 4 步 DMD2 蒸馏，秒级-分钟级出图，最早跑通

### 2.2 SD3.5 Medium（2026-08-16 闭环，最曲折）
1. **白图根因**（OpenCL 后端）：RMS_NORM+MUL 融合跳过中间 buffer 写入 → split_qkv 的 view 读未初始化内存 → 全 NaN → 白图
2. **512px VAE 内存**：解码 graph 需 1.94GB buffer，Adreno 740 分配失败 → tiled 降级（1.94GB → 416MB）
3. **双设备验证**：K90（Adreno 840）45.8 分钟完整出图；小米 13 tiled 兜底 77.6 分钟（2 步）

### 2.3 Z-Image-Turbo（2026-08-16 闭环）
1. 三件套：z_image_turbo_q4_k.gguf（3.5G）+ zimage_llm.gguf（2.3G，LLM 条件）+ ae.safetensors（VAE）
2. 总权重 6.9GB——端侧最重模型，需 Adreno 840 级 GPU
3. LLM 条件编码 141s → 8 步采样 2033s（全 nan/inf=0）→ VAE 206s = 39.7 分钟
4. 大王确认去除实验性标记（2026-08-17）

---

## 三、关键经验教训

### 3.1 白图/NaN 排查方法论（SD3.5，多轮陷阱）
1. **融合优化会跳过中间 buffer 写入**——kernel fusion 正确性必须检查被 view 消费的输出；can_fuse 需验证 graph 消费者
2. **排查期先证明"kernel 是否执行"**——早期修改 rms_norm kernel 无效，因为被融合吞掉根本没跑；用 op 级 NaN 检查（GGML_OPENCL_DEBUG_NAN）定位
3. **cross-device 指纹复用**：K90（Adreno 840）与小米 13（Adreno 740）相同 NaN 指纹（c≡3 mod 64）→ 判定非设备特定问题
4. **local buffer 大小与 workgroup 语义**：`sizeof(float)*nth/sgs`（64/64=1 float）越界 → 改 `sizeof(float)*nth`

### 3.2 VAE 解码内存（tiled 三层递进）
1. 释放权重（unregister）→ 被 active_prepare_count 拒绝（freed 0）
2. tiled 降级触发但 tile=全图（get_tile_sizes 的 rel_size 默认 1.0 优先于 requested_size）
3. **最终方案**：`prepare_vae_decode_retry_tiling` 设 `rel_size=0.5`（tile=latent 一半）→ 1.94GB → 416MB，9 tiles 成功

### 3.3 设备分级（GPU 能力 ≠ RAM 大小）
- 两台测试机均 16GB RAM，但 **GPU 分配能力差异巨大**：
  - Adreno 840（K90）：max mem alloc 2048MB，VAE 1664MB 直接分配 ✓
  - Adreno 740（小米 13）：连 1152MB 都分配失败（已占 2.7GB 权重时）
- **结论**：模型可用性评估必须以 GPU 等级为准；6.9GB 权重（Z-Image）仅 Adreno 840 级可承载

### 3.4 长时生成 ANR 守护
- 512px 每步 12 分钟（Adreno 740）→ 主线程无响应弹 ANR 对话框 → 生成被冻结
- `.tmp/anr_killer.ps1`：后台循环检测 ANR 按 BACK 解除（900 次循环 ≈ 2 小时）
- Adreno 840（每步 3-6 分钟）无此问题

### 3.5 排查期调试开关管理
- 排查期加入的 setenv（ADRENO_XMEM_GEMM=0、DISABLE_ADRENO_KERNELS=1、DEBUG_NAN=1）
- **教训**：最终根因与 GEMM 无关，但禁用配置已被验证保留 → 成为技术债（见下）；DEBUG_NAN 已移除
- **经验**：排查开关应带"定位后移除/恢复"注释，闭环后逐项清理

---

## 四、技术债与待办

| # | 事项 | 说明 | 优先级 |
|---|---|---|---|
| 1 | ADRENO_XMEM_GEMM / DISABLE_ADRENO_KERNELS 对照验证 | 根因非 GEMM，恢复 Adreno 内核可能提速；需双设备验证无 NaN 后移除 | 中 |
| 2 | 低端设备（Adreno 740）SD3.5 提速 | 每步 ~12 分钟太慢；方向：恢复 Adreno 内核 / 步数-分辨率权衡 / CFG 优化 | 中 |
| 3 | Z-Image 低端设备策略 | 6.9GB 超 Adreno 740；方向：权重 offload 或明确设备门槛提示 | 低 |
| 4 | SD3.5 experimental 标记复核 | 大王仅去 Z-Image 标记；SD3.5 保留实验性（低端设备性能限制） | 待定 |

---

## 五、里程碑意义

- **端侧离线生图三模型全通**：从模型识别、加载、采样到 VAE 解码的完整链路在手机 GPU 闭环
- **白图问题根治**：NaN 指纹跨设备一致 → fusion 正确性审计 → 根因修复
- **内存墙突破**：tiled 降级让 512px 在低端 GPU 可用
- **方法论沉淀**：排查（op 级 NaN 检查、跨设备指纹）、修复（fusion 审计、tiled 参数）、守护（ANR killer）、管理（调试开关清理）
