import type {
  TalentEngine,
  TalentResult,
  ToolDefinition,
  SystemPromptContext,
} from './types';
import {addMemory} from '../aiosMemory';

/**
 * Note Save Engine - lets the model proactively save insights/notes
 * to the long-term memory store via function calling.
 */
export class NoteSaveEngine implements TalentEngine {
  readonly name = 'note_save';

  async execute(args: Record<string, any>): Promise<TalentResult> {
    const content = (args.content as string) || '';
    if (!content.trim()) {
      return {
        type: 'error',
        summary: 'content is empty',
        errorMessage: 'content is empty',
      };
    }
    try {
      await addMemory('insight', content);
      return {
        type: 'text',
        summary: `\u5df2\u4fdd\u5b58\u7b14\u8bb0: ${content.slice(0, 40)}`,
      };
    } catch (e) {
      const errMsg = e instanceof Error ? e.message : String(e);
      return {
        type: 'error',
        summary: `note_save failed: ${errMsg}`,
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
          '\u4fdd\u5b58\u7b14\u8bb0/\u6d1e\u5bdf\u5230\u957f\u671f\u8bb0\u5fc6\u5e93\u3002\u5f53\u5927\u738b\u63d0\u5230\u9700\u8981\u8bb0\u4f4f\u7684\u4e8b\u65f6\u8c03\u7528\u3002',
        parameters: {
          type: 'object',
          properties: {
            content: {
              type: 'string',
              description: '\u8981\u4fdd\u5b58\u7684\u7b14\u8bb0\u5185\u5bb9',
            },
          },
          required: ['content'],
        },
      },
    };
  }

  systemPromptFragment(_ctx: SystemPromptContext): string | null {
    return null;
  }
}
