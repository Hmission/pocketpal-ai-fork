/**
 * openaiClient/connection — 连接/探测族（api 域拆分 · 批次4 P3）
 *
 * /v1/models 拉取、/props 能力探测、连接测试、服务器类型识别。
 * 自 src/api/openai.ts 原样迁出（行为零变化）。
 */
import {RemoteModelCaps} from '../../utils/types';
import {FetchModelsResult, RemoteModelInfo} from './types';
import {
  CONNECTION_TIMEOUT_MS,
  buildHeaders,
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
        throw new Error('Unauthorized: Invalid or missing API key');
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
      models: liftModelEntryCapabilities(
        (data.data || []) as RemoteModelInfo[],
        data.models,
      ),
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
): Promise<string> {
  // 1. llama.cpp sets a Server header
  const serverHeader = headers.server || headers.Server || '';
  if (serverHeader === 'llama.cpp') {
    return 'llama.cpp';
  }

  // 2. LM Studio sets owned_by to 'organization_owner'
  if (models.some(m => m.owned_by === 'organization_owner')) {
    return 'LM Studio';
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
        return 'Ollama';
      }
    } finally {
      clearTimeout(timeout);
    }
  } catch {
    // Probe failed — not Ollama
  }

  return '';
}
