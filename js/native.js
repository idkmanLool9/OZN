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

  _plugins() {
    if (!Native.isApp()) return null;
    try {
      if (!Native._ln)    Native._ln    = Capacitor.registerPlugin('LocalNotifications');
      if (!Native._badge) Native._badge = Capacitor.registerPlugin('Badge');
      return { ln: Native._ln, badge: Native._badge };
    } catch (_) { return null; }
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

// Diagnose: staat de native VisionKit-plugin écht in deze app-build?
//   'native'      → plugin geladen (echte Apple-scanner beschikbaar)
//   'unavailable' → app, maar plugin zit niet in de build (oude TestFlight-
//                   build, of pod niet meegecompileerd)
//   'web'         → geen native app (browser)
// De plugin krijgt een isAvailable()-methode; faalt die met 'unimplemented'
// dan weten we zeker dat de native code ontbreekt.
Native.scannerStatus = async function () {
  if (!Native.isApp()) return 'web';
  try {
    const DS = Capacitor.registerPlugin('DocumentScanner');
    const res = await DS.isAvailable();   // slaagt alleen als plugin geladen is
    // Plugin is geladen. res.available zegt of het toestel het ondersteunt.
    return (res && res.available === false) ? 'native-unsupported' : 'native';
  } catch (_) {
    return 'unavailable';
  }
};

// Apple documentscanner (VisionKit): randherkenning + recht trekken +
// meerdere pagina's. Geeft de eerste pagina als File terug. Valt terug op
// de gewone camera als de scanner (nog) niet beschikbaar is.
Native.scanDocument = async function () {
  if (!Native.isApp()) return null;
  try {
    const DS = Capacitor.registerPlugin('DocumentScanner');
    const res = await DS.scan();
    const first = res && res.images && res.images[0];
    if (first) return await Native._dataUrlToFile(first, 'scan');
    if (res && res.cancelled) return null; // gebruiker annuleerde bewust
  } catch (e) {
    // 'unimplemented' = de native plugin zit niet in deze build → val terug
    // op de camera, maar laat het één keer weten zodat het niet stil gebeurt.
    const msg = (e && (e.message || e.code || '')) + '';
    if (/unimplement|not implemented|niet.*geïmplement/i.test(msg)) {
      Native._scannerMissingWarned = Native._scannerMissingWarned || false;
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
    const Camera = Capacitor.registerPlugin('Camera');
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

// Statusbalk: app edge-to-edge tot achter de statusbalk, met donkere
// tekst (LIGHT-stijl = donkere klok/batterij voor onze lichte balk).
Native.initStatusBar = function () {
  if (!Native.isApp()) return;
  try {
    const SB = Capacitor.registerPlugin('StatusBar');
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
