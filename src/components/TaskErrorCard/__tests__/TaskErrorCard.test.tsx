/**
 * TaskErrorCard 冒烟测试（2026-08-17 P0 净化：SPEC §3.3 error 叙事统一落地）
 *
 * 覆盖：no_model（重试+去模型页）/ load_failed（重试+去模型页）/
 * busy（仅重试）/ 无 taskError（不渲染）/ 回调透传。
 */
import React from 'react';
import {render, fireEvent} from '@testing-library/react-native';

import {TaskErrorCard} from '../TaskErrorCard';
import {MessageType} from '../../../utils/types';

jest.mock('../../../hooks', () => ({
  useTheme: () => ({
    colors: {
      danger: '#C62828',
      primary: '#F5A623',
      textSecondary: '#666',
    },
    typography: {captionM: {fontSize: 12}},
    radius: {m: 12, full: 999},
    spacing: {sm: 12, xs: 4, xxs: 2},
  }),
}));

const textMessage = (
  taskError: {code: 'no_model' | 'load_failed' | 'busy'; detail?: string; retryText?: string} | undefined,
): MessageType.Text =>
  ({
    id: 'm-1',
    author: {id: 'assistant', name: 'assistant'},
    createdAt: 0,
    text: '无法继续对话',
    type: 'text',
    metadata: taskError ? {taskError} : {},
  }) as MessageType.Text;

describe('TaskErrorCard', () => {
  it('no_model：渲染 danger 卡 + 重试 + 去模型页，回调透传', () => {
    const onRetry = jest.fn();
    const onGoModels = jest.fn();
    const {getByTestId} = render(
      <TaskErrorCard
        message={textMessage({code: 'no_model', detail: '请先到模型页下载。', retryText: '你好呀'})}
        onRetry={onRetry}
        onGoModels={onGoModels}
      />,
    );
    expect(getByTestId('task-error-card')).toBeTruthy();
    fireEvent.press(getByTestId('task-error-retry'));
    expect(onRetry).toHaveBeenCalledWith('你好呀');
    fireEvent.press(getByTestId('task-error-go-models'));
    expect(onGoModels).toHaveBeenCalled();
  });

  it('busy：仅重试，无去模型页（瞬时状态排查引导无意义）', () => {
    const {queryByTestId, getByTestId} = render(
      <TaskErrorCard
        message={textMessage({code: 'busy', detail: '收尾中', retryText: '你好呀'})}
        onRetry={jest.fn()}
        onGoModels={jest.fn()}
      />,
    );
    expect(getByTestId('task-error-retry')).toBeTruthy();
    expect(queryByTestId('task-error-go-models')).toBeNull();
  });

  it('无 taskError：不渲染', () => {
    const {queryByTestId} = render(
      <TaskErrorCard message={textMessage(undefined)} onRetry={jest.fn()} onGoModels={jest.fn()} />,
    );
    expect(queryByTestId('task-error-card')).toBeNull();
  });
});
