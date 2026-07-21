import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const manifestPath = path.join(root, 'apps/extension/public/manifest.json');
const expectedHostPermissions = ['https://www.googleapis.com/*'];
const removedAssistantMarkers = [
  /groq/gi,
  /ask your notes/gi,
  /preguntar a tus notas/gi,
  /byok/gi,
  /api\.groq\.com/gi,
  /tn_groq_key/gi,
  /sp-chat-view/gi,
  /chatView/gi,
];
const publicAssistantSurfaceFiles = [
  'README.md',
  'README.es.md',
  'PRIVACY_POLICY.md',
  'store/listing.md',
  'store/privacy-policy.md',
  'apps/tabnotes-site/index.html',
  'apps/tabnotes-site/privacy/index.html',
  'apps/web/src/pages/Privacy.tsx',
];
const tagArgument =
  process.argv.find((argument) => argument.startsWith('--tag='))?.slice('--tag='.length) ??
  (process.argv[2] === '--tag' ? process.argv[3] : undefined);

const publicVersionFiles = [
  'README.md',
  'README.es.md',
  'apps/tabnotes-site/index.html',
  'store/listing.md',
];

function fail(message) {
  console.error(`Release metadata check failed: ${message}`);
  process.exitCode = 1;
}

function findVersionMarkers(content, pattern) {
  return [...content.matchAll(pattern)].map((match) => match[1]);
}

async function read(relativePath) {
  return fs.readFile(path.join(root, relativePath), 'utf8');
}

const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8'));
const version = manifest.version;
if (typeof version !== 'string' || !/^\d+\.\d+\.\d+(?:\.\d+)?$/.test(version)) {
  fail(`${path.relative(root, manifestPath)} has an invalid manifest version.`);
} else {
  if (tagArgument && tagArgument !== `v${version}`) {
    fail(`tag ${tagArgument} must match manifest version v${version}.`);
  }

  const hostPermissions = manifest.host_permissions;
  if (
    !Array.isArray(hostPermissions) ||
    hostPermissions.length !== expectedHostPermissions.length ||
    expectedHostPermissions.some((host) => !hostPermissions.includes(host))
  ) {
    fail(
      `${path.relative(root, manifestPath)} host_permissions must contain only ${expectedHostPermissions.join(', ')}.`
    );
  }

  const markerPatterns = new Map([
    [
      'README.md',
      [
        /Public version\s*\|\s*`(\d+\.\d+\.\d+(?:\.\d+)?)`/g,
        /tabnotes-extension-v(\d+\.\d+\.\d+(?:\.\d+)?)\.zip/g,
        /releases\/tag\/v(\d+\.\d+\.\d+(?:\.\d+)?)/g,
      ],
    ],
    [
      'README.es.md',
      [
        /tabnotes-extension-v(\d+\.\d+\.\d+(?:\.\d+)?)\.zip/g,
        /releases\/tag\/v(\d+\.\d+\.\d+(?:\.\d+)?)/g,
      ],
    ],
    ['apps/tabnotes-site/index.html', [/TabNotes v(\d+\.\d+\.\d+(?:\.\d+)?) - /g]],
    [
      'store/listing.md',
      [
        /Version:\s*`(\d+\.\d+\.\d+(?:\.\d+)?)`/g,
        /tabnotes-extension-v(\d+\.\d+\.\d+(?:\.\d+)?)\.zip/g,
      ],
    ],
  ]);

  for (const relativePath of publicVersionFiles) {
    const content = await read(relativePath);
    const markers = (markerPatterns.get(relativePath) ?? []).flatMap((pattern) =>
      findVersionMarkers(content, pattern)
    );
    if (markers.length === 0) {
      fail(`${relativePath} has no public release version marker to validate.`);
      continue;
    }
    const mismatches = [...new Set(markers.filter((found) => found !== version))];
    if (mismatches.length > 0) {
      fail(
        `${relativePath} contains release version marker(s) that differ from manifest ${version}: ${mismatches.join(', ')}.`
      );
    }
  }

  for (const relativePath of publicAssistantSurfaceFiles) {
    const content = await read(relativePath);
    const matches = removedAssistantMarkers
      .filter((pattern) => pattern.test(content))
      .map((pattern) => pattern.toString());
    if (matches.length > 0) {
      fail(`${relativePath} still references the removed assistant: ${matches.join(', ')}.`);
    }
  }
}

if (!process.exitCode) {
  console.log(`Release metadata is consistent for version ${version}.`);
}
