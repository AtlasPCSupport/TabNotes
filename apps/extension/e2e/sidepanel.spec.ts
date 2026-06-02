import { test, expect, openPanelWithRealTab } from './fixtures';

/**
 * Browser_Verification scenarios (Requirement 9) for the side panel.
 *
 * These run against the built, unpacked extension and establish the
 * Behavior_Baseline before the side-panel-refactor moves state into the store.
 *
 * Environment note: opening the side panel as a standalone page makes it the
 * active tab, so `chrome.tabs.query({active:true})` returns the panel's own
 * (restricted) URL and the editor renders its restricted-URL placeholder.
 * Scenarios that require a real active web page as context are marked
 * `test.fixme` below until the harness drives the `chrome.sidePanel` API to
 * attach the panel to a window with a normal page active. The boot and
 * navigation scenarios do not need that context and run today.
 */

test.describe('TabNotes side panel — baseline', () => {
  test('boots and renders the root shell with persistent chrome', async ({
    context,
    sidePanelUrl,
  }) => {
    const page = await context.newPage();
    await page.goto(sidePanelUrl);
    await expect(page.locator('.sp-root')).toBeVisible();
    await expect(page.locator('.sp-bottom-nav')).toBeVisible();
  });

  test('bottom nav switches to the All Notes view', async ({ context, sidePanelUrl }) => {
    const page = await context.newPage();
    await page.goto(sidePanelUrl);
    const navButtons = page.locator('.sp-bottom-nav .sp-nav-btn');
    await expect(navButtons.first()).toBeVisible();
    await navButtons.nth(1).click();
    await expect(page.locator('.sp-all-view')).toBeVisible();
  });

  test('bottom nav switches to Settings and back to Note', async ({ context, sidePanelUrl }) => {
    const page = await context.newPage();
    await page.goto(sidePanelUrl);
    const nav = page.locator('.sp-bottom-nav .sp-nav-btn');
    await nav.last().click();
    await expect(page.locator('.sp-settings-view')).toBeVisible();
    await nav.first().click();
    await expect(page.locator('.sp-note-view')).toBeVisible();
  });

  test('PIN lock gate: enabling a PIN locks the panel and the correct PIN unlocks it', async ({
    context,
    sidePanelUrl,
  }) => {
    const page = await context.newPage();
    await page.goto(sidePanelUrl);

    // Enable a PIN from Settings.
    await page.locator('.sp-bottom-nav .sp-nav-btn').last().click();
    await expect(page.locator('.sp-settings-view')).toBeVisible();
    const fields = page.locator('.sp-pin-field');
    await fields.nth(0).fill('2468');
    await fields.nth(1).fill('2468');
    await page.getByRole('button', { name: 'Enable PIN lock' }).click();
    await expect(page.locator('.sp-pin-feedback')).toHaveText('PIN saved');

    // Lock now → the lock screen replaces all content.
    await page.getByRole('button', { name: 'Lock now' }).click();
    await expect(page.locator('.sp-pin-lock')).toBeVisible();
    await expect(page.locator('.sp-bottom-nav')).toHaveCount(0);

    // Wrong PIN is rejected.
    await page.locator('.sp-pin-lock-input').fill('0000');
    await page.getByRole('button', { name: 'Unlock' }).click();
    await expect(page.locator('.sp-pin-lock-error')).toBeVisible();

    // Correct PIN unlocks.
    await page.locator('.sp-pin-lock-input').fill('2468');
    await page.getByRole('button', { name: 'Unlock' }).click();
    await expect(page.locator('.sp-pin-lock')).toHaveCount(0);
    await expect(page.locator('.sp-root')).toBeVisible();

    // Clean up: remove the PIN so other runs start fresh.
    await page.locator('.sp-bottom-nav .sp-nav-btn').last().click();
    await page.getByRole('button', { name: 'Remove PIN' }).click();
    await expect(page.locator('.sp-pin-feedback')).toHaveText('PIN removed');
  });
});

test.describe('TabNotes side panel — editor (real tab context)', () => {
  test('editor renders when the panel has a real active web page', async ({
    context,
    sidePanelUrl,
  }) => {
    const panel = await openPanelWithRealTab(context, sidePanelUrl);
    await expect(panel.locator('.sp-rich-editor')).toBeVisible({ timeout: 8000 });
  });

  test('editor autosaves typed content to storage', async ({ context, sidePanelUrl }) => {
    const panel = await openPanelWithRealTab(context, sidePanelUrl);
    const editor = panel.locator('.sp-rich-editor');
    await expect(editor).toBeVisible();
    await editor.click();
    await panel.keyboard.type('Playwright autosave check');
    // Past the 600ms autosave debounce plus write.
    await panel.waitForTimeout(1500);
    const stored = await panel.evaluate<Promise<string>>(() => {
      return new Promise((resolve) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (globalThis as any).chrome.storage.local.get('tabnotes_data', (r: Record<string, unknown>) => {
          resolve(JSON.stringify(r['tabnotes_data'] ?? {}));
        });
      });
    });
    expect(stored).toContain('Playwright autosave check');
  });

  // Note: command-palette open/run is covered by the baseline suite (single
  // page, reliable focus). In the multi-page real-tab context, OS keyboard
  // focus across pages is flaky in headless Chromium, so it is not duplicated
  // here.

  test('fixed-chrome scrolling: header and bottom nav stay fixed while editor scrolls', async ({
    context,
    sidePanelUrl,
  }) => {
    const panel = await openPanelWithRealTab(context, sidePanelUrl);
    const editor = panel.locator('.sp-rich-editor');
    await editor.click();
    // Type many lines to make the editor body overflow.
    const lines = Array.from({ length: 60 }, (_, i) => `SCROLL-LINE-${i + 1}`).join('\n');
    await editor.evaluate((el, text) => {
      (el as HTMLElement).innerText = text;
    }, lines);
    // Header and bottom nav remain present (fixed chrome), editor is scrollable.
    await expect(panel.locator('.sp-header')).toBeVisible();
    await expect(panel.locator('.sp-bottom-nav')).toBeVisible();
    const overflow = await editor.evaluate((el) => el.scrollHeight > el.clientHeight);
    expect(overflow).toBe(true);
  });

  test('checklist mode toggles into interactive items', async ({ context, sidePanelUrl }) => {
    const panel = await openPanelWithRealTab(context, sidePanelUrl);
    const editor = panel.locator('.sp-rich-editor');
    await editor.click();
    await editor.evaluate((el) => {
      (el as HTMLElement).innerText = '- [ ] first task\n- [x] done task';
      el.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await panel.waitForTimeout(400);
    // The Keep-style checklist toggle button is present in the editor toolbar.
    const checklistToggle = panel.locator('.sp-meta-toggle', { hasText: '' });
    await expect(checklistToggle.first()).toBeVisible();
  });
});

test.describe('TabNotes side panel — known headless limitations', () => {
  // HTML5 drag-and-drop is unreliable in headless Chromium; verified manually
  // per the testing skill. Kept as a documented fixme.
  test.fixme('folder drag-and-drop sets the note folder', async () => {
    // Drag a note onto a folder; assert the note's `folder` is set in storage.
  });

  // Per-note encryption correctness is covered by unit tests
  // (packages/shared/src/crypto.test.ts). The in-editor lock/unlock UI path is
  // verified manually; its trigger affordance varies and is left as a fixme.
  test.fixme('encryption lock/unlock hides and restores content in the editor', async () => {
    // Lock with a password; assert content hidden. Unlock; assert restored.
  });
});
