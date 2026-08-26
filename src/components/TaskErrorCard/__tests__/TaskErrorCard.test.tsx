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
import {L10nContext} from '../../../utils';
import {l10n} from '../../../locales';

// l10n 渲染断言（L3 收口 2026-08-21）：title/detail 按 code 渲染端单点生成
const wrapWithL10n = (ui: React.ReactElement) => (
  <L10nContext.Provider value={l10n.en}>{ui}</L10nContext.Provider>
);

jest.mock('../../../hooks', () => ({
  useTheme: () => ({
    colors: {
      danger: '#C62828',
      primary: '#F5A623',
      textSecondary: '#666',
      // B57：DS Chip outline 消费 error/onSurfaceVariant/outlineVariant
      error: '#C62828',
      onSurfaceVariant: '#7A7A7A',
      outlineVariant: '#C9C9C9',
    },
    typography: {captionM: {fontSize: 12}, captionS: {fontSize: 10}},
    radius: {m: 12, full: 999, xs: 4, s: 8},
    shapeRoles: {pill: 'full'},
    size: {minTapTarget: 44, controlHeight: 36}, // R1 size 域防御补全
    spacing: {sm: 12, xs: 4, xxs: 2, s: 8},
  }),
}));

const textMessage = (
  taskError:
    | {
        code: 'no_model' | 'load_failed' | 'busy';
        retryText?: string;
        modelName?: string;
      }
    | undefined,
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
    const {getByTestId, getByText} = render(
      wrapWithL10n(
        <TaskErrorCard
          message={textMessage({code: 'no_model', retryText: '你好呀'})}
          onRetry={onRetry}
          onGoModels={onGoModels}
        />,
      ),
    );
    expect(getByTestId('task-error-card')).toBeTruthy();
    // 渲染端 l10n 单点：标题/文案/按钮不再硬编码中文
    expect(getByText("Can't continue the conversation")).toBeTruthy();
    expect(getByText('Retry')).toBeTruthy();
    expect(getByText('Go to Models')).toBeTruthy();
    fireEvent.press(getByTestId('task-error-retry'));
    expect(onRetry).toHaveBeenCalledWith('你好呀');
    fireEvent.press(getByTestId('task-error-go-models'));
    expect(onGoModels).toHaveBeenCalled();
  });

  it('busy：仅重试，无去模型页（瞬时状态排查引导无意义）', () => {
    const {queryByTestId, getByTestId} = render(
      wrapWithL10n(
        <TaskErrorCard
          message={textMessage({code: 'busy', retryText: '你好呀'})}
          onRetry={jest.fn()}
          onGoModels={jest.fn()}
        />,
      ),
    );
    expect(getByTestId('task-error-retry')).toBeTruthy();
    expect(queryByTestId('task-error-go-models')).toBeNull();
  });

  it('无 taskError：不渲染', () => {
    const {queryByTestId} = render(
      wrapWithL10n(
        <TaskErrorCard
          message={textMessage(undefined)}
          onRetry={jest.fn()}
          onGoModels={jest.fn()}
        />,
      ),
    );
    expect(queryByTestId('task-error-card')).toBeNull();
  });

  it('load_failed：detail 按 code 生成并插值模型名（l10n 单点）', () => {
    const {getByText} = render(
      wrapWithL10n(
        <TaskErrorCard
          message={textMessage({
            code: 'load_failed',
            modelName: 'Test-8B',
            retryText: '重试原文',
          })}
          onRetry={jest.fn()}
          onGoModels={jest.fn()}
        />,
      ),
    );
    expect(getByText(/Test-8B/)).toBeTruthy();
  });
});
