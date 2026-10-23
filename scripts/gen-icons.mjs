// Rendert public/icon.svg in die PNG-Größen für iOS und das Web-Manifest.
// Aufruf: npm run icons
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { Resvg } from '@resvg/resvg-js';

const svg = readFileSync(new URL('../public/icon.svg', import.meta.url), 'utf8');
const outDir = new URL('../public/icons/', import.meta.url);
mkdirSync(outDir, { recursive: true });

function render(size, file, padding = 0) {
  // maskable: Motiv verkleinert auf dunklem Grund, damit Android es rund beschneiden kann
  const src = padding
    ? `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" fill="#0b0d2e"/><g transform="translate(${padding} ${padding}) scale(${(512 - padding * 2) / 512})">${svg.replace(/<\?xml[^>]*>/, '')}</g></svg>`
    : svg;
  const png = new Resvg(src, { fitTo: { mode: 'width', value: size } }).render().asPng();
  writeFileSync(new URL(file, outDir), png);
  console.log('✓', file, size + 'px');
}

render(180, 'apple-touch-icon.png');
render(192, 'icon-192.png');
render(512, 'icon-512.png');
render(512, 'icon-maskable-512.png', 56);
