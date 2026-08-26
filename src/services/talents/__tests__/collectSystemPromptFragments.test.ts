import {collectSystemPromptFragments, TOOL_RETRY_DISCIPLINE} from '../index';
import type {SystemPromptContext} from '../types';

// activeTalents is derived by the collector from the talent names.
const ctx: Omit<SystemPromptContext, 'activeTalents'> = {
  now: new Date('2026-07-15T12:00:00Z'),
  maxToolTurns: 5,
};

describe('collectSystemPromptFragments', () => {
  it('collects the web_search fragment when web_search is enabled', () => {
    const fragments = collectSystemPromptFragments(['web_search'], ctx);

    expect(fragments).toHaveLength(2);
    expect(fragments[0]).toContain("Today's date is 2026-07-15");
    expect(fragments[0]).toContain('budget of 4 tool calls');
    expect(fragments[0]).toContain('web_search');
  });

  it('references read_url in the web_search fragment only when read_url is active', () => {
    // read_url contributes no fragment of its own, but the web_search fragment
    // names it as a sibling tool — and must not when read_url is disabled.
    const both = collectSystemPromptFragments(['web_search', 'read_url'], ctx);
    const searchOnly = collectSystemPromptFragments(['web_search'], ctx);
    expect(both).toHaveLength(2);
    expect(searchOnly).toHaveLength(2);
    expect(both[0]).toContain('read_url');
    expect(searchOnly[0]).not.toContain('read_url');
  });

  it('appends the global retry discipline last whenever any tool is active', () => {
    const fragments = collectSystemPromptFragments(
      ['calculate', 'read_url'],
      ctx,
    );
    expect(fragments[fragments.length - 1]).toBe(TOOL_RETRY_DISCIPLINE);
    expect(TOOL_RETRY_DISCIPLINE).toContain('failed twice in a row');
  });

  it('returns only the retry discipline for talents that contribute no fragment', () => {
    expect(
      collectSystemPromptFragments(['calculate', 'datetime'], ctx),
    ).toEqual([TOOL_RETRY_DISCIPLINE]);
    expect(collectSystemPromptFragments(['read_url'], ctx)).toEqual([
      TOOL_RETRY_DISCIPLINE,
    ]);
  });

  it('returns nothing when no talents are enabled', () => {
    expect(collectSystemPromptFragments([], ctx)).toEqual([]);
  });

  it('ignores unknown talent names but still applies the retry discipline', () => {
    expect(collectSystemPromptFragments(['not_a_real_talent'], ctx)).toEqual([
      TOOL_RETRY_DISCIPLINE,
    ]);
  });
});
