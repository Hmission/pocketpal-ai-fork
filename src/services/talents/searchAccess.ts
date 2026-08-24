import type {SearchProvider, PageContent} from '../search/types';

/**
 * Injected at `registerDefaultTalents()` so the search engines never import
 * `SearchProviderStore` — keeps `execute()` free of MobX/store coupling.
 */
export interface SearchAccess {
  getActiveProvider(): SearchProvider;
  /**
   * True only when the user has enabled search. The built-in engine needs no
   * key, so this is a pure privacy switch — enforced here, not just in the
   * Settings UI.
   */
  canSearch(): boolean;
  getResultCount(): number;
  readWithDefaultReader(url: string): Promise<PageContent>;
}
