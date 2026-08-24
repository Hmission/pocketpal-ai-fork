import {BingProvider} from '../bing';

const BING_HTML = `<html><body>
<li class="b_algo" data-id="r1"><h2><a href="https://direct.example.com/a">Direct Result</a></h2><p>Direct snippet.</p></li>
<li class="b_algo"><h2><a href="https://www.bing.com/ck/a?!&amp;&amp;p=abc&amp;u=a1aHR0cHM6Ly9wb2tpLmNvbS96aD9tc29ja2lkPWFhYQ&amp;ntb=1">Redirected Result</a></h2><p>Redirect snippet.</p></li>
<li class="b_algo"><h2><a href="https://e.com/x">Title with &amp; &lt;x&gt; &#39;quote&#39;</a></h2><p>Snippet &amp;nbsp; with entities.</p></li>
<li class="b_algo"><div>no anchor block</div></li>
<li class="b_algo"><h2><a href="https://e.com/y"><strong>Bold</strong> Title</a></h2><p><span>Nested</span> snippet.</p></li>
</body></html>`;

const mockHtml = (html: string) => {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    status: 200,
    text: () => Promise.resolve(html),
  });
};

describe('BingProvider', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('parses b_algo blocks into hits (title/url/snippet)', async () => {
    mockHtml(BING_HTML);
    const hits = await new BingProvider().search('test', {maxResults: 5});
    expect(hits).toHaveLength(4);
    expect(hits[0]).toEqual({
      title: 'Direct Result',
      url: 'https://direct.example.com/a',
      snippet: 'Direct snippet.',
    });
  });

  it('decodes /ck/a redirect URLs via the base64 u param', async () => {
    mockHtml(BING_HTML);
    const hits = await new BingProvider().search('test', {maxResults: 5});
    expect(hits[1].url).toBe('https://poki.com/zh?msockid=aaa');
    expect(hits[1].title).toBe('Redirected Result');
  });

  it('decodes HTML entities and strips inner tags from title and snippet', async () => {
    mockHtml(BING_HTML);
    const hits = await new BingProvider().search('test', {maxResults: 5});
    expect(hits[2].title).toBe("Title with & <x> 'quote'");
    expect(hits[2].snippet).toBe('Snippet   with entities.');
    expect(hits[3].title).toBe('Bold Title');
    expect(hits[3].snippet).toBe('Nested snippet.');
  });

  it('respects maxResults', async () => {
    mockHtml(BING_HTML);
    const hits = await new BingProvider().search('test', {maxResults: 2});
    expect(hits).toHaveLength(2);
  });

  it('throws on a non-ok response (never silent-empty)', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 429,
      text: () => Promise.resolve(''),
    });
    await expect(
      new BingProvider().search('test', {maxResults: 3}),
    ).rejects.toThrow(/failed/i);
  });

  it('throws on an empty body', async () => {
    mockHtml('');
    await expect(
      new BingProvider().search('test', {maxResults: 3}),
    ).rejects.toThrow(/empty Bing response/i);
  });
});
