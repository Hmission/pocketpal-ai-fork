/**
 * Built-in Bing provider — no API key, no server: fetches Bing's classic
 * (non-JS) results page and parses the `b_algo` result blocks.
 *
 * Engineering notes:
 * - A desktop-like UA is required; Bing degrades/limits unknown clients.
 * - Every result is module-rate-limited (serial queue, MIN_INTERVAL_MS) so a
 *   burst of tool calls cannot trip Bing's anti-bot (202/429) gate.
 * - Result URLs are often `/ck/a` redirects carrying the real URL base64 in
 *   the `u` param; those are decoded so citations and read_url work directly.
 * - Failures throw (never silent-empty) — the builtin composite engine falls
 *   back to Wikipedia.
 */

import type {SearchHit, SearchOptions, SearchProvider} from '../types';
import {fetchText} from './http';

const BING_URL = 'https://www.bing.com/search';
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

/** Anti-bot pacing: one Bing request per MIN_INTERVAL_MS, app-wide. */
const MIN_INTERVAL_MS = 1200;
let lastRequestAt = 0;

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const throttle = async (): Promise<void> => {
  const wait = Math.max(0, lastRequestAt + MIN_INTERVAL_MS - Date.now());
  if (wait > 0) {
    await sleep(wait);
  }
  lastRequestAt = Date.now();
};

const decodeEntities = (text: string): string =>
  text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) =>
      String.fromCharCode(parseInt(hex, 16)),
    )
    .replace(/&#(\d+);/g, (_, dec: string) =>
      String.fromCharCode(parseInt(dec, 10)),
    );

const stripTags = (html: string): string => html.replace(/<[^>]+>/g, '');

/** Decode a base64 string to UTF-8 without relying on atob's binary output. */
const base64ToUtf8 = (b64: string): string => {
  const binary = atob(b64);
  const bytes = Uint8Array.from(binary, c => c.charCodeAt(0));
  return new TextDecoder('utf-8').decode(bytes);
};

/** `/ck/a` redirects carry the canonical URL base64 (minus its `a1` prefix) in `u`. */
const decodeResultUrl = (href: string): string => {
  if (!href.startsWith('https://www.bing.com/ck/a')) {
    return href;
  }
  const match = href.match(/[?&]u=a1([A-Za-z0-9+/=_-]+)/);
  if (!match) {
    return href;
  }
  try {
    const padded = match[1].replace(/-/g, '+').replace(/_/g, '/');
    return base64ToUtf8(padded);
  } catch {
    return href;
  }
};

const parseResults = (html: string, maxResults: number): SearchHit[] => {
  const hits: SearchHit[] = [];
  const blockPattern = /<li class="b_algo"[\s\S]*?<\/li>/g;
  let block: RegExpExecArray | null;
  while (
    (block = blockPattern.exec(html)) !== null &&
    hits.length < maxResults
  ) {
    const item = block[0];
    const anchor = item.match(
      /<h2[^>]*>\s*<a[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/,
    );
    if (!anchor) {
      continue; // non-web blocks (video/related) carry no standard link
    }
    const rawUrl = decodeEntities(anchor[1]);
    const title = decodeEntities(stripTags(anchor[2])).trim();
    const snippetMatch = item.match(/<p[^>]*>([\s\S]*?)<\/p>/);
    const snippet = snippetMatch
      ? decodeEntities(stripTags(snippetMatch[1])).trim()
      : '';
    if (!title && !snippet) {
      continue;
    }
    hits.push({title, url: decodeResultUrl(rawUrl), snippet});
  }
  return hits;
};

export class BingProvider implements SearchProvider {
  readonly id = 'builtin' as const;

  async search(query: string, opts: SearchOptions): Promise<SearchHit[]> {
    await throttle();
    const url = `${BING_URL}?q=${encodeURIComponent(
      query,
    )}&setlang=zh-cn&count=${opts.maxResults}`;
    const html = await fetchText(url, {
      method: 'GET',
      headers: {
        'User-Agent': UA,
        'Accept-Language': 'zh-CN,zh;q=0.9',
      },
    });
    if (html.length === 0) {
      throw new Error('empty Bing response');
    }
    return parseResults(html, opts.maxResults);
  }
}
