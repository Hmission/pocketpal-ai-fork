---
doc_id: ADR-0005
module: adr
type: adr
status: accepted
version: "1.0"
created: "2026-08-17"
updated: "2026-08-17"
relates:
  - docs/imagegen/IMAGEGEN_MODEL_TRAINING_SSOT.md
  - docs/sop/IMAGEGEN_MODEL_TRAINING_SOP.md
  - docs/POCKETPAL_IMAGE_GEN_UPGRADE_PLAN.md
---
<!-- D-FORMAT:v3 -->

# ADR-0005 SD3.5 Medium LoRA 微调：烘焙合并路线 + 端侧零代码部署

**状态**：accepted | **版本**：1.0 | **更新**：2026-08-17
**决策人**：大王 + 黑熊精 | **相关**：[训练域 SSOT](../imagegen/IMAGEGEN_MODEL_TRAINING_SSOT.md) · [训练 SOP](../sop/IMAGEGEN_MODEL_TRAINING_SOP.md)

## 背景

需求：用 `E:\图\PoseBookCN`（1007 张人体姿态图）对 SD3.5 Medium 做后训练微调，强化端侧人体/姿态生成能力。本机已换 RTX 3090 Ti 24GB（驱动 591.86 / CUDA 13.1），torch 2.10.0+cu128 已就绪。

微调对象候选：SD3.5 Medium（2.5B MMDiT，diffusers 官方 LoRA 训练脚本原生支持）与 DreamLite-mobile（DMD2 蒸馏 4 步模型）。

## 决策

**采用「SD3.5 Medium + LoRA 烘焙合并」路线，端侧走零代码部署**：

1. **训练**：diffusers 官方 `train_dreambooth_lora_sd3.py`，LoRA rank 16 / alpha 32 / bf16 / 梯度检查点，分辨率 1024（2:3 桶），只训 transformer 冻结 3 个文本编码器。
2. **烘焙**：`pipe.fuse_lora()` 把 LoRA 增量合并回完整 SD3.5 Medium safetensors → city96 转换链转 GGUF → `quantize q4_k_m`。
3. **部署**：产物 `sd35_medium_humanpose_q4_k_m.gguf` 直接替换真机同名文件（原文件备份 `.bak`），manifest 与伴侣文件（clipL/clipG/vae）零改动。

## 理由与权衡

- **SD3.5 微调生态成熟**：官方训练脚本、社区 LoRA 工具链、GGUF 转换链完整；3090 24GB 单卡可跑（bf16 + LoRA 峰值 ~20GB）。
- **端侧零代码**：vendored stable-diffusion.cpp 的 main GGUF 文件即完整推理权重，烘焙后替换即生效；manifest 无需改，伴侣文件（文本编码器/VAE）不参与 LoRA 训练无需更新。
- **数据质量已验证**：1007 张 0 损坏、3 组重复、竖图 82%（2:3 主流 1800×2700），预处理后 300 张统一 1024×1536，符合 SD3.5 原生分辨率。

## 被否决的替代方案

| 方案 | 否决原因 |
|------|----------|
| **DreamLite-mobile 直接微调** | DMD2 蒸馏 4 步模型，直接训 LoRA 破坏蒸馏流形（FLUX-schnell/DMD2 同坑）；正确路径需 base 版 + 重蒸馏，成本远超 LoRA 本身 |
| **运行时 LoRA 挂载（路线 B）** | manifest 已预留 `lora` 字段 + 引擎原生 `LoraSpec` 通道，但需 JNI 透传 + UI 开关 + GGUF 化 LoRA 工具链，本期投入大；烘焙路线先闭环验证效果，路线 B 作为后续「风格插件」生态演进 |
| **全参数微调 SD3.5** | 2.5B 全参微调需 >40GB 显存且产物 5GB+，端侧替换成本高；LoRA 效果足够（风格/类别强化场景） |

## 影响

- **产物**：`sd35_medium_humanpose_q4_k_m.gguf`（~1.8GB）替换真机 `sd35_medium_q4_k_m.gguf`。
- **可回滚**：`.bak` 备份原模型，`cp` 即回滚。
- **数据资产**：`E:\sd35_lora\dataset\`（可复训）、`E:\sd35_lora\output\`（LoRA 权重可再合并）。
- **后续演进**：验证通过后可评估路线 B（运行时挂载）实现多 LoRA 风格切换，无需重训练。

## 验证

1. 训练产物 LoRA 可 fuse 回底座（03 脚本 `--skip-gguf` 先行验证 safetensors 出图）。
2. GGUF Q4_K_M 转换完成且大小 ~1.8GB。
3. 真机部署后同一 prompt（"a person in a dynamic pose, full body..."）微调版 vs 原版对比：姿态多样性、人体结构正确性、画质。
4. 失败回滚：`cp sd35_medium_q4_k_m.gguf.bak sd35_medium_q4_k_m.gguf`。

## 变更日志

| 日期 | 版本 | 变更 |
|------|------|------|
| 2026-08-17 | 1.0 | 首发：烘焙合并路线决策 |

## 关联文档

- [训练域 SSOT](../imagegen/IMAGEGEN_MODEL_TRAINING_SSOT.md)（imagegen）
- [训练 SOP](../sop/IMAGEGEN_MODEL_TRAINING_SOP.md)（sop）
- [生图升级历史规划](../POCKETPAL_IMAGE_GEN_UPGRADE_PLAN.md)（superseded）
