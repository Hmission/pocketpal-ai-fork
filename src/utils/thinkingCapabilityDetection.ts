/**
 * Utility functions for detecting thinking capabilities in models.
 *
 * Delegates to llama.cpp's comprehensive detection (covering 25+ model families)
 * via llama.rn's getFormattedChat() API with enable_thinking support.
 */

import {LlamaContext, JinjaFormattedChatResult} from 'llama.rn';

export interface ThinkingDetectionResult {
  supported: boolean;
  thinkingStartTag?: string;
  thinkingEndTag?: string;
}

/**
 * Detects thinking capability by calling getFormattedChat with enable_thinking.
 * Delegates to llama.cpp's comprehensive detection covering 25+ model families.
 *
 * @param ctx The LlamaContext for the loaded model
 * @returns ThinkingDetectionResult with supported flag and optional thinking tags
 */
export async function detectThinkingCapability(
  ctx: LlamaContext,
): Promise<ThinkingDetectionResult> {
  try {
    const result = await ctx.getFormattedChat(
      [{role: 'user', content: 'test'}],
      null,
      {jinja: true, enable_thinking: true},
    );

    const jinjaResult = result as JinjaFormattedChatResult;
    if (jinjaResult.thinking_start_tag) {
      return {
        supported: true,
        thinkingStartTag: jinjaResult.thinking_start_tag,
        thinkingEndTag: jinjaResult.thinking_end_tag,
      };
    }

    return {supported: false};
  } catch (error) {
    console.warn('Thinking capability detection failed:', error);
    return {supported: false};
  }
}

/**
 * Reasoning 回灌探针（2026-08-19 K90 血证）：把一条携带 reasoning_content 的
 * 历史 assistant 消息重格式化。能生成 reasoning 的模板未必能回灌（Ministral
 * 回灌即 Jinja 'Only text chunks are supported in assistant message contents'）。
 * 抛错 = 该模板的历史消息不能带 reasoning_content，调用方剥离。
 *
 * @param ctx the LlamaContext for the loaded model
 * @returns true when the template round-trips reasoning_content safely
 */
export async function detectReasoningReinject(
  ctx: LlamaContext,
): Promise<boolean> {
  try {
    await ctx.getFormattedChat(
      [
        {role: 'user', content: 'probe'},
        {
          role: 'assistant',
          content: 'answer',
          reasoning_content: 'thinking probe',
        } as any,
      ],
      null,
      {jinja: true, enable_thinking: true},
    );
    return true;
  } catch (error) {
    console.warn(
      'Reasoning re-injection probe failed (template rejects reasoning_content):',
      error,
    );
    return false;
  }
}
