import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('.', import.meta.url)));

export default defineConfig({
  resolve: {
    alias: {
      '@tabnotes/shared': resolve(root, '../../packages/shared/src/index.ts'),
      '@tabnotes/ui': resolve(root, '../../packages/ui/src/index.ts'),
      '@tabnotes/i18n': resolve(root, '../../packages/i18n/src/index.ts'),
    },
  },
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
  },
});
