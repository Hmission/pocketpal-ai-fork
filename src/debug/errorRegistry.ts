/**
 * #711 errorRegistry | CP=DRC-007 | ST=running | 测试: test_errorRegistry.ts
 *   SSOT: docs/DebugRemoteControl/COMPASS_REGISTRY.md | 铁律: BT08 错误须带上下文
 *   入口: errorReport.buildErrorReport → 出口: 报告附 CP 编号 + 事件流 error 事件
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
      'docs/sop/LLAMARN_JNI_RESTORE_SOP.md',
      'scripts/restore-llamarn-jnilibs.js',
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
    deepDive: ['docs/POCKETPAL_MODEL_MATRIX.md', 'src/utils/imageGenManifest.ts'],
  },
  {
    cpId: 'CP-APP-004',
    triggerRegex: /engine.*busy|互斥|mutex|awaitEngineReady.*timeout|引擎.*占用/i,
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
