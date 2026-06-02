import { sanitizeHtml, htmlToPlainText } from './sanitize';

/**
 * Render TabNotes-flavoured markdown to sanitized HTML.
 *
 * The editor persists a mix of inline HTML (from the contentEditable surface)
 * and markdown shortcuts. This renderer preserves a small set of inline HTML
 * tags, applies markdown transforms, then runs the result through the
 * sanitizer so the output is always safe to inject into the DOM.
 */
export function renderMarkdown(text: string): string {
  if (!text) return '';

  // Step 1 — extract inline HTML formatting so it survives HTML escaping.
  const htmlChunks: string[] = [];
  const PH = '\x01';
  const safe = text
    .replace(/<(span|u|s|b|i|strong|em|mark|div)\b([^>]*)>([\s\S]*?)<\/\1>/g, (full) => {
      htmlChunks.push(full);
      return `${PH}${htmlChunks.length - 1}${PH}`;
    })
    .replace(/<br\s*\/?>/g, () => {
      htmlChunks.push('<br/>');
      return `${PH}${htmlChunks.length - 1}${PH}`;
    });

  // Step 2 — escape remaining HTML, then apply markdown transforms.
  let result = safe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/~~(.+?)~~/g, '<s>$1</s>')
    .replace(/__(.+?)__/g, '<u>$1</u>')
    .replace(/==(.+?)==/g, '<mark>$1</mark>')
    .replace(/`(.+?)`/g, '<code>$1</code>')
    .replace(
      /^- \[x\] (.+)$/gim,
      '<li class="tn-task tn-done"><input type="checkbox" checked data-task="true" /><span>$1</span></li>'
    )
    .replace(
      /^- \[ \] (.+)$/gim,
      '<li class="tn-task"><input type="checkbox" data-task="true" /><span>$1</span></li>'
    )
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    .replace(/(<li>.*<\/li>)/gs, '<ul>$1</ul>')
    .replace(/\[\[(.+?)\]\]/g, '<span class="tn-wikilink" data-wiki="$1">[[<u>$1</u>]]</span>')
    .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
    .replace(/\n\n/g, '</p><p>')
    .replace(/^(?!<[hul]|<p)(.+)$/gm, '<p>$1</p>')
    .replace(/<p><\/p>/g, '');

  // Step 3 — restore the extracted HTML chunks.
  result = result.replace(
    new RegExp(`${PH}(\\d+)${PH}`, 'g'),
    (_, i) => htmlChunks[parseInt(i)] ?? ''
  );

  // Step 4 — sanitize before returning. This is the single safe HTML sink.
  return sanitizeHtml(result);
}

/** Plain-text helper kept alongside markdown for convenience. */
export { htmlToPlainText };

/** Estimate reading time from note content (markdown or HTML). */
export function readingTime(text: string): string {
  const plain = htmlToPlainText(text);
  const words = plain.split(/\s+/).filter(Boolean).length;
  if (words < 50) return '';
  return `~${Math.ceil(words / 200)} min`;
}
