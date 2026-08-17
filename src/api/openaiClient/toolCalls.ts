/**
 * openaiClient/toolCalls — 流式 tool_calls 增量装配（api 域拆分 · 批次4 P3）
 *
 * 自 src/api/openai.ts 原样迁出（行为零变化）。
 */
import {ToolCall} from '../../utils/completionTypes';

/**
 * Streamed tool_call state per OpenAI `index`. Arguments are stored
 * as fragments and joined once at end-of-stream — concatenating into
 * a growing string per chunk was O(N²) on long argument payloads
 * (e.g. a multi-KB `render_html` html string).
 */
export type ToolCallAccumulator = Map<
  number,
  {
    id: string;
    type: 'function';
    function: {name: string; argsFragments: string[]};
  }
>;

export function applyToolCallDelta(
  acc: ToolCallAccumulator,
  deltaCalls: Array<any>,
): ToolCall[] {
  // Per-chunk snapshot: `arguments` is this chunk's fragment only.
  // The consumer reads only `function.name` mid-stream; full args are
  // assembled from the accumulator at xhr.onload.
  const result: ToolCall[] = [];
  for (const delta of deltaCalls) {
    if (typeof delta?.index !== 'number') {
      continue;
    }
    const idx = delta.index;
    const existing = acc.get(idx) ?? {
      id: '',
      type: 'function' as const,
      function: {name: '', argsFragments: [] as string[]},
    };
    if (delta.id) {
      existing.id = delta.id;
    }
    if (delta.function?.name) {
      existing.function.name = delta.function.name;
    }
    const argsDelta: string = delta.function?.arguments ?? '';
    if (argsDelta) {
      existing.function.argsFragments.push(argsDelta);
    }
    acc.set(idx, existing);
    result.push({
      id: existing.id,
      type: existing.type,
      function: {name: existing.function.name, arguments: argsDelta},
    });
  }
  return result;
}

/**
 * Materialise the final tool_calls array from the fragment-based
 * accumulator. Undefined when no tool_calls were seen — mirrors
 * llama.rn's shape.
 */
export function assembleFinalToolCalls(
  acc: ToolCallAccumulator,
): ToolCall[] | undefined {
  if (acc.size === 0) {
    return undefined;
  }
  return Array.from(acc.entries())
    .sort(([a], [b]) => a - b)
    .map(([, entry]) => ({
      id: entry.id,
      type: entry.type,
      function: {
        name: entry.function.name,
        arguments: entry.function.argsFragments.join(''),
      },
    }));
}
