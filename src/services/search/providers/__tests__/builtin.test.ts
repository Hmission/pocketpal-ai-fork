import {BuiltinProvider} from '../builtin';

const BING_HTML = `<html><body>
<li class="b_algo"><h2><a href="https://bing-hit.example.com/a">Bing Hit</a></h2><p>Bing snippet.</p></li>
</body></html>`;

const WIKI_JSON = {
  query: {
    search: [{title: '维基条目', snippet: '维基摘要'}],
  },
};

const mockFetchSequence = (responses: unknown[]) => {
  const fetchMock = jest.fn();
  for (const r of responses) {
    fetchMock.mockResolvedValueOnce(r);
  }
  global.fetch = fetchMock;
  return fetchMock;
};

const okHtml = (html: string) => ({
  ok: true,
  status: 200,
  text: () => Promise.resolve(html),
});

const okJson = (data: unknown) => ({
  ok: true,
  status: 200,
  text: () => Promise.resolve(JSON.stringify(data)),
});

describe('BuiltinProvider (Bing first, Wikipedia fallback)', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('returns Bing hits without touching Wikipedia when Bing succeeds', async () => {
    const fetchMock = mockFetchSequence([okHtml(BING_HTML)]);
    const hits = await new BuiltinProvider().search('test', {maxResults: 3});
    expect(hits).toHaveLength(1);
    expect(hits[0].title).toBe('Bing Hit');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('falls back to Wikipedia when Bing throws (rate limit/transport)', async () => {
    const fetchMock = mockFetchSequence([
      {ok: false, status: 429, text: () => Promise.resolve('')},
      okJson(WIKI_JSON),
    ]);
    const hits = await new BuiltinProvider().search('test', {maxResults: 3});
    expect(hits).toHaveLength(1);
    expect(hits[0]).toEqual({
      title: '维基条目',
      url: 'https://zh.wikipedia.org/wiki/%E7%BB%B4%E5%9F%BA%E6%9D%A1%E7%9B%AE',
      snippet: '维基摘要',
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('falls back to Wikipedia when Bing returns no results', async () => {
    const fetchMock = mockFetchSequence([
      okHtml('<html><body>no results here</body></html>'),
      okJson(WIKI_JSON),
    ]);
    const hits = await new BuiltinProvider().search('test', {maxResults: 3});
    expect(hits).toHaveLength(1);
    expect(hits[0].title).toBe('维基条目');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
