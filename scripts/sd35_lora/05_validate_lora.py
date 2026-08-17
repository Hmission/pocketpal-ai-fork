# -*- coding: utf-8 -*-
"""
05_validate_lora.py — LoRA 产物完整性校验（训练后必跑）

校验项：
1. safetensors 文件可解析、非空
2. key 格式符合 diffusers LoRA 约定（transformer.*.lora_A/lora_B.weight）
3. LoRA key 与 SD3.5 Medium transformer 期望的 target module 匹配（前缀抽查）
4. 体积合理性（rank16 的 SD3.5 LoRA 约 50-100MB）

用法:
  python 05_validate_lora.py E:\\sd35_lora\\output\\pytorch_lora_weights.safetensors
  python 05_validate_lora.py E:\\sd35_lora\\output --all    # 校验目录下全部 lora*.safetensors
"""
import argparse
import glob
import os
import sys

# SD3.5 Medium transformer 的 LoRA target modules（对齐 02 脚本 LoraConfig）
EXPECTED_PREFIXES = [
    "transformer.transformer_blocks",
    "transformer.single_transformer_blocks",
]


def validate(path):
    print(f"== 校验: {path} ==")
    if not os.path.isfile(path):
        print(f"  [FAIL] 文件不存在")
        return False
    size_mb = os.path.getsize(path) / 1024**2
    print(f"  大小: {size_mb:.1f} MB")

    try:
        from safetensors import safe_open
    except ImportError:
        print("  [FAIL] 未安装 safetensors")
        return False

    keys = []
    try:
        with safe_open(path, framework="pt", device="cpu") as f:
            keys = list(f.keys())
    except Exception as e:
        print(f"  [FAIL] 无法解析 safetensors: {e}")
        return False

    if not keys:
        print("  [FAIL] 文件无张量（空 LoRA？）")
        return False

    # key 结构分析（diffusers LoRA 标准格式: ...lora_A.default.weight）
    lora_a = [k for k in keys if "lora_A." in k or k.endswith("lora_A.weight")]
    lora_b = [k for k in keys if "lora_B." in k or k.endswith("lora_B.weight")]
    print(f"  张量总数: {len(keys)} | lora_A: {len(lora_a)} | lora_B: {len(lora_b)}")

    if len(lora_a) != len(lora_b) or len(lora_a) == 0:
        print(f"  [FAIL] lora_A/lora_B 数量不匹配（A={len(lora_a)} B={len(lora_b)}）")
        return False

    # 前缀检查：必须命中 SD3.5 transformer 结构
    bad_prefix = [k for k in lora_a if not any(k.startswith(p) for p in EXPECTED_PREFIXES)]
    if bad_prefix:
        print(f"  [FAIL] {len(bad_prefix)} 个 key 前缀不在 SD3.5 transformer 期望范围内:")
        for k in bad_prefix[:5]:
            print(f"    {k}")
        return False

    # 无 base_model.model 残留前缀（格式转换失败信号）
    residual = [k for k in keys if k.startswith("base_model.")]
    if residual:
        print(f"  [WARN] {len(residual)} 个 key 带 base_model. 残留前缀（02 脚本 key 转换可能未生效）")
        return False

    # 体积合理性（rank16 参考 ~50-100MB）
    if size_mb < 5:
        print(f"  [WARN] 体积仅 {size_mb:.1f}MB，疑似 rank 过低或训练未收敛")
    elif size_mb > 500:
        print(f"  [WARN] 体积 {size_mb:.1f}MB 偏大，疑似误存全量权重而非 LoRA")

    # 抽样打印
    print("  样例 key:")
    for k in lora_a[:3]:
        print(f"    {k}")
    print(f"  [OK] 校验通过（{len(lora_a)} 组 LoRA 对，{size_mb:.1f}MB）")
    return True


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("target", help="LoRA safetensors 文件或目录")
    ap.add_argument("--all", action="store_true", help="目录模式下校验全部 lora*.safetensors")
    args = ap.parse_args()

    if os.path.isdir(args.target):
        if not args.all:
            print("目录模式需加 --all")
            sys.exit(2)
        files = sorted(glob.glob(os.path.join(args.target, "**", "*lora*.safetensors"), recursive=True))
        files += sorted(glob.glob(os.path.join(args.target, "*.safetensors")))
        files = sorted(set(files))
        if not files:
            print(f"[FAIL] 目录下未找到 *.safetensors: {args.target}")
            sys.exit(1)
        ok = all(validate(f) for f in files)
    else:
        ok = validate(args.target)

    sys.exit(0 if ok else 1)


if __name__ == "__main__":
    main()
