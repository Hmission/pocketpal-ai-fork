import {makeAutoObservable} from 'mobx';

import {SEARCH_PROVIDERS} from '../../src/store/SearchProviderStore';
import type {SearchProviderId} from '../../src/services/search/types';

class MockSearchProviderStore {
  activeProviderId: SearchProviderId = 'builtin';
  resultCount = 5;
  hasConsentedToSearch = true;

  setActiveProvider: jest.Mock;
  setResultCount: jest.Mock;
  setConsent: jest.Mock;

  constructor() {
    makeAutoObservable(this, {
      setActiveProvider: false,
      setResultCount: false,
      setConsent: false,
    });

    this.setActiveProvider = jest.fn((id: SearchProviderId) => {
      this.activeProviderId = id;
    });
    this.setResultCount = jest.fn((count: number) => {
      this.resultCount = count;
    });
    this.setConsent = jest.fn((consented: boolean) => {
      this.hasConsentedToSearch = consented;
    });
  }

  get providers() {
    return SEARCH_PROVIDERS;
  }

  get canSearch(): boolean {
    return this.hasConsentedToSearch;
  }
}

export const mockSearchProviderStore = new MockSearchProviderStore();
