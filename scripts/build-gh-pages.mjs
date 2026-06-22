import { spawnSync } from 'node:child_process';
import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const siteSource = join(root, 'apps', 'tabnotes-site');
const runtimeConfigSource = join(root, 'apps', 'web', 'public', 'tabnotes.config.json');
const webDist = join(root, 'apps', 'web', 'dist');
const output = join(root, 'dist-gh-pages');

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: root,
    env: {
      ...process.env,
      ...options.env,
    },
    stdio: 'inherit',
  });

  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(' ')} failed with status ${result.status}`);
  }
}

async function getRuntimeConfig() {
  try {
    return JSON.parse(await readFile(runtimeConfigSource, 'utf8'));
  } catch {
    return {};
  }
}

async function getPublicRuntimeConfig() {
  const config = await getRuntimeConfig();
  const googleClientId =
    process.env.VITE_GOOGLE_CLIENT_ID?.trim() ||
    (typeof config.googleClientId === 'string' ? config.googleClientId.trim() : '');
  const extensionId =
    process.env.VITE_TABNOTES_EXTENSION_ID?.trim() ||
    (typeof config.extensionId === 'string' ? config.extensionId.trim() : '');

  return Object.fromEntries(
    Object.entries({
      googleClientId,
      extensionId,
    }).filter(([, value]) => value)
  );
}

const pnpm = process.env.npm_execpath ? process.execPath : 'pnpm';
const pnpmArgs = process.env.npm_execpath
  ? [process.env.npm_execpath, '--filter', '@tabnotes/web', 'build']
  : ['--filter', '@tabnotes/web', 'build'];

run(pnpm, pnpmArgs, {
  env: {
    VITE_BASE_PATH: '/app/',
    VITE_TABNOTES_MOBILE_ENTRY: 'true',
  },
});

await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
await cp(siteSource, output, { recursive: true });
await mkdir(join(output, 'app'), { recursive: true });
await cp(webDist, join(output, 'app'), { recursive: true });
const runtimeConfig = await getPublicRuntimeConfig();
await writeFile(
  join(output, 'app', 'tabnotes.config.json'),
  `${JSON.stringify(runtimeConfig, null, 2)}\n`
);
await writeFile(join(output, '.nojekyll'), '');

console.log(output);
