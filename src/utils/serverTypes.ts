/**
 * User-selectable server types. Gates the per-server reasoning wire payload
 * (see api/openai.ts buildReasoningPayload). detectServerType seeds the value
 * best-effort; the user's selection wins.
 */
export const SERVER_TYPE_OPTIONS = [
  'llama.cpp',
  'LM Studio',
  'Ollama',
  'OpenAI',
  'vLLM',
  'unknown',
] as const;

export type ServerTypeOption = (typeof SERVER_TYPE_OPTIONS)[number];

/**
 * 服务商快捷模板：把「填 URL」降为「点一下」。
 *
 * 为什么住在这里而不是 ServerStore：模板是**静态配置**，不是 store 状态；
 * 放进 `src/store/` 会被 `jest/setup.ts` 的全局 store 替身整层换掉（替身工厂
 * 不导出它），组件在测试里拿到 undefined——而这类缺口只在跑组件测试时才暴露。
 *
 * `serverType` 绑到 `ServerTypeOption` 而不是宽 `string`：旧模板写的 `'openai'`（小写）
 * 不在规范集里，会使 `buildReasoningPayload` 的 `switch` 落 default（reasoning 线上参数
 * 静默丢失）且下拉框选中一个不存在的选项。绑类型后此类错编译期即报。
 */
export interface ServerTemplate {
  label: string;
  serverType: ServerTypeOption;
  url: string;
  description: string;
}

export const SERVER_TEMPLATES: ServerTemplate[] = [
  {
    label: '百炼（阿里 DashScope）',
    serverType: 'OpenAI',
    // 专属域不带 /v1：normalizeUrl 会统一处理；与母仓 config/sub_brain.py 中 SUB_BRAIN_BASE_URL 对齐。
    // 若换业务空间需手动改此处——设计意图：模板是快捷方式，不代管凭证。
    url: 'https://ws-v6yhmq47rgvfwjco.cn-beijing.maas.aliyuncs.com/compatible-mode',
    description:
      'qwen3.8-flash（推荐）/ qwen3.8-max — 需业务空间 sk- 密钥 + ws-*.maas 专属域',
  },
  {
    label: 'DeepSeek',
    serverType: 'OpenAI',
    url: 'https://api.deepseek.com/v1',
    description: 'DeepSeek API — fast, affordable, supports tool calling.',
  },
  {
    label: 'OpenAI',
    serverType: 'OpenAI',
    url: 'https://api.openai.com/v1',
    description: 'OpenAI API — GPT-4o, o1, etc.',
  },
  {
    label: 'Ollama (Local)',
    serverType: 'llama.cpp',
    url: 'http://127.0.0.1:11434/v1',
    description: 'Local Ollama server — fully offline.',
  },
];

/**
 * Server-type options shaped for the ui Dropdown. Trigger testID is
 * `server-type-dropdown`; each item carries `server-type-option-<value>` so
 * e2e can both read the seeded value and pick an override.
 */
export const SERVER_TYPE_DROPDOWN_OPTIONS = SERVER_TYPE_OPTIONS.map(option => ({
  value: option,
  label: option,
  testID: `server-type-option-${option}`,
}));

/**
 * Best-effort seed for a server's type from the detection result plus a host
 * heuristic (api.openai.com → OpenAI). detectServerType cannot classify
 * OpenAI or vLLM, so the user can correct it on the server sheet.
 */
export function seedServerType(detected: string, url: string): string {
  if (detected) {
    return detected;
  }
  try {
    if (new URL(url).hostname.endsWith('api.openai.com')) {
      return 'OpenAI';
    }
  } catch {
    // ignore malformed URL
  }
  return 'unknown';
}
