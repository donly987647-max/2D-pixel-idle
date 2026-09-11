import { readFile, writeFile, mkdir } from 'node:fs/promises';

// The source remains a dependency-free HTML game. This build applies the
// responsive delivery fixes and emits a self-contained static distribution.
const sourceUrl = 'https://raw.githubusercontent.com/donly987647-max/2D-pixel-idle/cf4129925f8f34ac1cd72f5116623cd635c30b87/index.html';
let html;
try {
  html = await readFile(new URL('./index.html', import.meta.url), 'utf8');
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
  // Also supports a small, reproducible Vercel deployment manifest.
  const response = await fetch(sourceUrl, { signal: AbortSignal.timeout(30000) });
  if (!response.ok) throw new Error(`Source download failed: ${response.status}`);
  html = await response.text();
}
if (!html.includes('nightkeep.pixel-idle.v1')) throw new Error('Unexpected game source');
const replacements = [
  [
    '.viewport canvas{display:block;width:100%;height:100%;image-rendering:pixelated;',
    '.viewport canvas{display:block;width:100%;height:100%;object-fit:cover;image-rendering:pixelated;'
  ],
  [
    "$('toasts').appendChild(el);setTimeout(()=>el.remove(),3300)",
    "$('toasts').appendChild(el);while($('toasts').children.length>3)$('toasts').firstElementChild.remove();setTimeout(()=>el.remove(),3300)"
  ],
  [
    'let x=(e.clientX-r.left)/r.width*960,y=(e.clientY-r.top)/r.height*440;',
    'const fit=Math.max(r.width/960,r.height/440);let x=(e.clientX-r.left+(960*fit-r.width)/2)/fit,y=(e.clientY-r.top+(440*fit-r.height)/2)/fit;'
  ]
];
for (const [before, after] of replacements) {
  if (html.includes(after)) continue;
  if (!html.includes(before)) throw new Error('Responsive patch no longer matches source');
  html = html.replace(before, after);
}
html = html.replaceAll('0.1.0', '0.1.1');
await mkdir('public', { recursive: true });
await writeFile('public/index.html', html);
console.log('Built Nightkeep 0.1.1: public/index.html (self-contained, no runtime network dependencies)');
