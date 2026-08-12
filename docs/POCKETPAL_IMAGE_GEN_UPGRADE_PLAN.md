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
| P6-3 | 下载 SDXL-Lightning 4-step + SDXL-base Q4，建快+好 SDXL 选项 | ⏳ |
| P6-4 | 引 MNN 引擎 + SANA 端侧（新引擎，全都要） | ⏳ |
| P6-5 | DreamLite 接入（manifest 声明+RN 架构先行） | ⏳ 见 6.3 |

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
- 待大王手动点“DreamLite 基线”验证端侧 ORT 出图（RN 应用 adb input tap 不生效，需手点）。

**阻断项（需外部条件）**：
- unet 780MB 走 hf-mirror 带宽不足（~0.1MB/s），续传中；GitHub 仓库 zip 被墙（仅部分 raw 可取）。
- TE=Qwen3-VL 4.25GB，端侧需 4-bit GGUF + llama.rn hidden-states 提取，待验证。
- MNN Android 编译 + 真机验证待 ONNX 导出件就绪。
