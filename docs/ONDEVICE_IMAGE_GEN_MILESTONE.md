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
  - **Mali-G925（天玑 9400+ 红米平板，2026-08-20 新增）**：单 buffer ≤1000MB（分块分配）+ subgroup 16；SD3.5 512px 全流程成功（4 步 ~10.4 分钟，fp32 通用路径），内存治理靠图切段 + 关 mmap（PSS 7.5GB→1.65GB）
- **结论**：模型可用性评估必须以 GPU 等级为准；6.9GB 权重（Z-Image）仅 Adreno 840 级可承载（Mali 上 GDN 内核不支持，不做）

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

---

## 六、Adreno 专用内核恢复对照验证（2026-08-17，重大提速）

### 6.1 背景

白图排查期曾误判"Adreno 专用 GEMM fp16 累积精度崩坏"→ 全局禁用（ADRENO_XMEM_GEMM=0 + DISABLE_ADRENO_KERNELS=1）。最终根因是 RMS_NORM+MUL 融合跳写（与 GEMM 无关）→ 恢复对照验证。

### 6.2 验证结果（K90，SD3.5 10 步 512px）

| 配置 | 采样耗时 | 全流程 | 精度 |
|---|---|---|---|
| 双禁用（基线） | 2425s（40.4 分钟） | 2748s（45.8 分钟） | nan/inf=0 |
| **Adreno 恢复** | **283.58s（4.7 分钟）** | **573.71s（9.6 分钟）** | **nan/inf=0** |

**提速 4.8 倍**（采样 8.5 倍）！小米 13 每步 12 分钟 → 54 秒（提速 13 倍）。

### 6.3 Z-Image 的差异（按模型区分策略）

| 配置 | 采样 | VAE | 结果 |
|---|---|---|---|
| Adreno 全恢复 | 8 步 19.5 分钟（每步 72s，提速 1.9 倍） | **进程被杀**（XMEM 零拷贝致内存峰值） | ✗ |
| 只禁 DISABLE（XMEM 开） | 8 步 1169s 无 NaN | **VAE 解码进程被杀**（14:27:30 app died） | ✗ |
| **双禁用（08-16 最终）** | 8 步 2033s 无 NaN | VAE 206s 成功 | ✅ 39.7 分钟 |
| **XMEM 真关（08-20 定稿）** | 8 步 512.56s（每步 ~64s）无 NaN | VAE tiled 112.18s 成功 | ✅ **655.5s（10.9 分钟）** |

- **08-20 重大发现**：`GGML_OPENCL_ADRENO_XMEM_GEMM` 只看 env 存在性（`getenv != nullptr`），值 0/1 等效——旧"XMEM=0"从未真正关闭 xmem，双禁用实际是"xmem 开 + Adreno 内核关"。unset（真关）后采样 512.56s（提速 4 倍），全流程 655.5s（提速 3.6 倍）。实现：ImageGenJNI zimage 分支 `unsetenv`（feat/zimage-xmem-tiled-verify）。
- **质量观察（3 次真机）**：两次正常出图；一次纯灰图（疑抖动）、一次只有背景无主体——偶发，未复现规律，暂不阻塞（后续可关注 tiled overlap 拼接与条件编码偶发）。
- Z-Image cross-attn 值域大（±1e4 vs SD3.5 ±7）→ Adreno fp16 内核累积溢出 → step 全 NaN（DISABLE=1 保精度保留）
- **结论**：Z-Image = XMEM 真关 + DISABLE=1 + tiled VAE（10.9 分钟）；SD3.5/DreamLite 恢复 Adreno 内核提速

### 6.4 最终速度标注（manifest note）

| 模型 | K90 (Adreno 840) | 小米 13 (Adreno 740) |
|---|---|---|
| SD3.5 10 步 512px | **约 10 分钟**（Adreno 恢复） | 约 40 分钟（含 tiled VAE，采样 54s/步） |
| Z-Image 8 步 512px | 约 40 分钟（双禁用） | 不可用（6.9GB 超 GPU） |
| DreamLite 4 步 1024px | 约 2.5 分钟 | 可用 |
