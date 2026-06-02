/**
 * Pure text helpers shared across the extension and web app.
 *
 * Extracted from the side panel monolith so they can be unit-tested and reused.
 * These functions are DOM-free and safe to run in any environment.
 */

/** Strip HTML tags, markdown markers, and HTML entities to plain text. */
export function stripFormatting(s: string): string {
  return s
    .replace(/<[^>]+>/g, '') // strip HTML tags
    .replace(/~~|__|\*\*|\*|`/g, '') // strip markdown markers
    .replace(/&[a-z]+;/gi, ' ') // strip HTML entities
    .trim();
}

/**
 * Derive a note title from its content: take the first line, drop heading
 * markers and list/checkbox prefixes, strip formatting, and cap at 60 chars.
 */
export function autoTitleFromContent(content: string): string {
  const first = stripFormatting(
    content
      .trim()
      .split('\n')[0]
      .replace(/^#+\s*/, '')
      .replace(/^- \[.?\] /, '')
      .trim()
  );
  return first.slice(0, 60);
}
