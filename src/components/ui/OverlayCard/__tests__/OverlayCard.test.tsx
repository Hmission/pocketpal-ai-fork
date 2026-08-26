import React from 'react';
import {Text} from 'react-native';

import {render, fireEvent} from '../../../../../jest/test-utils';
import {OverlayCard} from '../OverlayCard';

describe('OverlayCard', () => {
  it('renders nothing when not visible', () => {
    const {queryByTestId} = render(
      <OverlayCard visible={false} title="Settings">
        <Text>body</Text>
      </OverlayCard>,
    );
    expect(queryByTestId('ui-overlay-card')).toBeNull();
  });

  it('renders title and children when visible', () => {
    const {getByTestId, getByText} = render(
      <OverlayCard visible title="设置">
        <Text>正文内容</Text>
      </OverlayCard>,
    );
    expect(getByTestId('ui-overlay-card')).toBeTruthy();
    expect(getByText('设置')).toBeTruthy();
    expect(getByText('正文内容')).toBeTruthy();
  });

  it('dismisses on scrim press and keeps card press inert', () => {
    const onRequestClose = jest.fn();
    const {getByTestId} = render(
      <OverlayCard visible title="设置" onRequestClose={onRequestClose}>
        <Text>正文</Text>
      </OverlayCard>,
    );
    // 遮罩点击关闭
    fireEvent.press(getByTestId('ui-overlay-card-scrim'));
    expect(onRequestClose).toHaveBeenCalledTimes(1);
    // 卡片内点击不关闭
    fireEvent.press(getByTestId('ui-overlay-card'));
    expect(onRequestClose).toHaveBeenCalledTimes(1);
  });

  it('renders actions row from primary/secondary config', () => {
    const onConfirm = jest.fn();
    const onCancel = jest.fn();
    const {getAllByText} = render(
      <OverlayCard
        visible
        title="确认"
        actions={{
          primary: {label: '确认', onPress: onConfirm},
          secondary: {label: '取消', onPress: onCancel},
        }}>
        <Text>正文</Text>
      </OverlayCard>,
    );
    // 标题与按钮文字同词时取最后一个（按钮在标题之后渲染）
    fireEvent.press(getAllByText('确认')[1]);
    expect(onConfirm).toHaveBeenCalledTimes(1);
    fireEvent.press(getAllByText('取消')[0]);
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('honours destructive primary variant', () => {
    const onConfirm = jest.fn();
    const {getAllByText} = render(
      <OverlayCard
        visible
        title="删除"
        actions={{
          primary: {label: '删除', onPress: onConfirm, destructive: true},
        }}>
        <Text>正文</Text>
      </OverlayCard>,
    );
    fireEvent.press(getAllByText('删除')[1]);
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });
});
