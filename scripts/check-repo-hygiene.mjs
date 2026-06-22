import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();

function gitLsFiles() {
  const output = execFileSync('git', ['ls-files', '-z'], {
    cwd: root,
    encoding: 'utf8',
  });
  return output
    .split('\0')
    .filter(Boolean)
    .map((file) => file.replace(/\\/g, '/'));
}

const forbiddenTrackedPatterns = [
  /(^|\/)dist\/.+/,
  /(^|\/)dist-gh-pages\/.+/,
  /(^|\/)dist_backup\/.+/,
  /\.(zip|tar\.gz)$/i,
];

const trackedFiles = gitLsFiles();
const forbiddenTrackedFiles = trackedFiles.filter((file) =>
  forbiddenTrackedPatterns.some((pattern) => pattern.test(file))
);

if (forbiddenTrackedFiles.length > 0) {
  console.error('Generated artifacts are tracked in git:');
  for (const file of forbiddenTrackedFiles) console.error(`- ${file}`);
  console.error('\nRemove them from the index and keep release packages in GitHub Releases.');
  process.exit(1);
}

const pwaConfigPath = join(root, 'apps', 'web', 'public', 'tabnotes.config.json');
const pwaConfig = JSON.parse(readFileSync(pwaConfigPath, 'utf8'));
const googleClientId =
  typeof pwaConfig.googleClientId === 'string' ? pwaConfig.googleClientId.trim() : '';
const extensionId = typeof pwaConfig.extensionId === 'string' ? pwaConfig.extensionId.trim() : '';

if (!googleClientId || googleClientId.includes('REPLACE_WITH')) {
  console.error(
    'apps/web/public/tabnotes.config.json must contain the public Google OAuth Web client ID.'
  );
  process.exit(1);
}

if (!/^[a-p]{32}$/.test(extensionId)) {
  console.error(
    'apps/web/public/tabnotes.config.json must contain the public Chrome extension ID.'
  );
  process.exit(1);
}

console.log('Repository hygiene checks passed.');
