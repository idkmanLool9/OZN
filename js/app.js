// App init: routes registreren, login afhandelen, eerste run

Router.add('/', () => renderDashboard());
Router.add('/dossiers', (p, path) => renderDossierList(p, path));
Router.add('/dossiers/nieuw', () => renderDossierForm({}));
Router.add('/dossiers/:id', p => renderDossierDetail(p));
Router.add('/dossiers/:id/bewerken', p => renderDossierForm(p));
Router.add('/account', () => renderAccount());

(async function init() {
  const created = await Auth.ensureDefaultUser();
  if (created) document.getElementById('default-creds-hint').hidden = false;

  document.getElementById('login-form').addEventListener('submit', async e => {
    e.preventDefault();
    const u = document.getElementById('login-username').value.trim();
    const p = document.getElementById('login-password').value;
    const err = document.getElementById('login-error');
    err.hidden = true;
    const ok = await Auth.login(u, p);
    if (!ok) { err.textContent = 'Onjuiste gebruikersnaam of wachtwoord.'; err.hidden = false; return; }
    document.getElementById('login-password').value = '';
    if (!location.hash || location.hash === '#/login') location.hash = '#/';
    Router.handle();
  });

  document.getElementById('btn-logout').addEventListener('click', () => {
    Auth.logout();
    location.hash = '';
    Router.handle();
  });

  Router.start();
})();
