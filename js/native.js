// Native app-functies — draaien ALLEEN in de Capacitor iOS-app.
// Op de web-versie doet dit bestand niets (alles zit achter Native.isApp()).
//
// Wat het doet:
//   • Lokale herinneringen (werken offline, geen server nodig):
//       - dag vóór een uitvaart, om 18:00
//       - 1 uur vóór een huisbezoek
//   • App-icoon badge = aantal aankomende (niet-afgeronde) uitvaarten
//
// Plugins worden via Capacitor.registerPlugin aangesproken, zodat er geen
// bundler nodig is. De pods komen binnen via `npx cap sync` in de build.

const Native = {
  isApp() {
    try { return !!(window.Capacitor && Capacitor.isNativePlatform && Capacitor.isNativePlatform()); }
    catch (_) { return false; }
  },

  _ln: null, _badge: null, _permAsked: false, _busy: false,

  // Robuuste plugin-accessor. In een app ZONDER bundler is
  // Capacitor.registerPlugin niet altijd aanwezig op window.Capacitor;
  // Capacitor.Plugins.<naam> werkt wél voor elke native-geregistreerde
  // plugin. We proberen eerst Plugins, dan registerPlugin.
  _plugin(name) {
    if (!Native.isApp()) return null;
    try {
      const C = window.Capacitor;
      if (!C) return null;
      if (C.Plugins && C.Plugins[name]) return C.Plugins[name];
      if (typeof C.registerPlugin === 'function') { const p = C.registerPlugin(name); if (p) return p; }
      return null;
    } catch (_) {
      try { return (window.Capacitor.Plugins || {})[name] || null; } catch (_) { return null; }
    }
  },

  _plugins() {
    if (!Native.isApp()) return null;
    if (!Native._ln)    Native._ln    = Native._plugin('LocalNotifications');
    if (!Native._badge) Native._badge = Native._plugin('Badge');
    if (!Native._ln || !Native._badge) return null;
    return { ln: Native._ln, badge: Native._badge };
  },

  async _ensurePerms(p) {
    if (Native._permAsked) return;
    Native._permAsked = true;
    try { await p.ln.requestPermissions(); } catch (_) {}
    try { await p.badge.requestPermissions(); } catch (_) {}
  },

  // 'YYYY-MM-DD' + 'HH:MM' → Date (lokale tijd). Standaard 09:00 zonder tijd.
  _parseDT(datum, tijd) {
    if (!datum) return null;
    const [y, m, d] = String(datum).split('-').map(Number);
    if (!y || !m || !d) return null;
    let hh = 9, mm = 0;
    if (tijd && /^\d{1,2}:\d{2}/.test(tijd)) { const [a, b] = tijd.split(':').map(Number); hh = a; mm = b; }
    return new Date(y, m - 1, d, hh, mm, 0);
  },

  async sync() {
    const p = Native._plugins();
    if (!p || Native._busy) return;
    if (typeof DB === 'undefined' || typeof Cloud === 'undefined' || !Cloud.loaded) return;
    Native._busy = true;
    try {
      await Native._ensurePerms(p);
      const now = new Date();
      const dossiers = DB.list(KEYS.DOSSIERS) || [];
      const notifs = [];
      let badge = 0;

      for (const dsr of dossiers) {
        if (dsr.id == null) continue;
        const naam = [dsr.voornaam, dsr.achternaam].filter(Boolean).join(' ')
          || dsr.dossier_nummer || 'dossier';
        const afgerond = dsr.status === 'voltooid' || dsr.status === 'geannuleerd';
        const basis = (dsr.id % 500000) * 4;

        // Uitvaart → badge + herinnering de dag ervoor om 18:00
        const uit = Native._parseDT(dsr.uitvaart_datum, dsr.uitvaart_tijd);
        if (uit && uit > now && !afgerond) {
          badge++;
          const dagVoor = new Date(uit.getTime());
          dagVoor.setDate(dagVoor.getDate() - 1);
          dagVoor.setHours(18, 0, 0, 0);
          const when = dagVoor > now ? dagVoor : new Date(now.getTime() + 60 * 1000);
          notifs.push({
            id: basis + 1,
            title: 'Uitvaart morgen',
            body: `${naam}${dsr.uitvaart_tijd ? ' — ' + dsr.uitvaart_tijd : ''}${dsr.kerk_locatie ? ' · ' + dsr.kerk_locatie : ''}`,
            schedule: { at: when },
          });
        }

        // Huisbezoek → herinnering 1 uur ervoor
        const huis = Native._parseDT(dsr.huisbezoek_datum, dsr.huisbezoek_tijd);
        if (huis && huis > now && !afgerond) {
          const when = new Date(huis.getTime() - 60 * 60 * 1000);
          notifs.push({
            id: basis + 2,
            title: 'Huisbezoek binnenkort',
            body: `${naam}${dsr.huisbezoek_tijd ? ' — ' + dsr.huisbezoek_tijd : ''}`,
            schedule: { at: when > now ? when : new Date(now.getTime() + 60 * 1000) },
          });
        }
      }

      // Oude geplande meldingen opruimen, dan de nieuwe zetten
      try {
        const pending = await p.ln.getPending();
        const list = pending && pending.notifications ? pending.notifications : [];
        if (list.length) await p.ln.cancel({ notifications: list.map(n => ({ id: n.id })) });
      } catch (_) {}
      if (notifs.length) { try { await p.ln.schedule({ notifications: notifs }); } catch (_) {} }

      // Badge bijwerken
      try {
        if (badge > 0) await p.badge.set({ count: badge });
        else await p.badge.clear();
      } catch (_) {}

      // Live Activity voor een uitvaart van vandaag
      try { await Native.syncLiveActivity(dossiers, now); } catch (_) {}
    } catch (_) {} finally {
      Native._busy = false;
    }
  },
};

// data-URL (base64) → File
Native._dataUrlToFile = async function (dataUrl, naam) {
  const resp = await fetch(dataUrl);
  const blob = await resp.blob();
  return new File([blob], `${naam}-${Date.now()}.jpg`, { type: blob.type || 'image/jpeg' });
};

// Diagnose: staat de native documentscanner-plugin écht in deze app-build?
//   'native'      → plugin geladen (echte Apple VisionKit-scanner beschikbaar)
//   'unavailable' → app, maar plugin zit niet in de build (oude TestFlight-
//                   build, of pod niet meegecompileerd)
//   'web'         → geen native app (browser)
Native.scannerStatus = async function () {
  if (!Native.isApp()) return 'web';
  // Dezelfde accessor als de echte scan, zodat de status klopt met de praktijk.
  return Native._plugin('DocumentScanner') ? 'native' : 'unavailable';
};

// Apple documentscanner (eigen VisionKit-plugin: randherkenning + recht
// trekken + meerdere pagina's — dezelfde als "Scan document" in Notities/
// Bestanden). Geeft de eerste pagina als File terug. Valt terug op de gewone
// camera als de scanner (nog) niet in de build zit.
Native.scanDocument = async function () {
  if (!Native.isApp()) return null;
  try {
    const DS = Native._plugin('DocumentScanner');
    if (!DS) return Native.scanFoto();
    const res = await DS.scan();
    if (res && res.cancelled) return null; // gebruiker annuleerde bewust
    const first = res && res.images && res.images[0]; // data-URL's (JPEG)
    if (first) return await Native._dataUrlToFile(first, 'scan');
  } catch (e) {
    // 'unimplemented' = de native plugin zit niet in deze build → val terug
    // op de camera, maar laat het één keer weten zodat het niet stil gebeurt.
    const msg = (e && (e.message || e.code || '')) + '';
    if (/unimplement|not implemented/i.test(msg)) {
      if (!Native._scannerMissingWarned && typeof Modal !== 'undefined') {
        Native._scannerMissingWarned = true;
        Modal.show({
          type: 'info',
          title: 'Apple-scanner nog niet in deze versie',
          message: 'Deze app-build bevat de documentscanner nog niet — er wordt nu de gewone camera gebruikt. Maak een nieuwe TestFlight-build om de echte scanner te activeren.',
        });
      }
    }
  }
  return Native.scanFoto();
};

// Native camera-scan → geeft een File terug (of null). Opent de native
// camera met bijsnijden; op web niet beschikbaar.
Native.scanFoto = async function () {
  if (!Native.isApp()) return null;
  try {
    const Camera = Native._plugin('Camera');
    if (!Camera) return null;
    const photo = await Camera.getPhoto({
      quality: 85,
      allowEditing: true,     // bijsnijden na de opname
      resultType: 'uri',      // levert webPath op
      source: 'CAMERA',
      saveToGallery: false,
      presentationStyle: 'fullscreen',
    });
    if (!photo || !photo.webPath) return null;
    const resp = await fetch(photo.webPath);
    const blob = await resp.blob();
    const ext = photo.format || 'jpeg';
    return new File([blob], `scan-${Date.now()}.${ext}`, { type: blob.type || `image/${ext}` });
  } catch (_) { return null; }
};

// ─── Live Activity (lockscreen-aftelwidget voor een uitvaart vandaag) ─────
Native._la = function () {
  if (!Native.isApp()) return null;
  if (!Native._laPlugin) Native._laPlugin = Native._plugin('LiveActivity');
  return Native._laPlugin;
};

// Status voor de diagnose in Account:
//   'web' | 'unavailable' (plugin niet in build) | 'off' (uit in iOS) | 'on'
Native._laLastError = '';
Native.liveActivityStatus = async function () {
  if (!Native.isApp()) return 'web';
  const LA = Native._la();
  if (!LA) {
    // Toon welke native plugins wél geregistreerd zijn — cruciale diagnose.
    let keys = '?';
    try { keys = Object.keys(window.Capacitor.Plugins || {}).join(', ') || '(leeg)'; } catch (_) {}
    Native._laLastError = 'plugins: [' + keys + ']';
    return 'unavailable';
  }
  try {
    // Rechtstreeks de plugin aanroepen = de échte test (niet isPluginAvailable,
    // dat auto-ontdekte plugins soms niet correct meldt).
    const e = await LA.areEnabled();
    Native._laLastError = '';
    return (e && e.enabled) ? 'on' : 'off';
  } catch (err) {
    Native._laLastError = ((err && (err.message || err.code)) || String(err)) + '';
    return 'unavailable';
  }
};

// Handmatige test: start meteen een demo-Live-Activity (2 uur aftellen), of
// de eerstvolgende echte uitvaart als die er is. Geeft een uitlegtekst terug.
Native.testLiveActivity = async function () {
  const LA = Native._la();
  if (!LA) throw new Error('Live Activity zit niet in deze app-build.');
  const en = await LA.areEnabled().catch(() => ({ enabled: false }));
  if (!en || !en.enabled) throw new Error('Live activiteiten staan uit — zet ze aan bij Instellingen → Uitvaartbeheer.');
  const eind = new Date(Date.now() + 2 * 3600 * 1000);
  await LA.endAll().catch(() => {});
  await LA.start({ naam: 'Testweergave', tijd: 'demo', kerk: 'Voorbeeldlocatie', eindMs: eind.getTime(), status: 'Test' });
  Native._laStartedFor = -1;
  return 'Demo gestart. Vergrendel nu je scherm — de widget staat op het vergrendelscherm (2 uur aftellen).';
};

// Beëindig alle lopende uitvaart-activities.
Native.endUitvaartActivities = async function () {
  const LA = Native._la();
  if (!LA) return;
  try { await LA.endAll(); } catch (_) {}
  Native._laStartedFor = null;
};

// Start (of ververs) een Live Activity voor één uitvaart.
Native.startUitvaartActivity = async function (dsr) {
  const LA = Native._la();
  if (!LA || !dsr) return false;
  const uit = Native._parseDT(dsr.uitvaart_datum, dsr.uitvaart_tijd);
  if (!uit) return false;
  const naam = [dsr.voornaam, dsr.achternaam].filter(Boolean).join(' ') || dsr.dossier_nummer || 'Uitvaart';
  try {
    await LA.endAll(); // voorkom dubbele widgets
    await LA.start({
      naam,
      tijd: dsr.uitvaart_tijd || '',
      kerk: dsr.kerk_locatie || dsr.begraafplaats || '',
      eindMs: uit.getTime(),
      status: 'Vandaag',
    });
    Native._laStartedFor = dsr.id;
    return true;
  } catch (_) { return false; }
};

// Beheer automatisch: is er vandaag een uitvaart (nog in de toekomst, binnen
// 12 uur), toon dan de widget; anders opruimen. Wordt vanuit sync() geroepen.
Native.syncLiveActivity = async function (dossiers, now) {
  const LA = Native._la();
  if (!LA) return;
  // Alleen aanzetten als de gebruiker Live Activities toestaat
  try { const e = await LA.areEnabled(); if (!e || !e.enabled) return; } catch (_) { return; }

  const nu = now || new Date();
  const grens = new Date(nu.getTime() + 12 * 3600 * 1000);
  let beste = null, besteT = Infinity;
  for (const dsr of (dossiers || [])) {
    if (dsr.status === 'voltooid' || dsr.status === 'geannuleerd') continue;
    const uit = Native._parseDT(dsr.uitvaart_datum, dsr.uitvaart_tijd);
    if (!uit) continue;
    // vandaag + nog in de toekomst + binnen 12 uur
    if (uit > nu && uit <= grens && uit.getTime() < besteT) { beste = dsr; besteT = uit.getTime(); }
  }

  if (beste) {
    if (Native._laStartedFor !== beste.id) await Native.startUitvaartActivity(beste);
  } else if (Native._laStartedFor != null) {
    await Native.endUitvaartActivities();
  }
};

// Statusbalk: app edge-to-edge tot achter de statusbalk, met donkere
// tekst (LIGHT-stijl = donkere klok/batterij voor onze lichte balk).
Native.initStatusBar = function () {
  if (!Native.isApp()) return;
  try {
    const SB = Native._plugin('StatusBar');
    if (!SB) return;
    if (SB.setOverlaysWebView) SB.setOverlaysWebView({ overlay: true }).catch(() => {});
    if (SB.setStyle) SB.setStyle({ style: 'LIGHT' }).catch(() => {});
  } catch (_) {}
};

// Auto: kort na laden + telkens als de app weer op de voorgrond komt.
if (Native.isApp()) {
  Native.initStatusBar();
  setTimeout(() => { Native.sync(); }, 4000);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') Native.sync();
  });
}
