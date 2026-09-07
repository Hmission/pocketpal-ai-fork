/**
 * #711 errorRegistry | CP=DRC-007 | ST=running | 测试: test_errorRegistry.ts
 *   SSOT: docs/DebugRemoteControl/COMPASS_REGISTRY.md | 铁律: BT08 错误须带上下文
 *   出口: AgentRunner tool.error 事件附 CP 编号（G-5）= 事件流灰色面导航
 *   角色: 错误模式注册表——regex 匹配已知错误 → CP-APP-NNN 指南针（定位/导航/深入）。
 *
 * 与母仓 exception_handler.py / exception_patterns.json 同构（TS 移植）。
 * 新增已知错误在此登记一行；未知错误返回 null（提示录入，不静默）。
 */
export interface ErrorPattern {
  /** 指南针编号（唯一，见 COMPASS_REGISTRY.md） */
  cpId: string;
  /** 触发正则（对错误文本匹配） */
  triggerRegex: RegExp;
  /** 导航：第一步可执行动作 */
  navigation: string;
  /** 深入：文档/代码指针（≤3） */
  deepDive: string[];
}

/**
 * App 端已知错误模式注册表（与母仓 exception_patterns.json 同构）。
 * 模式来源：历史真机血证（JNI 丢失 / OOM / OpenCL hang / Vulkan 链路 / 引擎互斥）。
 */
export const ERROR_PATTERNS: ErrorPattern[] = [
  {
    cpId: 'CP-APP-001',
    triggerRegex: /JSI bindings not installed/i,
    navigation:
      '执行 node scripts/restore-llamarn-jnilibs.js（postinstall 三级恢复：.tmp 滚动备份 → 构建缓存 → APK 提取）',
    deepDive: [
      'scripts/restore-llamarn-jnilibs.js',
      'docs/POCKETPAL_MASTER_LOG.md（llama.rn jniLibs 丢失与恢复记录）',
    ],
  },
  {
    cpId: 'CP-APP-002',
    triggerRegex: /OutOfMemory|OOM|memory.*(exhaust|pressure)|PSS/i,
    navigation:
      '降低 n_ctx（modelStore.setNContext）或换小模型；检查 ONNX/Llama session 释放是否 await（释放未 await 会内存叠加）',
    deepDive: [
      'docs/POCKETPAL_MODEL_MATRIX.md',
      'docs/internal/（OOM 取证与持久化日志）',
    ],
  },
  {
    cpId: 'CP-APP-003',
    triggerRegex: /model.*not found|modelLoadError|no model|模型.*未找到/i,
    navigation:
      '执行 models.scan 重新扫描；确认模型文件在 AIOS_MODELS_DIR；manifest 与文件一致性校验',
    deepDive: [
      'docs/POCKETPAL_MODEL_MATRIX.md',
      'src/utils/imageGenManifest.ts',
    ],
  },
  {
    cpId: 'CP-APP-004',
    triggerRegex:
      /engine.*busy|互斥|mutex|awaitEngineReady.*timeout|引擎.*占用/i,
    navigation:
      '等待引擎释放后重试；engineStatus.busy 为 null 后重新发送；检查是否存在未 await 的 session 释放',
    deepDive: ['src/store/engineMutex.ts', 'src/store/engineStatus.ts'],
  },
  {
    cpId: 'CP-APP-005',
    triggerRegex: /OpenCL|Vulkan|hang|hangup|驱动/i,
    navigation:
      '执行 imagegen 命令时显式传 backend:"CPU" 回退；Vulkan 链路问题检查 VK_HEADER_VERSION 与驱动匹配',
    deepDive: [
      'docs/SD35_OPENCL_WHITE_IMAGE_ANALYSIS.md',
      'docs/internal/（OpenCL 回归方案 SOP）',
    ],
  },
  {
    cpId: 'CP-APP-006',
    triggerRegex: /^ERR_|生图失败|生成失败|txt2img/i,
    navigation:
      '检查 manifest 模型族与引擎匹配、LoRA 路径存在性、seed 复现；读事件流 imagegen.failed 与 state.json 引擎 error',
    deepDive: [
      'docs/POCKETPAL_IMAGE_GEN_UPGRADE_PLAN.md',
      'src/utils/imageGenManifest.ts',
    ],
  },
  {
    cpId: 'CP-APP-007',
    triggerRegex:
      /反推失败|caption.*(fail|失败)|视觉模型.*(未加载|不可用|缺失)|mmproj.*(not found|missing)/i,
    navigation:
      '确认 Qwen3.5 + mmproj 两件均在机（MODEL_MATRIX #3/#4）；反推走 chat 槽，等 engineMutex 释放后重试；模板不匹配时先查 captionEngine 的 one-shot 指令',
    deepDive: [
      'docs/POCKETPAL_IMAGEGEN_UI_SPEC.md §7',
      'src/services/captionEngine.ts',
    ],
  },
  {
    cpId: 'CP-APP-008',
    triggerRegex:
      /转写失败|ASR.*(fail|失败)|AUDIO_BUSY|RECORD_AUDIO|录音权限|录音被占用/i,
    navigation:
      '确认 SenseVoice 模型在机（MODEL_MATRIX §2.2 A1）；引导 RECORD_AUDIO 权限；录音报 AUDIO_BUSY 说明另有 owner（通话/工坊互斥），先释放再重试',
    deepDive: [
      'docs/POCKETPAL_AUDIO_UI_SPEC.md',
      'src/services/asrEngine.ts',
      'src/services/audio/recorder.ts',
    ],
  },
  {
    cpId: 'CP-APP-009',
    triggerRegex:
      /tool\.error|工具调用(失败|错误)|invalid tool (arguments|name)|未知工具|unknown tool/i,
    navigation:
      '按错误回传里的 guide（正确调用示例）修正参数后重试；同一工具连续失败 2 次才可放弃，并在最终回答中如实说明，不静默吐掉失败',
    deepDive: [
      'docs/workspace/WORKSPACE_TOOL_ERROR_FEEDBACK_SPEC.md',
      'src/services/agent/AgentRunner.ts',
    ],
  },
  {
    cpId: 'CP-APP-010',
    triggerRegex:
      /NIGHT_TASK_START_FAILED|前台服务.*(失败|启动失败)|Foreground service.*(fail|not allowed)|WakeLock|夜间任务被杀/i,
    navigation:
      '查 FOREGROUND_SERVICE + FOREGROUND_SERVICE_DATA_SYNC 权限与 service 声明（targetSdk 36 需 foregroundServiceType）；查 logcat 是否被 PSS 看护/内存配额杀（压内存优先于白名单）',
    deepDive: [
      'android/app/src/main/java/com/pocketpalai/NightTaskModule.kt',
      'docs/ONDEVICE_VIDEO_GEN_ANALYSIS.md §7.1',
      'src/store/nightTaskRegistry.ts',
    ],
  },
  {
    cpId: 'CP-APP-011',
    triggerRegex:
      /sample_rate.*(does not exist|missing)|生成噪音|TTS 模型.*不完整|tokens\.txt.*(缺失|missing)|espeak.*(missing|not found)/i,
    navigation:
      '核实下载源是否 sherpa 兼容：kokoro 需 metadata+tokens.txt、kitten 需官方 v0.1 生成链四件套；kitten 生成链已可由 downloadModel Phase 2 动态枚举补齐',
    deepDive: [
      'src/services/tts/constants.ts',
      'src/services/tts/engines/kitten/index.ts',
    ],
  },
  {
    cpId: 'CP-APP-012',
    triggerRegex:
      /基准(编排|用例).*(中断|卡死|失败)|benchmark.*(stuck|abort|fail)|跑分卡.*(失败|渲染)|分享.*(不可用|失败)/i,
    navigation:
      '查 BenchmarkStore 编排状态机是否复位（用例结束/失败必须 reset，不留半态）；分享走 FileProvider 门禁，不可用时降级存相册+诚实提示；数值 N/A 不编造',
    deepDive: [
      'docs/PERF_BENCHMARK_DESIGN.md §10',
      'src/store/BenchmarkStore.ts',
    ],
  },
  {
    cpId: 'CP-APP-013',
    triggerRegex:
      /Context is full|上下文(已满|不足|满)|context.*(full|overflow|exceed)|压缩(未触发|失败)|budget_decision.*saturated/i,
    navigation:
      '查 DRC chat.budget_decision 事件（used/nCtx/action/saturated）与 perModelNCtxSource 覆盖源（user 为主权）；策展档 defaultNCtxForModel 不得低于工具基线 TOOL_BASELINE_TOKENS；连压多轮 = 水位曲线异常',
    deepDive: [
      'docs/POCKETPAL_CONTEXT_COMPACTION_SPEC.md',
      'src/utils/modelContextDefaults.ts',
      'src/services/contextCompaction/decision.ts',
    ],
  },
  {
    cpId: 'CP-APP-014',
    triggerRegex:
      /identity_reborn|身份锚|IDENTITY.*(缺失|损坏|重建)|identity.*missing/i,
    navigation:
      'wakeCheck 三层自检会自愈重建种子（锚句+时间戳）并写 wake_anomaly.jsonl 留痕；血统导入走 scripts/aios/import_identity.py（一次性工具）',
    deepDive: [
      'docs/POCKETPAL_AIOS_CORE_SPEC.md Wave A',
      'src/services/aiosCore/wakeCheck.ts',
    ],
  },
  {
    cpId: 'CP-APP-015',
    triggerRegex:
      /limb_offline|义肢.*(离线|不可用)|连接失败|fetch failed|Network request failed/i,
    navigation:
      'scheduler 会显式助理消息告知「义肢离线，本轮本地代答」不静默；检查 serverStore 配置（URL/API key）与网络通道（cleartext 放行已配置）',
    deepDive: [
      'docs/POCKETPAL_AIOS_CORE_SPEC.md Wave E',
      'src/hooks/useChatScheduler.ts',
      'src/api/openaiClient/connection.ts',
    ],
  },
  {
    cpId: 'CP-APP-016',
    triggerRegex: /growth.*(fail|失败)|生长账本.*(fail|失败)|growth_dir/i,
    navigation:
      '检查 AIOS_ROOT 共享存储可写性（EACCES 授权/存储占用）；growth 为观测器官，失败不阻断主链路（静默降级）',
    deepDive: [
      'docs/POCKETPAL_AIOS_CORE_SPEC.md Wave D',
      'src/services/aiosCore/growth.ts',
    ],
  },
];

/** 匹配错误文本，返回所有命中模式（无命中返回空数组）。 */
export function matchError(errorText: string): ErrorPattern[] {
  const text = String(errorText ?? '');
  if (!text) {
    return [];
  }
  return ERROR_PATTERNS.filter(p => p.triggerRegex.test(text));
}

/** 取第一个命中（未命中返回 null → 提示录入 COMPASS_REGISTRY）。 */
export function matchFirstError(errorText: string): ErrorPattern | null {
  const hits = matchError(errorText);
  return hits.length > 0 ? hits[0] : null;
}
