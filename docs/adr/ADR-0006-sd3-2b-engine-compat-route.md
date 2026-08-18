---
doc_id: ADR-0006
module: adr
type: adr
status: accepted
version: "1.0"
created: "2026-08-18"
updated: "2026-08-18"
relates:
  - docs/imagegen/IMAGEGEN_MODEL_TRAINING_SSOT.md
  - docs/adr/ADR-0005-sd35-lora-training-route.md
  - docs/POCKETPAL_IMAGE_GEN_UPGRADE_PLAN.md
---
<!-- D-FORMAT:v3 -->

# ADR-0006 SD3 2B 引擎兼容路线：手写 joint_blocks MMDiT 替代 SD3.5 Medium 微调

**状态**：accepted | **版本**：1.0 | **更新**：2026-08-18
**决策人**：啄木鸟 + 黑熊精 | **相关**：[训练域 SSOT](../imagegen/IMAGEGEN_MODEL_TRAINING_SSOT.md) · [ADR-0005](./ADR-0005-sd35-lora-training-route.md)

## 背景

ADR-0005 选定 SD3.5 Medium 做人体姿态 LoRA 微调，但真机部署验证时**架构级不兼容**：

- 真机 vendored 引擎（stable-diffusion.cpp）`ModelLoader::get_sd_version()` 靠 tensor 名判别架构：
  - `joint_blocks.` → VERSION_SD3（SD3 2B 架构）
  - `double_blocks/single_blocks` → FLUX（SD3.5 Large）
  - **无 `transformer_blocks`（SD3.5 Medium MMDiT）判别分支** → SD3.5 Medium 产物加载失败（`get sd version from file failed: ''`）
- 真机 manifest 标 "SD 3.5 Medium (Q4_K_M)" 的原版 GGUF **实为 SD3 2B 架构**（joint_blocks，648 tensors、qkv 融合、QK-norm、无前缀）

## 决策

**切换到引擎兼容的 SD3 2B 架构重新训练，自研手写 MMDiT 训练器**：

1. **手写模型**（`scripts/sd35_lora/06_sd3_2b_model.py`）：按引擎 `mmdit.hpp` 逐层复刻 SD3 2B MMDiT——norm1/norm2（无 affine LayerNorm）、per-head RMSNorm QK-norm、x_block 前 13 块带 attn2（adaLN 9×/6×/2× 分段、d_self 自动检测）、384×384 pos_embed 中心裁剪（非插值）、final_norm。
2. **训练**（`02b_train_sd3_2b.py`）：底座 = 引擎原版 GGUF 提取版 safetensors（`sd3_2b_qknorm.safetensors`，与引擎逐位一致）；encode_prompt 按引擎 SD3CLIPEmbedder 格式（CLIP-L/G hidden[-2] 特征维 concat → pad 4096，无 T5）；peft 注入 `qkv/proj/fc1/fc2/context_embedder`；flash attention（SDPA）提速；支持 checkpoint 续训。
3. **合并**（`03b_merge_sd3_2b.py`）：手动灌入 peft LoRA（绕开 `set_peft_model_state_dict` 静默失败）+ `base_layer.weight` 合并（peft LoraLayer 实际权重位置）→ 导出引擎原始命名 safetensors（无前缀 joint_blocks）。
4. **转换**：sd-cli `-M convert -m`（无前缀）→ f16 → `--type q4_K`（ggml type_name 大写 K）。
5. **部署**：产物覆盖真机 `sd35_medium_q4_k_m.gguf`（manifest 零改动），验证已出图成功。

## 理由与权衡

- **引擎能力边界不可绕过**：vendored 引擎源码级确认只支持 joint_blocks / FLUX 两种 DiT 判别；升级引擎（改 get_sd_version）涉及 Android 原生编译链，成本高于换底座重训。
- **diffusers 生态不支持 SD3 2B**：0.27/0.28/0.29/0.39 均无 joint_blocks（qkv 融合）结构 → 无法用官方训练脚本 → 手写模型（从引擎 GGUF 提取权重反推架构，参数量 2.47B 与官方一致）。
- **QK-norm 版本差异**：modelscope 单文件无 ln_q/ln_k，引擎 GGUF 有（per-head [64] 训练过）→ 底座必须用 GGUF 提取版保证引擎逐位兼容。
- **训练提速**：手写 einsum attention 每步 8.4s（7h+ 不可接受）→ 换 `F.scaled_dot_product_attention`（flash 内核）→ 每步 2.2s（~2h），显存 24GB→10GB。

## 被否决的替代方案

| 方案 | 否决原因 |
|------|----------|
| 继续 SD3.5 Medium（引擎升级 get_sd_version 判别） | 需改 vendored 引擎 + Android JNI 编译链 + 重新装机，成本高；且 SD3.5 Medium 与真机原版（SD3 2B）架构不同，伴侣文件/分辨率体系也要重对 |
| 用 modelscope 单文件 sd3_medium.safetensors 作训练底座 | 无 QK-norm（ln_q/ln_k），与引擎 GGUF 不一致 → 推理时引擎 QK-norm 权重与训练不匹配 |
| diffusers 加载 SD3 2B 后训练 | diffusers 全版本无 joint_blocks 支持，无法加载 |

## 影响

- **产物**：`sd3_2b_humanpose_q4_K.gguf`（2.24GB）替换真机 `sd35_medium_q4_k_m.gguf`（原版 `.bak` 已备份）。
- **训练资产**：`E:\sd35_lora\base2\sd3_2b_qknorm.safetensors`（底座）、`E:\sd35_lora\output_2b\`（LoRA）、`E:\sd35_lora\release_2b\`（发布）。
- **已验证**：3000 步训练（loss 0.1195）→ 合并（烘焙校验 4/4）→ 转换（665 tensors 与原版同构）→ 真机加载成功 → 512×512 出图成功。
- **后续演进**：SD3.5 Medium 训练产物不可真机部署，仅作研究保留；本路线成为端侧生图微调唯一有效路径。

## 验证

1. 手写模型冒烟：665 key 全加载、forward 无 NaN（`smoke_sd3_2b.py`）。
2. 训练 3000 步 loss 收敛（0.1195）。
3. 合并后抽查 4/4 权重与底座不同（LoRA 生效）。
4. GGUF 结构：665 tensors、joint_blocks 命名、无前缀（与原版一致）。
5. 真机：引擎加载成功（"✓ 模型已就绪"）+ 出图 PNG 有效（512×512）。

## 变更日志

| 日期 | 版本 | 变更 |
|------|------|------|
| 2026-08-18 | 1.0 | 首发：SD3 2B 引擎兼容路线决策（替代 ADR-0005 的 SD3.5 Medium 路线） |

## 关联文档

- [训练域 SSOT](../imagegen/IMAGEGEN_MODEL_TRAINING_SSOT.md)（imagegen）
- [ADR-0005](./ADR-0005-sd35-lora-training-route.md)（adr，SD3.5 路线被本 ADR 取代）
- [训练 SOP](../sop/IMAGEGEN_MODEL_TRAINING_SOP.md)（sop）
- [生图升级历史规划](../POCKETPAL_IMAGE_GEN_UPGRADE_PLAN.md)（superseded）
