// ── Helpers (inline, no imports needed in service worker) ────────────────────

function normalizeDomain(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return url; }
}

function normalizeUrl(url: string): string {
  try {
    const TRACKING = new Set([
      'utm_source','utm_medium','utm_campaign','utm_term','utm_content',
      'ref','fbclid','gclid','msclkid','twclid','mc_cid','mc_eid','_ga','_gl','igshid',
    ]);
    const u = new URL(url);
    u.hash = '';
    for (const p of TRACKING) u.searchParams.delete(p);
    const search = u.searchParams.toString();
    let out = `${u.origin}${u.pathname}`.replace(/\/$/, '');
    if (search) out += `?${search}`;
    return out;
  } catch { return url; }
}

// Returns all scope keys that could match a given tab URL
function scopeKeysForUrl(url: string, workspaceId: string | null): string[] {
  return [
    normalizeUrl(url),    // url scope
    normalizeDomain(url), // domain scope
    workspaceId ?? 'default', // workspace scope
    '',                   // global scope
  ];
}

// ── Badge updater ─────────────────────────────────────────────────────────────

async function updateBadge(tabId: number, url: string): Promise<void> {
  if (!url || url.startsWith('chrome://') || url.startsWith('chrome-extension://') ||
      url.startsWith('about:') || url === 'chrome://newtab/') {
    chrome.action.setBadgeText({ text: '', tabId });
    return;
  }

  try {
    const result = await chrome.storage.local.get('tabnotes_data');
    const data = result['tabnotes_data'] as {
      notes?: Record<string, { scopeKey: string; url?: string }>;
      activeWorkspaceId?: string | null;
    } | undefined;

    if (!data?.notes) {
      chrome.action.setBadgeText({ text: '', tabId });
      return;
    }

    const wsId = data.activeWorkspaceId ?? null;
    const validKeys = new Set(scopeKeysForUrl(url, wsId));
    const count = Object.values(data.notes).filter(n => validKeys.has(n.scopeKey)).length;

    if (count > 0) {
      chrome.action.setBadgeText({ text: count > 99 ? '99+' : String(count), tabId });
      chrome.action.setBadgeBackgroundColor({ color: '#4f6ef7', tabId });
      chrome.action.setBadgeTextColor({ color: '#ffffff', tabId });
    } else {
      chrome.action.setBadgeText({ text: '', tabId });
    }
  } catch {
    chrome.action.setBadgeText({ text: '', tabId });
  }
}

async function updateBadgeForActiveTab(): Promise<void> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab?.id && tab.url) await updateBadge(tab.id, tab.url);
}

// ── Init ──────────────────────────────────────────────────────────────────────

chrome.runtime.onInstalled.addListener(() => {
  chrome.sidePanel.setOptions({ enabled: true });
  updateBadgeForActiveTab();
});

// ── Open side panel on icon click ─────────────────────────────────────────────

chrome.action.onClicked.addListener((tab) => {
  if (tab.id) chrome.sidePanel.open({ tabId: tab.id });
});

// ── Keyboard shortcut ─────────────────────────────────────────────────────────

chrome.commands.onCommand.addListener(async (command) => {
  if (command === 'toggle-side-panel') {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.id) chrome.sidePanel.open({ tabId: tab.id });
  }
});

// ── Badge: update when active tab changes ─────────────────────────────────────

chrome.tabs.onActivated.addListener(async ({ tabId }) => {
  const tab = await chrome.tabs.get(tabId);
  if (tab.url) await updateBadge(tabId, tab.url);
});

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url && tab.active) {
    await updateBadge(tabId, tab.url);
  }
});

// ── Badge: update when notes change in storage ────────────────────────────────

chrome.storage.onChanged.addListener(async (changes, area) => {
  if (area === 'local' && changes['tabnotes_data']) {
    await updateBadgeForActiveTab();
  }
});
