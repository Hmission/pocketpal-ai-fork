/**
 * openaiClient/reasoningPayload — 推理意图→服务器载荷翻译（api 域拆分 · 批次4 P3）
 *
 * 自 src/api/openai.ts 原样迁出（行为零变化）。
 */
import {ReasoningIntent} from '../../utils/completionTypes';

/**
 * Translate the reasoning intent into the per-serverType wire payload. Gating
 * is keyed on the PERSISTED serverType (never live detection). An unknown /
 * strict server receives no reasoning controls — omit beats a 400.
 *
 * - llama.cpp: reasoning_format always 'auto' (no-op for non-reasoning models;
 *   prevents raw channel/think markers leaking into content). ON+effort →
 *   + chat_template_kwargs:{reasoning_effort}; OFF → + chat_template_kwargs:
 *   {enable_thinking:false}. (ignores unknown → safe)
 * - vLLM (modern): ON+effort → chat_template_kwargs:{reasoning_effort}; ON →
 *   nothing; OFF → chat_template_kwargs:{enable_thinking:false}. (ignores unknown)
 * - LM Studio: on/off only — its chat API ignores reasoning_effort. ON →
 *   nothing; OFF → chat_template_kwargs:{enable_thinking:false}.
 * - Ollama (/v1): OFF → reasoning_effort:'none' (safe no-op). NEVER think:true,
 *   NEVER a non-'none' effort (hard-400 risk). Graded effort deferred.
 * - OpenAI: reasoning_effort:<value> only when axis-2 effort is known for the
 *   model id; nothing for on/off (400 on misapplied params).
 * - unknown / old vLLM: omit everything.
 */
export function buildReasoningPayload(
  serverType: string | undefined,
  reasoning: ReasoningIntent | undefined,
): Record<string, any> {
  if (!reasoning) {
    return {};
  }
  const {enabled, effort} = reasoning;
  switch (serverType) {
    case 'llama.cpp':
      // reasoning_format is always 'auto': a no-op for non-reasoning models and
      // the value that extracts reasoning into reasoning_content instead of
      // leaking raw channel/think markers into content (e.g. gemma-4 emits an
      // empty <|channel>thought block even when thinking is off). On/off is
      // carried solely by enable_thinking.
      if (!enabled) {
        return {
          reasoning_format: 'auto',
          chat_template_kwargs: {enable_thinking: false},
        };
      }
      return effort
        ? {
            reasoning_format: 'auto',
            chat_template_kwargs: {reasoning_effort: effort},
          }
        : {reasoning_format: 'auto'};
    case 'vLLM':
      if (!enabled) {
        return {chat_template_kwargs: {enable_thinking: false}};
      }
      return effort ? {chat_template_kwargs: {reasoning_effort: effort}} : {};
    case 'LM Studio':
      // On/off only; the LM Studio chat API ignores reasoning_effort.
      return enabled ? {} : {chat_template_kwargs: {enable_thinking: false}};
    case 'Ollama':
      // OFF sends a safe no-op; ON sends nothing (never think:true).
      return enabled ? {} : {reasoning_effort: 'none'};
    case 'OpenAI':
      return effort ? {reasoning_effort: effort} : {};
    default:
      // unknown / old vLLM — omit everything.
      return {};
  }
}
