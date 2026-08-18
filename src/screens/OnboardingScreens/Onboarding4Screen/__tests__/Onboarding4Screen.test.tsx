import React from 'react';

import {render} from '../../../../../jest/test-utils';

import {L10nContext} from '../../../../utils';
import {l10n} from '../../../../locales';

import {Onboarding4Screen} from '../Onboarding4Screen';

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({
    navigate: jest.fn(),
    goBack: jest.fn(),
    canGoBack: () => true,
  }),
}));

describe('Onboarding4Screen storage permission note (phase-4 audit)', () => {
  it('renders the first-launch storage permission explanation', () => {
    const {getByText} = render(
      <L10nContext.Provider value={l10n.en}>
        <Onboarding4Screen />
      </L10nContext.Provider>,
    );

    expect(getByText(l10n.en.onboarding.screen4.storageNote)).toBeTruthy();
  });
});
