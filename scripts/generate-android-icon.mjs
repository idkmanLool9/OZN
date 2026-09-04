// Bakt icon.svg naar assets/icon.png (1024×1024) zodat @capacitor/assets
// er Android-icoontjes van kan genereren voor alle resoluties.
// Alleen bedoeld voor CI (GitHub Actions), niet lokaal.
import fs from 'node:fs';
import sharp from 'sharp';

const svg = fs.readFileSync('icon.svg');
await sharp(svg, { density: 384 })
  .resize(1024, 1024, { fit: 'contain', background: { r: 246, g: 242, b: 231, alpha: 1 } })
  .png()
  .toFile('assets/icon.png');

// Foreground-only (voor adaptive-icon voorgrond). Zelfde beeld, transparante rand.
await sharp(svg, { density: 384 })
  .resize(1024, 1024, { fit: 'contain', background: { r: 246, g: 242, b: 231, alpha: 1 } })
  .png()
  .toFile('assets/icon-foreground.png');

console.log('Icon PNGs generated in assets/');
