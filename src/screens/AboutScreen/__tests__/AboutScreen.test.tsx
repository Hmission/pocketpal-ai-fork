import React from 'react';
import {Linking} from 'react-native';
import {render, fireEvent} from '../../../../jest/test-utils';
import {AboutScreen} from '../AboutScreen';
import {l10n} from '../../../locales';
import {GITHUB_REPO_URL} from '../../../utils/openSource';
import * as InfoDialog from '../../../components/ui/InfoDialog';

// Mock DeviceInfo
jest.mock('react-native-device-info', () => ({
  getVersion: jest.fn().mockReturnValue('1.0.0'),
  getBuildNumber: jest.fn().mockReturnValue('100'),
}));

// Mock Clipboard
jest.mock('@react-native-clipboard/clipboard', () => ({
  setString: jest.fn(),
}));

// 08-25 InfoDialog 统一：错误/信息弹窗已迁 infoDialog（Alert → infoDialog）
const infoDialogSpy = jest.spyOn(InfoDialog, 'infoDialog').mockResolvedValue();

jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined as any);

describe('AboutScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the brand card with the open-source GitHub entry', () => {
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
    // 开源定位：GitHub 引导语 + 按钮
    expect(getByText(l10n.en.about.githubRepoDescription)).toBeTruthy();
    expect(getByText(l10n.en.about.githubButton)).toBeTruthy();
    // 精简后不再展示上游支持/赞助/新手指引/法律行
    expect(queryByText(l10n.en.about.supportProject)).toBeNull();
    expect(queryByText(l10n.en.about.tour)).toBeNull();
    expect(queryByText(l10n.en.about.privacyPolicy)).toBeNull();
  });

  it('opens the GitHub repo when the GitHub button is pressed', () => {
    const {getByTestId} = render(<AboutScreen />);

    fireEvent.press(getByTestId('github-repo-button'));

    expect(Linking.openURL).toHaveBeenCalledWith(GITHUB_REPO_URL);
  });

  it('copies version to clipboard when version button is pressed', () => {
    const {getByText} = render(<AboutScreen />);

    fireEvent.press(getByText('v1.0.0 (100)'));

    expect(infoDialogSpy).toHaveBeenCalledWith({
      title: l10n.en.about.versionCopiedTitle,
      message: l10n.en.about.versionCopiedDescription,
    });
  });
});
