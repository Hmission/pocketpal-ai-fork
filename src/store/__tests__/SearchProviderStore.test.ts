import {makePersistable} from 'mobx-persist-store';

import {SearchProviderStore, SEARCH_PROVIDERS} from '../SearchProviderStore';
import * as budget from '../../services/search/searchBudget';

// `mobx-persist-store` is globally mocked (jest.config.js moduleNameMapper →
// __mocks__/external/mobx-persist-store.js); `makePersistable` is a jest.fn.
const persistMock = makePersistable as jest.Mock;

const flush = () => new Promise(resolve => setImmediate(resolve));

describe('SearchProviderStore', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const newStore = async () => {
    const store = new SearchProviderStore();
    await flush();
    return store;
  };

  describe('initial state', () => {
    it('defaults to the built-in engine, result count 5, search enabled', async () => {
      const store = await newStore();
      expect(store.activeProviderId).toBe('builtin');
      expect(store.resultCount).toBe(5);
      expect(store.hasConsentedToSearch).toBe(true);
    });

    it('lists only the built-in engine, selectable', () => {
      expect(SEARCH_PROVIDERS).toEqual([
        {id: 'builtin', label: expect.any(String), selectable: true},
      ]);
    });
  });

  describe('persisted prefs (no secrets in storage)', () => {
    it('persists only non-secret prefs via AsyncStorage', async () => {
      await newStore();
      const config = persistMock.mock.calls[0][1];
      expect(config.properties).toEqual([
        'activeProviderId',
        'resultCount',
        'hasConsentedToSearch',
        'schemaVersion',
      ]);
      expect(JSON.stringify(config.properties)).not.toMatch(/key/i);
    });
  });

  describe('preferences', () => {
    it('accepts the built-in provider as active', async () => {
      const store = await newStore();
      store.setActiveProvider('builtin');
      expect(store.activeProviderId).toBe('builtin');
    });

    it('clamps result count into range', async () => {
      const store = await newStore();
      store.setResultCount(0);
      expect(store.resultCount).toBe(1);
      store.setResultCount(99);
      expect(store.resultCount).toBe(8);
      store.setResultCount(4);
      expect(store.resultCount).toBe(4);
    });

    it('toggles search consent', async () => {
      const store = await newStore();
      store.setConsent(false);
      expect(store.hasConsentedToSearch).toBe(false);
      store.setConsent(true);
      expect(store.hasConsentedToSearch).toBe(true);
    });
  });

  describe('post-hydration normalization (persisted prefs bypass setters)', () => {
    it('resets a persisted unknown provider to the default', async () => {
      const store = await newStore();
      (store as any).activeProviderId = 'brave'; // stale BYOK-era value
      store.normalizeHydratedPrefs();
      expect(store.activeProviderId).toBe('builtin');
    });

    it('clamps a persisted out-of-range result count', async () => {
      const store = await newStore();
      store.resultCount = 99;
      store.normalizeHydratedPrefs();
      expect(store.resultCount).toBe(8);

      store.resultCount = 0;
      store.normalizeHydratedPrefs();
      expect(store.resultCount).toBe(1);
    });

    it('leaves valid persisted prefs unchanged', async () => {
      const store = await newStore();
      store.activeProviderId = 'builtin';
      store.resultCount = 4;
      store.hasConsentedToSearch = false;
      store.normalizeHydratedPrefs();
      expect(store.activeProviderId).toBe('builtin');
      expect(store.resultCount).toBe(4);
      expect(store.hasConsentedToSearch).toBe(false);
    });

    it('treats a non-boolean persisted consent as no consent', async () => {
      const store = await newStore();
      (store as any).hasConsentedToSearch = 'false'; // truthy string from tampered storage
      store.normalizeHydratedPrefs();
      expect(store.hasConsentedToSearch).toBe(false);
      expect(store.canSearch).toBe(false);
    });

    it('migrates v1 BYOK-era data: consent reset to on, schema bumped', async () => {
      // Upgraded installs carry the old default-off consent gate plus no
      // schemaVersion; the built-in engine must not inherit a dead switch.
      const store = await newStore();
      (store as any).schemaVersion = 0;
      (store as any).hasConsentedToSearch = false;
      store.normalizeHydratedPrefs();
      expect(store.hasConsentedToSearch).toBe(true);
      expect(store.schemaVersion).toBe(2);
      expect(store.canSearch).toBe(true);
    });

    it('preserves an explicit opt-out once the schema is current', async () => {
      const store = await newStore();
      store.setConsent(false);
      store.normalizeHydratedPrefs();
      expect(store.hasConsentedToSearch).toBe(false);
      expect(store.schemaVersion).toBe(2);
      expect(store.canSearch).toBe(false);
    });

    it('restores the default on a non-numeric or non-finite persisted count', async () => {
      const store = await newStore();
      for (const bad of ['bad', NaN, null, {}, Infinity]) {
        (store as any).resultCount = bad;
        store.normalizeHydratedPrefs();
        expect(store.resultCount).toBe(5);
      }
    });
  });

  describe('canSearch (privacy switch only — built-in engine needs no key)', () => {
    it('is true by default and false only when consent is revoked', async () => {
      const store = await newStore();
      expect(store.canSearch).toBe(true);

      store.setConsent(false);
      expect(store.canSearch).toBe(false);

      store.setConsent(true);
      expect(store.canSearch).toBe(true);
    });
  });

  describe('cache invalidation on consent/provider changes', () => {
    it('resets the search cache on consent and provider changes', async () => {
      const reset = jest.spyOn(budget, 'resetSearchCache');
      const store = await newStore();
      reset.mockClear();

      store.setConsent(false);
      store.setConsent(true);
      store.setActiveProvider('builtin');

      expect(reset.mock.calls.length).toBeGreaterThanOrEqual(3);
      reset.mockRestore();
    });
  });
});
