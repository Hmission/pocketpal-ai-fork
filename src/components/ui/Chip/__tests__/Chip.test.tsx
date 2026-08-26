import React from 'react';

import {render} from '../../../../../jest/test-utils';
import {Chip} from '../Chip';
import {runSnapshotMatrix} from '../../__tests__/helpers/snapshotMatrix';

describe('Chip', () => {
  it('display variant defaults to role=text', () => {
    const {getByTestId} = render(<Chip variant="display" label="Tag" />);
    expect(getByTestId('ui-chip').props.accessibilityRole).toBe('text');
  });

  it('selectable variant defaults to role=button with selected state', () => {
    const {getByTestId} = render(
      <Chip variant="selectable" label="Tag" selected />,
    );
    const el = getByTestId('ui-chip');
    expect(el.props.accessibilityRole).toBe('button');
    expect(el.props.accessibilityState?.selected).toBe(true);
  });

  it('input variant defaults to role=button', () => {
    const {getByTestId} = render(<Chip variant="input" label="Tag" />);
    expect(getByTestId('ui-chip').props.accessibilityRole).toBe('button');
  });

  // B57：outline 动作胶囊——带 onPress 即交互（role=button），无 onPress 为展示层
  it('outline variant with onPress is interactive', () => {
    const {getByTestId} = render(
      <Chip
        variant="outline"
        color="primary"
        label="Tag"
        onPress={jest.fn()}
      />,
    );
    expect(getByTestId('ui-chip').props.accessibilityRole).toBe('button');
  });

  it('outline variant without onPress stays display (role=text)', () => {
    const {getByTestId} = render(
      <Chip variant="outline" color="danger" label="Tag" />,
    );
    expect(getByTestId('ui-chip').props.accessibilityRole).toBe('text');
  });
});

runSnapshotMatrix(
  'Chip',
  ({variant, size, state}) => (
    <Chip
      variant={variant}
      size={size}
      label="Tag"
      selected
      disabled={state === 'disabled'}
    />
  ),
  {
    // B57：四变体全部进快照（outline 无 onPress = 展示层渲染，描边/语义色可见）
    variants: ['display', 'selectable', 'input', 'outline'] as const,
    sizes: ['s', 'm'] as const,
    langs: ['fa'] as const,
    rtlCanaryVariant: 'selectable',
  },
);
