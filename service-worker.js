// Service worker voor offline-modus
// Cache-strategie:
//  - App-shell (HTML/CSS/JS/icon/manifest): cache-first, fall back naar netwerk
//  - Supabase REST/Storage/Auth: network-only (schrijven en authenticatie)
//  - Externe libraries (jsdelivr Supabase SDK): stale-while-revalidate

const CACHE_VERSION = 'sok-uitvaart-v19';
const SHELL = [
  './',
  './index.html',
  './style.css',
  './print.css',
  './manifest.webmanifest',
  './icon.svg',
  './js/config.js',
  './js/supabase-client.js',
  './js/data.js',
  './js/core.js',
  './js/views-list.js',
  './js/views-form.js',
  './js/views-detail.js',
  './js/views-kisten.js',
  './js/views-bloemen.js',
  './js/views-eten-drinken.js',
  './js/views-factuur.js',
  './js/app.js',
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2',
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_VERSION)
      .then(c => c.addAll(SHELL).catch(err => {
        console.warn('SW: kon shell niet helemaal cachen', err);
      }))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(k => k !== CACHE_VERSION).map(k => caches.delete(k))
    )).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // Supabase publieke storage-objecten (logo + kistfoto's + bloemen +
  // eten/drinken-foto's): stale-while-revalidate zodat ze offline werken
  if ((url.host.endsWith('.supabase.co') || url.host.endsWith('.supabase.in')) &&
      url.pathname.startsWith('/storage/v1/object/public/')) {
    e.respondWith(staleWhileRevalidate(req));
    return;
  }
  // Overige Supabase API (REST, auth, signed URLs, realtime): nooit cachen
  if (url.host.endsWith('.supabase.co') || url.host.endsWith('.supabase.in')) {
    return;
  }

  // jsdelivr CDN (Supabase SDK) + Google Fonts: stale-while-revalidate
  // (zo werkt het lettertype ook offline na de eerste keer laden)
  if (url.host === 'cdn.jsdelivr.net' ||
      url.host === 'fonts.googleapis.com' ||
      url.host === 'fonts.gstatic.com') {
    e.respondWith(staleWhileRevalidate(req));
    return;
  }

  // Eigen assets
  if (url.origin === location.origin) {
    // HTML / navigaties: network-first met cache-fallback
    // (zo komen updates direct binnen zodra je online bent)
    if (req.mode === 'navigate' || url.pathname === '/' || url.pathname.endsWith('/') || url.pathname.endsWith('.html')) {
      e.respondWith(networkFirst(req));
      return;
    }
    // Overige assets (CSS/JS/icon): stale-while-revalidate
    // (snelle render uit cache, vers op de achtergrond ophalen)
    e.respondWith(staleWhileRevalidate(req));
    return;
  }
});

async function networkFirst(req) {
  try {
    const resp = await fetch(req);
    if (resp && resp.ok && resp.type === 'basic') {
      const c = await caches.open(CACHE_VERSION);
      c.put(req, resp.clone());
    }
    return resp;
  } catch (e) {
    const cached = await caches.match(req);
    if (cached) return cached;
    if (req.mode === 'navigate') {
      const fallback = await caches.match('./index.html');
      if (fallback) return fallback;
    }
    throw e;
  }
}

async function staleWhileRevalidate(req) {
  const cached = await caches.match(req);
  const fetchPromise = fetch(req).then(resp => {
    if (resp && resp.ok) {
      caches.open(CACHE_VERSION).then(c => c.put(req, resp.clone()));
    }
    return resp;
  }).catch(() => cached);
  return cached || fetchPromise;
}
