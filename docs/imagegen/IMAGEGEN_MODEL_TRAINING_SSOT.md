---
doc_id: IMAGEGEN_MODEL_TRAINING_SSOT
module: imagegen
type: ssot
status: active
version: "1.0"
created: "2026-08-17"
updated: "2026-08-17"
relates:
  - docs/adr/ADR-0005-sd35-lora-training-route.md
  - docs/sop/IMAGEGEN_MODEL_TRAINING_SOP.md
  - docs/POCKETPAL_MODEL_MATRIX.md
  - docs/POCKETPAL_IMAGE_GEN_UPGRADE_PLAN.md
---
<!-- D-FORMAT:v3 -->

# 生图模型训练域 · SSOT（ImageGen Model Training）

**状态**：active | **版本**：1.0 | **更新**：2026-08-17

> **定位**：端侧生图模型的后训练微调（LoRA 为主）与训练产物部署的唯一真相源。定义训练边界、路线契约、产物格式与部署入口。
> **配套**：决策见 [ADR-0005](../adr/ADR-0005-sd35-lora-training-route.md)；操作见 [训练 SOP](../sop/IMAGEGEN_MODEL_TRAINING_SOP.md)。

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

1. **蒸馏模型不直接微调**：DMD2 / Lightning / schnell 类蒸馏少步模型（DreamLite-mobile、Z-Image-Turbo）直接训 LoRA 破坏蒸馏流形；微调对象限定为非蒸馏或已验证可微调模型（SD3.5 Medium 为当前唯一入选）。
2. **训练在 PC/云 GPU，端侧只消费产物**：扩散模型微调需梯度+优化器状态（显存 4-6 倍于推理），手机端不可行。训练机要求：NVIDIA GPU ≥16GB（3090/3090Ti/4090），CUDA ≥12.8。
3. **烘焙合并优先，运行时挂载为演进**：训练产物优先 merge 回完整权重 → 转 GGUF → 替换真机（零代码）；运行时 LoRA 挂载（manifest `lora` 字段 + 引擎 `LoraSpec` 通道）作为风格插件生态的后续演进。
4. **分辨率对齐 SD3.5 原生**：训练分辨率 1024（2:3 桶 1024×1536），保比例不变形，不 center-crop 正方形。
5. **可回滚是部署铁律**：真机替换前必须备份原文件（`.bak`），任何部署可一键回滚。
6. **数据质量先于训练**：去重（dHash）→ 过滤（损坏/过小/构图污染）→ 统一尺寸 → caption，四步缺一不可。

## 三、架构概要

```
E:\图\PoseBookCN（源数据 1007 张）
   │  01_prepare_dataset.py（清洗/去重/统一尺寸/caption）
   ▼
dataset/train/（300 张 1024×1536 + .txt caption）
   │  02_train_sd35_lora.py（diffusers 官方脚本 + 3090 调优）
   ▼
output/pytorch_lora_weights.safetensors（LoRA 增量 50-100MB）
   │  03_merge_and_convert.py（fuse_lora 烘焙 → city96 转 GGUF → quantize）
   ▼
release/sd35_medium_humanpose_q4_k_m.gguf（~1.8GB）
   │  04_deploy.sh（adb 备份/push/校验/冷启动）
   ▼
真机 /sdcard/Documents/AIOS/models/ → 生图页对比验证
```

训练产物链路四段式，每段独立可验证、可回滚。

## 四、状态模型

| 维度 | 说明 |
|------|------|
| 输入 | 源图片目录（jpg/png/webp）、底座模型（SD3.5 Medium diffusers 目录或 HF/ModelScope 下载）、LoRA 超参 |
| 输出 | 训练数据集（train/ + captions）、LoRA 权重、烘焙 GGUF、真机部署状态 |
| 持久状态 | `E:\sd35_lora\dataset\`（数据资产，可复训）、`E:\sd35_lora\output\`（LoRA 权重）、`E:\sd35_lora\release\`（发布产物） |
| 事件 / 日志 | 01 报告 CSV/JSON（清洗审计）、训练日志（accelerate）、04 部署日志（adb） |

## 五、契约

- **训练机契约**：NVIDIA GPU ≥16GB 显存；CUDA ≥12.8；torch cu128；diffusers ≥0.31；peft ≥0.6；accelerate；datasets。
- **产物契约**：
  - LoRA：safetensors 格式，可被 diffusers `load_lora_weights` + `fuse_lora` 消费。
  - GGUF：Q4_K_M 量化，与引擎 `sd35_medium_q4_k_m.gguf` 同格式同精度档，伴侣文件（clipL/clipG/vae）不变。
- **部署契约**：文件推 `/sdcard/Documents/AIOS/models/`；覆盖安装（`adb install -r`）不卸载；原模型备份 `.bak`。
- **与其他子系统的合同**：引擎域消费 main GGUF；生图页 UI 通过 manifest 读取模型条目（微调版可沿用原 manifest id，仅换 main 文件内容）。

## 六、健康指标

| 指标 | 阈值 / 说明 |
|------|-------------|
| 训练显存峰值 | ≤20GB（3090 24GB 预算内） |
| 训练单步耗时 | 4-8s（1024×1536，bf16 + LoRA rank16） |
| 3000 步总时长 | 4-8 小时 |
| 烘焙 GGUF 大小 | ~1.8GB（与 Q4_K_M 原版一致） |
| 部署完整性 | 本地/远端文件大小一致（04 脚本校验） |
| 数据合格率 | 损坏 0；去重后 >95% 保留 |

## 七、Gap Ledger

| Gap ID | 现象 | 补齐路径 |
|--------|------|----------|
| GAP-001 | 运行时 LoRA 挂载未接线（JNI 透传 + UI 开关） | 烘焙路线验证通过后评估路线 B，实现多 LoRA 风格切换 |
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

## 关联文档

- [训练 SOP](./IMAGEGEN_MODEL_TRAINING_SOP.md)（sop，跨域引用 docs/sop/）
- [ADR-0005](../adr/ADR-0005-sd35-lora-training-route.md)（adr）
- [模型矩阵](../POCKETPAL_MODEL_MATRIX.md)（模型阵容）
- [生图升级历史规划](../POCKETPAL_IMAGE_GEN_UPGRADE_PLAN.md)（superseded）
