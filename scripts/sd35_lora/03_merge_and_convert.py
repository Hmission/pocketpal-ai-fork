# -*- coding: utf-8 -*-
"""
03_merge_and_convert.py — LoRA 合并 + GGUF 量化（SD3.5 Medium 人体姿态版）

路线 A（默认，零代码改动）: 烘焙合并
  1. 把训练产物 LoRA fuse 回完整 SD3.5 Medium（diffusers pipe.fuse_lora）
  2. 导出单文件 safetensors（transformer 全量，含 LoRA 增量）
  3. 用 city96/stable-diffusion.cpp 转换工具链转 GGUF + 量化 Q4_K_M
  4. 真机替换 sd35_medium_q4_k_m.gguf → manifest 不用改（伴侣文件 clipL/clipG/vae 不变）

路线 B（可选，运行时挂载）:
  manifest 已预留 lora 字段 + 引擎原生 LoraSpec 通道，但需要额外 JNI 透传 + UI 开关，
  且 GGUF 化 LoRA 依赖工具链，本期不推荐，先走 A。

用法（在 3090 机器上，训练完成后）:
  python 03_merge_and_convert.py \
    --base   E:\\sd35_lora\\sd35_medium_full     # 本地 SD3.5 Medium diffusers 目录
    --lora   E:\\sd35_lora\\output\\pytorch_lora_weights.safetensors
    --out    E:\\sd35_lora\\release
    --quant  q4_k_m
可选:
  --skip-gguf  只做 LoRA 合并，不转 GGUF（先验证 safetensors 效果时用）
"""
import argparse
import os
import shutil
import subprocess
import sys

CONVERT_REPO = "https://github.com/city96/stable-diffusion.cpp.git"
QUANT_TYPES = ["q4_k_m", "q4_0", "q5_k_m", "q8_0", "f16"]


def manual_fuse_lora(model, lora_scale=2.0):
    """手动把 LoRA 融合进主权重（绕开 diffusers fuse_lora 的 meta tensor bug）。

    背景: diffusers 0.39 的 pipe.fuse_lora() 在 fuse 后会把 LoRA 参数置为 meta
    tensor，save_pretrained 时 'Cannot copy out of meta tensor' 崩溃。
    训练产物是 peft 格式（lora_A/lora_B ModuleDict），合并数学与 peft 一致：
    W += scaling * (B @ A)，其中 scaling = lora_alpha / r。
    注意: 训练配置 lora_alpha=32/r=16 → scaling=2.0；diffusers 加载后模块上的
    scaling dict 不可信（无 alpha 元数据时默认为 1.0），故由 --lora-scale 显式传入。
    """
    import torch

    fused = 0
    # 诊断：确认 LoRA 挂载结构
    lora_params = [n for n, _ in model.named_parameters() if "lora" in n.lower()]
    lora_mods = [n for n, m in model.named_modules()
                 if hasattr(m, "lora_A") or hasattr(m, "lora_B") or getattr(m, "lora_layer", None) is not None]
    print(f"  [diag] LoRA 参数 {len(lora_params)} 个 | LoRA 模块 {len(lora_mods)} 个")
    if lora_params:
        print(f"  [diag] 参数样例: {lora_params[:3]}")
    if lora_mods:
        m0 = model.get_submodule(lora_mods[0])
        la = getattr(m0, "lora_A", None)
        print(f"  [diag] 模块样例: {lora_mods[0]} | lora_A 类型={type(la).__name__} | "
              f"scaling={getattr(m0, 'scaling', 'N/A')} | alpha={getattr(m0, 'lora_alpha', 'N/A')} | rank={getattr(m0, 'r', getattr(m0, 'rank', 'N/A'))}")

    for name, module in model.named_modules():
        # diffusers 风格：lora_layer（up/down）
        ll = getattr(module, "lora_layer", None)
        if ll is not None and hasattr(module, "weight"):
            with torch.no_grad():
                w_orig = module.weight.data.float()
                w_up = ll.up.weight.data.float()
                w_down = ll.down.weight.data.float()
                if ll.network_alpha is not None:
                    w_up = w_up * ll.network_alpha / ll.rank
                fused_w = w_orig + (lora_scale * torch.bmm(w_up[None, :], w_down[None, :])[0])
                module.weight.data = fused_w.to(module.weight.dtype)
            module.lora_layer = None
            fused += 1
            continue
        # peft 风格：lora_A / lora_B ModuleDict（训练产物格式）
        la = getattr(module, "lora_A", None)
        lb = getattr(module, "lora_B", None)
        if la is None or lb is None or not hasattr(module, "weight"):
            continue
        for adapter in list(la.keys()):
            if adapter not in lb:
                print(f"  [WARN] {name} 缺 adapter {adapter} 的 lora_B，跳过")
                continue
            with torch.no_grad():
                A = la[adapter].weight if hasattr(la[adapter], "weight") else la[adapter]
                B = lb[adapter].weight if hasattr(lb[adapter], "weight") else lb[adapter]
                delta = (B @ A) * lora_scale
                module.weight.data.add_(delta.to(module.weight.dtype))
            fused += 1
        # 卸载 LoRA 相关属性，保证 state_dict 干净
        for attr in ("lora_A", "lora_B", "lora_dropout", "lora_embedding_A", "lora_embedding_B"):
            if hasattr(module, attr):
                try:
                    delattr(module, attr)
                except Exception:
                    pass
    print(f"  手动合并完成: {fused} 组 LoRA (scale={lora_scale})")
    return fused


def merge_lora(base_dir, lora_path, out_dir, lora_scale=2.0):
    """用 diffusers 把 LoRA 融合进底座，导出完整 safetensors"""
    print("== LoRA 合并 ==")
    import torch
    from diffusers import StableDiffusion3Pipeline

    # 前置校验：LoRA 产物完整性（对齐 05_validate_lora.py）
    validate_script = os.path.join(os.path.dirname(os.path.abspath(__file__)), "05_validate_lora.py")
    if os.path.exists(validate_script):
        print("  前置校验 LoRA 产物...")
        r = subprocess.run([sys.executable, validate_script, lora_path], capture_output=True, text=True)
        print(r.stdout or r.stderr)
        if r.returncode != 0:
            sys.exit("[FAIL] LoRA 校验未通过，中止合并")

    print(f"  加载底座: {base_dir}")
    # low_cpu_mem_usage=False: 强制实权重加载（meta tensor 无法 save_pretrained）
    # variant=fp16: 与训练一致的 fp16 变体（modelscope 版含 fp32+fp16 双套）
    pipe = StableDiffusion3Pipeline.from_pretrained(
        base_dir, torch_dtype=torch.float16,
        low_cpu_mem_usage=False, use_safetensors=True, variant="fp16"
    ).to("cuda")
    print(f"  加载 LoRA: {lora_path}")
    pipe.load_lora_weights(lora_path)
    # 用手动合并绕开 pipe.fuse_lora() 的 meta tensor bug
    n = manual_fuse_lora(pipe.transformer, lora_scale=lora_scale)
    if n == 0:
        sys.exit("[FAIL] 未合并到任何 LoRA 组，中止")
    # 合并后校验：无 meta、无 lora 残留
    n_meta = sum(1 for p in pipe.transformer.parameters() if p.is_meta)
    lora_left = [nm for nm, _ in pipe.transformer.named_parameters() if "lora" in nm.lower()]
    if n_meta:
        sys.exit(f"[FAIL] 合并后仍有 {n_meta} 个 meta tensor，中止")
    if lora_left:
        print(f"  [WARN] LoRA 残留 {len(lora_left)} 个参数: {lora_left[:3]}...")
    merged_dir = os.path.join(out_dir, "sd35_medium_humanpose_full")
    pipe.save_pretrained(merged_dir, safe_serialization=True)
    print(f"  [OK] 合并完成: {merged_dir}")
    del pipe
    torch.cuda.empty_cache()
    return merged_dir


def ensure_convert_tools(work):
    """获取 city96 转换工具（convert.py + quantize 二进制）"""
    tools = os.path.join(work, "sd_cpp_tools")
    convert_py = os.path.join(tools, "scripts", "convert.py")
    if os.path.exists(convert_py):
        return tools
    print("  拉取 city96/stable-diffusion.cpp 转换工具...")
    subprocess.run(["git", "clone", "--depth", "1", CONVERT_REPO, tools], check=True)
    if not os.path.exists(convert_py):
        sys.exit("[FAIL] 转换工具拉取失败")
    return tools


def find_quantize_bin(tools):
    """quantize 二进制：Windows 下通常由用户预编译；找不到则提示"""
    cands = [
        os.path.join(tools, "build", "bin", "Release", "quantize.exe"),
        os.path.join(tools, "build", "bin", "quantize.exe"),
        os.path.join(tools, "build", "Debug", "quantize.exe"),
        shutil.which("quantize"),
    ]
    for c in cands:
        if c and os.path.exists(c):
            return c
    # 尝试用 ggml 的 python 量化？sd.cpp 只提供 C 量化。提示用户编译。
    print("[WARN] 未找到 quantize 可执行文件。")
    print("       请在转换工具目录编译 sd.cpp（或下载预编译包），得到 quantize(.exe) 后重跑。")
    print("       编译参考: cd sd_cpp_tools && cmake -B build -DCMAKE_BUILD_TYPE=Release && cmake --build build --config Release -j")
    return None


def convert_to_gguf(tools, merged_dir, out_dir, quant):
    convert_py = os.path.join(tools, "scripts", "convert.py")
    # 转换脚本需要 --sd3 参数；合并后的 diffusers 目录结构：transformer/ 子目录
    # city96 convert.py 支持 --sd3 + --v2 等；输入为 diffusers 目录或单文件
    cmd = [sys.executable, convert_py,
           "--sd3",
           "--outfile", os.path.join(out_dir, "sd35_medium_humanpose_f16.gguf"),
           merged_dir]
    print("== GGUF 转换（fp16 中间档）==")
    print("  " + " ".join(cmd))
    subprocess.run(cmd, check=True)

    quant_bin = find_quantize_bin(tools)
    if quant_bin is None:
        print("[SKIP] 无 quantize 二进制，跳过量化。可用 fp16 GGUF 验证。")
        return None
    out_gguf = os.path.join(out_dir, f"sd35_medium_humanpose_{quant}.gguf")
    print(f"== 量化 {quant} ==")
    subprocess.run([quant_bin, os.path.join(out_dir, "sd35_medium_humanpose_f16.gguf"), out_gguf, quant], check=True)
    print(f"  [OK] 量化完成: {out_gguf}")
    return out_gguf


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--base", required=True, help="本地 SD3.5 Medium diffusers 目录（含 model_index.json）")
    ap.add_argument("--lora", required=True, help="训练输出的 LoRA safetensors")
    ap.add_argument("--out", required=True, help="发布目录")
    ap.add_argument("--quant", default="q4_k_m", choices=QUANT_TYPES)
    ap.add_argument("--lora-scale", type=float, default=2.0,
                    help="LoRA 合并缩放（默认 2.0 = 训练 lora_alpha/r = 32/16）")
    ap.add_argument("--skip-gguf", action="store_true", help="只 merge 不转 GGUF")
    args = ap.parse_args()

    if not os.path.isfile(args.lora):
        sys.exit(f"[FAIL] LoRA 文件不存在: {args.lora}")
    os.makedirs(args.out, exist_ok=True)

    merged = merge_lora(args.base, args.lora, args.out, args.lora_scale)
    if args.skip_gguf:
        print(f"\n[OK] 仅合并完成: {merged}（未转 GGUF）")
        return

    tools = ensure_convert_tools(os.path.dirname(os.path.abspath(args.out)))
    gguf = convert_to_gguf(tools, merged, args.out, args.quant)
    if gguf:
        print(f"\n[OK] 全部完成。真机部署文件: {gguf}")
        print("     （伴侣文件 clip_l / clip_g / vae 沿用原 SD3.5 套装，无需重下）")


if __name__ == "__main__":
    main()
