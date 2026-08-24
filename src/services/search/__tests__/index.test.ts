import {createSearchProvider, readWithDefaultReader} from '../index';
import type {SearchProviderId} from '../types';

describe('createSearchProvider', () => {
  it('builds the built-in composite engine', () => {
    const ids: SearchProviderId[] = ['builtin'];
    for (const id of ids) {
      expect(createSearchProvider(id).id).toBe(id);
    }
  });

  it('built-in engine searches without any key (no keycheck path)', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 429,
      text: () => Promise.resolve(''),
    });
    // No key concept exists — the engine goes straight to the network and
    // surfaces transport errors instead of a "key not set" gate.
    await expect(
      createSearchProvider('builtin').search('q', {maxResults: 3}),
    ).rejects.toThrow(/failed/i);
    expect(global.fetch).toHaveBeenCalled();
  });
});

describe('readWithDefaultReader (r.jina.ai fallback)', () => {
  beforeEach(() => {
    global.fetch = jest.fn();
  });

  it('fetches via r.jina.ai and returns PageContent for the original url', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      status: 200,
      text: () => Promise.resolve('clean page body'),
    });
    const page = await readWithDefaultReader('https://example.com/article');
    const [calledUrl] = (global.fetch as jest.Mock).mock.calls[0];
    expect(calledUrl).toBe('https://r.jina.ai/https://example.com/article');
    expect(page).toEqual({
      url: 'https://example.com/article',
      text: 'clean page body',
    });
  });

  it('throws on a non-ok reader response (never silent)', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 502,
      text: () => Promise.resolve(''),
    });
    await expect(
      readWithDefaultReader('https://example.com/x'),
    ).rejects.toThrow(/failed/i);
  });
});
