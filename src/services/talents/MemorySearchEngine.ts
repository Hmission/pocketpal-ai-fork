import type {
  TalentEngine,
  TalentResult,
  ToolDefinition,
  SystemPromptContext,
} from './types';
import {searchMemory} from '../aiosMemory';

/**
 * Memory Search Engine - Agentic RAG talent.
 * Lets the model actively retrieve local memories/conversations/knowledge
 * via function calling.
 */
export class MemorySearchEngine implements TalentEngine {
  readonly name = 'search_memory';
  readonly recommendedContextTokens = 500;

  async execute(args: Record<string, any>): Promise<TalentResult> {
    const query = (args.query as string) || (args.q as string) || '';
    if (!query.trim()) {
      return {
        type: 'error',
        summary: 'query is empty',
        errorMessage: 'query is empty',
      };
    }
    try {
      const fragments = await searchMemory(query, 5);
      if (fragments.length === 0) {
        return {
          type: 'text',
          summary: '\u6ca1\u6709\u627e\u5230\u76f8\u5173\u8bb0\u5fc6\u3002',
        };
      }
      return {type: 'text', summary: fragments.join('\n---\n')};
    } catch (e) {
      const errMsg = e instanceof Error ? e.message : String(e);
      return {
        type: 'error',
        summary: `search_memory failed: ${errMsg}`,
        errorMessage: errMsg,
      };
    }
  }

  toToolDefinition(): ToolDefinition {
    return {
      type: 'function',
      function: {
        name: this.name,
        description:
          '\u68c0\u7d22\u672c\u5730\u8bb0\u5fc6/\u5bf9\u8bdd\u65e5\u5fd7/\u77e5\u8bc6\u5e93\u3002\u5f53\u9700\u8981\u56de\u5fc6\u4e4b\u524d\u804a\u8fc7\u7684\u5185\u5bb9\u6216\u5927\u738b\u7684\u4fe1\u606f\u65f6\u8c03\u7528\u3002',
        parameters: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: '\u68c0\u7d22\u5173\u952e\u8bcd\u6216\u95ee\u9898',
            },
          },
          required: ['query'],
        },
      },
    };
  }

  systemPromptFragment(_ctx: SystemPromptContext): string | null {
    return null;
  }
}
