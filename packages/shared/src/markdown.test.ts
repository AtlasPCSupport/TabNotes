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

  it('preserves a captured image in preview output', () => {
    const out = renderMarkdown(
      '<br><img src="data:image/jpeg;base64,SGVsbG8=" alt="Screenshot"><br>'
    );
    expect(out).toContain('<img');
    expect(out).toContain('data:image/jpeg;base64,SGVsbG8=');
    expect(out).not.toContain('&lt;img');
  });

  it('renders stored HTML paragraphs without printing literal tags and still sanitizes them', () => {
    const out = renderMarkdown('<p onclick="alert(1)">Imported <strong>paragraph</strong></p>');
    expect(out).toContain('<p>Imported <strong>paragraph</strong></p>');
    expect(out).not.toContain('&lt;p');
    expect(out).not.toContain('onclick');
  });

  it('renders legacy local screenshot markdown as an image', () => {
    const out = renderMarkdown('![Old screenshot](data:image/jpeg;base64,SGVsbG8=)');
    expect(out).toContain('<img');
    expect(out).toContain('alt="Old screenshot"');
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
