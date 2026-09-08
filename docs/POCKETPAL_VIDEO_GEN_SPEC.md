---
doc_id: POCKETPAL_VIDEO_GEN_SPEC
module: imageGen
type: spec
status: draft
version: "0.3"
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

**实测锚点（2026-09-08 装机窗，K90 / Adreno 840 / OpenCL，非估算）**：单张图走 `generate_image`
（Z-Image-Turbo Q4，512×768，8 步）的实物代价：采样 ~154s/步、VAE 解码（9 tiles）218.7s、
总计 **1405.18s**；性能面板实测 **PSS 峰值 2.7GB**（GPU 100%、温度 75℃）。两个推论：

1. 上表的解码期同驻量级是**纯像素**预算，不含模型常驻；实测单帧图已占 2.7GB 总 PSS，
   视频只能在此之上叠加，**不得拿 462MiB 当峰值**。
2. 时长更脆：单帧 8 步已 23 分钟，视频即使 6 帧也至少是分钟级×帧数的采样 + 一次多帧解码，
   因此 §四的超时按帧数表达（C-1）不是洁癖，是能不能不被自己误杀的前提。

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

**真正的阻塞（2026-09-08 更正：本卷初稿此处为不实陈述）**：初稿写“设备与本仓构建机均无可用
视频模型资产”，是因为检索只用了含连字符的官方名（`Wan2.1-T2V` / `TI2V` / `LTX`），而实物是
**下划线命名** → 漏匹配。重查结果（PC `E:\2025Program\0304ModelAndAnima` 与设备
`/sdcard/Documents/AIOS/models/`）：

| 资产 | 位置 | 体积 | 可用性判定 |
|---|---|---|---|
| `wan_2.1_vae.safetensors` | **设备已有**（08-26 入库）+ PC | 253MB | Wan VAE 零下载 |
| `wan2.1_t2v_1.3B_bf16.safetensors` | PC | 2.64GB | Wan DiT，**非 GGUF，bf16 手机跑不动→需先量化** |
| `wan2.1-t2v-14b-Q4_K_S.gguf` / i2v-14b | PC | 8.6–9.7GB | 14B 系，**超内存硬线，直接排除** |
| **UMT5-XXL encoder（Wan 路线唯一硬缺）** | 无 | 需下 3.06–3.66GB | Wan 必下载项 |
| `t5xxl_fp16/fp8.safetensors` | PC（SD3.5 用） | 9.1 / 4.6GB | **不是 UMT5**，词表不同不可混用 |

代码旁证（本窗实读）：`LTXAVEmbedder` 走 `text_encoders.llm` + `text_embedding_projection`
（`conditioning/conditioner.hpp:2986-2990`）——**LTX 的文本编码器烘在 DiT 同文件内**，不需独立 TE；
而 Wan 走 `T5CLIPEmbedder(is_umt5=true)`，前缀 `text_encoders.t5xxl.transformer`（`:1353`），UMT5 词表
已编进产物（`tokenizers/vocab/umt5.hpp`）。**两者文件数差异直接决定下载与推机成本。**

因此修正后的阻塞描述：不是“全盘无资产”，而是——Wan 路线**缺一个 UMT5 量化 encoder（必下载）**；
LTX 路线**缺 DiT + LTX VAE**（设备只有 Wan VAE）；**两条路线都缺页面与清单槽位**（§九）。
因此 **W10 不得本窗交付**：按本卷 §六 V-1~V-7，帧序列落盘、内存峰值、心跳、取消响应全部
需真机正路径取证；无模型时只能验“干净报错”的负路径，那会留下一个主分支未测的 native 代码路径
——这就是伪稳定（项目红线：不兜底、不补丁）。

**开工前置清单（需大王裁定）**：

1. **选型**：Wan2.1 TI2V-1.3B（手机级现实目标，GGUF 约 1.2–1.5GB）vs LTX-Video 2B（相近体积）；
   选前需确认 vendored 引擎对两者的 loader 路径均在符号中（已直证：wan vae 转换函数存在）。
2. **预算**：下载流量/磁盘、运行内存峰值（§3.1 表：81 帧 480p ≈ 462MiB 仅解码期）、发热与
   电池影响（夜间长跑走 nightTask 已有 WakeLock 链路）。
3. **验收口径**：先按 §六 V-1（6 帧 16fps 默认参数跑通）定基线，再谈帧数/分辨率向上。

## 九、页面与交互设计（2026-09-08 补，大王追问后定的真空区）

> 本节之前的全链规格只回答了“引擎能不能跑”，未回答“用户在哪里、按什么、看到什么”。本节为页面层
> **首版可执行规格**，下一节的实现波以此为验收对象。

### 9.1 现状盘点（引用实物，不臆断）

| 层 | 现有规格 | 覆盖度 |
|---|---|---|
| 引擎/桥/API | 本卷 §一~§六 | 已钉死 |
| 模型清单 | `src/utils/imageGenManifest.ts`：`ModelFamily` 仅六值、`BUILTIN_MANIFESTS` 仅 4 条（均图片） | **无视频模态概念** |
| 页面 | `IMAGEGEN_UI_SPEC` v4～v5.10：创造工坊 = 顶栏**单滑块双 tab**（生图/音频） | **视频零设计** |
| 玩法定位 | `ONDEVICE_VIDEO_GEN_ANALYSIS` §七：大王定调“**跑分软件式玩具**，能不能比快不快重要” | 有定位无页面 |
| 入口方向 | 同一文档 §八 尾一行：“若触发立项→生图页扩展‘视频’tab” | **仅一行方向，无规格** |

结论：“生图页扩展视频 tab”从来只是一句方向，**没有任何一处定义过这个 tab 长什么样**。v0.1 的 §七
还把 UI 明列“不做”，所以页面与交互是**真空**，本窗之前把它当成“已规划”是我的误判。

### 9.2 耦合形态裁定：**不新增 tab**，模态是“所选模型的属性投影”

大王问“视频能不能跟生图页耦合”——能，但**耦合在模型上，不耦合在 tab 上**。

- **宽度硬账（决定性）**：K90 屏幕 1200px / 480dpi = **400dp**。现顶栏：返回 ≈40 + 标题「创造工坊」≈80
  + 滑块 2×48 = 96 + 模型胶囊 maxWidth 120 + 「加载」≈56 = **≈392dp**，已贴满 400。
  加第三段（+48）→ ≈440dp 必溢出；而 v5.1 写死了「加载按钮永可见」为红线→
  **要么挤掉胶囊要么挤掉加载，两者都是拿页面可用性换 tab 名分**。这一票否决第三 tab。
- **为何音频占一个 tab 而视频不占**（不是历史包袱，是产物家族差异）：音频是**独立引擎（ORT/Sherpa）
  + 独立能力（转写/合成）+ 独立历史条**；而**生图与视频共用**同一引擎入口（`sd_ctx`）、同一模型目录
  、同一提示词体系、同一产物区三态、同一 `imageGenQueueCore`、同一 `engineMutex`、同一相册。
  把“同一件事的不同产物”拆成两个 tab，就是在用户面前重复自己。
- **单状态机纪律**：主轴仍是 `idle → loading → ready → generating → done/failed`，模态不引入新状态。

**机制**：manifest 加一维 `modality: 'image' | 'video'`（默认 `'image'`，**存量条目零改动**）。
选中视频模型时页面自动进入视频形态（参数面/产物区/耗时文案随派生值变）；退出该模型自动回图片形态。
→ **用户不切模态，用户只选模型**（与既有“选模型即选家族”的心智一致）。

### 9.3 页面形态：全部复用，不新增一个容器

| 元素 | 复用对象 | 视频差异 |
|---|---|---|
| 模型入口 | 现有 `ModelPicker` 屏级 overlay（与音频引擎下拉同一交互） | 行内徽章新增 `[视]`（现有 `FAMILY_BADGE` 同位置，不新增行） |
| 参数面 | 现有折叠高级参数卡（与提示词折叠平级，v5.10②） | 新增一行三值：帧数 / fps / 尺寸；**帧数是头号旋钮（§3.1）故可编，fps 与尺寸默认锁死** |
| 主按钮 | 现有 `GenActionBar` 吸底条 | 仅文案（出图 → 出片），不新建按钮组件 |
| 任务卡 | 现有 `taskPage` 整卡三态（running / success / failed） | running 文案按阶段（采样 12/80・落盘）并挂完整 `PerfPanel`（v5.10① 同一条路径） |
| 产物预览 | 现有方形大卡预览窗（音频 v5.5 已把产物区升为播放器窗） | 图片区换成帧序列预览：首帧当封面 + 播放控件，**同一卡片容器** |
| 历史条 | 现有底部 `HistoryStrip` 方形卡 | 视频条目用**首帧作缩略图 + 时长角标**；不新建第二条历史条 |
| 徽章/跑分 | `PerfPanel` / `InfoStatsRow` | 视频任务额外可见帧数与预计耗时（数据源仍是现有 tick） |

### 9.4 夜间长跑语义（这是产品形态，不是后台实现）

按大王定调“一晚上跑一条 5s 完全可接受”，页面必须让用户**能离场**：

- 提交即允许完全离开：进队列 → 前台服务常驻通知（复用 nightTask，W8b 改名后的服务与渠道）→
  完成后通知点击**直接回预览卡片**。
- 重进页面时：任务卡显示真实阶段与已耗时，**不得出现假进度条**（无分母就不画，沿用跑分面板的同一条纪律）。
- 取消：沿用现有停止入口，对应 §六 V-5（native 真中断）。
- 与项 38 的关系：本波必须连带处理——**在飞凭据未修好前，不得开放夜间视频**，否则用户离场再回来
  看到的就是假失败（同一个坑，不同入口）。

### 9.5 产物身份（避免“相册里一堆灰占位”）

- **帧目录不是产物**，只是中间态；对用户只呈现一个“视频条目”（封面帧 + 时长 + 分辨率）。
- 本期交付形态：**帧目录不出页**（仅预览与播放用），对用户可见的唯一实物 = 封面帧存相册；
  可播容器（WebM/MP4）归 **W11**，未做前不得写“已支持导视频”。
- 存相册复用现有能力与提示（DreamLite 修复波已去掉失效的“已保存”谎报，同一口径）。

### 9.6 模型安装方案（回答“视频模型当然需要安装”）

两条路线的真实文件清单（本窗实读得出，不是估算）——**但先要看完 9.6.1 的验伪，两路只剩一路**：

| 路线 | 必需文件 | 已有 | 需下载 | 预估单条耗时（§5.4 推算） |
|---|---|---|---|---|
| ~~**LTX-Video 2B**~~ | — | — | — | **本引擎加载不了，见 9.6.1** |
| **Wan2.1 T2V-1.3B**（唯一可加载） | ① DiT GGUF ② **UMT5 encoder** ③ Wan VAE | 仅 VAE（设备已有） | **2 个文件 ≈ 4.1–4.7GB** | 50 步 → **80–200 分钟** |

#### 9.6.1 LTX 验伪（2026-09-08 本窗，代码直证——推翻了 ANALYSIS §八的“首选路径”）

`ONDEVICE_VIDEO_GEN_ANALYSIS` §八写“若触发立项首选 LTX-Video 2B distilled → DiT Q4 + **T5** Q4 + VAE”。
本窗逐行读 vendored 引擎，**该路径不成立**：

| 证据 | 实物 |
|---|---|
| `src/stable-diffusion.cpp:1129-1134` | 走 `sd_version_is_ltxav` 分支时 **无条件** 构 `LTXAVEmbedder(…, "text_encoders.llm", "text_embedding_projection")`，无 T5 回落分支 |
| `src/conditioning/conditioner.hpp:2991-2992` | `LTXAVEmbedder` 内部 **硬编码** `GemmaTokenizer` + `LLM::LLMArch::GEMMA3_12B` |
| `src/model.h:45` | 视频 LTX 只有 **单一** `VERSION_LTXAV`，无“2B / T5 版”子类型 |
| `src/model_loader.cpp:537-538` | 识别靠 `model.diffusion_model.adaln_single…` 张量名→ 归入同一 `VERSION_LTXAV` |

推论：**本引擎的 LTX 路要吃 Gemma-3-12B 做 TE**（即 LTX-2 / 2.3 形态）。而 LTX-2 系列的 Gemma3-12B
Q4 就 ≈4–8GB、DiT 为 19B/22B 量级 → **手机内存直接不可能**；而能跑的 LTX-Video **2B**（T5 编码）
因 conditioner 不对 → **加载不了**。要把 2B 跑起来需改引擎 conditioner——**引擎层禁区，不议**。
→ 对比 Wan：`stable-diffusion.cpp:1162-1168` 显式 `T5CLIPEmbedder(…, is_umt5=true)`，与 ANALYSIS §5.2
清单逐项对得上，**Wan 2.1 T2V-1.3B 是当前唯一可加载且体积可行的路线**。

#### 9.6.2 加载槽位缺口（比“下载”更前置，全仓文档此前未记）

本窗实读：引擎有专用入口 `sd_ctx_params_t.t5xxl_path`（`include/stable-diffusion.h:193`），
加载时挂在 **前缀 `text_encoders.t5xxl.transformer.`** 下（`src/stable-diffusion.cpp:758-763`）——
正是 Wan 的 `T5CLIPEmbedder` 唯一会去取的那个前缀（`:1353`）。

而本仓 `android/app/src/main/cpp/ImageGenJNI.cpp:411-428` 只设了
`diffusion_model_path` / `llm_path` / `vae_path` / `clip_l_path` / `clip_g_path`，**从不设 `t5xxl_path`**。
→ **UMT5 文件推进去也加载不到**。且不能“偷”用 clip_l 槽：clip_l 的前缀是
`text_encoders.clip_l.transformer.`，与 T5CLIPEmbedder 查找的前缀不同→ **换槽无效，必须加槽**。

**修正后的最小可用链**（三项都是前置，缺一不可）：

1. **JNI 加 `t5xxl` 槽**（我们自己的 `ImageGenJNI.cpp` + Kotlin `preloadModel` 签名，**非禁区**）；
2. **manifest 加 `t5xxl?` 伴侣文件位**（与 `clipL/clipG/llm/vae` 同层）；
3. **资产到位**（下表两文件）。

#### 9.6.3 可执行资产清单（2026-09-08 本窗拿到文件名与体积级，非估算）

| 件 | 源（hf-mirror 实测可达） | 文件 | 体积 |
|---|---|---|---|
| DiT | `samuelchristlie/Wan2.1-T2V-1.3B-GGUF` | `Wan2.1-T2V-1.3B-Q4_K_M.gguf` | **0.92GB** |
| TE | `city96/umt5-xxl-encoder-gguf` | `umt5-xxl-encoder-Q3_K_M.gguf` | **2.85GB** |
| VAE | 设备已有（Krea2 链路共用） | `wan_2.1_vae.safetensors` | 253MB（零下载） |

合计需下载 **3.77GB**（比 ANALYSIS §5.2 的 4.8–5.4GB 估算更小：因为选了 Q3_K_M 而非 Q4）。`city96/Wan2.1-T2V-1.3B-gguf`
在镜像上 **401 不存在**（§5.2 那个源名需更正为 `samuelchristlie` 系）。
内存账：权重常驻 0.92 + 2.85 + 0.25 ≈ **4.02GB**，**已踩 §7.1 的 4GB PSS 预算线**——
首验必须 ≤480p 且低帧数，否则一跑就被 HyperOS 看护干掉（而非引擎报错）。

- 两路都不需为 W10 开任何容器相关编译项——**W10 只出帧**，容器才涉及 muxer（W11）。
- 推机路径：现有模型目录 `/sdcard/Documents/AIOS/models/`（与图片模型同一目录，manifest 精确文件名匹配）；
  设备可用空间 **≈313GB**（本窗 `df` 实测），存储不是瓶颈。
- **选型结论（据 9.6.1 改写，不再是“LTX 先 Wan 后”）**：**Wan 2.1 T2V-1.3B 是唯一可加载路线**，
  无可选空间；ANALYSIS §七“Wan 为主候选”与 §八“首选 LTX”的表面矛盾，现在由代码单边裁定为 §七。
  代价是耗时 80–200 分钟/条 → **反向验证了 §9.2“不新增 tab”的裁定**：没有人会在页面上干等 100 分钟，
  视频天然只能是“提交即离场”的夜间长跑，而不是一个并列的创作 tab。

### 9.7 开工顺序（上一句“先设后码”的具象）

1. **P0（本窗可做，零风险）**：manifest 加 `modality` 维 + `t5xxl` 文件位 + `[视]` 徽章（向后兼容，存量零改动）。
2. **P0.5（必须，否则装了也加载不到）**：`ImageGenJNI.cpp` 与 Kotlin `preloadModel` 加 `t5xxl` 槽（§9.6.2）。
3. **P1**：下载 §9.6.3 两文件 → 推机 → 先不写 UI，用现有面板确认能被扫到并加载（不报 UNKNOWN、
   logcat 可见 `loading t5xxl from …`）——**加载成功就是一个关键可验里程碑**。
4. **P2**：`nativeGenVideo` 桥 + C-1~C-4 + R-1/R-2 已修 → 页面视频形态（§9.3）一次做完。
5. **P3**：项 38 在飞凭据 + 夜间长跑开放。
6. **P4**：W11 容器裁定（用户才能“拿走”视频）。

### 9.8 视频专属验收项（补 §六 的页面层）

- **U-1**：选中视频模型后页面自动进入视频形态，参数面出现帧数/fps/尺寸；选回图片模型自动退出。
- **U-2**：全程**不新增 tab、不新增顶栏控件**（宽度硬账守得住，用截图尺寸作证）。
- **U-3**：提交后离场→息屏→回页，任务卡仍显真实阶段（不假成功、不假失败）。
- **U-4**：历史条里视频条目有封面帧与时长角标，**无裸帧目录泄漏到相册**。
- **U-5**：未做 W11 前，UI 文案不得出现“已生成视频/已保存视频”（只能说已出帧/封面已存）。

### 9.9 本节明确不做

- 不在聊天页提供生视频入口（聊天生图单点路由的纪律不因视频破例）。
- 不做视频编辑/续帧/首尾帧（`init_image`/`end_image`/`control_frames` 继续不接）。
- 不做帧率/分辨率自由调（参数面只开放帧数，其余锁默认）。
- 不做播放器自制 UI（先复用音频产物窗同一形态；需专业控件时另卷）。

## 十、变更日志

| 日期 | 版本 | 变更 |
|------|------|------|
| 2026-09-08 | 0.3 | **补页面真空（§九）+ 更正资产陈述（§八）+ LTX 验伪（§9.6.1）**：① 裁定**不新增 tab**，模态由 `manifest.modality` 驱动（宽度硬账 400dp 已贴满为一票否决证据）；② 页面全部复用既有容器（ModelPicker/taskPage/PerfPanel/HistoryStrip/吸底条）+ U-1~U-5 验收；③ 夜间长跑定为用户形态（与项 38 强耦合）；④ **推翻了 ANALYSIS §八的“首选 LTX-Video 2B”**：本引擎 LTX 分支硬编码 `GEMMA3_12B`、无 T5 回落分支（逐行直证）→ **Wan 2.1 T2V-1.3B 是唯一可加载路线**；⑤ 挖回本卷初稿“全盘无视频资产”的不实陈述（下划线命名漏匹配）并列实物盘存：设备已有 WanVAE，只欠 UMT5 + 量化 DiT |
| 2026-09-08 | 0.2 | 新增 §八 编译期取证：从已装 APK 抽 `libappmodules.so` 跑 `llvm-nm`，直证 `generate_video` **已导出**（含 1820 个 video 相关符号）——引擎就绪；同时登记硬阻塞：无视频模型资产，故 **W10 移出本窗**并给出选型/预算/验收三项前置 |
| 2026-09-08 | 0.1 | 首发（W10 前置）：引擎 API 与内存量级实读取证、帧回程契约（native 落盘 + data 置空防 double-free）、心跳真缺口在解码期（据此更正审计卷 §3.5）、C-1~C-4 契约、随波修 R-1/R-2、V-1~V-7 验收、不做清单 |
