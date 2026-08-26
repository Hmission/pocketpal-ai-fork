/**
 * IconTile 冒烟测试（DESIGN_SPEC §3）。
 */
import React from 'react';
import {StyleSheet} from 'react-native';
import {render} from '@testing-library/react-native';

import {IconTile} from '../IconTile';

const FakeIcon: React.FC<{
  width?: number;
  height?: number;
  stroke?: string;
}> = () => null;

describe('IconTile', () => {
  it('renders default m size (40x40) with testID', () => {
    const {getByTestId} = render(<IconTile icon={FakeIcon} color="#1E4DF6" />);
    const tile = getByTestId('ui-icon-tile');
    // B51：style 为基样式+动态尺寸/底色数组，断言前 flatten
    const flat = StyleSheet.flatten(tile.props.style);
    expect(flat.width).toBe(40);
    expect(flat.height).toBe(40);
  });

  it('renders s size (32x32)', () => {
    const {getByTestId} = render(
      <IconTile icon={FakeIcon} color="#1E4DF6" size="s" />,
    );
    const tile = getByTestId('ui-icon-tile');
    const flat = StyleSheet.flatten(tile.props.style);
    expect(flat.width).toBe(32);
    expect(flat.height).toBe(32);
  });

  it('applies domain color to the icon stroke', () => {
    let captured: {width?: number; height?: number; stroke?: string} = {};
    const SpyIcon = (props: {
      width?: number;
      height?: number;
      stroke?: string;
    }) => {
      captured = props;
      return null;
    };
    render(<IconTile icon={SpyIcon} color="#2E7D32" />);
    expect(captured.stroke).toBe('#2E7D32');
    expect(captured.width).toBe(22);
    expect(captured.height).toBe(22);
  });
});
