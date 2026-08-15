import React from 'react';
import {render} from '../../../../jest/test-utils';
import {ChatHeader} from '../ChatHeader';
import {chatSessionStore} from '../../../store';

// Mock the child components
jest.mock('../../HeaderLeft', () => ({
  HeaderLeft: () => {
    const {View} = require('react-native');
    return <View testID="header-left" />;
  },
}));

jest.mock('../../HeaderRight', () => ({
  HeaderRight: () => {
    const {View} = require('react-native');
    return <View testID="header-right" />;
  },
}));

jest.mock('../../ChatHeaderTitle', () => ({
  ChatHeaderTitle: () => {
    const {View} = require('react-native');
    return <View testID="chat-header-title" />;
  },
}));

// shouldShowHeaderDivider is an accessor on the global mock store; replace it
// with a controllable getter per test.
const setHeaderDivider = (value: boolean) => {
  Object.defineProperty(chatSessionStore, 'shouldShowHeaderDivider', {
    get: () => value,
    configurable: true,
  });
};

describe('ChatHeader', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset the mock store value
    setHeaderDivider(false);
  });

  it('renders all child components', () => {
    const {getByTestId} = render(<ChatHeader />);

    expect(getByTestId('header-view')).toBeTruthy();
    expect(getByTestId('header-left')).toBeTruthy();
    expect(getByTestId('header-right')).toBeTruthy();
    expect(getByTestId('chat-header-title')).toBeTruthy();
  });

  it('applies correct styles when header divider should not be shown', () => {
    setHeaderDivider(false);
    const {getByTestId} = render(<ChatHeader />, {withSafeArea: true});

    const headerView = getByTestId('header-view');
    expect(headerView.props.style[1]).toMatchObject({
      elevation: 0,
      shadowOpacity: 0,
      borderBottomWidth: 0,
      backgroundColor: expect.any(String),
    });
  });

  it('applies correct styles when header divider should be shown', () => {
    setHeaderDivider(true);
    const {getByTestId} = render(<ChatHeader />, {withSafeArea: true});

    const headerView = getByTestId('header-view');
    expect(headerView.props.style[1]).toMatchObject({
      backgroundColor: expect.any(String),
    });
  });

  // [已裁剪 2026-08] 头部生图入口（imagegen-button）用例随按钮一并删除：
  // 生图入口收敛至抽屉 drawer-imagegen-button，恢复时同步恢复本用例。
});
