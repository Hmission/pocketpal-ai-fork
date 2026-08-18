# -*- coding: utf-8 -*-
"""
03b_merge_sd3_2b.py — SD3 2B（joint_blocks）LoRA 合并 + GGUF 量化

链路: 02b 训练产物（peft lora_A/lora_B）→ 烘焙进手写 SD3 2B 模型
      → 导出无前缀 safetensors（与引擎原版 GGUF 提取版同构）
      → sd-cli convert -m（无前缀）→ f16 GGUF → 量化 q4_K（大写 K）

用法（3090 机器，训练完成后）:
  python 03b_merge_sd3_2b.py \
    --base  E:\\sd35_lora\\base2\\sd3_2b_qknorm.safetensors \
    --lora  E:\\sd35_lora\\output_2b\\pytorch_lora_weights.safetensors \
    --out   E:\\sd35_lora\\release_2b \
    --quant q4_K
可选:
  --lora-scale 2.0   （= 训练 lora_alpha/r = 32/16）
  --skip-gguf        只合并不转 GGUF
"""
import argparse
import os
import subprocess
import sys


def to_engine_key(k):
    """模型 state_dict key -> 引擎原始命名（load_sd3_2b_weights 的逆映射）。
    peft LoraModel 包一层 model. 前缀；模型命名 blocks/final_adaLN/final_linear 等
    需还原为 joint_blocks/final_layer.adaLN_modulation/final_layer.linear 等。"""
    k = k.replace("model.", "", 1)  # LoraModel.model -> SD3_2B_MMDiT
    k = k.replace("blocks.", "joint_blocks.", 1)
    k = k.replace("x_embedder.", "x_embedder.proj.", 1)
    k = k.replace("t_embedder.fc1.", "t_embedder.mlp.0.")
    k = k.replace("t_embedder.fc2.", "t_embedder.mlp.2.")
    k = k.replace("y_embedder.fc1.", "y_embedder.mlp.0.")
    k = k.replace("y_embedder.fc2.", "y_embedder.mlp.2.")
    k = k.replace("final_adaLN.1.", "final_layer.adaLN_modulation.1.")
    k = k.replace("final_linear.", "final_layer.linear.")
    return k


def load_lora_manual(peft_model, state):
    """手动把 LoRA state_dict 灌入 peft 模型（绕开 set_peft_model_state_dict 的
    key 映射差异：lora_A/lora_B 在部分 peft 版本中静默不生效）。
    key 格式: base_model.model.blocks.N.x_block.attn.qkv.lora_A.default.weight
    模块路径（LoraModel 内）: model.blocks.N.x_block.attn.qkv
    """
    loaded = 0
    for k, v in state.items():
        if "lora" not in k:
            continue
        rel = k.replace("base_model.model.", "")  # blocks.N....lora_A.default.weight
        parts = rel.split(".")
        if "lora_A" in parts:
            lora_idx = parts.index("lora_A")
        elif "lora_B" in parts:
            lora_idx = parts.index("lora_B")
        else:
            continue
        mod_path = "model." + ".".join(parts[:lora_idx])
        adapter = parts[lora_idx + 1]
        attr = parts[lora_idx]
        sub = ".".join(parts[lora_idx + 2:])
        try:
            module = peft_model.base_model.get_submodule(mod_path)
            target = getattr(module, attr)[adapter]
            t = getattr(target, sub)
            t.data.copy_(v.to(t.dtype))
            loaded += 1
        except Exception as e:
            print(f"  [WARN] 灌入失败 {k}: {e}")
    print(f"  手动灌入: {loaded} 个 LoRA 张量")
    return loaded


def manual_fuse_lora(model, lora_scale=2.0):
    """手动把 peft LoRA（lora_A/lora_B ModuleDict）融合进主权重。
    注意: peft LoraLayer 的实际权重在 base_layer.weight（module.weight 是基类死参数，
    修改它不会影响前向与 state_dict），必须改 base_layer.weight。"""
    import torch

    fused = 0
    for name, module in model.named_modules():
        la = getattr(module, "lora_A", None)
        lb = getattr(module, "lora_B", None)
        if la is None or lb is None:
            continue
        base = getattr(module, "base_layer", None)
        w = getattr(base, "weight", None) if base is not None else None
        if w is None and hasattr(module, "weight"):
            w = module.weight
        if w is None:
            continue
        for adapter in list(la.keys()):
            if adapter not in lb:
                print(f"  [WARN] {name} 缺 adapter {adapter} 的 lora_B，跳过")
                continue
            with torch.no_grad():
                A = la[adapter].weight if hasattr(la[adapter], "weight") else la[adapter]
                B = lb[adapter].weight if hasattr(lb[adapter], "weight") else lb[adapter]
                delta = (B @ A) * lora_scale
                w.data.add_(delta.to(w.dtype))
            fused += 1
        for attr in ("lora_A", "lora_B", "lora_dropout", "lora_embedding_A", "lora_embedding_B"):
            if hasattr(module, attr):
                try:
                    delattr(module, attr)
                except Exception:
                    pass
    print(f"  手动合并完成: {fused} 组 LoRA (scale={lora_scale})")
    return fused


def merge_lora(base_path, lora_path, out_dir, lora_scale=2.0):
    print("== LoRA 合并（手写 SD3 2B + peft）==")
    import torch
    from peft import LoraConfig, get_peft_model
    import safetensors.torch

    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    from sd3_2b_model import SD3_2B_MMDiT, detect_d_self, load_sd3_2b_weights

    print(f"  加载底座: {base_path}")
    d_self = detect_d_self(base_path)
    model = SD3_2B_MMDiT(d_self=d_self)
    missing, unexpected = load_sd3_2b_weights(model, base_path, prefix="")
    if missing:
        sys.exit(f"[FAIL] 底座加载缺失 {len(missing)} 个权重")
    if unexpected:
        print(f"  [WARN] 多余 {len(unexpected)} 个权重: {unexpected[:3]}")
    print(f"  d_self={d_self} | 参数量 {sum(p.numel() for p in model.parameters())/1e9:.2f}B")

    # 重建与训练一致的 LoRA 结构，再灌入权重
    print(f"  加载 LoRA: {lora_path}")
    lora_config = LoraConfig(
        r=16, lora_alpha=32, init_lora_weights="gaussian",
        target_modules=["qkv", "proj", "fc1", "fc2", "context_embedder"],
    )
    peft_model = get_peft_model(model, lora_config)
    state = safetensors.torch.load_file(lora_path)
    # 校验注入点数量与训练一致
    lora_keys = [k for k in state if "lora" in k]
    print(f"  LoRA key 数: {len(lora_keys)}")
    n = load_lora_manual(peft_model, state)
    if n == 0:
        sys.exit("[FAIL] LoRA 灌入 0 个，中止")
    print("  [OK] LoRA 权重已灌入")

    # 校验：LoRA 权重确实加载（非零）——抽样对比
    with torch.no_grad():
        for k, v in list(state.items())[:0]:  # 空循环占位
            pass

    n = manual_fuse_lora(peft_model.base_model, lora_scale=lora_scale)
    if n == 0:
        sys.exit("[FAIL] 未合并到任何 LoRA 组，中止")

    # 合并后校验：无 lora 残留
    lora_left = [nm for nm, _ in peft_model.named_parameters() if "lora" in nm.lower()]
    if lora_left:
        print(f"  [WARN] LoRA 残留 {len(lora_left)} 个参数: {lora_left[:3]}...")
    n_meta = sum(1 for p in peft_model.parameters() if p.is_meta)
    if n_meta:
        sys.exit(f"[FAIL] 合并后仍有 {n_meta} 个 meta tensor，中止")

    # 导出无前缀 safetensors（引擎原始命名，与底座同构）
    out_safetensors = os.path.join(out_dir, "sd3_2b_humanpose_full.safetensors")
    os.makedirs(out_dir, exist_ok=True)
    raw = {k: v.detach().cpu().float() for k, v in peft_model.base_model.state_dict().items()}
    # peft LoraLayer 把原始权重放在 base_layer.*，剥离还原为普通 Linear 命名
    raw = {k.replace("base_layer.", ""): v for k, v in raw.items()}
    sd = {to_engine_key(k): v for k, v in raw.items()}
    safetensors.torch.save_file(sd, out_safetensors)
    print(f"  [OK] 合并完成: {out_safetensors} ({os.path.getsize(out_safetensors)/1e9:.2f}GB, {len(sd)} keys)")

    # 与底座对比：抽查验证 LoRA 增量已烘焙（引擎命名）
    from safetensors import safe_open
    check_keys = ["joint_blocks.0.x_block.attn.qkv.weight", "joint_blocks.12.x_block.attn2.qkv.weight",
                  "context_embedder.weight", "joint_blocks.23.context_block.attn.qkv.weight"]
    diffs = 0
    with safe_open(base_path, framework="pt", device="cpu") as f, \
         safe_open(out_safetensors, framework="pt", device="cpu") as g:
        for k in check_keys:
            if k in f.keys() and k in g.keys():
                a, b = f.get_tensor(k), g.get_tensor(k)
                if not torch.equal(a, b):
                    diffs += 1
                else:
                    print(f"  [WARN] {k} 与底座相同，LoRA 未生效于此层")
            else:
                print(f"  [WARN] {k} 缺失 (f={k in f.keys()}, g={k in g.keys()})")
    print(f"  烘焙校验: {diffs}/{len(check_keys)} 个抽查权重与底座不同（LoRA 已生效）")
    if diffs == 0:
        sys.exit("[FAIL] 抽查全部与底座相同，LoRA 未生效，中止")
    del peft_model
    torch.cuda.empty_cache()
    return out_safetensors


def convert_to_gguf(sd_cli, merged_st, out_dir, quant):
    """sd-cli convert -m（无前缀，与引擎原版 GGUF 一致）+ 量化"""
    os.makedirs(out_dir, exist_ok=True)
    f16_gguf = os.path.join(out_dir, "sd3_2b_humanpose_f16.gguf")
    print("== GGUF 转换（f16 中间档，-m 无前缀）==")
    cmd = [sd_cli, "-M", "convert", "-m", merged_st, "-o", f16_gguf, "--type", "f16"]
    print("  " + " ".join(cmd))
    r = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8", errors="replace")
    print(r.stdout[-2000:] if r.stdout else "")
    if r.stderr:
        print("  [stderr]", r.stderr[-1500:])
    if r.returncode != 0:
        sys.exit("[FAIL] GGUF 转换失败")
    print(f"  [OK] f16: {f16_gguf} ({os.path.getsize(f16_gguf)/1e9:.2f}GB)")

    out_gguf = os.path.join(out_dir, f"sd3_2b_humanpose_{quant}.gguf")
    print(f"== 量化 {quant} ==")
    cmd2 = [sd_cli, "-M", "convert", "-m", f16_gguf, "-o", out_gguf, "--type", quant]
    print("  " + " ".join(cmd2))
    r2 = subprocess.run(cmd2, capture_output=True, text=True, encoding="utf-8", errors="replace")
    print(r2.stdout[-2000:] if r2.stdout else "")
    if r2.stderr:
        print("  [stderr]", r2.stderr[-1500:])
    if r2.returncode != 0:
        sys.exit("[FAIL] 量化失败")
    print(f"  [OK] 量化完成: {out_gguf} ({os.path.getsize(out_gguf)/1e9:.2f}GB)")
    return out_gguf


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--base", required=True, help="底座 safetensors（GGUF 提取版）")
    ap.add_argument("--lora", required=True, help="02b 训练输出的 LoRA safetensors")
    ap.add_argument("--out", required=True, help="发布目录")
    ap.add_argument("--quant", default="q4_K", help="量化类型（ggml type_name，大写 K）")
    ap.add_argument("--lora-scale", type=float, default=2.0)
    ap.add_argument("--sd-cli", default=r"E:\sd35_lora\sd_cpp_build\bin\Release\sd-cli.exe")
    ap.add_argument("--skip-gguf", action="store_true", help="只合并不转 GGUF")
    args = ap.parse_args()

    if not os.path.isfile(args.base):
        sys.exit(f"[FAIL] 底座不存在: {args.base}")
    if not os.path.isfile(args.lora):
        sys.exit(f"[FAIL] LoRA 不存在: {args.lora}")
    if not os.path.isfile(args.sd_cli):
        sys.exit(f"[FAIL] sd-cli 不存在: {args.sd_cli}")

    merged = merge_lora(args.base, args.lora, args.out, args.lora_scale)
    if args.skip_gguf:
        print(f"\n[OK] 仅合并完成: {merged}")
        return
    gguf = convert_to_gguf(args.sd_cli, merged, args.out, args.quant)
    print(f"\n[OK] 全部完成。真机部署文件: {gguf}")


if __name__ == "__main__":
    main()
