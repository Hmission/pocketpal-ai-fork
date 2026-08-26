import type {SearchProvider, SearchProviderId, PageContent} from './types';
import {fetchText} from './providers/http';
import {BuiltinProvider} from './providers/builtin';

export type {
  SearchProvider,
  SearchProviderId,
  SearchHit,
  PageContent,
  SearchBudget,
  SearchOptions,
} from './types';
export {
  budgetHits,
  budgetPage,
  getCachedHits,
  setCachedHits,
  resetSearchCache,
} from './searchBudget';

/** Built-in composite engine (Bing + Wikipedia) — no key accessor needed. */
export const createSearchProvider = (id: SearchProviderId): SearchProvider => {
  switch (id) {
    case 'builtin':
      return new BuiltinProvider();
  }
};

/** Fallback reader for providers without native read(): r.jina.ai returns clean plain text, no key. */
export const readWithDefaultReader = async (
  url: string,
): Promise<PageContent> => {
  const text = await fetchText(`https://r.jina.ai/${encodeURI(url)}`, {
    method: 'GET',
  });
  return {url, text};
};
