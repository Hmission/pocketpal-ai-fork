import React from 'react';
import {MenuItem} from '../MenuItem';
import {useTheme} from '../../../../hooks';
import {fireEvent, render} from '../../../../../jest/test-utils';

describe('MenuItem', () => {
  beforeEach(() => {
    (useTheme as jest.Mock).mockReturnValue({
      typography: {
        displayL: {fontSize: 28, lineHeight: 34, fontWeight: '600'},
        displayM: {fontSize: 26, lineHeight: 32, fontWeight: '600'},
        displayS: {fontSize: 24, lineHeight: 30, fontWeight: '600'},
        titleL: {fontSize: 22, lineHeight: 28, fontWeight: '600'},
        titleM: {fontSize: 18, lineHeight: 24, fontWeight: '600'},
        titleS: {fontSize: 16, lineHeight: 22, fontWeight: '600'},
        bodyM: {fontSize: 15, lineHeight: 21, fontWeight: '400'},
        bodyS: {fontSize: 13, lineHeight: 19, fontWeight: '400'},
        uiM: {fontSize: 14, lineHeight: 20, fontWeight: '400'},
        uiS: {fontSize: 12, lineHeight: 16, fontWeight: '400'},
        captionM: {fontSize: 11, lineHeight: 15, fontWeight: '400'},
        captionS: {fontSize: 10, lineHeight: 14, fontWeight: '400'},
        ml: {fontSize: 15, lineHeight: 21, fontWeight: '400'},
        xs: {fontSize: 12, lineHeight: 16, fontWeight: '400'},
        sm: {fontSize: 13, lineHeight: 19, fontWeight: '400'},
        lg: {fontSize: 18, lineHeight: 24, fontWeight: '600'},
        xl: {fontSize: 22, lineHeight: 28, fontWeight: '600'},
        display: {fontSize: 28, lineHeight: 34, fontWeight: '600'},
      },
      radius: {
        xs: 4,
        s: 6,
        m: 10,
        ml: 12,
        l: 14,
        xl: 20,
        full: 999,
        shapeRoles: {
          card: 'l',
          surface: 'm',
          pill: 'full',
          inputSmall: 's',
          circle: 'full',
        },
      },
      colors: {
        menuText: '#000000',
        menuDangerText: '#FF0000',
        menuBackgroundActive: '#E0E0E0',
      },
      fonts: {
        bodySmall: {},
      },
    });
  });

  it('renders basic menu item correctly', () => {
    const onPress = jest.fn();
    const {getByText} = render(
      <MenuItem label="Test Item" onPress={onPress} />,
    );

    expect(getByText('Test Item')).toBeTruthy();
  });

  it('handles press events', () => {
    const onPress = jest.fn();
    const {getByText} = render(
      <MenuItem label="Test Item" onPress={onPress} />,
    );

    fireEvent.press(getByText('Test Item'));
    expect(onPress).toHaveBeenCalled();
  });

  it('renders leading icon when provided', () => {
    const {UNSAFE_getByProps} = render(
      <MenuItem label="Test Item" leadingIcon="check" onPress={() => {}} />,
    );

    expect(UNSAFE_getByProps({source: 'check'})).toBeTruthy();
  });

  it('renders trailing icon when provided', () => {
    const {UNSAFE_getByProps} = render(
      <MenuItem label="Test Item" trailingIcon="close" onPress={() => {}} />,
    );

    expect(UNSAFE_getByProps({source: 'close'})).toBeTruthy();
  });

  it('handles disabled state correctly', () => {
    const onPress = jest.fn();
    const {getByText} = render(
      <MenuItem label="Test Item" onPress={onPress} disabled={true} />,
    );

    fireEvent.press(getByText('Test Item'));
    expect(onPress).not.toHaveBeenCalled();
  });
});
