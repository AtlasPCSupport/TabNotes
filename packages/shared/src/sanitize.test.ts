import { describe, it, expect } from 'vitest';
import { sanitizeHtml, htmlToPlainText } from './sanitize';

describe('sanitizeHtml', () => {
  it('strips <script> tags', () => {
    const out = sanitizeHtml('<p>hello</p><script>alert(1)</script>');
    expect(out).toContain('hello');
    expect(out.toLowerCase()).not.toContain('<script');
    expect(out).not.toContain('alert(1)');
  });

  it('removes inline event handlers', () => {
    const out = sanitizeHtml('<p onclick="steal()">click</p>');
    expect(out).toContain('click');
    expect(out.toLowerCase()).not.toContain('onclick');
  });

  it('strips img with onerror payload', () => {
    const out = sanitizeHtml('<img src=x onerror="alert(1)">');
    expect(out.toLowerCase()).not.toContain('onerror');
    expect(out.toLowerCase()).not.toContain('alert');
  });

  it('neutralizes javascript: hrefs', () => {
    const out = sanitizeHtml('<a href="javascript:alert(1)">x</a>');
    expect(out.toLowerCase()).not.toContain('javascript:');
  });

  it('forces safe rel/target on links', () => {
    const out = sanitizeHtml('<a href="https://example.com">x</a>');
    expect(out).toContain('href="https://example.com"');
    expect(out).toContain('target="_blank"');
    expect(out).toContain('noopener');
  });

  it('keeps allowed inline formatting tags', () => {
    const out = sanitizeHtml('<strong>b</strong><em>i</em><mark>h</mark><u>u</u>');
    expect(out).toContain('<strong>b</strong>');
    expect(out).toContain('<em>i</em>');
    expect(out).toContain('<mark>h</mark>');
    expect(out).toContain('<u>u</u>');
  });

  it('preserves task checkbox inputs from markdown rendering', () => {
    const out = sanitizeHtml(
      '<li class="tn-task"><input type="checkbox" data-task="true" /><span>do</span></li>'
    );
    expect(out).toContain('type="checkbox"');
    expect(out).toContain('data-task="true"');
  });

  it('drops disallowed style properties but keeps color', () => {
    const out = sanitizeHtml('<span style="color: red; position: fixed">x</span>');
    expect(out).toContain('color');
    expect(out.toLowerCase()).not.toContain('position');
  });

  it('blocks url() inside style', () => {
    const out = sanitizeHtml('<span style="background: url(javascript:alert(1))">x</span>');
    expect(out.toLowerCase()).not.toContain('url(');
    expect(out.toLowerCase()).not.toContain('javascript:');
  });

  it('removes iframes', () => {
    const out = sanitizeHtml('<iframe src="https://evil.com"></iframe><p>ok</p>');
    expect(out.toLowerCase()).not.toContain('<iframe');
    expect(out).toContain('ok');
  });

  it('returns empty string for empty input', () => {
    expect(sanitizeHtml('')).toBe('');
  });
});

describe('htmlToPlainText', () => {
  it('extracts text content from HTML', () => {
    expect(htmlToPlainText('<p>hello <strong>world</strong></p>')).toBe('hello world');
  });

  it('strips script content entirely', () => {
    const out = htmlToPlainText('<p>safe</p><script>alert(1)</script>');
    expect(out).toBe('safe');
  });
});
