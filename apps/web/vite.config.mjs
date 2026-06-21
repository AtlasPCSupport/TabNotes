import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const basePath = process.env.VITE_BASE_PATH ?? '/';
const normalizedBasePath = basePath.endsWith('/') ? basePath : `${basePath}/`;

export default defineConfig({
  base: normalizedBasePath,
  plugins: [react()],
  root: __dirname,
  server: {
    host: '0.0.0.0',
    port: 5000,
    allowedHosts: true,
    strictPort: true,
  },
  resolve: {
    alias: {
      '@tabnotes/shared': resolve(__dirname, '../../packages/shared/src/index.ts'),
      '@tabnotes/ui': resolve(__dirname, '../../packages/ui/src/index.ts'),
      '@tabnotes/i18n': resolve(__dirname, '../../packages/i18n/src/index.ts'),
    },
  },
});
