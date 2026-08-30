---
doc_id: POCKETPAL_AUDIO_UI_SPEC
module: root
type: spec
status: active
version: "1.8"
created: "2026-08-21"
updated: "2026-08-25"
relates: [POCKETPAL_DESIGN_SPEC, POCKETPAL_IMAGEGEN_UI_SPEC, POCKETPAL_MODEL_MATRIX]
---

<!-- D-FORMAT:v3 -->

# PocketPal 音频工坊 UI 设计规范（AUDIO_UI_SPEC）

> 单一事实源：创作工坊「音频工坊」tab 的布局、能力、状态机视觉与交互定稿。
> 任何音频工坊 UI 迭代必须先更新本文档再改代码（文档先行门禁）。
> 版本：v1.2（2026-08-22 裁定收敛：录音输入/产物重生成登记 B33 批次（不扩面）；Supertonic 语种选择删条——sherpa-onnx 自动语种检测已覆盖，不留半吊子入口）
> 版本：v1.3（2026-08-22 B33 闭环落地）：① 录音输入实现——AudioRecordModule（AudioRecord PCM16 16kHz mono 直采 → 手写 WAV 头，MediaRecorder 不支持 wav 容器），工坊「录音转写」按钮（点按开始/再点停止自动转写）+ 聊天页本地 ASR 共用；② 产物卡新增「重生成」（复用产物 prompt 复跑当前引擎/音色，对齐生图页「再次生成」）；③ 生成输入框单行视觉（minHeight 44 / maxHeight 88，原 72 双行易误解）；④ 转写段历史横条移除（纯展示无功能，画廊已有历史）；⑤ 空态文案「暂无音频产物，输入文本后点生成音频」（原「输入文本开始生成音频文件」像输入框）
> 版本：v1.4（2026-08-22 B35 大王裁定，替代 v1.3 ④）：① 转写段历史横条**恢复为横向滚动条**（大王：生图相册横排滚动逻辑现成不用是失误；转写/生成两段各自隔离，只列本段 kind，点按复制/播放）；② 引擎选择（Kokoro/Supertonic/Kitten）**移出高级参数卡 → 顶栏胶囊**（对齐生图页「模型只在顶栏」，高级参数只留音色/速度/步数）；③ 转写结果卡对齐生图反推卡——默认 3 行折叠 + 点击展开全文 + 操作条补「删除」按钮（复制/发送到聊天/删除 三按钮齐）
> 版本：v1.5（2026-08-22 B36 大王复查，全面对齐生图 tab）：① **引擎选择弃 Menu → 复用生图 ModelPicker 屏级 overlay 交互**（dropOverlay/dropBackdrop/dropPanelAbs + 行内动作，消灭同页双交互模式；行内动作 = 未就绪「下载」/ 就绪「删除」，store 能力现成）；② **结果区升级整卡三态**（对齐生图 taskPage 语义：running = 三点波浪进度卡（复用 useWaveDots）/ success = 全文卡 / failed = ⚠ 摘要 + 复制报错/重试/删除 三按钮）——小卡升级整卡，兑现 §2「整卡切换」；③ **历史条点击联动结果区**（点历史条目 → 结果区切换对应条目，对齐生图相册翻页联动）；④ **模型管理行整治**：composer 三行冗余状态文本删除 → 引擎状态/下载/删除全部并入顶栏下拉行内；⑤ **m4a/mp3 转码删条**（锋利：不做兜底转码，JS 显式只收 wav 16k）
> 版本：v1.7（2026-08-23 B38 大王复查·多模态统一逻辑）：① **顶栏胶囊与生图 tab 同一设计语言**——废弃 audioHeaderCapsule 独立风格，复用 triggerPill（primary 12% 底 + full 圆角 + primary 1px 描边 + onSurface 文字 + ▾ 箭头），就绪点内嵌保留（音频的「加载」语义 = 引擎就绪点）；② **结果区升级播放器预览窗口**——方形大卡（与生图预览窗口同规格）：中央播放/暂停大按钮 + 时间轴（可拖动跳播）+ 当前/总时长（mm:ss）；running/failed 三态保留；产物操作行（重生成/分享/删除）置于预览卡内；③ **历史卡改方形**（与生图相册缩略图同构：方形卡 + 图标/摘要），**点击 = 加载到预览窗口**（转写=文本预览、生成=播放器预览），不再点卡直接播放/复制（操作归预览窗口）——多模态统一：生图=缩略图→大图预览，音频=方形卡→播放器预览，转写=方形卡→文本预览；④ **输入框默认两行**（minHeight 66，原 44——怕用户找不到输入处，提高存在感）；⑤ **原生播放器全能力**：MediaPlayer 扩展 seekTo/pause/resume/getPosition，JS 侧 500ms 轮询驱动时间轴
> 版本：v1.6（2026-08-23 B37 生成链路修复）：TTS 生成链路（sherpa 原生）与播放链路（fork 库）对模型文件格式要求不同——下载后由 sherpaConvert.ts 生成 sherpa 格式副本（tokens.txt / unicode_indexer.bin / voice {id}.bin）；kokoro 模型需 sherpa metadata；kitten 生成链路换官方 kitten-nano-en-v0_1（kitten_sherpa.onnx，palshub 0.8 输出纯噪声弃用）
> 版本：v1.12（2026-08-30 吸底按钮底部裁切修复，对齐生图按钮体量）：用户实测「生成按钮被底边切掉一半」——根因：insets.bottom=42 只避让手势条指示器，按钮 63px 整段落入手势暗区（生图出图按钮 116px 高、上半 47px 逃出暗区故观感正常）；修复=AudioActionBar 渲染树/样式与 GenActionBar 出图按钮逐层同构（bottomBar 内 buttonRow 行容器 + 内衬 buttonGenMain），按钮恢复 116px 完整体量（真机 [2221,2337] h=116 与生图逐像素一致）；转写段无吸底条不占位语义不变。
> 版本：v1.11（2026-08-30 跑分卡+吸底条，对齐生图页裁定）：① **生成按钮吸底**——生图「出图」吸底常驻裁定（2026-08-26）平移：新建 AudioActionBar（ImageGenScreen 层 KeyboardStickyView + insets 安全区避让，与 GenActionBar 同构封装），「生成音频」按钮常驻页面底部；仅 generate 段渲染（转写段主操作在 composer 不吸底不占位）；composer 底部原生成按钮删除（无重复按钮）；状态（audioSeg/genText/voiceId/speed/supertonicSteps）从组件 state 入 audioStore（吸底条与 tab 共享，AudioSeg 类型入 store）；ttsGenerating 转圈 onPrimary（8-29 真机根因沿用：primary 底转圈须高对比色）；disabled = 任务中/空文本/无音色/引擎未装（buttonDisabled 半透明主色语义同生图）② **跑分卡片**——TTS 生成 running 页复用生图 PerfPanel（完整面板，perfRecorder 由 beginTask 统一触发，TTS 任务同样采样，无需额外接线）；转写段 running 不挂（转写秒级、面板无意义且闪烁）；③ 转写段吸底维持现状（用户裁定向：仅生成按钮吸底）
> 版本：v1.10（2026-08-30 链路修复+对照播放+波形，用户实测驱动）：① **转写/生成历史条渲染 bug 修复**——useMemo 依赖 history.length 对 finishTask status patch 不重算 → 新转写成功后历史条永不出现（真机实锤：logcat transcribe ok 但 UI 空）；改 observer 内直接派生（MobX 字段访问即订阅），转写段/生成段四份派生（transcribeHistory/ttsHistory/transcribeTasks/ttsTasks）同步改；② **转写对照播放**——转写成功后源音频复制持久化 `AIOS/audio/transcribe/{taskId}.wav`（共享存储，cache 源可清），结果卡操作行加「播放原文」（info 蓝，复用播放器状态机 togglePlay；播放中变「暂停」）；历史卡点击=加载结果区（回听归结果区，与生成段同构不另造）；③ **波形显示**——生成段播放器预览卡时间轴上方加波形条（简单版：读 wav PCM 归一化 40 柱，未播 outline 灰、播放进度高亮 primary；JS 首帧解析 + 内存缓存，读大文件截断前 20s 采样）；④ **能力确认**——SenseVoice 转写无词级时间戳输出（时间轴打标文本不做，如实告知）；输入仅 wav 16k 红线不变（m4a/mp3 不支持，用户误传手机录音默认格式时会提示，扩支持待定夺）
> 版本：v1.9（2026-08-29 UI 合规修复批，小米13 真机审计驱动）：① **emoji 图标化（DESIGN_SPEC §12.5 铁律）**——历史卡 🎙/🎵/⏸ → MicIcon/HeadphonesMdIcon/PauseIcon、播放大键 ▶/⏸ → PlayIcon/PauseIcon（PauseIcon 自绘新资产，Lucide 同族全描边 2px）、转写卡标题 📝 去除；② **触区合规（DESIGN_SPEC §9）**——次级分段钮/操作条按钮/音色与步数 chip/高级参数折叠钮统一 hitSlop 补足 44dp（线性 72 方卡、64 播放键、大按钮天然达标）；③ **操作按钮文字语义 token 化（§1.6）**——复制/发送/分享/删除白字字面量 → onSuccess/onInfo/onDanger（暗色模式随之深字，语义正确）；primary 底白字（下载模型/播放大键）维持 B56② 登记评审豁免（onPrimary 深棕不适用）；④ **转写卡标题域色错位修正**——captionCardTitle 反推紫（imageInsight 为图像反推域色，B56③ 登记）→ 新 audioTranscribeTitle 中性 onSurface，emoji 同去；⑤ **历史卡选中态差异登记**（设计决策）——音频用 2px primary 描边 vs 生图相册 backdrop 压暗遮罩：音频方卡内容为 icon+短文字，遮罩压暗后不可读，描边语义保留，不强行统一；⑥ **SenseVoice 模型管理行 spec 闭合**——转写段 composer 状态行（已就绪/下载中 X%/下载失败/未下载）+「下载模型」行内按钮（primary 底），与生成段「引擎全在顶栏」格局并存（ASR 单模型无顶栏胶囊，§3.2 定义）；⑦ **模型直推 SOP 验证闭环**——TTS：push /data/local/tmp → chmod a+rX → run-as cp 入 files/tts/{engine}（sherpa 副本 tokens.txt/unicode_indexer.bin/voice {id}.bin 可 PC 端预生成同逻辑）；ASR：直推共享存储 AIOS/models/audio/sense-voice-zh-en-ja-ko-yue/；装完冷启动即就绪
> 版本：v1.8（2026-08-25 镜像校准销账，DEV_BACKLOG P4#11）：TTS 三引擎下载源 5 处直连 huggingface.co 全部切 hf-mirror.com（constants.ts L33/97/120/137/168：supertonic/kokoro/phonemizer/kitten/sherpa），对齐 ASR 既有镜像链路——§4.1 P2.5 连带项关闭
> 上位规范：POCKETPAL_DESIGN_SPEC.md（UI 域 SSOT）+ POCKETPAL_IMAGEGEN_UI_SPEC.md（工坊 tab 载体）

## 1. 产品定位

**音频工坊 = 离线语音双向工坊**：语音→文字（本地 ASR 转写）、文字→语音（本地 TTS 朗读），全部模型端侧运行，零网络依赖。

- 与聊天页麦克风按钮同源能力（聊天页语音输入走本地 ASR 时复用同一引擎，入口独立）
- 与生图 tab 平级：创作工坊双 tab 之一（路由 ROUTES.IMAGE_GEN 单一入口，不新增 Drawer/设置项）

## 2. 页面结构（同构生图：结果区 + 历史条 + 创作区）v2

```
┌─────────────────────────────────────┐
│ ① 结果区 = 播放器预览窗口（方形大卡）   │
│    - 中央：播放/暂停大按钮 + 音符图标   │
│    - 底部：时间轴（可拖动跳播）          │
│        当前/总时长（mm:ss）           │
│    - 操作行：重生成 / 分享 / 删除      │
│    - running：三点波浪覆盖            │
│    - failed：⚠ 摘要 + 三按钮          │
├─────────────────────────────────────┤
│ ② 历史条（方形卡，点击 → 加载预览窗口） │
│    转写记录（🎙）/ 生成音频（🎵）      │
├─────────────────────────────────────┤
│ ③ 创作区（composer）                  │
│    转写：录音/选文件按钮 + SenseVoice 状态│
│    生成：文本输入（默认两行 66px）      │
│         + 高级参数卡（默认折叠）        │
│           音色 / 速度 / 步数           │
└─────────────────────────────────────┘
```

- 一屏原则：预览窗口 + 历史条 + composer 主按钮可见（与生图页同构）
- **播放器预览窗口（v1.6）**：音频产物 = 方形大卡（与生图预览窗口同规格）；播放器全能力——播放/暂停/时间轴拖动跳播/当前与总时长；播放态由 audioStore 播放器状态机承载（playingUri/position/duration/isPlaying），历史卡播放中高亮共享
- 历史条：**方形卡（v1.6）**——转写段只列 kind='transcribe'、生成段只列 kind='tts'；**点击 = 加载到预览窗口**（不直接播放/复制；操作归预览窗口）——与生图相册「缩略图 → 大图预览」同一逻辑；三域隔离不变
- 引擎选择（v1.5）：**顶栏胶囊**（当前引擎名 + ⌄ + 就绪点）→ **屏级 overlay 下拉**（复用生图 ModelPickerDropdown 交互模式：dropOverlay/dropBackdrop 点外收起 + dropPanelAbs 锚定面板 + 行内动作）——模型只在顶栏，高级参数卡不含引擎选择；三引擎行内 = 名称+大小+状态点 + 「下载 / 删除」按钮
- 顶栏胶囊视觉（v1.6）：与生图 triggerPill **同一设计语言**（primary 12% 底 + full 圆角 + primary 1px 描边 + onSurface 文字 + ▾），就绪点内嵌
- 生成 = 合成音频文件（存 AIOS/audio/output/），非播放（播放是预览窗口的能力）
- tab 与生图页同屏切换（keep mounted，状态独立）


## 3. 转写能力（ASR）

### 3.1 引擎与模型（P2 第二阶段定稿，2026-08-21）
- 引擎：**sherpa-onnx v1.13.6 官方 android 包本地集成**（`sherpa-onnx-v1.13.6-android.tar.bz2`：jniLibs .so + kotlin-api 源码，Windows 免编译）；RN wrapper（npm registry）实勘不可用（镜像源私有包）→ 不依赖 wrapper，自写 NativeModule `AsrModule`（与 ImageGenModule 同构：ReactContextBaseJavaModule + Package 注册）
- 原生接入：`jniLibs/arm64-v8a/` 落 sherpa .so + kotlin-api（OfflineRecognizer 等 com.k2fsa.sherpa.onnx 类）→ `AsrModule.transcribe(path, promise)` 调 OfflineRecognizer（SenseVoice 非流式，整段转写）
- 输入：wav 16kHz 16-bit PCM；ASR 引擎只收 wav 路径（v1.5 裁定：**不做 m4a/mp3 转码兜底**——锋利原则，JS 侧显式校验扩展名「请选择 wav 音频文件（16kHz）」）
- 模型：SenseVoice int8（229MB，中英日韩粤 + 自动语种 + 标点），落盘 `AIOS/audio/`（model.int8.onnx + tokens.txt；无 config.yaml，2026-08-21 真机校准）；下载源：hf-mirror.com 国内镜像（作者 csukuangfj 官方仓库，HF 直连被墙，k2-fsa/sherpa-onnx-models 仓库仅 ascend-npu 专用包无 CPU 散包）
- 调度：按需加载（OfflineRecognizer 单例持有，重复转写复用不重建）；不入 engineMutex 互斥矩阵（<400MB 可共存）

### 3.2 转写任务化（入画廊，与生图/反推任务同管理）
- `kind='transcribe'` 任务条目：running/success/failed 三态 + taskId 持久化
- running：结果区整卡进度卡（三点波浪 + 阶段文本：加载语音模型 → 转写中 → 标点恢复 + 累计秒数，v1.5 复用 useWaveDots，对齐生图 running 页）
- success：转写文本卡（默认 3 行折叠 + 点击展开全文，对齐生图反推卡 captionExpanded）+ 操作条 `复制(绿) 发送到聊天(蓝) 删除(红)`（v1.4 三按钮齐）
- failed：**v1.5 落地**——复用生图报错页三按钮（⚠ 图标 + 一句话摘要 + 复制报错 / 重试 / 删除）；重试 = 同输入源重发（选文件转写：重跑 transcribeTask；录音转写：仅复制报错可重试，录音文件已删不再重放）
- 历史横条：v1.4 恢复为横向滚动条（转写段只列本段 kind='transcribe'，点按复制全文；生图相册不收音频任务，历史入口在音频 tab 内）；v1.5 点按同时联动结果区

### 3.3 输入源
- 选文件：媒体库音频文件 → 转写（复用 image picker 体系）
- 录音：**v1.3 已实现**——工坊「录音转写」按钮（点按开始，按钮变红「■ 停止并转写」，再点停止 → SenseVoice 自动转写入画廊）；录音模块 AudioRecordModule（AudioRecord PCM16 16kHz mono 直采 → 手写 WAV 头，落 cacheDir/audio_record/；MediaRecorder 不支持 wav 容器故走 PCM 直写）；RECORD_AUDIO 权限 manifest 已声明，JS 侧 PermissionAndroid 先行申请

### 3.4 SenseVoice 模型管理行（v1.9 spec 闭合）

- 位置：转写段创作区顶部一行（状态文本 + 行内按钮）；**与生成段「引擎全在顶栏」格局并存**——ASR 仅单模型无顶栏胶囊，不另造顶栏入口
- 状态文本：已就绪 / 下载中 X% / 下载失败 / 未下载（captionS/onSurfaceVariant，§6 字号 token 同规矩）
- 动作：未就绪态行内「下载模型」按钮（primary 底、radius.s、白字维持 B56② 评审豁免）；下载中禁点；就绪态无按钮
- 模型文件：SenseVoice int8 + tokens.txt 直推共享存储 `AIOS/models/audio/sense-voice-zh-en-ja-ko-yue/`（装机 SOP，见 v1.9⑦）

## 4. 生成音频文件（v2：由「朗读」升级为「生成文件」）

### 4.1 引擎与模型（复用现有 TTS 架构）
- 三引擎：Kokoro FP32（330MB，默认，多音色）/ Kitten（57MB）/ Supertonic（380MB，31 语种）——模型文件与播放共用（sherpa-onnx 格式）
- 合成：**TtsModule.synthesizeToFile 原生合成**（与 AsrModule 同构：sherpa-onnx OfflineTts kotlin-api）→ wav 文件落盘 `AIOS/audio/output/`（共享存储，用户可见）
- 下载源：**2026-08-25 已切 hf-mirror.com 镜像**（P4#11，5 处直连点全切，对齐 §3.1 ASR 既有镜像链路；此前「需镜像校准，P2.5 连带项」已关闭）
- **双格式并存（v1.6，B37 实锤）**：fork 播放链路（@pocketpalai/react-native-speech）与 sherpa 生成链路（AudioTts native）对同一模型的文件格式要求不同——播放链路消费 tokenizer.json / unicode_indexer.json / voice {id}.json；生成链路消费 tokens.txt / unicode_indexer.bin / {id}.bin（6×int64 头 + float32）。下载后由 `src/services/tts/sherpaConvert.ts` 生成 sherpa 格式副本（失败不阻断播放链路）。
- **kokoro 模型要求 sherpa metadata**（sample_rate=24000 / n_speakers / has_espeak=1 / style_dim=510,1,256）——onnx-community 原版导出缺 metadata 会初始化失败；kitten 生成链路用 sherpa 官方 kitten-nano-en-v0_1（kitten_sherpa.onnx），palshub 0.8 模型输出纯噪声（B37 实测弃用）。

### 4.2 交互（同构生图 composer）
- 文本输入区（**v1.6 默认两行 minHeight 66**，怕用户找不到输入处）+ 主按钮「生成音频」（合成中 → 进度态）
- 高级参数卡（默认折叠，默认值即可用——「需要动的才暴露」）：
  - 音色：Kokoro 多音色清单 chip / Supertonic 语种音色
  - 速度：0.5–2.0 滑杆（默认 1.0）
  - 步数：Supertonic 1|2|3|5|10|20（默认 5）（语种由 sherpa-onnx 自动检测，不设选择器）
  - **不含引擎选择**（v1.4：引擎选择在顶栏胶囊）
- 引擎选择（v1.5）：顶栏胶囊（当前引擎名 + ⌄ + 就绪点）→ **屏级 overlay 下拉**（复用生图 ModelPickerDropdown 交互模式，弃 Menu）；行内 = 引擎名+大小+状态点 + 「下载 / 删除」按钮（未就绪显下载、就绪显删除，二次确认免）；选中即写 audioStore.genEngine，生成段音色/步数联动
- composer 不再有模型管理行（v1.5：三行冗余状态文本删除，状态/动作全部并入顶栏下拉）
- 结果：kind='tts' 任务入画廊（running/success/failed）；**产物 = 播放器预览窗口（v1.6）**——播放/暂停 + 时间轴拖动跳播 + 当前/总时长（原生 MediaPlayer seekTo/pause/resume/getPosition，JS 500ms 轮询）；操作行（重生成 / 分享 / 删除）置于预览卡内
- **历史卡（v1.6）**：方形卡（与生图相册缩略图同构），点击 = 加载到预览窗口（不直接播放）——多模态统一：生图=缩略图→大图预览，音频=方形卡→播放器预览，转写=方形卡→文本预览


## 5. 聊天页联动（同源能力，入口独立）

- 聊天页麦克风按钮：**v1.3 已实现**——SenseVoice 已下载 → 本地录音（AudioRecordModule）→ 本地转写 → 文本入输入框（离线）；未下载 → 维持现状（系统 Voice）；按钮显隐条件 = 系统 Voice 可用 **或** 本地 ASR 就绪（原仅系统 Voice，本地就绪时入口不可达——v1.3 修复）
- 聊天回复朗读（流式）：TTSStore 现有 onAssistantMessageStart/Chunk/Complete 链路，音频工坊仅提供模型下载/管理入口

## 6. 状态机视觉

- 进度指示：三点波浪呼吸动效（错峰 150ms，JS driver，与生图页同设计语言）——v1.5 落地（useWaveDots 复用，running 整卡）
- 播放器进度（v1.6）：时间轴 = 原生 MediaPlayer 位置轮询（500ms）驱动；拖动 = seekTo 即时跳播
- overlay 设计语言：浅色圆角（与卡片统一），禁用黑色直角矩形
- 失败页：⚠ 图标 + 摘要 + 复制报错 / 重试 / 删除（与生图 failed 任务页同规格）——v1.5 落地

## 7. 约束（实现红线）

- Screen 层零直连原生引擎，全部经 audioStore 单通道（ASR/TTS 收编）
- 新色值必须登记本文档（沿用语义色体系：复制绿 #2e7d32 / 发送蓝 #1565c0 / 删除红 #c62828；按钮前景用 onSuccess/onInfo/onDanger token）
- **禁 emoji 作 UI 图标（v1.9，DESIGN_SPEC §12.5）**：历史卡/播放键/标题一律 `src/assets/icons` 自绘（MicIcon/HeadphonesMdIcon/PlayIcon/PauseIcon）；`audioPlayBigIcon` 与 `audioBtnModel` 白字为 primary 底 B56② 登记评审豁免，其余白字字面量已清零
- **触区（v1.9，DESIGN_SPEC §9）**：次级分段钮/操作条按钮/音色与步数 chip/高级参数折叠钮一律 hitSlop 补足 44dp；新增紧凑元素默认带 hitSlop
- 历史卡选中态 = 2px primary 描边（v1.9 登记：音频方卡内容为 icon+短文字，backdrop 压暗遮罩不可读，不与生图相册遮罩统一）
- 模型文件：ASR 落 `AIOS/models/audio/`（MODEL_MATRIX §7 管辖）；TTS 沿用 `files/tts/` 私有目录（TTSStore 管辖，不双轨）；装机直推 SOP 见 v1.9⑦
- testID 稳定：audio-record / audio-pick / audio-speak / audio-copy 等，e2e 依赖不变
- 不做：音乐生成、音效合成、多轨混音（产品边界，未来再议）
