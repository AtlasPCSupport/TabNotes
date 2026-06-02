import { test as base, chromium, type BrowserContext, type Worker } from '@playwright/test';
import { resolve } from 'node:path';
import { existsSync } from 'node:fs';

// Playwright runs from the package root (apps/extension), so dist/ is resolved
// relative to the current working directory. Avoiding import.meta keeps this
// compatible with Playwright's CJS test transform (the package is not ESM).
const DIST = resolve(process.cwd(), 'dist');

/**
 * Playwright fixtures that load the built unpacked TabNotes extension into a
 * persistent Chromium context and expose the extension id + side panel URL.
 *
 * Notes:
 * - Chrome MV3 extensions require a persistent (non-incognito) context launched
 *   headed-ish via the new-headless channel; `--headless=new` supports them.
 * - The side panel page is a normal extension page we can open directly by URL
 *   (`chrome-extension://<id>/sidepanel/index.html`), which is how we drive it.
 * - System pages (chrome://) restrict note editing, so functional flows open the
 *   side panel page directly rather than via a system tab.
 */
export const test = base.extend<{
  context: BrowserContext;
  extensionId: string;
  sidePanelUrl: string;
}>({
  // eslint-disable-next-line no-empty-pattern
  context: async ({}, use) => {
    if (!existsSync(DIST)) {
      throw new Error(
        `Extension build not found at ${DIST}. Run "pnpm --filter @tabnotes/extension build" first (the e2e script does this).`
      );
    }
    const context = await chromium.launchPersistentContext('', {
      channel: 'chromium',
      args: [
        '--headless=new',
        `--disable-extensions-except=${DIST}`,
        `--load-extension=${DIST}`,
      ],
    });
    await use(context);
    await context.close();
  },

  extensionId: async ({ context }, use) => {
    // The MV3 service worker registers under chrome-extension://<id>/...
    let [sw] = context.serviceWorkers();
    if (!sw) {
      sw = await context.waitForEvent('serviceworker');
    }
    const id = new URL((sw as Worker).url()).host;
    await use(id);
  },

  sidePanelUrl: async ({ extensionId }, use) => {
    await use(`chrome-extension://${extensionId}/sidepanel/index.html`);
  },
});

export const expect = test.expect;

/**
 * Give the side panel a real, non-restricted active tab so the editor renders.
 *
 * Opening the panel as a standalone page makes the panel itself the active tab
 * (a restricted chrome-extension:// URL), so the editor shows its restricted
 * placeholder. We open a normal page, then bring it to front: the panel's
 * `chrome.tabs.onActivated` listener fires and switches its context to that
 * page's URL, rendering the editor.
 */
export async function openPanelWithRealTab(
  context: BrowserContext,
  sidePanelUrl: string
): Promise<import('@playwright/test').Page> {
  const web = await context.newPage();
  await web.goto('https://example.com/');
  const panel = await context.newPage();
  await panel.goto(sidePanelUrl);
  // Activate the real page so the panel adopts its URL as the current context.
  await web.bringToFront();
  // Give the panel's onActivated handler time to switch context.
  await panel.waitForTimeout(600);
  return panel;
}
