# PocketPal 星图域清单（STARMAP_DOMAINS）

> 本仓域边界的声明式清单（与 imageGenManifest 哲学一致：声明式、不侵入母仓）。
> 知识图谱（洋葱图谱/星图能力）做全量排查时，以本清单为域切分依据。
> 版本：v2（2026-08-15 重建；v1 文件曾丢失，本版按当前代码结构重核）

## 域清单

| 域 | 代码根 | 职责 | 域色 token |
|---|---|---|---|
| chat（聊天） | src/screens/ChatScreen, src/components/{ChatView,ChatInput,ChatHeader,Bubble,Message 家族} | 会话 UI、气泡渲染、输入卡、调度 hook（useChatScheduler） | domain.chat |
| imageGen（生图） | src/screens/ImageGenScreen（编排+ModelPickerPanel/ResultPreview/HistoryStrip/ComposerPanel）, src/store/imageGenStore, src/services/imageGen* | 端侧生图单通道（load/unload/generate/edit/decode 全收编 store） | domain.imageGen |
| models（模型） | src/screens/ModelsScreen, src/services, modelDisplayNames.ts | 模型列表/下载/设置/远程搜索 | —（列表域） |
| pals（伙伴） | src/screens/PalsScreen | 伙伴卡片/档案 | — |
| memory（记忆） | src/screens/MemoryScreen | AIOS 记忆管理 | domain.memory |
| knowledge（知识库） | src/screens/KnowledgeScreen | AIOS 知识库 | domain.knowledge |
| workspace（智能体） | src/screens/WorkspaceScreen | AIOS 智能体（workspace，zh_Hant「智慧體」） | domain.workspace |
| tools（工具） | src/screens/ToolScreen, src/components/ActiveTaskBanner | AIOS 工具配置与活动任务横幅 | domain.tools |
| settings（设置） | src/screens/SettingsScreen（入口中心）, GenerationSettingsScreen, BenchmarkScreen, AboutScreen, DevToolsScreen | 纯入口中心 + 二级设置页 | — |
| onboarding（引导） | src/screens/OnboardingScreens | 首启引导（DS token 首个消费者） | — |
| theme/DS（设计系统） | src/theme/tokens, src/utils/theme.ts, src/components/ui | 设计 token 单一事实源 + DS 组件库 | 见 DESIGN_SPEC |
| 导航壳 | App.tsx, src/components/SidebarContent | Drawer+Stack 嵌套、抽屉会话中心 | — |

## 引擎层（UI 改造禁区）

- llama.rn 文本引擎：src/services/llama*.ts、native 模块
- ONNX 生图引擎：android JNI（ImageGenModule/ImageGenJNI）、onnxruntime
- 互斥/单槽调度：engineMutex 语义（chat↔image 互斥、SD↔DreamLite 同槽互斥）
- **UI 统一升级类任务一律不得触碰本层**（DESIGN_SPEC §0 红线）

## 既有勘误记录

- usePulse.ts 已删除，生图进度动效现为 useWaveDots.ts（三点波浪，IMAGEGEN_UI_SPEC §4）。
- 抽屉不再承载功能导航：纯会话中心（搜索+新对话+日期分组列表+底部设置 footer）；功能入口全在设置页入口中心。
