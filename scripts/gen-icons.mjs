import sharp from 'sharp';
import { mkdirSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const iconsDir = resolve(__dirname, '../apps/extension/public/icons');
mkdirSync(iconsDir, { recursive: true });

const sizes = [16, 48, 128, 512];
const brandYellow = '#dcae19';
const brandYellowTop = '#f0c22e';
const brandInk = '#15130a';

for (const size of sizes) {
  const rx = Math.round(size * 0.19);
  const fontSize = Math.round(size * 0.58);
  const y = Math.round(size * 0.715);

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>
    <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${brandYellowTop}"/>
      <stop offset="100%" stop-color="${brandYellow}"/>
    </linearGradient>
  </defs>
  <rect width="${size}" height="${size}" rx="${rx}" fill="url(#g)"/>
  <text x="${size / 2}" y="${y}" font-family="Inter,Arial,sans-serif" font-size="${fontSize}" font-weight="800" fill="${brandInk}" text-anchor="middle">T</text>
</svg>`;

  await sharp(Buffer.from(svg))
    .png()
    .toFile(`${iconsDir}/icon${size}.png`);

  console.log(`✓ icon${size}.png`);

  if (size === 16 || size === 48 || size === 128) {
    writeFileSync(`${iconsDir}/icon${size}.svg`, `${svg}\n`, 'utf8');
    console.log(`✓ icon${size}.svg`);
  }
}

console.log('\nAll icons generated at apps/extension/public/icons/');
