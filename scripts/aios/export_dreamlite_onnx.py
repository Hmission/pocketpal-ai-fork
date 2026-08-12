# -*- coding: utf-8 -*-
"""DreamLite → ONNX 导出脚本（P6-5，供有 torch 的导出机运行）。

前置（本机已核实）：
  - 权重：hf `carlofkl/DreamLite-mobile`（unet 780MB / vae 4.9MB / te=Qwen3-VL 4.25GB）
  - 代码：github `ByteVisionLab/DreamLite`（dreamlite 包，trust_remote_code）
  - 架构：UNet=DreamLiteUNetModel(cross_attn 2304, FlowMatch 4步) / VAE=AutoencoderTiny

用法（导出机）：
  1. git clone https://github.com/ByteVisionLab/DreamLite && pip install -e .
  2. 下载权重到 --ckpt（diffusers 目录结构）
  3. python export_dreamlite_onnx.py --ckpt <dir> --out <onnx_dir>

产出：unet.onnx（4步采样主体）+ vae_decoder.onnx（TinyVAE 解码）。
文本编码器(Qwen3-VL)不走 ONNX，端侧用 llama.rn 4-bit GGUF 提取 hidden states。
"""
import argparse
import sys

import torch


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--repo", default=".", help="DreamLite 仓库根目录(含 dreamlite 包)")
    ap.add_argument("--ckpt", required=True, help="diffusers 权重目录")
    ap.add_argument("--out", required=True, help="ONNX 输出目录")
    ap.add_argument("--seq", type=int, default=77, help="文本序列长度")
    args = ap.parse_args()

    sys.path.insert(0, args.repo)
    from diffusers import AutoencoderTiny, FlowMatchEulerDiscreteScheduler
    from dreamlite.models.unets.unet_2d_condition_mobile import DreamLiteUNetModel

    torch.set_grad_enabled(False)

    unet = DreamLiteUNetModel.from_pretrained(args.ckpt, subfolder="unet")
    unet.eval()
    vae = AutoencoderTiny.from_pretrained(args.ckpt, subfolder="vae")
    vae.eval()

    # UNet 导出：sample[1,4,128,128](1024px/8) + timestep + encoder_hidden_states[1,seq,2304]
    sample = torch.randn(1, 4, 128, 128)
    timestep = torch.tensor([500.0])
    enc = torch.randn(1, args.seq, 2304)
    added = torch.randn(1, 256)  # addition_time_embed_dim
    torch.onnx.export(
        unet,
        (sample, timestep, enc, added),
        f"{args.out}/unet.onnx",
        input_names=["sample", "timestep", "encoder_hidden_states", "added_time_embed"],
        output_names=["noise_pred"],
        dynamic_axes={"encoder_hidden_states": {1: "seq"}},
        opset_version=17,
    )
    print("unet.onnx exported")

    # TinyVAE 解码导出：latents[1,4,128,128] -> rgb
    lat = torch.randn(1, 4, 128, 128)
    torch.onnx.export(
        vae,
        (lat,),
        f"{args.out}/vae_decoder.onnx",
        input_names=["latents"],
        output_names=["image"],
        opset_version=17,
    )
    print("vae_decoder.onnx exported")


if __name__ == "__main__":
    main()
