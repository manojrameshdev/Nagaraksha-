/* eslint-disable @typescript-eslint/no-require-imports */
// Generate NagRaksha PWA icons (192, 512, maskable 512, apple-touch) from SVG.
const sharp = require("sharp");
const fs = require("fs");
const path = require("path");

const OUT = path.join(__dirname, "..", "public", "icons");
fs.mkdirSync(OUT, { recursive: true });

function iconSvg() {
  const size = 512;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#0A1812"/>
      <stop offset="1" stop-color="#102A20"/>
    </linearGradient>
    <linearGradient id="shield" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#2BB673"/>
      <stop offset="1" stop-color="#184D36"/>
    </linearGradient>
    <linearGradient id="snake" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#E0B443"/>
      <stop offset="1" stop-color="#D69E2E"/>
    </linearGradient>
    <radialGradient id="glow" cx="0.5" cy="0.42" r="0.6">
      <stop offset="0" stop-color="#2BB673" stop-opacity="0.45"/>
      <stop offset="1" stop-color="#2BB673" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="${size}" height="${size}" fill="url(#bg)"/>
  <rect x="64" y="64" width="384" height="384" fill="url(#glow)"/>
  <path d="M256 96 L404 152 V264 C404 352 336 408 256 432 C176 408 108 352 108 264 V152 Z"
        fill="url(#shield)" fill-opacity="0.92" stroke="#4FBF9A" stroke-width="3"/>
  <path d="M150 300 C 180 240, 220 360, 256 280 S 332 240, 362 180"
        fill="none" stroke="url(#snake)" stroke-width="22" stroke-linecap="round"/>
  <circle cx="362" cy="180" r="18" fill="#E0B443"/>
  <circle cx="356" cy="174" r="3.4" fill="#0A1812"/>
  <circle cx="150" cy="300" r="6" fill="#D69E2E"/>
  <g stroke="#0A1812" stroke-width="2" opacity="0.35" fill="none">
    <path d="M180 268 q10 -8 20 0"/>
    <path d="M210 300 q10 -8 20 0"/>
    <path d="M240 264 q10 -8 20 0"/>
    <path d="M270 268 q10 -8 20 0"/>
    <path d="M300 232 q10 -8 20 0"/>
  </g>
</svg>`;
}

(async () => {
  const svgBuf = Buffer.from(iconSvg());
  const maskSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
    <defs><linearGradient id="b" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#0A1812"/><stop offset="1" stop-color="#184D36"/></linearGradient></defs>
    <rect width="512" height="512" fill="url(#b)"/>
    <g transform="translate(64,64) scale(0.75)">${iconSvg().replace(/<svg[^>]*>|<\/svg>/g, "")}</g>
  </svg>`;

  await sharp(svgBuf).resize(192, 192).png().toFile(path.join(OUT, "icon-192.png"));
  await sharp(svgBuf).resize(512, 512).png().toFile(path.join(OUT, "icon-512.png"));
  await sharp(Buffer.from(maskSvg)).resize(512, 512).png().toFile(path.join(OUT, "maskable-512.png"));
  await sharp(svgBuf).resize(180, 180).png().toFile(path.join(OUT, "apple-touch-icon.png"));
  await sharp(svgBuf).resize(32, 32).png().toFile(path.join(OUT, "favicon-32.png"));
  fs.copyFileSync(path.join(OUT, "favicon-32.png"), path.join(__dirname, "..", "public", "favicon.ico"));
  console.log("icons generated:", fs.readdirSync(OUT));
})().catch((e) => { console.error(e); process.exit(1); });
