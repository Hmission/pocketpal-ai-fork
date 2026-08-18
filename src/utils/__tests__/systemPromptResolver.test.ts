import {
  assembleMessages,
  resolveSystemPrompt,
  resolveSystemMessages,
} from '../systemPromptResolver';
import type {Pal} from '../../types/pal';
import type {Model} from '../types';

describe('systemPromptResolver', () => {
  describe('resolveSystemPrompt', () => {
    it('should return parametrized pal system prompt when pal has parameters', () => {
      const pal: Partial<Pal> = {
        systemPrompt: 'You are {{name}}, a {{role}} in {{setting}}.',
        parameters: {
          name: 'Gandalf',
          role: 'wizard',
          setting: 'Middle-earth',
        },
      };

      const result = resolveSystemPrompt({pal: pal as Pal});

      expect(result).toBe('You are Gandalf, a wizard in Middle-earth.');
    });

    it('should return pal system prompt as-is when pal has no parameters', () => {
      const pal: Partial<Pal> = {
        systemPrompt: 'You are a helpful assistant.',
        parameters: {},
      };

      const result = resolveSystemPrompt({pal: pal as Pal});

      expect(result).toBe('You are a helpful assistant.');
    });

    it('should return pal system prompt as-is when pal has undefined parameters', () => {
      const pal: Partial<Pal> = {
        systemPrompt: 'You are a helpful assistant.',
        parameters: undefined,
      };

      const result = resolveSystemPrompt({pal: pal as Pal});

      expect(result).toBe('You are a helpful assistant.');
    });

    it('should fallback to model chat template when pal has no system prompt', () => {
      const pal: Partial<Pal> = {
        systemPrompt: undefined,
      };

      const activeModel: Partial<Model> = {
        chatTemplate: {
          systemPrompt: 'Model default system prompt',
          addGenerationPrompt: false,
          name: '',
          bosToken: '',
          eosToken: '',
          chatTemplate: '',
        },
      };

      const result = resolveSystemPrompt({
        pal: pal as Pal,
        model: activeModel as Model,
      });

      expect(result).toBe('Model default system prompt');
    });

    it('should fallback to model chat template when pal is null', () => {
      const activeModel: Partial<Model> = {
        chatTemplate: {
          systemPrompt: 'Model default system prompt',
          addGenerationPrompt: false,
          name: '',
          bosToken: '',
          eosToken: '',
          chatTemplate: '',
        },
      };

      const result = resolveSystemPrompt({
        pal: null,
        model: activeModel as Model,
      });

      expect(result).toBe('Model default system prompt');
    });

    it('should return empty string when no pal and no model system prompt', () => {
      const result = resolveSystemPrompt({
        pal: null,
        model: null,
      });

      expect(result).toBe('');
    });

    it('should return empty string when model has no chat template', () => {
      const activeModel: Partial<Model> = {
        chatTemplate: undefined,
      };

      const result = resolveSystemPrompt({
        pal: null,
        model: activeModel as Model,
      });

      expect(result).toBe('');
    });

    it('should prioritize pal system prompt over model system prompt', () => {
      const pal: Partial<Pal> = {
        systemPrompt: 'Pal system prompt',
        parameters: {},
      };

      const activeModel: Partial<Model> = {
        chatTemplate: {
          systemPrompt: 'Model system prompt',
          addGenerationPrompt: false,
          name: '',
          bosToken: '',
          eosToken: '',
          chatTemplate: '',
        },
      };

      const result = resolveSystemPrompt({
        pal: pal as Pal,
        model: activeModel as Model,
      });

      expect(result).toBe('Pal system prompt');
    });
  });

  describe('resolveSystemMessages', () => {
    it('should return system message array when system prompt exists', () => {
      const pal: Partial<Pal> = {
        systemPrompt: 'You are a helpful assistant.',
        parameters: {},
      };

      const result = resolveSystemMessages({pal: pal as Pal});

      expect(result).toEqual([
        {
          role: 'system',
          content: 'You are a helpful assistant.',
        },
      ]);
    });

    it('should return empty array when system prompt is empty', () => {
      const result = resolveSystemMessages({
        pal: null,
        model: null,
      });

      expect(result).toEqual([]);
    });

    it('should return empty array when system prompt is whitespace only', () => {
      const activeModel: Partial<Model> = {
        chatTemplate: {
          systemPrompt: '   \n\t  ',
          addGenerationPrompt: false,
          name: '',
          bosToken: '',
          eosToken: '',
          chatTemplate: '',
        },
      };

      const result = resolveSystemMessages({
        pal: null,
        model: activeModel as Model,
      });

      expect(result).toEqual([]);
    });

    it('should return system message array for parametrized pal', () => {
      const pal: Partial<Pal> = {
        systemPrompt: 'You are {{name}}, a {{role}}.',
        parameters: {
          name: 'Alice',
          role: 'teacher',
        },
      };

      const result = resolveSystemMessages({pal: pal as Pal});

      expect(result).toEqual([
        {
          role: 'system',
          content: 'You are Alice, a teacher.',
        },
      ]);
    });
  });

  describe('assembleMessages', () => {
    const sys = (content: string) => ({role: 'system' as const, content});
    const user = {role: 'user' as const, content: 'hello'};

    it('folds the pal prompt and every fragment into one leading system message', () => {
      const result = assembleMessages(
        [sys('Pal prompt')],
        ['FRAGMENT-A', 'FRAGMENT-B'],
        [user],
      );

      expect(result).toEqual([
        {role: 'system', content: 'Pal prompt\n\nFRAGMENT-A\n\nFRAGMENT-B'},
        user,
      ]);
    });

    it('emits the fragments as the sole system message when the pal has none', () => {
      const result = assembleMessages([], ['FRAGMENT'], [user]);

      expect(result).toEqual([{role: 'system', content: 'FRAGMENT'}, user]);
    });

    it('leaves the pal prompt untouched when no talent contributes a fragment', () => {
      const result = assembleMessages([sys('Pal prompt')], [], [user]);

      expect(result).toEqual([{role: 'system', content: 'Pal prompt'}, user]);
    });

    it('drops empty and whitespace-only parts', () => {
      const result = assembleMessages([sys('   ')], ['', '  ', 'REAL'], [user]);

      expect(result).toEqual([{role: 'system', content: 'REAL'}, user]);
    });

    it('produces no system message when there is nothing to say', () => {
      expect(assembleMessages([], [], [user])).toEqual([user]);
    });

    it('keeps the single system message leading, ahead of the conversation', () => {
      const history = [
        {role: 'assistant' as const, content: 'earlier reply'},
        user,
      ];
      const result = assembleMessages(
        [sys('Pal prompt')],
        ['FRAGMENT'],
        history,
      );

      expect(result[0]).toEqual({
        role: 'system',
        content: 'Pal prompt\n\nFRAGMENT',
      });
      expect(result.slice(1)).toEqual(history);
      expect(result.filter(msg => msg.role === 'system')).toHaveLength(1);
    });

    it('normalizes consecutive same-role messages（孤儿 user 修复：上次生成失败无 assistant 落盘 → 连续 user 合并，严格模板不拒绝）', () => {
      const history = [
        {role: 'user' as const, content: '上次失败的消息'}, // 孤儿 user
        {role: 'user' as const, content: '这次的新消息'},
      ];
      const result = assembleMessages([sys('Pal')], [], history);

      expect(result.slice(1)).toEqual([
        {role: 'user', content: '上次失败的消息\n这次的新消息'},
      ]);
    });

    it('normalizes assistant-assistant runs but keeps tool messages adjacent', () => {
      const history = [
        {role: 'assistant' as const, content: '第一段'},
        {role: 'assistant' as const, content: '第二段'},
        {role: 'tool' as const, content: 'tool result', tool_call_id: 't1'},
      ];
      const result = assembleMessages([sys('Pal')], [], history);

      expect(result.slice(1)).toEqual([
        {role: 'assistant', content: '第一段\n第二段'},
        {role: 'tool', content: 'tool result', tool_call_id: 't1'},
      ]);
    });

    it('keeps assistant-with-tool_calls unmerged（合并只针对纯文本段）', () => {
      const history = [
        {
          role: 'assistant' as const,
          content: '',
          tool_calls: [{id: 'c1', type: 'function', function: {name: 'x', arguments: '{}'}}],
        },
        {role: 'assistant' as const, content: '普通回复'},
      ];
      const result = assembleMessages([sys('Pal')], [], history);

      expect(result.slice(1)).toHaveLength(2);
      expect(result[1]).toHaveProperty('tool_calls');
    });
  });
});
