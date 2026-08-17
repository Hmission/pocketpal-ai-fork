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


def merge_lora(base_dir, lora_path, out_dir):
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
    pipe = StableDiffusion3Pipeline.from_pretrained(
        base_dir, torch_dtype=torch.float16
    ).to("cuda")
    print(f"  加载 LoRA: {lora_path}")
    pipe.load_lora_weights(lora_path)
    pipe.fuse_lora(lora_scale=1.0)
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
    ap.add_argument("--skip-gguf", action="store_true", help="只 merge 不转 GGUF")
    args = ap.parse_args()

    if not os.path.isfile(args.lora):
        sys.exit(f"[FAIL] LoRA 文件不存在: {args.lora}")
    os.makedirs(args.out, exist_ok=True)

    merged = merge_lora(args.base, args.lora, args.out)
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
