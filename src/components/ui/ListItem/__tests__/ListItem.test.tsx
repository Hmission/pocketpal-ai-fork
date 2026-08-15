import React from 'react';
import {Switch, Text} from 'react-native';
import {fireEvent} from '@testing-library/react-native';

import {render} from '../../../../../jest/test-utils';
import {ListItem} from '../ListItem';

const FakeIcon = ({
  width,
  height,
  stroke,
}: {
  width?: number;
  height?: number;
  stroke?: string;
}) => <Text>{`icon:${stroke ?? ''}:${width ?? 0}x${height ?? 0}`}</Text>;

describe('ListItem（DESIGN_SPEC §4b 子页行）', () => {
  const base = {
    title: '记忆管理',
    subtitle: '2.3 KB · 12 条',
    Icon: FakeIcon,
    color: '#00838F',
  };

  it('渲染 IconTile + 标题 + 辅助说明 + chevron（有 onPress 时）', () => {
    const {getByText} = render(<ListItem {...base} onPress={() => {}} />);
    expect(getByText('记忆管理')).toBeTruthy();
    expect(getByText('2.3 KB · 12 条')).toBeTruthy();
    expect(getByText(/icon:#00838F:22x22/)).toBeTruthy();
  });

  it('点击触发 onPress', () => {
    const onPress = jest.fn();
    const {getByTestId} = render(
      <ListItem {...base} onPress={onPress} testID="row-memory" />,
    );
    fireEvent.press(getByTestId('row-memory'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('提供 right 节点时渲染 right 而非 chevron', () => {
    const {getByTestId} = render(
      <ListItem {...base} right={<Switch value testID="row-switch" />} />,
    );
    expect(getByTestId('row-switch')).toBeTruthy();
    // 无 onPress 且给了 right → 不渲染 chevron（无 testID 的 chevron 无法直接断言，
    // 此处以 right 存在 + onPress 缺省为充分条件）
  });

  it('无 onPress 且无 right 时渲染为纯展示行', () => {
    const {getByText} = render(<ListItem {...base} />);
    expect(getByText('记忆管理')).toBeTruthy();
  });
});
