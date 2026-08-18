# -*- coding: utf-8 -*-
"""
06_sd3_2b_model.py — 手写 SD3 2B MMDiT（joint_blocks 双流架构，精确复刻引擎 mmdit.hpp）

背景: 真机 vendored 引擎（stable-diffusion.cpp）的 MMDiT 实现与 ComfyUI 单文件
结构不同。本模块按引擎 mmdit.hpp 的 DismantledBlock/JointBlock/block_mixing
逐层复刻，权重来源为引擎原版 GGUF 提取的 safetensors（E:/sd35_lora/base2/sd3_2b_qknorm.safetensors）。

引擎结构要点（与单文件的关键差异）:
- norm1/norm2: LayerNorm 无 affine（纯归一化，无权重）
- QK-norm: per-head RMSNorm(weight-only, eps=1e-6)
- x_block 前 d_self+1 块（0..16）带 attn2 自注意力（adaLN 9× = attn/attn2/mlp 各 scale-shift-gate）
- 其余 x_block 仅 attn（adaLN 6×）；最后一块 context_block pre_only（adaLN 2× + qkv 无 proj/mlp，输出丢弃）
- pos_embed: [147456, 1536]（384×384 网格）→ 中心裁剪（非插值）
- final_layer: norm_final(LayerNorm 无 affine) + adaLN(2×) + linear
"""
import math

import torch
import torch.nn as nn
import torch.nn.functional as F


def timestep_embedding(t, dim=256, max_period=10000):
    """sinusoidal timestep embedding（SD3 标准，与引擎 ggml_ext_timestep_embedding 一致）"""
    half = dim // 2
    freqs = torch.exp(-math.log(max_period) * torch.arange(half, device=t.device, dtype=torch.float32) / half)
    args = t[:, None].float() * freqs[None]
    return torch.cat([torch.cos(args), torch.sin(args)], dim=-1)


class RMSNorm(nn.Module):
    """per-head RMSNorm（weight-only，无 bias），eps=1e-6"""

    def __init__(self, dim, eps=1e-6):
        super().__init__()
        self.weight = nn.Parameter(torch.ones(dim))
        self.eps = eps

    def forward(self, x):
        # x: [B, T, h, hd]
        r = torch.rsqrt(x.float().pow(2).mean(-1, keepdim=True) + self.eps)
        return (x * r * self.weight).to(x.dtype)


class LayerNormNoAffine(nn.Module):
    """纯归一化 LayerNorm（无 weight/bias），eps=1e-6"""

    def __init__(self, dim, eps=1e-6):
        super().__init__()
        self.eps = eps

    def forward(self, x):
        return F.layer_norm(x, (x.shape[-1],), None, None, self.eps)


class Mlp(nn.Module):
    """fc1 + GELU(tanh) + fc2；t/y_embedder 与 blocks 内 mlp 共用"""

    def __init__(self, in_dim, hidden_dim, out_dim=None):
        super().__init__()
        if out_dim is None:
            out_dim = in_dim
        self.fc1 = nn.Linear(in_dim, hidden_dim, bias=True)
        self.fc2 = nn.Linear(hidden_dim, out_dim, bias=True)

    def forward(self, x):
        return self.fc2(F.gelu(self.fc1(x), approximate="tanh"))


class SelfAttention(nn.Module):
    """qkv 融合 + per-head QK-norm + proj（pre_only 时无 proj）"""

    def __init__(self, dim, heads, eps=1e-6, pre_only=False):
        super().__init__()
        self.dim = dim
        self.heads = heads
        self.head_dim = dim // heads
        self.qkv = nn.Linear(dim, 3 * dim, bias=True)
        self.ln_q = RMSNorm(self.head_dim, eps)
        self.ln_k = RMSNorm(self.head_dim, eps)
        if not pre_only:
            self.proj = nn.Linear(dim, dim, bias=True)

    def pre_attention(self, x):
        """x: [B, T, dim] -> q/k/v: [B, T, h, hd]（QK-norm 后）"""
        B, T, _ = x.shape
        qkv = self.qkv(x).view(B, T, 3, self.heads, self.head_dim)
        q, k, v = qkv.unbind(2)
        q = self.ln_q(q)
        k = self.ln_k(k)
        return q, k, v

    def attention(self, q, k, v):
        """自注意力（attn2 用）: q/k/v [B, T, h, hd] -> [B, T, h*hd]"""
        return sdpa_attention(q, k, v)

    def post_attention(self, o):
        return self.proj(o)


def modulate(x, shift, scale):
    """x*(1+scale)+shift（引擎 modulate 语义）"""
    return x * (1 + scale) + shift


def sdpa_attention(q, k, v):
    """flash/mem-efficient 内核的 scaled dot-product attention。
    q/k/v: [B, T, h, hd] -> [B, T, h*hd]（内部 scale=1/sqrt(hd)）"""
    B, T, h, hd = q.shape
    q = q.transpose(1, 2)
    k = k.transpose(1, 2)
    v = v.transpose(1, 2)
    o = F.scaled_dot_product_attention(q, k, v)
    return o.transpose(1, 2).reshape(B, T, h * hd)


class DismantledBlock(nn.Module):
    """引擎 DismantledBlock：norm1 + attn(+attn2) + norm2 + mlp + adaLN"""

    def __init__(self, dim, heads, eps=1e-6, pre_only=False, self_attn=False):
        super().__init__()
        self.dim = dim
        self.pre_only = pre_only
        self.self_attn = self_attn
        self.norm1 = LayerNormNoAffine(dim, eps)
        self.attn = SelfAttention(dim, heads, eps, pre_only)
        if self_attn:
            self.attn2 = SelfAttention(dim, heads, eps, False)
        if not pre_only:
            self.norm2 = LayerNormNoAffine(dim, eps)
            self.mlp = Mlp(dim, 4 * dim)
        n_mods = 9 if self_attn else (2 if pre_only else 6)
        self.adaLN_modulation = nn.Sequential(nn.SiLU(), nn.Linear(dim, n_mods * dim))

    def _adaLN(self, c):
        """返回调制参数 chunk 列表，顺序与引擎 ggml_ext_chunk 一致"""
        m = self.adaLN_modulation(c)  # [B, n_mods*dim]
        if self.self_attn:
            # shift_msa, scale_msa, gate_msa, shift_mlp, scale_mlp, gate_mlp, shift_msa2, scale_msa2, gate_msa2
            return m.chunk(9, dim=-1)
        if self.pre_only:
            return (m.chunk(2, dim=-1))  # shift, scale
        # shift_msa, scale_msa, gate_msa, shift_mlp, scale_mlp, gate_mlp
        return m.chunk(6, dim=-1)

    def pre_attention(self, x, c):
        """非 self_attn（context_block / 无 attn2 的 x_block）"""
        if self.self_attn:
            raise ValueError("use pre_attention_x")
        p = self._adaLN(c)
        if self.pre_only:
            shift, scale = p
            attn_in = modulate(self.norm1(x), shift, scale)
            qkv = self.attn.pre_attention(attn_in)
            return qkv, None
        shift_msa, scale_msa, gate_msa, shift_mlp, scale_mlp, gate_mlp = p
        attn_in = modulate(self.norm1(x), shift_msa, scale_msa)
        qkv = self.attn.pre_attention(attn_in)
        return qkv, (gate_msa, shift_mlp, scale_mlp, gate_mlp)

    def pre_attention_x(self, x, c):
        """self_attn（9× adaLN）：attn + attn2 共享 norm1 输出"""
        p = self._adaLN(c)
        (shift_msa, scale_msa, gate_msa, shift_mlp, scale_mlp, gate_mlp,
         shift_msa2, scale_msa2, gate_msa2) = p
        x_norm = self.norm1(x)
        qkv = self.attn.pre_attention(modulate(x_norm, shift_msa, scale_msa))
        qkv2 = self.attn2.pre_attention(modulate(x_norm, shift_msa2, scale_msa2))
        return qkv, qkv2, (gate_msa, shift_mlp, scale_mlp, gate_mlp, gate_msa2)

    def post_attention(self, attn_out, x, inter):
        """非 self_attn：gate_msa*proj(attn) + gate_mlp*mlp(norm2 调制)"""
        gate_msa, shift_mlp, scale_mlp, gate_mlp = inter
        x = x + self.attn.post_attention(attn_out) * gate_msa
        mlp_out = self.mlp(modulate(self.norm2(x), shift_mlp, scale_mlp))
        x = x + mlp_out * gate_mlp
        return x

    def post_attention_x(self, attn_out, attn2_out, x, inter):
        """self_attn：attn 与 attn2 输出各带 gate 相加"""
        gate_msa, shift_mlp, scale_mlp, gate_mlp, gate_msa2 = inter
        x = x + self.attn.post_attention(attn_out) * gate_msa
        x = x + self.attn2.post_attention(attn2_out) * gate_msa2
        mlp_out = self.mlp(modulate(self.norm2(x), shift_mlp, scale_mlp))
        x = x + mlp_out * gate_mlp
        return x


class JointBlock(nn.Module):
    """引擎 JointBlock：context_block + x_block 双 DismantledBlock"""

    def __init__(self, dim, heads, eps=1e-6, pre_only=False, self_attn_x=False):
        super().__init__()
        self.context_block = DismantledBlock(dim, heads, eps, pre_only=pre_only, self_attn=False)
        self.x_block = DismantledBlock(dim, heads, eps, pre_only=False, self_attn=self_attn_x)


class SD3_2B_MMDiT(nn.Module):
    """手写 SD3 2B（joint_blocks 双流 MMDiT，引擎 mmdit.hpp 复刻）

    dim=1536, heads=24, layers=24, ctx_dim=4096, pooled_dim=2048
    d_self=16: blocks 0..16 的 x_block 带 attn2；最后一块 context_block pre_only
    """

    def __init__(self, dim=1536, heads=24, layers=24, ctx_dim=4096, pooled_dim=2048,
                 patch_size=2, in_channels=16, pos_embed_grid=384, d_self=16):
        super().__init__()
        self.dim = dim
        self.heads = heads
        self.patch_size = patch_size
        self.in_channels = in_channels
        self.pos_embed_grid = pos_embed_grid
        self.x_embedder = nn.Conv2d(in_channels, dim, kernel_size=patch_size, stride=patch_size, bias=True)
        self.pos_embed = nn.Parameter(torch.zeros(pos_embed_grid * pos_embed_grid, dim))
        self.t_embedder = Mlp(256, dim, dim)
        self.y_embedder = Mlp(pooled_dim, dim, dim)
        self.context_embedder = nn.Linear(ctx_dim, dim, bias=True)
        self.blocks = nn.ModuleList(
            [
                JointBlock(dim, heads, pre_only=(i == layers - 1), self_attn_x=(i <= d_self))
                for i in range(layers)
            ]
        )
        self.final_adaLN = nn.Sequential(nn.SiLU(), nn.Linear(dim, 2 * dim))
        self.final_norm = LayerNormNoAffine(dim, 1e-6)
        self.final_linear = nn.Linear(dim, patch_size * patch_size * in_channels, bias=True)

    def cropped_pos_embed(self, ph, pw):
        """pos_embed 中心裁剪（引擎 cropped_pos_embed 语义）: [ph*pw, dim]"""
        g = self.pos_embed_grid
        pe2d = self.pos_embed.reshape(g, g, self.dim).permute(2, 0, 1)  # [dim, g, g]
        top = (g - ph) // 2
        left = (g - pw) // 2
        pe_crop = pe2d[:, top:top + ph, left:left + pw]  # [dim, ph, pw]
        return pe_crop.reshape(self.dim, -1).transpose(0, 1)  # [ph*pw, dim]

    def forward(self, x, t, prompt_embeds, pooled_prompt_embeds):
        """
        x: [B, 16, H, W] latent
        t: [B] timestep
        prompt_embeds: [B, ct, 4096]（clip concat + pad，引擎 c_crossattn 格式）
        pooled_prompt_embeds: [B, 2048]
        """
        B, C, H, W = x.shape
        p = self.patch_size
        ph, pw = H // p, W // p
        # patchify + pos_embed（中心裁剪）
        h = self.x_embedder(x)  # [B, dim, ph, pw]
        h = h.flatten(2).transpose(1, 2)  # [B, ph*pw, dim]
        h = h + self.cropped_pos_embed(ph, pw).unsqueeze(0)
        # 条件
        t_emb = timestep_embedding(t, 256).to(x.dtype)
        c = self.t_embedder(t_emb) + self.y_embedder(pooled_prompt_embeds)  # [B, dim]
        context = self.context_embedder(prompt_embeds)  # [B, ct, dim]
        # blocks
        for blk in self.blocks:
            context, h = self._block_mixing(blk, context, h, c)
        # final: norm_final + adaLN(2x) + linear
        s, b = self.final_adaLN(c).chunk(2, dim=-1)
        h = modulate(self.final_norm(h), s, b)
        h = self.final_linear(h)  # [B, ph*pw, p*p*C]
        # unpatchify
        h = h.reshape(B, ph, pw, p, p, C).permute(0, 5, 1, 3, 2, 4).reshape(B, C, H, W)
        return h

    def forward_with_checkpoint(self, x, t, prompt_embeds, pooled_prompt_embeds, ckpt_blocks=0):
        """训练版 forward：前 ckpt_blocks 个 joint_blocks 用梯度检查点（省激活显存）。
        最后一块 context_block pre_only 输出 context=None，不参与 checkpoint。"""
        from torch.utils.checkpoint import checkpoint

        B, C, H, W = x.shape
        p = self.patch_size
        ph, pw = H // p, W // p
        h = self.x_embedder(x)
        h = h.flatten(2).transpose(1, 2)
        h = h + self.cropped_pos_embed(ph, pw).unsqueeze(0)
        t_emb = timestep_embedding(t, 256).to(x.dtype)
        c = self.t_embedder(t_emb) + self.y_embedder(pooled_prompt_embeds)
        context = self.context_embedder(prompt_embeds)
        for i, blk in enumerate(self.blocks):
            if i < ckpt_blocks:
                context, h = checkpoint(self._block_mixing, blk, context, h, c, use_reentrant=False)
            else:
                context, h = self._block_mixing(blk, context, h, c)
        s, b = self.final_adaLN(c).chunk(2, dim=-1)
        h = modulate(self.final_norm(h), s, b)
        h = self.final_linear(h)
        h = h.reshape(B, ph, pw, p, p, C).permute(0, 5, 1, 3, 2, 4).reshape(B, C, H, W)
        return h

    def _block_mixing(self, blk, context, x, c):
        """引擎 block_mixing：context/x 双流 joint attention + x 流 attn2"""
        context_block, x_block = blk.context_block, blk.x_block
        # context_block 前处理
        c_qkv, c_inter = context_block.pre_attention(context, c)  # context_block self_attn=False 恒成立
        # x_block 前处理
        if x_block.self_attn:
            x_qkv, x_qkv2, x_inter = x_block.pre_attention_x(x, c)
        else:
            x_qkv, x_inter = x_block.pre_attention(x, c)
            x_qkv2 = None
        # 拼接 KV 做 joint attention
        q = torch.cat([c_qkv[0], x_qkv[0]], dim=1)
        k = torch.cat([c_qkv[1], x_qkv[1]], dim=1)
        v = torch.cat([c_qkv[2], x_qkv[2]], dim=1)
        o = sdpa_attention(q, k, v)  # [B, ct+xt, h*hd]
        ct = context.shape[1]
        o_c = o[:, :ct].reshape(context.shape[0], ct, -1)
        o_x = o[:, ct:].reshape(x.shape[0], x.shape[1], -1)
        # context 流 post（pre_only 时丢弃）
        if context_block.pre_only:
            context = None
        else:
            context = context_block.post_attention(o_c, context, c_inter)
        # x 流 post
        if x_block.self_attn:
            o2 = x_block.attn2.attention(*x_qkv2)
            x = x_block.post_attention_x(o_x, o2, x, x_inter)
        else:
            x = x_block.post_attention(o_x, x, x_inter)
        return context, x


def detect_d_self(ckpt_path):
    """检测权重中最后一个带 attn2 的 x_block 索引（引擎 detect_from_weights 的 d_self）"""
    import re

    from safetensors import safe_open

    max_i = -1
    with safe_open(ckpt_path, framework="pt", device="cpu") as f:
        for k in f.keys():
            m = re.match(r"joint_blocks\.(\d+)\.x_block\.attn2\.", k)
            if m:
                max_i = max(max_i, int(m.group(1)))
    return max_i


def load_sd3_2b_weights(model, ckpt_path, prefix="model.diffusion_model."):
    """从提取版 safetensors（引擎 GGUF 转回）加载权重到手写模型（含命名映射）"""
    from safetensors import safe_open

    def to_model_key(k):
        """原版 key -> 手写模型参数名"""
        k = k.replace("joint_blocks.", "blocks.")
        if k.startswith("x_embedder.proj."):
            k = "x_embedder." + k[len("x_embedder.proj."):]
        # t/y_embedder: mlp.0/2 -> fc1/fc2（blocks 内 mlp 保持 fc1/fc2 同名）
        k = k.replace("t_embedder.mlp.0.", "t_embedder.fc1.")
        k = k.replace("t_embedder.mlp.2.", "t_embedder.fc2.")
        k = k.replace("y_embedder.mlp.0.", "y_embedder.fc1.")
        k = k.replace("y_embedder.mlp.2.", "y_embedder.fc2.")
        if k.startswith("final_layer.linear."):
            k = "final_linear." + k[len("final_layer.linear."):]
        if k.startswith("final_layer.adaLN_modulation.1."):
            k = "final_adaLN.1." + k[len("final_layer.adaLN_modulation.1."):]
        return k

    sd = {}
    with safe_open(ckpt_path, framework="pt", device="cpu") as f:
        for k in f.keys():
            if k.startswith(prefix):
                sd[to_model_key(k[len(prefix):])] = f.get_tensor(k)

    missing, unexpected = model.load_state_dict(sd, strict=False)
    if missing:
        print(f"  [WARN] 未加载 {len(missing)} 个权重: {missing[:5]}")
    if unexpected:
        print(f"  [WARN] 多余 {len(unexpected)} 个: {unexpected[:5]}")
    return missing, unexpected
