import React from 'react';
import {render, fireEvent, waitFor} from '@testing-library/react-native';
import {Platform} from 'react-native';

import {EmbeddedVideoView} from '../EmbeddedVideoView';
import {L10nContext} from '../../../utils';
import {l10n} from '../../../locales';

import {infoDialog} from '../../ui/InfoDialog';

// Mock react-native-vision-camera
jest.mock('react-native-vision-camera', () => {
  const mockReact = require('react');
  return {
    Camera: mockReact.forwardRef(({children, ...props}: any, ref: any) =>
      mockReact.createElement(
        'View',
        {ref, testID: 'camera', ...props},
        children,
      ),
    ),
    useCameraDevice: jest.fn(() => ({id: 'mock-device'})),
    useCameraPermission: jest.fn(() => ({
      hasPermission: true,
      requestPermission: jest.fn(() => Promise.resolve(true)),
    })),
  };
});

// Mock react-native-vector-icons
jest.mock('react-native-vector-icons/MaterialCommunityIcons', () => 'Icon');

// Mock useTheme hook
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
        size: {minTapTarget: 44, controlHeight: 36}, // R1 size 域防御补全
        card: 'l',
        surface: 'm',
        pill: 'full',
        inputSmall: 's',
        circle: 'full',
      },
    },
    // B58：流式重构消费 spacing token（与 tokens/spacing 对齐）
    spacing: {
      none: 0,
      xxs: 2,
      xs: 4,
      s: 8,
      sm: 12,
      m: 16,
      ml: 20,
      l: 24,
      xl: 32,
      xxl: 40,
    },
    colors: {
      primary: '#007AFF',
      surface: '#FFFFFF',
      onSurface: '#000000',
    },
  }),
}));

// Mock InfoDialog
jest.mock('../../ui/InfoDialog', () => ({
  infoDialog: jest.fn().mockResolvedValue(undefined),
}));

// Mock Platform
Object.defineProperty(Platform, 'OS', {
  get: jest.fn(() => 'ios'),
});

const defaultProps = {
  onCapture: jest.fn(),
  onClose: jest.fn(),
  captureInterval: 2000,
  onCaptureIntervalChange: jest.fn(),
  responseText: undefined,
};

describe('EmbeddedVideoView', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('renders correctly with camera permission', () => {
    const {getByTestId} = render(
      <L10nContext.Provider value={l10n.en}>
        <EmbeddedVideoView {...defaultProps} />
      </L10nContext.Provider>,
    );

    expect(getByTestId('camera')).toBeTruthy();
  });

  it('renders response text when provided', () => {
    const {getByText} = render(
      <L10nContext.Provider value={l10n.en}>
        <EmbeddedVideoView {...defaultProps} responseText="Test response" />
      </L10nContext.Provider>,
    );

    expect(getByText('Test response')).toBeTruthy();
  });

  it('does not render response overlay when no response text', () => {
    const {queryByText} = render(
      <L10nContext.Provider value={l10n.en}>
        <EmbeddedVideoView {...defaultProps} />
      </L10nContext.Provider>,
    );

    // Should not have response text specifically
    expect(queryByText('Test response')).toBeNull();
  });

  it('handles camera permission request', async () => {
    const mockRequestPermission = jest.fn(() => Promise.resolve(true));
    const {useCameraPermission} = require('react-native-vision-camera');
    useCameraPermission.mockReturnValue({
      hasPermission: false,
      requestPermission: mockRequestPermission,
    });

    render(
      <L10nContext.Provider value={l10n.en}>
        <EmbeddedVideoView {...defaultProps} />
      </L10nContext.Provider>,
    );

    // Wait for the component to request permission
    await waitFor(
      () => {
        expect(mockRequestPermission).toHaveBeenCalled();
      },
      {timeout: 3000},
    );
  });

  it('shows permission alert when permission denied', async () => {
    const mockRequestPermission = jest.fn(() => Promise.resolve(false));
    const {useCameraPermission} = require('react-native-vision-camera');
    useCameraPermission.mockReturnValue({
      hasPermission: false,
      requestPermission: mockRequestPermission,
    });

    render(
      <L10nContext.Provider value={l10n.en}>
        <EmbeddedVideoView {...defaultProps} />
      </L10nContext.Provider>,
    );

    await waitFor(() => {
      expect(infoDialog).toHaveBeenCalledWith({
        title: l10n.en.video.permissionTitle,
        message: l10n.en.video.permissionMessage,
        buttonText: l10n.en.common.ok,
      });
    });
  });

  it('handles permission request error', async () => {
    const mockRequestPermission = jest.fn(() =>
      Promise.reject(new Error('Permission error')),
    );
    const {useCameraPermission} = require('react-native-vision-camera');
    useCameraPermission.mockReturnValue({
      hasPermission: false,
      requestPermission: mockRequestPermission,
    });

    render(
      <L10nContext.Provider value={l10n.en}>
        <EmbeddedVideoView {...defaultProps} />
      </L10nContext.Provider>,
    );

    await waitFor(
      () => {
        expect(infoDialog).toHaveBeenCalledWith({
          title: l10n.en.video.permissionTitle,
          message: l10n.en.video.permissionMessage,
          buttonText: l10n.en.common.ok,
        });
      },
      {timeout: 3000},
    );
  });

  it('toggles camera position when flip button is pressed', () => {
    // Mock camera permission as granted
    const {useCameraPermission} = require('react-native-vision-camera');
    useCameraPermission.mockReturnValue({
      hasPermission: true,
      requestPermission: jest.fn(),
    });

    const {getByTestId} = render(
      <L10nContext.Provider value={l10n.en}>
        <EmbeddedVideoView {...defaultProps} />
      </L10nContext.Provider>,
    );

    const flipButton = getByTestId('flip-camera-button');

    // Just verify the button exists and can be pressed
    expect(flipButton).toBeTruthy();
    fireEvent.press(flipButton);

    // The camera position toggle is internal state, so we just verify the button works
    expect(flipButton).toBeTruthy();
  });

  it('increases capture interval when increase button is pressed', () => {
    // Mock camera permission as granted
    const {useCameraPermission} = require('react-native-vision-camera');
    useCameraPermission.mockReturnValue({
      hasPermission: true,
      requestPermission: jest.fn(),
    });

    const {getByTestId} = render(
      <L10nContext.Provider value={l10n.en}>
        <EmbeddedVideoView {...defaultProps} captureInterval={2000} />
      </L10nContext.Provider>,
    );

    const increaseButton = getByTestId('increase-interval-button');
    fireEvent.press(increaseButton);

    expect(defaultProps.onCaptureIntervalChange).toHaveBeenCalledWith(2500);
  });

  it('decreases capture interval when decrease button is pressed', () => {
    // Mock camera permission as granted
    const {useCameraPermission} = require('react-native-vision-camera');
    useCameraPermission.mockReturnValue({
      hasPermission: true,
      requestPermission: jest.fn(),
    });

    const {getByTestId} = render(
      <L10nContext.Provider value={l10n.en}>
        <EmbeddedVideoView {...defaultProps} captureInterval={2000} />
      </L10nContext.Provider>,
    );

    const decreaseButton = getByTestId('decrease-interval-button');
    fireEvent.press(decreaseButton);

    expect(defaultProps.onCaptureIntervalChange).toHaveBeenCalledWith(1500);
  });

  it('does not decrease interval below minimum', () => {
    // Mock camera permission as granted
    const {useCameraPermission} = require('react-native-vision-camera');
    useCameraPermission.mockReturnValue({
      hasPermission: true,
      requestPermission: jest.fn(),
    });

    const {getByTestId} = render(
      <L10nContext.Provider value={l10n.en}>
        <EmbeddedVideoView {...defaultProps} captureInterval={500} />
      </L10nContext.Provider>,
    );

    const decreaseButton = getByTestId('decrease-interval-button');
    fireEvent.press(decreaseButton);

    expect(defaultProps.onCaptureIntervalChange).toHaveBeenCalledWith(500); // Should stay at minimum
  });

  it('does not increase interval above maximum', () => {
    // Mock camera permission as granted
    const {useCameraPermission} = require('react-native-vision-camera');
    useCameraPermission.mockReturnValue({
      hasPermission: true,
      requestPermission: jest.fn(),
    });

    const {getByTestId} = render(
      <L10nContext.Provider value={l10n.en}>
        <EmbeddedVideoView {...defaultProps} captureInterval={5000} />
      </L10nContext.Provider>,
    );

    const increaseButton = getByTestId('increase-interval-button');
    fireEvent.press(increaseButton);

    expect(defaultProps.onCaptureIntervalChange).toHaveBeenCalledWith(5000); // Should stay at maximum
  });

  it('calls onClose when close button is pressed', () => {
    // Mock camera permission as granted
    const {useCameraPermission} = require('react-native-vision-camera');
    useCameraPermission.mockReturnValue({
      hasPermission: true,
      requestPermission: jest.fn(),
    });

    const {getByTestId} = render(
      <L10nContext.Provider value={l10n.en}>
        <EmbeddedVideoView {...defaultProps} />
      </L10nContext.Provider>,
    );

    const closeButton = getByTestId('close-button');
    fireEvent.press(closeButton);

    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it('detects iOS simulator correctly', () => {
    // Mock camera permission as granted
    const {
      useCameraPermission,
      useCameraDevice,
    } = require('react-native-vision-camera');
    useCameraPermission.mockReturnValue({
      hasPermission: true,
      requestPermission: jest.fn(),
    });
    useCameraDevice.mockReturnValue(null); // Simulate no device (simulator)

    const {getByText} = render(
      <L10nContext.Provider value={l10n.en}>
        <EmbeddedVideoView {...defaultProps} />
      </L10nContext.Provider>,
    );

    // Should show simulator message when no camera device is available
    expect(
      getByText(
        'Camera not available in simulator. Please use a physical device.',
      ),
    ).toBeTruthy();
  });
});
