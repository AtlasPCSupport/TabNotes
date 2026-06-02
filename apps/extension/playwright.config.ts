import { defineConfig } from '@playwright/test';

/**
 * Playwright config for TabNotes extension browser verification.
 *
 * Tests load the built unpacked extension from `dist/` into a persistent
 * Chromium context. The `e2e` npm script runs `vite build` first so `dist/` is
 * current. Chrome extensions require a headed/persistent context, so workers
 * are limited to 1 and tests run non-headless.
 */
export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.spec.ts',
  timeout: 30_000,
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['list']] : 'list',
  use: {
    actionTimeout: 10_000,
    trace: 'on-first-retry',
  },
});
