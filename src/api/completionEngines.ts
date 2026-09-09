import {LlamaContext} from 'llama.rn';

import {streamChatCompletion} from './openai';
import {chatEngineGuard} from '../utils/engineGuard';
import {
  ApiCompletionParams,
  CompletionEngine,
  CompletionResult,
  CompletionStreamData,
  toCompletionResult,
  toCompletionStreamData,
} from '../utils/completionTypes';
import type {ServerTypeOption} from '../utils/serverTypes';

/**
 * LocalCompletionEngine wraps LlamaContext conforming to the CompletionEngine interface.
 * Thin wrapper that delegates all calls 1:1 to the native context.
 */
export class LocalCompletionEngine implements CompletionEngine {
  constructor(private context: LlamaContext) {}

  async completion(
    params: ApiCompletionParams,
    callback?: (data: CompletionStreamData) => void,
  ): Promise<CompletionResult> {
    // 串行化+冷却窗+重试：防 llama.rn 冷却期 Exception in HostFunction
    return chatEngineGuard.run(async () => {
      const result = await this.context.completion(
        params,
        callback ? data => callback(toCompletionStreamData(data)) : undefined,
      );
      // native-only 字段的剥离面归 completionTypes 单点（与管家引擎共用）
      return toCompletionResult(result);
    });
  }

  async stopCompletion(): Promise<void> {
    await this.context.stopCompletion();
  }
}

/**
 * OpenAICompletionEngine implements the CompletionEngine interface
 * using fetch + SSE parsing for OpenAI-compatible servers.
 */
export class OpenAICompletionEngine implements CompletionEngine {
  private abortController: AbortController | null = null;

  constructor(
    private serverUrl: string,
    private modelId: string,
    private apiKey?: string,
    private timeoutMs?: number,
    private serverType?: ServerTypeOption,
  ) {}

  async completion(
    params: ApiCompletionParams,
    callback?: (data: CompletionStreamData) => void,
  ): Promise<CompletionResult> {
    this.abortController = new AbortController();

    return streamChatCompletion(
      {
        messages: params.messages || [],
        model: this.modelId,
        temperature: params.temperature,
        top_p: params.top_p,
        max_tokens: params.n_predict,
        stop: params.stop,
        stream: true,
        // Cast at the boundary: llama.rn's `tools` typedef is
        // structurally compatible with OpenAI's function-tool shape but
        // lives under a different name.
        tools: (params as any).tools,
        tool_choice: (params as any).tool_choice,
        response_format: (params as any).response_format,
        // Reasoning intent carried on the params; openai.ts owns the wire shape.
        reasoning: params.reasoning,
      },
      this.serverUrl,
      this.apiKey,
      this.abortController.signal,
      callback,
      this.timeoutMs,
      this.serverType,
    );
  }

  async stopCompletion(): Promise<void> {
    this.abortController?.abort();
    this.abortController = null;
  }
}
