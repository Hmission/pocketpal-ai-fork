# -*- coding: utf-8 -*-
"""
02_train_sd35_lora.py — SD3.5 Medium 人体姿态 LoRA 训练（自包含，3090 24GB 调优）

设计要点（对齐 IMAGEGEN_MODEL_TRAINING_SSOT §二 公理）：
1. **非方训练**：数据集已统一为 1024×1536（2:3 竖图），直接按该尺寸训练，
   不 center-crop 方形（官方脚本 resolution=int 会切头脚，故不依赖官方脚本）。
2. **text embedding 缓存**：统一 caption 只编码一次，缓存后释放文本编码器，
   显存只驻留 transformer + VAE（~11GB），留足激活空间。
3. **只训 transformer（MMDiT）**：冻结 3 个文本编码器 + VAE，LoRA rank 16。
4. **bf16 + 梯度检查点 + 梯度累积**：峰值显存 ~20GB（3090 24GB 预算内）。

用法（在 3090 机器上，需已装 CUDA torch）:
  python 02_train_sd35_lora.py \
    --dataset E:\\sd35_lora\\dataset\\train \
    --output  E:\\sd35_lora\\output \
    --steps 3000 --rank 16 --lr 1e-4 --resolution 1024x1536

依赖: torch(diffusers>=0.31 peft accelerate transformers safetensors) + 可选 bitsandbytes(8bit adamw)
"""
import argparse
import gc
import json
import math
import os
import random
import sys
import time

# ---------- 参数 ----------
def parse_args():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dataset", required=True, help="01 脚本输出的 train/ 目录（jpg + txt）")
    ap.add_argument("--output", required=True, help="训练输出目录")
    ap.add_argument("--base-model", default="stabilityai/stable-diffusion-3.5-medium",
                    help="底座模型 HF id 或本地 diffusers 目录")
    ap.add_argument("--resolution", default="1024x1536", help="训练分辨率 WxH（竖图 1024x1536）")
    ap.add_argument("--steps", type=int, default=3000)
    ap.add_argument("--rank", type=int, default=16)
    ap.add_argument("--alpha", type=int, default=32)
    ap.add_argument("--lr", type=float, default=1e-4)
    ap.add_argument("--batch-size", type=int, default=1)
    ap.add_argument("--grad-accum", type=int, default=4)
    ap.add_argument("--seed", type=int, default=0)
    ap.add_argument("--checkpoint-steps", type=int, default=500)
    ap.add_argument("--validation-prompt", default="a person in a dynamic pose, full body, fitness pose, athletic, photography")
    ap.add_argument("--dry-run", action="store_true", help="只打印配置不训练")
    return ap.parse_args()


def check_env():
    try:
        import torch
    except ImportError:
        sys.exit("[FAIL] 未安装 torch，请先安装 CUDA 版: pip install torch --index-url https://download.pytorch.org/whl/cu128")
    if not torch.cuda.is_available():
        sys.exit("[FAIL] torch.cuda 不可用！确认装了 cu128 版（2.10.0+cu128）")
    vram = torch.cuda.get_device_properties(0).total_memory / 1024**3
    name = torch.cuda.get_device_name(0)
    print(f"  GPU: {name} ({vram:.1f}GB)")
    if vram < 16:
        sys.exit(f"[FAIL] 显存 {vram:.1f}GB < 16GB，SD3.5 LoRA 至少需 16GB")
    import importlib.util
    for pkg in ["diffusers", "peft", "accelerate", "transformers", "safetensors"]:
        if importlib.util.find_spec(pkg) is None:
            sys.exit(f"[FAIL] 缺少 {pkg}: pip install {pkg}")
    return vram


def main():
    args = parse_args()

    # 数据检查
    if not os.path.isdir(args.dataset):
        sys.exit(f"[FAIL] 数据集目录不存在: {args.dataset}")
    imgs = sorted(f for f in os.listdir(args.dataset) if f.lower().endswith((".jpg", ".jpeg", ".png")))
    caps = sorted(f for f in os.listdir(args.dataset) if f.lower().endswith(".txt"))
    print(f"  数据集: {args.dataset}（{len(imgs)} 图 / {len(caps)} caption）")
    if len(imgs) < 10:
        sys.exit("[FAIL] 数据 <10 张，无法训练")
    # caption 配对检查
    base_imgs = {os.path.splitext(f)[0] for f in imgs}
    base_caps = {os.path.splitext(f)[0] for f in caps}
    missing = base_imgs - base_caps
    if missing:
        sys.exit(f"[FAIL] {len(missing)} 张图缺 caption（如 {sorted(missing)[0]}），请先跑 01 脚本")

    try:
        w, h = args.resolution.lower().split("x")
        RES = (int(w), int(h))
    except ValueError:
        sys.exit("[FAIL] --resolution 格式应为 WxH，如 1024x1536")

    os.makedirs(args.output, exist_ok=True)
    print("== 环境校验 ==")
    check_env()

    cfg = {
        "dataset": args.dataset, "output": args.output, "base_model": args.base_model,
        "resolution": list(RES), "steps": args.steps, "rank": args.rank, "alpha": args.alpha,
        "lr": args.lr, "batch_size": args.batch_size, "grad_accum": args.grad_accum,
        "seed": args.seed, "checkpoint_steps": args.checkpoint_steps,
        "validation_prompt": args.validation_prompt,
    }
    print("\n== 训练配置 ==")
    for k, v in cfg.items():
        print(f"  {k}: {v}")
    with open(os.path.join(args.output, "train_config.json"), "w", encoding="utf-8") as f:
        json.dump(cfg, f, ensure_ascii=False, indent=2)

    if args.dry_run:
        print("\n[DRY-RUN] 配置已生成，未启动训练。正式运行去掉 --dry-run 即可。")
        return

    train(args, RES)


def train(args, RES):
    import torch
    import torch.nn.functional as F
    from diffusers import AutoencoderKL, FlowMatchEulerDiscreteScheduler, SD3Transformer2DModel, StableDiffusion3Pipeline
    from diffusers.utils import convert_state_dict_to_diffusers
    from diffusers.models.attention_processor import AttnProcessor2_0
    from peft import LoraConfig, get_peft_model
    from transformers import AutoTokenizer, CLIPTextModelWithProjection, T5EncoderModel

    torch.manual_seed(args.seed)
    random.seed(args.seed)
    device = "cuda"
    weight_dtype = torch.bfloat16

    print("\n== 加载底座 ==")
    pipe = StableDiffusion3Pipeline.from_pretrained(
        args.base_model, torch_dtype=weight_dtype, low_cpu_mem_usage=True
    )
    vae = pipe.vae
    tokenizer_one = pipe.tokenizer
    tokenizer_two = pipe.tokenizer_2
    tokenizer_three = pipe.tokenizer_3
    text_encoder_one = pipe.text_encoder
    text_encoder_two = pipe.text_encoder_2
    text_encoder_three = pipe.text_encoder_3
    transformer = pipe.transformer
    scheduler = pipe.scheduler
    del pipe
    gc.collect()

    # 冻结 + 移到 GPU
    vae.requires_grad_(False)
    for te in (text_encoder_one, text_encoder_two, text_encoder_three):
        te.requires_grad_(False)
        te.to(device, dtype=weight_dtype)
    transformer.requires_grad_(False)
    transformer.to(device, dtype=weight_dtype)
    if hasattr(transformer, "set_attn_processor"):
        transformer.set_attn_processor(AttnProcessor2_0())
    if hasattr(transformer, "enable_gradient_checkpointing"):
        transformer.enable_gradient_checkpointing()

    # ---------- LoRA 注入 transformer ----------
    print(f"== LoRA 注入（rank={args.rank} alpha={args.alpha}）==")
    lora_config = LoraConfig(
        r=args.rank,
        lora_alpha=args.alpha,
        init_lora_weights="gaussian",
        target_modules=["to_q", "to_k", "to_v", "to_out.0", "ff.net.0.proj", "ff.net.2"],
    )
    transformer = get_peft_model(transformer, lora_config)
    transformer.print_trainable_parameters()

    # ---------- text embedding 缓存（统一 caption 只编码一次）----------
    print("== 文本编码（缓存 embedding）==")
    prompt_cache = {}

    @torch.no_grad()
    def encode_prompt(prompt):
        if prompt in prompt_cache:
            return prompt_cache[prompt]
        # 对齐 SD3 pipeline 的三编码器合并逻辑
        with torch.autocast("cuda", dtype=weight_dtype):
            prompt_embeds_list, pooled_prompt_embeds_list = [], []
            for tok, te in ((tokenizer_one, text_encoder_one),
                            (tokenizer_two, text_encoder_two),
                            (tokenizer_three, text_encoder_three)):
                toks = tok(prompt, padding="max_length", max_length=77 if tok is not tokenizer_three else 256,
                           truncation=True, return_tensors="pt").to(device)
                if te is text_encoder_three:
                    out = te(toks.input_ids, output_hidden_states=False)
                    prompt_embeds_list.append(out[0])
                else:
                    out = te(toks.input_ids, output_hidden_states=False)
                    prompt_embeds_list.append(out[0])
                    pooled_prompt_embeds_list.append(out.text_embeds)
            # CLIP-L / CLIP-G 合并 + T5 concat（对齐 SD3 官方 `_get_prompt_embeds`）
            clip_embeds = torch.cat(prompt_embeds_list[:2], dim=-1)
            t5_embeds = prompt_embeds_list[2]
            # SD3: prompt_embeds = cat([clip_embeds, t5_embeds], dim=1)；T5 pad 到 77? 官方直接 concat 时间维
            prompt_embeds = torch.cat([clip_embeds, t5_embeds], dim=1)
            pooled_prompt_embeds = pooled_prompt_embeds_list[0]
            prompt_embeds = prompt_embeds.to(device, dtype=weight_dtype)
            pooled_prompt_embeds = pooled_prompt_embeds.to(device, dtype=weight_dtype)
        prompt_cache[prompt] = (prompt_embeds, pooled_prompt_embeds)
        return prompt_cache[prompt]

    # 预编码统一 caption（读取全部 .txt，去重后缓存）
    all_captions = set()
    for f in os.listdir(args.dataset):
        if f.endswith(".txt"):
            with open(os.path.join(args.dataset, f), encoding="utf-8") as fp:
                all_captions.add(fp.read().strip())
    for p in all_captions:
        encode_prompt(p)
    # 文本编码器不再需要，释放显存
    for te in (text_encoder_one, text_encoder_two, text_encoder_three):
        te.to("cpu")
        del te
    del tokenizer_one, tokenizer_two, tokenizer_three
    gc.collect()
    torch.cuda.empty_cache()
    print(f"  已缓存 {len(all_captions)} 条 caption 的 embedding，文本编码器已释放")

    # ---------- 数据集 ----------
    class PoseDataset(torch.utils.data.Dataset):
        def __init__(self, folder, res):
            self.items = []
            for f in sorted(os.listdir(folder)):
                if f.lower().endswith((".jpg", ".jpeg", ".png")):
                    cap = os.path.splitext(f)[0] + ".txt"
                    with open(os.path.join(folder, cap), encoding="utf-8") as fp:
                        txt = fp.read().strip()
                    self.items.append((os.path.join(folder, f), txt))
            self.res = res
        def __len__(self):
            return len(self.items)
        def __getitem__(self, i):
            import numpy as np
            from PIL import Image
            path, txt = self.items[i]
            img = Image.open(path).convert("RGB")
            img = img.resize(self.res, Image.LANCZOS)  # 已统一，防御性 resize
            arr = np.asarray(img, dtype=np.float32) / 127.5 - 1.0  # HWC -> 归一化
            return torch.from_numpy(arr).permute(2, 0, 1), txt

    from torch.utils.data import DataLoader
    ds = PoseDataset(args.dataset, RES)
    loader = DataLoader(ds, batch_size=args.batch_size, shuffle=True, num_workers=0)

    # ---------- 优化器 ----------
    params = [p for p in transformer.parameters() if p.requires_grad]
    try:
        import bitsandbytes as bnb
        optimizer = bnb.optim.AdamW8bit(params, lr=args.lr)
        print("  优化器: AdamW8bit（bitsandbytes）")
    except ImportError:
        from torch.optim import AdamW
        optimizer = AdamW(params, lr=args.lr)
        print("  优化器: AdamW（fp32，未装 bitsandbytes）")

    vae.to(device, dtype=weight_dtype)
    transformer.train()
    global_step = 0
    start_time = time.time()
    print(f"\n== 开始训练（{args.steps} 步，目标显存 ≤20GB）==")

    # 训练循环（SD3 flow matching）
    for epoch in range(1000):
        for batch_imgs, batch_caps in loader:
            latents = vae.encode(batch_imgs.to(device, dtype=weight_dtype)).latent_dist.sample()
            latents = latents * vae.config.scaling_factor
            noise = torch.randn_like(latents)
            bsz = latents.shape[0]
            # flow matching: 随机 sigma
            sigmas = torch.rand(bsz, device=device)  # 0~1
            noisy_latents = (1.0 - sigmas.view(-1, 1, 1, 1)) * latents + sigmas.view(-1, 1, 1, 1) * noise
            timesteps = (sigmas * 1000.0).long().clamp(0, 999)

            prompt_embeds, pooled = encode_prompt(batch_caps[0])
            prompt_embeds = prompt_embeds.repeat(bsz, 1, 1)
            pooled = pooled.repeat(bsz, 1)

            with torch.autocast("cuda", dtype=weight_dtype):
                pred = transformer(
                    hidden_states=noisy_latents,
                    timestep=timesteps,
                    encoder_hidden_states=prompt_embeds,
                    pooled_projections=pooled,
                    return_dict=False,
                )[0]
                target = noise - latents  # v-pred 目标（flow matching: u = z1 - z0）
                loss = F.mse_loss(pred.float(), target.float())

            loss.backward()
            if (global_step + 1) % args.grad_accum == 0:
                optimizer.step()
                optimizer.zero_grad()

            global_step += 1
            if global_step % 50 == 0:
                elapsed = time.time() - start_time
                print(f"  step {global_step}/{args.steps} | loss {loss.item():.4f} | {elapsed/60:.1f}min")

            # checkpoint（LoRA key 转 diffusers 格式: base_model.model. -> transformer.）
            if global_step % args.checkpoint_steps == 0:
                ckpt = os.path.join(args.output, f"lora_step{global_step}.safetensors")
                import safetensors.torch
                state = {k.replace("base_model.model.", "transformer."): v.detach().cpu().float()
                         for k, v in transformer.state_dict().items() if "lora" in k}
                safetensors.torch.save_file(state, ckpt)
                print(f"  [CKPT] {ckpt}")

            if global_step >= args.steps:
                break
        if global_step >= args.steps:
            break

    # 保存最终 LoRA（key 转 diffusers 格式: base_model.model. -> transformer.，供 load_lora_weights 消费）
    final = os.path.join(args.output, "pytorch_lora_weights.safetensors")
    import safetensors.torch
    state = {k.replace("base_model.model.", "transformer."): v.detach().cpu().float()
             for k, v in transformer.state_dict().items() if "lora" in k}
    safetensors.torch.save_file(state, final)
    print(f"\n[OK] 训练完成，LoRA 权重: {final}")
    print(f"      用时 {(time.time()-start_time)/3600:.1f} 小时 | 最终 loss {loss.item():.4f}")


if __name__ == "__main__":
    main()
