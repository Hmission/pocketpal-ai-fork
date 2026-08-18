import type {Pal} from '../types/pal';
import type {Model} from './types';
import {generateFinalSystemPrompt} from './palshub-template-parser';

export interface SystemPromptDependencies {
  pal?: Pal | null;
  model?: Model | null;
}

/**
 * Resolves the system prompt based on priority:
 * 1. Pal's system prompt (with parameter rendering if needed)
 * 2. Fallback to model's chat template system prompt
 * 3. Empty string if neither exists
 */
export function resolveSystemPrompt(
  dependencies: SystemPromptDependencies,
): string {
  const {pal, model} = dependencies;

  // Priority 1: Pal's system prompt
  if (pal?.systemPrompt) {
    // Check if the pal has parameters that need rendering
    if (pal.parameters && Object.keys(pal.parameters).length > 0) {
      return generateFinalSystemPrompt(pal.systemPrompt, pal.parameters);
    } else {
      return pal.systemPrompt;
    }
  }

  // Priority 2: Model's chat template system prompt
  if (model?.chatTemplate?.systemPrompt) {
    return model.chatTemplate.systemPrompt;
  }

  // Priority 3: Empty string
  return '';
}

type ChatMessage = {role: string; content?: unknown};

/**
 * 角色交替规范化（2026-08-19 真机实证）：严格 chat 模板（如 Ministral）要求
 * system 之后 user/assistant 严格交替。孤儿 user（上次生成失败无 assistant 落盘）
 * 或连续 assistant 段会让模板 raise，导致会话永久卡死。
 * 合并相邻同角色纯文本段（保真拼接，不丢内容）；带 tool_calls 的 assistant 不合并
 * （tool_call_id 回引配对完整性优先）。
 */
function normalizeAlternatingRoles(messages: ChatMessage[]): ChatMessage[] {
  const out: ChatMessage[] = [];
  for (const msg of messages) {
    const last = out[out.length - 1];
    const mergeable =
      last &&
      last.role === msg.role &&
      (msg.role === 'user' || msg.role === 'assistant') &&
      typeof last.content === 'string' &&
      typeof msg.content === 'string' &&
      !(msg as {tool_calls?: unknown}).tool_calls &&
      !(last as {tool_calls?: unknown}).tool_calls;
    if (mergeable) {
      last.content = `${last.content}\n${msg.content}`;
      continue;
    }
    out.push(msg);
  }
  return out;
}

/**
 * Fold the system prompt + every talent fragment into ONE leading system
 * message; a second system message makes strict chat templates raise.
 */
export function assembleMessages(
  systemMessages: Array<{role: 'system'; content: string}>,
  systemPromptFragments: string[],
  followingMessages: ChatMessage[],
): ChatMessage[] {
  const parts = [
    ...systemMessages.map(msg => msg.content),
    ...systemPromptFragments,
  ].filter(part => part.trim().length > 0);

  const leadingSystemMessage: ChatMessage[] = parts.length
    ? [{role: 'system', content: parts.join('\n\n')}]
    : [];

  const messages = [
    ...leadingSystemMessage,
    ...normalizeAlternatingRoles(followingMessages),
  ];

  if (__DEV__) {
    const systemPositions = messages
      .map((msg, index) => (msg.role === 'system' ? index : -1))
      .filter(index => index >= 0);
    if (
      systemPositions.length > 1 ||
      (systemPositions.length === 1 && systemPositions[0] !== 0)
    ) {
      console.error(
        'assembleMessages: chat templates require at most one leading system ' +
          `message, but found system messages at [${systemPositions.join(', ')}].`,
      );
    }
  }

  return messages;
}

/**
 * Resolves system prompt and formats it as a system message array
 * Returns empty array if no system prompt is available
 */
export function resolveSystemMessages(
  dependencies: SystemPromptDependencies,
): Array<{role: 'system'; content: string}> {
  const systemPrompt = resolveSystemPrompt(dependencies);

  if (!systemPrompt.trim()) {
    return [];
  }

  return [
    {
      role: 'system' as const,
      content: systemPrompt,
    },
  ];
}
