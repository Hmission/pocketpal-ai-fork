---
doc_id: POCKETPAL_VIDEO_GEN_SPEC
module: imageGen
type: spec
status: draft
version: "0.2"
created: "2026-09-08"
updated: "2026-09-08"
relates:
  [
    POCKETPAL_CHAIN_AUDIT_20260907_B,
    ONDEVICE_VIDEO_GEN_ANALYSIS,
    POCKETPAL_IMAGEGEN_QUEUE_SPEC,
    POCKETPAL_STARMAP_DOMAINS,
  ]
---

<!-- D-FORMAT:v3 -->

# 端侧文生视频规格（VIDEO_GEN_SPEC）

> 范围：**W10 视频生成桥**（帧序列导出，不落容器）。容器封装属 W11，分发属 W12，本卷不预判。
> 红线：引擎层（`android/app/src/main/cpp/stable-diffusion.cpp/**`、llama.rn、ONNX 内部）**零改动**；
> 本能力只调 `stable-diffusion.h` 已公开的 API。所有物性均由本窗实读代码取得（含行号），不采信转述。

## 一、词面（先立规矩再写码）

依 STARMAP「词面消歧登记」：`video` 四义中，本能力独占 **④文生视频**，词面固定为
`genVideo` / `nativeGenVideo` / `videoGen*` / 任务 `kind:'video'`；**禁止使用 `VideoTask*` 前缀**
（该前缀属 nightTask 域的保活服务，改名前的历史名，见项 32）。

## 二、引擎 API 契约（实读证据）

```c
// stable-diffusion.h:505-510（本窗实读）
SD_API void sd_vid_gen_params_init(sd_vid_gen_params_t* sd_vid_gen_params);
SD_API bool generate_video(sd_ctx_t* sd_ctx,
                           const sd_vid_gen_params_t* sd_vid_gen_params,
                           sd_image_t** frames_out,
                           int* num_frames_out,
                           sd_audio_t** audio_out);
```

- `sd_vid_gen_params_t`（`:399-430`）关键字段：`prompt` / `negative_prompt` / `width` / `height` /
  `sample_params` / `seed` / **`video_frames`（:422）** / **`fps`（:423）** / `vae_tiling_params` /
  `cache` / `hires` / `circular_x|y`；另有 `init_image`/`end_image`/`ref_videos`/`control_frames`/
  `vace_strength`（首尾帧与可控生成，W10 **不接**，留给后续波次按需启用）。
- 引擎默认：`video_frames = 6`、`fps = 16`（`src/stable-diffusion.cpp:3859-3860`）。
- 返回 `bool`（**不是** int；旧文档转述为 int 已纠正）。
- ctx 复用：**同一个 `g_ctx`**。`sd_version_supports_image_generation = !supports_video_generation`
  （`src/stable-diffusion.cpp:3883-3889`）→ **Wan 系 ctx 不能生图**，反之亦然。因此
  「视频模型 + 图片任务」混跑在 native 层没有任何防护，见 §五 约束 C-4。

## 三、数据回程：帧必须 native 落盘，像素不过桥

既有 txt2img 的契约是「native 写 PNG，回传路径字符串」（`ImageGenJNI.cpp:630-642`）。视频沿用同一契约：

1. `generate_video(...)` 取回 `sd_image_t* frames` + `n`；
2. **native 内 for 循环**逐帧 `stbi_write_png("<outDir>/<taskId>/frame_%04d.png", w, h, ch, data, stride)`；
3. **每帧写完后立即 `frames[i].data = nullptr`**，最后统一 `free_sd_images(frames, n)` 一次。
   依据：`free_sd_images`（`:7351-7363`）在循环 `free(images[i].data)` 之后**还 free 数组基址**，
   所以**绝不能逐帧调用它**来边生成边释放——那会 double-free 数组基址；置空 data 再一次性 free 是唯一安全形态。
4. 回传给 RN 的是**目录路径 + 帧数 + fps**（三者编码为一个短字符串或 ReadableMap），**帧字节永不入 JNI 桥**。
   理由：`ImageGenModule.kt:254-255` 当年判定 `WritableArray` 装箱峰值 ~150MB 而改走 base64；把 93MB 帧流经
   桥是明确的历史弯路，不得重走。

### 3.1 内存量级（按实读的 RGB24 形态，非 RGBA）

`tensor_to_sd_image`（`src/core/util.cpp:678-693`）产出 `channel = 3`。480p 取 832×480：

| 项 | 单帧 | 6 帧（引擎默认） | 81 帧（Wan 典型长度） |
|---|---|---|---|
| uint8 帧像素 `W*H*3` | ≈1.14 MiB | ≈6.9 MiB | ≈92.6 MiB |
| 解码期 float32 全帧张量 | ≈4.57 MiB | ≈27 MiB | ≈369 MiB |
| **同驻峰值**（两者并存） | — | ≈34 MiB | **≈462 MiB** |

同驻的根因（实读 `decode_video_outputs` `:6681-6734`）：`:6705` `decode_first_stage` 产出**全部帧的
float32 张量**，`:6722` 一次性 `calloc(N × sd_image_t)`，`:6730-6732` 在**同一函数内**逐帧转 uint8，
源张量要到函数返回才析构。`generate_video` **没有** `generate_image` 那种「传 null 让引擎自释放」的逃生路。
→ **结论：帧数是本能力的头号预算旋钮**，W10 首验必须从 6 帧起，不得直接上 81 帧。

## 四、心跳与超时：真缺口不在采样，在解码

- 采样期**一定有**心跳：video 与 image 走同一个 `sample()`（`:7105` vs `:5786`）→ denoise lambda
  → `report_sample_progress`（`:2467-2478`）→ `sd_progress_cb`。所以「视频是否发心跳」这个问题问错了，
  静态即可判定为是（本窗据此更正 CHAIN_AUDIT_B §3.5）。
- **解码期完全静默**：`decode_video_outputs` 内**无任何** progress 回调，只有 `LOG_DEBUG/LOG_INFO`
  （`:6698/6707/6712`）；`sd_log_cb` 会刷新 JS 侧 `lastEventAt`，但两条 LOG 之间可跨整段解码。
- 风险实底：现有 hang 判定 `imageGenStore.ts:427` 是 `600_000ms` 固定值（按单张图调的），
  且判 hang 后 `:442` **会真的 cancel native**。81 帧解码一旦超过它，就会「进度 99% 报采样超时并把
  已成功的任务杀掉」。

**契约（必须实现，不得用「调大超时」这种糊法）**：

- **C-1 超时按工作量表达**：`timeoutMs = base + perFrame × frames`，`base` 覆盖编码与首步，`perFrame`
  取真机实测单帧解码耗时 × 安全系数；常数写在一处并注数据来源，**禁止**散落魔数。
- **C-2 阶段可见性**：JNI 在进入 `generate_video` 前把快照 stage 置 `sampling`，`num_frames_out` 返回后
  置 `encoding_frames`（写盘阶段），使 JS 侧能把「在解码/在落盘」与「卡死」区分开；stage 复用
  `ImageGenModule.kt:317-337` 既有 `@Volatile` 快照字段，**不新建第二条通道**。
- **C-3 快照起始复位**：现有 `snapStep/snapLastEvent` 在任务开始前无复位入口（`ImageGenModule.kt:317-337`），
  跨任务读到的陈旧 `lastEventAt` 会「开跑即误判」。视频时长更长，必须先补这个复位（在 native 任务入口
  一次性置零），这是 C-2 的前置。
- **C-4 版本守卫**：加载视频系模型后若队列里仍有图片任务（或反之），native 无任何防护
  （`generate_image` 调用点 `ImageGenJNI.cpp:602` 不做版本判定）。W10 在 **JS 侧单一编排点**上加一次判定：
  当前 ctx 族与任务模态不符 → 先走既有 unload/load 流程，**不在 native 加兜底重试**。

## 五、必须一并修的既有真缺陷（同文件，非顺手扩大战场）

W10 要在 `ImageGenJNI.cpp` 新增函数，以下两处是**同文件的现行线上缺陷**，视频桥若逐字镜像就会继承，
故随本波一起修（均禁区外）：

| # | 缺陷 | 证据 | 修法 |
|---|---|---|---|
| **R-1** | use-after-release：L638 已 `ReleaseStringUTFChars(outPath, outStr)`，L642 仍用 `outStr` 构造返回串 | 本窗实读 `:638/642` | 先 `NewStringUTF` 取回 `jstring` 再 Release；或统一在 return 前释放 |
| **R-2** | 异常路径漏放：`catch` 两支（`:604-619`）与 `ERR_GENERATE` 支（`:624-628`）均不 `free_sd_images` | 本窗实读 | catch 内补 `free_sd_images(images, numImages)`（`free(nullptr)` 安全）；`ERR_GENERATE` 分支同样补 |

R-2 在视频场景后果放大为 **N 帧 × 1.14MiB 永久丢失且 `g_ctx` 仍在**，只能杀进程回收——这是必须先修再建桥的直接理由。

**不在本波修（登记不扩大）**：`unloadModel` 同步抢锁可致 RN 线程分钟级阻塞（`ImageGenModule.kt:65-71` +
`ImageGenJNI.cpp:521`）、`GGML_OPENCL_KERNEL_CACHE_DIR` 指向 `/data/data/com.pocketpal/...` 与
`applicationId=com.pocketpalai` 不符疑似 kernel cache 从未命中（`:390`）、stderr 无轮转（`:97-99`）、
`batch_count` 硬编码 1（`:580`）。逐条入 DEV_BACKLOG，避免把 W10 变成大扫除。

## 六、验收标准（真机可感知，缺一不算过）

1. **V-1 编译**：`yarn build:android` 通过，且 `adb install -r` 覆盖安装后 App 冷启动正常（禁卸载）。
2. **V-2 零回归**：装 W10 后先跑一次**原有出图**（txt2img 出图成功 + 返回路径可显示），证明 R-1/R-2 修复无副作用。
3. **V-3 帧序列**：端侧产出 N 帧 PNG 落盘（先 6 帧 480p），`adb pull` 抽查首/中/末帧非纯色且互不相同。
4. **V-4 心跳**：logcat 与 `getGenSnapshot` 取证 `sampling → encoding_frames` 阶段迁移，全程无「采样超时」误判。
5. **V-5 取消**：生成中点停止 → native 真中断（复用 `sd_cancel_generation`），队列回到可再跑状态。
6. **V-6 内存**：记录 PSS 峰值，与 §3.1 预估对比；若顶到预算，据实登记而不是偷偷降帧数过关。
7. **V-7 保活共存**：视频任务期间 nightTask 票据使前台服务常驻（W8b 改名后的服务名），息屏不被杀。

## 七、明确不做

- 不做容器编码（W11 专裁：`SD_WEBM`+libwebm+纳入 muxer vs RN 侧 MediaCodec/ImageWriter）。
- 不做 step 级 checkpoint（已作废；改片段粒度重跑）。
- 不新建队列/状态机/保活件：一律复用 `imageGenQueueCore`、`nightTaskRegistry`、`engineMutex`。
- 不在 native 加"失败自动重试"这类兜底；失败就显式回 `ERR_*` 给 JS 单点处置。
- 不接 `init_image`/`end_image`/`ref_videos`/`control_frames`（首尾帧与可控生成留待有玩法需求时再开）。

## 八、编译期取证与 W10 前置阻塞（2026-09-08 装机窗，零代码改动）

**结论先行：引擎已就绪，阻塞在资产不在代码。**

取证方法（`.tmp/probe_video_sym_164.py`）：从已装 APK 抽出 `lib/arm64-v8a/libappmodules.so`
（103.5 MiB，stable-diffusion 以静态库内联，无独立 .so），用 NDK `llvm-nm --defined-only --dynamic`
查符号：

| 符号 | 存在？ | 意义 |
|---|---|---|
| `generate_image` | **T**（已导出） | 现有生图链路的锚点 |
| `generate_video` | **T**（已导出） | **视频入口已编入本 ABI 产物**，W10 不是“能不能编过”问题 |
| `free_sd_images` | **T** | §三要求的“逐帧置空 + 一次性释放”可用 |
| 含 `video` 的符号 | 1820 个 | 含 `LTXVideoVAE`、`convert_diffusers_to_original_wan_vae`、`SamplePlan(sd_vid_gen_params_t)` |

**真正的阻塞（登记为硬前置，不得绕过）**：设备与本仓构建机均无可用视频模型资产。
全盘检索只找到 ComfyUI 体系的 safetensors（格式不同，不能直接给 sd.cpp 用），无 Wan/LTX GGUF。
因此 **W10 不得本窗交付**：按本卷 §六 V-1~V-7，帧序列落盘、内存峰值、心跳、取消响应全部
需真机正路径取证；无模型时只能验“干净报错”的负路径，那会留下一个主分支未测的 native 代码路径
——这就是伪稳定（项目红线：不兜底、不补丁）。

**开工前置清单（需大王裁定）**：

1. **选型**：Wan2.1 TI2V-1.3B（手机级现实目标，GGUF 约 1.2–1.5GB）vs LTX-Video 2B（相近体积）；
   选前需确认 vendored 引擎对两者的 loader 路径均在符号中（已直证：wan vae 转换函数存在）。
2. **预算**：下载流量/磁盘、运行内存峰值（§3.1 表：81 帧 480p ≈ 462MiB 仅解码期）、发热与
   电池影响（夜间长跑走 nightTask 已有 WakeLock 链路）。
3. **验收口径**：先按 §六 V-1（6 帧 16fps 默认参数跑通）定基线，再谈帧数/分辨率向上。

## 九、变更日志

| 日期 | 版本 | 变更 |
|------|------|------|
| 2026-09-08 | 0.2 | 新增 §八 编译期取证：从已装 APK 抽 `libappmodules.so` 跑 `llvm-nm`，直证 `generate_video` **已导出**（含 1820 个 video 相关符号）——引擎就绪；同时登记硬阻塞：无视频模型资产，故 **W10 移出本窗**并给出选型/预算/验收三项前置 |
| 2026-09-08 | 0.1 | 首发（W10 前置）：引擎 API 与内存量级实读取证、帧回程契约（native 落盘 + data 置空防 double-free）、心跳真缺口在解码期（据此更正审计卷 §3.5）、C-1~C-4 契约、随波修 R-1/R-2、V-1~V-7 验收、不做清单 |
