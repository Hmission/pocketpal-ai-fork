import * as RNFS from '@dr.pogodin/react-native-fs';

import type {
  TalentEngine,
  TalentResult,
  ToolDefinition,
  SystemPromptContext,
} from './types';
import {AIOS_ADVENTURE_DIR} from '../../utils/paths';

/**
 * AdventureStateEngine — TRPG 城主状态工具（P12，ADVENTURE_SPEC v1）。
 *
 * 状态即规则：模型是城主，代码是纸笔——JS 层零业务逻辑，只存取
 * workspace/adventure/state.json。get/set/reset 三动作，模型自主维护
 * HP/位置/背包/事件计数（schema 自由扩展，不校验）。
 *
 * 文件即存档：每次 set 落盘共享存储，重启/换会话冒险不丢。
 * 上限 20KB 防膨胀（超限显式拒绝，不静默截断）。
 */
export class AdventureStateEngine implements TalentEngine {
  readonly name = 'adventure_state';

  private get statePath(): string {
    return `${AIOS_ADVENTURE_DIR}/state.json`;
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

    return {
      type: 'error',
      summary: `adventure_state 仅支持 get / set / reset，未知动作「${action}」。`,
      errorMessage: `Unknown action: ${action}`,
    };
  }

  toToolDefinition(): ToolDefinition {
    return {
      type: 'function',
      function: {
        name: this.name,
        description:
          'TRPG 冒险状态管理：get 读当前状态（HP/位置/背包等）；set 更新状态（JSON 合并写入）；reset 清档开新冒险。你是城主，主动维护冒险世界。',
        parameters: {
          type: 'object',
          properties: {
            action: {
              type: 'string',
              enum: ['get', 'set', 'reset'],
              description: 'get 读取 / set 更新 / reset 清档',
            },
            state: {
              type: 'object',
              description: 'set 时的状态字段（如 {hp: 8, 位置: "黑森林", 背包: ["火把"]}）',
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
      '1d20-style luck in plain words). Call reset when an adventure ends. ' +
      'Never break the fiction to discuss tools.'
    );
  }
}

const MAX_STATE_BYTES = 20 * 1024;
