/**
 * 上下文预算估算测试（批次 A：纯函数核心）。
 */
import {
  GENERATION_RESERVE,
  countTokensExact,
  estimateMessageTokens,
  estimateMessagesTokens,
  resolveWatermark,
} from '../budget';
import type {ChatMessage} from '../../../utils/types';

describe('estimateMessageTokens', () => {
  it('英文 ~4 字符/token', () => {
    expect(estimateMessageTokens('a'.repeat(40))).toBe(10);
    expect(estimateMessageTokens('')).toBe(0);
  });

  it('中文 1 字符/token', () => {
    expect(estimateMessageTokens('你好世界')).toBe(4);
  });

  it('中英混合', () => {
    expect(estimateMessageTokens('你好 world')).toBe(2 + 2); // 2 中 + ceil(6/4)=2 英
  });
});

describe('estimateMessagesTokens', () => {
  it('文本消息累加 + 模板开销', () => {
    const messages: ChatMessage[] = [
      {role: 'system', content: '你好'.repeat(100)}, // 200 token + 8
      {role: 'user', content: 'hello'},
    ];
    const total = estimateMessagesTokens(messages);
    expect(total).toBeGreaterThan(estimateMessageTokens('你好'.repeat(100)) + 4);
    // 200（中文） + 8（system 开销） + 2（hello=ceil(5/4)） + 8（user 开销）
    expect(total).toBe(200 + 8 + 2 + 8);
  });

  it('多模态 content 数组按段统计', () => {
    const messages: ChatMessage[] = [
      {
        role: 'user',
        content: [
          {type: 'text', text: '看图'},
          {type: 'image_url', image_url: {url: 'file:///x.jpg'}},
        ],
      },
    ];
    const total = estimateMessagesTokens(messages);
    // 文本 2 + 图片近似 512 + 开销 8
    expect(total).toBe(2 + 512 + 8);
  });

  it('无文本图片消息不炸', () => {
    const messages: ChatMessage[] = [
      {role: 'user', content: [{type: 'image_url', image_url: {url: 'u'}}]},
    ];
    expect(estimateMessagesTokens(messages)).toBe(512 + 8);
  });
});

describe('B19.1 resolveWatermark 水位实测校准', () => {
  it('无实测基线回退估算', () => {
    expect(resolveWatermark(1000)).toBe(1000);
    expect(resolveWatermark(1000, 0)).toBe(1000);
  });

  it('实测高于估算 → 取实测（估算低估被钉底）', () => {
    expect(resolveWatermark(3000, 6636)).toBe(6636);
  });

  it('估算高于实测（压缩后水位回落）→ 取估算', () => {
    expect(resolveWatermark(5000, 3000)).toBe(5000);
  });
});

describe('B19.1 GENERATION_RESERVE', () => {
  it('预留与默认 n_predict 同阶（512）', () => {
    expect(GENERATION_RESERVE).toBe(512);
  });
});

describe('countTokensExact', () => {
  it('ctx 缺失返回 null（回退轻量估算）', async () => {
    expect(await countTokensExact(undefined, 'hi')).toBeNull();
  });

  it('tokenize 返回 tokens 数组长度', async () => {
    const ctx = {
      tokenize: jest.fn().mockResolvedValue({tokens: [1, 2, 3], has_media: false, bitmap_hashes: []}),
    } as any;
    expect(await countTokensExact(ctx, 'hi')).toBe(3);
  });

  it('tokenize 异常返回 null', async () => {
    const ctx = {
      tokenize: jest.fn().mockRejectedValue(new Error('boom')),
    } as any;
    expect(await countTokensExact(ctx, 'hi')).toBeNull();
  });
});
