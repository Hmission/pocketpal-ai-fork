import {RenderHtmlEngine} from '../RenderHtmlEngine';

describe('RenderHtmlEngine', () => {
  const engine = new RenderHtmlEngine();

  // The success summary is what the model reads as the tool result on
  // its follow-up turn. It must (a) signal SUCCESS so the model
  // doesn't apologize, (b) tell the model the user can already see
  // the preview so it doesn't re-describe it, and (c) cap the
  // follow-up at one sentence.
  const expectSuccessSummary = (summary: string) => {
    expect(summary).toMatch(/render_html.*SUCCESS/i);
    expect(summary).toMatch(/preview/i);
    expect(summary).toMatch(/one short sentence/i);
  };

  it('exposes name "render_html"', () => {
    expect(engine.name).toBe('render_html');
  });

  it('returns an html TalentResult when given html and title', async () => {
    const result = await engine.execute({
      html: '<p>hi</p>',
      title: 'Greeting',
    });
    expect(result.type).toBe('html');
    if (result.type === 'html') {
      expect(result.html).toBe('<p>hi</p>');
      expect(result.title).toBe('Greeting');
      expectSuccessSummary(result.summary);
    }
  });

  it('returns undefined title when title arg is omitted', async () => {
    const result = await engine.execute({html: '<p>hi</p>'});
    if (result.type === 'html') {
      expect(result.title).toBeUndefined();
    }
  });

  it('summary is independent of title presence (preview is what the user sees)', async () => {
    const withTitle = await engine.execute({html: '<p/>', title: 'X'});
    const withoutTitle = await engine.execute({html: '<p/>'});
    expect(withTitle.summary).toBe(withoutTitle.summary);
    expectSuccessSummary(withoutTitle.summary);
  });

  it('returns an error TalentResult for missing html', async () => {
    const result = await engine.execute({});
    expect(result.type).toBe('error');
    if (result.type === 'error') {
      expect(result.errorMessage).toMatch(/html argument is required/);
    }
  });

  it('returns an error TalentResult for empty html string', async () => {
    const result = await engine.execute({html: ''});
    expect(result.type).toBe('error');
  });

  it('returns an error TalentResult for non-string html', async () => {
    const result = await engine.execute({html: 123 as any});
    expect(result.type).toBe('error');
  });

  it('ignores non-string title values (treats as undefined)', async () => {
    const result = await engine.execute({html: '<p/>', title: 42 as any});
    if (result.type === 'html') {
      expect(result.title).toBeUndefined();
    }
  });

  it('does not sanitize or mutate the html payload (pass-through)', async () => {
    const raw = '<script>alert(1)</script><style>body{}</style><p>ok</p>';
    const result = await engine.execute({html: raw, title: 'X'});
    if (result.type === 'html') {
      expect(result.html).toBe(raw);
    } else {
      throw new Error('expected html result');
    }
  });

  describe('toToolDefinition', () => {
    it('returns a valid ToolDefinition with correct name', () => {
      const def = engine.toToolDefinition();
      expect(def.type).toBe('function');
      expect(def.function.name).toBe('render_html');
      expect(typeof def.function.description).toBe('string');
      expect(def.function.parameters).toBeDefined();
      expect(def.function.parameters.required).toContain('html');
      // title 必填（成品即藏品：无名成品玩具箱拒收，K90 实证）
      expect(def.function.parameters.required).toContain('title');
    });

    it('description mandates tool use for toy/game requests (3B 真机实证：弱描述模型只吐代码不调工具)', () => {
      const def = engine.toToolDefinition();
      expect(def.function.description).toMatch(/MUST/i);
      expect(def.function.description).toMatch(/toy|game/i);
    });
  });

  describe('systemPromptFragment', () => {
    it('opens with the invocation trigger: toy request MUST call render_html, not paste code', () => {
      const frag = engine.systemPromptFragment();
      expect(frag).toBeTruthy();
      expect(frag).toMatch(/MUST immediately call render_html/);
      expect(frag).toMatch(/Never paste code in chat/);
    });

    it('keeps the toy craftsman constraints (single file, Chinese UI, title)', () => {
      const frag = engine.systemPromptFragment() ?? '';
      expect(frag).toContain('TOY CRAFTSMAN');
      expect(frag).toContain('Single-file HTML only');
      expect(frag).toContain('Simplified Chinese');
    });
  });
});
