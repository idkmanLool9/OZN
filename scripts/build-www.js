#!/usr/bin/env node
// Bouwt de 'web-bundel' voor Capacitor: kopieert alle statische bestanden
// naar ./www. Capacitor pakt die map en wrapt 'm in de iOS-app.
//
// Wordt aangeroepen door: npm run build  (lokaal en in cloud-build)

'use strict';
const fs = require('fs');
const path = require('path');

const SRC  = process.cwd();
const DEST = path.join(SRC, 'www');

const FILES = [
  'index.html',
  'privacy.html',
  'support.html',
  'style.css',
  'print.css',
  'icon.svg',
  'manifest.webmanifest',
  'service-worker.js',
  '.nojekyll',
  '_headers',  // Cloudflare Pages cache-control + veiligheidsheaders
];
const DIRS = ['js'];

function copyRecursive(src, dst) {
  if (fs.cpSync) {
    fs.cpSync(src, dst, { recursive: true });
    return;
  }
  // Node <16.7 fallback
  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    fs.mkdirSync(dst, { recursive: true });
    for (const e of fs.readdirSync(src)) {
      copyRecursive(path.join(src, e), path.join(dst, e));
    }
  } else {
    fs.copyFileSync(src, dst);
  }
}

if (fs.existsSync(DEST)) fs.rmSync(DEST, { recursive: true, force: true });
fs.mkdirSync(DEST, { recursive: true });

let copied = 0;
for (const f of FILES) {
  const src = path.join(SRC, f);
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, path.join(DEST, f));
    copied++;
  }
}
for (const d of DIRS) {
  const src = path.join(SRC, d);
  if (fs.existsSync(src)) {
    copyRecursive(src, path.join(DEST, d));
    copied++;
  }
}

console.log(`✓ www/ klaar (${copied} bron(nen) gekopieerd)`);
