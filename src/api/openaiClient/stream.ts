/**
 * openaiClient/stream — 流式补全族（api 域拆分 · 批次4 P3）
 *
 * POST /v1/chat/completions（stream: true）XHR + SSE 增量解析。
 * 自 src/api/openai.ts 原样迁出（行为零变化）。
 */
import {SSEParser} from '../sseParser';
import {
  CompletionResult,
  CompletionStreamData,
  ToolCall,
} from '../../utils/completionTypes';
import {StreamChatParams} from './types';
import {
  CONNECTION_TIMEOUT_MS,
  IDLE_TIMEOUT_MS,
  buildHeaders,
  isValidChatChunk,
  normalizeUrl,
  resolveTimeout,
} from './helpers';
import {
  ToolCallAccumulator,
  applyToolCallDelta,
  assembleFinalToolCalls,
} from './toolCalls';
import {buildReasoningPayload} from './reasoningPayload';
import {encodeMessagesForRemote, hasLocalImageAttachment} from './imageInline';

/**
 * Stream a chat completion from an OpenAI-compatible server.
 * POST /v1/chat/completions with stream: true
 *
 * Uses XMLHttpRequest with incremental events for React Native compatibility.
 * React Native's fetch does not expose response.body (ReadableStream), so
 * XMLHttpRequest with onprogress is the standard approach for SSE streaming.
 */
export async function streamChatCompletion(
  params: StreamChatParams,
  serverUrl: string,
  apiKey?: string,
  signal?: AbortSignal,
  onToken?: (data: CompletionStreamData) => void,
  timeoutMs?: number,
  serverType?: string,
): Promise<CompletionResult> {
  const url = `${normalizeUrl(serverUrl)}/v1/chat/completions`;
  const connectionTimeoutMs = resolveTimeout(timeoutMs, CONNECTION_TIMEOUT_MS);
  const idleTimeoutMs = resolveTimeout(timeoutMs, IDLE_TIMEOUT_MS);
  // Only pay the async encode when a local image is actually attached; the
  // common text path stays synchronous so callers see the request built in the
  // same tick.
  const encodedMessages = hasLocalImageAttachment(params.messages)
    ? await encodeMessagesForRemote(params.messages)
    : params.messages;

  return new Promise<CompletionResult>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', url);

    // Set headers
    const headers = buildHeaders(apiKey);
    for (const [key, value] of Object.entries(headers)) {
      xhr.setRequestHeader(key, value);
    }

    const parser = new SSEParser();
    let fullContent = '';
    let fullReasoningContent = '';
    let finishReason: string | null = null;
    let tokensPredicted = 0;
    let lastProcessedLength = 0;
    let settled = false;
    let serverTimings: CompletionResult['timings'] | undefined;
    // OpenAI streams partial tool_calls across chunks, indexed by
    // `delta.tool_calls[i].index`. Rebuild the per-call shape here so
    // the final result carries fully formed tool_calls and the streaming
    // callback sees a running snapshot.
    const toolCallAcc: ToolCallAccumulator = new Map();

    // Connection timeout: abort if no headers received in time
    const connectionTimer = setTimeout(() => {
      if (!settled) {
        settled = true;
        xhr.abort();
        reject(new Error('Connection timed out'));
      }
    }, connectionTimeoutMs);

    // Idle timeout: abort if no data received between chunks
    let idleTimer: ReturnType<typeof setTimeout> | null = null;
    const resetIdleTimer = () => {
      if (idleTimer) {
        clearTimeout(idleTimer);
      }
      idleTimer = setTimeout(() => {
        if (!settled) {
          settled = true;
          cleanup();
          xhr.abort();
          reject(new Error('Idle timeout: no data received'));
        }
      }, idleTimeoutMs);
    };

    // Handle external abort signal
    const onAbort = () => {
      xhr.abort();
    };
    if (signal) {
      if (signal.aborted) {
        reject(new Error('Completion aborted'));
        return;
      }
      signal.addEventListener('abort', onAbort, {once: true});
    }

    const cleanup = () => {
      clearTimeout(connectionTimer);
      if (idleTimer) {
        clearTimeout(idleTimer);
      }
      if (signal) {
        signal.removeEventListener('abort', onAbort);
      }
    };

    /**
     * Process new SSE data from the response.
     * Called from onprogress with the new text chunk.
     */
    const processChunk = (chunk: string) => {
      for (const event of parser.feed(chunk)) {
        if (event === 'done') {
          return;
        }

        if (!isValidChatChunk(event)) {
          continue;
        }

        resetIdleTimer();

        const parsed = event as any;
        const choice = parsed.choices[0];
        const delta = choice.delta || {};
        const content = delta.content || '';
        const reasoningContent =
          delta.reasoning_content || delta.reasoning || '';

        if (content) {
          fullContent += content;
          tokensPredicted++;
        }
        if (reasoningContent) {
          fullReasoningContent += reasoningContent;
        }
        if (choice.finish_reason) {
          finishReason = choice.finish_reason;
        }

        // Extract server-side timings (llama.cpp includes these at event level)
        if (parsed.timings) {
          serverTimings = parsed.timings;
        }

        // When tool_calls deltas are present, forward a token event so
        // the agent loop can react to a tool call beginning to assemble
        // — same shape llama.rn emits.
        let toolCallsDelta: ToolCall[] | undefined;
        if (Array.isArray(delta.tool_calls) && delta.tool_calls.length > 0) {
          toolCallsDelta = applyToolCallDelta(toolCallAcc, delta.tool_calls);
        }

        if (
          onToken &&
          (content ||
            reasoningContent ||
            (toolCallsDelta && toolCallsDelta.length > 0))
        ) {
          onToken({
            token: content || reasoningContent,
            // Pass accumulated content to match llama.rn's callback behavior
            // (useChatSession replaces message text, not appends)
            content: fullContent || undefined,
            reasoning_content: fullReasoningContent || undefined,
            tool_calls: toolCallsDelta,
          });
        }
      }
    };

    xhr.onreadystatechange = () => {
      if (xhr.readyState === XMLHttpRequest.HEADERS_RECEIVED) {
        // Headers received — clear connection timeout
        clearTimeout(connectionTimer);

        if (xhr.status !== 200) {
          // Don't reject yet — wait for onload to read the error body
          clearTimeout(connectionTimer);
        } else {
          resetIdleTimer();
        }
      }

      // When the full response is available for non-200 status, read the error body
      if (
        xhr.readyState === XMLHttpRequest.DONE &&
        xhr.status !== 200 &&
        xhr.status !== 0
      ) {
        if (settled) {
          return;
        }
        settled = true;
        cleanup();

        let errorMessage = `Server error: ${xhr.status}`;
        try {
          const errorBody = JSON.parse(xhr.responseText);
          const detail =
            errorBody?.error?.message || errorBody?.error || xhr.responseText;
          errorMessage = `Server error: ${xhr.status} — ${detail}`;
          console.log(
            '[OpenAI] Error:',
            errorBody?.error?.message || errorBody?.error,
          );
        } catch {
          if (xhr.responseText) {
            errorMessage = `Server error: ${xhr.status} — ${xhr.responseText.substring(0, 200)}`;
            console.log(
              '[OpenAI] Error (raw):',
              xhr.responseText.substring(0, 200),
            );
          }
        }

        if (xhr.status === 401) {
          reject(new Error('Unauthorized: Invalid or missing API key'));
        } else {
          reject(new Error(errorMessage));
        }
        xhr.abort();
      }
    };

    xhr.onprogress = () => {
      // After `xhr.abort()` the OS may still deliver bytes already
      // queued in the receive buffer via further onprogress firings.
      // Drop them — but consume the offset so onload (if it ever
      // fires) doesn't double-process them.
      if (signal?.aborted) {
        lastProcessedLength = xhr.responseText.length;
        return;
      }
      // Extract only the new data since last onprogress
      const newText = xhr.responseText.substring(lastProcessedLength);
      lastProcessedLength = xhr.responseText.length;

      if (newText) {
        processChunk(newText);
      }
    };

    xhr.onload = () => {
      if (settled) {
        return;
      }
      settled = true;
      cleanup();

      // Process any remaining data not yet seen in onprogress
      const remaining = xhr.responseText.substring(lastProcessedLength);
      if (remaining) {
        processChunk(remaining);
      }

      // Flush the SSE parser buffer
      for (const event of parser.flush()) {
        if (event === 'done') {
          break;
        }
        if (!isValidChatChunk(event)) {
          continue;
        }
        const parsed = event as any;
        const choice = parsed.choices[0];
        const delta = choice.delta || {};
        if (delta.content) {
          fullContent += delta.content;
          tokensPredicted++;
        }
        if (delta.reasoning_content || delta.reasoning) {
          fullReasoningContent += delta.reasoning_content || delta.reasoning;
        }
        if (choice.finish_reason) {
          finishReason = choice.finish_reason;
        }
        if (parsed.timings) {
          serverTimings = parsed.timings;
        }
        if (Array.isArray(delta.tool_calls) && delta.tool_calls.length > 0) {
          applyToolCallDelta(toolCallAcc, delta.tool_calls);
        }
      }

      // Mirror llama.rn's shape: undefined when no tool_calls were
      // observed during the stream.
      const finalToolCalls = assembleFinalToolCalls(toolCallAcc);

      // Build result
      if (signal?.aborted) {
        resolve({
          text: fullContent,
          content: fullContent,
          reasoning_content: fullReasoningContent || undefined,
          tool_calls: finalToolCalls,
          tokens_predicted: tokensPredicted,
          interrupted: true,
        });
        return;
      }

      const result: CompletionResult = {
        text: fullContent,
        content: fullContent,
        reasoning_content: fullReasoningContent || undefined,
        tool_calls: finalToolCalls,
        // llama.cpp reports authoritative token counts on `timings`; the server
        // count wins over the per-event tally. Each field is guarded on its own
        // key so a server that emits only one does not zero the other.
        tokens_evaluated: serverTimings?.prompt_n,
        tokens_predicted: serverTimings?.predicted_n ?? tokensPredicted,
        timings: serverTimings,
      };

      switch (finishReason) {
        case 'stop':
          result.stopped_eos = true;
          break;
        case 'tool_calls':
          // OpenAI emits finish_reason="tool_calls" when the model
          // chose to call tools instead of producing a final answer.
          // Treat as a normal stop — the agent loop reads .tool_calls
          // off the result and dispatches the next turn.
          result.stopped_eos = true;
          break;
        case 'length':
          result.stopped_limit = 1;
          break;
        case 'content_filter':
          result.interrupted = true;
          break;
      }

      resolve(result);
    };

    xhr.onerror = () => {
      if (settled) {
        return;
      }
      settled = true;
      cleanup();

      if (signal?.aborted) {
        reject(new Error('Completion aborted'));
      } else {
        reject(new Error('Network error'));
      }
    };

    xhr.onabort = () => {
      if (settled) {
        return;
      }
      settled = true;
      cleanup();

      if (signal?.aborted) {
        // Externally aborted — resolve with partial content
        resolve({
          text: fullContent,
          content: fullContent,
          reasoning_content: fullReasoningContent || undefined,
          tokens_predicted: tokensPredicted,
          interrupted: true,
        });
      }
      // If not externally aborted, the reject was already called
      // by the timeout handler that triggered xhr.abort()
    };

    // Only include params with meaningful values — some providers (e.g. OpenAI
    // with newer models) reject unsupported or empty params with 400 errors.
    const requestBody: Record<string, any> = {
      model: params.model,
      messages: encodedMessages,
      stream: true,
    };
    if (params.temperature != null) {
      requestBody.temperature = params.temperature;
    }
    if (params.top_p != null) {
      requestBody.top_p = params.top_p;
    }
    if (params.max_tokens != null) {
      requestBody.max_completion_tokens = params.max_tokens;
    }
    if (params.stop && params.stop.length > 0) {
      requestBody.stop = params.stop;
    }
    // Only attach when the caller actually supplied them — empty arrays
    // cause some servers (and their schema validators) to choke.
    if (params.tools && params.tools.length > 0) {
      requestBody.tools = params.tools;
    }
    if (params.tool_choice !== undefined) {
      requestBody.tool_choice = params.tool_choice;
    }
    if (params.response_format) {
      // OpenAI requires `name` inside json_schema; llama.cpp / Ollama /
      // LM Studio ignore it. Inject a default so the same call works
      // everywhere.
      if (
        params.response_format.type === 'json_schema' &&
        !params.response_format.json_schema.name
      ) {
        requestBody.response_format = {
          ...params.response_format,
          json_schema: {
            ...params.response_format.json_schema,
            name: 'response',
          },
        };
      } else {
        requestBody.response_format = params.response_format;
      }
    }
    // Per-serverType reasoning controls. Merge chat_template_kwargs rather than
    // overwrite so a future caller-supplied kwarg is preserved.
    const reasoningPayload = buildReasoningPayload(
      serverType,
      params.reasoning,
    );
    for (const [key, value] of Object.entries(reasoningPayload)) {
      if (key === 'chat_template_kwargs') {
        requestBody.chat_template_kwargs = {
          ...requestBody.chat_template_kwargs,
          ...value,
        };
      } else {
        requestBody[key] = value;
      }
    }
    xhr.send(JSON.stringify(requestBody));
  });
}
