# -*- coding: utf-8 -*-
"""DreamLite 参考推理（CPU，已验证 4 步 1024px 38.3s）。

端侧引擎（ONNX Runtime/MNN）必须严格镜像本脚本的 forward 契约：
  - model_input = cat([latents, cond_latents], dim=3)  # 宽度翻倍 128x256
      generate: cond_latents = zeros_like(latents)
      edit:     cond_latents = TinyVAE.encode(源图)
  - encoder_hidden_states = Qwen3-VL hidden_states[-1]（2048 维，截前缀后 pad）
  - added_cond_kwargs = {"time_ids": [[width, height]]}   # 仅 time_ids，无 text/time_embeds
  - noise_pred 截宽: noise_pred[..., :latents.shape[-1]]
  - 调度: FlowMatchEulerDiscrete + mu=calculate_shift(seq_len)（dynamic shifting）
  - 解码: latents/scaling_factor + shift_factor -> TinyVAE.decode
"""
import sys

import numpy as np
import torch

sys.path.insert(0, ".")  # dreamlite 包路径（导出机）


def calculate_shift(seq, base=256, mx=4096, base_shift=0.5, max_shift=1.16):
    m = (max_shift - base_shift) / (mx - base)
    return seq * m + (base_shift - m * base)


def run(unet, vae, sched, steps=4, enc=None, edit_latents=None, size=1024):
    torch.set_grad_enabled(False)
    lat = size // 8
    sigmas = np.linspace(1.0, 1.0 / steps, steps)
    mu = calculate_shift(lat * lat // 4)
    sched.set_timesteps(sigmas=sigmas.tolist(), mu=mu)
    latents = torch.randn(1, 4, lat, lat)
    cond = edit_latents if edit_latents is not None else torch.zeros_like(latents)
    enc = enc if enc is not None else torch.zeros(1, 77, 2048)
    tid = torch.tensor([[float(size), float(size)]])
    for t in sched.timesteps:
        inp = torch.cat([latents, cond], dim=3)
        np_ = unet(inp, t.expand(1), enc,
                   added_cond_kwargs={"time_ids": tid}, return_dict=False)[0]
        np_ = np_[..., : latents.shape[-1]]
        latents = sched.step(np_, t, latents, return_dict=False)[0]
    lat = (latents / vae.config.scaling_factor) + getattr(vae.config, "shift_factor", 0.0)
    return vae.decode(lat, return_dict=False)[0]
