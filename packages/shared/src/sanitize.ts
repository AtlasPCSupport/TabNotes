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
  'p', 'br', 'div', 'span',
  'b', 'strong', 'i', 'em', 'u', 's', 'strike', 'mark', 'code', 'pre',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'ul', 'ol', 'li',
  'a', 'input', 'blockquote',
];

const ALLOWED_ATTR = [
  'class', 'style',
  'href', 'target', 'rel',
  // task checkboxes rendered from markdown
  'type', 'checked', 'data-task',
  // wiki links
  'data-wiki',
  // text alignment / direction on block elements
  'dir', 'align',
];

/**
 * CSS properties we permit in inline `style` attributes. The editor uses inline
 * styles for colors, highlight, alignment and font sizing via execCommand.
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

  const tags = options.allowLinks === false
    ? ALLOWED_TAGS.filter((t) => t !== 'a')
    : ALLOWED_TAGS;

  return DOMPurify.sanitize(dirty, {
    ALLOWED_TAGS: tags,
    ALLOWED_ATTR,
    // Only http(s), mailto and relative anchors survive on links.
    ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto):|[^a-z]|[a-z+.-]+(?:[^a-z+.:-]|$))/i,
    FORBID_TAGS: ['script', 'style', 'iframe', 'object', 'embed', 'form'],
    FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover', 'srcset', 'src'],
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
