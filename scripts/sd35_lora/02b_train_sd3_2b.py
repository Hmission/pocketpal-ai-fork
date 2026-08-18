# -*- coding: utf-8 -*-
"""
02b_train_sd3_2b.py — SD3 2B（joint_blocks，引擎兼容架构）人体姿态 LoRA 训练

与 02（SD3.5 Medium）的关键差异:
1. 底座 = 真机原版 GGUF 提取的 safetensors（E:/sd35_lora/base2/sd3_2b_qknorm.safetensors），
   结构为引擎 mmdit.hpp 的 joint_blocks（x_block 前 13 块带 attn2 + RMSNorm QK-norm + 中心裁剪 pos_embed）。
2. 文本编码 = 引擎 SD3CLIPEmbedder 格式：clip_l hidden[-2] + clip_g hidden[-2]
   特征维 concat [77,2048] -> 零填充 [77,4096]；pooled concat [2048]。无 T5！
3. LoRA target_modules 为 blocks 命名: qkv / proj / fc1 / fc2 / context_embedder。
4. 手写模型不含 gradient checkpointing 接口，用 torch.utils.checkpoint 包 blocks（最后一块除外）。

用法（3090 24GB，已装 CUDA torch）:
  python 02b_train_sd3_2b.py \
    --dataset E:\\sd35_lora\\dataset\\train \
    --output  E:\\sd35_lora\\output_2b \
    --steps 3000 --rank 16 --lr 1e-4 --resolution 1024x1536

依赖: torch + peft + transformers + safetensors + diffusers(仅 VAE)
"""
import argparse
import gc
import json
import os
import random
import sys
import time


def parse_args():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dataset", required=True, help="01 脚本输出的 train/ 目录（jpg + txt）")
    ap.add_argument("--output", required=True, help="训练输出目录")
    ap.add_argument("--base", default=r"E:\sd35_lora\base2\sd3_2b_qknorm.safetensors",
                    help="底座 transformer safetensors（引擎 GGUF 提取版）")
    ap.add_argument("--vae-dir", default=r"E:\sd35_lora\base2\stable-diffusion-3-medium\vae",
                    help="diffusers VAE 目录（SD3 16ch，与引擎伴侣 vae 一致）")
    ap.add_argument("--te-dir", default=r"E:\sd35_lora\base2\stable-diffusion-3-medium",
                    help="diffusers 目录（含 text_encoder/text_encoder_2/tokenizer/tokenizer_2，忽略 T5）")
    ap.add_argument("--resolution", default="1024x1536", help="训练分辨率 WxH（竖图 1024x1536）")
    ap.add_argument("--steps", type=int, default=3000)
    ap.add_argument("--rank", type=int, default=16)
    ap.add_argument("--alpha", type=int, default=32)
    ap.add_argument("--lr", type=float, default=1e-4)
    ap.add_argument("--batch-size", type=int, default=1)
    ap.add_argument("--grad-accum", type=int, default=4)
    ap.add_argument("--seed", type=int, default=0)
    ap.add_argument("--checkpoint-steps", type=int, default=500)
    ap.add_argument("--grad-checkpoint", action="store_true", default=True,
                    help="blocks 级梯度检查点（默认开，24GB 显存必开）")
    ap.add_argument("--resume", default=None,
                    help="续训：指定已有 LoRA checkpoint（如 lora_step1000.safetensors），从其权重继续训练")
    ap.add_argument("--resume-step", type=int, default=0,
                    help="续训起点步数（与 --resume 配合，打印/保存以该值为基准）")
    ap.add_argument("--dry-run", action="store_true", help="只打印配置不训练")
    return ap.parse_args()


def check_env():
    import torch
    if not torch.cuda.is_available():
        sys.exit("[FAIL] torch.cuda 不可用！确认装了 cu128 版")
    vram = torch.cuda.get_device_properties(0).total_memory / 1024**3
    print(f"  GPU: {torch.cuda.get_device_name(0)} ({vram:.1f}GB)")
    if vram < 16:
        sys.exit(f"[FAIL] 显存 {vram:.1f}GB < 16GB")
    import importlib.util
    for pkg in ["peft", "transformers", "safetensors", "diffusers"]:
        if importlib.util.find_spec(pkg) is None:
            sys.exit(f"[FAIL] 缺少 {pkg}")
    return vram


def main():
    args = parse_args()
    if not os.path.isdir(args.dataset):
        sys.exit(f"[FAIL] 数据集目录不存在: {args.dataset}")
    imgs = sorted(f for f in os.listdir(args.dataset) if f.lower().endswith((".jpg", ".jpeg", ".png")))
    caps = sorted(f for f in os.listdir(args.dataset) if f.lower().endswith(".txt"))
    print(f"  数据集: {args.dataset}（{len(imgs)} 图 / {len(caps)} caption）")
    if len(imgs) < 10:
        sys.exit("[FAIL] 数据 <10 张，无法训练")
    base_imgs = {os.path.splitext(f)[0] for f in imgs}
    base_caps = {os.path.splitext(f)[0] for f in caps}
    missing = base_imgs - base_caps
    if missing:
        sys.exit(f"[FAIL] {len(missing)} 张图缺 caption（如 {sorted(missing)[0]}）")
    try:
        w, h = args.resolution.lower().split("x")
        RES = (int(w), int(h))
    except ValueError:
        sys.exit("[FAIL] --resolution 格式应为 WxH")
    if not os.path.isfile(args.base):
        sys.exit(f"[FAIL] 底座不存在: {args.base}")
    os.makedirs(args.output, exist_ok=True)

    print("== 环境校验 ==")
    check_env()

    cfg = {
        "dataset": args.dataset, "output": args.output, "base": args.base,
        "vae_dir": args.vae_dir, "te_dir": args.te_dir,
        "resolution": list(RES), "steps": args.steps, "rank": args.rank, "alpha": args.alpha,
        "lr": args.lr, "batch_size": args.batch_size, "grad_accum": args.grad_accum,
        "seed": args.seed, "checkpoint_steps": args.checkpoint_steps,
        "grad_checkpoint": args.grad_checkpoint,
        "resume": args.resume, "resume_step": args.resume_step,
    }
    print("\n== 训练配置 ==")
    for k, v in cfg.items():
        print(f"  {k}: {v}")
    with open(os.path.join(args.output, "train_config.json"), "w", encoding="utf-8") as f:
        json.dump(cfg, f, ensure_ascii=False, indent=2)
    if args.dry_run:
        print("\n[DRY-RUN] 配置已生成，未启动训练。")
        return
    train(args, RES)


def train(args, RES):
    import torch
    import torch.nn.functional as F
    from diffusers import AutoencoderKL
    from peft import LoraConfig, get_peft_model, set_peft_model_state_dict
    from transformers import CLIPTextModelWithProjection, CLIPTokenizer

    # 手写模型（脚本同目录）
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    from sd3_2b_model import SD3_2B_MMDiT, detect_d_self, load_sd3_2b_weights

    torch.manual_seed(args.seed)
    random.seed(args.seed)
    device = "cuda"
    weight_dtype = torch.bfloat16

    print("\n== 构建 SD3 2B 底座（引擎 mmdit.hpp 复刻）==")
    d_self = detect_d_self(args.base)
    print(f"  d_self={d_self}（x_block 前 {d_self+1} 块带 attn2）")
    model = SD3_2B_MMDiT(d_self=d_self)
    n_params = sum(p.numel() for p in model.parameters())
    print(f"  参数量: {n_params/1e9:.2f}B")
    missing, unexpected = load_sd3_2b_weights(model, args.base, prefix="")
    if missing:
        sys.exit(f"[FAIL] 底座加载缺失 {len(missing)} 个权重")
    if unexpected:
        print(f"  [WARN] 多余 {len(unexpected)} 个权重: {unexpected[:3]}")

    print("\n== LoRA 注入（rank=%d alpha=%d）==" % (args.rank, args.alpha))
    lora_config = LoraConfig(
        r=args.rank,
        lora_alpha=args.alpha,
        init_lora_weights="gaussian",
        target_modules=["qkv", "proj", "fc1", "fc2", "context_embedder"],
    )
    model = get_peft_model(model, lora_config)
    model.print_trainable_parameters()

    # 续训：从已有 checkpoint 灌入 LoRA 权重
    if args.resume:
        if not os.path.isfile(args.resume):
            sys.exit(f"[FAIL] 续训 checkpoint 不存在: {args.resume}")
        import safetensors.torch
        state = safetensors.torch.load_file(args.resume)
        n_lora = len([k for k in state if "lora" in k])
        print(f"  续训加载: {args.resume}（{n_lora} 个 LoRA key，起点 step={args.resume_step}）")
        set_peft_model_state_dict(model, state, adapter_name="default")
    model.to(device, dtype=weight_dtype)

    print("\n== 加载 VAE ==")
    vae = AutoencoderKL.from_pretrained(
        args.vae_dir, torch_dtype=weight_dtype, use_safetensors=True
    ).to(device)
    vae.requires_grad_(False)
    vae.eval()
    scaling_factor = float(getattr(vae.config, "scaling_factor", 1.0))
    print(f"  VAE scaling_factor={scaling_factor}")

    print("\n== 加载文本编码器（CLIP-L + CLIP-G，引擎 SD3CLIPEmbedder 格式）==")
    tokenizer_one = CLIPTokenizer.from_pretrained(os.path.join(args.te_dir, "tokenizer"))
    tokenizer_two = CLIPTokenizer.from_pretrained(os.path.join(args.te_dir, "tokenizer_2"))
    text_encoder_one = CLIPTextModelWithProjection.from_pretrained(
        os.path.join(args.te_dir, "text_encoder"), torch_dtype=weight_dtype
    ).to(device)
    text_encoder_two = CLIPTextModelWithProjection.from_pretrained(
        os.path.join(args.te_dir, "text_encoder_2"), torch_dtype=weight_dtype
    ).to(device)
    for te in (text_encoder_one, text_encoder_two):
        te.requires_grad_(False)
        te.eval()

    # ---------- text embedding 缓存（引擎 SD3CLIPEmbedder 格式）----------
    prompt_cache = {}

    @torch.no_grad()
    def encode_prompt(prompt):
        """clip_l hidden[-2] + clip_g hidden[-2] 特征维 concat -> pad 4096；pooled concat 2048。无 T5"""
        if prompt in prompt_cache:
            return prompt_cache[prompt]
        with torch.autocast("cuda", dtype=weight_dtype):
            clip_embeds_list, pooled_list = [], []
            for tok, te in ((tokenizer_one, text_encoder_one), (tokenizer_two, text_encoder_two)):
                toks = tok(prompt, padding="max_length", max_length=77, truncation=True, return_tensors="pt").to(device)
                out = te(toks.input_ids, output_hidden_states=True)
                clip_embeds_list.append(out.hidden_states[-2])  # 倒数第二层
                pooled_list.append(out[0])
            clip_embeds = torch.cat(clip_embeds_list, dim=-1)  # [1, 77, 2048]
            prompt_embeds = F.pad(clip_embeds, (0, 4096 - clip_embeds.shape[-1]))  # [1, 77, 4096]
            pooled_prompt_embeds = torch.cat(pooled_list, dim=-1)  # [1, 2048]
            prompt_embeds = prompt_embeds.to(dtype=weight_dtype)
            pooled_prompt_embeds = pooled_prompt_embeds.to(dtype=weight_dtype)
        prompt_cache[prompt] = (prompt_embeds, pooled_prompt_embeds)
        return prompt_cache[prompt]

    all_captions = set()
    for f in os.listdir(args.dataset):
        if f.endswith(".txt"):
            with open(os.path.join(args.dataset, f), encoding="utf-8") as fp:
                all_captions.add(fp.read().strip())
    for p in all_captions:
        encode_prompt(p)
    for te in (text_encoder_one, text_encoder_two):
        te.to("cpu")
        del te
    del tokenizer_one, tokenizer_two
    gc.collect()
    torch.cuda.empty_cache()
    print(f"  已缓存 {len(all_captions)} 条 caption，文本编码器已释放")

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
            img = img.resize(self.res, Image.LANCZOS)
            arr = np.asarray(img, dtype=np.float32) / 127.5 - 1.0
            return torch.from_numpy(arr).permute(2, 0, 1), txt

    from torch.utils.data import DataLoader
    ds = PoseDataset(args.dataset, RES)
    loader = DataLoader(ds, batch_size=args.batch_size, shuffle=True, num_workers=0)

    # ---------- 优化器 ----------
    params = [p for p in model.parameters() if p.requires_grad]
    try:
        import bitsandbytes as bnb
        optimizer = bnb.optim.AdamW8bit(params, lr=args.lr)
        print("  优化器: AdamW8bit（bitsandbytes）")
    except ImportError:
        from torch.optim import AdamW
        optimizer = AdamW(params, lr=args.lr)
        print("  优化器: AdamW（fp32，未装 bitsandbytes）")

    model.train()
    global_step = args.resume_step
    start_time = time.time()
    print(f"\n== 开始训练（{args.steps} 步，目标显存 ≤20GB）==")

    # blocks 梯度检查点（最后一块输出 context=None，不参与 checkpoint）
    use_ckpt = args.grad_checkpoint
    n_ckpt_blocks = len(model.base_model.blocks) - 1

    for epoch in range(1000):
        for batch_imgs, batch_caps in loader:
            latents = vae.encode(batch_imgs.to(device, dtype=weight_dtype)).latent_dist.sample()
            latents = latents * scaling_factor
            noise = torch.randn_like(latents)
            bsz = latents.shape[0]
            sigmas = torch.rand(bsz, device=device)
            noisy_latents = (1.0 - sigmas.view(-1, 1, 1, 1)) * latents + sigmas.view(-1, 1, 1, 1) * noise
            timesteps = sigmas * 1000.0  # 连续 timestep（手写模型正弦嵌入）

            prompt_embeds, pooled = encode_prompt(batch_caps[0])
            prompt_embeds = prompt_embeds.repeat(bsz, 1, 1)
            pooled = pooled.repeat(bsz, 1)

            with torch.autocast("cuda", dtype=weight_dtype):
                if use_ckpt:
                    pred = model.base_model.forward_with_checkpoint(
                        noisy_latents, timesteps, prompt_embeds, pooled, ckpt_blocks=n_ckpt_blocks
                    )
                else:
                    pred = model(noisy_latents, timesteps, prompt_embeds, pooled)
                target = noise - latents  # velocity
                loss = F.mse_loss(pred.float(), target.float())

            loss.backward()
            if (global_step + 1) % args.grad_accum == 0:
                optimizer.step()
                optimizer.zero_grad()

            global_step += 1
            if global_step % 50 == 0:
                elapsed = time.time() - start_time
                print(f"  step {global_step}/{args.steps} | loss {loss.item():.4f} | {elapsed/60:.1f}min")

            if global_step % args.checkpoint_steps == 0:
                ckpt = os.path.join(args.output, f"lora_step{global_step}.safetensors")
                save_lora(ckpt, model)
                print(f"  [CKPT] {ckpt}")

            if global_step >= args.steps:
                break
        if global_step >= args.steps:
            break

    final = os.path.join(args.output, "pytorch_lora_weights.safetensors")
    save_lora(final, model)
    print(f"\n[OK] 训练完成，LoRA 权重: {final}")
    print(f"      用时 {(time.time()-start_time)/3600:.1f} 小时 | 最终 loss {loss.item():.4f}")


def save_lora(path, peft_model):
    """保存 LoRA（保留 peft 原始 key: base_model.model.blocks.）"""
    import safetensors.torch
    state = {k: v.detach().cpu().float()
             for k, v in peft_model.state_dict().items() if "lora" in k}
    safetensors.torch.save_file(state, path)
    return path


if __name__ == "__main__":
    main()
