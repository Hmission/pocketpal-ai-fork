/**
 * PressableScale 冒烟测试（DESIGN_SPEC §5）。
 * 验证按压反馈走 JS driver（不产生 native driver 动画残留）。
 */
import React from 'react';
import {Animated, Text} from 'react-native';
import {fireEvent, render} from '@testing-library/react-native';

import {PressableScale} from '../PressableScale';

describe('PressableScale', () => {
  it('fires onPress when tapped', () => {
    const onPress = jest.fn();
    const {getByTestId} = render(
      <PressableScale testID="ps" onPress={onPress}>
        <Text>t</Text>
      </PressableScale>,
    );
    fireEvent(getByTestId('ps'), 'onPress');
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('does not fire when disabled', () => {
    const onPress = jest.fn();
    const {getByTestId} = render(
      <PressableScale testID="ps" disabled onPress={onPress}>
        <Text>t</Text>
      </PressableScale>,
    );
    fireEvent(getByTestId('ps'), 'onPress');
    expect(onPress).not.toHaveBeenCalled();
  });

  it('animates with useNativeDriver:false on press-in (JS driver 铁律)', () => {
    const springSpy = jest.spyOn(Animated, 'spring');
    const {getByTestId} = render(
      <PressableScale testID="ps" onPress={() => {}}>
        <Text>t</Text>
      </PressableScale>,
    );
    fireEvent(getByTestId('ps'), 'onPressIn');
    expect(springSpy).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({useNativeDriver: false}),
    );
    springSpy.mockRestore();
  });
});
