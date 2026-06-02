import { describe, it, expect } from 'vitest';
import { detectWikiTrigger, extractWikiLinks, matchesWikiQuery } from './wikilinks';

describe('detectWikiTrigger', () => {
  it('detects an open trigger before the caret', () => {
    const t = detectWikiTrigger('some text [[Pro');
    expect(t).not.toBeNull();
    expect(t?.query).toBe('Pro');
    expect(t?.matchLength).toBe(5); // "[[Pro"
  });
  it('detects an empty trigger right after [[', () => {
    const t = detectWikiTrigger('hello [[');
    expect(t?.query).toBe('');
    expect(t?.matchLength).toBe(2);
  });
  it('returns null when the link is already closed', () => {
    expect(detectWikiTrigger('done [[Note]] more')).toBeNull();
  });
  it('returns null when there is no trigger', () => {
    expect(detectWikiTrigger('just text')).toBeNull();
  });
});

describe('extractWikiLinks', () => {
  it('extracts all linked names lower-cased', () => {
    const links = extractWikiLinks('See [[Alpha]] and [[Beta Note]].');
    expect(links.has('alpha')).toBe(true);
    expect(links.has('beta note')).toBe(true);
    expect(links.size).toBe(2);
  });
  it('returns empty set when there are no links', () => {
    expect(extractWikiLinks('no links here').size).toBe(0);
  });
});

describe('matchesWikiQuery', () => {
  it('matches case-insensitively by containment', () => {
    expect(matchesWikiQuery('Meeting Notes', 'meet')).toBe(true);
    expect(matchesWikiQuery('Meeting Notes', 'XYZ')).toBe(false);
  });
  it('matches everything for an empty query', () => {
    expect(matchesWikiQuery('anything', '')).toBe(true);
  });
});
