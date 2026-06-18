import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  root: __dirname,
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        popup: resolve(__dirname, 'popup/index.html'),
        options: resolve(__dirname, 'options/index.html'),
        sidepanel: resolve(__dirname, 'sidepanel/index.html'),
        offscreen: resolve(__dirname, 'offscreen/index.html'),
        background: resolve(__dirname, 'src/background/index.ts'),
      },
      output: {
        entryFileNames: (chunk) => {
          if (chunk.name === 'background') return 'background/index.js';
          return '[name]/index.js';
        },
        chunkFileNames: 'chunks/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]',
      },
    },
  },
  resolve: {
    alias: {
      '@tabnotes/shared': resolve(__dirname, '../../packages/shared/src/index.ts'),
      '@tabnotes/ui': resolve(__dirname, '../../packages/ui/src/index.ts'),
      '@tabnotes/i18n': resolve(__dirname, '../../packages/i18n/src/index.ts'),
    },
  },
});
