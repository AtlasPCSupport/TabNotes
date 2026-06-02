import { describe, it, expect } from 'vitest';
import { stripFormatting, autoTitleFromContent } from './text';

describe('stripFormatting', () => {
  it('removes HTML tags', () => {
    expect(stripFormatting('<b>bold</b> text')).toBe('bold text');
  });
  it('removes markdown markers', () => {
    expect(stripFormatting('**bold** _x_ ~~s~~ `c`')).toBe('bold _x_ s c');
  });
  it('removes HTML entities', () => {
    expect(stripFormatting('a&nbsp;b')).toBe('a b');
  });
  it('trims whitespace', () => {
    expect(stripFormatting('   hi   ')).toBe('hi');
  });
});

describe('autoTitleFromContent', () => {
  it('takes the first line', () => {
    expect(autoTitleFromContent('First line\nSecond line')).toBe('First line');
  });
  it('strips heading markers', () => {
    expect(autoTitleFromContent('### Heading')).toBe('Heading');
  });
  it('strips checkbox prefixes', () => {
    expect(autoTitleFromContent('- [ ] Task one')).toBe('Task one');
    expect(autoTitleFromContent('- [x] Done task')).toBe('Done task');
  });
  it('strips inline formatting', () => {
    expect(autoTitleFromContent('**Bold title**')).toBe('Bold title');
  });
  it('caps at 60 characters', () => {
    const long = 'a'.repeat(100);
    expect(autoTitleFromContent(long)).toHaveLength(60);
  });
  it('returns empty for empty content', () => {
    expect(autoTitleFromContent('')).toBe('');
  });
});
