// Generates the PWA icons from one SVG. Run: node scripts/make-icons.mjs
import sharp from 'sharp';
import { mkdir } from 'node:fs/promises';

const svg = (pad) => `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
<rect width="512" height="512" fill="#0b6b3a"/>
<g transform="translate(${pad} ${pad}) scale(${(512 - 2 * pad) / 512})">
<circle cx="190" cy="215" r="70" fill="#fff"/><circle cx="322" cy="215" r="70" fill="#fff" fill-opacity=".85"/>
<path d="M120 335h272l-24 70H144z" fill="#fff"/></g></svg>`;

await mkdir('public/icons', { recursive: true });
await sharp(Buffer.from(svg(0))).resize(192, 192).png().toFile('public/icons/icon-192.png');
await sharp(Buffer.from(svg(0))).resize(512, 512).png().toFile('public/icons/icon-512.png');
// Maskable icons need a safe zone: keep the artwork inside the inner 80%.
await sharp(Buffer.from(svg(64))).resize(512, 512).png().toFile('public/icons/maskable-512.png');
console.log('icons written');
