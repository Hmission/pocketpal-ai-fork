import React from 'react';
import {runInAction} from 'mobx';
import {
  fireEvent,
  render as baseRender,
  act,
} from '../../../../jest/test-utils';

import {SystemSettingsScreen} from '../SystemSettingsScreen';

import {uiStore, ttsStore} from '../../../store';
import {l10n} from '../../../locales';

jest.useFakeTimers();

const render = (ui: React.ReactElement, options: any = {}) =>
  baseRender(ui, {withBottomSheetProvider: true, ...options});

describe('SystemSettingsScreen（v3.8 系统设置页）', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    // Reset observable fields between tests
    runInAction(() => {
      uiStore.colorScheme = 'system';
      uiStore.selfCheckEnabled = false;
      ttsStore.deviceMeetsMemory = false;
      ttsStore.userTTSOverride = null;
    });
  });

  it('renders language + color scheme + AIOS features sections', async () => {
    const {getByText, getByTestId} = render(<SystemSettingsScreen />, {
      withSafeArea: true,
      withNavigation: true,
    });

    // 语言区（Card.Title 与 sheet title 都含 Language → 用 testID 断言）
    expect(getByTestId('language-selector-button')).toBeTruthy();
    expect(getByText('Color Scheme')).toBeTruthy();
    expect(getByText('App Settings')).toBeTruthy();
    // 色彩模式三选
    expect(getByText('System')).toBeTruthy();
    expect(getByText('Light')).toBeTruthy();
    expect(getByText('Dark Mode')).toBeTruthy();
  });

  it('color scheme: tapping System calls setColorScheme(system)', async () => {
    runInAction(() => {
      uiStore.colorScheme = 'light';
    });
    const {getByText} = render(<SystemSettingsScreen />, {
      withSafeArea: true,
      withNavigation: true,
    });

    await act(async () => {
      fireEvent.press(getByText('System'));
    });

    expect(uiStore.setColorScheme).toHaveBeenCalledWith('system');
  });

  it('color scheme: tapping Light calls setColorScheme(light)', async () => {
    runInAction(() => {
      uiStore.colorScheme = 'dark';
    });
    const {getByText} = render(<SystemSettingsScreen />, {
      withSafeArea: true,
      withNavigation: true,
    });

    await act(async () => {
      fireEvent.press(getByText('Light'));
    });

    expect(uiStore.setColorScheme).toHaveBeenCalledWith('light');
  });

  it('self-check toggle calls setSelfCheckEnabled', async () => {
    const {getByTestId} = render(<SystemSettingsScreen />, {
      withSafeArea: true,
      withNavigation: true,
    });

    const sw = getByTestId('self-check-switch');
    await act(async () => {
      fireEvent(sw, 'valueChange', true);
    });

    expect(uiStore.setSelfCheckEnabled).toHaveBeenCalledWith(true);
  });

  it('tts availability: low-memory shows warning helper line', async () => {
    runInAction(() => {
      ttsStore.deviceMeetsMemory = false;
      ttsStore.userTTSOverride = null;
    });
    const {getByTestId, getByText} = render(<SystemSettingsScreen />, {
      withSafeArea: true,
      withNavigation: true,
    });

    const sw = getByTestId('tts-availability-switch');
    expect(sw.props.value).toBe(false);
    expect(
      getByText(l10n.en.settings.ttsAvailabilityLowMemoryWarning),
    ).toBeTruthy();
  });

  it('tts availability: toggling ON calls setUserTTSOverride(true)', async () => {
    runInAction(() => {
      ttsStore.deviceMeetsMemory = false;
      ttsStore.userTTSOverride = null;
    });
    const {getByTestId} = render(<SystemSettingsScreen />, {
      withSafeArea: true,
      withNavigation: true,
    });

    const sw = getByTestId('tts-availability-switch');
    await act(async () => {
      fireEvent(sw, 'valueChange', true);
    });

    expect(ttsStore.setUserTTSOverride).toHaveBeenCalledWith(true);
  });
});
