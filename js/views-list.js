// Dashboard, lijst, account, 404

function renderDashboard() {
  const dossiers = DB.list(KEYS.DOSSIERS);
  const taken = DB.list(KEYS.TAKEN);
  const stats = {
    totaal: dossiers.length,
    nieuw: dossiers.filter(d => d.status === 'nieuw').length,
    in_behandeling: dossiers.filter(d => d.status === 'in_behandeling').length,
    voltooid: dossiers.filter(d => d.status === 'voltooid').length,
  };
  const today = new Date().toISOString().slice(0, 10);
  const aankomend = dossiers
    .filter(d => d.uitvaart_datum && d.uitvaart_datum >= today)
    .sort((a, b) => a.uitvaart_datum.localeCompare(b.uitvaart_datum)).slice(0, 5);
  const openTaken = taken
    .filter(t => !t.voltooid && t.deadline)
    .sort((a, b) => a.deadline.localeCompare(b.deadline)).slice(0, 8);
  const recent = dossiers.slice().sort((a, b) =>
    (b.updated_at || b.created_at || '').localeCompare(a.updated_at || a.created_at || '')
  ).slice(0, 8);

  const view = $('#view');
  view.innerHTML = `
    <div class="page">
      <div class="page-head">
        <h1>Dashboard</h1>
        <a href="#/dossiers/nieuw" class="btn btn-primary">+ Nieuw dossier</a>
      </div>
      <div class="stat-grid">
        <div class="stat-card"><div class="stat-label">Totaal dossiers</div><div class="stat-value">${stats.totaal}</div></div>
        <div class="stat-card stat-blue"><div class="stat-label">Nieuw</div><div class="stat-value">${stats.nieuw}</div></div>
        <div class="stat-card stat-amber"><div class="stat-label">In behandeling</div><div class="stat-value">${stats.in_behandeling}</div></div>
        <div class="stat-card stat-green"><div class="stat-label">Voltooid</div><div class="stat-value">${stats.voltooid}</div></div>
      </div>
      <div class="grid-2">
        <section class="card">
          <h2>Aankomende uitvaarten</h2>
          ${aankomend.length === 0 ? '<p class="muted">Geen aankomende uitvaarten ingepland.</p>' :
            '<ul class="list">' + aankomend.map(d => `
              <li>
                <a href="#/dossiers/${d.id}" class="list-link">
                  <strong>${esc(fullName(d) || '—')}</strong>
                  <span class="muted small">${esc(d.dossier_nummer)}</span>
                </a>
                <span class="badge">${esc(fmtDate(d.uitvaart_datum))}${d.uitvaart_tijd ? ' · ' + esc(d.uitvaart_tijd) : ''}</span>
              </li>`).join('') + '</ul>'}
        </section>
        <section class="card">
          <h2>Open taken met deadline</h2>
          ${openTaken.length === 0 ? '<p class="muted">Geen openstaande taken met deadline.</p>' :
            '<ul class="list">' + openTaken.map(t => {
              const d = DB.byId(KEYS.DOSSIERS, t.dossier_id) || {};
              return `<li>
                <a href="#/dossiers/${t.dossier_id}" class="list-link">
                  ${esc(t.omschrijving)}
                  <span class="muted small">— ${esc(fullName(d))}</span>
                </a>
                <span class="badge badge-amber">${esc(fmtDate(t.deadline))}</span>
              </li>`;
            }).join('') + '</ul>'}
        </section>
      </div>
      <section class="card">
        <h2>Recent bewerkt</h2>
        ${recent.length === 0 ? `<p class="muted">Nog geen dossiers. <a href="#/dossiers/nieuw">Maak het eerste dossier aan</a>.</p>` :
        `<table class="table"><thead><tr>
          <th>Dossier</th><th>Overledene</th><th>Overlijdensdatum</th><th>Uitvaartdatum</th><th>Status</th><th>Bijgewerkt</th>
        </tr></thead><tbody>
          ${recent.map(d => `<tr>
            <td><a href="#/dossiers/${d.id}">${esc(d.dossier_nummer)}</a></td>
            <td>${esc(fullName(d) || '—')}</td>
            <td>${esc(fmtDate(d.overlijdensdatum) || '—')}</td>
            <td>${esc(fmtDate(d.uitvaart_datum) || '—')}</td>
            <td><span class="status status-${esc(d.status)}">${esc((d.status||'nieuw').replace('_',' '))}</span></td>
            <td class="muted small">${esc(fmtDate(d.updated_at || d.created_at))}</td>
          </tr>`).join('')}
        </tbody></table>`}
      </section>
    </div>`;
}

function renderDossierList(params, path) {
  const url = new URL(location.href);
  const q = (url.hash.split('?')[1] ? new URLSearchParams(url.hash.split('?')[1]).get('q') : '') || '';
  const status = (url.hash.split('?')[1] ? new URLSearchParams(url.hash.split('?')[1]).get('status') : '') || '';

  let dossiers = DB.list(KEYS.DOSSIERS);
  if (q) {
    const ql = q.toLowerCase();
    dossiers = dossiers.filter(d =>
      [d.voornaam, d.achternaam, d.dossier_nummer, d.contact_naam, d.gezinsnummer]
      .filter(Boolean).some(v => String(v).toLowerCase().includes(ql))
    );
  }
  if (status) dossiers = dossiers.filter(d => d.status === status);
  dossiers.sort((a, b) => (b.updated_at || b.created_at || '').localeCompare(a.updated_at || a.created_at || ''));

  $('#view').innerHTML = `
    <div class="page">
      <div class="page-head">
        <h1>Dossiers</h1>
        <a href="#/dossiers/nieuw" class="btn btn-primary">+ Nieuw dossier</a>
      </div>
      <form class="filter-bar" id="filter-form">
        <input type="search" name="q" value="${esc(q)}" placeholder="Zoek op naam, dossiernummer, gezinsnummer, contactpersoon..." />
        <select name="status">
          <option value="">Alle statussen</option>
          <option value="nieuw" ${status==='nieuw'?'selected':''}>Nieuw</option>
          <option value="in_behandeling" ${status==='in_behandeling'?'selected':''}>In behandeling</option>
          <option value="voltooid" ${status==='voltooid'?'selected':''}>Voltooid</option>
          <option value="geannuleerd" ${status==='geannuleerd'?'selected':''}>Geannuleerd</option>
        </select>
        <button type="submit" class="btn">Filteren</button>
        ${q || status ? '<a href="#/dossiers" class="btn btn-ghost">Wissen</a>' : ''}
      </form>
      ${dossiers.length === 0 ? '<div class="card"><p class="muted">Geen dossiers gevonden.</p></div>' :
      `<table class="table"><thead><tr>
        <th>Dossier</th><th>Overledene</th><th>Contactpersoon</th><th>Gezinsnr.</th><th>Overlijden</th><th>Uitvaart</th><th>Status</th>
      </tr></thead><tbody>
        ${dossiers.map(d => `<tr>
          <td><a href="#/dossiers/${d.id}">${esc(d.dossier_nummer)}</a></td>
          <td><strong>${esc(fullName(d) || '—')}</strong></td>
          <td>${esc(d.contact_naam || '—')}${d.contact_telefoon ? `<br><span class="muted small">${esc(d.contact_telefoon)}</span>` : ''}</td>
          <td>${esc(d.gezinsnummer || '—')}</td>
          <td>${esc(fmtDate(d.overlijdensdatum) || '—')}</td>
          <td>${esc(fmtDate(d.uitvaart_datum) || '—')}${d.uitvaart_tijd ? ' <span class="muted">' + esc(d.uitvaart_tijd) + '</span>' : ''}</td>
          <td><span class="status status-${esc(d.status||'nieuw')}">${esc((d.status||'nieuw').replace('_',' '))}</span></td>
        </tr>`).join('')}
      </tbody></table>`}
    </div>`;

  $('#filter-form').addEventListener('submit', e => {
    e.preventDefault();
    const f = e.target;
    const params = new URLSearchParams();
    if (f.q.value) params.set('q', f.q.value);
    if (f.status.value) params.set('status', f.status.value);
    location.hash = '#/dossiers' + (params.toString() ? '?' + params.toString() : '');
  });
}

function renderAccount(msg) {
  const u = Auth.current();
  $('#view').innerHTML = `
    <div class="page">
      <div class="page-head"><h1>Mijn account</h1></div>
      <section class="card narrow">
        <h2>Gegevens</h2>
        <dl class="dl">
          <div><dt>E-mailadres</dt><dd>${esc(u.email)}</dd></div>
          <div><dt>Naam</dt><dd>${esc(u.fullName || '—')}</dd></div>
          <div><dt>Rol</dt><dd>${esc(u.role || '—')}</dd></div>
        </dl>
      </section>
      <section class="card narrow">
        <h2>Wachtwoord wijzigen</h2>
        ${msg && msg.error ? `<div class="alert alert-error">${esc(msg.error)}</div>` : ''}
        ${msg && msg.success ? `<div class="alert alert-success">${esc(msg.success)}</div>` : ''}
        <form id="pw-form" class="form" autocomplete="off">
          <label><span>Nieuw wachtwoord</span><input type="password" name="nieuw" required minlength="6"></label>
          <label><span>Herhaal nieuw wachtwoord</span><input type="password" name="herhaal" required minlength="6"></label>
          <button type="submit" class="btn btn-primary">Wachtwoord wijzigen</button>
        </form>
      </section>
      <section class="card narrow">
        <h2>Welkomscherm-instellingen</h2>
        <p class="muted small">Het welkomscherm verschijnt wanneer je de app opent. Online verdwijnt het automatisch; offline blijft het staan totdat je op "Verder" klikt.</p>
        ${(() => {
          const s = Settings.all();
          return `
          <form id="splash-form" class="form" autocomplete="off">
            <label class="checkbox-inline" style="font-size:.95rem;">
              <input type="checkbox" name="splash_enabled" ${s.splash_enabled ? 'checked' : ''}>
              Welkomscherm tonen bij appstart
            </label>

            <label>
              <span>Duur online (seconden) — <strong id="dur-label">${(s.splash_duration_ms/1000).toFixed(1)}s</strong></span>
              <input type="range" name="splash_duration_ms" min="500" max="6000" step="100" value="${s.splash_duration_ms}" id="dur-range">
              <span class="muted small">Tussen 0,5s en 6,0s. Klikken/Enter slaat het altijd direct over.</span>
            </label>

            <label>
              <span>Animatie</span>
              <select name="splash_animation">
                <option value="glass" ${s.splash_animation==='glass'?'selected':''}>Glas (zacht vervagen + verkleinen) — aanbevolen</option>
                <option value="fade"  ${s.splash_animation==='fade' ?'selected':''}>Vervagen (eenvoudig)</option>
                <option value="scale" ${s.splash_animation==='scale'?'selected':''}>Inzoomen</option>
                <option value="slide" ${s.splash_animation==='slide'?'selected':''}>Naar boven schuiven</option>
              </select>
            </label>

            <label>
              <span>Titel (online)</span>
              <input type="text" name="splash_title" value="${esc(s.splash_title)}" maxlength="60">
            </label>

            <label>
              <span>Titel (offline)</span>
              <input type="text" name="splash_offline_title" value="${esc(s.splash_offline_title)}" maxlength="60">
            </label>

            <label>
              <span>Ondertitel</span>
              <input type="text" name="splash_subtitle" value="${esc(s.splash_subtitle)}" maxlength="120">
            </label>

            <div class="form-actions" style="justify-content:space-between;">
              <div style="display:flex;gap:.5rem;flex-wrap:wrap;">
                <button type="button" class="btn btn-ghost" id="btn-preview-online">Voorbeeld online</button>
                <button type="button" class="btn btn-ghost" id="btn-preview-offline">Voorbeeld offline</button>
              </div>
              <div style="display:flex;gap:.5rem;flex-wrap:wrap;">
                <button type="button" class="btn btn-ghost" id="btn-reset-splash">Standaardwaarden</button>
                <button type="submit" class="btn btn-primary">Opslaan</button>
              </div>
            </div>
          </form>`;
        })()}
      </section>

      <section class="card narrow">
        <h2>Cloud-back-up</h2>
        <p class="muted small">Alle dossiergegevens worden veilig in Supabase opgeslagen en zijn op alle apparaten beschikbaar. Documenten staan in de Storage-bucket. Voor extra zekerheid kun je een JSON-export downloaden.</p>
        <div class="form-actions" style="justify-content:flex-start">
          <button type="button" class="btn" id="btn-export">Exporteer alle data (JSON)</button>
        </div>
      </section>
    </div>`;

  // Splash-instellingen
  const splashForm = $('#splash-form');
  if (splashForm) {
    const durRange = $('#dur-range');
    const durLabel = $('#dur-label');
    durRange.addEventListener('input', () => {
      durLabel.textContent = (parseInt(durRange.value, 10)/1000).toFixed(1) + 's';
    });

    splashForm.addEventListener('submit', e => {
      e.preventDefault();
      const f = e.target;
      Settings.set({
        splash_enabled: f.splash_enabled.checked,
        splash_duration_ms: parseInt(f.splash_duration_ms.value, 10),
        splash_animation: f.splash_animation.value,
        splash_title: f.splash_title.value.trim() || Settings.defaults.splash_title,
        splash_offline_title: f.splash_offline_title.value.trim() || Settings.defaults.splash_offline_title,
        splash_subtitle: f.splash_subtitle.value.trim() || Settings.defaults.splash_subtitle,
      });
      renderAccount({ success: 'Welkomscherm-instellingen opgeslagen.' });
    });

    $('#btn-reset-splash').addEventListener('click', () => {
      if (!confirm('Welkomscherm-instellingen terugzetten naar standaard?')) return;
      // Reset alleen splash-instellingen
      Settings.set({
        splash_enabled: Settings.defaults.splash_enabled,
        splash_duration_ms: Settings.defaults.splash_duration_ms,
        splash_animation: Settings.defaults.splash_animation,
        splash_title: Settings.defaults.splash_title,
        splash_offline_title: Settings.defaults.splash_offline_title,
        splash_subtitle: Settings.defaults.splash_subtitle,
      });
      renderAccount({ success: 'Standaardwaarden hersteld.' });
    });

    $('#btn-preview-online').addEventListener('click', () => {
      // Sla huidige formuliergegevens tijdelijk op zodat de preview ze gebruikt
      const f = splashForm;
      Settings.set({
        splash_animation: f.splash_animation.value,
        splash_duration_ms: parseInt(f.splash_duration_ms.value, 10),
        splash_title: f.splash_title.value.trim() || Settings.defaults.splash_title,
        splash_offline_title: f.splash_offline_title.value.trim() || Settings.defaults.splash_offline_title,
        splash_subtitle: f.splash_subtitle.value.trim() || Settings.defaults.splash_subtitle,
      });
      Splash.preview('online');
    });

    $('#btn-preview-offline').addEventListener('click', () => {
      const f = splashForm;
      Settings.set({
        splash_animation: f.splash_animation.value,
        splash_duration_ms: parseInt(f.splash_duration_ms.value, 10),
        splash_title: f.splash_title.value.trim() || Settings.defaults.splash_title,
        splash_offline_title: f.splash_offline_title.value.trim() || Settings.defaults.splash_offline_title,
        splash_subtitle: f.splash_subtitle.value.trim() || Settings.defaults.splash_subtitle,
      });
      Splash.preview('offline');
    });
  }

  $('#pw-form').addEventListener('submit', async e => {
    e.preventDefault();
    const f = e.target;
    if (f.nieuw.value !== f.herhaal.value) return renderAccount({ error: 'Wachtwoorden komen niet overeen.' });
    if (f.nieuw.value.length < 6) return renderAccount({ error: 'Minstens 6 tekens.' });
    const err = await Auth.changePassword(f.nieuw.value);
    renderAccount(err ? { error: err } : { success: 'Wachtwoord gewijzigd.' });
  });

  $('#btn-export').addEventListener('click', () => {
    const data = {
      dossiers: DB.list(KEYS.DOSSIERS),
      taken: DB.list(KEYS.TAKEN),
      kosten: DB.list(KEYS.KOSTEN),
      notities: DB.list(KEYS.NOTITIES),
      documenten: DB.list(KEYS.DOCUMENTEN),
      exported_at: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = `uitvaart-backup-${new Date().toISOString().slice(0,10)}.json`;
    a.click(); URL.revokeObjectURL(a.href);
  });
}

function render404() {
  $('#view').innerHTML = `<div class="page"><div class="card narrow center"><h1>404</h1><p>Deze pagina bestaat niet.</p><a href="#/" class="btn btn-primary">Terug naar dashboard</a></div></div>`;
}
