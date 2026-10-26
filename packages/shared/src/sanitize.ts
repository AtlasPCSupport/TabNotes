import DOMPurify from 'dompurify';

/**
 * HTML sanitization for TabNotes note content.
 *
 * Note bodies are authored in a `contentEditable` surface and persisted as raw
 * HTML, then re-injected via `innerHTML` / `dangerouslySetInnerHTML`. Any HTML
 * that reaches those sinks must be sanitized first, otherwise pasted or clipped
 * content can execute script inside the extension's privileged side-panel
 * context (a stored-XSS vector).
 *
 * We use a strict allowlist that covers exactly the formatting the editor
 * produces: inline marks, headings, lists, task checkboxes, wiki links, and
 * safe anchors. Everything else (scripts, event handlers, iframes, styles with
 * url(), javascript: URIs, etc.) is stripped by DOMPurify.
 */

const ALLOWED_TAGS = [
  'p',
  'br',
  'div',
  'span',
  'b',
  'strong',
  'i',
  'em',
  'u',
  's',
  'strike',
  'mark',
  'code',
  'pre',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'ul',
  'ol',
  'li',
  'a',
  'img',
  'input',
  'blockquote',
];

const ALLOWED_ATTR = [
  'class',
  'style',
  'href',
  'target',
  'rel',
  // local screenshots captured by the extension
  'src',
  'alt',
  // task checkboxes rendered from markdown
  'type',
  'checked',
  'data-task',
  // wiki links
  'data-wiki',
  // text alignment / direction on block elements
  'dir',
  'align',
];

/**
 * CSS properties we permit in inline `style` attributes. The editor uses inline
 * styles for colors, highlight, alignment and font sizing.
 * Restricting the property set blocks `style="background:url(javascript:...)"`
 * style attacks while keeping legitimate formatting.
 */
const ALLOWED_STYLE_PROPS = new Set([
  'color',
  'background-color',
  'background',
  'text-align',
  'font-size',
  'font-weight',
  'font-style',
  'text-decoration',
  'text-decoration-line',
]);

const LEGACY_SCREENSHOT_MARKDOWN_RE =
  /!\[([^\]\r\n]{0,240})\]\((data:image\/(?:jpeg|png|webp|gif);base64,[A-Za-z0-9+/]+={0,2})\)/gi;

/** Escape user-controlled text before placing it in a generated HTML document. */
export function escapeHtml(value: string): string {
  const replacements: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  };
  return value.replace(/[&<>"']/g, (character) => replacements[character] ?? character);
}

function escapeHtmlAttribute(value: string): string {
  return escapeHtml(value);
}

let hooksInstalled = false;

function installHooks(instance: typeof DOMPurify): void {
  if (hooksInstalled) return;
  hooksInstalled = true;

  // Force all anchors to open safely and never leak the opener reference.
  instance.addHook('afterSanitizeAttributes', (node) => {
    if (node.nodeName === 'A') {
      const el = node as HTMLElement;
      el.setAttribute('target', '_blank');
      el.setAttribute('rel', 'noopener noreferrer');
    }

    if (node.nodeName === 'IMG') {
      const el = node as HTMLImageElement;
      const src = el.getAttribute('src') ?? '';
      // Notes may persist screenshots, but never arbitrary remote resources.
      if (!/^data:image\/(?:jpeg|png|webp|gif);base64,[A-Za-z0-9+/]+={0,2}$/i.test(src)) {
        el.removeAttribute('src');
      }
    }

    // Restrict inline styles to the allowlisted, value-safe property set.
    const styleAttr = (node as HTMLElement).getAttribute?.('style');
    if (styleAttr) {
      const safe = styleAttr
        .split(';')
        .map((decl) => decl.trim())
        .filter(Boolean)
        .filter((decl) => {
          const prop = decl.split(':')[0]?.trim().toLowerCase();
          const value = decl.slice(decl.indexOf(':') + 1).toLowerCase();
          if (!prop || !ALLOWED_STYLE_PROPS.has(prop)) return false;
          // Block url(), expression(), and any embedded script-ish payloads.
          if (/url\s*\(|expression\s*\(|javascript:/i.test(value)) return false;
          return true;
        })
        .join('; ');
      if (safe) {
        (node as HTMLElement).setAttribute('style', safe);
      } else {
        (node as HTMLElement).removeAttribute('style');
      }
    }
  });
}

export interface SanitizeOptions {
  /** Allow links (`<a href>`). Defaults to true. */
  allowLinks?: boolean;
}

/**
 * Sanitize note-body HTML before it is written to the DOM.
 * Safe to call in both browser and jsdom (test) environments.
 */
export function sanitizeHtml(dirty: string, options: SanitizeOptions = {}): string {
  if (!dirty) return '';
  installHooks(DOMPurify);

  // Migrate screenshots written by older builds as Markdown without allowing
  // arbitrary Markdown images or remote resources into the HTML sink.
  const normalized = dirty.replace(
    LEGACY_SCREENSHOT_MARKDOWN_RE,
    (_, alt: string, src: string) => `<img src="${src}" alt="${escapeHtmlAttribute(alt)}">`
  );

  const tags = options.allowLinks === false ? ALLOWED_TAGS.filter((t) => t !== 'a') : ALLOWED_TAGS;

  return DOMPurify.sanitize(normalized, {
    ALLOWED_TAGS: tags,
    ALLOWED_ATTR,
    // Only http(s), mailto and relative anchors survive on links.
    ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto):|[^a-z]|[a-z+.-]+(?:[^a-z+.:-]|$))/i,
    FORBID_TAGS: ['script', 'style', 'iframe', 'object', 'embed', 'form'],
    FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover', 'srcset'],
    ADD_ATTR: ['target'],
  });
}

/**
 * Strip all HTML and produce plain text. Used for previews, titles, search
 * indexing and reading-time estimates.
 */
export function htmlToPlainText(html: string): string {
  const clean = sanitizeHtml(html);
  if (typeof document !== 'undefined') {
    const tmp = document.createElement('div');
    tmp.innerHTML = clean;
    return (tmp.textContent || tmp.innerText || '').trim();
  }
  // Fallback for non-DOM environments.
  return clean.replace(/<[^>]+>/g, '').trim();
}
