// Init: Supabase auth, route registratie, login form, offline-modus

const Splash = {
  shownAt: Date.now(),
  dismissed: false,
  show(state /* 'online' | 'offline' */) {
    const splash = document.getElementById('splash');
    if (!splash) return;
    const onlineEl = document.getElementById('splash-online');
    const offlineEl = document.getElementById('splash-offline');
    const titleEl = document.getElementById('splash-title');
    const cont = document.getElementById('splash-continue');
    const hint = document.getElementById('splash-hint');
    onlineEl.hidden = state !== 'online';
    offlineEl.hidden = state !== 'offline';
    if (state === 'offline') {
      titleEl.textContent = 'Welkom terug';
      cont.hidden = false;
      cont.textContent = 'Verder in leesmodus';
      hint.hidden = true;
    } else {
      titleEl.textContent = 'Welkom';
      cont.hidden = true;
      hint.hidden = false;
    }
  },
  setupHandlers() {
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
  async autoDismissAfter(minMs = 1200) {
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
    setTimeout(() => { splash.hidden = true; }, 400);
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
  // Welkomscherm meteen tonen op basis van verbinding
  Splash.setupHandlers();
  Splash.show(navigator.onLine ? 'online' : 'offline');

  const sess = await Auth.init();
  if (sess) {
    try { await Cloud.loadAll(); }
    catch (e) {
      // Geen alert tijdens splash; offline-modus wordt al getoond
      console.warn('Laden mislukt:', e.message || e);
    }
  }
  updateOfflineUI();

  // Welkomscherm fadet automatisch weg na minimaal 1,2s online,
  // of blijft staan bij offline tot de gebruiker op "Verder" klikt
  if (navigator.onLine && !Cloud.offline) {
    Splash.autoDismissAfter(1200);
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
