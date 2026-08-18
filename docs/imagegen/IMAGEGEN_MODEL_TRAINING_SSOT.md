---
doc_id: IMAGEGEN_MODEL_TRAINING_SSOT
module: imagegen
type: ssot
status: active
version: "2.0"
created: "2026-08-17"
updated: "2026-08-18"
relates:
  - docs/adr/ADR-0005-sd35-lora-training-route.md
  - docs/adr/ADR-0006-sd3-2b-engine-compat-route.md
  - docs/adr/ADR-0007-runtime-lora-mount-switch.md
  - docs/sop/IMAGEGEN_MODEL_TRAINING_SOP.md
  - docs/POCKETPAL_MODEL_MATRIX.md
  - docs/POCKETPAL_IMAGE_GEN_UPGRADE_PLAN.md
---
<!-- D-FORMAT:v3 -->

# 生图模型训练域 · SSOT（ImageGen Model Training）

**状态**：active | **版本**：2.0 | **更新**：2026-08-18

> **定位**：端侧生图模型的后训练微调（LoRA 为主）与训练产物部署的唯一真相源。定义训练边界、路线契约、产物格式与部署入口。
> **配套**：决策见 [ADR-0005](../adr/ADR-0005-sd35-lora-training-route.md)（SD3.5 路线，被取代）与 [ADR-0006](../adr/ADR-0006-sd3-2b-engine-compat-route.md)（SD3 2B 引擎兼容路线，现行）；操作见 [训练 SOP](../sop/IMAGEGEN_MODEL_TRAINING_SOP.md)。

## 一、定位与边界

- **负责**：
  - 端侧生图模型（SD3.5 / Z-Image / DreamLite）的后训练微调路线设计与执行
  - 训练数据预处理（清洗 / 去重 / 统一尺寸 / caption）
  - 训练产物 → 端侧可部署格式（GGUF）的转换与验证
  - 训练产物真机部署与回滚
- **不负责**（明确排除）：
  - 端侧推理引擎（stable-diffusion.cpp / ONNX JNI）的代码修改——引擎域（docs/engine/）
  - 生图页 UI/交互（模型选择、参数面板）——生图页 UI 域（POCKETPAL_IMAGEGEN_UI_SPEC）
  - 模型文件托管/分发/下载通道——模型域（docs/models/）
  - 文本聊天模型微调——本域只覆盖生图模型
- **上下游**：
  - 读：`POCKETPAL_MODEL_MATRIX`（模型阵容）→ 本域决定哪些模型可微调
  - 被读：`IMAGEGEN_MODEL_TRAINING_SOP`（操作）引用本域契约；引擎域消费训练产物 GGUF

## 二、核心原则 / 公理

1. **蒸馏模型不直接微调**：DMD2 / Lightning / schnell 类蒸馏少步模型（DreamLite-mobile、Z-Image-Turbo）直接训 LoRA 破坏蒸馏流形；微调对象限定为非蒸馏或已验证可微调模型。**现行唯一入选：SD3 2B（joint_blocks，引擎兼容架构）**——SD3.5 Medium 已被引擎架构判别否决（见公理 7）。
2. **训练在 PC/云 GPU，端侧只消费产物**：扩散模型微调需梯度+优化器状态（显存 4-6 倍于推理），手机端不可行。训练机要求：NVIDIA GPU ≥16GB（3090/3090Ti/4090），CUDA ≥12.8。
3. **烘焙合并优先，运行时挂载为演进**：训练产物优先 merge 回完整权重 → 转 GGUF → 替换真机（零代码）；运行时 LoRA 挂载（manifest `lora` 字段 + 引擎 `LoraSpec` 通道）作为风格插件生态的后续演进。**（2026-08-18：路线 B 已落地，见 [ADR-0007](../adr/ADR-0007-runtime-lora-mount-switch.md)——base 模型 + 独立 LoRA 文件 + 生图页秒级开关）**
4. **分辨率对齐模型原生**：训练分辨率 1024（2:3 桶 1024×1536），保比例不变形，不 center-crop 正方形；SD3 2B 的 384×384 pos_embed 支持中心裁剪任意 ≤384² 的 patch 网格。**（2026-08-18：非 Dream 模型（SD3.5/Z-Image）高级参数已补比例档 `SD_RATIOS`（1:1/2:3/3:2/3:4/4:3，512 级 16 倍数像素），2:3 竖图对齐人体姿态训练分布）**
5. **可回滚是部署铁律**：真机替换前必须备份原文件（`.bak`），任何部署可一键回滚。
6. **数据质量先于训练**：去重（dHash）→ 过滤（损坏/过小/构图污染）→ 统一尺寸 → caption，四步缺一不可。
7. **引擎架构兼容是硬约束**：vendored 引擎（stable-diffusion.cpp）`get_sd_version()` 只识别 `joint_blocks`（SD3 2B）/ `double_blocks`（FLUX）——`transformer_blocks`（SD3.5 Medium）无判别分支，产物加载失败。**训练底座必须与引擎原版架构逐位一致**（含 QK-norm、pos_embed 布局、无前缀命名），否则端侧不可部署。

## 三、架构概要

```
E:\图\PoseBookCN（源数据 1007 张）
   │  01_prepare_dataset.py（清洗/去重/统一尺寸/caption）
   ▼
dataset/train/（300 张 1024×1536 + .txt caption）
   │  06_sd3_2b_model.py（手写 SD3 2B MMDiT，引擎 mmdit.hpp 复刻）
   │  02b_train_sd3_2b.py（SD3 2B LoRA 训练：SDPA flash + checkpoint 续训）
   ▼
output_2b/pytorch_lora_weights.safetensors（LoRA 增量 440 key）
   │  03b_merge_sd3_2b.py（手动灌入 + base_layer 合并 → 引擎命名 safetensors）
   ▼
release_2b/sd3_2b_humanpose_q4_K.gguf（~2.24GB，q4_K 大写 K）
   │  04_deploy.sh（adb 备份/push/校验/冷启动）
   ▼
真机 /sdcard/Documents/AIOS/models/sd35_medium_q4_k_m.gguf（覆盖，manifest 零改动）→ 出图验证
```

训练产物链路四段式，每段独立可验证、可回滚。SD3.5 Medium 路线（02/03 脚本）已废弃为研究保留（引擎不识别）。

## 四、状态模型

| 维度 | 说明 |
|------|------|
| 输入 | 源图片目录（jpg/png/webp）、底座模型（SD3.5 Medium diffusers 目录或 HF/ModelScope 下载）、LoRA 超参 |
| 输出 | 训练数据集（train/ + captions）、LoRA 权重、烘焙 GGUF、真机部署状态 |
| 持久状态 | `E:\sd35_lora\dataset\`（数据资产，可复训）、`E:\sd35_lora\output\`（LoRA 权重）、`E:\sd35_lora\release\`（发布产物） |
| 事件 / 日志 | 01 报告 CSV/JSON（清洗审计）、训练日志（accelerate）、04 部署日志（adb） |

## 五、契约

- **训练机契约**：NVIDIA GPU ≥16GB 显存；CUDA ≥12.8；torch cu128；peft ≥0.6；transformers；safetensors；diffusers（仅 VAE）。
- **产物契约**：
  - LoRA：safetensors 格式，peft key（`base_model.model.blocks.`），可被 03b 合并脚本消费。
  - 底座 safetensors：引擎原版 GGUF 提取版（`sd3_2b_qknorm.safetensors`，带 QK-norm、无前缀），是训练与合并的唯一底座来源。
  - GGUF：`q4_K` 量化（ggml type_name 大写 K），tensor 名 joint_blocks 无前缀，与引擎原版 665 tensors 同构；部署文件名沿用 `sd35_medium_q4_k_m.gguf`（manifest 零改动），伴侣文件（clipL/clipG/vae）不变。
- **部署契约**：文件推 `/sdcard/Documents/AIOS/models/`；覆盖安装（`adb install -r`）不卸载；原模型备份 `.bak`。
- **与其他子系统的合同**：引擎域消费 main GGUF；生图页 UI 通过 manifest 读取模型条目（微调版沿用原 manifest id，仅换 main 文件内容）。

## 六、健康指标

| 指标 | 阈值 / 说明 |
|------|-------------|
| 训练显存峰值 | ≤10GB（flash attention 后实测 10.2GB，3090 24GB 预算内） |
| 训练单步耗时 | ~2.2s（1024×1536，bf16 + LoRA rank16 + SDPA flash） |
| 3000 步总时长 | ~2 小时 |
| 烘焙 GGUF 大小 | ~2.24GB（q4_K，与原版结构一致 665 tensors） |
| 部署完整性 | 本地/远端文件大小一致（04 脚本校验） |
| 数据合格率 | 损坏 0；去重后 >95% 保留 |

## 七、Gap Ledger

| Gap ID | 现象 | 补齐路径 |
|--------|------|----------|
| GAP-001 | 运行时 LoRA 挂载未接线（JNI 透传 + UI 开关） | ✅ 已闭环（2026-08-18 ADR-0007）：JNI/引擎/透传链路本就存在；补格式转换 + UI 开关 + base 模型回退 |
| GAP-002 | caption 为统一模板（非自动打标） | 数据扩容时用 Florence-2/BLIP 自动打标提升 prompt 语义对齐 |
| GAP-003 | 端侧模型替换后无内置 A/B 对比入口 | 验证期人工对比（原版 .bak ↔ 微调版），后续可做应用内对比功能 |

## 八、关联

- **同层子系统**：生图页 UI（POCKETPAL_IMAGEGEN_UI_SPEC）、引擎域（docs/engine/）、模型域（docs/models/）
- **相关 ADR**：[ADR-0005-sd35-lora-training-route](../adr/ADR-0005-sd35-lora-training-route.md)（烘焙合并路线决策）
- **操作手册 (SOP)**：[IMAGEGEN_MODEL_TRAINING_SOP](../sop/IMAGEGEN_MODEL_TRAINING_SOP.md)

## 变更日志

| 日期 | 版本 | 变更 |
|------|------|------|
| 2026-08-17 | 1.0 | 首发：训练域边界、路线契约、四段流水线 |
| 2026-08-18 | 2.0 | 架构切换：SD3.5 Medium（引擎不识别）→ SD3 2B 手写 MMDiT（ADR-0006）；训练/合并/转换/部署全链路闭环，真机出图验证通过 |
| 2026-08-18 | 2.1 | 路线 B 落地：运行时 LoRA 挂载开关（ADR-0007），GAP-001 闭环 |
| 2026-08-18 | 2.2 | 非 Dream 模型高级参数补比例档（SD_RATIOS 1:1/2:3/3:2/3:4/4:3，替代固定方形尺寸），出图宽高按比例派生 |
| 2026-08-18 | 2.3 | 提示词限制改按 token 计：各模型编码器硬限（DreamLite 128 / SD3.2B 77 CLIP / Z-Image 256），替代原 120 字符（≈30 tokens 过低） |

## 关联文档

- [训练 SOP](./IMAGEGEN_MODEL_TRAINING_SOP.md)（sop，跨域引用 docs/sop/）
- [ADR-0005](../adr/ADR-0005-sd35-lora-training-route.md)（adr，SD3.5 路线被取代）
- [ADR-0006](../adr/ADR-0006-sd3-2b-engine-compat-route.md)（adr，现行 SD3 2B 路线）
- [模型矩阵](../POCKETPAL_MODEL_MATRIX.md)（模型阵容）
- [生图升级历史规划](../POCKETPAL_IMAGE_GEN_UPGRADE_PLAN.md)（superseded）
