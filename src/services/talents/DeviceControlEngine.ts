import type {
  TalentEngine,
  TalentResult,
  ToolDefinition,
  SystemPromptContext,
} from './types';

/**
 * Device Control Engine (Phase 2 skeleton).
 *
 * Based on Android AccessibilityService: read screen / simulate tap /
 * input text / scroll. This is the mobile equivalent of "Computer Use".
 *
 * Phase 2: only the talent interface is defined here. Full implementation
 * requires a native AccessibilityService module + user-granted permission.
 */
export class DeviceControlEngine implements TalentEngine {
  readonly name = 'device_control';

  async execute(args: Record<string, any>): Promise<TalentResult> {
    const action = (args.action as string) || '';
    return {
      type: 'error',
      summary:
        `device_control (${action}) is a Phase 2 feature. ` +
        'Requires AccessibilityService permission. Not yet implemented.',
      errorMessage: 'Not implemented (Phase 2)',
    };
  }

  toToolDefinition(): ToolDefinition {
    return {
      type: 'function',
      function: {
        name: this.name,
        description:
          '\u64cd\u4f5c\u624b\u673a\u8bbe\u5907\uff08\u8bfb\u5c4f/\u6a21\u62df\u70b9\u51fb/\u8f93\u5165\u6587\u672c/\u6ed1\u52a8\uff09\u3002Phase 2 \u9884\u7559\uff0c\u5f53\u524d\u672a\u5b9e\u73b0\u3002',
        parameters: {
          type: 'object',
          properties: {
            action: {
              type: 'string',
              enum: ['read_screen', 'tap', 'input_text', 'scroll', 'find_app'],
              description: '\u8981\u6267\u884c\u7684\u64cd\u4f5c',
            },
            args: {
              type: 'object',
              description: '\u64cd\u4f5c\u53c2\u6570\uff08\u5750\u6807/\u6587\u672c/\u65b9\u5411\u7b49\uff09',
            },
          },
          required: ['action'],
        },
      },
    };
  }

  systemPromptFragment(_ctx: SystemPromptContext): string | null {
    return null;
  }
}
