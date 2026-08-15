import {isSpeakableMessage} from '../speakable';
import {assistant, user} from '../chat';
import {MessageType} from '../types';

const baseText = (extra: Record<string, any> = {}) =>
  ({
    id: 't1',
    type: 'text',
    author: assistant,
    text: '你好大王，今天奴家陪你聊聊天。',
    createdAt: 0,
    ...extra,
  }) as MessageType.Text;

const baseTurn = (extra: Record<string, any> = {}) =>
  ({
    id: 'a1',
    type: 'assistant_turn',
    author: assistant,
    steps: [],
    createdAt: 0,
    ...extra,
  }) as MessageType.AssistantTurn;

describe('isSpeakableMessage', () => {
  it('助手多词文本可朗读', () => {
    expect(isSpeakableMessage(baseText())).toBe(true);
  });

  it('用户消息不可朗读', () => {
    expect(isSpeakableMessage(baseText({author: user}))).toBe(false);
  });

  it('图像消息不可朗读', () => {
    expect(
      isSpeakableMessage({
        id: 'i1',
        type: 'image',
        author: assistant,
        uri: 'file://x.png',
        createdAt: 0,
      } as MessageType.Image),
    ).toBe(false);
  });

  it('单词/空文本不可朗读', () => {
    expect(isSpeakableMessage(baseText({text: '好'}))).toBe(false);
    expect(isSpeakableMessage(baseText({text: ''}))).toBe(false);
    // 英文等空格语言按词数：单词不可朗读，多词可朗读
    expect(isSpeakableMessage(baseText({text: 'ok'}))).toBe(false);
    expect(isSpeakableMessage(baseText({text: 'hello world'}))).toBe(true);
  });

  it('assistant_turn 可朗读', () => {
    expect(
      isSpeakableMessage(
        baseTurn({steps: [{content: '你好大王，今天奴家陪你聊聊天。'}]}),
      ),
    ).toBe(true);
  });

  it('生图任务卡片（metadata.imageTask）排除朗读', () => {
    expect(
      isSpeakableMessage(
        baseText({
          text: '🎨 已为你生成：一只小猫',
          metadata: {imageTask: true},
        }),
      ),
    ).toBe(false);
  });

  it('生成中的占位卡同样排除', () => {
    expect(
      isSpeakableMessage(
        baseText({
          text: '🎨 正在准备生成「一只小猫」…',
          metadata: {imageTask: true, imagePrompt: '一只小猫'},
        }),
      ),
    ).toBe(false);
  });
});
