import {WikipediaProvider} from '../wikipedia';

const WIKI_JSON = {
  query: {
    search: [
      {
        title: '小黄鸡',
        snippet: '<span class="searchmatch">小黄鸡</span>是一款 <b>AI</b> 应用',
      },
      {
        title: '小鸡快跑',
        snippet: '一部动画电影',
      },
    ],
  },
};

const mockJson = (data: unknown) => {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    status: 200,
    text: () => Promise.resolve(JSON.stringify(data)),
  });
};

describe('WikipediaProvider', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('maps MediaWiki search results to hits with canonical article URLs', async () => {
    mockJson(WIKI_JSON);
    const hits = await new WikipediaProvider().search('小黄鸡', {
      maxResults: 2,
    });
    expect(hits).toHaveLength(2);
    expect(hits[0]).toEqual({
      title: '小黄鸡',
      url: 'https://zh.wikipedia.org/wiki/%E5%B0%8F%E9%BB%84%E9%B8%A1',
      snippet: '小黄鸡是一款 AI 应用',
    });
    expect(hits[1].url).toBe(
      'https://zh.wikipedia.org/wiki/%E5%B0%8F%E9%B8%A1%E5%BF%AB%E8%B7%91',
    );
  });

  it('encodes spaces in titles as underscores in article URLs', async () => {
    mockJson({query: {search: [{title: 'React Native', snippet: '框架'}]}});
    const hits = await new WikipediaProvider().search('react native', {
      maxResults: 1,
    });
    expect(hits[0].url).toBe('https://zh.wikipedia.org/wiki/React_Native');
  });

  it('returns an empty list on no matches (not an error)', async () => {
    mockJson({query: {search: []}});
    const hits = await new WikipediaProvider().search('no-such-page-xyz', {
      maxResults: 3,
    });
    expect(hits).toEqual([]);
  });

  it('throws on a non-ok response (never silent-empty)', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 500,
      text: () => Promise.resolve(''),
    });
    await expect(
      new WikipediaProvider().search('test', {maxResults: 3}),
    ).rejects.toThrow(/failed/i);
  });
});
