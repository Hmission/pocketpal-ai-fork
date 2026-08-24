# 端侧视频生成可行性分析：H3 / LTX / Wan 全谱系（2026-08-23）

> 状态：分析定稿 · 决策待裁决（当前建议：观望不立项）
> 引擎：stable-diffusion.cpp（2026-08 上游版，已编译进 APK）
> 设备基线：红米 K90（12-16GB RAM，HyperOS PSS 实测 6GB 硬杀 / 安全预算 4GB）
> 方法论：写轮眼（外部调研情报）+ 自学习（内部代码实证基线）

---

## 一、结论摘要

1. **引擎层已全面就绪**：本项目 sd.cpp 为 2026-08 最新上游版，已内置 LTXAV（LTX 视频+音频）、MiniMax H3、Wan 全系（1.3B/5B/14B）、Hunyuan Video、LingBot Video、SVD 全套视频生成支持，**且已编译进当前 APK**（`add_subdirectory` 全量 GLOB）。
2. **MiniMax H3（33.1B）**：❌ 不可行——量化后组合 ≥30GB，超 PSS 硬杀线 5 倍，超物理内存 2-4 倍，算力差 100 倍。社区量化版本全部瞄准桌面 8-16GB 显存 + 32-64GB 内存 offload，与手机端是两个量级。
3. **LTX-Video 2B（0.9.8 distilled，8 步）**：⚠️ 唯一"尝鲜级"候选——全链 GGUF ~4-5GB 贴 PSS 线，手机端估算 10-50 分钟/条 5s 480p 视频。
4. **Wan 2.1 1.3B（50 步）**：❌ 暂不可行——质量最好但比 LTX 慢一个量级（详见 §六），手机端估算 80-200 分钟/条。
5. **结论**：手机端视频生成从"完全不可行"修正为"引擎就绪、模型贴线、算力独差"；按「锋利不臃肿」原则维持观望，触发条件见 §七。

## 二、外部情报：视频生成模型全谱系（写轮眼）

### 2.1 MiniMax H3（2026-07 发布 / 08-10 开源）

| 项 | 值 |
|---|---|
| 架构 | Omni Transformer **33.1B 密集** + Qwen3-VL-32B 编码器 + 视频/音频双 VAE |
| BF16 全精度 | ~123GB（transformer 61.7GB + TE 62.1GB） |
| 社区量化 | Q3_K_M 10-12GB / Q4_K_M 15.6GB（仅 transformer）+ int4 TE ≈ 组合 ≥30GB |
| 最低桌面配置 | 8-12GB 显存 + **32-64GB 系统内存**（CPU offload） |
| 输出 | 4-15s、768p、24FPS、32kHz 双声道；2K 需官方 API（未开源） |
| 桌面实测 | 5070Ti 5s 480p = 160s；5090 15s ≈ 306s |
| **手机端判定** | **❌ 不可行**：PSS 差 5 倍、物理内存差 2-4 倍、算力差 100 倍、无 offload 空间 |

### 2.2 LTX 家族（Lightricks，速度路线）

| 版本 | 参数量 | 体积（GGUF） | 说明 |
|---|---|---|---|
| LTX-Video 0.9.8 **2B distilled** | 2B | DiT Q4 ~1.5GB / FP8 4-5GB | **8 步蒸馏**，官方含移动端转换工具（`convert_for_mobile.py` + 移动 SDK）；质量中等（细节稍弱、动作偏简单） |
| LTX-2（2026-01） | 19B | Q4 12GB / Q1 3GB（质量崩） | 音画同生，太大 |
| LTX-2.3（2026-03） | 22B | Q4 ~17.8GB | 5090 上 I2V 22s，太大 |
| LTX-2.5（2026-08-11） | 开放世界模型 | INT8+offload 8GB 显存可跑 | 刚发布，桌面向 |

**LTX-Video 2B 是唯一为移动端设计过的视频 DiT**（2B 级 + 蒸馏 + 官方移动工具链）。

### 2.3 Wan 家族（阿里，质量路线）

| 版本 | 参数量 | 说明 |
|---|---|---|
| **Wan 2.1 T2V-1.3B**（2025-02） | 1.3B | 480P、81 帧（5s）、**50 步**；RTX 4090 5s 480p ≈ 4 分钟；8GB 显存可跑 fp16 |
| Wan 2.1 14B 系 | 14B | 720P，需 24GB+ |
| Wan 2.2 TI2V-5B / I2V-14B | 5B/14B | 双专家架构，≥16GB 显存 |
| Wan 2.2 1.3B | 1.3B | 6GB 显存可跑（社区 2026-06 报道） |

**Wan 1.3B 是质量路线的最小入口**：运动连贯性、细节、中文提示词理解全面强于 LTX-Video 2B，代价是 50 步采样（慢 6 倍+）。

## 三、内部基线：引擎支持矩阵（自学习，代码实证）

`stable-diffusion.cpp/src/` 全量代码审计 + 编译链确认：

| 能力 | 代码实证 | 状态 |
|---|---|---|
| LTXAV（LTX-2 视频+音频一体） | `model/diffusion/ltxv.hpp`（2067 行，video+audio 双通道 config）+ `vae/ltx_vae.hpp` + `vae/ltx_audio_vae.hpp` + `upscaler/ltx_latent_upscaler.hpp` + `LTX2_SCHEDULER` | ✅ 引擎内置 |
| MiniMax H3 | `sd_version_is_minimax_h3`（latent_channel=24，时空压缩 `((frames-5)/17)*5+2`）+ `vae/minimax_h3_vae.hpp` + `minimax_h3_audio_vae.hpp` | ✅ 引擎内置 |
| **Wan 全系** | `model/diffusion/wan.hpp`：auto-detect（num_layers 30→1.3B / 40→14B；model_type t2v/i2v/vace/flf2v；Wan2.2-TI2V-5B）+ `vae/wan_vae.hpp` | ✅ 引擎内置 |
| UMT5 文本编码器 | `te/t5.hpp` `T5Runner(is_umt5)` + UMT5 tokenizer 词表内嵌（`tokenizers/vocab/umt5.hpp`） | ✅ 引擎内置 |
| Hunyuan Video | `sd_version_is_hunyuan_video` + `vae/hunyuan_vae.hpp` | ✅ 引擎内置 |
| LingBot Video / SVD | `lingbot_video.hpp` + `sd_version_supports_video_generation` 全列举 | ✅ 引擎内置 |
| 视频输出 | `SD_WEBM` 当前 **OFF**（仅影响输出编码，不影响推理） | ⚠️ 需开启 |

**编译链**：[jni/CMakeLists.txt](file:///f:/pp/android/app/src/main/jni/CMakeLists.txt) L97 `add_subdirectory(../cpp/stable-diffusion.cpp)` → sd.cpp 上游 CMakeLists `file(GLOB SD_LIB_SOURCES "src/*.cpp")` 全量编译 → **所有视频模型代码已在当前 APK 内**。

## 四、候选模型部署条件对比

| 维度 | LTX-Video 2B (distilled) | Wan 2.1 T2V-1.3B | H3 |
|---|---|---|---|
| DiT 参数 | 2B | 1.3B | 33.1B |
| 文本编码器 | T5-XXL 4.7B（量级同 UMT5） | UMT5-XXL 4.7B | Qwen3-VL-32B |
| 采样步数 | **8** | **50** | 数十步 |
| 全链 GGUF 最小组合 | ~4-5GB（DiT 1.5 + TE 2.9 + VAE 0.5） | ~4.8-5.4GB（DiT 1.0 + TE 3.1-3.7 + VAE 0.7） | ≥30GB |
| 桌面速度（5s 480p） | 3060：30-60s；4090：15s | 4090：≈4min | 5090：≈3min（768p） |
| **手机端推算**（÷20-50） | **10-50 分钟/条** | **80-200 分钟/条** | 4-7 小时 |
| 质量 | 中等（细节稍弱） | **更好**（运动/细节/中文） | 最强 |
| 引擎支持 | ✅ | ✅ | ✅ |
| **判定** | ⚠️ 贴线尝鲜级 | ❌ 算力不可用 | ❌ 全面不可行 |

## 五、深入分析：Wan 2.1 T2V-1.3B

### 5.1 架构解剖

```
Wan 2.1 T2V-1.3B = UMT5-XXL 文本编码器 + Wan DiT 1.3B + WanVAE
                     ↑ 隐藏大头：4.7B，fp16 11.4GB（DiT 的 4.4 倍）
```

- **DiT**：patch_size (1,2,2)、dim 1536、12 heads、30 layers、flow matching、text_len 512
- **UMT5-XXL**：多语言 T5（中英提示词强项），fp16 11.4GB —— **全链体积的实际决定者**
- **WanVAE**：时空压缩 8×8×4（时间 8 / 空间 8×8），480p×81 帧 → latent ~24×60×60×16
- **输出规格**：480P（1.3B 限定，720P 是 14B 专属）、81 帧（5s）、24FPS
- **采样**：50 步 flow matching（无官方蒸馏版；社区有加速 LoRA 但非官方）

### 5.2 量化文件清单（GGUF，city96 生态）

| 组件 | fp16 | GGUF Q4_K_M | GGUF Q3_K_M | 来源 |
|---|---|---|---|---|
| DiT（1.3B） | ~2.6GB | ~1.0GB | ~0.8GB | city96/Wan2.1-T2V-1.3B-gguf 系 |
| UMT5-XXL 编码器（4.7B） | 11.4GB | 3.66GB | 3.06GB | city96/umt5-xxl-encoder-gguf |
| WanVAE | ~1.2GB | ~0.7GB | ~0.7GB | city96/wan2.1-vae-gguf 系 |
| **合计** | **~15.2GB** | **~5.4GB** | **~4.8GB** | |

**关键洞察**：UMT5-XXL 量化后仍占全链 63-68%——**TE 是 Wan 手机端的真实门槛，不是 DiT**。

### 5.3 引擎支持实证（本项目零改动可加载）

- `wan.hpp` WanRunner：`WanConfig::detect_from_weights` 按 num_layers=30 自动识别 `Wan2.1-T2V-1.3B`（dim 1536/ffn 6196/in_dim 16），VACE/I2V 变体同路径
- `T5Runner(is_umt5=true)`：加载 `text_encoders.t5xxl.transformer` 前缀 GGUF；UMT5 词表已内嵌（`umt5_tokenizer_json_str`）
- `wan_vae.hpp`：WanVAE 解码（TinyVideoAutoEncoder 亦兼容）
- 调度：`VERSION_WAN2_2_TI2V` 之外走通用视频分支（denoise_mask / video_frames_to_latent_frames 已就绪）

### 5.4 性能评估

**桌面基线**（社区实测）：RTX 4090 fp16 5s 480p ≈ 4 分钟；RTX 4060 8GB fp16 可跑（显存贴线）；GGUF Q4 后显存需求再降 50%。

**手机端推算**（算力账本，手机 ≈ 桌面 1/20-1/50）：
- 50 步 × 每步视频 DiT（latent 24×60×60×16 ≈ 138k token 量级）= **80-200 分钟/条 5s 480p**
- 对比：本项目 Z-Image 单张图（约 40 步图像 DiT）K90 实测 10.9 分钟 → Wan 视频每步 token 量大 8-10 倍 + 步数更多 → 推算自洽
- 电池/散热：持续高负载 1.5-3 小时，不可行

**内存推算**：DiT Q4 ~1GB + TE Q3 ~3GB + VAE ~0.7GB + 计算 buffer（视频 latent 解码）→ 峰值 **4-5GB**，超 PSS 安全预算 4GB、贴 6GB 硬杀线（K90 血证：5.16GB MoE 已被杀）→ **高风险**。

### 5.5 质量评价（社区共识）

- **优势**：运动连贯性、细节丰富度、手绘/草图友好（ControlNet Lineart 锁线稿一致性强）、**中英双语提示词**（UMT5）——全面强于 LTX-Video 2B
- **劣势**：速度慢 6-10 倍（50 步 vs 8 步）；480P 上限；5s 短片段需拼接
- 社区定位：**质量优先时的轻量首选**（4-6GB 显存档）；LTX-Video 2B 是速度优先

### 5.6 部署逐项核对

| 项 | 要求 | 现状 | 判定 |
|---|---|---|---|
| 引擎 | 视频 DiT + UMT5 + WanVAE | 已编译进 APK | ✅ 零改动 |
| 存储 | ~4.8-5.4GB | 与现有模型总盘同级，可接受 | ✅ |
| 内存峰值 | 4-5GB | PSS 预算 4GB / 硬杀 6GB | ⚠️ 超预算贴线 |
| 算力 | 80-200 分钟/条 | 产品不可用 | ❌ |
| 输出 | WebM 编码 | SD_WEBM OFF，需开 | ⚠️ 一行开关 |

**判定：❌ 暂不可行**——决定性缺口是算力（一个量级差），内存贴线为次；引擎与存储均已就绪。

## 六、Wan 2.1 1.3B vs LTX-Video 2B：手机端二选一结论

| 决策维度 | 结论 |
|---|---|
| 若只看质量 | Wan 2.1 1.3B 胜（运动/细节/中文），但 80-200 分钟不可用 |
| 若只看速度 | LTX-Video 2B 8 步蒸馏胜（10-50 分钟，尝鲜级） |
| 若做产品 | **两者都不达标**——端侧"可玩"线 ≈ 5-10 分钟/条；当前差距 1-2 个数量级 |
| 引擎投入 | 两者均零引擎改动（已内置）；投入仅在模型分发 + WebM 开关 + 业务层 |

## 七、玩具定位专项：后台跑视频的三个技术核心（2026-08-23 大王定调）

> 大王定调：**目的是玩儿不是生产力**——手机端跑视频 = 跑分软件式玩法（"我的手机到底行不行"）。"能不能"比"快不快"重要：一晚上跑一条 5s 视频完全可接受。LTX 效果玩笑，优先级低；Wan 2.1 1.3B 为主候选。

### 7.1 核心一：长时间后台运行不被杀

**HyperOS 两套杀进程机制（实测区分）**：

| 机制 | 特征 | 阈值 | 能否规避 |
|---|---|---|---|
| **PSS 看护**（Security Center） | `used too many pss resource, pss threshold:6291456kb` | K90 实测 6GB | ❌ 无白名单，**硬线** |
| **单应用内存配额** | `Killing <pid>: stop <package> due to from process` | OEM 配额 | ✅ 「电池省电→不限制」+「最近任务锁定」白名单可解 |

**存活策略组合（按可行性排序）**：

1. **PSS 压线是前提**：Wan 全链 Q3 TE + Q4 DiT 组合峰值估算 4-5GB，必须配合分段加载（§7.3）压到 **4GB 内**才能活过 PSS 看护——这是唯一不可谈判的硬约束。
2. **前台服务**：新增 `ForegroundService`（常驻通知 + `foregroundServiceType`），进程提升为前台优先级——防 LMK/OEM forceStop，也是 Doze 豁免的关键。当前代码库**无任何前台服务**（已验证 `android/` 零匹配），需原生新增。
3. **电池/Doze 豁免**：引导用户「电池省电→不限制」+「最近任务锁定」白名单（已有记忆实证可解除内存配额）；`REQUEST_IGNORE_BATTERY_OPTIMIZATIONS` 权限申请。——**已落地（2026-08-23，MASTER_LOG §78）**：原生 BatteryGuard 在夜间任务启动时检查 isIgnoringBatteryOptimizations，未豁免发起系统弹窗引导。
4. **CPU 保持唤醒**：现有 `KeepAwake` 是屏幕常亮（聊天用），后台长跑需新增 `PARTIAL_WAKE_LOCK`（保 CPU 不休眠）。
5. **AppState 反转**：现架构「进后台即释放引擎」（TTSStore/ModelStore 记忆实证）——夜间任务需绕过：任务进行中不响应 background 释放，任务结束才释放。

**结论**：可行但需原生投入（前台服务 + wake lock + AppState 任务模式），加上白名单引导；PSS 4GB 内是前提。

**PSS 看护粒度与绕过评估（2026-08-23 大王追问）**：

- **粒度**：PSS 看护日志为 `Killing <pid>: ... pss used:6770539kb`——**按进程（pid）计**；但 HyperOS 的内存配额（`from process:`）按应用/UID 计。两者并存，安全设计按最坏情况（按 UID 总计）处理。
- **能否改掉**：不能——厂商 Security Center 看护无公开 API 可关；白名单（电池不限制+锁定）只能解「内存配额」那条线，PSS 看护无解。
- **能否绕过（多进程/多应用）**：
  - 多进程拆分（`:imagegen` 独立进程）：理论上可让单进程 PSS <6GB，但①若按 UID 计则拆了白拆；②RN 引擎进程跨进程调度需 AIDL/socket 重写调度层，复杂度爆炸；③全局 LMK 压力下多进程反而更容易被逐个杀。**否。**
  - 多应用伪装（独立 APK 分包）：同 UID 仍计总账，不同 UID 需独立签名/独立包 = 产品形态不可行。**否。**
- **最佳实践（正道）**：不绕过，压内存——分段加载（§7.3）+ 图切段（max_vram，已有 Mali 实证 5.5GB→181MB）+ mmap 关闭（已有实证 8.2GB→5.3GB）。**项目已有把 PSS 从 8.2GB 压进配额的完整先例**，这条路比绕过可靠得多。

### 7.2 核心二：断点续跑

**引擎现状**：sd.cpp **无采样状态 save/resume API**（已审计 `stable-diffusion.h`：只有 `free_sd_ctx` 整体释放 + `sd_set_progress_callback`/`sd_set_preview_callback` step 级回调）——断点续跑需引擎侧新增能力。

**可行方案**（工程量评估）：

- **方案 A：引擎内挂 checkpoint**（推荐）：在采样循环里每 N 步把中间 latent `x_t` + sigma 状态落盘（JNI 层在 progress 回调时导出，每步 latent 体积 = 分辨率×帧数×通道×4B，Wan 480p×81 帧 ≈ 8.8MB/步；每 5 步存一个 → 磁盘 ~90MB）。被杀后下次启动：加载最近 checkpoint → 重建 sigmas 从该步续跑 → **最多重跑 5 步**。
- 方案 B：任务级重跑（被杀从头来）——一晚上白跑，不可接受，否。
- 方案 C：帧段分块（把 81 帧拆段跑）——视频 DiT 是全局时空建模，**不可分帧**，否。

**结论**：方案 A 可行，投入在 JNI 导出接口 + sd.cpp 采样循环钩子（约 1-2 天）；RN 层只需任务状态机加 `resume` 分支。

### 7.3 核心三：分段加载/卸载腾内存（TE 单独跑）

**引擎现状**：`new_sd_ctx` 内部**按模块构建**（`SDBackendModule::TE / DIFFUSION / VAE`，`ensure_backend_pair` 实证），但公开 API 只有整体加载（`nativeLoadModel(model, clipL, clipG, llm, vae, backend)`）+ 整体释放（`free_sd_ctx`）——**无模块级释放 API**。

**可行方案**：

- **方案 A：双 ctx 交替（推荐）**——ctx1 = TE-only（UMT5 Q3 ~3GB）加载 → 编码 prompt → `free_sd_ctx(ctx1)` 释放 → ctx2 = DiT+VAE（Q4 ~1.7GB）加载 → 采样 → 释放。**峰值内存 = max(TE, DiT+VAE) 而非两者之和**（从 4.8GB → ~3GB），且项目已有同模式先例（DreamLite「TE 编码后释放降内存峰值」）。代价：两次加载（每次 30-60s，夜间任务可接受）。前提：sd.cpp 需支持「仅 TE 或仅 DiT 构建」——按现有模块化内部结构改造公开 API（新增 `sd_load_module` 或让 `new_sd_ctx` 接受空路径跳过模块，**需小改引擎，待验证**）。
- 方案 B：引擎内做 TE 模块热卸载（TE 编码完从 ctx 摘除）——侵入性大，否。

**结论**：方案 A 是「TE 很大但单独跑跑得动」的正解——回答大王的问题：**是的，TE 单独跑完全跑得动，且分段后峰值内存从 4.8GB 压到 ~3GB，PSS 硬线内安全**。

### 7.4 玩具定位最终判定

| 核心 | 可行性 | 关键前置 |
|---|---|---|
| 后台不被杀 | ⚠️ 可行需投入 | 分段加载压 PSS <4GB（硬约束）+ 前台服务 + 白名单引导 |
| 断点续跑 | ⚠️ 可行需投入 | 引擎采样 checkpoint 钩子（1-2 天） |
| 分段加载 | ✅ 方案明确 | sd.cpp 模块级构建改造（小改，待验证） |
| 跑分 UI（PSS/CPU/温度） | ✅ 独立立项 | 见 ADR-0008 |

**综合判定：从「产品不可用」升级为「玩具可立项」**——引擎与文件已就绪，原生投入集中在三块（前台服务/断点/分段加载），每块独立可验证。建议以「夜间实验标记」形态落地（复用现有实验标记体系），跑通一条 Wan 5s 视频即算跑分成功。

## 八、结论与触发条件

**当前决策：观望，不立项**（锋利不臃肿：不做"能出片但没人等得起"的半成品功能）。

**触发条件（任一满足即重新评估）**：
1. Wan 2.x 或 LTX 系出现 **≤16 步蒸馏版**且全链 ≤4GB（手机端从"不可用"变"尝鲜可用"）
2. LTX-Video 2B 在真机（K90）实测一条 5s 480p ≤10 分钟（先以实验标记验证，非立项）
3. 产品出现"会动的小黄鸡"明确诉求（视频作为玩具玩法而非创作工具）

**若触发立项**，首选路径：LTX-Video 2B distilled（8 步）→ DiT Q4 + T5 Q4 + VAE ≈ 5GB → 开启 SD_WEBM → 生图页扩展"视频"tab（复用现有模型下载/目录/调度体系）。

## 变更日志

| 日期 | 版本 | 变更 |
|------|------|------|
| 2026-08-23 | 1.0 | 首发：H3/LTX/Wan 全谱系端侧可行性分析 + Wan 2.1 1.3B 深入评估（写轮眼/自学习双引擎） |
| 2026-08-23 | 1.1 | 追加 §七：玩具定位专项（大王定调「跑分软件」）——后台存活/断点续跑/分段加载三核心 + ADR-0008 跑分 UI 立项 |

## 关联文档

- [MODEL_MATRIX](./POCKETPAL_MODEL_MATRIX.md)（模型选型唯一事实源，本分析不新增选型条目）
- [PRODUCT_SPEC](./POCKETPAL_PRODUCT_SPEC.md)（产品边界：视频不在当前玩法清单）
- [SD35_OPENCL_WHITE_IMAGE_ANALYSIS](./SD35_OPENCL_WHITE_IMAGE_ANALYSIS.md)（同方法论分析范例）
- [jni/CMakeLists.txt](../android/app/src/main/jni/CMakeLists.txt)（编译链实证）
- [DEV_BACKLOG](./DEV_BACKLOG.md)（待开发清单：视频玩具三前置/端到端/备选跟踪）
