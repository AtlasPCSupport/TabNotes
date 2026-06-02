import { describe, it, expect } from 'vitest';
import {
  generateId,
  normalizeDomain,
  normalizeUrl,
  getScopeKey,
  formatRelativeTime,
  searchNotes,
} from './utils';
import type { Note } from './types';

describe('generateId', () => {
  it('produces unique ids', () => {
    const ids = new Set(Array.from({ length: 500 }, () => generateId()));
    expect(ids.size).toBe(500);
  });
});

describe('normalizeDomain', () => {
  it('strips www and path', () => {
    expect(normalizeDomain('https://www.example.com/page?x=1')).toBe('example.com');
  });
  it('returns input on invalid url', () => {
    expect(normalizeDomain('not a url')).toBe('not a url');
  });
});

describe('normalizeUrl', () => {
  it('removes tracking params and trailing slash and hash', () => {
    const out = normalizeUrl('https://example.com/page/?utm_source=x&keep=1#frag');
    expect(out).toBe('https://example.com/page?keep=1');
  });
  it('drops hash-only fragments', () => {
    expect(normalizeUrl('https://example.com/a#section')).toBe('https://example.com/a');
  });
});

describe('getScopeKey', () => {
  it('maps each scope correctly', () => {
    const url = 'https://www.example.com/p?a=1';
    expect(getScopeKey('url', url)).toBe('https://www.example.com/p?a=1');
    expect(getScopeKey('domain', url)).toBe('example.com');
    expect(getScopeKey('workspace', url, 'ws1')).toBe('ws1');
    expect(getScopeKey('workspace', url, null)).toBe('default');
    expect(getScopeKey('global', url)).toBe('');
  });
});

describe('formatRelativeTime', () => {
  it('returns just now for recent', () => {
    expect(formatRelativeTime(Date.now())).toBe('just now');
  });
  it('formats minutes and hours', () => {
    expect(formatRelativeTime(Date.now() - 5 * 60_000)).toBe('5m ago');
    expect(formatRelativeTime(Date.now() - 3 * 3600_000)).toBe('3h ago');
  });
});

describe('searchNotes', () => {
  const base: Note = {
    id: '1', workspaceId: null, scope: 'global', scopeKey: '',
    content: 'the quick brown fox', title: 'Animals', tags: ['nature'],
    createdAt: 0, updatedAt: 0,
  };
  const notes: Note[] = [
    base,
    { ...base, id: '2', content: 'lazy dog', title: 'Pets', tags: ['cute'] },
  ];

  it('returns all notes for empty query', () => {
    expect(searchNotes(notes, '  ')).toHaveLength(2);
  });
  it('matches content', () => {
    expect(searchNotes(notes, 'fox')).toHaveLength(1);
  });
  it('matches tags', () => {
    expect(searchNotes(notes, 'cute')[0].id).toBe('2');
  });
});
