---
doc_id: POCKETPAL_AUDIO_UI_SPEC
module: root
type: spec
status: active
version: "1.0"
created: "2026-08-21"
updated: "2026-08-21"
relates: [POCKETPAL_DESIGN_SPEC, POCKETPAL_IMAGEGEN_UI_SPEC, POCKETPAL_MODEL_MATRIX]
---

<!-- D-FORMAT:v3 -->

# PocketPal 音频工坊 UI 设计规范（AUDIO_UI_SPEC）

> 单一事实源：创作工坊「音频工坊」tab 的布局、能力、状态机视觉与交互定稿。
> 任何音频工坊 UI 迭代必须先更新本文档再改代码（文档先行门禁）。
> 版本：v1.1（2026-08-21，P2 第二阶段定稿：sherpa-onnx v1.13.6 官方 android 包本地集成 + AsrModule 原生层）
> 上位规范：POCKETPAL_DESIGN_SPEC.md（UI 域 SSOT）+ POCKETPAL_IMAGEGEN_UI_SPEC.md（工坊 tab 载体）

## 1. 产品定位

**音频工坊 = 离线语音双向工坊**：语音→文字（本地 ASR 转写）、文字→语音（本地 TTS 朗读），全部模型端侧运行，零网络依赖。

- 与聊天页麦克风按钮同源能力（聊天页语音输入走本地 ASR 时复用同一引擎，入口独立）
- 与生图 tab 平级：创作工坊双 tab 之一（路由 ROUTES.IMAGE_GEN 单一入口，不新增 Drawer/设置项）

## 2. 页面结构（次级分段 + 单列三区）

```
┌───────────────────────────────┐
│ [ 转写 ] [ 朗读 ]             │ ← 次级分段（复用 KnowledgeScreen tabBar 样式）
├───────────────────────────────┤
│ ① 结果区（AudioResultView）   │ ← 转写结果卡（任务化 running/success/failed）｜朗读状态（播放中/完成）
├───────────────────────────────┤
│ ② 历史区（TranscriptStrip）   │ ← 转写记录横条（同 HistoryStrip 模式；kind='transcribe' 入画廊）
├───────────────────────────────┤
│ ③ 创作区（AudioComposer）     │ ← 转写：录音按钮 / 选音频文件；朗读：文本输入 + 语音选择 + 朗读按钮
│   底部：模型管理行（下载/试听） │ ← SenseVoice / Kokoro 引擎三态（not_installed/downloading/ready）
└───────────────────────────────┘
```

- 次级分段切换不卸载（keep mounted），转写/朗读状态各自独立
- 创作工坊双 tab 切换同样 keep mounted（IMAGEGEN_UI_SPEC §8）

## 3. 转写能力（ASR）

### 3.1 引擎与模型（P2 第二阶段定稿，2026-08-21）
- 引擎：**sherpa-onnx v1.13.6 官方 android 包本地集成**（`sherpa-onnx-v1.13.6-android.tar.bz2`：jniLibs .so + kotlin-api 源码，Windows 免编译）；RN wrapper（npm registry）实勘不可用（镜像源私有包）→ 不依赖 wrapper，自写 NativeModule `AsrModule`（与 ImageGenModule 同构：ReactContextBaseJavaModule + Package 注册）
- 原生接入：`jniLibs/arm64-v8a/` 落 sherpa .so + kotlin-api（OfflineRecognizer 等 com.k2fsa.sherpa.onnx 类）→ `AsrModule.transcribe(path, promise)` 调 OfflineRecognizer（SenseVoice 非流式，整段转写）
- 输入：wav 16kHz 16-bit PCM（MediaExtractor/MediaCodec 转码兜底：m4a/mp3 → wav）；ASR 引擎只收 wav 路径
- 模型：SenseVoice int8（229MB，中英日韩粤 + 自动语种 + 标点），落盘 `AIOS/audio/`（model.int8.onnx + tokens.txt；无 config.yaml，2026-08-21 真机校准）；下载源：hf-mirror.com 国内镜像（作者 csukuangfj 官方仓库，HF 直连被墙，k2-fsa/sherpa-onnx-models 仓库仅 ascend-npu 专用包无 CPU 散包）
- 调度：按需加载（OfflineRecognizer 单例持有，重复转写复用不重建）；不入 engineMutex 互斥矩阵（<400MB 可共存）

### 3.2 转写任务化（入画廊，与生图/反推任务同管理）
- `kind='transcribe'` 任务条目：running/success/failed 三态 + taskId 持久化
- running：结果区进度卡（三点波浪 + 阶段文本：加载语音模型 → 转写中 → 标点恢复）
- success：转写文本卡（全文可展开）+ 操作条 `复制(绿) 发送到聊天(蓝) 删除(红)`
- failed：复用报错页三按钮（复制报错 / 重试 / 删除）
- 历史横条：transcribe 条目缩略形态 = 语音图标 + 时间 + 「转写」角标

### 3.3 输入源
- 录音：点按录音 → 松手停止 → 自动转写（复用聊天页录音交互心智，RECORD_AUDIO 权限引导）
- 选文件：媒体库音频文件 → 转写（复用 image picker 体系）

## 4. 朗读能力（TTS）

### 4.1 引擎与模型（复用现有 TTS 架构，零重构）
- 三引擎：Kokoro FP32（330MB，默认）/ Kitten（57MB）/ Supertonic（380MB，31 语种）——均已在 src/services/tts + TTSStore
- 语音选择：Kokoro 多音色清单（voices-manifest.json 驱动）；Supertonic 语种/步数参数沿用现有设置
- 可用性门：`isTTSAvailable`（内存 ≥4GB + 用户覆盖）沿用，不重复造

### 4.2 交互
- 文本输入区（复用生图 composer 输入框样式）+ 语音选择行 + 朗读按钮
- 朗读中：结果区播放状态（当前语音波形占位 + 停止按钮）；完成后可重播
- 试听：模型管理行每个引擎「试听」按钮（TTS_PREVIEW_SAMPLE 文案）

## 5. 聊天页联动（同源能力，入口独立）

- 聊天页麦克风按钮：本地 ASR 模型已下载 → 走本地识别（离线）；未下载 → 维持现状（系统 Voice，渐进能力非兜底）
- 聊天回复朗读（流式）：TTSStore 现有 onAssistantMessageStart/Chunk/Complete 链路，音频工坊仅提供模型下载/管理入口

## 6. 状态机视觉

- 进度指示：三点波浪呼吸动效（错峰 150ms，JS driver，与生图页同设计语言）
- overlay 设计语言：浅色圆角（与卡片统一），禁用黑色直角矩形
- 失败页：⚠ 图标 + 摘要 + 复制报错 / 重试 / 删除（与生图 failed 任务页同规格）

## 7. 约束（实现红线）

- Screen 层零直连原生引擎，全部经 audioStore 单通道（ASR/TTS 收编）
- 新色值必须登记本文档（沿用语义色体系：复制绿 #2e7d32 / 发送蓝 #1565c0 / 删除红 #c62828）
- 模型文件：ASR 落 `AIOS/audio/`（MODEL_MATRIX §7 管辖）；TTS 沿用 `tts/` 目录（TTSStore 管辖，不双轨）
- testID 稳定：audio-record / audio-pick / audio-speak / audio-copy 等，e2e 依赖不变
- 不做：音乐生成、音效合成、多轨混音（产品边界，未来再议）
