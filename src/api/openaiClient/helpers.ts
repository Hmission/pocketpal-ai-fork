/**
 * openaiClient/helpers — OpenAI 兼容请求公共工具（api 域拆分 · 批次4 P3）
 *
 * 超时裁定 / SSE chunk 校验 / 请求头 / URL 归一。自 src/api/openai.ts
 * 原样迁出（行为零变化）。
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
 * Normalize server URL: remove trailing slash.
 */
export function normalizeUrl(serverUrl: string): string {
  return serverUrl.replace(/\/+$/, '');
}
