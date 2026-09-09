/**
 * openaiClient/connection — 连接/探测族（api 域拆分 · 批次4 P3）
 *
 * /v1/models 拉取、/props 能力探测、连接测试、服务器类型识别。
 * 自 src/api/openai.ts 原样迁出（行为零变化）。
 */
import {RemoteModelCaps} from '../../utils/types';
import {SERVER_TYPE, ServerTypeOption} from '../../utils/serverTypes';
import {FetchModelsResult, RemoteModelInfo} from './types';
import {
  CONNECTION_TIMEOUT_MS,
  buildHeaders,
  buildUnauthorizedError,
  normalizeUrl,
  resolveTimeout,
} from './helpers';

const DETECT_TIMEOUT_MS = 5000;

// A fire-and-forget probe must neither inherit the 30 s connection default nor
// an arbitrarily large user-set timeout.
export const PROPS_TIMEOUT_MS = 5000;

/**
 * A single-model llama.cpp server describes its model twice: once in `data[]`
 * and once in a sibling `models[]` array, which is the only one carrying
 * `capabilities`. Joining them here keeps the two halves of one row together
 * for every caller. Servers that emit no `models[]` are unaffected.
 */
function liftModelEntryCapabilities(
  rows: RemoteModelInfo[],
  entries: unknown,
): RemoteModelInfo[] {
  if (!Array.isArray(entries) || entries.length === 0) {
    return rows;
  }
  return rows.map(row => {
    const entry =
      (row.id
        ? entries.find(e => (e?.name ?? e?.model) === row.id)
        : undefined) ??
      (rows.length === 1 && entries.length === 1 ? entries[0] : undefined);
    return entry?.capabilities
      ? {...row, capabilities: entry.capabilities}
      : row;
  });
}

/**
 * 从 /v1/models 响应里取模型数组（唯一取点）。
 *
 * 旧写法 `(data.data || [])` 把两种完全不同的事实压成同一个结果：
 *  - 「服务器确实一个模型都没有」（`{"data": []}`）；
 *  - 「响应形状不合预期」（根本没有 `data` 这个键）。
 * 两者都变成“0 个模型”并**报成功**，于是「接错了端口/接了个不是 OpenAI 的服务」
 * 被伪装成“这台机器没模型”，用户与排障面都无从分辨。
 *
 * 现在：取不到 `data` 数组就显式抛错，并告知实际收到哪些键；取到空数组则照实
 * 返回 0 个（空列表仍是一种合法答案，不是失败）。
 *
 * 为何不同时接受 `{"models": […]}` 形状（虽然同文件的 capabilities 提取在读它）：
 * OpenAI 线格式只认 `data`，而 `RemoteModelInfo` 全下游都按 `id` 取值；只有
 * `models[].name` 的响应会产出一堆**没有 id 的行**——看似成功、添加到模型时才发现坏了，
 * 比现在报错更难查。没有真实服务器样本就不先写归一层；真遇到了，错文会指名形状，
 * 届时再加映射。
 */
export function pickModelListRows(data: unknown): RemoteModelInfo[] {
  const rows = (data as {data?: unknown} | null)?.data;
  if (Array.isArray(rows)) {
    return rows as RemoteModelInfo[];
  }
  const keys =
    data && typeof data === 'object'
      ? Object.keys(data).slice(0, 6).join(',') || '(空对象)'
      : `非对象(${typeof data})`;
  throw new Error(
    `模型列表响应缺少 data 数组（实际收到的键：${keys}）——空列表应为 {"data": []}，而缺字段多为接错服务/非 OpenAI 兼容接口`,
  );
}

/**
 * Fetch available models and response headers from an OpenAI-compatible server.
 * GET /v1/models
 */
export async function fetchModelsWithHeaders(
  serverUrl: string,
  apiKey?: string,
  timeoutMs?: number,
): Promise<FetchModelsResult> {
  const url = `${normalizeUrl(serverUrl)}/v1/models`;
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    resolveTimeout(timeoutMs, CONNECTION_TIMEOUT_MS),
  );

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: buildHeaders(apiKey),
      signal: controller.signal,
    });

    if (!response.ok) {
      if (response.status === 401) {
        // 铁律 8.2 诊断文案收单点（helpers）：旧写法在此与 stream.ts 各写一份
        // 同样的判据 + 同一句文案，且两边口径已分叉（这边判 base url，那边判
        // 完整请求 URL）——同一语义两条路。详见 helpers.buildUnauthorizedError。
        throw buildUnauthorizedError(serverUrl);
      }
      throw new Error(
        `Server error: ${response.status} ${response.statusText}`,
      );
    }

    const responseHeaders: Record<string, string> = {};
    response.headers.forEach((value: string, key: string) => {
      responseHeaders[key] = value;
    });

    const data = await response.json();
    return {
      models: liftModelEntryCapabilities(pickModelListRows(data), data.models),
      headers: responseHeaders,
    };
  } catch (error: any) {
    if (error.name === 'AbortError') {
      throw new Error('Connection timed out');
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Fetch available models from an OpenAI-compatible server.
 * GET /v1/models
 */
export async function fetchModels(
  serverUrl: string,
  apiKey?: string,
  timeoutMs?: number,
): Promise<RemoteModelInfo[]> {
  const {models} = await fetchModelsWithHeaders(serverUrl, apiKey, timeoutMs);
  return models;
}

/**
 * Fetch model capabilities from a llama.cpp server's GET /props endpoint.
 * Pure: parses the response into caps and never throws — a timeout, non-2xx,
 * or malformed body resolves to `{}` so the caller's models path and
 * connection are never affected. `/props` is llama.cpp-specific; callers gate
 * on serverType before invoking.
 *
 * `modelId` scopes the request (`?model=<id>`). A multi-model router answers
 * the bare form with a placeholder (`model_path: 'none'`, `n_ctx: 0`,
 * `modalities` absent) that describes no model, so a field is only ever
 * returned when the body describes an actually loaded model. Absent field =
 * unknown; the caller merges field-wise and never blanks a known value.
 *
 * Key names verified against live llama.cpp builds (b9910, b9976): context
 * window is `default_generation_settings.n_ctx` (top-level `n_ctx` is an
 * older-build fallback); vision is `modalities.vision`.
 */
export async function fetchServerProps(
  serverUrl: string,
  apiKey?: string,
  timeoutMs?: number,
  modelId?: string,
): Promise<RemoteModelCaps> {
  const url =
    `${normalizeUrl(serverUrl)}/props` +
    (modelId ? `?model=${encodeURIComponent(modelId)}` : '');
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    resolveTimeout(timeoutMs, PROPS_TIMEOUT_MS),
  );

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: buildHeaders(apiKey),
      signal: controller.signal,
    });
    if (!response.ok) {
      return {};
    }
    const data = await response.json();
    const caps: RemoteModelCaps = {};

    const nCtx: unknown =
      data?.default_generation_settings?.n_ctx ?? data?.n_ctx;
    if (typeof nCtx === 'number' && Number.isFinite(nCtx) && nCtx > 0) {
      caps.contextLength = nCtx;
    }

    const modelPath: unknown = data?.model_path;
    const describesModel =
      (typeof modelPath === 'string' &&
        modelPath !== '' &&
        modelPath !== 'none') ||
      caps.contextLength !== undefined;
    if (describesModel) {
      caps.supportsVision = data?.modalities?.vision === true;
    }

    return caps;
  } catch {
    return {};
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Test connection to an OpenAI-compatible server.
 * Returns ok status and model count.
 */
export async function testConnection(
  serverUrl: string,
  apiKey?: string,
  timeoutMs?: number,
): Promise<{ok: boolean; modelCount: number; error?: string}> {
  try {
    const models = await fetchModels(serverUrl, apiKey, timeoutMs);
    return {ok: true, modelCount: models.length};
  } catch (error: any) {
    return {ok: false, modelCount: 0, error: error.message || 'Unknown error'};
  }
}

/**
 * Detect server type from response headers and model metadata.
 * Checks (cheapest first):
 * 1. Server header === 'llama.cpp'
 * 2. Any model owned_by === 'organization_owner' → LM Studio
 * 3. GET / body === 'Ollama is running' → Ollama
 * 4. Unknown → ''
 */
export async function detectServerType(
  serverUrl: string,
  models: RemoteModelInfo[],
  headers: Record<string, string>,
): Promise<ServerTypeOption | ''> {
  // 1. llama.cpp sets a Server header
  //（比较右侧是**线上报文值**，不是本仓枚举，故保留字面量；返回值一律取 SERVER_TYPE）
  const serverHeader = headers.server || headers.Server || '';
  if (serverHeader === 'llama.cpp') {
    return SERVER_TYPE.llamaCpp;
  }

  // 2. LM Studio sets owned_by to 'organization_owner'
  if (models.some(m => m.owned_by === 'organization_owner')) {
    return SERVER_TYPE.lmStudio;
  }

  // 3. Ollama responds with 'Ollama is running' at GET /
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), DETECT_TIMEOUT_MS);
    try {
      const response = await fetch(normalizeUrl(serverUrl), {
        method: 'GET',
        signal: controller.signal,
      });
      const body = await response.text();
      if (body.trim() === 'Ollama is running') {
        return SERVER_TYPE.ollama;
      }
    } finally {
      clearTimeout(timeout);
    }
  } catch {
    // Probe failed — not Ollama
  }

  // 4. G2-2: 百炼专属域判据。URL 含 maas.aliyuncs.com 即判 OpenAI 兼容型，
  // 不需探测响应内容（专属域不支持 GET / 探测）。不建专属适配器。
  // 🔴 旧代码在此 `return 'openai'`（**小写**），而 buildReasoningPayload 的 switch
  // 只认 `SERVER_TYPE.openai`（'OpenAI'）→ 落 default 返回 {} → 百炼的 reasoning_effort
  // 静默丢失，且下拉框选中一个不存在的选项。当时此处注释还写着「让
  // buildReasoningPayload 正确分支」——注释与代码相反（2026-09-09 aab688d9 实测）。
  // 现在值取单一真源 + 签名收窄，大小写不可能再分叉。
  if (serverUrl.includes('maas.aliyuncs.com')) {
    return SERVER_TYPE.openai;
  }

  return '';
}
