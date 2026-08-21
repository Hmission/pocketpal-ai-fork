import * as RNFS from '@dr.pogodin/react-native-fs';

import type {
  TalentEngine,
  TalentResult,
  ToolDefinition,
  SystemPromptContext,
} from './types';
import {AIOS_ADVENTURE_DIR} from '../../utils/paths';
import {readSection, appendSection} from '../workspace/docStore';
import {emit} from '../../debug/eventStream';

/**
 * AdventureStateEngine — TRPG 城主状态工具（P12，ADVENTURE_SPEC v1；
 * WORKSPACE_SPEC v1 2026-08-21 增多文档动作）。
 *
 * 状态即规则：模型是城主，代码是纸笔——JS 层零业务逻辑，只存取
 * workspace/adventure/state.json（HP/位置/背包/事件计数，schema 自由
 * 扩展不校验）与分文档世界档案（世界设定/角色卡/剧情 md，复用 docStore
 * 分段读取原语：正文按需 read 单节，不预注入上下文）。
 *
 * 文件即存档：每次 set/append 落盘共享存储，重启/换会话冒险不丢。
 * 上限 20KB 防膨胀（超限显式拒绝，不静默截断）。
 */
export class AdventureStateEngine implements TalentEngine {
  readonly name = 'adventure_state';

  /** 多文档白名单（防任意路径写盘）。 */
  private static readonly DOC_WHITELIST = ['世界设定', '角色卡', '剧情'] as const;

  private get statePath(): string {
    return `${AIOS_ADVENTURE_DIR}/state.json`;
  }

  private docPath(doc: string): string | null {
    const clean = doc.trim();
    if (!(AdventureStateEngine.DOC_WHITELIST as readonly string[]).includes(clean)) {
      return null;
    }
    return `${AIOS_ADVENTURE_DIR}/${clean}.md`;
  }

  private async readState(): Promise<Record<string, any> | null> {
    try {
      if (!(await RNFS.exists(this.statePath))) {
        return null;
      }
      const raw = await RNFS.readFile(this.statePath, 'utf8');
      const parsed = JSON.parse(raw);
      return typeof parsed === 'object' && parsed !== null ? parsed : null;
    } catch {
      return null;
    }
  }

  async execute(args: Record<string, any>): Promise<TalentResult> {
    const action = (args.action as string) || '';

    if (action === 'get') {
      const state = await this.readState();
      if (!state) {
        return {
          type: 'error',
          summary:
            '尚未开档。告诉用户：冒险还没有开始，让城主（你）先开启一段冒险，或用 adventure_state reset 开新档。',
          errorMessage: 'NO_ADVENTURE_YET',
        };
      }
      return {
        type: 'text',
        summary: `当前冒险状态：\n${JSON.stringify(state, null, 2)}`,
      };
    }

    if (action === 'set') {
      const incoming = args.state;
      if (typeof incoming !== 'object' || incoming === null) {
        return {
          type: 'error',
          summary: 'adventure_state set 需要 state 对象参数。',
          errorMessage: 'INVALID_STATE',
        };
      }
      try {
        const merged = {...(await this.readState()), ...incoming};
        const raw = JSON.stringify(merged);
        if (raw.length > MAX_STATE_BYTES) {
          return {
            type: 'error',
            summary: '冒险状态超过 20KB 上限，请精简状态字段。',
            errorMessage: 'STATE_TOO_LARGE',
          };
        }
        await RNFS.writeFile(this.statePath, raw, 'utf8');
        return {
          type: 'text',
          summary: `冒险状态已更新：\n${JSON.stringify(merged, null, 2)}`,
        };
      } catch (e) {
        return {
          type: 'error',
          summary: `冒险状态写入失败：${(e as Error)?.message ?? '未知错误'}`,
          errorMessage: 'WRITE_FAILED',
        };
      }
    }

    if (action === 'reset') {
      try {
        if (await RNFS.exists(this.statePath)) {
          await RNFS.unlink(this.statePath);
        }
        return {
          type: 'text',
          summary: '冒险已清档（reset）。开启一段全新的冒险吧。',
        };
      } catch (e) {
        return {
          type: 'error',
          summary: `清档失败：${(e as Error)?.message ?? '未知错误'}`,
          errorMessage: 'RESET_FAILED',
        };
      }
    }

    // WORKSPACE_SPEC（2026-08-21）：多文档世界档案——按节读取/续写
    //（世界设定/角色卡/剧情 md 与 state.json 并存，正文不预注入）。
    if (action === 'read' || action === 'append') {
      const doc = String(args.doc ?? '');
      const path = this.docPath(doc);
      if (path) {
        emit('chat', 'workspace.adventure_state', {action, doc});
      }
      if (!path) {
        return {
          type: 'error',
          summary: `文档「${doc}」不在白名单（${AdventureStateEngine.DOC_WHITELIST.join('/')}）。`,
          errorMessage: 'UNKNOWN_DOC',
        };
      }
      if (action === 'read') {
        const section = String(args.section ?? '').trim();
        if (!section) {
          return {
            type: 'error',
            summary: 'read 需要 section 参数（节名）。',
            errorMessage: 'EMPTY_SECTION',
          };
        }
        const hit = await readSection(path, section);
        if (!hit) {
          return {
            type: 'error',
            summary: `「${section}」节不存在，先按世界观需要 append 创建。`,
            errorMessage: 'NO_SECTION',
          };
        }
        return {
          type: 'text',
          summary: `## ${hit.section}\n${hit.content || '（空节）'}`,
        };
      }
      const section = String(args.section ?? '').trim();
      const content = String(args.content ?? '').trim();
      if (!section || !content) {
        return {
          type: 'error',
          summary: 'append 需要 section 与 content 参数。',
          errorMessage: 'EMPTY_CONTENT',
        };
      }
      const result = await appendSection(path, section, content);
      if (!result.ok) {
        return {
          type: 'error',
          summary: result.error === 'DOC_TOO_LARGE'
            ? `${doc} 超 20KB 上限，本次未写入（精简或开新节）。`
            : '写入失败，内容未落盘。',
          errorMessage: result.error ?? 'WRITE_FAILED',
        };
      }
      return {
        type: 'text',
        summary: `已写入${doc}「${section}」节 ${content.length} 字，世界档案已落盘。`,
      };
    }

    return {
      type: 'error',
      summary:
        'adventure_state 支持 get / set / reset / read / append，未知动作「' +
        action +
        '」。',
      errorMessage: `Unknown action: ${action}`,
    };
  }

  toToolDefinition(): ToolDefinition {
    return {
      type: 'function',
      function: {
        name: this.name,
        description:
          'TRPG 冒险状态管理：get 读当前状态（HP/位置/背包等）；set 更新状态（JSON 合并写入）；reset 清档开新冒险；' +
          'read 按节读世界档案（世界设定/角色卡/剧情，正文不预注入，需要时自取）；append 续写世界档案（每节一文件 ≤20KB）。你是城主，主动维护冒险世界。',
        parameters: {
          type: 'object',
          properties: {
            action: {
              type: 'string',
              enum: ['get', 'set', 'reset', 'read', 'append'],
              description: 'get 读取 / set 更新 / reset 清档 / read 读世界档案节 / append 写世界档案节',
            },
            state: {
              type: 'object',
              description: 'set 时的状态字段（如 {hp: 8, 位置: "黑森林", 背包: ["火把"]}）',
            },
            doc: {
              type: 'string',
              description: 'read/append 的档案文档：世界设定 / 角色卡 / 剧情',
            },
            section: {
              type: 'string',
              description: 'read/append 的节名（如「黑森林」「队长阿岚」）',
            },
            content: {
              type: 'string',
              description: 'append 的内容',
            },
          },
          required: ['action'],
        },
      },
    };
  }

  systemPromptFragment(_ctx: SystemPromptContext): string | null {
    return (
      'You are the dungeon master (城主) when an adventure is active. Write vivid ' +
      'Chinese adventure scenes; the user is 大王. Maintain the adventure world with ' +
      'the adventure_state tool: track hp/位置/背包/事件计数 by calling set after each ' +
      'major event, read prior state with get, resolve outcomes narratively (e.g. ' +
      '1d20-style luck in plain words). Keep the world bible in project docs — append ' +
      '世界设定/角色卡/剧情 sections when the campaign starts or grows, and read them ' +
      'before continuing a campaign so the world survives across sessions. Call reset ' +
      'when an adventure ends. Never break the fiction to discuss tools.'
    );
  }
}

const MAX_STATE_BYTES = 20 * 1024;
