/**
 * Builtin composite search engine — the single selectable provider:
 * Bing first (broad web coverage), Wikipedia as automatic fallback for
 * transport failures, rate limits, or empty result sets (knowledge queries).
 * No API key, no server — works on any network with internet access.
 */

import type {SearchHit, SearchOptions, SearchProvider} from '../types';
import {BingProvider} from './bing';
import {WikipediaProvider} from './wikipedia';

export class BuiltinProvider implements SearchProvider {
  readonly id = 'builtin' as const;

  private readonly bing = new BingProvider();
  private readonly wikipedia = new WikipediaProvider();

  async search(query: string, opts: SearchOptions): Promise<SearchHit[]> {
    try {
      const hits = await this.bing.search(query, opts);
      if (hits.length > 0) {
        return hits;
      }
    } catch (e) {
      if (__DEV__) {
        const msg = e instanceof Error ? e.message : String(e);
        console.log('[builtin] Bing failed, falling back to Wikipedia:', msg);
      }
    }
    return this.wikipedia.search(query, opts);
  }
}
