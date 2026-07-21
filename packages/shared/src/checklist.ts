/**
 * Checklist (Google Keep-style) parsing and serialization.
 *
 * Pure string logic extracted from the side panel. The editor converts its
 * contentEditable HTML into newline-separated text first (replacing block tags
 * with newlines and stripping remaining tags), then hands the plain text here.
 * Keeping this DOM-free makes it unit-testable.
 */

/**
 * Convert editor HTML into checklist-safe, newline-separated plain text.
 * Block closing tags and line breaks become newlines before remaining markup
 * is stripped, preserving the visual rows a user entered.
 */
export function editorHtmlToPlainText(content: string): string {
  return content
    .replace(/<\/(?:p|div|li|h[1-6])\s*>/gi, '\n')
    .replace(/<br\s*\/?\s*>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>');
}

export interface ChecklistItem {
  id: string;
  checked: boolean;
  text: string;
}

/** True when the content looks like a markdown checklist (starts with a task line). */
export function isChecklistContent(content: string): boolean {
  const t = content.trim();
  return /^- \[(?: |x|X)\](?:\s|$)/.test(t);
}

/**
 * Parse newline-separated plain text into checklist items. Recognizes
 * `- [x] `, `- [X] `, `- [ ] `, and plain `- ` bullet prefixes. Blank lines are
 * dropped. `idFactory` lets callers supply deterministic ids in tests.
 */
export function parseChecklistItems(
  text: string,
  idFactory: (index: number) => string = defaultId
): ChecklistItem[] {
  const lines = text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

  return lines.map((line, idx) => {
    let checked = false;
    let body = line;
    if (line.startsWith('- [x] ') || line.startsWith('- [X] ')) {
      checked = true;
      body = line.substring(6);
    } else if (line.startsWith('- [ ] ')) {
      checked = false;
      body = line.substring(6);
    } else if (line.startsWith('- ')) {
      checked = false;
      body = line.substring(2);
    }
    return { id: idFactory(idx), checked, text: body };
  });
}

/** Serialize checklist items back to markdown task lines. */
export function serializeChecklist(items: ChecklistItem[]): string {
  return items.map((it) => `${it.checked ? '- [x]' : '- [ ]'} ${it.text}`).join('\n');
}

/** Convert checklist items to editable plain text when checklist mode is disabled. */
export function checklistItemsToPlainText(items: ChecklistItem[]): string {
  return items.map((item) => item.text).join('\n');
}


function defaultId(index: number): string {
  return `item-${index}-${Math.random().toString(36).slice(2, 9)}`;
}
