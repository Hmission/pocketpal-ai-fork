/**
 * 上下文治理决策机测试（批次 A：纯函数核心）。
 */
import {decideContextAction, ContextPolicy} from '../decision';

const base = (
  overrides: Partial<Parameters<typeof decideContextAction>[0]> = {},
) => ({
  used: 4096, // 0.8 × 5120
  nCtx: 5120,
  canExpand: true,
  policy: 'ask' as ContextPolicy,
  ...overrides,
});

describe('decideContextAction', () => {
  describe('阈值内（send）', () => {
    it('低于 0.8×n_ctx 时任何策略都 send', () => {
      for (const policy of ['expand', 'compact', 'ask'] as ContextPolicy[]) {
        expect(decideContextAction(base({used: 4095, policy}))).toBe('send');
      }
    });

    it('正好 0.8×n_ctx 时触发（不进 send）', () => {
      expect(
        decideContextAction(base({used: 0.8 * 5120, policy: 'ask'})),
      ).not.toBe('send');
    });

    it('B19.1 预留缺省 0 向后兼容：79% 仍 send', () => {
      expect(
        decideContextAction(base({used: 0.79 * 5120, policy: 'compact'})),
      ).toBe('send');
    });
  });

  describe('B19.1 生成预留触发线', () => {
    it('79% + 预留 512 → 触发（单轮无法从阈值下跳满）', () => {
      // 0.79×5120=4045，+512=4557 ≥ 0.8×5120=4096
      expect(
        decideContextAction(
          base({used: 4045, policy: 'compact', generationReserve: 512}),
        ),
      ).toBe('compact');
    });

    it('预留未跨线仍 send', () => {
      // 3500 + 512 = 4012 < 4096
      expect(
        decideContextAction(
          base({used: 3500, policy: 'compact', generationReserve: 512}),
        ),
      ).toBe('send');
    });
  });

  describe('expand 策略', () => {
    it('内存可扩 → expand', () => {
      expect(decideContextAction(base({policy: 'expand'}))).toBe('expand');
    });

    it('已到天花板（canExpand=false）→ 自动转 compact', () => {
      expect(
        decideContextAction(base({policy: 'expand', canExpand: false})),
      ).toBe('compact');
    });
  });

  describe('compact 策略', () => {
    it('无论是否可扩窗都直接 compact', () => {
      expect(decideContextAction(base({policy: 'compact'}))).toBe('compact');
      expect(
        decideContextAction(base({policy: 'compact', canExpand: false})),
      ).toBe('compact');
    });
  });

  describe('ask 策略（人机协作默认）', () => {
    it('内存可扩 → 询问用户（ask）', () => {
      expect(decideContextAction(base({policy: 'ask'}))).toBe('ask');
    });

    it('已到天花板 → 无选择余地，直接 compact', () => {
      expect(decideContextAction(base({policy: 'ask', canExpand: false}))).toBe(
        'compact',
      );
    });
  });

  describe('自定义阈值', () => {
    it('低阈值提前触发', () => {
      expect(
        decideContextAction(base({used: 2000, nCtx: 4000, threshold: 0.5})),
      ).toBe('ask');
    });
  });
});
