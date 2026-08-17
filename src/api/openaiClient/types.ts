/**
 * openaiClient/types — OpenAI 兼容协议类型定义（api 域拆分 · 批次4 P3）
 *
 * 自 src/api/openai.ts 原样迁出（行为零变化）。openai.ts 保留为转发入口，
 * 外部引用路径不变。
 */
import {ReasoningIntent} from '../../utils/completionTypes';

/**
 * Raw API response shape from OpenAI /v1/models. The optional fields are what
 * a llama.cpp server adds: the first three arrive on the row itself, the last
 * is lifted from the sibling `models[]` array a single-model server emits.
 */
export interface RemoteModelInfo {
  id: string;
  object: string;
  owned_by: string;
  status?: {value?: string; args?: string[]};
  architecture?: {input_modalities?: string[]; output_modalities?: string[]};
  meta?: {n_ctx?: number; n_ctx_train?: number; [key: string]: unknown};
  capabilities?: string[];
}

/** Chat message type compatible with OpenAI API format */
export interface OpenAIChatMessage {
  role: string;
  content?:
    | string
    | Array<{type: string; text?: string; image_url?: {url?: string}}>;
}

/** OpenAI-style function tool definition. Mirrors the shape PACT
 * talents emit via `TalentEngine.toToolDefinition()`. */
export interface OpenAIToolDefinition {
  type: 'function';
  function: {
    name: string;
    description?: string;
    parameters?: Record<string, any>;
  };
}

/** OpenAI tool_choice — `'auto' | 'none' | 'required'` for the simple
 * case, or `{type:'function', function:{name}}` to pin a single tool. */
export type OpenAIToolChoice =
  | 'auto'
  | 'none'
  | 'required'
  | {type: 'function'; function: {name: string}};

/** OpenAI-compatible response_format. `json_schema` is the structured-output
 * mode supported by OpenAI, llama.cpp server, LM Studio, Ollama, and most
 * other compatible servers. `name` is required by OpenAI but ignored by
 * others — we inject a default when the caller doesn't supply one. */
export type OpenAIResponseFormat =
  | {type: 'text'}
  | {type: 'json_object'}
  | {
      type: 'json_schema';
      json_schema: {
        name?: string;
        strict?: boolean;
        schema: object;
      };
    };

/** Parameters for streaming chat completion */
export interface StreamChatParams {
  messages: OpenAIChatMessage[];
  model: string;
  temperature?: number;
  top_p?: number;
  max_tokens?: number;
  stop?: string | string[];
  stream?: boolean;
  tools?: OpenAIToolDefinition[];
  tool_choice?: OpenAIToolChoice;
  response_format?: OpenAIResponseFormat;
  /** Reasoning on/off + effort intent; translated to a per-serverType payload. */
  reasoning?: ReasoningIntent;
}

/** Result from fetchModelsWithHeaders: models + raw response headers. */
export interface FetchModelsResult {
  models: RemoteModelInfo[];
  headers: Record<string, string>;
}
