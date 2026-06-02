/**
 * Wiki-link helpers — `[[Note name]]` style links.
 *
 * Pure functions extracted from the side panel so the trigger detection and
 * candidate matching can be unit-tested independent of the DOM/editor.
 */

/** Match the in-progress wiki-link trigger at the end of the text before the caret. */
const TRIGGER_RE = /\[\[([^\]]*?)$/;

/** Match all completed wiki links in a body of text. */
const LINK_RE = /\[\[(.+?)\]\]/g;

export interface WikiTrigger {
  /** The partial query typed after `[[`. */
  query: string;
  /** Length of the matched trigger including the `[[`. */
  matchLength: number;
}

/**
 * Detect an open wiki-link trigger in the text immediately before the caret.
 * Returns null when there is no open `[[` to complete.
 */
export function detectWikiTrigger(textBeforeCaret: string): WikiTrigger | null {
  const m = textBeforeCaret.match(TRIGGER_RE);
  if (!m) return null;
  return { query: m[1], matchLength: m[0].length };
}

/** Extract the set of linked note names (lower-cased) from a note body. */
export function extractWikiLinks(content: string): Set<string> {
  const links = new Set<string>();
  for (const m of content.matchAll(LINK_RE)) {
    links.add(m[1].toLowerCase());
  }
  return links;
}

/** Case-insensitive containment match used to filter wiki-link autocomplete candidates. */
export function matchesWikiQuery(candidate: string, query: string): boolean {
  return candidate.toLowerCase().includes(query.toLowerCase());
}
