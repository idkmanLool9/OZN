// Init: Supabase auth, route registratie, login form, offline-modus

// ─── Instellingen (lokaal per apparaat) ─────────────────────────────────────
const Settings = {
  KEY: 'sok_settings',
  defaults: {
    splash_enabled: true,
    splash_duration_ms: 2500,
    splash_animation: 'glass', // 'glass' | 'fade' | 'scale' | 'slide'
    splash_title: 'Welkom',
    splash_subtitle: 'Uitvaartbeheer · Syrisch-Orthodoxe Kerk van Antiochië',
    splash_offline_title: 'Welkom terug',
  },
  all() {
    let stored = {};
    try { stored = JSON.parse(localStorage.getItem(Settings.KEY) || '{}') || {}; } catch (_) {}
    return Object.assign({}, Settings.defaults, stored);
  },
  get(key) { return Settings.all()[key]; },
  set(patch) {
    const next = Object.assign({}, Settings.all(), patch);
    // Verwijder defaults om opslag schoon te houden
    const trimmed = {};
    for (const k in next) if (next[k] !== Settings.defaults[k]) trimmed[k] = next[k];
    localStorage.setItem(Settings.KEY, JSON.stringify(trimmed));
  },
  reset() { localStorage.removeItem(Settings.KEY); },
};

const Splash = {
  shownAt: Date.now(),
  dismissed: false,
  handlersBound: false,

  show(state /* 'online' | 'offline' */, opts = {}) {
    const s = Settings.all();
    const splash = document.getElementById('splash');
    if (!splash) return;

    // Animatie-klasse op de splash zetten
    splash.classList.remove('anim-glass', 'anim-fade', 'anim-scale', 'anim-slide');
    splash.classList.add('anim-' + (s.splash_animation || 'glass'));

    const onlineEl = document.getElementById('splash-online');
    const offlineEl = document.getElementById('splash-offline');
    const titleEl = document.getElementById('splash-title');
    const subEl = splash.querySelector('.splash-sub');
    const cont = document.getElementById('splash-continue');
    const hint = document.getElementById('splash-hint');

    if (subEl) subEl.textContent = s.splash_subtitle;

    onlineEl.hidden = state !== 'online';
    offlineEl.hidden = state !== 'offline';
    if (state === 'offline') {
      titleEl.textContent = s.splash_offline_title;
      cont.hidden = false;
      cont.textContent = 'Verder in leesmodus';
      hint.hidden = true;
    } else {
      titleEl.textContent = s.splash_title;
      cont.hidden = true;
      hint.hidden = false;
    }

    splash.hidden = false;
    splash.classList.remove('fading');
    Splash.shownAt = Date.now();
    Splash.dismissed = false;
    Splash.setupHandlers();
  },

  setupHandlers() {
    if (Splash.handlersBound) return;
    Splash.handlersBound = true;
    const splash = document.getElementById('splash');
    if (!splash) return;
    const dismiss = () => Splash.dismiss();
    splash.addEventListener('click', dismiss);
    document.getElementById('splash-continue').addEventListener('click', e => {
      e.stopPropagation(); dismiss();
    });
    document.addEventListener('keydown', e => {
      if (!Splash.dismissed && (e.key === 'Enter' || e.key === ' ' || e.key === 'Escape')) dismiss();
    });
  },

  async autoDismiss() {
    const minMs = Math.max(0, parseInt(Settings.get('splash_duration_ms'), 10) || 0);
    const elapsed = Date.now() - Splash.shownAt;
    if (elapsed < minMs) await new Promise(r => setTimeout(r, minMs - elapsed));
    Splash.dismiss();
  },

  dismiss() {
    if (Splash.dismissed) return;
    Splash.dismissed = true;
    const splash = document.getElementById('splash');
    if (!splash) return;
    splash.classList.add('fading');
    setTimeout(() => { splash.hidden = true; }, 750);
  },

  // Voorbeeld vanuit instellingen-pagina
  preview(state) {
    Splash.show(state || (navigator.onLine ? 'online' : 'offline'));
    if (state === 'online' || (!state && navigator.onLine)) Splash.autoDismiss();
  },
};

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./service-worker.js').catch(err =>
      console.warn('Service worker registratie mislukt:', err));
  });
}

function updateOfflineUI() {
  const offline = !navigator.onLine || !!Cloud.offline;
  const badge = document.getElementById('offline-badge');
  if (badge) badge.hidden = !offline;
  document.body.classList.toggle('is-offline', offline);
}
window.addEventListener('online', () => {
  updateOfflineUI();
  if (Cloud.offline && Auth.current()) {
    Cloud.loadAll().then(() => { updateOfflineUI(); Router.handle(); }).catch(() => {});
  }
});
window.addEventListener('offline', updateOfflineUI);

Router.add('/', () => renderDashboard());
Router.add('/dossiers', (p, full) => renderDossierList(p, full));
Router.add('/dossiers/nieuw', () => renderDossierForm({}));
Router.add('/dossiers/:id', p => renderDossierDetail(p));
Router.add('/dossiers/:id/bewerken', p => renderDossierForm(p));
Router.add('/kisten', () => renderKistenBeheer());
Router.add('/bloemen', () => renderBloemenBeheer());
Router.add('/eten-drinken', () => renderEtenDrinkenBeheer());
Router.add('/account', () => renderAccount());

(async function init() {
  // Welkomscherm meteen tonen op basis van verbinding (tenzij uitgezet)
  const splashOn = Settings.get('splash_enabled');
  if (splashOn) {
    Splash.show(navigator.onLine ? 'online' : 'offline');
  } else {
    document.getElementById('splash').hidden = true;
    Splash.dismissed = true;
  }

  const sess = await Auth.init();
  if (sess) {
    try { await Cloud.loadAll(); }
    catch (e) {
      console.warn('Laden mislukt:', e.message || e);
    }
  }
  updateOfflineUI();

  // Online: automatisch wegfaden na de ingestelde duur.
  // Offline: blijft staan tot de gebruiker op "Verder" klikt.
  if (splashOn && navigator.onLine && !Cloud.offline) {
    Splash.autoDismiss();
  }

  document.getElementById('login-form').addEventListener('submit', async e => {
    e.preventDefault();
    const email = document.getElementById('login-username').value.trim();
    const pw = document.getElementById('login-password').value;
    const errEl = document.getElementById('login-error');
    errEl.hidden = true;
    const btn = e.target.querySelector('button[type=submit]');
    btn.disabled = true; btn.textContent = 'Bezig met inloggen...';
    const err = await Auth.login(email, pw);
    btn.disabled = false; btn.textContent = 'Inloggen';
    if (err) {
      errEl.textContent = (err.toLowerCase().includes('invalid') || err.toLowerCase().includes('credentials'))
        ? 'Onjuist e-mailadres of wachtwoord.' : err;
      errEl.hidden = false;
      return;
    }
    document.getElementById('login-password').value = '';
    try { await Cloud.loadAll(); } catch (e2) { alert('Laden mislukt: ' + (e2.message || e2)); }
    updateOfflineUI();
    if (!location.hash || location.hash === '#/login') location.hash = '#/';
    Router.handle();
  });

  document.getElementById('btn-logout').addEventListener('click', async () => {
    await Auth.logout();
    Cloud.cache = { dossiers: [], taken: [], kosten: [], notities: [], documenten: [] };
    Cloud.loaded = false;
    location.hash = '';
    Router.handle();
  });

  Router.start();
})();
