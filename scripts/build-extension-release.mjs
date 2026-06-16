import fs from 'node:fs/promises';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const root = process.cwd();
const manifestPath = path.join(root, 'apps/extension/public/manifest.json');
const distDir = path.join(root, 'apps/extension/dist');
const storeDir = path.join(root, 'store');

const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8'));
const version = process.argv[2] ?? manifest.version;
manifest.version = version;
await fs.writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

function run(command, args, options = {}) {
  execFileSync(command, args, { stdio: 'inherit', ...options });
}

function quotePowerShell(value) {
  return `'${value.replace(/'/g, "''")}'`;
}

if (process.platform === 'win32') {
  run('powershell.exe', [
    '-NoProfile',
    '-ExecutionPolicy',
    'Bypass',
    '-Command',
    '$ErrorActionPreference = "Stop"; pnpm build:extension',
  ]);
} else {
  run('pnpm', ['build:extension']);
}

await fs.mkdir(storeDir, { recursive: true });
const zipName = `tabnotes-extension-v${version}.zip`;
const zipPath = path.join(storeDir, zipName);
await fs.rm(zipPath, { force: true });

if (process.platform === 'win32') {
  const sourcePattern = path.join(distDir, '*');
  run('powershell.exe', [
    '-NoProfile',
    '-ExecutionPolicy',
    'Bypass',
    '-Command',
    `$ErrorActionPreference = 'Stop'; Compress-Archive -Path ${quotePowerShell(sourcePattern)} -DestinationPath ${quotePowerShell(zipPath)} -CompressionLevel Optimal -Force`,
  ]);
} else {
  run('zip', ['-qr', zipPath, '.'], { cwd: distDir });
}

console.log(zipPath);
