import { describe, it, expect } from 'vitest';
import { renderMarkdown, readingTime } from './markdown';

describe('renderMarkdown', () => {
  it('renders headings', () => {
    expect(renderMarkdown('# Title')).toContain('<h1>Title</h1>');
    expect(renderMarkdown('## Sub')).toContain('<h2>Sub</h2>');
  });

  it('renders bold and italic', () => {
    expect(renderMarkdown('**bold**')).toContain('<strong>bold</strong>');
    expect(renderMarkdown('*italic*')).toContain('<em>italic</em>');
  });

  it('renders task checkboxes', () => {
    const done = renderMarkdown('- [x] done');
    expect(done).toContain('type="checkbox"');
    expect(done).toContain('checked');
    const todo = renderMarkdown('- [ ] todo');
    expect(todo).toContain('type="checkbox"');
  });

  it('renders wiki links with data-wiki', () => {
    const out = renderMarkdown('[[My Note]]');
    expect(out).toContain('data-wiki="My Note"');
  });

  it('renders external links safely', () => {
    const out = renderMarkdown('[site](https://example.com)');
    expect(out).toContain('href="https://example.com"');
    expect(out).toContain('noopener');
  });

  it('sanitizes embedded script in markdown source', () => {
    const out = renderMarkdown('hello <script>alert(1)</script>');
    // The script tag is escaped to harmless display text, never an executable element.
    expect(out.toLowerCase()).not.toContain('<script');
    expect(out).toContain('&lt;script&gt;');
  });

  it('escapes raw angle brackets that are not allowed tags', () => {
    const out = renderMarkdown('a < b and c > d');
    expect(out).toContain('&lt;');
    expect(out).toContain('&gt;');
  });

  it('returns empty string for empty input', () => {
    expect(renderMarkdown('')).toBe('');
  });
});

describe('readingTime', () => {
  it('returns empty for short text', () => {
    expect(readingTime('a few words')).toBe('');
  });

  it('estimates minutes for long text', () => {
    const words = Array.from({ length: 250 }, (_, i) => `word${i}`).join(' ');
    expect(readingTime(words)).toMatch(/min/);
  });
});
