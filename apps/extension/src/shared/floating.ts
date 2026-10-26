export const FLOATING_DOMAINS_STORAGE_KEY = 'tn_floating_domains';
export const FLOATING_REQUEST_STORAGE_KEY = 'tn_floating_request';

export type FloatingAction =
  | 'new-note'
  | 'screenshot-current'
  | 'screenshot-new'
  | 'crop-current'
  | 'crop-new'
  | 'clip-current'
  | 'clip-new';

export interface FloatingRequest {
  action: FloatingAction;
  requestedAt: number;
  id?: string;
  tabId?: number;
  windowId?: number;
  sourceUrl?: string;
}

export function normalizeFloatingAction(value: unknown): FloatingAction | null {
  if (
    value === 'new-note' ||
    value === 'screenshot-current' ||
    value === 'screenshot-new' ||
    value === 'crop-current' ||
    value === 'crop-new' ||
    value === 'clip-current' ||
    value === 'clip-new'
  ) {
    return value;
  }
  return null;
}

export function normalizeFloatingDomain(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const domain = value.trim().toLowerCase().replace(/\.$/, '');
  if (!domain || domain.includes('/') || domain.includes(':') || domain.includes(' ')) return null;
  return domain;
}

export function floatingDomainFromUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  try {
    const url = new URL(value);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    return normalizeFloatingDomain(url.hostname);
  } catch {
    return null;
  }
}

export function floatingPermissionOrigins(domain: string): string[] {
  return [`https://${domain}/*`, `http://${domain}/*`];
}

export function normalizeFloatingDomains(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [
    ...new Set(
      value.map(normalizeFloatingDomain).filter((domain): domain is string => Boolean(domain))
    ),
  ];
}
