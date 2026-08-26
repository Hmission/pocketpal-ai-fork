import type {
  TalentEngine,
  TalentResult,
  ToolDefinition,
  SystemPromptContext,
} from './types';
import {readScreen, SCREEN_READER_DISABLED} from '../../utils/screenReader';

/**
 * Device Control Engine — 只读子集（SCREENWATCH_SPEC v1，P11）。
 *
 * 只围观不干活：read_screen（读当前屏 a11y 精简树）/ find_app（树中查应用）。
 * 写操作（tap/input/scroll）永久边界外——工具枚举不暴露，代码不存在。
 * 服务未开启 → 显式返回引导文案（不静默）。
 */
export class DeviceControlEngine implements TalentEngine {
  readonly name = 'device_control';

  async execute(args: Record<string, any>): Promise<TalentResult> {
    const action = (args.action as string) || '';

    if (action === 'read_screen' || action === 'find_app') {
      let tree: string;
      try {
        tree = await readScreen();
      } catch (e) {
        const code = (e as any)?.code;
        if (code === SCREEN_READER_DISABLED) {
          return {
            type: 'error',
            summary:
              '读屏服务未开启。告诉用户：到「系统设置 → 无障碍 → 已下载的应用」中开启小黄鸡的读屏服务，或到工具配置页点授权跳转。',
            errorMessage: '读屏服务未开启（SCREEN_READER_DISABLED）',
          };
        }
        return {
          type: 'error',
          summary: `读屏失败：${(e as Error)?.message ?? '未知错误'}`,
          errorMessage: '读屏失败',
        };
      }

      if (action === 'find_app') {
        const target = String(args.target ?? '').toLowerCase();
        const matched = tree
          .split('\n')
          .filter(line => target && line.toLowerCase().includes(target));
        return {
          type: 'text',
          summary:
            matched.length > 0
              ? `找到匹配「${args.target}」的屏幕元素：\n${matched.join('\n')}`
              : `当前屏幕未找到「${args.target}」。\n当前屏幕内容：\n${tree}`,
        };
      }

      // read_screen：把精简树交给模型围观点评（不指挥操作）
      return {
        type: 'text',
        summary: `这是用户当前屏幕的无障碍精简树：\n${tree}\n\n看一眼屏幕，以女妖口吻点评 1-2 句（可吐槽可关心），不要指挥用户操作。`,
      };
    }

    return {
      type: 'error',
      summary: `device_control 仅支持 read_screen / find_app（只读围观），未知动作「${action}」。`,
      errorMessage: `Unknown action: ${action}`,
    };
  }

  toToolDefinition(): ToolDefinition {
    return {
      type: 'function',
      function: {
        name: this.name,
        description:
          '读屏围观（只读）：读取用户当前屏幕内容（无障碍精简树），用于了解用户在做什么并点评。不执行任何点击/输入/滑动操作。',
        parameters: {
          type: 'object',
          properties: {
            action: {
              type: 'string',
              enum: ['read_screen', 'find_app'],
              description:
                '要执行的操作：read_screen 读当前屏；find_app 在屏幕树中查找元素',
            },
            target: {
              type: 'string',
              description:
                'find_app 时查找的目标（应用名/控件文本），read_screen 可省略',
            },
          },
          required: ['action'],
        },
      },
    };
  }

  systemPromptFragment(_ctx: SystemPromptContext): string | null {
    return (
      'When you use device_control, you are an ONLOOKER, not an operator. ' +
      "You read the user's current screen (accessibility tree) to know what they are doing, " +
      'then comment in 1-2 playful or caring sentences as the butler (女妖). ' +
      'NEVER instruct the user to operate, NEVER suggest tapping anything — watching is enough.'
    );
  }
}
