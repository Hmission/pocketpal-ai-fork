import {
  CARD_METADATA_KEYS,
  isNonDialogueCard,
  isTaskActionCard,
  isTaskErrorCard,
  isGeneratingTaskCard,
} from '../messageCards';

/**
 * 锁 `utils/messageCards` 的判定口径（PHONE_SPEC §14.1）。
 *
 * 这份 util 是从两处并列枚举收敛来的，因此它必须同时守住两条**不同**语义：
 * 字幕过滤要「所有非对话卡」，动作槽只要「可操作任务卡」。
 * 下面 `system 卡不给动作槽` 一例就是防有人把两者当成一个集合合并——
 * 那样做不会报错，只会让系统提示长出一个「再来一张」按钮。
 */

const card = (metadata?: Record<string, unknown>, imageUris?: string[]) =>
  ({
    id: 'm1',
    type: 'text',
    text: 'x',
    createdAt: new Date(),
    author: {id: 'a1', name: '', avatar: ''},
    ...(metadata ? {metadata} : {}),
    ...(imageUris ? {imageUris} : {}),
  }) as never;

describe('messageCards — 卡片标记单一清单', () => {
  it('清单里 8 个标记全部判为非对话卡（字幕不显示）', () => {
    expect(CARD_METADATA_KEYS).toHaveLength(8);
    CARD_METADATA_KEYS.forEach(key => {
      expect(isNonDialogueCard(card({[key]: true}))).toBe(true);
    });
  });

  it('butler 卡**不是**非对话卡：管家直答会被原地回写成真正回复文本', () => {
    expect(isNonDialogueCard(card({butler: true, userText: '你好'}))).toBe(
      false,
    );
  });

  it('无 metadata / 标记为 false / 标记为 null 都不算卡片', () => {
    expect(isNonDialogueCard(card())).toBe(false);
    expect(isNonDialogueCard(card({imageTask: false}))).toBe(false);
    expect(isNonDialogueCard(card({system: null}))).toBe(false);
  });

  it('动作槽只认可操作卡：system / captionTask 不得长出按钮', () => {
    expect(isTaskActionCard(card({imageTask: true}))).toBe(true);
    expect(isTaskActionCard(card({editTask: true}))).toBe(true);
    // 关键回归防线：把全集当动作槽集合用就会在这里红
    expect(isTaskActionCard(card({system: true}))).toBe(false);
    expect(isTaskActionCard(card({captionTask: true}))).toBe(false);
    expect(isTaskActionCard(card({taskError: {code: 'no_model'}}))).toBe(false);
    expect(isTaskErrorCard(card({taskError: {code: 'no_model'}}))).toBe(true);
  });

  it('生成中占位卡三态：未回写=动效，回写图片后/失败标记后=动作条', () => {
    expect(isGeneratingTaskCard(card({imageTask: true}))).toBe(true);
    expect(
      isGeneratingTaskCard(card({imageTask: true}, ['file:///a.png'])),
    ).toBe(false);
    expect(
      isGeneratingTaskCard(card({imageTask: true, imageTaskFailed: true})),
    ).toBe(false);
    expect(
      isGeneratingTaskCard(card({editTask: true, editTaskFailed: true})),
    ).toBe(false);
    // 非任务卡永远不进动效分支
    expect(isGeneratingTaskCard(card({system: true}))).toBe(false);
  });
});
