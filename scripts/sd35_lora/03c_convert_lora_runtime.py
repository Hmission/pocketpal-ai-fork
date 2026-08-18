# -*- coding: utf-8 -*-
"""
03c_convert_lora_runtime.py — 训练 LoRA（peft）→ 引擎运行时挂载格式（sd.cpp kohya 命名）

输入: 02b 训练产物 pytorch_lora_weights.safetensors（peft key: base_model.model.blocks.N...lora_A.default.weight）
输出: lora_humanpose.safetensors（引擎 sd_lora_t 可加载: lora.<主模型tensor名>.<lora_down|lora_up>.weight）

依据（引擎源码 name_conversion.cpp L1390-1405）:
  - lora 文件 tensor 名以 "lora." 前缀开头 → is_lora=true
  - suffix 映射: .lora_A.default.weight → .weight.lora_down；.lora_B.default.weight → .weight.lora_up
  - 最终命名: lora.<主模型tensor名>.weight.lora_down（lora.hpp L558 按此匹配主模型权重）
  本脚本直接产出 kohya 标准格式 lora_down/lora_up（社区/工具通用，引擎同样识别）。

维度约定: peft lora_A [rank, in]（= kohya lora_down）、lora_B [out, rank]（= kohya lora_up）——直接重命名，无需转置。

用法:
  python 03c_convert_lora_runtime.py \
    --lora E:\\sd35_lora\\output_2b\\pytorch_lora_weights.safetensors \
    --base E:\\sd35_lora\\base2\\sd3_2b_qknorm.safetensors \
    --out  E:\\sd35_lora\\release_2b\\lora_humanpose.safetensors
"""
import argparse
import os
import sys


def to_lora_key(k):
    """peft key -> 引擎 lora key（主模型命名 + lora. 前缀 + kohya down/up 后缀）"""
    k = k.replace("base_model.model.", "")            # blocks.N...lora_A.default.weight
    k = k.replace("blocks.", "joint_blocks.", 1)      # joint_blocks.N...
    # t/y_embedder: 模型 fc1/fc2 命名 -> 引擎 mlp.0/2 命名（03b 逆映射同款）
    k = k.replace("t_embedder.fc1.", "t_embedder.mlp.0.")
    k = k.replace("t_embedder.fc2.", "t_embedder.mlp.2.")
    k = k.replace("y_embedder.fc1.", "y_embedder.mlp.0.")
    k = k.replace("y_embedder.fc2.", "y_embedder.mlp.2.")
    # lora_A.default.weight -> lora_down.weight；lora_B.default.weight -> lora_up.weight
    if "lora_A" in k:
        k = k.replace(".lora_A.default.weight", ".lora_down.weight")
    elif "lora_B" in k:
        k = k.replace(".lora_B.default.weight", ".lora_up.weight")
    else:
        raise ValueError(f"未知 lora key: {k}")
    return "lora." + k


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--lora", required=True, help="训练 LoRA safetensors（peft 格式）")
    ap.add_argument("--base", required=True, help="底座 safetensors（引擎原版，用于校验 tensor 名匹配）")
    ap.add_argument("--out", required=True, help="输出 lora safetensors（引擎可加载格式）")
    ap.add_argument("--alpha", type=float, default=32.0, help="训练 lora_alpha（用于提示 multiplier）")
    ap.add_argument("--rank", type=int, default=16, help="训练 rank")
    args = ap.parse_args()

    import safetensors.torch
    from safetensors import safe_open

    if not os.path.isfile(args.lora):
        sys.exit(f"[FAIL] LoRA 不存在: {args.lora}")
    if not os.path.isfile(args.base):
        sys.exit(f"[FAIL] 底座不存在: {args.base}")

    print("== 读取训练 LoRA（peft）==")
    state = safetensors.torch.load_file(args.lora)
    lora_keys = [k for k in state if "lora" in k]
    print(f"  原始 key 数: {len(lora_keys)}")

    print("== 命名转换 ==")
    out = {}
    for k, v in state.items():
        if "lora" not in k:
            continue
        nk = to_lora_key(k)
        out[nk] = v
    print(f"  转换后 key 数: {len(out)}")
    sample = sorted(out.keys())[:3] + sorted(out.keys())[-2:]
    for s in sample:
        print(f"    {s}")

    print("== 与主模型 tensor 名匹配校验 ==")
    with safe_open(args.base, framework="pt", device="cpu") as f:
        model_names = set(f.keys())
    model_tensors = set()
    for nk in out:
        # lora.<主模型tensor名>.lora_down.weight -> 提取主模型 tensor 名（kohya 后缀）
        core = nk[len("lora."):]
        core = core.replace(".lora_down.weight", ".weight").replace(".lora_up.weight", ".weight")
        model_tensors.add(core)
    missing = model_tensors - model_names
    if missing:
        print(f"  [FAIL] {len(missing)} 个 tensor 名不匹配主模型，样例: {sorted(missing)[:5]}")
        sys.exit(1)
    print(f"  [OK] 全部 {len(model_tensors)} 个目标 tensor 与主模型匹配")

    # 校验 lora_down/up 配对
    downs = [k for k in out if k.endswith(".lora_down.weight")]
    ups = [k for k in out if k.endswith(".lora_up.weight")]
    print(f"  lora_down: {len(downs)} | lora_up: {len(ups)} | 配对: {len(downs) == len(ups)}")

    os.makedirs(os.path.dirname(args.out) or ".", exist_ok=True)
    safetensors.torch.save_file(out, args.out)
    size_mb = os.path.getsize(args.out) / 1e6
    print(f"  [OK] 转换完成: {args.out} ({size_mb:.1f}MB)")
    print(f"  提示: 出图 multiplier 应设训练 scaling = alpha/rank = {args.alpha/args.rank:.1f}（manifest loraMultiplier）")


if __name__ == "__main__":
    main()
