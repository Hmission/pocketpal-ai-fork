import React from 'react';
import {StyleSheet} from 'react-native';
import {render, fireEvent} from '../../../../jest/test-utils';
import {ChatHeader} from '../ChatHeader';
import {themeFixtures} from '../../../../jest/fixtures/theme';
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

  it('SenseVoice 就绪 + 传入回调 → 图标可点且上色走 stroke，点击触发回调', () => {
    mockAsrState.value = 'ready';
    const onPhoneCallPress = jest.fn();
    const {getByTestId} = render(
      <ChatHeader onPhoneCallPress={onPhoneCallPress} />,
      {withSafeArea: true},
    );
    const btn = getByTestId('phone-call-button');
    // CHAT_UI_SPEC §21 v5.1 / PHONE_SPEC §11.1：触区与 HeaderRight.compactBtn 同族
    // ——controlHeight 透明方形（无底衬无描边；v2.0 胶囊化已撤销）
    const flattened = StyleSheet.flatten(btn.props.style);
    expect(flattened.opacity).not.toBe(0.4);
    expect(flattened.width).toBe(themeFixtures.lightTheme.size.controlHeight);
    expect(flattened.height).toBe(themeFixtures.lightTheme.size.controlHeight);
    expect(flattened.borderWidth).toBeUndefined();
    expect(flattened.backgroundColor).toBeUndefined();
    // 间距补偿入测试（防回归）：真机像素量得未补偿时 电话↔加号=24.0dp，
    // 而 胶囊↔电话=12.4dp、加号↔三点=14.5dp（大王报「间距过大」）；
    // -11 沿用 §20.3 compactBtnLeft 同族手法校准至等距（两轮实测迭代得出）。
    expect(flattened.marginRight).toBe(-11);
    // 上色口径（2026-09-07 W7 根治，ICON_SPEC §四）：`phone` 是描边型资产，只能传
    // `stroke=`。旧断言把「着色落在 fill」当规格，而 fill 会经 root 继承把封闭
    // 轮廓填成实心块（大王报障真因）；本条断言随之改正，不是改设计。
    // jest 下 svg 经 __mocks__/external/react-native-svg.js 渲染为宿主元素 'SvgMock'
    const [icon] = btn.findAllByType('SvgMock' as unknown as React.ElementType);
    expect(icon.props.stroke).toBe(themeFixtures.lightTheme.colors.primary);
    // 反向钉住：不得再用 fill 上色（填实回归即测试红）
    expect(icon.props.fill).toBeUndefined();
    // 尺寸 m(20)：2026-09-08 装机窗像素定档。实测 s(16) 下电话描边 4px、同行加号 6px
    // （电话反细 33%）；资产级有效描边归一后（ICON_SPEC §一第 2 条 v1.2）两者在 m(20)
    // 下同为 5.0px，且 DESIGN_SPEC 触区红线本就要求同行一律 iconSize.m。
    expect(icon.props.width).toBe(themeFixtures.lightTheme.iconSize.m);
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
