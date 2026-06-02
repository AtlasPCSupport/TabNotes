import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    // A concrete origin is required for localStorage to be available in jsdom.
    environmentOptions: {
      jsdom: {
        url: 'https://tabnotes.test/',
      },
    },
    include: ['src/**/*.test.ts'],
    globals: true,
  },
});
