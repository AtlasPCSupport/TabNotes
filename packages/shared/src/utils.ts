export function generateId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}

// Tracking params to strip
const TRACKING_PARAMS = new Set([
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_term',
  'utm_content',
  'ref',
  'fbclid',
  'gclid',
  'msclkid',
  'twclid',
  'mc_cid',
  'mc_eid',
  '_ga',
  '_gl',
  'igshid',
]);

// Sensitive params that may contain PII, auth tokens, or session data
const SENSITIVE_PARAMS = new Set([
  'token',
  'access_token',
  'auth_token',
  'auth',
  'code',
  'session',
  'sessionid',
  'sid',
  'key',
  'api_key',
  'apikey',
  'secret',
  'password',
  'passwd',
  'pwd',
  'otp',
  'nonce',
  'state',
  'redirect_uri',
  'return_url',
  'callback',
]);

export function normalizeDomain(url: string): string {
  try {
    const u = new URL(url);
    return u.hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

export function normalizeUrl(url: string): string {
  try {
    const u = new URL(url);
    u.hash = '';
    for (const p of TRACKING_PARAMS) u.searchParams.delete(p);
    for (const p of SENSITIVE_PARAMS) u.searchParams.delete(p);
    const search = u.searchParams.toString();
    let normalized = `${u.origin}${u.pathname}`.replace(/\/$/, '');
    if (search) normalized += `?${search}`;
    return normalized;
  } catch {
    return url;
  }
}

export function getScopeKey(
  scope: import('./types').NoteScope,
  url: string,
  workspaceId?: string | null
): string {
  switch (scope) {
    case 'url':
      return normalizeUrl(url);
    case 'domain':
      return normalizeDomain(url);
    case 'workspace':
      return workspaceId ?? 'default';
    case 'global':
      return '';
  }
}

export function formatRelativeTime(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const s = Math.floor(diff / 1000);
  if (s < 60) return 'just now';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  const mo = Math.floor(d / 30);
  return `${mo}mo ago`;
}

export function searchNotes(
  notes: import('./types').Note[],
  query: string
): import('./types').Note[] {
  if (!query.trim()) return notes;
  const q = query.toLowerCase();
  return notes.filter(
    (n) =>
      n.content.toLowerCase().includes(q) ||
      (n.title ?? '').toLowerCase().includes(q) ||
      n.tags.some((t) => t.toLowerCase().includes(q)) ||
      n.scopeKey.toLowerCase().includes(q)
  );
}

export type NoteContentFilter = 'all' | 'text' | 'images' | 'tasks';

const NOTE_IMAGE_RE = /<img\b[^>]*>|!\[[^\]]*\]\([^)]*\)/i;
const NOTE_TASK_RE = /(?:^|\n)\s*- \[(?: |x|X)\](?:\s|$)/;

function noteTextWithoutImages(content: string): string {
  return content
    .replace(/<img\b[^>]*>/gi, '')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/[ \t]+/g, ' ')
    .trim();
}

export function noteHasImages(note: Pick<import('./types').Note, 'content'>): boolean {
  return NOTE_IMAGE_RE.test(note.content);
}

export function noteHasTasks(note: Pick<import('./types').Note, 'content'>): boolean {
  return NOTE_TASK_RE.test(noteTextWithoutImages(note.content));
}

export function noteHasText(note: Pick<import('./types').Note, 'content'>): boolean {
  return Boolean(noteTextWithoutImages(note.content)) && !noteHasTasks(note);
}

export function matchesNoteContentFilter(
  note: Pick<import('./types').Note, 'content'>,
  filter: NoteContentFilter
): boolean {
  if (filter === 'all') return true;
  if (filter === 'images') return noteHasImages(note);
  if (filter === 'tasks') return noteHasTasks(note);
  return noteHasText(note);
}
