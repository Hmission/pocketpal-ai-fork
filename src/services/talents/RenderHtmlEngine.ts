import {TalentEngine, TalentResult, ToolDefinition} from './types';

/**
 * Engine for the `render_html` talent.
 *
 * Arguments:
 *   - `html` (string, required): the HTML document (or fragment) to render.
 *   - `title` (string, optional): a short label shown above the preview.
 *
 * Security model: this engine is a pure pass-through — sanitization is the
 * WebView wrapper's job. See HtmlPreviewBubble for the actual envelope:
 * strict CSP (default-src 'none', no network/external fetch), but JavaScript
 * IS enabled with 'unsafe-inline' + 'unsafe-eval' for interactive HTML/games.
 * Navigation is pinned to about:blank; no native bridge surface.
 */
export class RenderHtmlEngine implements TalentEngine {
  readonly name = 'render_html';
  readonly recommendedContextTokens = 4096;

  async execute(args: Record<string, any>): Promise<TalentResult> {
    const html = typeof args.html === 'string' ? args.html : '';
    const title = typeof args.title === 'string' ? args.title : undefined;

    if (!html) {
      return {
        type: 'error',
        summary: 'render_html: missing or empty "html" argument',
        errorMessage:
          'html argument is required and must be a non-empty string',
      };
    }

    return {
      type: 'html',
      html,
      title,
      summary: `[render_html SUCCESS] The html has been rendered into a preview above, and the user can see and toggle to see the code. 
Reply with at most one short sentence what you build`,
    };
  }

  toToolDefinition(): ToolDefinition {
    return {
      type: 'function',
      function: {
        name: 'render_html',
        description:
          'Render an HTML document inline as a visual preview in the chat.',
        parameters: {
          type: 'object',
          properties: {
            title: {
              type: 'string',
              description: 'Short label shown above the preview.',
            },
            html: {
              type: 'string',
              description:
                'Complete, self-contained HTML document or fragment to render.',
            },
          },
          required: ['html'],
        },
      },
    };
  }

  /**
   * 玩具匠人格（PLAY_SPEC v1）：render_html 激活时注入——产出物是「能玩的东西」，
   * 不是文档。约束：单文件自包含、中文界面、必带 title、JS/canvas 优先。
   * 沙盒边界由 HtmlPreviewBubble 强制（CSP 禁网，JS 仅全屏 modal 开启），本片段不承诺安全。
   */
  systemPromptFragment(): string | null {
    return (
      'When you call render_html, act as a TOY CRAFTSMAN, not an engineer.\n' +
      '- Build small, self-contained, instantly playable toys: mini games (snake, ' +
      'tic-tac-toe, whack-a-mole, memory cards), generators (random picker, lucky ' +
      'wheel, fortune sticks), or generative art (canvas animations).\n' +
      '- Single-file HTML only: inline CSS + JS, no external assets, no network.\n' +
      '- UI text must be Simplified Chinese; the toy must work on a narrow phone screen.\n' +
      '- ALWAYS pass a short Chinese title (e.g. \"贪吃蛇\") so it can be saved to the toy chest.\n' +
      '- Keep the code under ~150 lines when possible; prefer fun over completeness.'
    );
  }
}
