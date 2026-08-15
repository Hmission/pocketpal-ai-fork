import React from 'react';
import {Alert} from 'react-native';
import {render, fireEvent} from '../../../../jest/test-utils';
import {AboutScreen} from '../AboutScreen';
import {l10n} from '../../../locales';

// Mock DeviceInfo
jest.mock('react-native-device-info', () => ({
  getVersion: jest.fn().mockReturnValue('1.0.0'),
  getBuildNumber: jest.fn().mockReturnValue('100'),
}));

// Mock Clipboard
jest.mock('@react-native-clipboard/clipboard', () => ({
  setString: jest.fn(),
}));

jest.spyOn(Alert, 'alert');

describe('AboutScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the brand card only (no GitHub/support sections)', () => {
    const {getByText, queryByText} = render(<AboutScreen />);

    expect(getByText('小黄鸡')).toBeTruthy();
    expect(getByText('v1.0.0 (100)')).toBeTruthy();
    expect(getByText(l10n.en.about.description)).toBeTruthy();
    // 标准版文案：详细段落 + 特性列表 + 开源说明 + 基于行
    expect(getByText(l10n.en.about.body)).toBeTruthy();
    expect(getByText(l10n.en.about.featuresTitle)).toBeTruthy();
    l10n.en.about.features.forEach(feature => {
      expect(getByText(`•  ${feature}`)).toBeTruthy();
    });
    expect(getByText(l10n.en.about.openSourceBody)).toBeTruthy();
    expect(getByText(l10n.en.about.basedOn)).toBeTruthy();
    // 精简后不再展示开源项目支持/GitHub/新手指引/法律行
    expect(queryByText(l10n.en.about.supportProject)).toBeNull();
    expect(queryByText(l10n.en.about.githubButton)).toBeNull();
    expect(queryByText(l10n.en.about.tour)).toBeNull();
    expect(queryByText(l10n.en.about.privacyPolicy)).toBeNull();
  });

  it('copies version to clipboard when version button is pressed', () => {
    const {getByText} = render(<AboutScreen />);

    fireEvent.press(getByText('v1.0.0 (100)'));

    expect(Alert.alert).toHaveBeenCalledWith(
      l10n.en.about.versionCopiedTitle,
      l10n.en.about.versionCopiedDescription,
    );
  });
});
