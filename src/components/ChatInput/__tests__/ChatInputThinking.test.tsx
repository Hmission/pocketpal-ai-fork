/**
 * Tests for ChatInput thinking toggle functionality
 */

import React from 'react';
import {render, fireEvent} from '@testing-library/react-native';
import {ChatInput} from '../ChatInput';
import {UserContext} from '../../../utils';

// Mock the theme hook
jest.mock('../../../hooks', () => ({
  useTheme: () => ({
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
      primary: '#007AFF',
      onPrimary: '#FFFFFF',
      surface: '#FFFFFF',
      onSurface: '#000000',
      inverseOnSurface: '#FFFFFF',
      inverseSurface: '#000000',
      onSurfaceVariant: '#666666',
    },
    fonts: {
      inputTextStyle: {
        fontSize: 16,
        fontFamily: 'System',
      },
    },
  }),
}));

// Mock the stores
jest.mock('../../../store', () => ({
  chatSessionStore: {
    activePalId: null,
  },
  modelStore: {
    activeModel: null,
  },
  palStore: {
    pals: [],
  },
  uiStore: {
    colorScheme: 'light',
  },
  ttsStore: {
    isTTSAvailable: false,
    currentVoice: null,
    autoSpeakEnabled: false,
    playbackState: {mode: 'idle'},
    openSetupSheet: jest.fn(),
    setAutoSpeak: jest.fn(),
  },
}));

// Mock the icons
jest.mock('../../../assets/icons', () => ({
  ChevronUpIcon: 'ChevronUpIcon',
  VideoRecorderIcon: 'VideoRecorderIcon',
  PlusIcon: 'PlusIcon',
  AtomIcon: 'AtomIcon',
  MicIcon: 'MicIcon',
  StopIcon: 'StopIcon',
}));

// Mock the components
jest.mock('../../SendButton', () => ({
  SendButton: 'SendButton',
}));

jest.mock('../../StopButton', () => ({
  StopButton: 'StopButton',
}));

jest.mock('../../Menu', () => {
  const React = require('react');
  // Menu 现为编辑按钮的 anchor 容器（常驻渲染）：mock 需渲染 anchor + children
  const MenuMock = (props: any) =>
    React.createElement(React.Fragment, null, props.anchor, props.children);
  MenuMock.Item = 'MenuItem';
  return {Menu: MenuMock};
});

const mockUser = {
  id: 'test-user',
  firstName: 'Test',
  lastName: 'User',
};

describe('ChatInput Thinking Toggle', () => {
  const defaultProps = {
    onSendPress: jest.fn(),
    onStopPress: jest.fn(),
    onPalBtnPress: jest.fn(),
    isStopVisible: false,
    sendButtonVisibilityMode: 'editing' as const,
    isPickerVisible: false,
    textInputProps: {},
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should not render thinking toggle when showThinkingToggle is false', () => {
    const {queryByLabelText} = render(
      <UserContext.Provider value={mockUser}>
        <ChatInput
          {...defaultProps}
          showThinkingToggle={false}
          isThinkingEnabled={false}
          onThinkingToggle={jest.fn()}
        />
      </UserContext.Provider>,
    );

    expect(queryByLabelText(/thinking mode/i)).toBeNull();
  });

  it('should render thinking toggle when showThinkingToggle is true', () => {
    const {getByLabelText} = render(
      <UserContext.Provider value={mockUser}>
        <ChatInput
          {...defaultProps}
          showThinkingToggle={true}
          isThinkingEnabled={false}
          onThinkingToggle={jest.fn()}
        />
      </UserContext.Provider>,
    );

    expect(getByLabelText('Enable thinking mode')).toBeTruthy();
  });

  it('should show correct accessibility label when thinking is disabled', () => {
    const {getByLabelText} = render(
      <UserContext.Provider value={mockUser}>
        <ChatInput
          {...defaultProps}
          showThinkingToggle={true}
          isThinkingEnabled={false}
          onThinkingToggle={jest.fn()}
        />
      </UserContext.Provider>,
    );

    expect(getByLabelText('Enable thinking mode')).toBeTruthy();
  });

  it('should show correct accessibility label when thinking is enabled', () => {
    const {getByLabelText} = render(
      <UserContext.Provider value={mockUser}>
        <ChatInput
          {...defaultProps}
          showThinkingToggle={true}
          isThinkingEnabled={true}
          onThinkingToggle={jest.fn()}
        />
      </UserContext.Provider>,
    );

    expect(getByLabelText('Disable thinking mode')).toBeTruthy();
  });

  it('should call onThinkingToggle with correct value when pressed', () => {
    const mockOnThinkingToggle = jest.fn();
    const {getByLabelText} = render(
      <UserContext.Provider value={mockUser}>
        <ChatInput
          {...defaultProps}
          showThinkingToggle={true}
          isThinkingEnabled={false}
          onThinkingToggle={mockOnThinkingToggle}
        />
      </UserContext.Provider>,
    );

    const toggleButton = getByLabelText('Enable thinking mode');
    fireEvent.press(toggleButton);

    expect(mockOnThinkingToggle).toHaveBeenCalledWith(true);
  });

  it('should call onThinkingToggle with false when thinking is enabled and pressed', () => {
    const mockOnThinkingToggle = jest.fn();
    const {getByLabelText} = render(
      <UserContext.Provider value={mockUser}>
        <ChatInput
          {...defaultProps}
          showThinkingToggle={true}
          isThinkingEnabled={true}
          onThinkingToggle={mockOnThinkingToggle}
        />
      </UserContext.Provider>,
    );

    const toggleButton = getByLabelText('Disable thinking mode');
    fireEvent.press(toggleButton);

    expect(mockOnThinkingToggle).toHaveBeenCalledWith(false);
  });

  it('should render thinking toggle even when streaming', () => {
    const {getByLabelText} = render(
      <UserContext.Provider value={mockUser}>
        <ChatInput
          {...defaultProps}
          isStreaming={true}
          showThinkingToggle={true}
          isThinkingEnabled={false}
          onThinkingToggle={jest.fn()}
        />
      </UserContext.Provider>,
    );

    expect(getByLabelText('Enable thinking mode')).toBeTruthy();
  });

  it('should render thinking toggle even when stop is visible', () => {
    const {getByLabelText} = render(
      <UserContext.Provider value={mockUser}>
        <ChatInput
          {...defaultProps}
          isStopVisible={true}
          showThinkingToggle={true}
          isThinkingEnabled={false}
          onThinkingToggle={jest.fn()}
        />
      </UserContext.Provider>,
    );

    expect(getByLabelText('Enable thinking mode')).toBeTruthy();
  });

  it('renders the localized effort tier on the graded pill, not the raw token', () => {
    const {getByText, queryByText} = render(
      <UserContext.Provider value={mockUser}>
        <ChatInput
          {...defaultProps}
          showThinkingToggle={true}
          isThinkingEnabled={true}
          onThinkingToggle={jest.fn()}
          supportsEffort={true}
          effortValues={['low', 'medium', 'high']}
          reasoningEffort="high"
          onEffortCycle={jest.fn()}
        />
      </UserContext.Provider>,
    );

    expect(getByText('High')).toBeTruthy();
    expect(queryByText('high')).toBeNull();
  });

  it('looks the tier up in the table rather than hardcoding a single value', () => {
    const {getByText, queryByText} = render(
      <UserContext.Provider value={mockUser}>
        <ChatInput
          {...defaultProps}
          showThinkingToggle={true}
          isThinkingEnabled={true}
          onThinkingToggle={jest.fn()}
          supportsEffort={true}
          effortValues={['minimal', 'low', 'medium']}
          reasoningEffort="minimal"
          onEffortCycle={jest.fn()}
        />
      </UserContext.Provider>,
    );

    expect(getByText('Minimal')).toBeTruthy();
    expect(queryByText('minimal')).toBeNull();
  });

  it('degrades an unlisted tier to the raw string instead of dropping it', () => {
    const {getByText} = render(
      <UserContext.Provider value={mockUser}>
        <ChatInput
          {...defaultProps}
          showThinkingToggle={true}
          isThinkingEnabled={true}
          onThinkingToggle={jest.fn()}
          supportsEffort={true}
          effortValues={['low', 'medium', 'high']}
          reasoningEffort="turbo"
          onEffortCycle={jest.fn()}
        />
      </UserContext.Provider>,
    );

    expect(getByText('turbo')).toBeTruthy();
  });

  it('announces the active tier and that the control cycles on a graded pill', () => {
    const {getByLabelText, queryByLabelText} = render(
      <UserContext.Provider value={mockUser}>
        <ChatInput
          {...defaultProps}
          showThinkingToggle={true}
          isThinkingEnabled={true}
          onThinkingToggle={jest.fn()}
          supportsEffort={true}
          effortValues={['low', 'medium', 'high']}
          reasoningEffort="high"
          onEffortCycle={jest.fn()}
        />
      </UserContext.Provider>,
    );

    expect(getByLabelText(/Reasoning effort: High/i)).toBeTruthy();
    expect(getByLabelText(/cycle/i)).toBeTruthy();
    expect(queryByLabelText('Disable thinking mode')).toBeNull();
  });

  it('cycles effort instead of toggling when the graded pill is pressed', () => {
    const mockOnEffortCycle = jest.fn();
    const mockOnThinkingToggle = jest.fn();
    const {getByLabelText} = render(
      <UserContext.Provider value={mockUser}>
        <ChatInput
          {...defaultProps}
          showThinkingToggle={true}
          isThinkingEnabled={true}
          onThinkingToggle={mockOnThinkingToggle}
          supportsEffort={true}
          effortValues={['low', 'medium', 'high']}
          reasoningEffort="high"
          onEffortCycle={mockOnEffortCycle}
        />
      </UserContext.Provider>,
    );

    fireEvent.press(getByLabelText(/Reasoning effort: High/i));

    expect(mockOnEffortCycle).toHaveBeenCalledTimes(1);
    expect(mockOnThinkingToggle).not.toHaveBeenCalled();
  });

  it('selected state uses primary background + onPrimary foreground (global selected-state spec, no black onSurface)', () => {
    const {getByLabelText} = render(
      <UserContext.Provider value={mockUser}>
        <ChatInput
          {...defaultProps}
          showThinkingToggle={true}
          isThinkingEnabled={true}
          onThinkingToggle={jest.fn()}
        />
      </UserContext.Provider>,
    );

    const toggleButton = getByLabelText('Disable thinking mode');
    const flat = require('react-native').StyleSheet.flatten(
      toggleButton.props.style,
    );
    // 全局 UI 规范：选中态 = primary 底 + onPrimary 前景（禁止旧 onSurface 黑底）
    expect(flat.backgroundColor).toBe('#007AFF');
  });

  it('should handle missing onThinkingToggle callback gracefully', () => {
    const {getByLabelText} = render(
      <UserContext.Provider value={mockUser}>
        <ChatInput
          {...defaultProps}
          showThinkingToggle={true}
          isThinkingEnabled={false}
          onThinkingToggle={undefined}
        />
      </UserContext.Provider>,
    );

    const toggleButton = getByLabelText('Enable thinking mode');

    // Should not throw when pressed
    expect(() => fireEvent.press(toggleButton)).not.toThrow();
  });
});
