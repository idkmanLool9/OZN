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

// Auto: kort na laden + telkens als de app weer op de voorgrond komt.
if (Native.isApp()) {
  setTimeout(() => { Native.sync(); }, 4000);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') Native.sync();
  });
}
