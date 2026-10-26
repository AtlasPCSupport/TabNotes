import { createRequire } from 'node:module';
import path, { dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

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

if (appName === 'web') {
  const dist = path.join(appDir, 'dist');
  const workerPath = path.join(dist, 'sw.js');
  const worker = await readFile(workerPath, 'utf8');
  const index = await readFile(path.join(dist, 'index.html'), 'utf8');
  const buildId = createHash('sha256').update(worker).update(index).digest('hex').slice(0, 16);
  if (!worker.includes('__BUILD_ID__')) throw new Error('Missing service-worker build marker');
  await writeFile(workerPath, worker.replace('__BUILD_ID__', buildId));
}
