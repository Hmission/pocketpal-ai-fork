/**
 * Built-in Wikipedia provider — no API key: the public MediaWiki search API
 * (`action=query&list=search`) returns clean JSON, no scraping needed.
 * Serves as the fallback leg of the builtin composite engine (knowledge
 * queries answer well even when Bing is rate-limited or unreachable).
 */

import type {SearchHit, SearchOptions, SearchProvider} from '../types';
import {fetchJson} from './http';

const WIKI_API = 'https://zh.wikipedia.org/w/api.php';

interface WikiSearchResponse {
  query?: {
    search?: {title: string; snippet?: string}[];
  };
}

const stripTags = (html: string): string => html.replace(/<[^>]+>/g, '');

const decodeEntities = (text: string): string =>
  text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ');

export class WikipediaProvider implements SearchProvider {
  readonly id = 'builtin' as const;

  async search(query: string, opts: SearchOptions): Promise<SearchHit[]> {
    const params = new URLSearchParams({
      action: 'query',
      list: 'search',
      srsearch: query,
      srlimit: String(opts.maxResults),
      format: 'json',
      utf8: '1',
    });
    const data = await fetchJson<WikiSearchResponse>(
      `${WIKI_API}?${params.toString()}`,
      {method: 'GET'},
    );
    return (data.query?.search ?? []).map(r => ({
      title: decodeEntities(r.title),
      url: `https://zh.wikipedia.org/wiki/${encodeURIComponent(
        r.title.replace(/ /g, '_'),
      )}`,
      snippet: decodeEntities(stripTags(r.snippet ?? '')).trim(),
    }));
  }
}
