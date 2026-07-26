// Service worker voor offline-modus (kick 2026-07-09)
// Cache-strategie:
//  - App-shell (HTML/CSS/JS/icon/manifest): cache-first, fall back naar netwerk
//  - Supabase REST/Storage/Auth: network-only (schrijven en authenticatie)
//  - Externe libraries (jsdelivr Supabase SDK): stale-while-revalidate

// Cache-naam bevat het buildnummer (groeit elke release). Bij wijziging
// wordt de oude cache automatisch opgeruimd in het 'activate'-event.
const CACHE_VERSION = 'sok-uitvaart-build-290';
const SHELL = [
  './',
  './index.html',
  './privacy.html',
  './support.html',
  './style.css',
  './print.css',
  './manifest.webmanifest',
  './icon.svg',
  './js/config.js',
  './js/supabase-client.js',
  './js/snelstart.js',
  './js/data.js',
  './js/demo.js',
  './js/core.js',
  './js/views-list.js',
  './js/views-planning.js',
  './js/views-form.js',
  './js/views-detail.js',
  './js/views-kisten.js',
  './js/views-factuur.js',
  './js/app.js',
  './js/native.js',
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2',
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_VERSION)
      .then(async c => {
        // Forceer 'reload' zodat we de HTTP-cache van de browser overslaan.
        // Anders cacht de nieuwe SW stilletjes de oude bestanden en blijft
        // de gebruiker een versie achterlopen.
        await Promise.all(SHELL.map(async url => {
          try {
            const resp = await fetch(url, { cache: 'reload' });
            if (resp && resp.ok) await c.put(url, resp);
          } catch (err) {
            console.warn('SW shell fetch faalde:', url, err);
          }
        }));
      })
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

// Vanuit de app SKIP_WAITING-bericht ontvangen om meteen te activeren
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // Supabase storage-objecten (publiek + signed URL's): stale-while-revalidate
  // zodat kist-foto's, artsverklaringen, overdraagformulieren, foto-overledene,
  // logo enz. ook offline zichtbaar blijven na eerste keer laden.
  if ((url.host.endsWith('.supabase.co') || url.host.endsWith('.supabase.in')) &&
      (url.pathname.startsWith('/storage/v1/object/public/') ||
       url.pathname.startsWith('/storage/v1/object/sign/') ||
       url.pathname.startsWith('/storage/v1/object/authenticated/'))) {
    e.respondWith(staleWhileRevalidate(req));
    return;
  }
  // Supabase REST GET-calls (dossiers, kosten, notities, kist_voorraad, ...):
  // network-first met cache-fallback zodat je bij netwerkverlies nog de
  // laatst-gelezen versie te zien krijgt. Alle schrijf-acties (POST/PATCH/DELETE)
  // + auth/realtime blijven ongemoeid — die filter method !== 'GET' er al uit.
  if ((url.host.endsWith('.supabase.co') || url.host.endsWith('.supabase.in')) &&
      url.pathname.startsWith('/rest/v1/')) {
    e.respondWith(networkFirst(req));
    return;
  }
  // Overige Supabase API (auth, realtime, functions): nooit cachen.
  if (url.host.endsWith('.supabase.co') || url.host.endsWith('.supabase.in')) {
    return;
  }

  // jsdelivr CDN (Supabase SDK + EmailJS + html2pdf) + Google Fonts:
  // stale-while-revalidate zodat ze offline werken na 1e laad
  if (url.host === 'cdn.jsdelivr.net' ||
      url.host === 'fonts.googleapis.com' ||
      url.host === 'fonts.gstatic.com') {
    e.respondWith(staleWhileRevalidate(req));
    return;
  }

  // Losse statische pagina's (support/privacy): altijd de echte pagina serveren,
  // nooit de app-shell als fallback. Werkt voor /support én /support.html.
  if (url.origin === location.origin) {
    const staticMatch = url.pathname.match(/^\/(support|privacy)(?:\.html)?$/);
    if (staticMatch) {
      const file = './' + staticMatch[1] + '.html';
      e.respondWith(
        fetch(new Request(req, { cache: 'no-cache' }))
          .then(resp => {
            if (resp && resp.ok && resp.type === 'basic') {
              caches.open(CACHE_VERSION).then(c => c.put(file, resp.clone()));
            }
            return resp;
          })
          .catch(() => caches.match(file))
      );
      return;
    }
  }

  // Eigen assets
  if (url.origin === location.origin) {
    // HTML / navigaties: network-first met cache-fallback
    // (zo komen updates direct binnen zodra je online bent)
    if (req.mode === 'navigate' || url.pathname === '/' || url.pathname.endsWith('/') || url.pathname.endsWith('.html')) {
      e.respondWith(networkFirst(req));
      return;
    }
    // Eigen JS/CSS/icons: ook network-first met cache-fallback. Zo krijgen
    // gebruikers na een hard-reload meteen de nieuwste versies, ipv eerst
    // de oude uit cache (stale-while-revalidate gaf 1-build-achter gedrag
    // bij sneltoets-updates).
    e.respondWith(networkFirst(req));
    return;
  }
});

async function networkFirst(req) {
  try {
    const freshReq = new Request(req, { cache: 'no-cache' });
    const resp = await fetch(freshReq);
    // Alleen volledige 200-responses cachen. 206 Partial Content (Range)
    // en cache-buster URLs (?_check=/_v=) zouden anders elk een unieke
    // cache-entry maken die nooit meer gematched wordt — oneindige groei.
    const url = new URL(req.url);
    const isCacheBuster = url.searchParams.has('_check') || url.searchParams.has('_v') || url.searchParams.has('_reset');
    if (resp && resp.status === 200 && resp.type === 'basic' && !isCacheBuster) {
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

// ─── Push-notificaties ──────────────────────────────────────────────────────
self.addEventListener('push', event => {
  let payload = { title: 'OZN', body: 'Je hebt een nieuwe melding.', url: '/' };
  if (event.data) {
    try { payload = Object.assign(payload, event.data.json()); }
    catch (_) { payload.body = event.data.text(); }
  }
  // Guard: sommige senders zetten expliciet title:null of body:null in de
  // JSON — Object.assign overschrijft dan onze defaults. showNotification(null)
  // crasht op sommige Android WebViews.
  const title = (payload && typeof payload.title === 'string' && payload.title) || 'OZN';
  const body  = (payload && typeof payload.body  === 'string' && payload.body)  || 'Je hebt een nieuwe melding.';
  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: './icon.png',
      badge: './icon.png',
      data: { url: (payload && payload.url) || '/' },
      tag: (payload && payload.tag) || 'sok-default',
    })
  );
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(wins => {
      for (const w of wins) {
        if (w.url.includes(self.registration.scope) && 'focus' in w) {
          w.focus();
          if ('navigate' in w) w.navigate(url);
          return;
        }
      }
      return self.clients.openWindow(url);
    })
  );
});
