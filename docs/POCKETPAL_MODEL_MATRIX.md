---
doc_id: POCKETPAL_MODEL_MATRIX
module: root
type: spec
status: active
version: "1.0"
created: "2026-08-14"
updated: "2026-08-15"
relates: [POCKETPAL_DESIGN_SPEC]
---

<!-- D-FORMAT:v3 -->

# PocketPal 模型选型唯一事实源（MODEL_MATRIX）

> **本清单是装机/推送的唯一准入口令**：只允许推送「入选清单」内的模型文件。
> 「淘汰/未选型」清单内的一切模型**禁止推送**（含任何窗口、任何理由）。
> 新增模型必须大王钦定 → 先更新本清单 → 才允许推送（文档先行）。
> 定稿：2026-08-14（大王钦定，基于 P4 选型铁律 + P5.1 生图钦定，见 MASTER_LOG §4/§12）

## 1. LLM 入选清单（7 件，含伴侣）

| # | 模型 | 文件 | 量化 | 大小 | 定位 |
|---|---|---|---|---|---|
| 1 | Qwen3.5-2B 无限制 | `Qwen3.5-2B-Uncensored-HauhauCS-Aggressive-Q8_0.gguf` | Q8_0 | 2.01 GB | 写作/聊天主力 |
| 2 | Qwen3.5-2B 视觉伴侣 | `mmproj-Qwen3.5-2B-Uncensored-HauhauCS-Aggressive-f16.gguf` | f16 | 0.67 GB | 多模态（配对 #1） |
| 3 | Qwen3.5-4B 无限制 | `Qwen3.5-4B-Uncensored-HauhauCS-Aggressive-Q4_K_M.gguf` | Q4_K_M | 2.71 GB | 日用 |
| 4 | Qwen3.5-4B 视觉伴侣 | `mmproj-Qwen3.5-4B-Uncensored-HauhauCS-Aggressive-BF16.gguf` | BF16 | 0.67 GB | 多模态（配对 #3；2026-08-20 补登，SOP 实测在机） |
| 5 | LFM2.5-2.6B | `LFM2.5-2.6B-Q4_K_M.gguf` | Q4_K_M | 1.67 GB | 代码/玩具匠（工具调用优化，低延迟） |
| 6 | LFM2.5-8B-A1B | `LFM2.5-8B-A1B-Q4_K_M.gguf` | Q4_K_M | 5.16 GB | MoE 大模型（激活~1.5B）；K90 PSS 看护硬杀不可用（2026-08-19 实证） |
| 7 | Ministral-3-3B | `Ministral-3-3B-Instruct-2512-Q4_K_M.gguf` | Q4_K_M | 2.15 GB | 代码候选（均衡档） |
| 8 | MiniCPM5-1B 管家 | `minicpm5_1b_heretic_q4km.gguf` | Q4_K_M | ~0.69 GB | 常驻管家（prompter） |

> **代码化清单（2026-08-20）**：`src/utils/modelCatalog.ts` 的 `CATALOG_LLM` 为本表唯一代码事实源
> （模型页全部可管理：未下载显示下载按钮，无源条目显示「请本地导入」→ 模型目录页）。
> 在线规则已退役（§54 决策）：不再拉取上游 device-rules；代码层已切除（§57 执行：
> resolvePresetModels/deviceRules 服务目录/bundledDeviceRules JSON/rulesVersion 整条死链删除）。
> 下载源显式声明（2026-08-20 魔搭 API 实测）：`sources: ['hf']` = 仅 Hugging Face；
> `['hf','modelscope']` = 双源（下载时弹窗选择）。
> - **双源**：#5 LFM2.5-2.6B、#6 LFM2.5-8B-A1B、#7 Ministral-3-3B（魔搭同名同文件镜像已验 200）
> - **仅 HF**：#1-#4 Qwen3.5×2（HauhauCS 魔搭 404 无镜像）、#8 MiniCPM5-1B 管家
>   （2026-08-20 实锤：GGUF 头部元数据对比 license apache-2.0 + base_model openbmb/MiniCPM5-1B
>   全同 → 源为 mradermacher/MiniCPM5-1B-Claude-Opus-Fable5-V2-Thinking-heretic-GGUF 的
>   Q4_K_M（远程名 MiniCPM5-1B-Claude-Opus-Fable5-V2-Thinking-heretic.Q4_K_M.gguf，本地为
>   早期版本差 1152 字节，落盘名映射）；注意 mradermacher/MiniCPM5-1B-heretic-GGUF 是
>   K0D3IN base heretic（license agpl-3.0）非 Fable5，勿混；魔搭无镜像）

## 1.1 任务选型优先级（2026-08-20，listModelsForTask）

任务（write/code/play，adventure 归 write，play 归 code）选型返回候选列表，排序：

1. **用户用途标签命中**（设置页打的 capabilities 标签，write 同义键 rewriting/creativity/instructions）——组内 size 降序；
2. **文件名指纹**（本清单定稿：write→`qwen3.5[-_ ]?[24]b`，code→`lfm2[.\-]?5[-_ ]?2[.\-]?6b`——2026-08-19 大王钦定终局代码/玩具匠=LFM2.5-2.6B；LFM8B 超 K90 PSS 看护线硬杀退出代码位）——排除已入标签组；
3. **其余本地模型** size 降序兜底（越大越强）。

排除：管家模型（prompter 常驻槽）/ projection / 远程模型。候选首项 = 推荐项；弹窗多候选由用户单选（PRODUCT_SPEC §4.9）。

## 2. 生图入选清单（3 件）

| # | 模型 | 说明 | 定位 |
|---|---|---|---|
| 1 | DreamLite（小黄鸡端侧） | App 内置 manifest，非文件 | **主线主力**（固定置顶默认选中） |
| 2 | SD 3.5 Medium | DiT + clip_l/clip_g/vae 四件套 | 🥇 画质升级 |
| 3 | Z-Image-Turbo | DiT + zimage_llm + ae 三件套 | 🥈 中文场景 + 无审查 |

> **代码化清单（2026-08-20）**：`src/utils/modelCatalog.ts` 的 `CATALOG_IMAGEGEN` 为本表代码事实源
> （套件文件清单与 §6.1/§6.2 一致；模型页「生图模型」区可管理）。
> 下载源（2026-08-20 溯源 + 魔搭 resolve 实测 7/7 全 200，非自制）：
> - **SD 3.5 四件套**：双源。main 来自 city96/stable-diffusion-3.5-medium-gguf
>   （远程名 `sd3.5_medium-Q4_K_M.gguf`）；clip_l/clip_g 来自 Comfy-Org（HF）/AI-ModelScope（魔搭）
>   stable-diffusion-3.5-fp8 的 `text_encoders/` 子目录；vae 来自 stabilityai（HF）/AI-ModelScope（魔搭）
>   stable-diffusion-3.5-medium 的 `vae/` 子目录——跨仓套件按文件声明 repo/远程路径
> - **Z-Image-Turbo 三件套**：双源。main 来自 leejet/Z-Image-Turbo-GGUF（远程名 `z_image_turbo-Q4_K.gguf`）；
>   ae 来自 Comfy-Org/z_image_turbo 的 `split_files/vae/`；zimage_llm 文本塔仅魔搭
>   （unsloth/Qwen3-4B-GGUF，HF 侧文件名不同未验证——选 HF 源时自动回退魔搭下载）
> - **DreamLite**：部署 ONNX 为自制导出（.tmp/dreamlite 本地导出+量化），HF 无公开 ONNX →
>   模型页显示「请本地导入」→ 跳模型目录页；原始权重（safetensors）来自作者官方仓库
>   carlofkl/DreamLite-mobile（2026-08-20 hf-mirror 逐字节验证：unet 780074688 / vae 4903270 /
>   te 4255140312 与本地 ckpt 全一致）——但 App 生图引擎需要 ONNX 非 safetensors，不开下载

## 3. 淘汰 / 未选型清单（禁止推送 ❌）

| 模型 | 状态 | 原因 / 记录 |
|---|---|---|
| SDXL Turbo | **淘汰** | P5.1 仅作对照（🥉"不换，作对照"），对照使命已完成；fp16 6.9GB 违反 3GB 红线铁律 |
| Qwen3.5-0.6B（qwen3_06b_q8_0） | **未选型** | 不在 P4 五件套内，型号未钦定 |
| Qwen3.5-9B 全家桶 | **电脑端弹药（勿动）** | 仅本仓库 API/质检链路用，禁止推送真机 |

> **勘误（2026-08-14）**：早前版本曾登记 "DeepSeek Hermes 未选型/叫停"——错误。
> 并行窗口的「安装 DeepSeek Hermes」是**别仓任务，与本仓库（f:\pp）无关**，
> 不属于本清单管辖范围，已撤回该登记。本清单只管 PocketPal 二开仓的装机推送。

## 4. 推送门禁（强制）

1. 推送前必须核对 §1/§2 文件名精确匹配；清单外一律拒绝。
2. 删除文件（清理淘汰模型）也必须大王钦定后执行，并同步更新本清单。
3. 任何窗口/任何 agent 执行装机推送，先读本文件；违规推送 = 严重事故。
4. 本清单变更必须登记 MASTER_LOG（版本 + 日期 + 大王钦定依据）。
5. **管辖边界：本清单只管 PocketPal 二开仓（f:\pp）的装机推送**；别仓/别窗口的任务不评价、不登记、不叫停。

## 5. 真机现状（2026-08-14 清理后）

## 5.1 LLM 与生图隔离（2026-08-14 新增）

- **聊天模型列表只显示 LLM**：`modelType === LLM` 且文件名不在 `IMAGE_GEN_MODEL_FILES`（imageGenManifest 导出的生图 main+companions 文件集合）；`scanLocalModels` 不把生图文件注册为 LLM，`isChatSelectable` 兜底存量。
- **生图模型只在生图页下拉显示**（manifest 驱动，与 LLM 列表完全隔离）。
- 新增生图模型：main/companions 文件名必须进 `BUILTIN_MANIFESTS`（自动进过滤集）。
- 装机核对时：models/ 下生图文件（sd35_medium 等）**不会**出现在聊天模型列表属正常。

## 6. 装机 SOP（备用机黄金标准核对 · 2026-08-14 定稿）

> **测试员分发包（2026-08-18，开发者预览版）**：仓库根 `pocketchick-preset-models-*.zip`（store 模式，内含 `models/` 14 件 + `dreamlite/` 6 文件 + TESTER_GUIDE.md），清单与本文件 §1/§2 入选名单逐一同步；解压落 `/sdcard/Documents/AIOS/{models,dreamlite}/`。淘汰件禁入包内（门禁同推送规则）。
>
> **电脑端模型源（2026-08-15 定稿）**：装机/补推模型文件的唯一电脑端源 = `F:\Cursor\OneTakeMVP\models\pocketpal_hf\`（HF 缓存目录，`author__repo` 结构）。
>
> | 模型 | 源路径 |
> |---|---|
> | Qwen3.5-2B + mmproj-2B | `HauhauCS__Qwen3.5-2B-Uncensored-HauhauCS-Aggressive\` |
> | Qwen3.5-4B + mmproj-4B | `HauhauCS__Qwen3.5-4B-Uncensored-HauhauCS-Aggressive\` |
> | LFM2.5-2.6B | `LiquidAI__LFM2.5-2.6B-GGUF\LFM2.5-2.6B-Q4_K_M.gguf` |
> | LFM2.5-8B-A1B | `LiquidAI__LFM2.5-8B-A1B-GGUF\LFM2.5-8B-A1B-Q4_K_M.gguf` |
> | 小雾 3B（Ministral-3-3B） | `unsloth__Ministral-3-3B-Instruct-2512-GGUF\Ministral-3-3B-Instruct-2512-Q4_K_M.gguf` |
> | MiniCPM5-1B 管家 | `f:\pp\.tmp\models_sd\minicpm5_1b_heretic_q4km.gguf` |
>
> 源文件大小与 §6.1 逐字节一致（2026-08-15 双机补推已核对）；推送后以真机 `ls -la` 复验。
> 2026-08-15 实录：小米13 曾缺 LFM×2 + 小雾 3B，已从该源 USB 补推，双机对齐。

> 以备用机（做过完整部署）为黄金标准逐项核对，新机装机后必须与本清单完全一致。

**核对命令**：`adb shell "ls -la /sdcard/Documents/AIOS/models/"` + `adb shell "ls -la /sdcard/Documents/AIOS/dreamlite/"`

### 6.1 models/ 必须 14 个文件（LLM 7 + 生图 7）

| 文件 | 大小 | 类别 |
|---|---|---|
| Qwen3.5-2B-Uncensored-...-Q8_0.gguf | 2.01 GB | LLM |
| mmproj-Qwen3.5-2B-...-f16.gguf | 0.67 GB | LLM 视觉伴侣 |
| Qwen3.5-4B-Uncensored-...-Q4_K_M.gguf | 2.71 GB | LLM |
| LFM2.5-2.6B-Q4_K_M.gguf | 1.67 GB | LLM |
| LFM2.5-8B-A1B-Q4_K_M.gguf | 5.16 GB | LLM |
| Ministral-3-3B-...-Q4_K_M.gguf | 2.15 GB | LLM |
| minicpm5_1b_heretic_q4km.gguf | 0.69 GB | LLM 管家 |
| sd35_medium_q4_k_m.gguf | 1.79 GB | 生图 SD3.5 DiT |
| sd35_clip_l.safetensors | 0.25 GB | 生图 SD3.5 |
| sd35_clip_g.safetensors | 1.39 GB | 生图 SD3.5 |
| sd35_vae.safetensors | 0.17 GB | 生图 SD3.5 |
| z_image_turbo_q4_k.gguf | 3.86 GB | 生图 Z-Image |
| zimage_llm.gguf | 2.50 GB | 生图 Z-Image TE |
| ae.safetensors | 0.34 GB | 生图 Z-Image VAE |

### 6.2 dreamlite/ 必须 6 个文件（含 TE，真实文本条件）

| 文件 | 大小 | 说明 |
|---|---|---|
| unet_masked.onnx | 1.56 GB | UNet（fp32，带 attention_mask） |
| vae_decoder.onnx | 4.9 MB | VAE 解码 |
| vae_encoder.onnx | 4.9 MB | VAE 编码（编辑路径） |
| te_q8.gguf | 1.83 GB | TE tokenizer（vocab，llama.rn 加载） |
| te_fp16.onnx (+te_fp16.onnx.data) | 3.44 GB | TE fp16 ONNX（真实文本条件 hidden_states） |

> **TE 必推**：用户输入 prompt 出图时引擎按 `if (prompt) loadTE()` 加载 TE——缺 te_q8.gguf 报 `unable to load model: te_q8.gguf` → UI 显示「DreamLite: Failed to load model」。
> 08-14 新机曾因只推 3 件漏 TE 而报错，补推后完整出图（TE 编码 seq=67 → 4 步 → PNG）。
> 电脑端源：`.tmp/dreamlite/te/te_q8.gguf` + `.tmp/dreamlite/onnx/te_fp16.onnx(.data)`。

### 6.3 目录结构（App 首次运行自建，无需推送）

`AIOS/{config(空), database, memories, models, workspace/{AGENTS,MEMORY,SOUL,USER.md + conversations/ + memory/}, dreamlite}`

### 6.4 换机装机铁律

1. 换机后逐项核对 §6.1/§6.2 文件清单（ls + 大小匹配），缺一即补。
2. **不得凭记忆/凭部分文件猜测**——以备用机 ls 输出为唯一对照基线。
3. 补推顺序：LLM 五件套 → 生图 SD3.5/Z-Image → DreamLite 三件套 → 终验双目录 ls。
4. 装机后打开生图页验证 DreamLite 可加载（不再报 File doesn't exist）。
5. **Android 11+ 存储授权（EACCES 13 根因）**：换机后必须给 App 授予「所有文件访问」（MANAGE_EXTERNAL_STORAGE），否则 App 读 /sdcard/Documents/AIOS 报 system error number 13，模型列表空、出图失败。
   - **正确授予方式（双机验证有效）**：`adb shell am start -a android.settings.MANAGE_APP_ALL_FILES_ACCESS_PERMISSION -d package:com.pocketpalai` → 点「授予管理所有文件的权限」。
   - HyperOS 应用详情权限页不显示此权限项，勿用 `appops set`（状态显示 allow 但 PackageManager 层未生效）；授予后 App 重启即生效（RNLlama/DreamLite 加载日志可证）。
   - 备用机 08-14 10:48 授权、新机 08-14 16:14 授权后均恢复正常读取。
6. 双机对照结论（2026-08-14）：两机系统/App/appops/gids 全一致；差异仅在授权时间；**/proc/pid/root 读文件测试为假阴性（shell 借 mount namespace 无权限），不可用作判断**。



- **LLM 已装 7 件**：Qwen3.5-2B Q8_0(+mmproj) / 4B Q4_K_M / LFM2.5-2.6B / LFM2.5-8B-A1B / Ministral-3-3B / MiniCPM5-1B 管家 ✓（全部入选清单）
- **生图已装**：SD3.5 四件套 ✓ + Z-Image 三件套 ✓ + **DreamLite 端侧 ONNX 三件套**（`AIOS/dreamlite/`：unet_masked.onnx 1.56GB + vae_decoder + vae_encoder，08-14 补推）✓
- **已清理（08-14 执行）**：`sd_xl_turbo_1.0_fp16.safetensors`（淘汰 SDXL，-6.9GB）+ `qwen3_06b_q8_0.gguf`（未选型 0.6B，-0.64GB）——真机目录现仅剩入选清单文件 ✓
