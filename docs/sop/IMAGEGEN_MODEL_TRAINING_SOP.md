---
doc_id: IMAGEGEN_MODEL_TRAINING_SOP
module: sop
type: sop
status: active
version: "2.0"
created: "2026-08-17"
updated: "2026-08-18"
relates:
  - docs/imagegen/IMAGEGEN_MODEL_TRAINING_SSOT.md
  - docs/adr/ADR-0005-sd35-lora-training-route.md
  - docs/adr/ADR-0006-sd3-2b-engine-compat-route.md
---
<!-- D-FORMAT:v3 -->

# 生图模型训练 · SOP（ImageGen Model Training Operations）

**状态**：active | **版本**：2.0 | **更新**：2026-08-18

> **定位**：SD3 2B（joint_blocks，引擎兼容架构）人体姿态 LoRA 训练与部署的日常运维、验证与故障排查操作手册。SSOT 见 [`IMAGEGEN_MODEL_TRAINING_SSOT.md`](../imagegen/IMAGEGEN_MODEL_TRAINING_SSOT.md)；架构决策见 [ADR-0006](../adr/ADR-0006-sd3-2b-engine-compat-route.md)。

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
| 底座 safetensors | `ls E:\sd35_lora\base2\sd3_2b_qknorm.safetensors` | 存在，~4.94GB（GGUF 提取版带 QK-norm） |
| 手写模型冒烟 | `python .tmp\sd35_lora\smoke_sd3_2b.py` | 665 key 全加载、forward 无 NaN |
| LoRA 产物 | `ls E:\sd35_lora\output_2b\pytorch_lora_weights.safetensors` | 存在，~83MB（440 key） |
| GGUF 产物 | `ls E:\sd35_lora\release_2b\sd3_2b_humanpose_q4_K.gguf` | 存在，~2.24GB |
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

**② 训练（3090 Ti，~2 小时）**

```bash
# 冒烟（3 步全链路验证）
python scripts/sd35_lora/02b_train_sd3_2b.py --dataset E:\sd35_lora\dataset\train --output E:\sd35_lora\output_2b_smoke --steps 3 --grad-accum 1

# 正式训练（3000 步，~2h；flash attention 后每步 2.2s）
python scripts/sd35_lora/02b_train_sd3_2b.py --dataset E:\sd35_lora\dataset\train --output E:\sd35_lora\output_2b --steps 3000 --rank 16 --lr 1e-4 --resolution 1024x1536 --grad-accum 4

# 中断续训（电脑重启等场景，从 checkpoint 继续）
python scripts/sd35_lora/02b_train_sd3_2b.py --dataset E:\sd35_lora\dataset\train --output E:\sd35_lora\output_2b --steps 3000 --resume E:\sd35_lora\output_2b\lora_step1000.safetensors --resume-step 1000
```

**③ LoRA 合并 + GGUF 转换 + 量化（合并 ~5min，转换 ~4min）**

```bash
python scripts/sd35_lora/03b_merge_sd3_2b.py \
  --base E:\sd35_lora\base2\sd3_2b_qknorm.safetensors \
  --lora E:\sd35_lora\output_2b\pytorch_lora_weights.safetensors \
  --out E:\sd35_lora\release_2b --quant q4_K
# 说明: 手动灌入 peft LoRA（440 key）+ base_layer.weight 合并 + 引擎命名逆映射导出；
# sd-cli -M convert -m（无前缀）→ f16 → q4_K（大写 K）；烘焙校验 4/4 必过
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
| 端侧白图 | GGUF 转换异常 | 用 fp16 GGUF 对照排查，确认 convert 参数 `-m` 无前缀 |
| 真机推模型后 App 不识别 | 文件未就位/损坏 | 04 脚本大小校验；`adb shell ls -l` 确认 |
| 引擎报 `get sd version from file failed` | 架构不兼容：产物非 joint_blocks（如 SD3.5 Medium transformer_blocks） | 换 SD3 2B 路线（06/02b/03b 脚本），引擎只识别 joint_blocks/FLUX |
| LoRA 合并后抽查与底座相同 | peft `set_peft_model_state_dict` 静默失败 / LoraLayer `base_layer.weight` 死参数 | 03b 已内置修复（手动灌入 440 key + base_layer 合并），出现此问题直接跑 03b |
| 训练每步 >8s | 手写 einsum attention 无 flash 内核 | 06 模型已用 `F.scaled_dot_product_attention`（每步 2.2s）；新代码禁用 einsum attention |
| 训练中断 | 电脑重启/断点 | 用 `--resume` 从最近 `lora_stepN.safetensors` 续训（`--resume-step N`） |

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
| 2026-08-18 | 2.0 | 架构切换 SD3 2B：02b/03b/06 新脚本链路、续训、flash attention 提速、新故障排查（架构不兼容/base_layer/慢速训练/中断） |

## 关联文档

- [训练域 SSOT](../imagegen/IMAGEGEN_MODEL_TRAINING_SSOT.md)（imagegen）
- [ADR-0005](../adr/ADR-0005-sd35-lora-training-route.md)（adr，SD3.5 路线被取代）
- [ADR-0006](../adr/ADR-0006-sd3-2b-engine-compat-route.md)（adr，现行）
- 训练脚本目录：`scripts/sd35_lora/`（01 数据预处理 / 02b 训练 / 03b 合并转换 / 04 部署 / 06 手写模型）
