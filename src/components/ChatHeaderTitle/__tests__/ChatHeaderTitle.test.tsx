import React from 'react';
import {render} from '../../../../jest/test-utils';
import {ChatHeaderTitle} from '../ChatHeaderTitle';
import {chatSessionStore, modelStore} from '../../../store';
import {runInAction} from 'mobx';
import {basicModel} from '../../../../jest/fixtures/models';

describe('ChatHeaderTitle', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders "Chat" when no active session exists', () => {
    runInAction(() => {
      chatSessionStore.resetActiveSession();
      chatSessionStore.sessions = [];
    });
    const {getByText} = render(<ChatHeaderTitle />);
    expect(getByText('Chat')).toBeTruthy();
  });

  it('renders session title when active session exists', () => {
    const mockSession = {
      id: '123',
      title: 'Test Session',
      date: new Date().toISOString(),
      messages: [],
    };
    runInAction(() => {
      Object.assign(chatSessionStore, {
        activeSessionId: mockSession.id,
        sessions: [mockSession],
      });
    });

    const {getByText} = render(<ChatHeaderTitle />);
    expect(getByText('Test Session')).toBeTruthy();
  });

  it('renders session title only — model name moved to header picker chip', () => {
    runInAction(() => {
      modelStore.models = [basicModel];
      modelStore.setActiveModel(basicModel.id);
      Object.assign(chatSessionStore, {
        activeSessionId: '123',
        sessions: [
          {
            id: '123',
            title: 'Test Session',
            date: new Date().toISOString(),
            messages: [],
          },
        ],
      });
    });

    const {getByText, queryByText} = render(<ChatHeaderTitle />);
    expect(getByText('Test Session')).toBeTruthy();
    // 模型名已由 ChatHeader 的 chat-model-picker-chip 展示，标题不再重复显示
    expect(queryByText('basic model')).toBeNull();
  });
});
