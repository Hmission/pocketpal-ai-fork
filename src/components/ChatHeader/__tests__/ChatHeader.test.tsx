import React from 'react';
import {StyleSheet} from 'react-native';
import {render, fireEvent} from '../../../../jest/test-utils';
import {ChatHeader} from '../ChatHeader';
import {chatSessionStore} from '../../../store';

// CHAT_UI_SPEC §21：电话入口依赖 SenseVoice 就绪态（mock 可控）
const mockAsrState = {value: 'ready'};
jest.mock('../../../store/audioStore', () => ({
  audioStore: {
    get asrState() {
      return mockAsrState.value;
    },
  },
}));

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

  // ===== CHAT_UI_SPEC §21：电话模式入口 =====

  it('未传 onPhoneCallPress → 不渲染电话图标（不占位）', () => {
    const {queryByTestId} = render(<ChatHeader />);
    expect(queryByTestId('phone-call-button')).toBeNull();
  });

  it('SenseVoice 就绪 + 传入回调 → 图标可点，点击触发回调', () => {
    mockAsrState.value = 'ready';
    const onPhoneCallPress = jest.fn();
    const {getByTestId} = render(
      <ChatHeader onPhoneCallPress={onPhoneCallPress} />,
      {withSafeArea: true},
    );
    const btn = getByTestId('phone-call-button');
    // 就绪态：不禁用（flatten 后 opacity 非 0.4；Touchable 自带 opacity:1）
    expect(StyleSheet.flatten(btn.props.style).opacity).not.toBe(0.4);
    fireEvent.press(btn);
    expect(onPhoneCallPress).toHaveBeenCalledTimes(1);
  });

  it('SenseVoice 未就绪 → 图标禁用态（半透明），点击不触发回调', () => {
    mockAsrState.value = 'not_installed';
    const onPhoneCallPress = jest.fn();
    const {getByTestId} = render(
      <ChatHeader onPhoneCallPress={onPhoneCallPress} />,
      {withSafeArea: true},
    );
    const btn = getByTestId('phone-call-button');
    expect(StyleSheet.flatten(btn.props.style)).toMatchObject({opacity: 0.4});
    fireEvent.press(btn);
    expect(onPhoneCallPress).not.toHaveBeenCalled();
  });

  // [已裁剪 2026-08] 头部生图入口（imagegen-button）用例随按钮一并删除：
  // 生图入口收敛至抽屉 drawer-imagegen-button，恢复时同步恢复本用例。
});
