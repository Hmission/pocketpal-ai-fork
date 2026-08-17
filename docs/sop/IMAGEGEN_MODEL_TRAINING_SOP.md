---
doc_id: IMAGEGEN_MODEL_TRAINING_SOP
module: sop
type: sop
status: active
version: "1.0"
created: "2026-08-17"
updated: "2026-08-17"
relates:
  - docs/imagegen/IMAGEGEN_MODEL_TRAINING_SSOT.md
  - docs/adr/ADR-0005-sd35-lora-training-route.md
---
<!-- D-FORMAT:v3 -->

# 生图模型训练 · SOP（ImageGen Model Training Operations）

**状态**：active | **版本**：1.0 | **更新**：2026-08-17

> **定位**：SD3.5 Medium 人体姿态 LoRA 训练与部署的日常运维、验证与故障排查操作手册。SSOT 见 [`IMAGEGEN_MODEL_TRAINING_SSOT.md`](../imagegen/IMAGEGEN_MODEL_TRAINING_SSOT.md)。

## 一、独立运行验证（standalone smoke）

### 1.1 快速验证

```bash
# 环境就绪（已装齐 2026-08-17）
python -c "import torch; print(torch.__version__, torch.cuda.is_available(), torch.cuda.get_device_name(0))"
# 期望: 2.10.0+cu128 True NVIDIA GeForce RTX 3090 Ti

# 训练命令链路（不真正启动）
python 02_train_sd35_lora.py --dataset E:\sd35_lora\dataset\train --output E:\sd35_lora\output --steps 3000 --dry-run
# 期望: 打印完整 accelerate launch 命令后 [DRY-RUN] 未执行
```

### 1.2 验证产物/状态完整性

| 检查点 | 命令 | 期望 |
|--------|------|------|
| 数据集 | `ls E:\sd35_lora\dataset\train/*.jpg \| wc -l` | 300（或全量 897） |
| caption 配对 | `ls E:\sd35_lora\dataset\train/*.txt \| wc -l` | 与图片数一致 |
| 尺寸统一 | 抽查 `python -c "from PIL import Image; print(Image.open('<图>').size)"` | (1024, 1536) |
| LoRA 产物 | `ls E:\sd35_lora\output\pytorch_lora_weights.safetensors` | 存在，50-100MB |
| GGUF 产物 | `ls E:\sd35_lora\release\sd35_medium_humanpose_q4_k_m.gguf` | 存在，~1.8GB |
| 真机文件 | `adb shell ls -l /sdcard/Documents/AIOS/models/` | 微调版 + `.bak` 备份都在 |

### 1.3 退出码 / 状态速查

| 退出码/状态 | 含义 | 排查方向 |
|------|------|----------|
| 0 | 成功 | — |
| 1（02 脚本） | 环境/数据集/底座问题 | 看 stderr：torch CUDA 不可用 / 数据 <10 张 / 底座下载失败 |
| 1（04 脚本） | adb 设备离线 / 文件缺失 / 大小不一致 | 检查 adb devices、文件路径、重推 |
| CUDA OOM | 显存超限 | 降 batch_size / 关其他 GPU 进程 |

## 二、日常操作

### 2.1 检查健康

```bash
# GPU 可用
nvidia-smi --query-gpu=name,memory.free --format=csv
# 磁盘（模型+训练约需 30GB）
# C: 1.8TB / E: 913GB / F: 2.5TB 空闲（2026-08-17 实测）
```

### 2.2 常规操作

**① 数据预处理（本机，纯 CPU，2-5 分钟）**

```bash
python 01_prepare_dataset.py --src "E:\图\PoseBookCN" --out "E:\sd35_lora\dataset" --max-imgs 300
# 全量: --max-imgs 0（897 张）
```

**② 训练（3090 Ti，4-8 小时）**

```bash
python scripts/sd35_lora/02_train_sd35_lora.py --dataset E:\sd35_lora\dataset\train --output E:\sd35_lora\output --steps 3000
# 参数调整: --rank 16/32、--lr 1e-4、--use-modelscope（底座下载断流时）
# 先验链路: 加 --dry-run 只打印配置不启动
# 训练后校验产物: python scripts/sd35_lora/05_validate_lora.py E:\sd35_lora\output\pytorch_lora_weights.safetensors
```

**③ LoRA 合并 + GGUF 转换（30-60 分钟）**

```bash
python scripts/sd35_lora/03_merge_and_convert.py --base <底座目录> --lora E:\sd35_lora\output\pytorch_lora_weights.safetensors --out E:\sd35_lora\release
```

**④ 真机部署（10-20 分钟）**

```bash
bash scripts/sd35_lora/04_deploy.sh E:\sd35_lora\release\sd35_medium_humanpose_q4_k_m.gguf
```

## 三、故障排查

### 3.1 已知问题与解法

| 症状 | 根因 | 解法 |
|------|------|------|
| `torch.cuda.is_available()` False | torch 装成 CPU 版（PyPI 源 113.8MB） | 用阿里云镜像 wheel 重装 cu128 版（见 SSOT §五 / TRAINING.md §1.2b） |
| download.pytorch.org 下载卡死 | 官方源大文件不稳定 | 阿里云 pytorch-wheels 镜像直接下载 wheel 本地安装 |
| 底座下载断流 | HF 网络问题 | 02 脚本加 `--use-modelscope` |
| CUDA out of memory | 显存超限 | `--batch-size 1`、`--grad-accum 4` 保持、确认无其他 GPU 占用 |
| 训练 loss 不降 | lr 过高/数据问题 | `--lr 5e-5`；检查 caption 非空 |
| 出图人体畸变 | 过拟合/rank 过高 | 降 rank、加数据、减 steps |
| 微调效果不明显 | steps 不足 | 升 `--steps`（4000-6000） |
| quantize 找不到 | 转换工具未编译 | 编译 city96 sd.cpp 或用 fp16 GGUF 先验证 |
| 端侧白图 | GGUF 转换异常 | 用 fp16 GGUF 对照排查，确认 convert 参数 `--sd3` |
| 真机推模型后 App 不识别 | 文件未就位/损坏 | 04 脚本大小校验；`adb shell ls -l` 确认 |

### 3.2 诊断路径

1. 先验环境：`final_check.py` 全依赖 + GPU 冒烟
2. 再验数据：`01` 报告 CSV 查清洗统计
3. 再验训练：`--dry-run` 打印命令链路
4. 后验产物：GGUF 大小 + 真机文件校验
5. 终验效果：同一 prompt 原版 vs 微调版真机出图对比

## 四、变更操作

### 4.1 变更步骤

```bash
# 1. 备份原模型（04 脚本自动做，也可手动）
adb shell cp /sdcard/Documents/AIOS/models/sd35_medium_q4_k_m.gguf /sdcard/Documents/AIOS/models/sd35_medium_q4_k_m.gguf.bak

# 2. 推送微调版
adb push E:\sd35_lora\release\sd35_medium_humanpose_q4_k_m.gguf /sdcard/Documents/AIOS/models/sd35_medium_q4_k_m.gguf

# 3. 大小校验
adb shell stat -c %s /sdcard/Documents/AIOS/models/sd35_medium_q4_k_m.gguf

# 4. 冷启动 App（覆盖安装只在引擎变更时需要）
adb shell am force-stop com.pocketpalai
adb shell monkey -p com.pocketpalai -c android.intent.category.LAUNCHER 1
```

### 4.2 回滚方案

```bash
# 一键回滚：备份恢复
adb shell cp /sdcard/Documents/AIOS/models/sd35_medium_q4_k_m.gguf.bak /sdcard/Documents/AIOS/models/sd35_medium_q4_k_m.gguf
```

## 五、验收标准

1. 训练全链路四脚本可运行（01 已验证；02-04 命令链路经 `--dry-run` 与人工确认）。
2. 数据：300 张（或全量）统一 1024×1536，caption 一一对应，报告 0 损坏。
3. 训练产物：LoRA safetensors 50-100MB；烘焙 GGUF ~1.8GB。
4. 真机：微调版 + `.bak` 都在；App 生图页可选到模型；同一 prompt 出图人体姿态优于原版（人工对比）。
5. 回滚验证：`.bak` 恢复路径有效。

## 变更日志

| 日期 | 版本 | 变更 |
|------|------|------|
| 2026-08-17 | 1.0 | 首发：SD3.5 LoRA 训练四段流水线操作手册 |

## 关联文档

- [训练域 SSOT](../imagegen/IMAGEGEN_MODEL_TRAINING_SSOT.md)（imagegen）
- [ADR-0005](../adr/ADR-0005-sd35-lora-training-route.md)（adr）
- 训练脚本目录：`scripts/sd35_lora/`（01 数据预处理 / 02 训练 / 03 合并转换 / 04 部署 / 05 校验）
