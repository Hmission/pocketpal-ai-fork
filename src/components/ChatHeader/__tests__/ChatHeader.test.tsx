import React from 'react';
import {fireEvent} from '@testing-library/react-native';
import {render} from '../../../../jest/test-utils';
import {ChatHeader} from '../ChatHeader';
import {ROUTES} from '../../../utils/navigationConstants';
import {chatSessionStore} from '../../../store';

const mockNavigate = jest.fn();

// ChatHeader now carries the Image Gen entry button, which navigates via
// useNavigation. Provide a stable navigation mock.
jest.mock('@react-navigation/native', () => {
  const actual = jest.requireActual('@react-navigation/native');
  return {
    ...actual,
    useNavigation: () => ({navigate: mockNavigate}),
  };
});

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

  it('navigates to Image Gen screen when the image gen button is pressed', () => {
    const {getByTestId} = render(<ChatHeader />);

    fireEvent.press(getByTestId('imagegen-button'));

    expect(mockNavigate).toHaveBeenCalledWith(ROUTES.IMAGE_GEN);
  });
});
