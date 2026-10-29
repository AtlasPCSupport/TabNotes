import { afterEach, expect, it, vi } from 'vitest';
import { recordUpdateNotice, UPDATE_NOTICE_KEY } from './updateNotice';

afterEach(() => vi.unstubAllGlobals());

it('records only a changed extension version, without reading or rewriting notes', async () => {
  const set = vi.fn(async () => undefined);
  vi.stubGlobal('chrome', {
    runtime: { getManifest: () => ({ version: '2.12.2' }) },
    storage: { local: { set } },
  });
  await recordUpdateNotice({ reason: 'install' as chrome.runtime.OnInstalledReason });
  await recordUpdateNotice({ reason: 'chrome_update' as chrome.runtime.OnInstalledReason });
  await recordUpdateNotice({
    reason: 'update' as chrome.runtime.OnInstalledReason,
    previousVersion: '2.12.2',
  });
  expect(set).not.toHaveBeenCalled();
  await recordUpdateNotice({
    reason: 'update' as chrome.runtime.OnInstalledReason,
    previousVersion: '2.12.0',
  });
  expect(set).toHaveBeenCalledExactlyOnceWith({ [UPDATE_NOTICE_KEY]: '2.12.2' });
});

it('surfaces a storage failure to the background error handler', async () => {
  vi.stubGlobal('chrome', {
    runtime: { getManifest: () => ({ version: '2.12.2' }) },
    storage: { local: { set: vi.fn().mockRejectedValue(new Error('Storage unavailable')) } },
  });
  await expect(
    recordUpdateNotice({
      reason: 'update' as chrome.runtime.OnInstalledReason,
      previousVersion: '2.12.1',
    })
  ).rejects.toThrow('Storage unavailable');
});
