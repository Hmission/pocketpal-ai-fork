import {makeAutoObservable, runInAction} from 'mobx';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {makePersistable} from 'mobx-persist-store';

import type {SearchProviderId} from '../services/search/types';
import {resetSearchCache} from '../services/search/searchBudget';

export interface SearchProviderMeta {
  id: SearchProviderId;
  label: string;
  /** Gated providers appear in the picker but cannot be the active provider. */
  selectable: boolean;
}

/**
 * Single built-in engine (Bing + Wikipedia) — nothing to configure, no API key.
 * The list stays a single entry so the provider abstraction survives.
 */
export const SEARCH_PROVIDERS: SearchProviderMeta[] = [
  {id: 'builtin', label: 'Bing + Wikipedia', selectable: true},
];

const DEFAULT_PROVIDER: SearchProviderId = 'builtin';
const DEFAULT_RESULT_COUNT = 5;
const MIN_RESULT_COUNT = 1;
const MAX_RESULT_COUNT = 8;
/**
 * Persisted-schema version. v1 = BYOK provider era (consent false by
 * default); v2 = built-in engine era (search is on by default). Hydration
 * migrates stale v1 data so upgraded installs don't inherit a dead switch.
 */
const STORE_SCHEMA_VERSION = 2;

class SearchProviderStore {
  activeProviderId: SearchProviderId = DEFAULT_PROVIDER;
  resultCount: number = DEFAULT_RESULT_COUNT;
  /**
   * Built-in engines need no key, so search works out of the box; the flag is
   * the user's privacy kill-switch (default on, revocable in Settings).
   */
  hasConsentedToSearch = true;
  /** Persisted schema version — drives one-shot migrations (see normalize). */
  // 0 = uninitialized (fresh install or pre-v2 persisted data): the migration
  // branch must see it as stale, so it can never default to the current
  // version and silently skip the consent reset.
  schemaVersion: number = 0;

  constructor() {
    makeAutoObservable(this);

    makePersistable(this, {
      name: 'SearchProviderStore',
      properties: [
        'activeProviderId',
        'resultCount',
        'hasConsentedToSearch',
        'schemaVersion',
      ],
      storage: AsyncStorage,
    }).then(() => this.normalizeHydratedPrefs());
  }

  // Persisted prefs skip the setters — re-validate after hydration so a stale
  // unknown provider, malformed type, or out-of-range count can't survive a
  // reload. Consent is a privacy gate: only a literal true counts.
  normalizeHydratedPrefs() {
    const meta = SEARCH_PROVIDERS.find(p => p.id === this.activeProviderId);
    const provider =
      meta && meta.selectable ? this.activeProviderId : DEFAULT_PROVIDER;
    const rawCount: unknown = this.resultCount;
    const count =
      typeof rawCount === 'number' && Number.isFinite(rawCount)
        ? Math.min(
            MAX_RESULT_COUNT,
            Math.max(MIN_RESULT_COUNT, Math.round(rawCount)),
          )
        : DEFAULT_RESULT_COUNT;
    const rawVersion: unknown = this.schemaVersion;
    const version =
      typeof rawVersion === 'number' && Number.isFinite(rawVersion)
        ? rawVersion
        : 0;
    // v1 → v2: the old BYOK-era consent gate (default off) no longer maps to
    // the built-in engine (default on). A one-shot reset makes upgraded
    // installs work out of the box; any later explicit opt-out survives
    // because version is already bumped past the migration.
    const consent =
      version < STORE_SCHEMA_VERSION
        ? true
        : (this.hasConsentedToSearch as unknown) === true;
    runInAction(() => {
      this.activeProviderId = provider;
      this.resultCount = count;
      this.hasConsentedToSearch = consent;
      this.schemaVersion = STORE_SCHEMA_VERSION;
    });
  }

  get providers(): SearchProviderMeta[] {
    return SEARCH_PROVIDERS;
  }

  /** Built-in engine is always configured — no key to check. */
  get canSearch(): boolean {
    return this.hasConsentedToSearch;
  }

  setActiveProvider(id: SearchProviderId) {
    const meta = SEARCH_PROVIDERS.find(p => p.id === id);
    if (!meta || !meta.selectable) {
      return;
    }
    runInAction(() => {
      this.activeProviderId = id;
    });
    resetSearchCache();
  }

  setResultCount(count: number) {
    const clamped = Math.min(
      MAX_RESULT_COUNT,
      Math.max(MIN_RESULT_COUNT, Math.round(count)),
    );
    runInAction(() => {
      this.resultCount = clamped;
    });
  }

  setConsent(consented: boolean) {
    runInAction(() => {
      this.hasConsentedToSearch = consented;
    });
    resetSearchCache();
  }
}

export const searchProviderStore = new SearchProviderStore();
export {SearchProviderStore};
