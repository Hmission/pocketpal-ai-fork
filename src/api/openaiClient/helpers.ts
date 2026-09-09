/**
 * openaiClient/helpers — OpenAI 兼容请求公共工具（api 域拆分 · 批次4 P3）
 *
 * 超时裁定 / SSE chunk 校验 / 请求头 / URL 归一 / 401 诊断文案单点。自 src/api/openai.ts
 * 原样迁出（行为零变化）；401 单点为 2026-09-09 收口新增。
 */

export const CONNECTION_TIMEOUT_MS = 30000;
export const IDLE_TIMEOUT_MS = 60000;

/**
 * Single normalization site for a per-server timeout. An undefined, NaN,
 * non-finite, or non-positive value falls back to the supplied default.
 * Callers (stores, engine, sheets) forward raw values; only this layer
 * enforces the floor.
 */
export function resolveTimeout(
  timeoutMs: number | undefined,
  fallback: number,
): number {
  if (timeoutMs == null || !Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    return fallback;
  }
  return timeoutMs;
}

/**
 * Lightweight type guard for SSE delta shape.
 * Returns true if the parsed object looks like an OpenAI chat completion chunk.
 */
export function isValidChatChunk(parsed: any): boolean {
  if (!parsed || typeof parsed !== 'object') {
    return false;
  }
  if (!Array.isArray(parsed.choices) || parsed.choices.length === 0) {
    return false;
  }
  const choice = parsed.choices[0];
  // delta may be empty object {} or contain content/reasoning_content
  return choice.delta !== undefined || choice.finish_reason !== undefined;
}

/**
 * Build headers for OpenAI-compatible API requests.
 */
export function buildHeaders(apiKey?: string): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (apiKey) {
    headers.Authorization = `Bearer ${apiKey}`;
  }
  return headers;
}

/**
 * Normalize server URL: remove trailing slash and idempotently strip a trailing
 * `/v1` segment, so that `${normalizeUrl(url)}/v1/models` etc. never produce
 * `/v1/v1/...` regardless of whether the stored URL already contains `/v1`.
 * Single normalization site — no per-call `.replace('/v1/v1','/v1')` patching.
 */
export function normalizeUrl(serverUrl: string): string {
  return serverUrl.replace(/\/+$/, '').replace(/\/v1$/, '');
}

/**
 * 百炼公共域主机名。铁律 8.2：两套体系的 key 与域名必须成套——业务空间
 * `sk-` 密钥配公共域必返 401。此处只做**诊断文案**，不建专属适配器、不自动换域。
 */
const DASHSCOPE_PUBLIC_HOST = 'dashscope.aliyuncs.com';

/**
 * 401 的唯一构造点（公理 6：同一语义只允许一条路径）。
 *
 * 旧写法在 connection.ts 与 stream.ts 各写一份同句文案 + 同判据，且两边**输入口径
 * 已分叉**：connection 判 base url，stream 判完整请求 URL（`${normalizeUrl()}+/v1/
 * chat/completions`）——路径含该串时两边结论不一致。调用方必须传 **serverUrl**。
 *
 * 为何用 hostname.endsWith 而不是 `includes`：`includes` 会让
 * `evil-dashscope.aliyuncs.com.attacker.net` 这类主机误挂诊断提示。
 */
export function buildUnauthorizedError(serverUrl: string): Error {
  let hint = '';
  try {
    if (new URL(serverUrl).hostname.endsWith(DASHSCOPE_PUBLIC_HOST)) {
      hint =
        ' — 百炼业务空间密钥(sk-) 配公共域均返回 401；需改为 ws-*.maas.aliyuncs.com 专属域';
    }
  } catch {
    // 非法 URL → 无提示分支（不兜底真失败：吞掉错只会让 401 更难查）。
  }
  return new Error(`Unauthorized: Invalid or missing API key${hint}`);
}
