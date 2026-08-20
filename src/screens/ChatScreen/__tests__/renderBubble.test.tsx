import React from 'react';
import {Text} from 'react-native';

import {render} from '../../../../jest/test-utils';
import {defaultDerivedMessageProps} from '../../../../jest/fixtures';
import {themeFixtures} from '../../../../jest/fixtures/theme';

import {renderBubble} from '../ChatScreen';
import {assistantId, userId} from '../../../utils/chat';
import {MessageType} from '../../../utils/types';

/**
 * renderBubble 徽章行门控测试（task-6ad §20.1 复查修复防回归）。
 *
 * 链路约束：assistant_turn 的徽章行（模型徽章 + 意图胶囊）由
 * Message.renderAssistantTurn 在 turn 级顶部渲染**一次**；ChatScreen.renderBubble
 * 对 turn 消息**不得**再渲染（否则每个内容块多一行徽章，N+1 重复）。
 * 仅 text/image/file 等非 turn 消息保持「徽章 → 卡片」顺序。
 */
describe('ChatScreen.renderBubble — 徽章行门控', () => {
  it('assistant_turn 消息不渲染 AssistantAuthorRow（门控生效）', () => {
    const turn = {
      ...defaultDerivedMessageProps,
      author: {id: assistantId},
      createdAt: 0,
      id: 'turn-1',
      type: 'assistant_turn',
      steps: [{content: 'hello'}],
      metadata: {modelName: 'qwen2.5-4b-q4'},
    } as unknown as MessageType.Any;
    const {queryByTestId} = render(
      renderBubble({
        child: <Text>child</Text>,
        message: turn,
        nextMessageInGroup: false,
        theme: themeFixtures.lightTheme,
      }),
    );
    expect(queryByTestId('assistant-author-row')).toBeNull();
    expect(queryByTestId('assistant-model-badge')).toBeNull();
  });

  it('text 消息保持「徽章 → 卡片」顺序（非 turn 渲染徽章行）', () => {
    const textMsg = {
      ...defaultDerivedMessageProps,
      author: {id: assistantId},
      createdAt: 0,
      id: 't1',
      text: 'hi',
      type: 'text',
      metadata: {modelName: 'qwen2.5-4b-q4'},
    } as unknown as MessageType.Any;
    const {getByTestId} = render(
      renderBubble({
        child: <Text>child</Text>,
        message: textMsg,
        nextMessageInGroup: false,
        theme: themeFixtures.lightTheme,
      }),
    );
    expect(getByTestId('assistant-author-row')).toBeTruthy();
    expect(getByTestId('assistant-model-badge')).toBeTruthy();
  });

  it('用户消息不渲染徽章行（真实 user.id 判定）', () => {
    const userMsg = {
      ...defaultDerivedMessageProps,
      author: {id: userId},
      createdAt: 0,
      id: 'u1',
      text: 'hi',
      type: 'text',
      // 即使用户消息携带 modelName 字段，也不得显示徽章（作者判定优先）
      metadata: {modelName: 'should-not-show'},
    } as unknown as MessageType.Any;
    const {queryByTestId} = render(
      renderBubble({
        child: <Text>child</Text>,
        message: userMsg,
        nextMessageInGroup: false,
        theme: themeFixtures.lightTheme,
      }),
    );
    expect(queryByTestId('assistant-author-row')).toBeNull();
  });
});
