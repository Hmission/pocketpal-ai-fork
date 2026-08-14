# PocketPal 模型选型唯一事实源（MODEL_MATRIX）

> **本清单是装机/推送的唯一准入口令**：只允许推送「入选清单」内的模型文件。
> 「淘汰/未选型」清单内的一切模型**禁止推送**（含任何窗口、任何理由）。
> 新增模型必须大王钦定 → 先更新本清单 → 才允许推送（文档先行）。
> 定稿：2026-08-14（大王钦定，基于 P4 选型铁律 + P5.1 生图钦定，见 MASTER_LOG §4/§12）

## 1. LLM 入选清单（7 件，含伴侣）

| # | 模型 | 文件 | 量化 | 大小 | 定位 |
|---|---|---|---|---|---|
| 1 | Qwen3.5-2B 无限制 | `Qwen3.5-2B-Uncensored-HauhauCS-Aggressive-Q8_0.gguf` | Q8_0 | 2.01 GB | 写作/聊天主力 |
| 2 | Qwen3.5-2B 视觉伴侣 | `mmproj-Qwen3.5-2B-...-f16.gguf` | f16 | 0.67 GB | 多模态（配对 #1） |
| 3 | Qwen3.5-4B 无限制 | `Qwen3.5-4B-Uncensored-HauhauCS-Aggressive-Q4_K_M.gguf` | Q4_K_M | 2.71 GB | 日用 |
| 4 | LFM2.5-2.6B | `LFM2.5-2.6B-Q4_K_M.gguf` | Q4_K_M | 1.67 GB | 任务/工具调用 |
| 5 | LFM2.5-8B-A1B | `LFM2.5-8B-A1B-Q4_K_M.gguf` | Q4_K_M | 5.16 GB | MoE 大模型（激活 ~1.5B） |
| 6 | Ministral-3-3B | `Ministral-3-3B-Instruct-2512-Q4_K_M.gguf` | Q4_K_M | 2.15 GB | 代码 |
| 7 | MiniCPM5-1B 管家 | `minicpm5_1b_heretic_q4km.gguf` | Q4_K_M | ~0.69 GB | 常驻管家（prompter） |

## 2. 生图入选清单（3 件）

| # | 模型 | 说明 | 定位 |
|---|---|---|---|
| 1 | DreamLite（小黄鸡端侧） | App 内置 manifest，非文件 | **主线主力**（固定置顶默认选中） |
| 2 | SD 3.5 Medium | DiT + clip_l/clip_g/vae 四件套 | 🥇 画质升级 |
| 3 | Z-Image-Turbo | DiT + zimage_llm + ae 三件套 | 🥈 中文场景 + 无审查 |

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

- **LLM 已装 7 件**：Qwen3.5-2B Q8_0(+mmproj) / 4B Q4_K_M / LFM2.5-2.6B / LFM2.5-8B-A1B / Ministral-3-3B / MiniCPM5-1B 管家 ✓（全部入选清单）
- **生图已装**：SD3.5 四件套 ✓ + Z-Image 三件套 ✓ + **DreamLite 端侧 ONNX 三件套**（`AIOS/dreamlite/`：unet_masked.onnx 1.56GB + vae_decoder + vae_encoder，08-14 补推）✓
- **已清理（08-14 执行）**：`sd_xl_turbo_1.0_fp16.safetensors`（淘汰 SDXL，-6.9GB）+ `qwen3_06b_q8_0.gguf`（未选型 0.6B，-0.64GB）——真机目录现仅剩入选清单文件 ✓
