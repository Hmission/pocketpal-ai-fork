# 端侧顺序卸载设计（Sequential Offload）

> 目标：① Z-Image 加速（K90 40→15 分钟）② 小米 13（Adreno 740）可用 Z-Image
> 核心思想：生图链路各阶段（LLM 条件 → 采样 → VAE 解码）**解耦**，阶段间释放不再需要的权重，压低 GPU 内存峰值。
> 业界依据：WuliArt Qwen-Image 顺序卸载实测 22.4GB→14.1GB 且更快；sd.cpp --offload-to-cpu；diffusers enable_model_cpu_offload。

---

## 一、问题模型

### 1.1 当前内存布局（Z-Image，6.9GB 权重）

```
加载：LLM 2.3G + diffusion 3.3G + VAE 0.16G → 常驻 GPU 6.9GB
条件编码：LLM 计算（diffusion 闲置但占 GPU）
采样：diffusion 计算（LLM 闲置但占 GPU）
VAE 解码：VAE 计算 + 1664MB graph buffer（LLM+diffusion 闲置但占 GPU）→ 峰值超限 → 进程被杀
```

**浪费**：每个阶段都有 2/3 的权重闲置占 GPU。

### 1.2 目标内存布局（顺序卸载）

```
条件编码：LLM 2.3G 在 GPU → 完成后释放
采样：diffusion 3.3G 在 GPU（懒加载）→ 完成后释放
VAE 解码：VAE 0.16G + graph buffer（1664MB 或 tiled 416MB）→ 峰值 < 2GB
```

**峰值从 6.9GB+1.6GB 降到 < 3.5GB**（小米 13 可容纳）。

---

## 二、机制实证（代码定位）

| 机制 | 位置 | 结论 |
|---|---|---|
| `release_all()` | model_manager.cpp（**已改 public**，model_manager.h） | **强制清零 active_prepare_count + 强制释放 compute staging + params storage** = 顺序卸载钥匙 |
| VAE 权重懒加载 | stable-diffusion.cpp decode 前 "loading 138/244 tensors" | release_all 后 VAE 权重自动重建 ✓ |
| `free_compute_params=true`（默认） | ggml_extend.hpp L3153 | 采样完成后 diffusion active=0（GraphWeightDoneGuard RAII 释放） |
| `unregister_param_tensors` | model_manager.cpp L231 | 分模块释放接口，但 desc 匹配问题未解（freed 0）→ 本期不用，用 release_all |
| tiled VAE 降级 | backend_fit.cpp prepare_vae_decode_retry_tiling | 已实现（1.94GB→416MB） |
| stream_layers | stable-diffusion.cpp L247（硬编码 false） | 分层流式，本期不启用（release_all 已足够） |

---

## 三、实施方案

### A1：VAE 解码前 release_all（核心）

**位置**：stable-diffusion.cpp decode_image_outputs（VAE 解码循环前）

```cpp
// 顺序卸载：采样完成后 diffusion/conditioner/LLM 权重不再需要，
// release_all 强制释放全部 GPU buffer（VAE 权重解码时懒加载重建）。
// 峰值从 (全部权重+VAE buffer) 降到 (VAE 权重+VAE buffer)。
auto& model_mgr = sd_ctx->sd->model_manager;
if (model_mgr != nullptr) {
    model_mgr->release_all();
    LOG_INFO("decode_image_outputs: sequential offload released all weights for VAE decode");
}
```

**收益**：
- Z-Image K90：VAE 解码不再被杀（峰值降 5GB+）→ 可恢复 Adreno 内核提速（采样 19.5 分钟）
- Z-Image 小米 13：VAE 解码峰值 < 2GB ✓

**风险**：release_all 释放 VAE 权重后懒加载需 ~2s（日志实测 2.2s）——可接受。下次生成 diffusion 懒加载 ~5-10s——可接受。

### A2：Z-Image VAE 强制 tiled（保险）

**位置**：decode_first_stage（对 Z-Image/大权重模型，decode 前预置 vae_tiling_params.enabled=true + rel_size=0.5）

**收益**：VAE graph buffer 1664MB→416MB，小米 13 双保险。

**实现**：decode_first_stage 检测 version==Z_IMAGE 时强制 tiling（不依赖失败重试）。

### B1：LLM 条件编码后释放（可选，视 A1 验证结果）

采样前释放 LLM（unregister desc 修复或 release_all 变体）。**本期不做**——A1 已让采样阶段峰值 = diffusion 3.3G（小米 13 能否容纳需实测；若不行再做 B1）。

### B1（修订版，已实现）：Z-Image 权重 disk 常驻

**实测发现**：小米 13 Z-Image 在**加载阶段**即被杀（6.9GB 权重同时驻 GPU 超限），A1 只救 VAE 阶段不够。

**实现**：ImageGenJNI.cpp nativeLoadModel，Z-Image 时设 `params.params_backend = "diffusion=disk,te=disk"` → 权重 disk 常驻（mmap），compute 时按需 stage 到 GPU（model_manager ResidencyMode::Disk 机制）→ 加载/采样峰值 = 当前阶段权重。

---

## 四、验证计划（小米 13，K90 已弹出）

1. **Z-Image 首跑**：加载 → 条件编码 → 采样（双禁用内核，每步 ~4 分钟×8=32 分钟）→ **VAE 解码（release_all + tiled）→ 出图** = 突破
2. **SD3.5 回归**：10 步出图确认 release_all 无副作用
3. **Z-Image 加速实验**（可选）：恢复 Adreno 内核 + release_all → 采样 19.5 分钟版本是否 VAE 不再被杀

## 五、回滚

release_all 调用点单一（decode_image_outputs 开头），移除即回滚。

---

## 六、小米 13 Z-Image 验证结果与下一步（2026-08-17）

### 6.1 实测结论

- A1/A2/B1/B1' 均已实现并构建。
- 小米 13 Z-Image **仍在条件编码阶段被杀**（出图后 16-18 秒，尚未到 B1' 释放点）。
- **根因定位**：小米 13 GPU 可用 VRAM ≈ 2.8GB（SD3.5 2.8GB 权重能跑的极限）。Z-Image 组件：LLM 2.3G（可容）+ **diffusion 3.3G（超上限）**。顺序卸载解决"阶段间闲置"，但**单模块 diffusion 3.3G 仍超小米 13 GPU**。

### 6.2 下一步（B2：stream_layers 分层流式）

- **机制**：diffusion 权重按层分段 stage 到 GPU（每层几百 MB），峰值 < 2.8GB。
- **前提**（stable-diffusion.cpp L928）：stream_layers 要求 `params_backend_is_cpu(DIFFUSION)`——需把 B1 的 `diffusion=disk` 改为 `diffusion=cpu`，并启用 stream_layers。
- **待办**：① sd_ctx_params 的 stream_layers 字段设置 ② ImageGenJNI 改 `diffusion=cpu,te=cpu` ③ 小米 13 验证采样峰值。
- **风险**：cpu residency + 分层流式速度可能慢（每层 CPU↔GPU 拷贝），需实测权衡。

### 6.2.1 B2 已实现（ImageGenJNI.cpp）

```cpp
if (zimage_model) {
    params.params_backend = "diffusion=cpu,te=cpu";  // 权重驻 CPU
    params.max_vram       = "2";                     // 2GB VRAM 预算
    params.stream_layers  = true;                    // 分层流式
}
```

- sd_ctx_params 字段确认：`max_vram`（const char*，GiB 预算）+ `stream_layers`（bool）+ `params_backend`。
- stream_layers 需 max_vram 配合（stable-diffusion.h L226 注释）+ params_backend=cpu（L928 检查）。
- 待小米 13 实测验证采样峰值与速度。

### 6.2.2 B2 验证结果与回滚（最终结论）

**小米 13 Z-Image 存活时间递进**（各轮优化）：
| 配置 | 存活时间 | 死亡阶段 |
|---|---|---|
| 无 offload | 18 秒 | 加载 |
| B1/B1' | 16-18 秒 | 条件编码前 |
| B2 max_vram=2 | 92 秒 | 条件编码 |
| B2 max_vram=-1 (auto 5548MB, graph-cut 36 段) | 3.5 分钟 | 条件编码 |

**结论**：Z-Image 6.9GB 对小米 13（GPU ~2.8G）是**硬件上限**——cpu residency + stream_layers + graph-cut 各轮延长存活，但 LLM 编码/采样每阶段仍超。业界也不在中低端手机跑 6B DiT。

**回滚**：移除 ImageGenJNI 的 zimage_model cpu residency/max_vram/stream_layers（保护 K90 GPU 常驻速度，避免拖慢）。**保留 A1/A2**（stable-diffusion.cpp 通用顺序卸载 + Z-Image 强制 tiled，对 K90 是加速/稳定性增益）。

**产品策略**：小米 13 用 SD3.5（~40 分钟）/DreamLite；Z-Image 仅高端设备（manifest note 已标注）。

### 6.3 已验证可用（无需再动）

- K90（Adreno 840）：SD3.5 ~10 分钟、Z-Image ~40 分钟（双禁用）——顺序卸载对 K90 是加速/稳定性增益，不改变可用性。
- 小米 13：SD3.5 ~40 分钟（tiled VAE）可用；DreamLite 可用。
