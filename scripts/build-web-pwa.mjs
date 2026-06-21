import { spawnSync } from 'node:child_process';

const env = {
  ...process.env,
  VITE_BASE_PATH: process.env.VITE_BASE_PATH || '/app/',
  VITE_TABNOTES_MOBILE_ENTRY: process.env.VITE_TABNOTES_MOBILE_ENTRY || 'true',
};

const args = ['--filter', '@tabnotes/web', 'build'];
const command = process.env.npm_execpath ? process.execPath : 'pnpm';
const commandArgs = process.env.npm_execpath ? [process.env.npm_execpath, ...args] : args;
const result = spawnSync(command, commandArgs, {
  env,
  stdio: 'inherit',
});

if (result.error) {
  console.error(result.error);
  process.exit(1);
}
if (result.status !== 0) process.exit(result.status ?? 1);
