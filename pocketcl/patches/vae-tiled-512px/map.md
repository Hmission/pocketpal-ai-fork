# VAE tiled 解码（512px）— 改动地图（vae-tiled-512px）

> 载体：stable-diffusion.cpp 主进程（非 ggml）：`src/core/backend_fit.cpp` + `src/stable-diffusion.cpp`
> 整理：2026-08-29。对应：task 记忆「512px VAE tiled 修复与 Z-Image 端侧可用性验证」

## 设计意图

VAE 解码整图驻留是端侧内存峰值的最大单点（整图 latent 解码 1.94GB）。
两处配套改动：
1. **默认参数修复**：`get_tile_sizes` 默认 `rel_size=1.0`（factor 分支优先）导致 tile=latent 全尺寸=全图，
   tiling 形同虚设 → 设 `0.5` 后 tile=latent 一半（512px → 256px 像素 tile，2×2 分块）；
2. **Z-Image 强制分支**：6.9GB 权重模型强制启用 tiled VAE 降峰值（1664MB→416MB），不依赖默认路径。

## Hunk 1：默认参数修复（backend_fit.cpp 374-380）

```cpp
tiling_params.enabled = true;
// 6.16 512px VAE 解码内存修复：decode 的 get_tile_sizes 默认 rel_size=1.0
// （factor 分支优先），导致 tile=latent 全尺寸=全图，tiling 无效。
// 设 0.5 → tile=latent 一半（512px → 256px 像素 tile，2×2）。
tiling_params.rel_size_x = 0.5f;
```

- 意图：让 tiling 真正生效（tile=latent 一半，2×2 分块解码）；
- 回归要点：画质衔接依赖 tile 重叠/羽化逻辑——修复后需逐尺寸回归（512/768/1024）。

## Hunk 2：Z-Image 强制分支（stable-diffusion.cpp 3106-3109）

```cpp
// 6.17 顺序卸载（A2）：Z-Image（6.9GB 权重）强制 tiled VAE 降峰值（1664MB→416MB）
if (sd_version_is_z_image(version) && !vae_tiling_params.enabled) {
    vae_tiling_params.enabled    = true;
    vae_tiling_params.rel_size_x = 0.5f;
```

- 意图：权重独占内存的模型专项兜底——不依赖默认路径开关，模型级强制；
- 回归要点：`sd_version_is_z_image` 判定先行，其他模型不受影响。

## 证据（真机实证）

- VAE 解码峰值驻留：1.94GB → 416MB；
- 512px tiled 修复后 Z-Image 端侧可用（此前解码即 OOM）；
- K90 全链路：Z-Image 双禁用（XMEM 关）+ tiled VAE = 10.9min 出图（3.6×）。

## 上游 PR 建议

1. 上游已有 vae tiling 框架——本 PR 语义是「默认参数修复 + 大模型强制分支」，主体是 Hunk 1；
2. 附内存峰值对比证据（tile=全图 vs tile=一半，同一设备同一模型）；
3. Hunk 2 的模型判定可参数化（`model_memory_floor` 阈值替代硬编码 is_z_image），留扩展口。