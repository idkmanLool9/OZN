// Init: Supabase auth, route registratie, login form, offline-modus

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
  const sess = await Auth.init();
  if (sess) {
    try { await Cloud.loadAll(); }
    catch (e) { alert('Gegevens laden mislukt: ' + (e.message || e)); }
  }
  updateOfflineUI();

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
