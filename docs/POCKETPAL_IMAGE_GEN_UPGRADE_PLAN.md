---
doc_id: POCKETPAL_IMAGE_GEN_UPGRADE_PLAN
module: root
type: planning
status: superseded
version: "1.0"
created: "2026-08-12"
updated: "2026-08-15"
relates: [POCKETPAL_IMAGEGEN_UI_SPEC]
superseded_by: POCKETPAL_IMAGEGEN_UI_SPEC
---

<!-- D-FORMAT:v3 -->

# PocketPal 生图链路升级方案（P5.3）

> 状态：P0+P1 完成 ✅ | P2 代码层完成（OpenCL 待真机环境） | 维护：啄木鸟专工 | 2026-08-12
> 前置：P5.1 引擎接入 + SD3.5/Z-Image 模型入场（见 Master Log §12）已完成
> 原则：产品锋利、反臃肿、反兜底、反补丁——每处从架构层改干净

## 一、6D 全量排查发现

### D1 数据流（目录与配对）——脏点 5 处

| # | 问题 | 性质 | 位置 |
|---|---|---|---|
| 1 | `SD_MODELS_DIR` 硬编码 `/sdcard/Documents/AIOS/models`，绕过 `paths.ts` 的 `AIOS_MODELS_DIR` 常量 | 补丁 | ImageGenScreen.tsx:25 |
| 2 | `scanModels` 正则识别主模型 + `isCompanion` 正则排除 → 新模型/新架构必须改正则 | 脆弱 | ImageGenScreen.tsx:48,78-82 |
| 3 | `resolveExtras` 正则配对伴侣文件（已踩 Qwen3.5-4B vs Qwen3-4B 坑） | 补丁 | ImageGenScreen.tsx:118-158 |
| 4 | JNI `find_companions`(opendir 扫描配对) 定义了但 `nativeLoadModel` 根本没调用 → 死代码 | 臃肿 | ImageGenJNI.cpp:30-65 |
| 5 | chat 模型与生图模型同目录（AIOS_MODELS_DIR），靠正则区分 | 脆弱 | ModelStore.ts:8 + ImageGenScreen |

### D2 控制流（互斥与生命周期）——致命 4 处

| # | 问题 | 影响 | 位置 |
|---|---|---|---|
| 6 | `imageGenStore.loadModel` 不调 `modelStore.releaseContext()` → 双引擎常驻 | **OOM 致命** | imageGenStore.ts:50-67 |
| 7 | ChatScreen 画图路由不 unload chat 模型就 navigate IMAGE_GEN | **OOM 致命** | ChatScreen.tsx:94-123 |
| 8 | 离开生图页/切回聊天不 unload sd 引擎（g_ctx 常驻） | OOM 隐患 | ImageGenScreen 无 unmount unload |
| 9 | JNI g_ctx 单例只在 loadModel 新载前 free 旧 sd_ctx，不感知 chat native context | 互斥断裂 | ImageGenJNI.cpp:147-150 |

### D3 状态（mobx 一致性）——2 处

| # | 问题 | 位置 |
|---|---|---|
| 10 | `imageGenStore.error = ...` 非 runInAction（mobx 不追踪） | ImageGenScreen.tsx:166 |
| 11 | `imageGenStore.pendingPrompt = null` 非 runInAction | ChatScreen.tsx:70,103 |
| 12 | `FAMILY_DEFAULTS` 步数/CFG 硬编码在 UI 层，与模型脱钩 | ImageGenScreen.tsx:45 |

### D4 资源（硬件探测）——4 处

| # | 问题 | 位置 |
|---|---|---|
| 13 | `backend="CPU"` 硬编码，不探测 Adreno OpenCL | ImageGenJNI.cpp:180 |
| 14 | `n_threads=4` 硬编码，不探测核数 | ImageGenJNI.cpp:177 |
| 15 | `wtype=Q4_K` 对 fp16 伴侣文件语义不清 | ImageGenJNI.cpp:178 |
| 16 | 无 vae-tiling/taesd/flash-attn 配置点 | ImageGenJNI.cpp 全 |

### D5 错误（兜底）——2 处

| # | 问题 | 位置 |
|---|---|---|
| 17 | `nativeTxt2img` 注释"SDXL Turbo: 1-4 steps"，sample_method 未显式设（依赖引擎默认） | ImageGenJNI.cpp:231-233 |
| 18 | 错误码 ERR_ 字符串拼接，无类型化 | ImageGenJNI.cpp 全 |

### D6 演进（扩展点）——2 处

| # | 问题 | 位置 |
|---|---|---|
| 19 | 无 manifest 声明式模型注册 → 每加模型改正则+硬编码 | 全局 |
| 20 | 无后端选择配置 → OpenCL 接入需改 CMake + JNI | CMake + JNI |

## 二、升级方案（分阶段，产品影响排序）

### P0 致命链路（必须先做，否则跑不起来）

**核心：EngineMutex 互斥协调器**（回调注入，无循环依赖）
- 新增 `src/store/engineMutex.ts`：单例，`register(kind, releaser)` + `acquire(kind)` 自动释放对方引擎
- `imageGenStore.loadModel` 开头 `await engineMutex.acquire('image')`（自动释放 chat）
- `ModelStore.initContext`（line 1808 释放旧 chat 处）开头 `await engineMutex.acquire('chat')`（自动释放 sd）
- `imageGenStore.unloadModel` / `modelStore.releaseContext` 末尾 `engineMutex.release()`
- 两 store 各自 register 自己的 releaser，EngineMutex 不反向引用 store → 无循环

**mobx 一致性**：D3-10/11 改 runInAction

**死代码清理**：删 ImageGenJNI.cpp 的 find_companions（D1-4）

**目录统一**：ImageGenScreen 用 `AIOS_MODELS_DIR`（D1-1）

### P1 链路干净（声明式，反补丁）

**模型 manifest 声明式注册**（D1-2/3/5 + D6-19）：
- 每个模型套件一个 `models/<name>.manifest.json`：`{main, companions:{clipL,clipG,llm,vae}, defaults:{steps,cfg,size}, family}`
- `scanModels` 读 manifest 列表，不再靠正则猜主模型
- `resolveExtras` 从 manifest 取伴侣路径，不再正则配对
- `FAMILY_DEFAULTS` 从 manifest 取，UI 不硬编码
- 新增模型 = 放 manifest 文件，零改代码

### P2 加速（OpenCL 后端 + 硬件探测）

- CMake 开 `SD_OPENCL ON` + NDK sysroot 补 OpenCL headers/ICD loader
- JNI `backend` 改为探测/配置（`"OpenCL"` 优先，fallback `"CPU"`）
- `n_threads` 探测 `std::thread::hardware_concurrency()`
- 暴露 `diffusion_flash_attn` + `taesd_path` 配置点
- 真机对比测试：CPU vs OpenCL，三模型画质/速度

## 三、依次开发计划

| 序号 | 任务 | 文件 | 优先级 | 状态 |
|---|---|---|---|---|
| 1 | EngineMutex 互斥协调器 | 新增 `src/store/engineMutex.ts` | P0 | ✅ |
| 2 | imageGenStore 接入互斥 + mobx 修正 | `src/store/imageGenStore.ts` | P0 | ✅ |
| 3 | ModelStore.initContext 接入互斥 | `src/store/ModelStore.ts` | P0 | ✅ |
| 4 | ImageGenScreen 目录常量 + runInAction | `src/screens/ImageGenScreen/ImageGenScreen.tsx` | P0 | ✅ |
| 5 | 删 JNI find_companions 死代码 | `android/app/src/main/cpp/ImageGenJNI.cpp` | P0 | ✅ |
| 6 | tsc + 编译验证 | — | P0 | ✅ |
| 7 | manifest 声明式模型注册 | 新增 `src/utils/imageGenManifest.ts` + 改 ImageGenScreen/ChatScreen | P1 | ✅ |
| 8 | OpenCL 后端接入 | `jni/CMakeLists.txt` + ImageGenJNI | P2 | ⏸ 代码层(n_threads探测)完成，CMake+headers 待真机环境 |

## 四、验收标准

- P0：真机连续操作（聊天→画图→聊天→画图）不 OOM；mobx 状态可观察追踪；tsc+Gradle 编译通过
- P1：新增模型只放 manifest 文件，UI 自动识别 + 伴侣配对 + 默认参数，零改代码
- P2：OpenCL 后端真机出图，速度对比 CPU 有量级提升

## 五、P5.4 生图页 UX 重构 + 崩溃取证（2026-08-12）

### 5.1 崩溃取证：持久化落盘日志

**问题**：weak-ref 修复装机后仍崩。取证发现 21:11 后无新 native tombstone，logcat 已轮转，
且静默 OOM kill 不写 tombstone → 日志不足以定位。

**方案**（ImageGenJNI.cpp）：新增 `dbg_log()` 落盘日志器，写
`/sdcard/Documents/AIOS/imagegen_debug.log`，每行 `fflush`，进程被 SIGKILL/OOM 杀后最后一行仍保留。
`dbg_mem()` 读 `/proc/self/status` VmRSS 追踪内存 buildup → 判别 OOM。
埋点覆盖 loadModel（new_sd_ctx 前后）与 txt2img（generate_image 前后、write_png 前后）全链路。

**判读**：若日志停在 `generate_image begin` 且 VmRSS 持续走高 → OOM；
若停在 `write_png` → 写盘崩溃；若日志完整 `txt2img done` 但 UI 崩 → RN 层问题。

### 5.2 三行布局重构（用户视角设计）

现状问题：模型卡占首屏（低频操作）、结果图在折叠线下、历史仅内存且最底、出图按钮无文字、结果无出口。

**三区布局**（单列）：
1. **① 结果区（置顶主角）**：最新生成图 + 操作条[存相册/分享/同参数/全屏/删除] + 参数水印
2. **② 历史区（紧凑横条）**：横向滑动缩略图，[管理]多选删除，点图全屏+详情
3. **③ 创作区（底部 composer）**：提示词 + 折叠高级参数 + 全宽出图按钮（拇指可达）

模型选择收进 header 状态胶囊（点开弹底部面板切换/加载）。

**功能补全**：历史持久化（重启不丢）、存相册（MediaStore → Pictures/AIOS）、全屏查看、同参数回填、多选管理。

### 5.3 依次开发计划（P5.4）

| 序号 | 任务 | 文件 | 状态 |
|---|---|---|---|
| 1 | 持久化崩溃日志 + 内存埋点 | ImageGenJNI.cpp | ✅ |
| 2 | 三行布局：结果置顶+历史横条+底部composer | ImageGenScreen.tsx | ✅ |
| 3 | 历史持久化 + 存相册(MediaStore) + 全屏 + 多选管理 | imageGenStore.ts + ImageGenModule.kt + ImageGenScreen.tsx | ✅ |
| 4 | tsc + Gradle + 装机 | — | ✅ |
| 5 | 复现抓日志定位崩溃根因 | imagegen_debug.log | ✅ 判定为 OpenCL 采样 hang（非崩溃） |

### 5.4 P5.4 v2 体验修正（大王真机反馈后）

| # | 问题 | 方案 | 状态 |
|---|---|---|---|
| 1 | 模型选择弹底部卡不直觉 | 改锚定下拉：顶部胶囊点按→正下方展开下拉面板，选模型+面板内加载/卸载确认 | ✅ |
| 2 | 键盘遮挡输入框 | 外层换 `KeyboardAwareScrollView`（react-native-keyboard-controller），聚焦输入自动滚入可见区 | ✅ |
| 3 | 进度条在页面底部 | 生成中进度改 overlay 叠在结果区（绝对定位盖在结果图/空态上） | ✅ |
| 4 | 卡采样（OpenCL hang） | 日志停 `generate_image begin` 不返回、无 tombstone → Adreno OpenCL hang；默认 backend 改回 CPU，OpenCL 待根因定位后启用 | ✅ |
| 5 | CFG=0 传入 | JNI 已有 `cfg>0?cfg:2` 兜底 | ✅ |

### 5.5 P5.4 v3（大王二轮反馈）

| # | 问题 | 方案 | 状态 |
|---|---|---|---|
| 1 | 下拉应盖住下方+点外收起 | 改悬浮 overlay（absoluteFill+elevation）+透明遮罩点外收起；选中模型自动收起+自动加载（选即载） | ✅ |
| 2 | tab 页要彩色 | 语义彩色点缀：操作按钮[存相册绿/分享蓝/同参数橙/删除红]、模型族徽章[SD3.5紫/Z-Image青] | ✅ |
| 3 | 抽屉生图移第二位 | SidebarContent 核心导航顺序改 聊天→生图→Pals→模型 | ✅ |
| 4 | weak-ref 崩溃根治 | 推拉反转：JNI 回调只写内存快照（零 bridge），Kotlin 增 getGenSnapshot()，RN 1Hz 单通道 pull，移除 NativeEventEmitter 事件风暴 | ✅ |

## 六、P6 生图加速全量规划（大王：全都要，AI 无工作量概念）

### 6.1 调研结论（新模型实践检验）

| 模型 | 体量 | 真机基准 | 开源/引擎 | 评定 |
|---|---|---|---|---|
| SANA/SANA1.5 (NVIDIA+MIT) | 0.6/1.6B，4bit≈1.2GB | 中端机 512px 5-8s，CLIP 0.85+ | ✅开源，MNN 3.6 原生支持端侧 OpenCL/Vulkan | **最稳，Phase2 首选** |
| SnapGen/SnapGen++ (Snap,CVPR25) | 372-379M | 1024px≈1.4-1.8s(4步) | 权重开放度存疑 | Phase3 评估 |
| DreamLite (字节) | 0.39B | 小米14 <1s(1024px,4步) | ✅GitHub 开源 | Phase3 评估 |

加速 LoRA（sd.cpp 原生支持 sd_lora_t）：Hyper-SD(SDXL/SD1.5,1-8步)、SDXL-Lightning(2/4/8步,393MB)、LCM-LoRA。
注意：Lightning/LCM 训练于 SDXL-base，对已蒸馏的 Turbo 增益有限；SD3.5 暂无官方蒸馏 LoRA。

### 6.2 分阶段计划

| 阶段 | 任务 | 状态 |
|---|---|---|
| P6-1 | LoRA 通道基建（JNI sd_lora_t + Kotlin + manifest.lora + store 透传） | ✅ |
| P6-2 | SD3.5 默认 20→10 步提速（治 375s） | ✅ |
| P6-3 | 下载 SDXL-Lightning 4-step + SDXL-base Q4，建快+好 SDXL 选项 | ⏳ 挂起（复活前提见 docs/internal/AIOS_IMAGEGEN_SPEEDUP_ASSESSMENT.md §1.5） |
| P6-4 | 引 MNN 引擎 + SANA 端侧（新引擎，全都要） | ⏳ 挂起（MNN 部分已被 ORT 路线替代——DreamLite 走 ORT；SANA 未评估，见提速评估 §1.4） |
| P6-5 | DreamLite 接入（manifest 声明+RN 架构先行） | ✅ 全闭环（实际走 ONNX Runtime 而非 MNN；真实文生图+编辑+聊天闭环，见 §6.3-6.5 与 MASTER_LOG） |
| P6-6 | SD3 2B 人体姿态 LoRA 训练闭环（引擎兼容路线） | ✅ 全闭环（2026-08-18：手写 joint_blocks MMDiT → 3000 步训练 loss 0.1195 → 烘焙合并 → q4_K 2.24GB → 真机出图验证通过；详见 ADR-0006 与训练域 SSOT v2.0） |
| P6-7 | 运行时 LoRA 挂载开关（路线 B，GAP-001 闭环） | ✅ 全闭环（2026-08-18：base 模型 + 独立 LoRA 文件 + 生图页 LoRA 开关秒级切换；详见 ADR-0007） |
| P6-8 | 端侧生图交互完善配套（比例档 + token 限制 + 管家扩写） | ✅ 全闭环（2026-08-18：① 非 Dream 模型比例档 SD_RATIOS；② 提示词按 token 计（DreamLite 128/SD3 77/Z-Image 256）替代 120 字符；③ 管家扩写 few-shot 对齐 DreamLite 128 tokens，真机验证通过；详见训练域 SSOT v2.4） |

### 6.3 DreamLite 接入专项（Phase 0 已完成）

**Phase 0 结论（2026-08-13）**：
- 权重已公开：`carlofkl/DreamLite-mobile`/`-base`（HF，无需申请）。
- 组件体积：unet=780MB(0.39B)✅ / vae=4.9MB(TinyVAE)✅ / **text_encoder=4.25GB(Qwen-VL 级 VLM)⚠️**。
  “0.39B” 只算 UNet；TE 是多 GB 视觉语言模型，为端侧最大负担。
- diffusers 已合并 DreamLite pipeline（PR #13815，2026-07）。

**架构决策**：
- UNet+TinyVAE → ONNX→MNN（原生 C++ 扩散管线，OpenCL/Vulkan）。
- TE → 量化 4-bit GGUF 复用现有 llama.rn（已能跑 Qwen）提取 hidden states 作条件。
- manifest 已声明 family 'dreamlite'（main=dreamlite_unet.mnn, companions vae/te），文件就位即自动识别。

**进展（2026-08-13 续，浏览器破壁后重大突破）**：
- 浏览器直连 GitHub 取回全部代码链；发现 embeddings/normalization 本不在仓库（来自 diffusers），用 shim 闭合导入链。
- **UNet 加载成功（389.97M=0.39B，权重匹配）**；eager forward 10.3s/步（CPU,1024px）。
- **ONNX 导出成功**：unet.onnx(1489MB fp32) + vae_decoder.onnx(4MB)。
- **端到端生成验证**：4 步 flow-matching + TinyVAE 解码，CPU 38.3s 产出 1024×1024 基线图（TE 置零）。
- forward 契约已固化：`scripts/aios/dreamlite_infer_ref.py`（model_input 宽拼接/time_ids/截宽/mu shift/解码）。
- 导出脚本：`scripts/aios/export_dreamlite_onnx.py`。
- **端侧引擎**：`src/services/dreamLiteEngine.ts`（ORT RN，4步 flow-matching + 纯JS PNG），ONNX 已推真机，生图页加“DreamLite 基线”入口（commit 8a55fd7）。
- UX 真机手动验证：抽屉生图第二位✅ 下拉悬浮盖住✅ 点外收起✅。
- **端侧出图成功（2026-08-13）**：swipe 触发“DreamLite 基线”，logcat 完整：unet 加载4.2s→vae就绪→step1-4/4(各~4.8s)→saved，无OOM/崩溃；屏幕渲染生成图+彩色操作按钮。512px 4步全程~25s。
  - 坑：fp16 ONNX 留不一致 Cast 节点且 ORT CPU 支持差→改 fp32；固定维导出→改动态维（unet_dyn/vae_dyn）；RN 应用需 swipe 触发。
  - 当前为零 TE 基线（unconditioned）；真实文本条件待 TE(Qwen3-VL) GGUF。
- **编辑路径**：`editDreamLite`（vae_encoder 编码源图→条件去噪）+ “DreamLite 编辑”入口（commit 115849b）；ONNX 桌面验证 cond(1,4,64,64)→4步→(1,3,512,512) 5.9s。

**阻断项（需外部条件）**：
- **真实 TE 已转换（2026-08-13）**：下载官方微调 TE(4.25GB, ivan2026HF 公开镜像)→llama.cpp convert 产出 te_f16.gguf(3.21GB)/te_q8.gguf(1.71GB)，te_q8 已推真机。架构=Qwen3VLForConditionalGeneration(hidden2048)。
  - 接线已实现（initLlama pooling:'none'+embedding:true+encode_prompt 复刻），但真机验证输出仍为灰纹理。
  - **根因确认**：llama.rn `rn-completion.cpp:1247` embedding() 只返回单个 n_embd 池化向量（flat.len=2048, tokens=1），**无法提供 per-token hidden_states[-1]**→真实文本条件经 llama.rn 不可行。
  - **真实文生图已生效（2026-08-13）**：ONNX TE(int8, per-token hidden_states)+llama.rn tokenize 接线后，真机出图出现 prompt 语义结构（wooden table），证实文本条件生效。
  - 修复：VAE ONNX 输出 NCHW 被按 HWC 读→灰图/9宫格；改 NCHW→HWC 后出彩色正常图。
  - 对齐官方：默认 1024 + 多画幅(1:1/3:4/4:3/9:16/16:9) + unet_masked(attention_mask) + mu-shifted sigmas。

### 6.4 纯黑图回归诊断与直连改造（2026-08-13，啄木鸟专工闭环）

**黑图根因（桌面 A/B 定位，`.tmp/dreamlite/ab_black_regression.py`）**：

| 假设 | A/B 结论 |
|---|---|
| ① encoder_attention_mask(int64) 约定/dtype 与 cross-attn 不符→注意力全屏蔽→noise_pred≈0 | **排除**。torch 参考 vs unet_masked.onnx 同输入 diff 4.4e-5；masked(ones) vs unet.onnx(无mask) diff 1.3e-5；mask 全0 vs 全1 仅差 3.5e-3。mask 路径健康。 |
| ② shifted sigmas 与 diffusers FlowMatchEulerDiscreteScheduler 不一致→timestep 错→解码饱和黑 | **实锤**。`shiftedSigmas(steps, latH*latW)` 内部再平方/4：1024² 时 seq=(16384²)/4≈6.7e7 → mu≈11535 → Math.exp=Inf → sigmas 全 NaN → timestep=NaN → noise_pred=NaN → Uint8Array 转 0 → 纯黑。diffusers 正确值 sigmas=[1.0, 0.905391, 0.761333, 0.515342]、timesteps=×1000。 |

**修复（src/services/dreamLiteEngine.ts）**：
- `shiftedSigmas` seq 改为 `latArea/4`（对齐 `dreamlite_infer_ref.py` 的 `calculate_shift(lat*lat//4)`，1024² → mu=1.16）；与 diffusers `set_timesteps(sigmas, mu)` 逐值比对 max diff 6e-8。
- VAE 解码缩放 `sf=1.5305`（SD3 遗留魔数）→ `sf=1.0`（ckpt vae/config.json scaling_factor=1.0/shift_factor=0.0）。
- **保留** unet_masked.onnx + shifted sigmas，不回退。

**桌面 e2e（`.tmp/dreamlite/e2e_fixed_sigmas.py`）**：修正后 4 步 1024 去噪链健康（latents std 0.92→0.52 无 NaN），解码 [-0.89, 0.67] 非黑。

**UI 直连（src/screens/ImageGenScreen/ImageGenScreen.tsx）**：
- 分段切换即动作：[文生图] 点击直接生成（未加载则自动加载+生成）；[图像编辑] 点击进编辑流（自动唤起上传→较大边压缩→提示词→[编辑]）。
- 删除 DreamLite 模式下重复的主“出图”按钮（其他模型保留）。

**验收状态**：
- tsc 零错误 ✅ / Gradle assembleProdDebug ✅（app-prod-debug.apk 463MB）
- 真机手动验收（待大王）：人物提示词出清晰人像（非黑/非灰）+ 画幅切换正常 + 文生图/编辑直连无重复按钮。

**遗留待办**：
- TE=Qwen3-VL 4.25GB 4-bit GGUF + llama.rn hidden-states 提取（已由 ONNX TE 路线替代，待长期收敛）。
- unet 780MB hf-mirror 带宽不足（已绕过，权重就位）。
- MNN Android 编译 + 真机验证（可选加速路线）。

### 6.5 生图页产品级重构：预览区单状态机 + 编辑心智闭环（2026-08-13/14）

#### 6.5.1 DreamLite 内存闪退根治
- 根因：真机出图 OOM 闪退（TE 加载 + UNet + 解码同驻）。
- 修法：`llama.rn` initLlama 加 `enableCpuMemArena: false` + `vocab_only: true`（TE 推理峰值大降）；编辑完成后释放 `editRgb/editSource`。

#### 6.5.2 顶部模型选择栏迭代（三轮收敛）
- 共用“加载/卸载”按钮 → **行内按钮**：每模型行右侧独立按钮（未加载=主题色“加载”；已加载=红描边“卸载”），卸载 Alert 二次确认；`imageGenStore.loadedModelId` 追踪驻留模型。
- “出图/编辑”双条目 → **恢复单条目**：同一模型不分家（出图与编辑是同一引擎），模式切换下沉到预览区分页。
- 交互规则：**点卡片只选中高亮，不折叠面板；点“加载”才折叠 + 面板内加载中提示**（卡片选择≠引擎加载，动作与状态解耦）。

#### 6.5.3 预览区单状态机（产品级重构）
- 状态：`previewIndex` 唯一驱动（0=编辑槽，≥1=历史第 i-1 张）；删除 `mode/currentImage` state（改派生）。
- **0 页编辑槽**：预览区横向分页（pagingEnabled），向左滑翻到 0 页——无图时虚线框“＋ 上传本地图片”，有图时显示待编辑图 + 右下“重新上传”。
- 派生规则：`inEdit = previewIndex === 0 && history.length > 0`（无历史时 0 页只是空占位，composer 保持出图心智，保护新用户）。
- 编辑为纯文本指令：placeholder 引导“输入图像编辑指令，如：把天空换成日落…”，编辑指令经官方 diptych 语义模板进入条件去噪。

#### 6.5.4 历史横栏联动 + 上传入历史
- **缩略图点击 → 大图翻页 + 提示词/画幅/步数回填**（scrollToPreview + syncFromParams，历史缩略图与预览分页共用回填）。
- 历史横栏“管理”左侧新增“上传”入口：上传图入历史（`kind:'upload'`，右下角“上传”角标，watermark 显示“上传 · WxH”），可点选查看/编辑。
- **提示词生命周期**：上传新图/进入编辑 → 清空提示词（新图无历史提示词，编辑指令与生成描述语义不同）；切到已生成图 → 回填历史提示词+参数；上传图（prompt=''）→ 自动清空。
- 生成/编辑完成 → 新图入 history[0] → 自动翻结果页；删除 → 回 0 页（防 previewIndex 越界）。

**对账状态（2026-08-14/18）**：
- ✅ 已落地：P0/P1 全部、P2 代码层（CMake arm64 开 OpenCL，运行时默认 CPU）、P5.4 全系列、P6-1/2、P6-5 DreamLite 全闭环（真实文生图+编辑）、P6-6 SD3 2B 训练闭环（引擎兼容路线）、P6-7 运行时 LoRA 挂载开关（路线 B，GAP-001 闭环）、P6-8 交互完善配套（比例档+token 限制+管家扩写）、6.4 黑图修复、6.5 产品级重构、6.5.5 双形态动效。
- ⏳ 未落地：P6-3 SDXL-Lightning 下载（网络下载任务）；P6-4 MNN+SANA（新引擎工程）；P2 OpenCL 真机速度对比验证。

### 6.5.5 生成/编辑双形态动效 + 编辑·出图并列（大王三轮反馈，2026-08-14）

- **composer 按钮并列**：`[编辑(蓝)] [出图(主题色)]` 并排（buttonRow），编辑在前；编辑语义=二创当前预览图，出图语义=新生成一张。
- **编辑单按钮两段式**（editArming 状态机）：浏览态点「编辑」→ 锁定当前预览图（0 页=上传图/历史页=当前图）+ 清空提示词 + placeholder 切编辑指令；预备态点「执行编辑」→ 执行二创。0 页无图时点编辑→自动唤起相册选图。
- **出图动效**（taskKind='gen'）：生成中预览区盖不透明空白页（rgba 0.97）+ 中心 ✦ 呼吸球（Animated 脉冲）+「正在生成新图…」+ 进度条。
- **编辑动效**（taskKind='edit'）：生成中半透明遮罩（rgba 0.6）叠在当前图上（图可见）+ 同款脉冲球 +「正在编辑此图…」+ 进度条。
- **状态清理规则**：翻页/程序导航（scrollToPreview）→ 退出编辑预备态（目标图已变）；出图/编辑完成 taskKind 清 null；操作栏「编辑」按钮同步接 handleEditArm（文案随预备态切换），图区快捷入口与 composer 主入口行为一致。

### 6.6 SD3.5/Z-Image 实验性标记（真机评估闭环，2026-08-13）

#### 评估结论（大王发问：两模型是否实质不可用？）

**结论：不是“没等到”，而是“永远等不到”——进程在长时出图途中先崩溃。**

证据链（真机取证，啄木鸟闭环）：

| 证据 | 内容 |
|---|---|
| imagegen_debug.log | 全部 txt2img 仅最早 SDXL Turbo 384²/2步（OpenCL，685s）成功返回；SD3.5 512²/10步、Z-Image 512²/8步均停 `generate_image begin` 无返回 |
| tombstone_04（08-13 19:51） | SIGABRT：weak global reference table overflow（50252/51200 为 NativeAnimatedModule weak ref）——P5.4 v3 推拉反转根治后**回归**，残余高频桥调用（出图脉冲动效 useNativeDriver + TurboModule invokeJavaMethod weak ref）在分钟级长时出图中累积至溢出 |
| 因果链 | DreamLite 秒级出图→weak-ref 无累积窗口→存活；SD3.5/Z-Image 分钟级→累积至 51200→必死。**跑得越久越必死** |

#### 设计决策

- **短期止损**：SD3.5/Z-Image 下拉标记「实验性」（manifest 声明 `experimental: true`，下拉行/顶部胶囊显示琥珀色徽章），明确“可能不可用”预期；DreamLite 维持唯一可用出图主力。
- **长期复活路径（待办）**：①weak-ref 溢出回归根治（出图动效改 JS driver 或静态呈现，切断 NativeAnimatedModule 高频 weak ref）；②Adreno OpenCL hang 根因（日志证明 OpenCL 曾成功出图，685s 含首次内核编译）；③P6-3 SDXL-Lightning 快模型。

#### 对账状态更新

- ✅ 已落地：6.6 SD3.5/Z-Image「实验性」标记（manifest 声明 + 下拉/胶囊徽章）。
- ⏳ 未落地：weak-ref 溢出回归根治（两模型复活先决条件）；OpenCL hang 根因；P6-3/P6-4。

### 6.7 文案规范化 + 本窗口闭环（2026-08-14）

**UI 文案改名（大王指定，去行话化）**：

| 位置 | 原文案 | 新文案 |
|---|---|---|
| 操作栏按钮（橙） | 抽卡 | 再次生成 |
| 相册横栏标题 | 历史 (N) | 相册 (N) |
| 操作栏按钮（绿）+ 成功 toast | 存相册 / 已存入相册 | 保存 / 已保存 · Pictures/AIOS |

仅改 UI 文案，变量名（handleReroll/history/saveToAlbum）不动，零回归风险。

**本窗口（task-48b）提交清单**：
- `ImageGenScreen.tsx`：预览区单状态机 + 双形态动效 + 编辑·出图并列 + 提示词生命周期 + 文案改名
- `dreamLiteEngine.ts`：内存根治（enableCpuMemArena:false + vocab_only:true）+ 异步释放 await
- `imageGenStore.ts`：kind 字段 + loadedModelId
- `imageGenManifest.ts`：note 时长提示 + catch 语法精简
- `ChatSessionStore.ts`：启动恢复上次会话
- `CMakeLists.txt`：arm64 开 OpenCL（运行时默认 CPU）
- assets 图标更新；docs 6.5/6.6/6.7 落盘

### 6.8 全链路复盘审计：根因修复 vs 兜底/补丁（2026-08-14，大王令，啄木鸟闭环）

对照产品工程哲学（锋利不臃肿、不兜底不补丁、单状态机链路），对 ImageGen 全链路历史修改方案逐项判定。

#### ① 真根因修复（✅ 判定通过）

| # | 方案 | 根因 | 证据 |
|---|---|---|---|
| 1 | DreamLite 黑图 sigmas 修复 | 旧实现 seq=(area²)/4 → mu 溢出 → exp=Inf → NaN | seq=latArea/4，与 diffusers 比对 max diff 6e-8 |
| 2 | VAE 缩放 sf 1.5305→1.0 | SD3 遗留魔数 vs ckpt 实值 | config.json scaling_factor=1.0 |
| 3 | session 释放 await 化 | ORT/Llama release() 异步，未 await 叠加 OOM | dreamLiteEngine releaseTE/Promise.all |
| 4 | enableCpuMemArena:false | ORT arena 跨 run 保留峰值不归还 | 注释实锤 9.4GB swap 叠加被 LMK 杀 |
| 5 | TE int8→fp16 | per-tensor 激活量化毁掉离群通道 | fp16 与 transformers 逐 token cos=1.0 |
| 6 | 推拉反转（快照+1Hz pull） | NativeEventEmitter 高频事件风暴 = weak-ref 主源 | 移除 emitter，getGenSnapshot 零事件 |
| 7 | cacheJniRefs | FindClass/GetStaticMethodID 每次调用不缓存 | jclass/jmethodID 全局缓存 |
| 8 | ONNX 固定维→动态维 | 固定维导出与运行时尺寸不匹配 | unet_dyn/vae_dyn |
| 9 | engineMutex 引擎互斥 | 双引擎同驻 OOM | 加载前自动释放对方 |
| 10 | previewIndex 单状态机 | mode/currentImage 双源冲突 | 删除双源改派生，符合单状态机哲学 |

#### ② 根因已定位但未修复（⛔ 技术债，两模型复活先决条件）

| # | 遗留 | 根因定位状态 | 影响 |
|---|---|---|---|
| B1 | pulse 动效 useNativeDriver loop | **已实锤**（tombstone_04：50252/51200 全为 NativeAnimatedModule weak ref，分钟级任务必溢出）| SD3.5/Z-Image 实质不可用（标实验性止损） |
| B2 | Adreno OpenCL 采样 hang | **未定位**（日志停 generate_image begin 无返回、无 tombstone）| 后端恒 CPU，685s 级出图不可接受 |

#### ③ 兜底/补丁候选（⚠️ 违反哲学，建议清理）

| # | 位置 | 现状 | 判定 |
|---|---|---|---|
| C1 | JNI L351 `cfg > 0 ? cfg : 2.0f` | 冗余防御 | 调用链（manifest defaults + store ?? 2.0）已保证 cfg 有值，应删 |
| C2 | JNI L350 `steps > 0 ? steps : 2` | 冗余防御 | 同上，应删 |
| C3 | JNI L357 `loraMultiplier > 0 ? : 1.0f` | 冗余防御 | 同上，应删 |
| C4 | JNI L285-293 OpenCL fallback retry | 死代码 + 重试兜底 | backend 恒 CPU 后该分支永远不触发（注释名不副实），应删 |
| C5 | dreamLiteEngine fp32→fp16 fallback | 双文件 fallback | fp32 已真机稳定验证，冗余防御分支，建议收口 |
| C6 | JNI log/progress 500ms 节流残留 | 推拉反转后非必需 | 性质已从防崩溃补丁转为 JNI 开销优化，无害但可随 C1-C4 一并精简 |

#### ④ 止损标记（🔶 产品决策，非修复）

- 实验性标记：诚实承认不可用（防误触），方向正确且符合哲学（明示状态，不假装可用）；但它是**状态标记而非修复**，真正修复是 ② 中 B1/B2。

#### ⑤ 审计结论

- **10/10 项根因修复为真根因**（有对比验证或机制实锤），无一错判。
- **最大技术债**：B1 pulse 动效 weak-ref 残留源（根因已实锤、修复方案已明确：JS driver 或静态呈现，未落地）；B2 OpenCL hang（根因未破）。
- **违哲学存量 6 处**：C1-C6 兜底分支与节流残留，建议下窗口清理（纯删防御，零风险）。
- **单状态机哲学**：previewIndex 派生驱动全链路 ✅ 典范；JNI g_mutex 单引擎约束 ✅ 一致。

### 6.9 遗留项治理（C 类清理 + B1 根治 + B2 规划，2026-08-14，大王令）

按 6.8 审计结论依次治理，三波展开：

#### 第一波 C 类兜底清理（锋利化，零风险）

| # | 治理决策 | 理由 |
|---|---|---|
| C1/C2/C3 | 删 JNI `cfg/steps/loraMultiplier` 三处 `>0 ? : default` 兜底 | 调用链（manifest defaults + store `??` 默认）已保证参数有值，JNI 不重复防御 |
| C4 | 删 L285-293 OpenCL fallback retry 死代码 | backend 恒 CPU 后该分支永不触发（new_sd_ctx 失败直接返回 JNI_FALSE） |
| C5 | dreamLiteEngine 删 fp32→fp16 fallback | fp32 已真机稳定验证，单文件单路径（已落地：删 teMode/unetMode + f32ToF16/f16ToF32 死代码 -104 行；同步删 TE int8 静默降级——int8 已实证毁图（cos 0.17-0.56），降级=静默出坏图，改 fail-fast 报错） |
| C6 | 半收口：**删** progress 500ms 节流（每步一次回调本就低频，节流永不触发）；**保留** log 节流并注释改为“JNI attach/detach 开销控制”（高频 log 每帧 Attach/DetachCurrentThread 是真实开销，非防御） | 区分“冗余防御”与“真实开销阀” |

#### 第二波 B1 weak-ref 残余源根治（两模型复活先决条件①）

- 根因（tombstone_04 实锤）：生图页长时任务期间 `Animated.loop` pulse 动效 `useNativeDriver: true` 持续触发 TurboModule invokeJavaMethod → weak ref 分钟级累积至 51200 溢出。
- 治理：生图页**全部** Animated（pulse 循环 + toast 淡入淡出）改 `useNativeDriver: false`（JS driver），切断该页 NativeAnimatedModule 调用链。JS driver 由 JS 帧循环驱动 setNativeProps（Fabric 直接更新 ShadowTree，不产生 weak ref）。
- 权衡：生图期间 JS 线程负载低（1Hz pull + 2s 心跳），JS driver 掉帧风险可接受；动效形态不变，UX 零损失。
- 注意：聊天页 ThinkingBubble 等循环动效仍为 native driver，但聊天场景从未崩溃（token 流 UI 更新节奏与生图不同），不在本波治理范围；若未来聊天页出现同型 tombstone 再扩展。

#### 第三波 B2 OpenCL hang 侦察规划（根因未破，本轮只规划不瞎改）

- 现象：Adreno OpenCL 在 generate_image 采样阶段 hang（日志停入口无返回、无 tombstone）。
- 侦察路线（下窗口专项）：
  1. 复用 .tmp/probe 探针脚本模式：最小复现（OpenCL 后端 + 384²/2 步）观察是否必现；
  2. `dmesg | grep -i kgsl/adreno` 抓 GPU 侧内核日志，确认 hang 在用户态驱动还是内核态；
  3. ggml 层加阶段日志二分：采样循环定位到具体 op（如 attention/silu/matmul）；
  4. 对照 sd.cpp 上游 OpenCL 已知 issue 与 Adreno 兼容性矩阵；
  5. 若确认 Adreno 驱动 bug：维持 CPU 默认（当前决策已正确），OpenCL 降级为“设备白名单启用”。
- 当前 backend 强制 CPU 是**明确决策 + TODO 标记**（非隐性兜底），在 B2 侦察完成前维持。

#### 治理状态（2026-08-14 闭环）

- ✅ 第一波 C1-C6 全部落地：C1-C4（JNI 删兜底/死代码）、C5（dreamLiteEngine 删 fp32→fp16 fallback + TE int8 静默降级 fail-fast，-104 行）、C6 半收口（progress 节流删、log 节流保留为 attach/detach 开销控制）。
- ✅ 第二波 B1 全部落地：生图页全部 Animated 改 JS driver（pulse loop + toast），切断 NativeAnimatedModule weak ref 累积源。
- ⏳ 第三波 B2 未动（有意规划态）：OpenCL hang 根因侦察 5 条路线待下窗口专项，当前 CPU 强制为明确决策。
- 提交：`c516993`（C 类 + B1）+ 本窗口补交（C5 末段 + 文档）。

### 6.10 三大遗留风险深化评估（2026-08-14，大王令，啄木鸟闭环）

#### 风险 1：B2 OpenCL hang 根因未破（后端恒 CPU，慢是代价）

**机理推断**：Adreno GPU 上 OpenCL 是二等公民（厂商投入远小于 Vulkan），采样阶段 hang 大概率是 Adreno OpenCL 驱动 bug（barrier/内存一致性或内置函数实现差异），非我们代码问题。修根因=绕驱动 bug，成本高收益不确定。

**关键新发现——Vulkan 替代路线**：vendored 引擎已带 `ggml-vulkan` 源码目录 ✅（SD_VULKAN 现为 OFF）。Vulkan 是 Android 官方图形 API：NDK 原生带头文件（无需像 OpenCL 那样补 Khronos headers + 厂商 libOpenCL.so），Adreno 5xx+ 的 Vulkan 支持成熟，llama.cpp 社区 Android Vulkan 验证充分。

**路线建议（下窗口优先试 Vulkan）**：
1. CMakeLists arm64 开 `SD_VULKAN ON`（两行改动，NDK 零补丁）；
2. JNI backend 参数改 "Vulkan"（gated 构建标志或运行时参数）；
3. 真机最小验证：SDXL Turbo 384²/2 步对比 CPU 基线；
4. 若 Vulkan 稳定 → SD3.5/Z-Image 复活后的速度问题一并解决；若同样 hang → 回 OpenCL 侦察路线（6.9 五步法）。

#### 风险 2：B1 weak-ref 根治待真机长时实测

**泄漏率反推**（tombstone_04 数据）：50252 weak ref / 12min，pulse 循环 1.8s 周期 × 2 段 × ~54 帧/段 ≈ 4.3 万帧 → **泄漏率 ≈ 1.16 weak ref/帧（invokeJavaMethod）**。

**根治后残余面审计**：生图页 pulse/toast 已全改 JS driver（零帧 native 动画 ✅）；残余 native 调用仅 1Hz syncPoll → 12 分钟 720 次，即使按 1.16/次泄漏仅 835，安全边际 60x+ ✅。且 JS driver 动效每帧 JS 计算使 JS 线程更活跃 → GC 更频繁 → 对 weak ref 回收有利（双保险）。

**实测方案（待大王）**：装机已交付（21:05:44 APK）。大王手动触发 SD3.5 512²/10 步（CPU ~3-6 分钟），观察：①进程存活至出图完成；②无 tombstone。只读旁证：adb logcat -d | grep -i "weak global"（授权范围内可代查）。

**置信度**：逻辑链完整 + 泄漏源已归零，不崩概率 >90%；唯一未覆盖 = 未预见的其他 native driver 动画（已全量 grep 本页确认无）。

#### 风险 3：聊天页 ThinkingBubble 仍 native driver（暂不治理）

**取证结论（本轮深查）**：ThinkingBubble 的 6 处 useNativeDriver **全是点击 chevron 的一次性动画**（200-350ms），非循环 ✅ 无累积风险。真正的聊天循环动效是：

| 组件 | 循环结构 | 挂载窗口 | 泄漏量估算 |
|---|---|---|---|
| LoadingBubble | Animated.loop 1s 周期 ×2 timing | 首 token 前（等待回复） | 首 token 等 2min ≈ 7200 帧 ≈ 8.4k weak ref |
| CircularActivityIndicator | Animated.loop 600ms 周期 | StatusIcon 'sending' 态 + 分页 footer | 同上，窗口短 |

**聊天从未崩溃的机理**：两类循环动效挂载窗口都是“首 token 前”（秒~分钟级），token 流开始即卸载；且 token 流期间 JS 线程高频活跃（每 token setState）→ GC 频繁回收 weak ref。生图则相反：JS 几乎空闲 + 动效循环贯穿 12 分钟 → 溢出。

**风险重估**：当前（MiniCPM 4B 首 token <1min）安全边际充足 ✅；**条件风险**=若未来换大模型（思考期长/首 token 延迟 >10 分钟），首 token 等待期间 JS 空闲 + 循环动效持续 → 重蹈生图覆辙。

**决策**：维持暂不治理（符合“不为未发生的事加防御”哲学）；触发条件 = 换模决策落地时，将 LoadingBubble/CircularActivityIndicator 同改 JS driver（与 B1 同法，零成本）。

#### 附：fp16 死代码清理后的残留收口（大王已删 f32ToF16/f16ToF32）

`unetMode` 变量现为死存储（只写不读，恒 'fp32'）：建议下窗口删变量或将类型收窄为字面量 'fp32'，与 denoise/loadDreamLite 单路径一致。

### 6.11 三大风险修复升级方案（2026-08-14，大王令，6D+星图全量排查，待批）

> 排查方式：KG preflight（fallback_grep，母仓无本仓索引）→ 全仓库 `Animated.loop`/`useNativeDriver` 全量 grep → 引擎构建系统/backend 取值取证 → JNI/store/CMakeLists 逐点取证。

#### 6D 全量排查结论

- **D1 数据流**：backend 不在 manifest defaults（缺失），硬编码在 ImageGenJNI L263。数据流缺口=backend 未入配置层。
- **D2 控制流**：后端决策点唯一但写死于注释（TODO(opencl-hang)）；CMakeLists 编译期 arm64 SD_OPENCL=ON 而运行时不用——**编译期/运行时半开不一致**（违单后端）。
- **D3 状态**：无新增状态面（backend 作为只读配置入 manifest，不进运行时状态机）。
- **D4 资源**：Vulkan 路线取证全绿——引擎 `option(SD_VULKAN)` 一等公民 + 官方 build.md/docker 支持 + ggml-vulkan 源码 vendored + **z_image.hpp/qwen_image.hpp 均含 Vulkan 分支**（两实验性模型原生支持）；NDK 原生带头文件+系统 libvulkan（比 OpenCL 补 headers/ICD 干净）。
- **D5 错误**：当前无超时判定——hang 时进度条无限转=失败不可见（违锋利哲学：不是兑底，是脏）。锋利方案=**超时判定+明确报错+释放引擎（干净失败，禁回退重试）**。
- **D6 演进**：manifest defaults + 设备端 *.manifest.json 扩展点已有——backend 入 manifest 后设备级显式覆盖（配置能力，非自动回退）。

#### 全 App 循环动画盘点（本轮全量 grep）

`Animated.loop` 全仓仅 4 处；其余 11 处 useNativeDriver 均为一次性动画（无累积，保持 native）：

| 组件 | loop 结构 | 现状 | 处置 |
|---|---|---|---|
| ImageGenScreen pulse | 900ms×2 timing | ✅ 已 JS driver（c516993） | 无 |
| LoadingBubble | 500ms×2 timing ×1 | ⚠️ native | 改 JS driver |
| PendingIndicator Dot | 500ms×2 timing ×3 | ⚠️ native | 改 JS driver |
| CircularActivityIndicator | 600ms 线性 ×1 | ⚠️ native | 改 JS driver |

**全局规范（锋利）**：**`Animated.loop` 一律 `useNativeDriver:false`；一次性动画允许 native driver**。一条规则覆盖全 App（含未来新增），杜绝逐页补丁；可选 eslint 自定义规则强制。

**PendingIndicator 特殊分析**：挂载窗口=工具调用期间，token 流时 JS 线程高频（每 token re-render ~50ms）；ChatView observer 隔离（L186-195）为保 loop alive 设计，JS driver 下同样成立；3 个 Dot opacity 插值每帧 JS 计算量极小，token 流期间可接受（取舍：宁轻微掉帧不崩）。

#### 波次执行方案

**第一波（本窗口落）：动画全局收口（B1 终验 + B3 收口）**
1. LoadingBubble/PendingIndicator/CircularActivityIndicator 改 `useNativeDriver:false` + 机制注释（同 B1 注释风格）；
2. 规范写入本文档 + 记忆沉淀；
3. 验证：tsc + eslint 零错误 + 聊天页手动冒烟（大王）；
4. B1 真机终验（大王手动）：SD3.5 512²/10 步完整跑完+进程存活，我只读 logcat 旁证 grep "weak global"/SIGABRT。

**第二波（B2 Vulkan 单后端，下窗口专攻）**
1. **backend 上 manifest**：imageGenManifest defaults 加 backend 字段，ImageGenJNI 从 manifest 读（删硬编码+删 TODO），值暂 "CPU"；
2. **编译期单后端**：CMakeLists arm64 分支 SD_OPENCL OFF + SD_VULKAN ON（x86_64 保持全 OFF）；
3. **干净失败**：imageGenStore 加 step 无推进超时判定（120s）→ 取消+释放引擎+明确报错（禁回退重试，无兑底）；
4. **真机最小验证**：SDXL Turbo 384²/2 步 Vulkan（OpenCL 曾 685s 成功的同模型）对比 CPU 基线；
5. **决策点**：Vulkan 稳 → manifest 值改 "Vulkan" + SD3.5/Z-Image 长时全流程（同时复验 B1）；Vulkan 也 hang → manifest 值留 "CPU"（一行决策，单后端不变），回 6.9 五步侦察法。

**第三波（顺手收口 + 上游追踪）**
1. dreamLiteEngine 删 unetMode 死存储（用户已删 fp16 分支，恒 'fp32'）；
2. RN 上游追踪：0.82.1 新架构 TurboModule invokeJavaMethod weak ref 泄漏上游修复状态为长期观察项（release notes 跟踪，版本升级时消化）。

#### 锋利哲学声明（本方案的边界）

- **单后端**：编译期与运行时 backend 一致，无 fallback 链、无 retry；
- **决策唯一**：backend 只在 manifest 一处（设备级覆盖也是显式配置，非自动回退）；
- **干净失败**：hang 判定=超时+明确报错+释放，不是静默回退（回退=兑底，报错=锋利）；
- **动画规则一条**：loop 一律 JS driver（防弱引用累积是规则的自然结果，不是逐页补丁）。

#### 风险与依赖

- Vulkan 编译链：NDK 头文件/libvulkan 需实构建验证（第一波不涉，第二波首步即验）；
- Vulkan 也可能 hang（Adreno 驱动另一面）→ 方案含 manifest 一行决策点，损失可控；
- PendingIndicator JS driver 在 token 流高峰期的掉帧风险：可接受（崩溃>掉帧的取舍，已大王确认产品哲学方向）；
- 真机验证均需大王手动触发生成（自动化屏幕操作禁令）。

#### 执行状态（2026-08-14 本窗口三波落地）

- ✅ 第一波：LoadingBubble/PendingIndicator/CircularActivityIndicator 全部改 `useNativeDriver:false` + 机制注释。全 App `Animated.loop` 零 native driver（生图 pulse 上窗口已收）。tsc 零错误。
- ✅ 第二波：backend 上 manifest（sd.cpp 系 defaults.backend 字段，当前值 'CPU'）；JNI 删硬编码+TODO 改为透传（空→引擎默认 CPU，无兑底）；Kotlin/RN store/Screen 一条数据流透传；CMakeLists arm64 纯 CPU（OpenCL 永久弃用）；store 加 120s 无引擎事件超时判定→明确报错（干净失败，禁回退重试）。
- ⚠️ Vulkan 编译链实测受阻（预案退化）：ggml-vulkan 构建需宿主机 SPIRV-Headers CMake 包 + glslc 工具链（NDK 自带 glslc.exe，但缺 SPIRV-Headers Config 包）→ CMakeLists 保持 SD_VULKAN OFF。**机制已就位**：Vulkan 启用=补链（SPIRV-Headers/宿主机 SDK）+ manifest 值改 'Vulkan' + CMakeLists 开 ON，三处单点，无需再动逻辑。挂下窗口。
- ✅ 第三波：unetMode 死存储已被大王清理完毕（0 引用），无需改动；RN 上游 weak-ref 追踪为长期观察项。
- ✅ 构建装机：Gradle BUILD SUCCESSFUL（3m40s）+ adb install Success（21:45:37，460MB）。
- 待大王实测：聊天页动效冒烟（第一波）+ SD3.5 512²/10 步长时任务 B1 终验（进程存活+出图），我 logcat 只读旁证。

#### 风险收束与下窗口 checklist（2026-08-14，收束挂起项为确定性待办）

> 本窗口三波已闭环；依赖外部触发/干净路径的风险收束为“有明确解除路径的确定性待办”，不模糊挂起、不臃肿 hack。

**R1 · Vulkan 补链（确定性收束，本窗口不强补）**
- 侦察结论：宿主机无 VulkanSDK（无 `VULKAN_SDK`、无安装目录）；NDK 27.3 自带 glslc.exe（shader-tools\windows-x86_64）与 spirv-headers 源码，但缺 SPIRV-HeadersConfig.cmake。
- 补链需过三重关卡，均须 CMake hack=补丁堆叠（违锋利哲学）：①`find_package(Vulkan COMPONENTS glslc)` 无 SDK 必失败；②`find_package(SPIRV-Headers CONFIG)` 缺 Config 包；③交叉编译下 ExternalProject 需宿主机编译器（cl.exe 已在）编译 shader-gen 工具。
- **干净解除路径（下窗口推荐，零 hack）**：安装 LunarG VulkanSDK（一站式提供 FindVulkan + SPIRV-Headers Config + glslc）→ 三处单点开关：manifest 值改 'Vulkan' + CMakeLists `SD_VULKAN ON` + 重构建。
- 运行时 hang 风险已由 JS 侧 120s 干净失败覆盖（明确报错非静默，无兜底）。

**R2 · 真机终验（依赖大王手动，屏幕操作禁令）**
- 清单：①聊天页动效冒烟（第一波验收）；②SD3.5 512²/10 步 B1 终验（进程存活至出图 + 无 tombstone）。AI 侧只读 logcat 旁证（grep "weak global"/SIGABRT）就绪，待大王触发。
- 决策点：实测稳→维持；异常→manifest 一行回 'CPU'（单后端不变）。

**R3 · RN 上游 weak-ref（长期观察项）**
- 0.82.1 新架构 TurboModule invokeJavaMethod weak ref 泄漏，跟踪上游 release notes，版本升级时消化（非本仓改动面）。

**工作区收束**：真机取证产物（截图/logcat/uiautomator dump/监控脚本）已归置 .gitignore 根锚定模式，git status 清零；文件保留于工作区不物理删除。

### 6.12 Vulkan 补链长链打穿设计（2026-08-13，大王令：收束风险，一次性长链打穿）

> 目标：将 6.11 R1「Vulkan 补链」从确定性待办落地为可编译的 Vulkan 后端。原则：**零下载、零安装宿主机 SDK、不改 vendored ggml 源码**（锋利、可跟踪上游、不补丁堆叠）。

#### 深度侦察结论（本轮取证）

| 项 | 结论 |
|---|---|
| SPIRV-Headers 消费点 | 仅 ggml-vulkan/CMakeLists L14 `find_package(... CONFIG REQUIRED)`；target **未被 link**（ggml 全目录零 target_link_libraries）。真实需求 = ggml-vulkan.cpp L40 `__has_include(<spirv/unified1/spirv.hpp>)` 编译期 include path |
| NDK spirv.hpp | ✅ `…\spirv-headers\include\spirv\unified1\spirv.hpp`（unified1 共 31 文件） |
| NDK vulkan.h | ✅ `sysroot\usr\include\vulkan\vulkan.h` |
| NDK libvulkan.so | ✅ `sysroot\usr\lib\<triple>\libvulkan.so` |
| NDK glslc | ✅ `shader-tools\windows-x86_64\glslc.exe`（shader-gen L221 消费） |
| host shader-gen 编译 | ExternalProject 用 detect_host_compiler 找 cl/gcc/clang（NO_CMAKE_FIND_ROOT_PATH）；cl.exe 完整路径在但**不在 PATH** → 需 `GGML_VULKAN_SHADERS_GEN_TOOLCHAIN` 显式指定 |

#### 补链方案（4 处配置 + 1 个 Config，全在我方 jni/ 下，零改 ggml）

1. **SPIRV-HeadersConfig.cmake**（新增 `android/app/src/main/jni/cmake/`）：定义 `SPIRV-Headers::SPIRV-Headers` INTERFACE IMPORTED，INTERFACE_INCLUDE_DIRECTORIES 指向 NDK spirv-headers/include → 满足 L14 REQUIRED。
2. **find_package(Vulkan) 预设**：`Vulkan_GLSLC_EXECUTABLE` / `Vulkan_INCLUDE_DIR` / `Vulkan_LIBRARY` FORCE cache 指向 NDK（glslc / sysroot include / libvulkan.so）→ FindVulkan 短路通过。
3. **spirv.hpp include 注入**：add_subdirectory 前 `include_directories(NDK spirv-headers/include)`，让 ggml-vulkan.cpp 的 __has_include 命中。
4. **host shader-gen toolchain**：`GGML_VULKAN_SHADERS_GEN_TOOLCHAIN` 指向 host-toolchain.cmake（cl.exe 完整路径），绕过 detect_host_compiler。

#### 风险点（诚实声明）

- **host 编译器 MSVC 环境**：裸 cl.exe 需 INCLUDE/LIB 环境（vcvarsall）。Gradle externalNativeBuild 是否继承 MSVC 环境待实测；若不继承，shader-gen.exe 编译失败 → 需大王构建前激活 vcvarsall 或提供 MinGW。**唯一可能需外部输入的点**。
- shader 数量多 → 首次构建时间显著增加。

#### 三处启用单点（与 6.11 机制衔接）

- CMakeLists：`SD_VULKAN ON`（arm64）
- manifest：defaults.backend='Vulkan'
- 运行时 hang 已由 JS 侧 120s 干净失败覆盖（无兜底）

#### 执行状态与交接（2026-08-13，本窗口因与另一窗口构建趋同被停，移交新窗口）

**本窗口突破五关（补链构建实测，按序）**：
1. `find_package(SPIRV-Headers CONFIG)` → 自写极简 SPIRV-HeadersConfig.cmake（jni/cmake/，指向 NDK spirv-headers，满足 REQUIRED；真实 include 由 include_directories 注入）✅
2. `find_package(Vulkan COMPONENTS glslc)` → 预设 Vulkan_GLSLC_EXECUTABLE / Vulkan_INCLUDE_DIR / Vulkan_LIBRARY FORCE cache 指向 NDK（glslc / sysroot / libvulkan.so），FindVulkan 短路通过 ✅
3. host ninja 缺失 → host-toolchain.cmake 设 CMAKE_MAKE_PROGRAM 指向 SDK cmake 的 ninja.exe ✅
4. cl.exe broken（无 MSVC 环境）→ 构建包装脚本先 call vcvarsall.bat x64 再 gradlew，host 端 vulkan-shaders-gen.exe 编译通过 ✅（构建推进至 [233/323]）
5. vulkan.hpp 缺失 → ggml-vulkan.cpp L22 硬依赖 `<vulkan/vulkan.hpp>`（Vulkan-Hpp），NDK/ggml 均不带 → 大王选定 vendored：代理 clone 精简至 vulkan/ 14 hpp（jni/thirdparty/Vulkan-Hpp）✅

**最终停止点（交接状态）**：
- 全量重编失败：大量 `unknown type name 'VkPushConstantsInfo'` 等新 API 类型错误 = **VK_HEADER_VERSION 版本失配**（Vulkan-Hpp main 分支需更新 vulkan.h，include 路径当前由 NDK sysroot 旧版提供）。
- **版本匹配风险**：本窗口 vendored 的 Vulkan-Hpp 为 **main 分支**；若配 Vulkan-Headers v1.3.359 需同步把 Vulkan-Hpp 切到 sdk-1.3.359 tag（两者须同版本 tag）。

**新窗口 checklist**：
1. ~~vendor Vulkan-Headers~~ ✅ 已完成（2026-08-13，代理 clone tag 落地）：`jni/thirdparty/Vulkan-Headers/include/`（38 头文件，VK_HEADER_VERSION 359）。**版本更正**：上游无 v1.3.359 tag——1.3 系列最高仅 v1.3.302，359 属 1.4 系列，实际落地 **v1.4.359**（与本窗口 vendored 的 Vulkan-Hpp main 世代匹配）；
2. CMakeLists 将 Vulkan-Headers include 置于 NDK sysroot 之前（vendored vulkan.h/vulkan_core.h 优先），重构建验证；
3. 重构建（vcvarsall 包装 + 全量重编）→ ggml-vulkan.cpp 编译验证 → link；
4. 装机 + 真机实测 SOP：SDXL Turbo 384²/2 步 Vulkan 最小验证 → SD3.5 512²/10 步 B1 终验（logcat 只读旁证 grep "weak global"/SIGABRT）。

**本窗口交付物（保留于工作区）**：
- `android/app/src/main/jni/CMakeLists.txt` 补链块（4 处配置，arm64 SD_VULKAN ON）
- `android/app/src/main/jni/cmake/`：SPIRV-HeadersConfig.cmake + host-toolchain.cmake
- `android/app/src/main/jni/thirdparty/Vulkan-Hpp/vulkan/`：14 个 hpp
- `src/utils/imageGenManifest.ts`：backend='Vulkan' 已启用（异常一行回 'CPU'）

**趋同说明**：本窗口与另一并行窗口原做不同任务，均推进至 Vulkan 补链构建阶段趋同；大王停本窗口，剩余工作移交新窗口。本窗口临时构建日志/脚本已清理；构建包装脚本如需重建：call vcvarsall.bat x64 → gradlew（host shader-gen 必需 MSVC 环境）。





### 6.12 Vulkan 补链·新窗口终态（2026-08-14）

五关已破其五 + 版本对，构建链全程打通、装机启动成功。新窗口增补记录：

1. **版本配对落地**：Vulkan-Hpp（main，1.4 世代）+ Vulkan-Headers v1.4.359 ✅（静态断言 359==359；v1.3.359 上游不存在，359 属 1.4 系列）。
2. **第 6 关：链接期 undefined symbol vkGetPhysicalDeviceFeatures2**。根因：NDK libvulkan.so stub 按 API 级别裁剪导出表（llvm-nm 逐级验证：API 24/26 只导 1.0，28+ 才导 1.1 core；本仓原用 ANDROID_NATIVE_API_LEVEL=24）。修复：Vulkan_LIBRARY 改用本机最高 API 35 stub（链接期专用，运行时由设备 Vulkan loader 解析，现代设备 loader 全量导出），CMakeLists 已注释原理。
3. **构建证据链**：externalNativeBuildProdDebug --rerun-tasks BUILD SUCCESSFUL（2m57s/191 tasks）；assembleProdDebug BUILD SUCCESSFUL（app-prod-debug.apk，549MB 调试版）；adb install Success（66b1777f）；启动观察：pid 存活 + Running "PocketPal" + SoLoader 成功加载 libappmodules.so（208MB，Vulkan 链）+ 零 FATAL/SIGABRT。
4. **剩余（大王真机实测）**：SDXL Turbo 384²/2 步 Vulkan 最小验证 → SD3.5 512²/10 步 B1 终验；AI 侧 logcat 只读旁证（grep "weak global"/SIGABRT）就绪。

工作区：build_vk.cmd / precheck_cl.cmd（vcvarsall 包装 + cl.exe 预检）保留；jni/thirdparty/ 下 Vulkan-Headers（v1.4.359，38 头文件）与 Vulkan-Hpp（main）并存，CMakeLists 缺失守卫 fail-fast。



### 6.13 抽屉与设置页信息架构重构（本窗口闭环，2026-08-14）

> 本窗口任务：抽屉纯会话中心 + 设置页入口中心 + 聊天头部生图入口。详见设计文档 AIOS_POCKET_SPEC_v3.md v3.5 迭代记录。

#### 落地点

| 项 | 内容 |
|---|---|
| 抽屉（SidebarContent） | 移除全部功能导航 Drawer.Item；顶部搜索框 + 「+ 新对话」 + 会话分组列表 + 底部固定齿轮设置（drawer-item-settings，e2e 开合指示器）；长按菜单/多选/日期分组保留 |
| 聊天页头部（ChatHeader） | 新增生图图标按钮（imagegen-button）→ IMAGE_GEN |
| 设置页入口中心（SettingsScreen） | AIOS 组（伙伴/模型/记忆/知识库/智能体/工具配置）+ 系统组（基准测试/生成设置/关于）+ debug DevTools；原参数页迁移 GenerationSettingsScreen（GENERATION_SETTINGS 路由） |
| 命名 | workspace=智能体（zh_Hant 智慧體）、pals=伙伴；18 语言补 6 新键（13 文件英文兜底，et/it 全回退设计维持） |
| e2e | 指示器 drawer-item-pals→drawer-item-settings；DrawerPage 走设置中心链 |

#### 验证证据

- tsc 零错误；目标单测 126/126；完整套件无回归（HEAD worktree 对比）
- Gradle BUILD SUCCESSFUL（Vulkan 链）+ adb install Success + 启动零 FATAL/SIGABRT（pid 存活 + SoLoader 加载 208MB libappmodules.so）
- 记忆「侧拉抽屉与设置页信息架构」已重写（原「抽屉菜单顺序规范」作废）

#### 遗留（大王侧）

- 真机手动验证清单（抽屉 6 项 / 聊天页生图 / 设置页 9 入口）；Vulkan 生图实测（SDXL Turbo 最小验证 → SD3.5 B1 终验）。

### 6.14 真机实测工具链与模型选型复盘（2026-08-14，大王令记录）

**投屏工具（scrcpy，已复制到本工作区随手位置）**：
- 本工作区：`F:\pp\.tmp\scrcpy\scrcpy\scrcpy-win64-v4.1\scrcpy.exe`（v4.1 实测可用；另有 v2.7 在同级目录）
- 母仓原件：`F:\Cursor\OneTakeMVP\.tmp\scrcpy\scrcpy-win64-v4.1\scrcpy.exe`（手册见母仓 POCKETPAL_MODIFICATION_MASTER_LOG.md 附录 B）
- 启动：`Start-Process -FilePath "<路径>\scrcpy.exe" -ArgumentList "--serial=<serial>","--window-title=<名>","--max-size=1200"`（主力机 aab688d9 / 备用机 66b1777f）
- **操作路径实锤**：u2/adb input 注入触摸对本 App RN 层无效（系统设置等原生 App 有效，根因未明）；有效路径 = ComputerUse agent 鼠标点击投屏窗口（人类模拟操作，手机屏幕可见，符合授权规范）
- 坐标换算：投屏截图物理像素 ≈ 窗口逻辑 ×1.47

**模型选型坑（复盘）**：首测误选 SDXL Turbo fp16（6.9GB）→ 手机端加载失败；本地 q8 文件为 0MB 损坏件。规则已立记忆：首测选最小 footprint（SD3.5 Medium Q4_K_M 1.7GB），推送前校验文件非零。

**实测现状**：主力机已装最新 APK（含各窗口全部提交 + appCategory=game）；10 个模型文件已推送就位；待以 SD3.5 Q4 重测 Vulkan。

### 6.15 Vulkan 真机实测数据与结论（2026-08-14，K90+ishtar 双机）

**ishtar（Adreno 740）**：`createComputePipeline: ErrorUnknown`——q4_k matmul pipeline 创建即败（驱动虚报特性，禁 f16/coopmat 后换变体仍败）。

**K90（Adreno 830）SD3.5 512²/10 步全链路**：

| 阶段 | 耗时 | 备注 |
|---|---|---|
| 文本编码（CLIP 加载+计算） | 258s | convert(repack) 主导 |
| MMDiT 加载 | 162s | repack 124s；VRAM 1023+1019+84 MB |
| **采样** | **665s（66s/步）** | **比 CPU 基线慢 2-4 倍** |
| VAE | 1984 MB VRAM buffer | 内存爆涨源，终被杀 |

**结论**：ggml-vulkan × Adreno 当前不可用——740 建不了 pipeline；830 全链路比 CPU 慢且内存开销巨大。根因归上游 ggml-vulkan 移动端适配（量化 repack 开销 + 图分裂嫌疑），非本仓代码问题。

**判别实验（待补）**：K90 跑 SDXL Turbo（经典 UNet，op 集简单，fp16 无 repack）。若 Vulkan 快 → Vulkan 仅经典族可用，SD3.5 待上游；若仍慢 → 执行决策点 manifest 回 'CPU'，Vulkan 挂长期观察（待 ggml 上游移动端优化）。

### 6.16 OpenCL 回归方案：从 Vulkan 死路到 Adreno 正确路径（2026-08-15，啄木鸟长链打穿）

#### 互联网调研结论（6 轮搜索 + 代码层验证）

| 证据来源 | 发现 | 指向 |
|---|---|---|
| saoniuhuo.com (2024-04) | llama.cpp Vulkan on Adreno 740 → 同款 `createComputePipeline: ErrorUnknown` | Vulkan 在 Adreno 无社区成功案例 |
| ncnn GitHub issue | Adreno 840 第五代骁龙必现 SIGSEGV (`vkCmdBindPipeline`) | Vulkan compute 在 Adreno 系统性失败 |
| Filament GitHub | Adreno 640 `vkCreateGraphicsPipelines` SIGSEGV | Adreno Vulkan 驱动跨代不稳定 |
| Vulkore 项目 | Adreno 840 成功，但用自定义 runtime（非 ggml-vulkan），关键洞察 dispatch-bound | ggml-vulkan 框架级不适配，非 API 本身 |
| ARM 官方 / TFLite | OpenCL 比 OpenGL 快 2x，Adreno 原生 FP16 + constant memory | OpenCL 是 Adreno 官方推荐路径 |
| Paddle Lite | 全 Adreno 代际 OpenCL 支持 | OpenCL 跨代稳定 |
| llama.cpp `OPENCL.md` | Adreno 740/750/830/840/X1 均标注 "Support" | 两台设备均在官方支持列表 |
| stable-diffusion-cpp-python PyPI | "Currently, it only supports Adreno GPUs" | 社区已验证 OpenCL on Adreno 生图可行 |

**结论**：互联网上 ggml-vulkan on Adreno **零成功案例**；OpenCL on Adreno 有多个独立成功案例和官方支持。OpenCL 是 Adreno GPU 的正确路径。

#### 三条决策修正（Vulkan 理由复盘）

| 原始理由（§428-434） | 互联网 + 代码证据 | 修正 |
|---|---|---|
| "OpenCL 是二等公民（厂商投入远小于 Vulkan）" | ARM 官方推荐 OpenCL；TFLite/Paddle Lite/llama.cpp 均用 OpenCL on Adreno | **错误**。OpenCL 是 Adreno 的一等公民 |
| "llama.cpp 社区 Android Vulkan 验证充分" | 唯一社区案例遇到完全相同的 ErrorUnknown | **错误**。无成功案例 |
| "OpenCL hang = 驱动问题，永久弃用" | 根因实为 txt2img 同步阻塞 mqt_v_native → ANR（commit f54e273 已修复）；`GGML_OPENCL_ADRENO_XMEM_GEMM` 环境变量从未设过 | **误判**。hang 非驱动，是架构缺陷；xmem GEMM 路径从未被激活 |

#### 引擎代码层发现：ggml-opencl Adreno 专用优化

vendored stable-diffusion.cpp 的 ggml-opencl 后端（18928 行）包含完整的 Adreno 专用优化：

1. **代际检测**：`ADRENO_GPU_GEN` 枚举（A7X: 730/740/750, A8X: 830/840, X1E），`get_adreno_gpu_gen()` 设备名匹配
2. **Adreno 专用 xmem GEMM**：`kernel_adreno_xmem_pack_src_f32` → `kernel_adreno_xmem_prepack_weight_f16` → `kernel_gemm_xmem_f16_f32_os8` → `kernel_adreno_xmem_store_dst_f32`（外部内存零拷贝管线）
3. **noshuffle 量化内核**：Q4_0/Q4_1/Q5_0/Q5_1/Q4_K/Q5_K/Q6_K/IQ4_NL 全覆盖
4. **阈值门控**：`use_adreno_kernels()` 在 512×512 以上激活（旧编译器 128×128）
5. **环境变量激活**：`GGML_OPENCL_ADRENO_XMEM_GEMM=1` —— **上次测试从未设过**

#### 编译资产确认

| 资产 | 位置 | 状态 |
|---|---|---|
| Khronos OpenCL 头文件（19 个） | `.tmp/opencl/OpenCL-Headers-main/CL/` | 完整 |
| libOpenCL.so（Android arm64 stub, 163KB） | `.tmp/opencl/libOpenCL.so` | 可用 |
| llama.cpp OpenCL 文档 | `.tmp/llmcpp/llama.cpp-master/docs/backend/OPENCL.md` | 完整构建指南 |
| PocketPal 已编译 OpenCL 库 | `librnllama_*_opencl.so`（build intermediates） | 证明构建链可行 |

CMake 选项链：
- `option(SD_OPENCL "sd: opencl backend" OFF)` → `set(GGML_OPENCL ON)`
- `option(GGML_OPENCL_USE_ADRENO_KERNELS ... ON)` —— **默认 ON**
- `option(GGML_OPENCL_EMBED_KERNELS ... ON)` —— **默认 ON**（Python3 编译期嵌入 .cl → .h）

#### 四阶段方案

| 阶段 | 目标 | 动作 | 验证标准 |
|---|---|---|---|
| Phase 0: CPU 保底 | SD3.5 + Z-Image 跑通 | manifest backend → 'CPU' | 真机出图 |
| Phase 1: OpenCL 重测 | 公正验证 OpenCL on Adreno | CMakeLists SD_OPENCL ON + JNI setenv XMEM_GEMM=1 + manifest backend → 'OpenCL' | SDXL Turbo 出图 + SD3.5 出图 |
| Phase 2: 性能榨干 | dispatch/带宽优化 | kernel binary cache + 权重预打包 + workgroup 调优 | 步耗对比 CPU 基线 |
| Phase 3: Vulkan 长期观察 | 待上游修复 | 编译资产保留 dormant，跟踪 ggml-vulkan 上游 mobile 优化 | 一行 SD_VULKAN ON 可重启用 |

#### 本轮代码变更清单

| 文件 | 变更 | 单点决策 |
|---|---|---|
| `docs/POCKETPAL_IMAGE_GEN_UPGRADE_PLAN.md` | 追加 §6.16 | 文档先行 |
| `android/app/src/main/jni/CMakeLists.txt` | SD_VULKAN OFF + SD_OPENCL ON + OpenCL 补链（headers + lib cache） | 编译链切换 |
| `android/app/src/main/jni/thirdparty/OpenCL-Headers/` | 复制 CL/ + libOpenCL.so | 编译资产落地 |
| `android/app/src/main/cpp/ImageGenJNI.cpp` | setenv GGML_OPENCL_ADRENO_XMEM_GEMM=1 + GGML_OPENCL_KERNEL_CACHE_DIR | 运行时激活 |
| `src/utils/imageGenManifest.ts` | backend 'Vulkan' → 'CPU' + 类型加 'OpenCL' | 安全默认 |

**manifest backend 切换路径**：`'CPU'`（当前安全默认）→ `'OpenCL'`（Phase 1 一行切）→ `'Vulkan'`（Phase 3 一行切）。Vulkan 编译资产 dormant 保留，不删除。

**安全网**：异步化修复（commit f54e273）已在位——120s 干净失败机制可公正判定 OpenCL 是否 hang。若 hang，manifest 一行回 'CPU'，零代码风险。

### 6.17 Phase 0/1 真机实测数据与结论（2026-08-15，红米 K90 双后端对比）

#### Phase 0：CPU 后端实测（manifest='CPU'）

**结果：不可实际使用**——SD3.5 512²/10 步，CPU 600% 满载持续 **126 分钟+ 未完成**，零产出（aios_images/ 为空）。

- 模型加载（含 convert）：241s + 170s（两次），条件编码 488.7s，采样 126min+ 未完成
- 结论：CPU 后端仅适合 SDXL Turbo（4 步）/ DreamLite（秒级），SD3.5/Z-Image 需 GPU 加速
- 附带发现：`split prompt "" to 0 tokens`——首次测试 prompt 为空（UI 显示有字但 state 未同步，ComputerUse 剪贴板粘贴后点击时序问题）

#### Phase 1：OpenCL 后端实测（manifest='OpenCL'，xmem GEMM 激活）

**结果：成功出图！** SD3.5 512²/10 步，全链路 **644.69s（10.7 分钟）**：

| 阶段 | 耗时 | 对比 CPU |
|---|---|---|
| 采样 | **320.62s（5.3 分钟）** | CPU 126min+ 未完成 |
| 全链路 | **644.69s（10.7 分钟）** | 提速 11 倍+ |

关键证据：
- `new_sd_ctx OK`（OpenCL）vs 同设备 Vulkan `new_sd_ctx FAILED / ErrorDeviceLost`（多次失败）
- OpenCL 设备识别：`QUALCOMM Adreno(TM) 840 (OpenCL 3.0)`，backend OpenCL 注册成功
- 输出：`gen_1786749463683_418683116.png`（512×512），相册 8→9

#### 本轮代码修正（实测驱动）

| 文件 | 修正 | 原因 |
|---|---|---|
| `android/app/build.gradle` | packagingOptions 排除 libOpenCL.so | 编译期 stub 被误打包进 APK → SoLoader dlopen 失败（依赖 libcutils.so） |
| `src/store/imageGenStore.ts` | 超时窗口：CPU/OpenCL 600s，Vulkan 120s | CPU 实测 2h+ 远超 120s/600s；OpenCL 首次含 kernel 编译需放宽 |
| `src/utils/imageGenManifest.ts` | backend 'CPU' → 'OpenCL' | CPU 实测不可用，OpenCL 实测成功 |

#### 结论

**OpenCL × Adreno 840 实证可用**——互联网调研方向正确（OpenCL 是 Adreno 正确路径），xmem GEMM 激活后采样 5.3 分钟（可接受）。下一步：Z-Image 同法验证 + Phase 2 性能榨干（kernel cache 已设，权重预打包待测）。


---

## §6.18 小米13 Z-Image 四层根因突破 + 设备分级灰置 + LoRA 同步（2026-08-18，本窗口闭环）

### 四层根因（小米13 Z-Image 不可用逐层剥洋葱）

| 层 | 根因 | 处置 | 提交 |
|---|---|---|---|
| 1 | q6_K embedding 升 f32=1483MB > GPU 单次分配 1024MB | f16 修复（742MB）+ 撤 CPU 回退 | c959b9b |
| 2 | HyperOS per-app 内存配额 forceStop（signal 9, from process） | 用户白名单（电池不限制+任务锁定） | 配置 |
| 3 | 计算争抢致主线程 ANR（Input dispatching timed out） | MainActivity 关硬件加速（软件渲染）+ ANR 守护 | bf20ad7 |
| 4 | **Adreno 740 OpenCL 采样驱动级 hang**（GPU 空闲/线程 sleeping/无 fault） | 应用侧无解 → 设备分级灰置 | 47dc804/3ee032b |

对照 K90（Adreno 840）同路径全通 → 第 4 层系驱动/硬件生态差异，非代码缺陷。

### 设备分级灰置（3ee032b）

- Kotlin `getGpuRenderer`（EGL pbuffer 查 GL_RENDERER）→ store.gpuRenderer
- manifest `requiresHighGpu`（Z-Image=true）；下拉行不兼容（非 `Adreno (TM) [89]\d\d`）→ 灰置+加载禁用+[本机不可用]徽章
- 小米13 真机截图实锤灰置生效；探测失败留空=不灰置（锋利不兜底，干净失败机制仍兜底 hang）

### LoRA 同步

- 另一窗口 SD3.5 人体姿态 LoRA 已**合并进 gguf**（2.24GB，665 张量完整），双机同步覆盖
- LoRA 开关方案已简报（A 双模型条目 / B 运行时 loraPath 挂载秒级切换），**开发移交新窗口**

### 本窗口移交清单（→新窗口）

1. LoRA 开关开发（方案 A/B 待大王确认）
2. K90 下拉灰置反向截图复核（逻辑确定性高，未眼见）
3. ANR 根因优化（主线程 input dispatch 阻塞源头，软件渲染为缓解非根治）

### 6.17 全量链路复查闭环（2026-08-18，鸿雁全量审计）

**复查发现并修复（代码回归/哲学违例）**：
1. **useWaveDots/useToast native driver 回归**：任务化重构引入的三点波浪动效用 `Animated.loop + useNativeDriver:true`，违「loop 一律 JS driver」收口规则（07a47ed），分钟级生成全程=weak-ref 累积通路复活。修复：两 hook 全改 JS driver + 规则注释；全仓 `Animated.loop` 恢复零 native driver。
2. **Vulkan→CPU 自动回退重试删除**：imageGenStore.loadModel 的 fallback retry 违单后端铁律，且使 `this.backend` 与真实后端脱钩致超时窗口误判。修复：删除回退，加载失败=干净失败（明确报错+释放）。

**旧标记更正（文档滞后清理，代码已闭环）**：
- §6.12「⏳ 未落地：weak-ref 溢出回归根治」→ ✅ 已被 08-14 三波 + 08-18 回归闭环取代（全 App loop 零 native driver）。
- §6.12「OpenCL hang 根因」→ 被 6.16 决策取代：OpenCL 回归为最终后端（arm64 编译期 ON + manifest 'OpenCL' 单点），Vulkan 挂长期观察（补链路径三处单点保留）。
- 移交清单 1「LoRA 开关开发」→ ✅ 已落地路线 B（运行时 lora 挂载开关，89ccdb0）+ 非 Dream 模型比例档升级；提示词限制改按 token 计（a4e98a6）。
- P6-3/P6-4 维持挂起（产品决策态，非代码缺口）。

**保留的开放性待办（有明确边界，非隐性欠账）**：
- ANR 根因优化（主线程 input dispatch 阻塞；软件渲染为缓解，根治挂长期）；
- 小米 13 Z-Image GPU VRAM 硬件上限（requiresHighGpu 灰置=产品边界决策）；
- RN 上游 weak-ref 修复跟踪（版本升级时消化）。

---

## §6.19 RealESRGAN 通用图像放大能力接入（2026-08-19，本窗口闭环）

### 能力定位

**独立通用图像放大**（不绑定 DreamLite）：任意图片（生成图/上传图/相册照片）2×/4× 放大，模型风格可切换。入口 = ResultPreview 操作条「放大」→ 参数面板 → 进度走任务化 running 页（与生图/编辑 UX 一致）。

### 模型与契约（scripts/aios/export_realesrgan_onnx.py）

- `realesrgan_x4plus.onnx`（RRDBNet, num_block=23, ~63MB fp32，通用写实）；`realesr_animevideov3.onnx`（**SRVGGNetCompact**, num_conv=16, ~2MB，动漫插画）——animevideov3 非 RRDBNet（扁平 body.N + PReLU(64) + PixelShuffle(4)），load_state_dict strict 验证。
- 契约：输入 [1,3,H,W] float32 0-1；输出 [1,3,4H,4W] 范围 **[-1,1]**（anime PReLU 负半轴）→ 端侧必须 clamp 0-1。
- 双模型内置 `android/app/src/main/assets/esrgan/`（APK +65MB，RNFS.copyFileAssets 首次复制 + 版本标记）。

### 链路（引擎/桥/状态/UI）

- `src/services/superResEngine.ts`：tiled 推理（256 tile + 16px overlap → 4× 羽化 64px，仅左/上带降权）；输入解码限长边 1024（保证 4× 中间缓冲 ≤4096，uint8 输出峰值 ~50MB）；2× = 4× 结果 box 下采样；ORT 同 DreamLite（CPU + enableCpuMemArena:false）。
- 桥：`decodeImageForUpscale`（Kotlin）**base64 字节传输**（3.1M 装箱 double 过 bridge 峰值 ~150MB 有 OOM 风险 → 改 ~4MB base64 串 + Hermes atob 解码）；保持宽高比 + inJustDecodeBounds 采样防 OOM。
- 状态：`upscaleImageEntry`（store 单通道）——内存互斥（先释放 DreamLite/SD）→ 加载超分 → tiled 放大 → 任务化条目（kind='upscaled'）；**防重入守卫**（upscaleBusy，防线在 store 不依赖 UI）。
- UI：ResultPreview 操作条四按钮（保存/放大/再次生成/删除）；UpscalePanel 纯参数面板（确认即关，进度不重复展示）。

### 复查修复（啄木鸟，2026-08-19）

1. **engineMutex image releaser 纳入 unloadSuperRes**：放大中切聊天不再内存叠加/并发（超分曾游离于互斥矩阵外）。
2. **bridge 大数组 → base64**：见上（真机 OOM 风险，P0）。
3. **UpscalePanel 精简**：删 busy/progress/stage 死代码（原方案 A/B 混合残留）。
4. **upscale 防重入守卫**：store 层防线。

### 计划漂移说明（实现优于计划，文档同步）

- 计划「输入 >1536 降采样」→ 实现解码限 **1024**（1536×4=6144 > 输出上限 4096，矛盾消除，实现更正确）。
- 计划「新增 upscaleProgress/upscaleStage 字段」→ 实现**复用** progress/stage 单状态机（不分裂状态）。

### 验证

桌面 ORT tiled vs 整图 PSNR 61.25dB（x4plus）/ 52.76dB（anime）无接缝无偏色；tsc/eslint/jest（Panels 17/17）/Gradle assembleProdDebug 全绿；真机装机成功。

### 纯黑根因修复（2026-08-19 追加，啄木鸟）

**现象**：真机放大完成后输出极暗/纯黑图（mean 3.19/255，65% 像素 0），原图正常。

**排查链**：拉取设备输出 PNG 验像素（极暗非全 0）→ 桌面同图复现（非真机问题）→ torch vs ONNX 一致（非导出问题）→ PReLU 独立参数（修了但未解决）→ **获取官方 srvgg_arch.py 对照：SRVGGNetCompact 是残差学习架构，forward 末尾必须 `out += F.interpolate(x, scale_factor=4, mode='nearest')`——漏加 base 时输出只剩接近 0 的残差 → 极暗**。

**修复**：export_realesrgan_onnx.py 补残差连接 + PReLU 改每层独立实例（官方循环内新建）；重导出 ONNX（torch=ORT max diff 0.0，亮度 0.014→0.932）；assets 替换 + ensureSuperResModels 版本标记 .v1→.v2（强制设备重复制，否则装机不覆盖旧模型）。

**教训**：PSNR 只证明 tiled=整图（两者同暗时 PSNR 仍高），**必须检查输出绝对亮度**；架构实现以官方源码为准，勿凭记忆推断；模型文件更新必须联动版本标记。

### 通道序灰色图修复（2026-08-19 再追加，啄木鸟）

**现象**：亮度修复后真机输出仍为灰色（三通道完全相等 161.9/161.9/161.9），且呈格子感；原图彩色（185.7/164.4/125.4）。

**根因**：TS 引擎 blit 把 ORT 输出（NCHW）按 HWC 交错读（`f[(y*ow+x)*3]`）——交错读 NCHW 平面使每像素 R/G/B 取自 channel0 平面相近位置 → 灰色。桌面验证漏网原因：Python 参考版先 transpose 成 HWC 再 blit（与 TS 实现不同构），验证通过但实现错误。

**修复**：blit 按通道平面读 `f[p]/f[plane+p]/f[2*plane+p]`（plane=ow*oh）；验证改用**不对称彩色图**（左红右蓝）判通道（纯均值判据会被对称图/近白图骗过）。

**终验**：桌面左红右蓝图 leftR=254.9/rightB=255.0；真机 DRC 重测输出 RGB mean [189.2,168.8,127.8]（ch-diff 40.9），tile 边界 ratio 0.8-1.07 无格子。

### 全屏预览交互补闭环（2026-08-19→20，3 轮真机复测）

**规格**：点预览图 → 全屏 → 双指缩放（1-4×）/ 拖动平移 / 单击关闭；浅色遮罩（主题 surface ~94%，非纯黑）。

**R1 · 手势全无响应**：RN `<Modal>` 在 Android 是独立原生窗口，App 根 `GestureHandlerRootView` 覆盖不到 → 手势静默失效。修复：ZoomableImage 内部包 `GestureHandlerRootView` 重新 root；遮罩改主题 surface + 'F0'；条件渲染每次打开重置共享值。

**R2 · Worklets 红屏**：reanimated babel 插件自动 worklet 化手势回调 → 跑 UI 线程调普通 JS 函数（onClose setState）抛 non-worklet 错误。修复：pinch/pan onUpdate/onEnd 加 `'worklet'` 指令 + `Math.max/min` 内联；tap 加 `.runOnJS(true)`。

**R3 · 缩放拖动失效**：① `tap.onEnd` 在成功与失败时都触发，未判 `success` → 双指按下/拖动超阈致 tap 失败也误关全屏；② `Exclusive(tap, composed)` 把 tap 放前 → pinch/pan 等 tap 失败才能启动。修复：`tap.onEnd((_e, success) => { if (success) onClose(); })`；Exclusive 顺序改 `(composed, tap)`——官方 PhotoZoom 范式。

**组件**：`src/screens/ImageGenScreen/components/ZoomableImage.tsx` + `ResultPreview.tsx`（全屏 Modal 条件渲染）。

### 遗留

- 真机放大手动验证（生图→放大→参数→进度→结果条目；大图上传放大验证降采样防护）——大王操作，agent 只读旁证。
- 4× 保存阶段 67MB base64 写文件慢（单次操作，性能已知点非断链）。
- **性能实测（2026-08-19 真机 logcat 证据）**：x4plus 单 tile 约 24s（tile 10/25 @ 4 分钟），25 tiles 全量约 10 分钟——CPU 物理上限。产品决策：默认模型改 animevideov3（6-block，快约 4 倍，与 DreamLite 动漫插画风格匹配）；x4plus（通用写实）保留可选并标注耗时。后续若需加速：tile 双 session 并行（收益有限，受总算力约束）或降输入限（输出 <4096 违 4× 语义），暂缓。

### DreamLite 编辑链路最佳实践对齐：TE 视觉通道（2026-08-21）

**复查结论**：编辑出图与源图无关（像新图）根因——① TE 缺视觉通道（export_te_fp16.py 只导出 language_model，官方 edit 模式用 processor 把 512² 源图经 ViT 编码进 prompt_embeds）；② 指令被 128 token 截断（官方 edit 不截断、generate 200）。

**落地（与 diffusers 0.39 官方 pipeline 逐行对齐）**：
- **双段 ONNX 导出**（.tmp/dreamlite/export_te_vision.py + export_te_vision_lm.py）：
  - 	te_vision_visual.onnx（660MB fp16）：pixel_values [1024,1536] patch 数组（16×16 patch × [c][t][py][px]，temporal=2 补帧）→ image_embeds [256,2048]（fp32 输出）；fast_pos_embed 静态化（固定 grid）+ eager attention（SDPA+GQA 无法转换）；**输入契约为 fp32（内部 .half()，与 LM 一致——RN 端只能构造 fp32 tensor）**
  - 	te_vision_lm.onnx（3.29GB fp16）：input_ids + attention_mask + image_embeds + image_grid_thw + **position_ids**（M-RoPE 端侧解析构造，官方 get_rope_index 单图解析式，桌面逐值验证一致）→ hidden_states；固定 seq=520（masked_scatter 依赖使 dynamo 静态化）；patch get_placeholder_mask 校验分支
- **引擎**：editDreamLite 双解码（1024² cond + 512² 视觉）；encodePrompt edit 分支 = 官方模板（含 vision 占位）+ 256 image_pad + 双段前向；MAX_SEQ generate 128→200、edit 520
- **验证**：position_ids 与官方逐值一致 ✓；视觉嵌入 cos 0.99994 ✓；LM 直通 A/B cos 0.999999 ✓（视觉 token 输出 0.65 差异为 fp16 固有放大，端侧自洽）；tsc 零错 + jest 全绿（pre-existing invariants 失败除外）
- **明确不做**：strength/加噪起点（偏离 DMD2 蒸馏分布）、文本描述源图（近似替代）、静默降级

### 真机终局修复：HWC/NCHW 排布错乱 + mask 边界（2026-08-21，端到端验证闭环）

**现象**：链路全通（双段 TE 编码成功、4 步去噪正常）但出图仍与源图无关（桌面同契约三 seed 稳定正确 → 锁定端侧实现）。

**最终根因（两处）**：
1. **原生解码排布错**（ImageGenModule.kt decodeImageToRgb）：返回 **HWC 交错**（每像素 R,G,B 连续），而 vae_encoder 与 buildPixelValues 均按 **NCHW 三平面**（[c][y][x]）读取 → 空间条件（VAE cond）+ 视觉条件（TE 视觉）双通道全部错乱 → 模型只剩文本条件自由发挥（=完全无关新图）。修复：原生改为按通道平面输出（R 平面 → G 平面 → B 平面）。
2. **mask 边界错**（dreamLiteEngine.encodePrompt）：mask/enc 边界用了 `kept`（520-64=456，含 LM 输出的 pad 区 hidden 161 行），官方 prompt_embeds_mask 只标真实 token（real-drop_idx=297）——注意力被 161 个无效 token 污染。修复：边界改 `real-dropIdx`（真实 token），零 pad 区 mask=0。

**排查过程（真机→桌面对照）**：NNAPI EP 数值失真嫌疑（已排除：CPU EP 后仍无关）→ llama.rn 特殊 token 映射嫌疑（已排除：诊断日志 hasVisStart=true、padCnt=256）→ 噪声随机性（已排除：桌面 3 seed 稳定）→ **最终桌面/真机逐段契约比对锁定排布与 mask**。

**终局验证（K90 真机）**：make it snowy → 红苹果保留 + 背景保留 + 雪层添加，与桌面参考图一致 ✓；全流程 ~3.5min（TE 双段 CPU 编码 ~40s + 4 步去噪 ~28s/步）；te_vision_visual/lm 双段定稿 **CPU EP**（NNAPI 曾致数值异常，正确性优先不做设备分支）。

---

## §6.20 放大模型升级与 NNAPI 加速（2026-08-21，A' 定稿闭环）

### 背景

大王问询「放大模型是否已是开源+手机端最好」→ 调研结论：① 通用 x4plus 是移动端开源事实标准（无更好轻量替代）；② 动漫 animevideov3 是**视频级**模型，静态图质量低于官方图片级 x4plus_anime_6B（RRDBNet-6）；③ 部署是最大短板（ORT 纯 CPU，general 2× 实测 126s），项目已有 NNAPI EP 先例（DreamLite TE，K90 -38.5%，三设备闭环）；④ PasSR 官方无公开权重（releases/HF/master 实锤）放弃；⑤ RealCUGAN 新架构适配成本高、社区权重许可不明——均不做（锋利边界）。

### 方案 A'（大王确认）

| 项 | 变更 |
|---|---|
| anime 模型 | animevideov3（SRVGGNetCompact-16, 2.4MB）→ **x4plus_anime_6B**（RRDBNet-6, 17.1MB fp32），同构同契约引擎零适配 |
| general 模型 | x4plus 保持（画质最优官方通用；PasSR 无公开权重） |
| 推理 EP | ['cpu'] → ['nnapi','cpu']（对齐 TE 先例：单配置非设备分支，ORT 标准回退） |
| assets 标记 | .v2 → .v3（强制设备重复制，防 animevideov3 残影） |

### 变更文件

- scripts/aios/export_realesrgan_onnx.py：main() 增 anime_6B 导出（num_block=6）；animevideov3 标注已退役（保留历史对照）
- ndroid/app/src/main/assets/esrgan/：删 
ealesr_animevideov3.onnx，增 
ealesrgan_x4plus_anime_6B.onnx（APK +14.7MB）
- src/services/superResEngine.ts：FILES.anime 换名 + EP 改 ['nnapi','cpu'] + 标记 .v3

### 桌面验证（2026-08-21）

- 导出契约自检：4× 输出形状 ✓；anime_6B 输出范围 [0.543,1.074]（轻微越界，to8 clamp 覆盖）
- 动态轴冒烟：231² / 512×768 / 1×1 全部输出正确、无 NaN（边缘 tile 契约 OK）
- tiled vs 整图 PSNR 62.47dB（>50 判据，无接缝）；绝对亮度 mean=236.8（与 animevideov3 237.6 一致，无黑图回归）
- 质量对照：anime_6B 与 animevideov3 亮度分布一致（std 43.5 vs 42.3），静态图质量官方图片级更优

### 真机验证（DRC，待执行）

- 五关门禁：tsc 零错 ✓ / jest 全绿 / Gradle assembleProdDebug / adb install -r 覆盖安装 / DRC 全链路放大 + NNAPI 收益对照（基线：anime 2× 10.7s / 4× 16.4s / general 2× 126s，小米 13 CPU）
- 风险：NNAPI 对动态 shape（边缘 tile 非 256）支持有限 → ORT 回退 CPU 无副作用；若报错回滚 EP 单点可回滚

### 真机实测修订：双模型可选（2026-08-21 大王定夺）

- **实测数据（小米 13，DRC）**：anime_6B 单 tile ~10s（RRDBNet-6 计算量约为 animevideov3 的 8 倍）→ anime 2× 49.2s / 4× 56.4s；general 2× 133.6s（基线 126s 持平——8 Gen 2 NNAPI 回退 CPU 无副作用，TE 先例同构）
- **决策**：放大面板 anime 拆双档——nime=动漫高清（x4plus_anime_6B）/ nime_fast=动漫快速（animevideov3，快约 4 倍）；SRStyle 三值 + FILES 三件套 + 标记 .v4 + actionRegistry/DRC_SPEC enum 扩展 + UpscalePanel 三选项
- **画质取证**：三档输出全部彩色无黑/灰图回归（anime 2×/4× ch-diff 93-95，与源图一致）；anime_6B 目视细节锐利无伪影

### K90 NNAPI 收益验证闭环（2026-08-21 追加）

**严格同构对照（1024² 25 tiles 2×）**：anime_fast K90 22.3s vs 小米 13 55.4s（2.5×）；anime 高清 K90 67.6s vs 185.0s（2.7×）；general K90 218.5s vs ~370s 外推（~1.7×）——**NNAPI 在 8 Elite 对超分全档生效，conv 密集收益比 TE 更显著**；小米 13 持平（回退 CPU 无副作用）；单配置双设备闭环定稿。画质取证：K90 两档输出 ch-diff 64+ 彩色正常。

### 遗留

- 社区权重/RealCUGAN 立项另议
