# Changelog

本项目所有重要变更均记录在此文件。

格式基于 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，
版本号遵循[语义化版本](https://semver.org/lang/zh-CN/)（.version / package.json / Android build.gradle / iOS project.pbxproj 四处同步）。

## [Unreleased]

### 新增
- 关于页标准版文案（多语 16 语言）：详细介绍段落 + 特性列表 + 开源说明
- 开源发布准备：README 重写（中英双语）、LICENSE 追加 fork 版权、AGENTS.md 公开版、内部 AIOS 文档移出跟踪

## [v1.16.1] - 2026-08-15

### 新增
- 本地生图能力（P5 系列）：DreamLite 端侧图像生成引擎（ONNX 导出，4 步 flow-matching 蒸馏，1024px 输出，纯 JS PNG 编码），支持文生图与图像编辑（VAE Encoder 条件路径）
- SD3.5 / Z-Image-Turbo 模型入场（实验性徽标），模型管理 Manifest 声明式链路
- 模型智能调度（P4）：常驻管家 + 任务驱动 + 聊天内闭环生图，冷却期防错机制 + 内存预设 n_ctx
- 聊天页 UI 重设计（W1-W4）：模型徽章、画图入口、全局 ConfirmDialog 统一弹窗体系、操作条三按钮、返回按钮对齐、品牌色点缀
- 侧拉抽屉与设置页信息架构重构：会话中心 + 聊天头部生图入口 + 三级导航后退
- 品牌二次改名：口袋八哥 → 小黄鸡（英文 Pocket Chick），人设/空态/思考卡片文案全链联动
- 情绪系统（M7）：词库情感打分 + 状态栏展示
- 智能体仪式四件套：开场仪式、意图状态机、收尾协议、自检开关
- 生图历史持久化、存相册、全屏查看/管理、崩溃落盘日志埋点
- 启动恢复上次会话、顶栏模型下拉入口

### 修复
- DreamLite 纯黑图回归：sigmas NaN 溢出根因 + VAE 缩放因子对齐官方 1024
- Vulkan 真机崩溃（Adreno 双后端 hang）→ OpenCL 正确路径 + 失败回退 CPU
- TE 编码后内存释放（降低生成峰值内存），ONNX/Llama session 释放 await
- 生图页 50 张全尺寸大图解码风暴致全页空白
- 本地模型 modelType 未标注导致聊天页列表为空（adoptExisting 补全）
- 长按"从此处删除"、Pal 模型切换确认统一 ConfirmDialog
- 安卓状态栏安全区、抽屉图标差异、输入框分隔线
- 记忆提取真机复测修复（剥离 BOS / 禁用 thinking / JSON 兜底）

### 性能
- OpenCL GPU 加速实证：SD3.5 从 CPU 2h+ 提速到 10.7 分钟（Adreno）
- 全 App 循环动效收口 JS driver（弱引用溢出崩溃根治：推拉反转架构替代节流补丁）
- TE 编码后释放降内存峰值

### 技术架构
- DreamLite 端侧接入全闭环：真实文生图（ONNX TE + llama.rn tokenize + ORT UNet）+ 编辑落地
- 生图引擎单通道 + 同槽互斥（EngineMutex），backend 单点决策上 manifest
- sd.cpp 源码入库（1616 文件，含 ggml）替代 gitlink
- 聊天任务调度链抽 useChatScheduler hook，ChatScreen 瘦身

### 文档
- 产品/技术文档体系：CHAT_UI_SPEC、IMAGEGEN_UI_SPEC、MODEL_MATRIX（模型选型唯一事实源）、MASTER_LOG 主日志（§15 改名 SOP / §18 窗口闭环）、APP_INTRO_COPY（介绍文案库）
- 装机 SOP 定稿：备用机黄金标准核对清单 + 换机铁律 + 存储授权 EACCES 根因

### 其他
- onnxruntime 锁版本 1.28.0 防动态版本漂移
- 生图模型与 LLM 列表双层过滤隔离（Manifest 文件集合）
- 撤回 DeepSeek Hermes 错误登记，模型清单管辖边界明确

## [PocketPal AI v1.16.1] - 上游基线

- 本项目基于 [PocketPal AI](https://github.com/a-ghorbani/pocketpal-ai)（MIT License）v1.16.1 fork 二开
- 上游功能基线：本地 GGUF 模型聊天、Pals 角色、TTS、Hugging Face 模型下载、CPU/GPU/NPU 加速
