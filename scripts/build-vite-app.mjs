import { createRequire } from 'node:module';
import path, { dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const appName = process.argv[2];

if (!appName) {
  throw new Error('Usage: node scripts/build-vite-app.mjs <web|extension>');
}

const appDir = path.join(root, 'apps', appName);
const requireFromApp = createRequire(path.join(appDir, 'package.json'));
const viteModule = await import(pathToFileURL(requireFromApp.resolve('vite')).href);
const vite = viteModule.default ?? viteModule;
const config = (await import(pathToFileURL(path.join(appDir, 'vite.config.mjs')).href)).default;

await vite.build({ ...config, configFile: false });
