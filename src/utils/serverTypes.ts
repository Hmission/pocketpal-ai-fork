/**
 * User-selectable server types. Gates the per-server reasoning wire payload
 * (see api/openaiClient/reasoningPayload.ts buildReasoningPayload).
 * detectServerType seeds the value best-effort; the user's selection wins.
 *
 * 🔴 这里是服务器类型的**唯一字面量源**（公理 6：同一语义只允许一条实现路径）。
 * 历史上值在四处各写一份字面量（本表 / types.ts 联合 / connection.ts 探测产出 /
 * reasoningPayload.ts 的 case），其中探测产出写成小写 `'openai'` 而 switch 只认
 * `'OpenAI'` → 百炼专属域落 default 静默丢参数（2026-09-09 aab688d9 实测）。
 * 现在所有面必须从 SERVER_TYPE 取值，新增类型只改本表。
 */
export const SERVER_TYPE = {
  llamaCpp: 'llama.cpp',
  lmStudio: 'LM Studio',
  ollama: 'Ollama',
  openai: 'OpenAI',
  vLLM: 'vLLM',
  unknown: 'unknown',
} as const;

// 非空元组断言：使下游 zod 能直接 `z.enum(SERVER_TYPE_OPTIONS)` 做合法集校验
// （zod 要求 `readonly [string, ...string[]]`，普通 `T[]` 会被拒）。
export const SERVER_TYPE_OPTIONS = Object.values(SERVER_TYPE) as [
  ServerTypeOption,
  ...ServerTypeOption[],
];

export type ServerTypeOption = (typeof SERVER_TYPE)[keyof typeof SERVER_TYPE];

/**
 * 服务商快捷模板：把「填 URL」降为「点一下」。
 *
 * 为什么住在这里而不是 ServerStore：模板是**静态配置**，不是 store 状态；
 * 放进 `src/store/` 会被 `jest/setup.ts` 的全局 store 替身整层换掉（替身工厂
 * 不导出它），组件在测试里拿到 undefined——而这类缺口只在跑组件测试时才暴露。
 *
 * `serverType` 绑到 `ServerTypeOption`：旧模板写的 `'openai'`（小写）不在规范集里，
 * 会使 `buildReasoningPayload` 的 `switch` 落 default（reasoning effort 静默丢失）
 * 且下拉框选中一个不存在的选项。
 * ⚠ **准确口径**（纠正 60210cc commit message 的越界断言）：绑类型只使**本静态数组**
 * 编译期即报；旧版 `ServerConfig.serverType` 写着 `| string`，联合与 `string` 求并集被
 * TS 折叠成 `string`，所以下游（探测/state/落库/DRC）全链仍无闸门。真正的编译期防护
 * 靠本次将 `| string` 摘除 + 下游全收为 `ServerTypeOption` + switch 穷尽性 `never` 断言。
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
    serverType: SERVER_TYPE.openai,
    // 专属域不带 /v1：normalizeUrl 会统一处理；与母仓 config/sub_brain.py 中 SUB_BRAIN_BASE_URL 对齐。
    // 若换业务空间需手动改此处——设计意图：模板是快捷方式，不代管凭证。
    url: 'https://ws-v6yhmq47rgvfwjco.cn-beijing.maas.aliyuncs.com/compatible-mode',
    description:
      'qwen3.8-flash（推荐）/ qwen3.8-max — 需业务空间 sk- 密钥 + ws-*.maas 专属域',
  },
  {
    label: 'DeepSeek',
    serverType: SERVER_TYPE.openai,
    url: 'https://api.deepseek.com/v1',
    description: 'DeepSeek API — fast, affordable, supports tool calling.',
  },
  {
    label: 'OpenAI',
    serverType: SERVER_TYPE.openai,
    url: 'https://api.openai.com/v1',
    description: 'OpenAI API — GPT-4o, o1, etc.',
  },
  {
    label: 'Ollama (Local)',
    serverType: SERVER_TYPE.llamaCpp,
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
 * 判定任意字符串是否在本仓合法类型集内。
 *
 * 存在的理由：历史落库数据可能携带非法值（探测产出的小写 `'openai'` 曾长期能
 * 一路写入）。读回面必须能区分「合法存值」与「脏存值」，而不是拿个 `as` 直接信。
 * 不在此静默修正：修正属调用方决策（UI 可选择显示 unknown 让用户重选并在保存时覆写）。
 */
export function isServerTypeOption(
  value: string | undefined | null,
): value is ServerTypeOption {
  return !!value && (SERVER_TYPE_OPTIONS as readonly string[]).includes(value);
}

/**
 * 服务器类型的**唯一裁决点**（公理 6）：探测面与模板面不得各自 `setServerType`，
 * 只能把已知证据交给本函数，由它给出一句话结论。
 * 例外（主权路径，不经本函数）：① 用户在下拉框显式手选；② 从已持久化配置回灌
 * 上次的手选值——那是读回事实，不是第二个仲裁者。
 *
 * 证据优先级（强 → 弱）：
 * 1. **模板作者知识**：URL 逐字命中 `SERVER_TEMPLATES` 时以其声明类型为准。
 *    这是探测给不出的信息——百炼专属域不支持 GET / 探测、DeepSeek 域名无任何
 *    自报字段，若只信探测则这些服务器永远落 `unknown`，reasoning 参数直接丢光。
 * 2. **探测结果**： llama.cpp / LM Studio / Ollama 能自报的，照它的。
 * 3. **主机启发**：`api.openai.com` → OpenAI。
 * 4. 否则 `unknown`（诚实未知，不猜）。
 *
 * 旧实现的问题：探测在 `setServerType` 上赢过模板（模板写的正确值被随后异步的
 * 探测覆写），而探测自返的小写 `'openai'` 又因 `seedServerType(detected: string)`
 * 无类型约束而一路落库——同一个值两个写入者，谁覆盖谁只看时序。
 *
 * @param detected 探测产出的类型；`''` 表示未能识别
 * @param url      用户正在配置的 URL（模板声明按此逐字比对）
 */
export function seedServerType(
  detected: ServerTypeOption | '',
  url: string,
): ServerTypeOption {
  const trimmed = url.trim();
  // 1. 模板作者知识优先于探测。只认逐字 URL 匹配：用户手改过就不算模板，
  //    否则会拿陈旧的模板声明压掉真实探测结果（那是另一种说谎）。
  const templated = SERVER_TEMPLATES.find(tpl => tpl.url === trimmed);
  if (templated) {
    return templated.serverType;
  }
  // 2. 探测自报
  if (detected) {
    return detected;
  }
  // 3. 主机启发
  try {
    if (new URL(trimmed).hostname.endsWith('api.openai.com')) {
      return SERVER_TYPE.openai;
    }
  } catch {
    // 非法 URL → 落 unknown（不猜类型，不兜底真失败）
  }
  return SERVER_TYPE.unknown;
}
