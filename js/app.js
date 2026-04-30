// Init: Supabase auth, route registratie, login form

Router.add('/', () => renderDashboard());
Router.add('/dossiers', (p, full) => renderDossierList(p, full));
Router.add('/dossiers/nieuw', () => renderDossierForm({}));
Router.add('/dossiers/:id', p => renderDossierDetail(p));
Router.add('/dossiers/:id/bewerken', p => renderDossierForm(p));
Router.add('/kisten', () => renderKistenBeheer());
Router.add('/bloemen', () => renderBloemenBeheer());
Router.add('/account', () => renderAccount());

(async function init() {
  const sess = await Auth.init();
  if (sess) {
    try { await Cloud.loadAll(); }
    catch (e) { alert('Gegevens laden mislukt: ' + (e.message || e)); }
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
