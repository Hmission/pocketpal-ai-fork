---
doc_id: DEVICE_DEPLOYMENT_SOP
module: sop
type: sop
status: active
version: "1.0"
created: "2026-08-20"
updated: "2026-08-20"
relates: [POCKETPAL_MODEL_MATRIX, DOC_MANAGEMENT]
---

<!-- D-FORMAT:v3 -->

# 小黄鸡真机部署 · SOP（Device Deployment Operations）

**状态**：active | **版本**：1.0 | **更新**：2026-08-20

> **定位**：新设备/换机全量装机操作手册。铁律：**以旧机 `ls` 输出为黄金标准逐项核对，不得凭记忆/部分文件猜测**（2026-08-20 红米平板漏推 dreamlite 事故定规）。

## 一、装机清单（黄金标准 = 小米 13 / 66b1777f，2026-08-20 实测）

### 1.1 `/sdcard/Documents/AIOS/models/` — 18 文件

| # | 文件名 | 字节 | 母仓源路径 |
| --- | --- | --- | --- |
| 1 | Qwen3.5-2B-Uncensored-HauhauCS-Aggressive-Q8_0.gguf | 2012012000 | `F:\Cursor\OneTakeMVP\models\pocketpal_hf\HauhauCS__Qwen3.5-2B-...\` |
| 2 | mmproj-Qwen3.5-2B-Uncensored-HauhauCS-Aggressive-f16.gguf | 668226688 | 同上目录 |
| 3 | Qwen3.5-4B-Uncensored-HauhauCS-Aggressive-Q4_K_M.gguf | 2707513696 | `...\HauhauCS__Qwen3.5-4B-...\` |
| 4 | mmproj-Qwen3.5-4B-Uncensored-HauhauCS-Aggressive-BF16.gguf | 675568768 | 同上目录 |
| 5 | LFM2.5-2.6B-Q4_K_M.gguf | 1674454848 | `...\LiquidAI__LFM2.5-2.6B-GGUF\` |
| 6 | LFM2.5-8B-A1B-Q4_K_M.gguf | 5155564768 | `...\LiquidAI__LFM2.5-8B-A1B-GGUF\` |
| 7 | Ministral-3-3B-Instruct-2512-Q4_K_M.gguf | 2146497824 | `...\unsloth__Ministral-3-3B-Instruct-2512-GGUF\` |
| 8 | ae.safetensors | 335304388 | `F:\pp\.tmp\models_sd\` |
| 9 | lora_humanpose.safetensors | 83138888 | `F:\pp\.tmp\models_sd\`；**2026-08-20 起 catalog 在线可下载（双源：HF/魔搭 zensignGG/SD35-HumanPose-LoRA）** |
| 10 | minicpm5_1b_heretic_q4km.gguf | 688066528 | `F:\pp\.tmp\models_sd\` |
| 11 | qwen3_06b_q8_0.gguf | 639446688 | **未选型（MODEL_MATRIX §3 禁止推送）**——真机残留，装机勿推，清理待钦定 |
| 12 | sd35_clip_g.safetensors | 1389382176 | `F:\pp\.tmp\models_sd\` |
| 13 | sd35_clip_l.safetensors | 246144152 | `F:\pp\.tmp\models_sd\` |
| 14 | ~~sd35_medium_humanpose_baked.gguf~~ | ~~2238995904~~ | **不装机（大王钦定 2026-08-20）：baked/merged GGUF 真机未部署，不分发不建条目**；母仓存留 `sd35_lora_merged.gguf` |
| 15 | sd35_medium_q4_k_m.gguf | 1787064768 | `F:\pp\.tmp\models_sd\` |
| 16 | sd35_vae.safetensors | 167666902 | `F:\pp\.tmp\models_sd\` |
| 17 | z_image_turbo_q4_k.gguf | 3864250304 | `F:\pp\.tmp\models_sd\` |
| 18 | zimage_llm.gguf | 2497281312 | `F:\pp\.tmp\models_sd\` |

### 1.2 `/sdcard/Documents/AIOS/dreamlite/` — 10 文件（**必推，非可选**）

| # | 文件名 | 字节 | 母仓源路径 |
| --- | --- | --- | --- |
| 1 | te_fp16.onnx | 5069907 | `F:\pp\.tmp\dreamlite\onnx\` |
| 2 | te_fp16.onnx.data | 3441164288 | `F:\pp\.tmp\dreamlite\onnx\` |
| 3 | te_int8.onnx | 1725148055 | `F:\pp\.tmp\dreamlite\onnx\` |
| 4 | te_q8.gguf | 1834427328 | `F:\pp\.tmp\dreamlite\te\` |
| 5 | unet.onnx | 1561703845 | `F:\pp\.tmp\dreamlite\onnx\unet_dyn.onnx` **改名** |
| 6 | unet_fp16.onnx | 782363583 | `F:\pp\.tmp\dreamlite\onnx\` |
| 7 | unet_masked.onnx | 1561735173 | `F:\pp\.tmp\dreamlite\onnx\` |
| 8 | unet_masked_fp16.onnx | 781865120 | `F:\pp\.tmp\dreamlite\onnx\` |
| 9 | vae_decoder.onnx | 4912510 | `F:\pp\.tmp\dreamlite\onnx\` |
| 10 | vae_encoder.onnx | 4910603 | `F:\pp\.tmp\dreamlite\onnx\` |

### 1.3 其余目录

- `config / database / drc / logs / memories / workspace` 等：App 首启 `ensureAiosDirs()` 自动创建，**无需推送**。
- 旧机调试残留（`drc_big_test.png`、`imagegen_debug.log` 等）：不推。

## 二、装机步骤

1. **设备在线**：`adb devices` 确认新设备 serial。
2. **装 APK**：`adb -s <serial> install -r F:\pp\android\app\build\outputs\apk\prod\release\app-prod-release.apk`；验证 `dumpsys package com.pocketpalai | grep lastUpdateTime`。
3. **建目录**：`adb -s <serial> shell mkdir -p /sdcard/Documents/AIOS/models /sdcard/Documents/AIOS/dreamlite`。
4. **推 models**：`powershell -ExecutionPolicy Bypass -File F:\pp\.tmp\push_models_pad.ps1`（改脚本内 `$SERIAL`；约 27GB / 13 分钟）。
5. **推 dreamlite**：`powershell -ExecutionPolicy Bypass -File F:\pp\.tmp\push_dreamlite_pad.ps1`（约 12.6GB / 6-8 分钟）。
6. **授权「所有文件访问」**（新设备必做，否则 App 读不到共享目录 → 模型列表空 + DreamLite 报 File doesn't exist）：
   `adb -s <serial> shell am start -a android.settings.MANAGE_APP_ALL_FILES_ACCESS_PERMISSION -d package:com.pocketpalai` → 系统专用页点「授予管理所有文件的权限」。
   - 勿用 `appops set ... allow`（PackageManager 层不生效）。
   - HyperOS 应用详情权限页不显示此项，必须走专用页。
7. **重启 App**，授权后冷启动生效。

## 三、终验（缺一不可）

| 检查点 | 方法 | 期望 |
| --- | --- | --- |
| 文件完整 | `adb -s <serial> shell ls -la /sdcard/Documents/AIOS/models/ /sdcard/Documents/AIOS/dreamlite/` | 28 文件字节与上表一致 |
| 聊天链路 | App 聊天页顶部胶囊 → 选 LLM → 发消息 | 模型列表非空（5 LLM + 2 mmproj 配对），回复正常 |
| 生图链路 | 生图页选 DreamLite → 输入 prompt 出图 | TE 编码日志 `seq=` 出现 + PNG saved，无 File doesn't exist |

## 四、事故教训（2026-08-20 红米平板）

- 漏推 `dreamlite/` 10 文件（只推了 models/）→ 生图页加载 DreamLite 报 `unet_masked.onnx File doesn't exist`。
- 根因：推送范围凭部分记忆，未 dump 旧机完整 AIOS 目录树做差异基线。
- 定规：**换机装机第一步 = 旧机 `ls -la /sdcard/Documents/AIOS/` + 双目录 `ls` 清单核对**，与本文 1.1/1.2 逐项比对后再执行。
