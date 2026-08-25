/**
 * 会话内压缩编排测试（批次 B：摘要执行）。
 * 编排逻辑聚焦：区间选择/预算驱动/增量锚点；摘要生成 mock 隔离。
 */
import {compressSession} from '../index';
import {summarizeConversation} from '../summarizer';
import {appendConversation} from '../../aiosMemory/conversationLog';
import type {MessageType} from '../../../utils/types';

jest.mock('../summarizer', () => {
  // B19.1：tokenBudgetToMaxChars 用真实实现（预算裁剪是被测链路的一部分），
  // 仅 mock 掉推理 IO（summarizeConversation）。
  const actual = jest.requireActual('../summarizer');
  return {
    ...actual,
    summarizeConversation: jest.fn(),
  };
});

jest.mock('../../aiosMemory/conversationLog', () => ({
  appendConversation: jest.fn().mockResolvedValue(undefined),
}));

const mockSummarize = summarizeConversation as jest.Mock;

const userMsg = (i: number): MessageType.Text => ({
  author: {id: 'y9d7f8pgn'},
  id: `u${i}`,
  text: `用户消息${i}（内容足够长以确保能被选中）`,
  type: 'text',
});

const assistantMsg = (i: number): MessageType.AssistantTurn => ({
  author: {id: 'h3o3lc5xj'},
  id: `a${i}`,
  type: 'assistant_turn',
  steps: [{content: `助手回复${i}（内容足够长以确保能被选中）`}],
});

/** 10 条消息（5 轮）的会话。 */
const tenMessages = (): MessageType.Any[] =>
  Array.from({length: 5}, (_, i) => [userMsg(i), assistantMsg(i)]).flat();

describe('compressSession', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSummarize.mockResolvedValue('这是一段足够长的压缩摘要');
  });

  it('消息太少（≤保护条数）返回 null', async () => {
    expect(
      await compressSession({messages: tenMessages().slice(0, 4)}),
    ).toBeNull();
    expect(mockSummarize).not.toHaveBeenCalled();
  });

  it('默认压最旧区间，保护最近 4 条', async () => {
    const msgs = tenMessages();
    const result = await compressSession({messages: msgs});
    expect(result).not.toBeNull();
    expect(result!.compactedCount).toBe(6);
    expect(result!.anchorMessageId).toBe('u0');
    // 保护最近 4 条（a2..a4）
    expect(result!.compactedMessageIds).toEqual([
      'u0',
      'a0',
      'u1',
      'a1',
      'u2',
      'a2',
    ]);
    // 摘要文本带大王:/女妖: 前缀
    const input = mockSummarize.mock.calls[0][0];
    expect(input.dialogueText).toContain('大王: 用户消息0');
    expect(input.dialogueText).toContain('女妖: 助手回复1');
    expect(input.priorSummary).toBeUndefined();
    // 落盘当日日志
    expect(appendConversation).toHaveBeenCalledWith(
      '【上下文压缩】早期对话摘要',
      '这是一段足够长的压缩摘要',
    );
  });

  it('targetReleaseTokens 提前停止（预算缺口驱动）', async () => {
    const result = await compressSession({
      messages: tenMessages(),
      targetReleaseTokens: 10, // 1-2 条即达标
    });
    expect(result!.compactedCount).toBeLessThan(6);
  });

  it('已有锚点 → 增量压缩：锚点包含进重压区间 + priorSummary 传入', async () => {
    const msgs = tenMessages();
    msgs[0].metadata = {
      compaction: {summary: '旧摘要', messageIds: [], count: 0, ts: 1},
    };
    msgs[1].metadata = {compacted: true};
    const result = await compressSession({messages: msgs});
    // 从锚点（u0）起重压
    expect(result!.anchorMessageId).toBe('u0');
    expect(result!.compactedMessageIds).toContain('u0');
    expect(mockSummarize.mock.calls[0][0].priorSummary).toBe('旧摘要');
  });

  it('maxMessages 不再限条数（WORKSPACE_SPEC：手动路径压全部可压区间）', async () => {
    const result = await compressSession({
      messages: tenMessages(),
      maxMessages: 4, // 旧语义已废弃，忽略
    });
    expect(result!.compactedCount).toBe(6); // 全部可压区间（10-4）
  });

  it('WORKSPACE_SPEC 裁剪一致性：对话文本超预算时 slice 收缩（被压=进摘要，v1.2 预算随 nCtx 上探）', async () => {
    // 7 条消息（3 轮长 + 1 轮短）：可压区间 3 条（u0/a0/u1 各 ~2500 字），
    // nCtx 4096 → 预算 min(12000, 3696)=3696 字符 → 裁掉 a0/u1 只压 1 条 u0
    // （旧 8192 档预算 6000 可容 2 条——v1.2 预算上限上探后该档容 3 条，
    //  故用更小 nCtx 保留「超预算收缩」语义）
    const longMsgs: MessageType.Any[] = [
      {...userMsg(0), text: '甲'.repeat(2500)} as MessageType.Text,
      {
        ...assistantMsg(0),
        steps: [{content: '乙'.repeat(2500)}],
      } as MessageType.AssistantTurn,
      {...userMsg(1), text: '丙'.repeat(2500)} as MessageType.Text,
      assistantMsg(1),
      userMsg(2),
      assistantMsg(2),
      userMsg(3),
    ];
    const result = await compressSession({messages: longMsgs, nCtx: 4096});
    // 预算 3696 字符只能容纳首条（2500+前缀）→ 被压消息 = 进摘要的消息
    expect(result!.compactedCount).toBe(1);
    expect(result!.compactedMessageIds).toEqual(['u0']);
    expect(
      mockSummarize.mock.calls[0][0].dialogueText.length,
    ).toBeLessThanOrEqual(3696);
    // 超预算的 a0/u1 未被标记（保持可压区间，下轮续压）
    expect(result!.compactedMessageIds).not.toContain('u1');
    expect(result!.compactedMessageIds).not.toContain('a0');
  });

  it('WORKSPACE_SPEC 裁剪后释放不足且无可裁 → 诚实 null（不静默欠释放）', async () => {
    const longMsgs: MessageType.Any[] = [
      {...userMsg(0), text: '甲'.repeat(4000)} as MessageType.Text,
      assistantMsg(0),
      assistantMsg(1),
    ];
    // 首条 4000 字符 + 预算 3696 → 裁到只剩 1 条仍超预算；target 缺口大 → 释放不足
    const result = await compressSession({
      messages: longMsgs,
      nCtx: 4096,
      targetReleaseTokens: 99999,
    });
    expect(result).toBeNull();
  });

  it('B19.1 target 驱动时突破 maxMessages（预算缺口优先，宁多压不欠释放）', async () => {
    const result = await compressSession({
      messages: tenMessages(),
      maxMessages: 2,
      targetReleaseTokens: 99999, // 不可能达标 → 压完全部可压区间（6 条）
    });
    expect(result).toBeNull(); // 全压完仍不达 → 释放量校验返回 null
  });

  it('B19.1 target 达成时不受 maxMessages 限制', async () => {
    const result = await compressSession({
      messages: tenMessages(),
      maxMessages: 1,
      // 第 1 条消息约 17 token（含中文+数字），目标 20 需压 2 条
      targetReleaseTokens: 20,
    });
    expect(result!.compactedCount).toBeGreaterThanOrEqual(2);
  });

  it('B19.1 释放量校验：保护区外全压完仍不达预算缺口 → null（不静默欠释放）', async () => {
    const result = await compressSession({
      messages: tenMessages(),
      targetReleaseTokens: 99999,
    });
    expect(result).toBeNull();
    expect(mockSummarize).not.toHaveBeenCalled();
  });

  it('B19.1 nCtx 预算裁剪传入 summarizer（v1.2 min(12000, nCtx-400)）', async () => {
    await compressSession({messages: tenMessages(), nCtx: 4096});
    expect(mockSummarize.mock.calls[0][0].maxInputChars).toBe(4096 - 400);
    mockSummarize.mockClear();
    await compressSession({messages: tenMessages(), nCtx: 99999});
    // v1.2：上限 6000→12000（16K 档一次吃下压到半水位的 slice）
    expect(mockSummarize.mock.calls[0][0].maxInputChars).toBe(12000);
  });

  it('摘要失败返回 null（不标记不落盘）', async () => {
    mockSummarize.mockResolvedValue(null);
    expect(await compressSession({messages: tenMessages()})).toBeNull();
    expect(appendConversation).not.toHaveBeenCalled();
  });

  it('无可对话文本的消息（纯图片/无内容）不阻塞压缩', async () => {
    const msgs: MessageType.Any[] = [
      {
        author: {id: 'y9d7f8pgn'},
        id: 'img',
        text: '',
        type: 'text',
      },
      ...tenMessages(),
    ];
    const result = await compressSession({messages: msgs});
    expect(result).not.toBeNull();
  });
});
