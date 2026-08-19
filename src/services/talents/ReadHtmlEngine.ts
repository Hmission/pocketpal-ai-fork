/**
 * ReadHtmlEngine — read_html 工具（P8 玩具工坊迭代闭环，PLAY_SPEC v1.6）。
 *
 * 改→存→开闭环的「读回」侧：模型要迭代修改已有玩具时，按 title 从玩具箱
 * 读回成品原文——长 html 不常驻上下文（token 锋利），模型按需读一次、改完
 * render_html 输出完整新版（title 保持一致 = upsert 覆盖存档）。
 *
 * 文件即存档（同 adventure_state 模式）：JS 零业务逻辑，只读 workspace/toys/
 * 的 index.json + <id>.html。title 精确匹配，同名取最新；未命中返回错误
 * 并附候选清单（不静默、不模糊猜）。
 */
import {listToys, readToy} from '../toyChest';
import type {TalentEngine, TalentResult, ToolDefinition, SystemPromptContext} from './types';

export class ReadHtmlEngine implements TalentEngine {
  readonly name = 'read_html';

  async execute(args: Record<string, any>): Promise<TalentResult> {
    const title = typeof args.title === 'string' ? args.title.trim() : '';
    if (!title) {
      return {
        type: 'error',
        summary: 'read_html 需要 title 参数（要修改的玩具名称）。',
        errorMessage: 'MISSING_TITLE',
      };
    }
    const entries = await listToys();
    // title 精确匹配，同名取最新（列表新→旧，首个即最新）
    const entry = entries.find(e => e.title === title);
    if (!entry) {
      const candidates = entries.map(e => e.title);
      return {
        type: 'error',
        summary: `玩具箱里没有「${title}」。可用的玩具有：${candidates.join('、') || '（空）'}。`,
        errorMessage: 'TOY_NOT_FOUND',
      };
    }
    const html = await readToy(entry.id);
    if (!html) {
      return {
        type: 'error',
        summary: `「${title}」的成品文件缺失（玩具箱数据损坏）。`,
        errorMessage: 'TOY_FILE_MISSING',
      };
    }
    return {
      type: 'text',
      // summary 即模型消费的 tool content（executeOne → responseContent）：
      // 引导语 + 原文全文，模型直接基于原文修改。
      summary:
        `已读回「${title}」成品原文（${html.length} 字符）。请基于这份原文修改，` +
        `不要从零重写；改完调用 render_html 输出完整新版，title 保持「${title}」` +
        '（同名覆盖存档 = 迭代，不会新建重复条目）。\n\n原文如下：\n' +
        html,
    };
  }

  toToolDefinition(): ToolDefinition {
    return {
      type: 'function',
      function: {
        name: 'read_html',
        description:
          'Read back the current source of an existing toy (by title) from the toy chest. ' +
          'MUST be used before modifying/upgrading any previously built toy — never rewrite ' +
          'a toy from memory. Then call render_html with the complete updated version.',
        parameters: {
          type: 'object',
          properties: {
            title: {
              type: 'string',
              description:
                'Exact title of the toy to modify (e.g. "贪吃蛇"). Same title on render_html overwrites the stored toy.',
            },
          },
          required: ['title'],
        },
      },
    };
  }

  systemPromptFragment(_ctx: SystemPromptContext): string | null {
    return (
      'When the user (大王) asks to modify / upgrade / continue an existing toy ' +
      '(e.g. "把贪吃蛇改成红色" / "继续改玩具「贪吃蛇」"), you MUST first call read_html ' +
      'with that title to get the current source, then change only what was asked and ' +
      'call render_html with the COMPLETE updated page. Keep the SAME title so the toy ' +
      'chest overwrites the old version instead of piling up duplicates. Never rewrite ' +
      'the toy from scratch or describe changes without delivering the finished page.\n'
    );
  }
}
