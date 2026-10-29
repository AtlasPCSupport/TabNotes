export const UPDATE_NOTICE_KEY = 'tn_update_notice_version';

/** Reloading an unpacked build is also an update, but not a new release. */
export async function recordUpdateNotice(
  details: Pick<chrome.runtime.InstalledDetails, 'reason' | 'previousVersion'>
): Promise<void> {
  const version = chrome.runtime.getManifest().version;
  if (details.reason === 'update' && details.previousVersion !== version) {
    await chrome.storage.local.set({ [UPDATE_NOTICE_KEY]: version });
  }
}
