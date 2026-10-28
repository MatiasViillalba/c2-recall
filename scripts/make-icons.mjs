// Genera los íconos de la PWA (192, 512, maskable, apple-touch, favicon) a partir de un SVG.
import sharp from 'sharp';
import { writeFileSync } from 'node:fs';

const art = (scale = 1, offset = 0) => `
  <g transform="translate(${offset} ${offset}) scale(${scale})">
    <rect x="150" y="118" width="250" height="300" rx="34" fill="#B4AEF2" transform="rotate(-9 275 268)" opacity="0.95"/>
    <rect x="128" y="104" width="256" height="304" rx="34" fill="#F7F5F0"/>
    <path d="M168 330 C 210 330 226 262 262 250 S 318 196 344 168" fill="none" stroke="#6F9478" stroke-width="20" stroke-linecap="round"/>
    <circle cx="344" cy="168" r="20" fill="#E39A52"/>
    <rect x="168" y="362" width="120" height="16" rx="8" fill="#1F2B4D" opacity="0.18"/>
  </g>`;
const bg = (rounded) => `
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#2E3F73"/><stop offset="1" stop-color="#172038"/></linearGradient></defs>
  <rect width="512" height="512" ${rounded ? 'rx="116"' : ''} fill="url(#g)"/>`;
const svg = (rounded, scale = 1, offset = 0) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">${bg(rounded)}${art(scale, offset)}</svg>`;

writeFileSync('public/favicon.svg', svg(true));
const out = [
  ['public/icons/icon-192.png', 192, svg(true)],
  ['public/icons/icon-512.png', 512, svg(true)],
  ['public/icons/icon-maskable-512.png', 512, svg(false, 0.78, 56)],
  ['public/apple-touch-icon.png', 180, svg(false, 0.86, 36)],
];
for (const [file, size, s] of out) {
  await sharp(Buffer.from(s)).resize(size, size).png().toFile(file);
  console.log('icon', file);
}
