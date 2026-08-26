import React from 'react';
import {View} from 'react-native';

import {render, fireEvent} from '../../../../../jest/test-utils';
import {BannerBar} from '../BannerBar';

describe('BannerBar', () => {
  it('renders text with neutral variant by default', () => {
    const {getByText, getByTestId} = render(<BannerBar text="上下文已压缩" />);
    expect(getByTestId('ui-banner')).toBeTruthy();
    expect(getByText('上下文已压缩')).toBeTruthy();
  });

  it('renders meter when progress is a valid number', () => {
    const {queryByTestId, rerender} = render(
      <BannerBar text="x" progress={42} />,
    );
    expect(queryByTestId('banner-meter')).toBeTruthy();
    rerender(<BannerBar text="x" progress={-1} />);
    expect(queryByTestId('banner-meter')).toBeNull();
  });

  it('renders actions and fires onPress', () => {
    const onPress = jest.fn();
    const {getByTestId} = render(
      <BannerBar
        text="上下文已满"
        actions={[{label: '压缩', onPress, testID: 'banner-compact'}]}
      />,
    );
    fireEvent.press(getByTestId('banner-compact'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('renders dismiss and fires onDismiss', () => {
    const onDismiss = jest.fn();
    const {getByTestId} = render(<BannerBar text="x" onDismiss={onDismiss} />);
    fireEvent.press(getByTestId('ui-banner-dismiss'));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('renders a custom icon node', () => {
    const {getByTestId} = render(
      <BannerBar
        text="x"
        testID="warn-banner"
        icon={<View testID="banner-icon" />}
      />,
    );
    expect(getByTestId('banner-icon')).toBeTruthy();
  });
});
