// Dossierlijst, account, 404

// Statusbadge met passend icoon (✓ Voltooid, etc.)
function dossierStatusBadge(st) {
  const s = st || 'nieuw';
  const ico = { nieuw: '✦', in_behandeling: '◷', voltooid: '✓', geannuleerd: '✕' };
  const lbl = { nieuw: 'Nieuw', in_behandeling: 'In behandeling', voltooid: 'Voltooid', geannuleerd: 'Geannuleerd' };
  return `<span class="status status-${esc(s)}"><span class="status-ico">${ico[s] || ''}</span>${esc(lbl[s] || s.replace('_', ' '))}</span>`;
}

function renderDossierList(params, path) {
  const url = new URL(location.href);
  const q = (url.hash.split('?')[1] ? new URLSearchParams(url.hash.split('?')[1]).get('q') : '') || '';
  const status = (url.hash.split('?')[1] ? new URLSearchParams(url.hash.split('?')[1]).get('status') : '') || '';

  let dossiers = DB.list(KEYS.DOSSIERS);
  if (q) {
    const ql = q.toLowerCase();
    dossiers = dossiers.filter(d => {
      // Zoek over alle tekstuele velden van het dossier
      for (const k in d) {
        const v = d[k];
        if (v == null) continue;
        if (typeof v === 'string' && v.toLowerCase().includes(ql)) return true;
        if (typeof v === 'number' && String(v).includes(ql)) return true;
      }
      return false;
    });
  }
  if (status === 'gearchiveerd') {
    dossiers = dossiers.filter(d => d.gearchiveerd);
  } else {
    dossiers = dossiers.filter(d => !d.gearchiveerd);   // archief standaard verborgen
    if (status) dossiers = dossiers.filter(d => d.status === status);
  }
  dossiers.sort((a, b) => (b.updated_at || b.created_at || '').localeCompare(a.updated_at || a.created_at || ''));

  $('#view').innerHTML = `
    <div class="page">
      <div class="page-head">
        <div>
          <h1>Dossiers</h1>
          <p class="muted">Beheer en overzicht van alle dossiers.</p>
        </div>
        <a href="#/dossiers/nieuw" class="btn btn-primary">+ Nieuw dossier</a>
      </div>


      ${(typeof Auth !== 'undefined' && Auth.isBeheerder() && typeof KistVoorraad !== 'undefined') ? (() => {
        const laag = KistVoorraad.laag();
        if (!laag.length) return '';
        const leeg = laag.filter(r => (r.aantal || 0) === 0).length;
        return `
        <div class="alert alert-warn kist-voorraad-banner" style="display:flex;justify-content:space-between;align-items:center;gap:.75rem;flex-wrap:wrap;">
          <div>
            <strong>⚠ Voorraad laag${leeg ? ` · ${leeg} kist${leeg === 1 ? '' : 'en'} leeg` : ''}</strong>
            <span class="muted small">${laag.length} kist${laag.length === 1 ? '' : 'en'} onder minimum.</span>
          </div>
          <a href="#/kisten/bestellijst" class="btn btn-sm btn-primary">Open bestellijst</a>
        </div>`;
      })() : ''}

      <form class="dossiers-filterbar" id="filter-form">
        <div class="catalog-search">
          <input type="search" name="q" value="${esc(q)}" placeholder="Zoek op naam of dossiernummer…" autocomplete="off">
        </div>
        <select name="status" class="dossiers-control" id="dossiers-status">
          <option value="">Alle statussen</option>
          <option value="nieuw" ${status==='nieuw'?'selected':''}>Nieuw</option>
          <option value="in_behandeling" ${status==='in_behandeling'?'selected':''}>In behandeling</option>
          <option value="voltooid" ${status==='voltooid'?'selected':''}>Voltooid</option>
          <option value="geannuleerd" ${status==='geannuleerd'?'selected':''}>Geannuleerd</option>
          ${(typeof Auth !== 'undefined' && Auth.isBeheerder()) ? `<option value="gearchiveerd" ${status==='gearchiveerd'?'selected':''}>📦 Archief</option>` : ''}
        </select>
        <button type="button" class="dossiers-control dossiers-filter-btn" id="dossiers-filter-toggle" aria-expanded="false" aria-controls="dossiers-filter-paneel">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 5h18M6 12h12M10 19h4"/></svg>
          Filteren <span class="filter-badge" id="dossiers-filter-count" hidden></span>
        </button>
        ${q || status ? '<a href="#/dossiers" class="dossiers-wis">↺ Wis</a>' : ''}
      </form>

      ${(() => {
        // Verzamel filter-dimensies uit Settings en huidige dossierset.
        const opdrLijst = (Settings.get('opdrachtgevers') || []).map(o => o.naam || o).filter(Boolean);
        const kistLijst = [...new Set(DB.list(KEYS.DOSSIERS).map(d => d.kist_type).filter(Boolean))].sort();
        const persLijst = (Settings.get('profielen') || []).map(p => p.name).filter(Boolean);
        const rouwLijst = (Settings.get('rouwauto_lijst') || []).filter(Boolean);
        const cb = (naam, waarde, label) => `
          <label class="dfilter-chip">
            <input type="checkbox" data-filter="${esc(naam)}" value="${esc(waarde)}">
            <span>${esc(label)}</span>
          </label>`;
        const groep = (titel, items) => items.length ? `
          <div class="dfilter-groep">
            <div class="dfilter-titel">${esc(titel)}</div>
            <div class="dfilter-chips">${items}</div>
          </div>` : '';
        return `
        <div class="dfilter-paneel" id="dossiers-filter-paneel" hidden>
          <div class="dfilter-groep">
            <div class="dfilter-titel">Snel</div>
            <div class="dfilter-chips">
              <label class="dfilter-chip">
                <input type="checkbox" data-filter="onvolledig" value="1">
                <span>⚠ Onvolledig ingevuld</span>
              </label>
              <label class="dfilter-chip">
                <input type="checkbox" data-filter="openkosten" value="1">
                <span>💶 Nog openstaande kosten</span>
              </label>
              <label class="dfilter-chip">
                <input type="checkbox" data-filter="mijnzaken" value="1">
                <span>👤 Alleen mijn dossiers</span>
              </label>
              <label class="dfilter-chip">
                <input type="checkbox" data-filter="geenkist" value="1">
                <span>📦 Kist nog niet gekozen</span>
              </label>
            </div>
          </div>
          ${groep('Opdrachtgever', opdrLijst.map(v => cb('opdrachtgever', v, v)).join(''))}
          ${groep('Kist',          kistLijst.map(v => cb('kist',          v, v)).join(''))}
          ${groep('Personeel',     persLijst.map(v => cb('personeel',     v, v)).join(''))}
          ${groep('Rouwauto',      rouwLijst.map(v => cb('rouwauto',      v, v)).join(''))}
          <div class="dfilter-actions">
            <button type="button" class="btn btn-sm btn-ghost" id="dfilter-wis">↺ Wis alle filters</button>
            <span class="muted small" id="dfilter-resultaat"></span>
          </div>
        </div>`;
      })()}

      ${dossiers.length === 0
        ? '<div class="dossiers-kaart"><p class="muted center" style="padding:2.5rem;">Geen dossiers gevonden.</p></div>'
        : `<div class="dossiers-kaart">
            <table class="table dossiers-table">
              <thead><tr>
                <th>Dossier</th><th>Overledene</th><th>Opdrachtgever</th><th>Overlijden</th><th>Status</th><th>Laatst gewijzigd</th><th aria-hidden="true"></th>
              </tr></thead>
              <tbody>
                ${dossiers.map(d => {
                  // 'Niet ingevuld'-melding is verwijderd op verzoek: de badge
                  // gaf te vaak alarm terwijl velden bewust leeg werden gelaten.
                  const missend = [];
                  const warn = '';
                  // Kostenposten voor deze dossier — voor 'openkosten'-filter
                  const kostenD = DB.where(KEYS.KOSTEN, k => k.dossier_id === d.id) || [];
                  const heeftOpenKosten = kostenD.some(k => !k.betaald && Number(k.bedrag) > 0);
                  const persoonNamen = Array.isArray(d.extra_personeel) ? d.extra_personeel.join('|') : '';
                  return `<tr data-id="${d.id}"
                    class="${missend.length ? 'is-incompleet' : ''}"
                    data-opdrachtgever="${esc((d.opdrachtgever_naam || '').toLowerCase())}"
                    data-kist="${esc((d.kist_type || '').toLowerCase())}"
                    data-rouwauto="${esc((d.rouwauto || '').toLowerCase())}"
                    data-personeel="${esc(persoonNamen.toLowerCase())}"
                    data-onvolledig="${missend.length ? '1' : '0'}"
                    data-openkosten="${heeftOpenKosten ? '1' : '0'}"
                    data-geenkist="${d.kist_type ? '0' : '1'}">
                  <td><a href="#/dossiers/${d.id}" class="dossier-link">${esc(d.dossier_nummer)}</a></td>
                  <td><strong>${esc(fullName(d) || '—')}</strong> ${warn}</td>
                  <td>${esc(d.opdrachtgever_naam || '—')}</td>
                  <td>${esc(fmtDate(d.overlijdensdatum) || '—')}</td>
                  <td>${dossierStatusBadge(d.status)}</td>
                  <td><span class="muted small" title="${esc(d.updated_at ? new Date(d.updated_at).toLocaleString('nl-NL') : '')}">${esc(fmtRelative(d.updated_at || d.created_at))}${d.bijgewerkt_door ? '<br>- ' + esc(d.bijgewerkt_door) : ''}</span></td>
                  <td class="dossiers-chevron" aria-hidden="true">›</td>
                </tr>`;
                }).join('')}
              </tbody>
            </table>
          </div>`}
    </div>`;

  const navigeerFilter = (f) => {
    const params = new URLSearchParams();
    if (f.q.value) params.set('q', f.q.value);
    if (f.status.value) params.set('status', f.status.value);
    location.hash = '#/dossiers' + (params.toString() ? '?' + params.toString() : '');
  };
  $('#filter-form').addEventListener('submit', e => {
    e.preventDefault();
    navigeerFilter(e.target);
  });
  // Statuskeuze meteen toepassen
  const statusSel = $('#dossiers-status');
  if (statusSel) statusSel.addEventListener('change', () => navigeerFilter(statusSel.form));

  // Live filteren: zoekterm + checkbox-filters worden direct in de DOM
  // toegepast, geen re-render. Submit (Enter) commit alleen de zoekterm
  // + status naar de URL, zodat delen/back blijft werken.
  const zoekInput = $('#filter-form input[type="search"]');
  const rijen = $$('#view tbody tr[data-id]');
  const _me = (typeof Auth !== 'undefined' && Auth.current()) || {};
  const mijnNaam = (_me.fullName || _me.email || '').trim();
  const filterPaneel = $('#dossiers-filter-paneel');

  function pasFiltersToe() {
    const term = zoekInput ? zoekInput.value.trim().toLowerCase() : '';
    // Verzamel actieve checkbox-filters per dimensie.
    const actief = {};
    if (filterPaneel) {
      filterPaneel.querySelectorAll('input[type=checkbox]:checked').forEach(cb => {
        const dim = cb.getAttribute('data-filter');
        (actief[dim] = actief[dim] || []).push(cb.value);
      });
    }
    const heeft = (dim) => Array.isArray(actief[dim]) && actief[dim].length > 0;
    const bevat = (dim, val) => actief[dim].some(v => (val || '').toLowerCase() === v.toLowerCase());

    let zichtbaar = 0;
    rijen.forEach(tr => {
      let match = true;
      if (term && !tr.textContent.toLowerCase().includes(term)) match = false;
      if (match && actief.onvolledig)  match = tr.dataset.onvolledig === '1';
      if (match && actief.openkosten)  match = tr.dataset.openkosten === '1';
      if (match && actief.geenkist)    match = tr.dataset.geenkist === '1';
      if (match && actief.mijnzaken)   match = mijnNaam && (tr.dataset.personeel || '').includes(mijnNaam.toLowerCase());
      if (match && heeft('opdrachtgever')) match = bevat('opdrachtgever', tr.dataset.opdrachtgever);
      if (match && heeft('kist'))          match = bevat('kist', tr.dataset.kist);
      if (match && heeft('rouwauto'))      match = bevat('rouwauto', tr.dataset.rouwauto);
      if (match && heeft('personeel'))     match = actief.personeel.some(n => (tr.dataset.personeel || '').includes(n.toLowerCase()));
      tr.hidden = !match;
      if (match) zichtbaar++;
    });

    // Filter-badge bijwerken
    const totActief = Object.values(actief).reduce((s, arr) => s + arr.length, 0);
    const badge = $('#dossiers-filter-count');
    if (badge) {
      badge.hidden = totActief === 0;
      badge.textContent = totActief > 0 ? totActief : '';
    }
    const resTekst = $('#dfilter-resultaat');
    if (resTekst) resTekst.textContent = `${zichtbaar} dossier${zichtbaar === 1 ? '' : 's'} zichtbaar`;

    // Leeg-state onder de tabel tonen/verbergen
    let legeMelding = $('#dossiers-live-leeg');
    if (zichtbaar === 0 && (term || totActief > 0)) {
      if (!legeMelding) {
        const kaart = $('.dossiers-kaart');
        if (kaart) {
          legeMelding = document.createElement('p');
          legeMelding.id = 'dossiers-live-leeg';
          legeMelding.className = 'muted center';
          legeMelding.style.padding = '1.5rem';
          legeMelding.textContent = 'Geen dossiers gevonden met deze filters.';
          kaart.appendChild(legeMelding);
        }
      }
    } else if (legeMelding) {
      legeMelding.remove();
    }
  }

  if (zoekInput) zoekInput.addEventListener('input', pasFiltersToe);

  // Filter-paneel toggle
  const filterToggle = $('#dossiers-filter-toggle');
  if (filterToggle && filterPaneel) {
    filterToggle.addEventListener('click', () => {
      const open = !filterPaneel.hidden;
      filterPaneel.hidden = open;
      filterToggle.setAttribute('aria-expanded', open ? 'false' : 'true');
    });
    filterPaneel.addEventListener('change', pasFiltersToe);
    const wisBtn = $('#dfilter-wis');
    if (wisBtn) wisBtn.addEventListener('click', () => {
      filterPaneel.querySelectorAll('input[type=checkbox]').forEach(cb => { cb.checked = false; });
      pasFiltersToe();
    });
  }

  // Hele rij klikbaar → naar dossier-detail (behalve op links/knoppen)
  $$('#view tr[data-id]').forEach(tr => {
    tr.addEventListener('click', e => {
      if (e.target.closest('a, button')) return;
      Router.go('/dossiers/' + tr.getAttribute('data-id'));
    });
  });
}

function renderAccount(msg) {
  const u = Auth.current();
  // Alleen beheerders mogen bij de account-instellingen. Medewerkers krijgen
  // een korte melding — hun profiel-instellingen (naam / wachtwoord) doen we
  // niet in deze view; die kunnen via een beheerder.
  if (typeof Auth !== 'undefined' && !Auth.isBeheerder()) {
    $('#view').innerHTML = `
      <div class="page">
        <div class="page-head"><h1>Mijn account</h1></div>
        <section class="card narrow">
          <p>Account-instellingen zijn alleen beschikbaar voor beheerders. Neem contact op met een beheerder als je iets wilt aanpassen.</p>
          <p class="muted small">Ingelogd als: <strong>${esc(u && u.email || '')}</strong></p>
          <div class="form-actions" style="margin-top:1rem;">
            <button type="button" class="btn" id="btn-medewerker-logout">Uitloggen</button>
          </div>
        </section>
      </div>`;
    const bo = document.getElementById('btn-medewerker-logout');
    if (bo) bo.addEventListener('click', async () => {
      const ok = await Modal.confirm({
        type: 'warning',
        title: 'Uitloggen?',
        message: 'Weet je zeker dat je wilt uitloggen?',
        confirmText: 'Uitloggen',
        cancelText: 'Annuleren',
      });
      if (!ok) return;
      try { await Auth.logout(); } catch (_) {}
      Router.go('/');
    });
    return;
  }
  // Instellingen op functieniveau beschikbaar. Losse secties definiëren hun
  // eigen `s` in een IIFE; de Factuur-sectie leunt op deze buitenste `s`.
  const s = Settings.all();
  $('#view').innerHTML = `
    <div class="page">
      <div class="page-head"><h1>Mijn account</h1></div>

      <nav class="account-nav" aria-label="Snelnavigatie instellingen">
        <a href="#/account#acc-versie">App &amp; updates</a>
        <a href="#/account#acc-gegevens">Mijn gegevens</a>
        <a href="#/account#acc-wachtwoord">Wachtwoord</a>
        <a href="#/account#acc-weergave">Weergave</a>
        <a href="#/account#acc-branding">Branding</a>
        <a href="#/account#login-instellingen">Loginscherm</a>
        <a href="#/account#acc-welkom">Welkomscherm</a>
        <a href="#/account#email-instellingen">E-mail</a>
        <a href="#/account#factuur-instellingen">Factuur</a>
        <a href="#/account#push-instellingen">Push-notificaties</a>
        <a href="#/account#snelstart-instellingen">SnelStart</a>
        <a href="#/account#kostenposten">Kostenposten</a>
        <a href="#/account#profielen">Profielen</a>
        <a href="#/account#opdrachtgevers">Opdrachtgevers</a>
        <a href="#/account#acc-data">Data &amp; sync</a>
        <a href="#/logboek">Logboek</a>
      </nav>

      <section class="card narrow" id="acc-versie">
        <h2>App-versie &amp; updates</h2>
        <dl class="dl">
          <div><dt>Huidige versie</dt><dd><strong id="cur-version">${esc(APP_VERSION)}</strong> — ${esc(APP_BUILD_DATE)}</dd></div>
          <div><dt>Service worker</dt><dd id="sw-status" class="muted small">${'serviceWorker' in navigator ? 'actief' : 'niet beschikbaar'}</dd></div>
          ${(typeof Native !== 'undefined' && Native.isApp()) ? '<div><dt>Documentscanner</dt><dd id="scanner-status" class="muted small">controleren…</dd></div>' : ''}
          ${(typeof Native !== 'undefined' && Native.isApp()) ? '<div><dt>Live Activity</dt><dd id="la-status" class="muted small">controleren…</dd></div>' : ''}
          ${(typeof Native !== 'undefined' && Native.isApp() && Native.platform && Native.platform() === 'android') ? '<div><dt>Google-diensten</dt><dd id="gs-status" class="muted small">controleren…</dd></div>' : ''}
        </dl>
        ${(typeof Native !== 'undefined' && Native.isApp()) ? `
          <div class="form-actions" style="justify-content:flex-start;gap:.5rem;flex-wrap:wrap;margin:.25rem 0 .75rem;">
            <button type="button" class="btn btn-sm" id="btn-la-test">▶︎ Test Live Activity</button>
            <button type="button" class="btn btn-sm btn-ghost" id="btn-la-stop">Stop</button>
          </div>
          <div id="la-test-result" class="muted small" style="margin-bottom:.5rem;"></div>
          ${Native.platform && Native.platform() === 'android' ? `
            <div class="form-actions" style="justify-content:flex-start;gap:.5rem;flex-wrap:wrap;margin:.25rem 0 .5rem;">
              <button type="button" class="btn btn-sm" id="btn-gs-install">🛠 Zet alle Google-diensten aan</button>
            </div>
            <p class="muted small" style="margin-bottom:.75rem;">Vraagt Google Play Services om álle optionele modules (nu: documentscanner) én toekomstige uitbreidingen te downloaden en te activeren. Handig als je de vraag eerder hebt weggeklikt.</p>
            <div id="gs-install-result" class="muted small" style="margin-bottom:.5rem;"></div>
          ` : ''}
        ` : ''}
        <div id="update-result"></div>
        <div class="form-actions" style="justify-content:flex-start;gap:.5rem;flex-wrap:wrap;">
          <button type="button" class="btn btn-primary" id="btn-check-update">Check op updates</button>
          <button type="button" class="btn btn-ghost" id="btn-hard-reset" title="Wis alle lokale cache en service-worker, en herlaad alles vanaf de server">🧹 Reset volledig</button>
        </div>
        <p class="muted small" style="margin-top:.5rem;">
          <strong>Check op updates</strong> haalt de laatste versie binnen.<br>
          <strong>Reset volledig</strong> gebruik je alleen als de app vast blijft hangen op een oude versie — dossiers blijven veilig staan, alleen de offline-kopie wordt gewist.
        </p>
      </section>

      <section class="card narrow" id="acc-gegevens">
        <h2>Mijn gegevens</h2>
        <form id="profile-form" class="form" autocomplete="off">
          <label>
            <span>Naam (verschijnt in de topbalk)</span>
            <input type="text" name="full_name" value="${esc(u.fullName === u.email ? '' : (u.fullName || ''))}" placeholder="bv. Kevin Aydin" maxlength="60">
          </label>
          <label>
            <span>E-mailadres (login)</span>
            <input type="email" name="email" value="${esc(u.email)}" placeholder="">
            <span class="muted small">Wijzigen vereist verificatie via een e-mail naar zowel het oude als nieuwe adres.</span>
          </label>
          <label>
            <span>Rol</span>
            <input type="text" value="${esc(u.role || '—')}" disabled>
          </label>
          <div class="form-actions" style="justify-content:flex-end;">
            <button type="submit" class="btn btn-primary">Opslaan</button>
          </div>
        </form>
      </section>
      <section class="card narrow" id="acc-wachtwoord">
        <h2>Wachtwoord wijzigen</h2>
        ${msg && msg.error ? `<div class="alert alert-error">${esc(msg.error)}</div>` : ''}
        ${msg && msg.success ? `<div class="alert alert-success">${esc(msg.success)}</div>` : ''}
        <form id="pw-form" class="form" autocomplete="off">
          <label><span>Nieuw wachtwoord</span><input type="password" name="nieuw" required minlength="8" autocomplete="new-password"></label>
          <label><span>Herhaal nieuw wachtwoord</span><input type="password" name="herhaal" required minlength="8" autocomplete="new-password"></label>
          <button type="submit" class="btn btn-primary">Wachtwoord wijzigen</button>
        </form>
      </section>
      <section class="card narrow" id="acc-branding">
        <h2>Branding</h2>
        <p class="muted small">Logo, naam en kleuren van de app aanpassen.</p>
        ${(() => {
          const s = Settings.all();
          return `
          <form id="brand-form" class="form" autocomplete="off">
            <label>
              <span>App-naam</span>
              <input type="text" name="app_name" value="${esc(s.app_name)}" maxlength="60">
            </label>
            <label>
              <span>Ondertitel / organisatie</span>
              <input type="text" name="app_tagline" value="${esc(s.app_tagline)}" maxlength="120">
            </label>

            <div class="grid-2" style="gap:.85rem;">
              <label>
                <span>Hoofdkleur</span>
                <input type="color" name="primary_color" value="${esc(s.primary_color)}">
              </label>
              <label>
                <span>Accentkleur</span>
                <input type="color" name="accent_color" value="${esc(s.accent_color)}">
              </label>
            </div>

            <label>
              <span>Logo (jpg/png/svg, max 1 MB)</span>
              <span class="muted small" style="margin-bottom:.35rem;display:block;">
                Wordt gebruikt in de app, als <strong>favicon</strong> in het browsertabblad én als <strong>homescreen-icoon</strong> wanneer de app op een telefoon/desktop wordt geïnstalleerd. Voor reeds geïnstalleerde PWA's: kort verwijderen en opnieuw aan beginscherm toevoegen om het nieuwe icoon te zien.
              </span>
              <div class="logo-row">
                <div class="logo-preview" id="logo-preview">
                  ${s.logo_data_url
                    ? `<img src="${esc(s.logo_data_url)}" alt="Logo">`
                    : '<span>OZN</span>'}
                </div>
                <div class="logo-actions">
                  <label class="btn btn-sm">Bestand kiezen<input type="file" name="logo_file" accept="image/*" hidden id="logo-input"></label>
                  ${s.logo_data_url ? '<button type="button" class="btn btn-sm btn-ghost" id="btn-remove-logo">Verwijder logo</button>' : ''}
                </div>
              </div>
            </label>

            <div class="form-actions" style="justify-content:space-between;">
              <button type="button" class="btn btn-ghost" id="btn-reset-brand">Standaardwaarden</button>
              <button type="submit" class="btn btn-primary">Opslaan</button>
            </div>
          </form>`;
        })()}
      </section>

      <section class="card narrow" id="login-instellingen">
        <h2>Loginscherm</h2>
        <p class="muted small">Pas de teksten en bullet-points aan die te zien zijn op het inlog-scherm. De achtergrondkleur volgt automatisch de hoofdkleur uit Branding.</p>
        ${(() => {
          const s = Settings.all();
          const feats = Array.isArray(s.login_brand_features) ? s.login_brand_features : [];
          return `
          <form id="login-form-settings" class="form" autocomplete="off">
            <label>
              <span>Titel (links, groot)</span>
              <input type="text" name="login_brand_title" value="${esc(s.login_brand_title)}" maxlength="80">
            </label>
            <label>
              <span>Onderschrift (links, onder titel)</span>
              <textarea name="login_brand_subtitle" rows="2" maxlength="280">${esc(s.login_brand_subtitle)}</textarea>
            </label>
            <label>
              <span>Bullet-points (links — één per regel)</span>
              <textarea name="login_brand_features" rows="5" placeholder="Eén regel = één bullet">${esc(feats.join('\n'))}</textarea>
              <span class="muted small">Lege regels worden overgeslagen. Gebruik voor productkenmerken, voordelen, korte beloftes.</span>
            </label>
            <label>
              <span>Voettekst (links, klein)</span>
              <input type="text" name="login_brand_foot" value="${esc(s.login_brand_foot)}" maxlength="120">
            </label>
            <hr style="border:none;border-top:1px solid var(--border);margin:.25rem 0;">
            <label>
              <span>Form-titel (rechts)</span>
              <input type="text" name="login_form_title" value="${esc(s.login_form_title)}" maxlength="40">
            </label>
            <label>
              <span>Form-ondertitel (rechts, onder titel)</span>
              <input type="text" name="login_form_subtitle" value="${esc(s.login_form_subtitle)}" maxlength="200">
            </label>
            <label>
              <span>Account-aanvraag-tekst (onderin het form)</span>
              <input type="text" name="login_secretariaat_text" value="${esc(s.login_secretariaat_text)}" maxlength="160">
            </label>
            <div class="form-actions" style="justify-content:space-between;">
              <button type="button" class="btn btn-ghost" id="btn-reset-login">Standaardwaarden</button>
              <button type="submit" class="btn btn-primary">Opslaan</button>
            </div>
          </form>`;
        })()}
      </section>

      <section class="card narrow" id="acc-weergave">
        <h2>Weergave</h2>
        ${(() => {
          const s = Settings.all();
          return `
          <form id="ui-form" class="form" autocomplete="off">
            <label>
              <span>Ontwerp</span>
              <select name="design_version">
                <option value="v1" ${(s.design_version||'v1')==='v1'?'selected':''}>v1 — klassieke bovenbalk (zoals vanouds)</option>
                <option value="v2" ${s.design_version==='v2'?'selected':''}>v2 — nieuw ontwerp met zijbalk</option>
              </select>
              <span class="muted small">Wissel tussen het nieuwe ontwerp met zijbalk (v2) en de vertrouwde bovenbalk-indeling (v1).</span>
            </label>

            <label>
              <span>Lettertype</span>
              <select name="font_id" id="font-select">
                ${FONTS.map(f => `<option value="${esc(f.id)}" ${s.font_id===f.id?'selected':''}>${esc(f.label)}</option>`).join('')}
              </select>
              <span class="muted small">Niet-systeemfonts worden geladen via Google Fonts en daarna lokaal gecached (werken ook offline na de eerste keer).</span>
            </label>

            <label>
              <span>Formulier-dichtheid</span>
              <select name="form_density">
                <option value="compact"    ${s.form_density==='compact'?'selected':''}>Compact (kleinere velden, dichter op elkaar)</option>
                <option value="normaal"    ${(s.form_density||'normaal')==='normaal'?'selected':''}>Normaal — aanbevolen</option>
                <option value="ruim"       ${s.form_density==='ruim'?'selected':''}>Ruim (grotere velden, meer ruimte tussen rijen)</option>
                <option value="extraruim"  ${s.form_density==='extraruim'?'selected':''}>Extra ruim (max grote velden, voor tablets en touchscreens)</option>
              </select>
              <span class="muted small">Past de grootte van invulvelden en spacing in formulieren aan.</span>
            </label>
            <div class="font-preview" id="font-preview">
              <h3 style="margin:0 0 .25rem;">Overledenenzorg Nederland</h3>
              <p style="margin:0;">Voorbeeldtekst — zo ziet dit lettertype eruit in de app. <em>Dossier 2026-001</em> · opbaren, verzorging en vervoer op één plek.</p>
            </div>
            <label class="checkbox-inline" style="font-size:.95rem;">
              <input type="checkbox" name="compact_mode" ${s.compact_mode ? 'checked' : ''}>
              Compact-modus (kleinere tekst en meer informatie per scherm)
            </label>
            <label class="checkbox-inline" style="font-size:.95rem;">
              <input type="checkbox" name="rounded_cards" ${s.rounded_cards ? 'checked' : ''}>
              Afgeronde hoeken (uit = strakke vierkante stijl)
            </label>
            <label class="checkbox-inline" style="font-size:.95rem;">
              <input type="checkbox" name="catalog_admin_mode" ${s.catalog_admin_mode ? 'checked' : ''}>
              Beheermodus voor de kistencatalogus (toont knoppen om foto's te vervangen en prijzen aan te passen)
            </label>
            <label class="checkbox-inline" style="font-size:.95rem;">
              <input type="checkbox" name="dossier_admin_mode" ${s.dossier_admin_mode ? 'checked' : ''}>
              Beheermodus voor dossier-labels (klik op titels/knop-teksten in het intake-formulier om ze te hernoemen)
            </label>
            <div class="form-actions" style="justify-content:flex-end;">
              <button type="submit" class="btn btn-primary">Opslaan</button>
            </div>
          </form>`;
        })()}
      </section>

      <section class="card narrow" id="email-instellingen">
        <h2>E-mail verzenden (server-side)</h2>
        <p class="muted small">
          De app stuurt e-mails direct via <strong>Brevo</strong> (voorheen
          Sendinblue) vanuit een geverifieerd adres. Werkt met elk e-mailadres
          (ook @hotmail.com/@gmail.com) na een simpele click-verificatie.
          Geen mail-app openen, geen 2FA-gedoe.
        </p>
        <details style="margin: .5rem 0 1rem;">
          <summary style="cursor:pointer; font-weight:600;">Eenmalige serversetup (beheerder)</summary>
          <ol class="muted small" style="padding-left:1.5rem; line-height:1.55; margin-top:.5rem;">
            <li>Maak een gratis account op <a href="https://www.brevo.com" target="_blank" rel="noopener">brevo.com</a> (300 mails/dag gratis).</li>
            <li>Ga naar <strong>Senders, Domains &amp; Dedicated IPs</strong> → <em>Senders</em> → <em>Add a sender</em>. Vul je e-mailadres in (bv. <code>ozndossier@hotmail.com</code>). Brevo stuurt je een verificatiemail — klik de link.</li>
            <li>Ga naar <strong>SMTP &amp; API</strong> → tab <em>API Keys</em> → <em>Generate a new API key</em>. Kopieer 'm.</li>
            <li>Stel de secrets in bij Supabase (Project Settings → Edge Functions → Secrets):
              <pre style="background:#f6f4ef;padding:.5rem .75rem;border-radius:6px;overflow-x:auto;">BREVO_API_KEY   = xkeysib-xxxxx...
EMAIL_FROM      = ozndossier@hotmail.com
EMAIL_FROM_NAME = OZN</pre>
            </li>
            <li>Test onderaan met <em>Test verzenden</em>.</li>
          </ol>
          <p class="muted small" style="margin-top:.5rem;">
            Brevo-limieten: 300 mails/dag gratis (geen dagcap in Edge Function; deze zit ingebouwd op 60/uur/user).
          </p>
        </details>

        ${(() => {
          const s = Settings.all();
          return `
          <form id="email-form" class="form" autocomplete="off">
            <label>
              <span>📧 Auto-mail dossier bij opslaan naar</span>
              <input type="email" name="auto_send_dossier_email" value="${esc(s.auto_send_dossier_email)}" placeholder="leeg = uit">
              <span class="muted small">Elke keer dat een dossier wordt aangemaakt of bewerkt, wordt er automatisch een kopie verstuurd naar dit adres. Laat leeg om uit te schakelen.</span>
            </label>
            <label><span>Test-e-mailadres (voor verificatie)</span><input type="email" name="email_test_to" placeholder="bv. je eigen e-mail"></label>
            <div id="email-test-result"></div>
            <div class="form-actions" style="justify-content:space-between;">
              <button type="button" class="btn btn-ghost" id="btn-email-test">Test verzenden</button>
              <button type="submit" class="btn btn-primary">Opslaan</button>
            </div>
          </form>`;
        })()}
      </section>

      <section class="card narrow" id="email-footer-instellingen">
        <h2>E-mail handtekening / footer</h2>
        <p class="muted small">Donker balkje onderaan élke verzonden mail (dossier &amp; factuur). Laat een veld leeg om dat onderdeel weg te laten.</p>
        ${(() => {
          const s = Settings.all();
          return `
          <form id="email-footer-form" class="form" autocomplete="off">
            <label class="checkbox-inline" style="font-size:.95rem;">
              <input type="checkbox" name="email_footer_enabled" ${s.email_footer_enabled ? 'checked' : ''}>
              Footer toevoegen aan uitgaande e-mails
            </label>
            <label>
              <span>Adres (één regel)</span>
              <input type="text" name="email_footer_address" value="${esc(s.email_footer_address)}" placeholder="OZN Vastgoed B.V. · Oldenzaal" maxlength="200">
            </label>
            <div class="grid-2" style="gap:.85rem;">
              <label>
                <span>Telefoon</span>
                <input type="tel" name="email_footer_phone" value="${esc(s.email_footer_phone)}" placeholder="bv. 053 538 4054">
              </label>
              <label>
                <span>E-mail</span>
                <input type="email" name="email_footer_email" value="${esc(s.email_footer_email)}" placeholder="info@ozn.nl">
              </label>
              <label class="span-2">
                <span>Website</span>
                <input type="text" name="email_footer_website" value="${esc(s.email_footer_website)}" placeholder="www.ozn.nl">
              </label>
              <label>
                <span>Algemene Voorwaarden (URL)</span>
                <input type="url" name="email_footer_terms_url" value="${esc(s.email_footer_terms_url)}" placeholder="https://...">
              </label>
              <label>
                <span>Privacy Voorwaarden (URL)</span>
                <input type="url" name="email_footer_privacy_url" value="${esc(s.email_footer_privacy_url)}" placeholder="https://...">
              </label>
              <label>
                <span>Facebook (URL)</span>
                <input type="url" name="email_footer_facebook_url" value="${esc(s.email_footer_facebook_url)}" placeholder="https://facebook.com/...">
              </label>
              <label>
                <span>Instagram (URL)</span>
                <input type="url" name="email_footer_instagram_url" value="${esc(s.email_footer_instagram_url)}" placeholder="https://instagram.com/...">
              </label>
            </div>
            <div class="form-actions" style="justify-content:flex-end;">
              <button type="submit" class="btn btn-primary">Opslaan</button>
            </div>
          </form>`;
        })()}
      </section>

      <section class="card narrow" id="factuur-instellingen">
        <h2>Factuurgegevens</h2>
        <p class="muted small">Deze gegevens staan bovenaan de PDF-factuur (bedrijfskop + betaalgegevens).</p>
        <form id="factuur-form" class="form" autocomplete="off">
          <label><span>Bedrijfsnaam</span><input type="text" name="factuur_bedrijfsnaam" value="${esc(s.factuur_bedrijfsnaam || '')}"></label>
          <label><span>Adres (2 regels toegestaan)</span><textarea name="factuur_adres" rows="2">${esc(s.factuur_adres || '')}</textarea></label>
          <div class="grid-2" style="gap:.75rem;">
            <label><span>Telefoon</span><input type="text" name="factuur_telefoon" value="${esc(s.factuur_telefoon || '')}"></label>
            <label><span>E-mail</span><input type="text" name="factuur_email" value="${esc(s.factuur_email || '')}"></label>
          </div>
          <label><span>IBAN</span><input type="text" name="factuur_iban" value="${esc(s.factuur_iban || '')}"></label>
          <div class="grid-3" style="gap:.75rem;">
            <label><span>Btw-nr</span><input type="text" name="factuur_btw" value="${esc(s.factuur_btw || '')}"></label>
            <label><span>KvK</span><input type="text" name="factuur_kvk" value="${esc(s.factuur_kvk || '')}"></label>
            <label><span>Betalingstermijn (dagen)</span><input type="number" name="factuur_betalingstermijn_dagen" value="${esc(s.factuur_betalingstermijn_dagen || 30)}" min="0" step="1"></label>
          </div>
          <div class="form-actions" style="justify-content:space-between;align-items:center;">
            <span class="muted small">Laatste factuurnummer: <strong>${esc(Settings.get('factuur_volgnr') || 0)}</strong></span>
            <button type="submit" class="btn btn-primary">Opslaan</button>
          </div>
        </form>
      </section>

      <section class="card narrow" id="push-instellingen">
        <h2>Push-notificaties</h2>
        <p class="muted small">
          Krijg een melding op je telefoon/iPad wanneer er een uitvaart aankomt (standaard 1 dag van tevoren).
          Werkt op Chrome, Safari (iOS 16.4+, app moet 'op beginscherm' staan) en Android.
        </p>
        <div id="push-status" class="alert" style="margin-bottom:.75rem;">Laden…</div>
        ${(() => {
          const s = Settings.all();
          return `
          <form id="push-form" class="form" autocomplete="off">
            <label>
              <span>VAPID public key</span>
              <input type="text" name="push_vapid_public_key" value="${esc(s.push_vapid_public_key)}" placeholder="bv. BNb1...long base64-url string">
              <span class="muted small">Eenmalig in te stellen. Zie <code>docs/push-setup.md</code> voor hoe je deze sleutels maakt.</span>
            </label>
            <label>
              <span>Aantal dagen vooraf herinneren</span>
              <input type="number" name="push_remind_days_ahead" value="${esc(s.push_remind_days_ahead)}" min="0" max="14" step="1">
            </label>
            <div class="form-actions" style="justify-content:space-between;gap:.5rem;flex-wrap:wrap;">
              <div style="display:flex;gap:.5rem;flex-wrap:wrap;">
                <button type="button" class="btn btn-ghost" id="btn-push-enable">🔔 Inschakelen op dit apparaat</button>
                <button type="button" class="btn btn-ghost" id="btn-push-disable" hidden>🔕 Uitschakelen</button>
                <button type="button" class="btn btn-ghost" id="btn-push-test">Test-melding</button>
              </div>
              <button type="submit" class="btn btn-primary">Opslaan</button>
            </div>
          </form>`;
        })()}
      </section>

      <section class="card narrow" id="snelstart-instellingen">
        <h2>SnelStart-koppeling (boekhouding)</h2>
        <p class="muted small">
          Koppel je SnelStart-administratie om straks facturen/boekingen te kunnen versturen.
          Vraag in je SnelStart-account de <strong>B2B API-sleutels</strong> aan: een
          <strong>Subscription key</strong> (API-gateway) en een <strong>Client key</strong>
          (per administratie). Vul ze hieronder in en klik op <strong>Test verbinding</strong>.
        </p>
        ${(() => {
          const s = Settings.all();
          return `
          <form id="snelstart-form" class="form" autocomplete="off">
            <label class="checkbox-inline" style="font-size:.95rem;">
              <input type="checkbox" name="snelstart_actief" ${s.snelstart_actief ? 'checked' : ''}>
              Koppeling actief
            </label>
            <label>
              <span>Subscription key</span>
              <input type="password" name="snelstart_subscription_key" value="${esc(s.snelstart_subscription_key)}" placeholder="Ocp-Apim-Subscription-Key" autocomplete="off">
            </label>
            <label>
              <span>Client key</span>
              <input type="password" name="snelstart_client_key" value="${esc(s.snelstart_client_key)}" placeholder="clientkey van je administratie" autocomplete="off">
              <span class="muted small">De sleutels worden veilig in de cloud-instellingen bewaard en alleen via een beveiligde server-functie naar SnelStart gestuurd (nooit rechtstreeks vanuit de browser).</span>
            </label>
            <div id="snelstart-result"></div>
            <div class="form-actions" style="justify-content:space-between;gap:.5rem;flex-wrap:wrap;">
              <button type="button" class="btn btn-ghost" id="btn-snelstart-test">⇄ Test verbinding</button>
              <button type="submit" class="btn btn-primary">Opslaan</button>
            </div>
          </form>`;
        })()}
      </section>

      <section class="card narrow" id="profielen">
        <h2>Profielen — "Wie werkt vandaag?"</h2>
        <p class="muted small">De namen die verschijnen op het profielkeuze-scherm. Elke profiel heeft ook een <strong>rol</strong> — die bepaalt of dat profiel prijzen en archief mag zien. Een medewerker-profiel op een beheerder-account krijgt de medewerker-view.</p>
        ${(() => {
          const lijst = (Settings.get('profielen') || []);
          return `
          <form id="profielen-form" class="form" autocomplete="off">
            <p class="muted small" style="margin:0 0 .5rem;">Beheerder-profielen kunnen een 4- of 6-cijferige pincode krijgen. De pincode wordt gevraagd zodra iemand op het profiel tikt bij "Wie werkt vandaag?". Elke beheerder kan alleen z'n eigen pincode wijzigen — de andere pincodes staan op slot.</p>
            <div id="profielen-rows" class="profielen-rows">
              ${(() => {
                const actiefId = (ActiveProfile.current() || {}).id;
                return lijst.map((p, i) => {
                  const isEigen = actiefId && p.id === actiefId;
                  const heeftPin = !!(p.pincode);
                  // Zichtbare waarde: alleen bij eigen profiel de echte pincode
                  // tonen; bij andermans profielen tonen we asterisken (of leeg)
                  // en staat het veld op read-only zodat je hem niet kunt wissen.
                  const shownPin = isEigen ? (p.pincode || '') : (heeftPin ? '••••' : '');
                  const pinAttrs = isEigen
                    ? ''
                    : 'readonly tabindex="-1" title="Alleen de eigenaar van dit profiel kan de pincode wijzigen"';
                  return `
                <div class="profielen-row" data-idx="${i}" data-profiel-id="${esc(p.id)}">
                  <span class="profielen-avatar" style="background:${esc(p.color || '#6b1e2a')};">${esc((p.name || '?').charAt(0).toUpperCase())}</span>
                  <input type="text" class="profielen-naam" value="${esc(p.name || '')}" placeholder="Naam" maxlength="40">
                  <select class="profielen-rol" title="Rol van dit profiel">
                    <option value="medewerker" ${p.rol !== 'beheerder' ? 'selected' : ''}>Medewerker</option>
                    <option value="beheerder" ${p.rol === 'beheerder' ? 'selected' : ''}>Beheerder</option>
                  </select>
                  <input type="text" inputmode="numeric" pattern="[0-9]{0,6}" maxlength="6" class="profielen-pincode" value="${esc(shownPin)}" placeholder="pincode" ${pinAttrs} style="width:6rem;${p.rol === 'beheerder' ? '' : 'visibility:hidden;'}${isEigen ? '' : 'background:#f0ede4;color:var(--muted);cursor:not-allowed;'}">
                  <input type="color" class="profielen-kleur" value="${esc(p.color || '#6b1e2a')}" title="Kleur van de avatar">
                  <button type="button" class="btn-icon" data-action="del-profiel" data-idx="${i}" title="Verwijderen">×</button>
                </div>`;
                }).join('');
              })()}
            </div>
            <div class="form-actions" style="justify-content:space-between;">
              <button type="button" class="btn btn-ghost" id="btn-add-profiel">+ Profiel toevoegen</button>
              <button type="submit" class="btn btn-primary">Opslaan</button>
            </div>
          </form>`;
        })()}
      </section>

      ${Auth.isBeheerder() ? `
      <section class="card narrow" id="rollen">
        <h2>Medewerkers &amp; rollen</h2>
        <p class="muted small">Beheerders zien alles. Medewerkers zien geen afgesloten dossiers en geen prijzen.</p>
        <details style="margin-bottom:.75rem;">
          <summary style="cursor:pointer; font-weight:600; color:var(--primary,#2563eb);">+ Nieuwe medewerker toevoegen</summary>
          <form id="nieuwe-medewerker-form" class="form" autocomplete="off" style="margin-top:.5rem; display:flex; flex-direction:column; gap:.5rem;">
            <label><span>Naam</span><input type="text" name="naam" required placeholder="bv. Rume"></label>
            <label><span>E-mail</span><input type="email" name="email" required placeholder="rume@ozn.nl"></label>
            <label><span>Tijdelijk wachtwoord <span class="muted small">(min. 8 tekens — deel per SMS/mondeling met de medewerker)</span></span>
              <input type="text" name="password" required minlength="8" placeholder="min. 8 tekens">
            </label>
            <label><span>Rol</span>
              <select name="rol">
                <option value="medewerker" selected>Medewerker</option>
                <option value="beheerder">Beheerder</option>
              </select>
            </label>
            <div class="form-actions" style="justify-content:flex-end;">
              <button type="submit" class="btn btn-primary">Account aanmaken</button>
            </div>
            <div id="nieuwe-medewerker-status" class="muted small"></div>
          </form>
        </details>
        ${(() => {
          const lijst = DB.list(KEYS.PROFIELEN) || [];
          const mij = (Auth.current() || {}).id;
          if (!lijst.length) return '<p class="muted">Nog geen accounts geladen.</p>';
          return `<form id="rollen-form" class="form" autocomplete="off">
            <div style="display:flex; flex-direction:column; gap:.5rem;">
              ${lijst.map(p => `
                <div class="parochie-row" style="align-items:center;">
                  <span style="flex:1;">${esc(p.naam || p.id)}${p.id === mij ? ' <span class="muted small">(jij)</span>' : ''}</span>
                  <select class="rol-select" data-id="${esc(p.id)}" ${p.id === mij ? 'disabled title="Je kunt je eigen rol niet wijzigen"' : ''}>
                    <option value="medewerker" ${p.rol === 'medewerker' ? 'selected' : ''}>Medewerker</option>
                    <option value="beheerder" ${p.rol === 'beheerder' ? 'selected' : ''}>Beheerder</option>
                  </select>
                </div>`).join('')}
            </div>
            <div class="form-actions" style="justify-content:flex-end; margin-top:.75rem;">
              <button type="submit" class="btn btn-primary">Rollen opslaan</button>
            </div>
          </form>`;
        })()}
      </section>` : ''}

      ${(typeof Auth !== 'undefined' && Auth.isBeheerder()) ? `
      <section class="card narrow" id="cloud-storage">
        <h2>Cloudflare R2 (dossier-opslag)</h2>
        <p class="muted small">10 GB opslag voor dossier-PDF's, foto's en scans op Cloudflare R2 (EU-jurisdictie). Nieuwe uploads gaan automatisch naar R2. Bestaande bestanden staan nog op Supabase Storage tot je ze migreert.</p>
        <div class="form-actions" style="justify-content:space-between; align-items:center; flex-wrap:wrap; gap:.5rem;">
          <span id="r2-test-status" class="muted small">Klik Testen om de verbinding te checken.</span>
          <button type="button" class="btn btn-ghost btn-sm" id="btn-r2-test">🔌 Test R2-verbinding</button>
        </div>
        <hr style="margin:.85rem 0; border:none; border-top:1px solid var(--border,#e5e0d6);">
        ${(() => {
          const werk = (typeof R2Migratie !== 'undefined') ? R2Migratie.verzamel().length : 0;
          const rework = (typeof R2Reorg !== 'undefined') ? R2Reorg.verzamel().length : 0;
          return `
            <p class="small" style="margin:0 0 .5rem;">
              <strong>Migratie Supabase Storage → R2</strong><br>
              <span class="muted">Verplaatst alle bestaande dossier-bestanden (artsverklaringen, overdraagformulieren, bezittingen-foto's) naar R2 en verwijdert ze uit Supabase Storage.</span>
            </p>
            <div class="form-actions" style="justify-content:space-between; align-items:center; flex-wrap:wrap; gap:.5rem;">
              <span id="r2-migratie-status" class="muted small">${werk === 0 ? '✓ Alles staat al op R2.' : `${werk} bestand${werk === 1 ? '' : 'en'} nog op Supabase Storage.`}</span>
              <button type="button" class="btn ${werk === 0 ? 'btn-ghost' : ''}" id="btn-r2-migreer" ${werk === 0 ? 'disabled' : ''}>${werk === 0 ? 'Niks te migreren' : `🚀 Migreer ${werk} naar R2`}</button>
            </div>
            <div id="r2-migratie-log" class="muted small" style="margin-top:.5rem; max-height:200px; overflow-y:auto; font-family:monospace; font-size:.72rem; white-space:pre-wrap;"></div>
            <hr style="margin:.85rem 0; border:none; border-top:1px solid var(--border,#e5e0d6);">
            <p class="small" style="margin:0 0 .5rem;">
              <strong>Opnieuw ordenen op dossier</strong><br>
              <span class="muted">Verplaatst losse R2-bestanden naar submap per dossier (bv. artsverklaring/Achternaam_D42/). Server-side kopie, snel.</span>
            </p>
            <div class="form-actions" style="justify-content:space-between; align-items:center; flex-wrap:wrap; gap:.5rem;">
              <span id="r2-reorg-status" class="muted small">${rework === 0 ? '✓ Alles staat al in de juiste submap.' : `${rework} bestand${rework === 1 ? '' : 'en'} nog los.`}</span>
              <button type="button" class="btn ${rework === 0 ? 'btn-ghost' : ''}" id="btn-r2-reorg" ${rework === 0 ? 'disabled' : ''}>${rework === 0 ? 'Niks te ordenen' : `📁 Order ${rework} in submappen`}</button>
            </div>
            <div id="r2-reorg-log" class="muted small" style="margin-top:.5rem; max-height:200px; overflow-y:auto; font-family:monospace; font-size:.72rem; white-space:pre-wrap;"></div>
          `;
        })()}
      </section>

      <section class="card narrow" id="archief">
        <h2>Archief</h2>
        <p class="muted small">Dossiers kunnen handmatig gearchiveerd worden vanuit het detailscherm. Wil je dat afgehandelde dossiers (rouwauto geweest + alle datums voorbij) automatisch naar het archief gaan? Zet 't hieronder aan. Medewerkers zien het archief niet — tenzij je dat toestaat (server-side afgedwongen).</p>
        <form id="archief-form" class="form" autocomplete="off">
          <label class="checkbox-inline"><input type="checkbox" name="auto_archief_actief" ${Settings.get('auto_archief_actief') ? 'checked' : ''}> Automatisch archiveren aanzetten <span class="muted small">(standaard uit)</span></label>
          <label class="checkbox-inline"><input type="checkbox" name="medewerker_ziet_archief" ${Settings.get('medewerker_ziet_archief') ? 'checked' : ''}> Medewerkers mogen het archief zien</label>
          <div class="form-actions" style="justify-content:flex-end; margin-top:.5rem;"><button type="submit" class="btn btn-primary">Opslaan</button></div>
        </form>
        <hr style="margin:1rem 0; border:none; border-top:1px solid var(--border,#e5e0d6);">
        <p class="muted small">Foto's en scans van archief-dossiers worden bij archivering automatisch flink kleiner opgeslagen. Als je oude dossiers hebt die dat nog niet zijn (van vóór deze update), kun je alles hieronder ineens comprimeren.</p>
        <div class="form-actions" style="justify-content:space-between; align-items:center; flex-wrap:wrap; gap:.5rem;">
          <span id="archief-compressie-status" class="muted small">${(() => {
            const n = DB.where(KEYS.DOSSIERS, x => x.gearchiveerd).length;
            return `${n} dossier${n === 1 ? '' : 's'} in archief`;
          })()}</span>
          <button type="button" class="btn" id="btn-comprimeer-archief">🗜 Comprimeer archief-foto's</button>
        </div>
      </section>` : ''}

      ${(typeof Auth !== 'undefined' && Auth.isBeheerder()) ? `
      <section class="card narrow" id="prijzen">
        <h2>Prijzen</h2>
        <p class="muted small">Gewone medewerkers zien standaard geen bedragen: ze zien de kostenposten wél (en kunnen ze aftikken), maar zonder euro's en zonder totalen. Dit wordt server-side afgedwongen.</p>
        <form id="prijzen-form" class="form" autocomplete="off">
          <label class="checkbox-inline"><input type="checkbox" name="medewerker_ziet_prijzen" ${Settings.get('medewerker_ziet_prijzen') ? 'checked' : ''}> Medewerkers mogen prijzen zien</label>
          <div class="form-actions" style="justify-content:flex-end; margin-top:.5rem;"><button type="submit" class="btn btn-primary">Opslaan</button></div>
        </form>
      </section>

      <section class="card narrow" id="kostenposten">
        <h2>Kostenposten beheren</h2>
        <p class="muted small">Beheer hier de standaard-kostenposten die medewerkers via 'Snel toevoegen' in een dossier kunnen prikken. Pas prijs aan, verberg posten die je niet meer gebruikt, of voeg een eigen post toe. Wijzigingen gelden voor alle dossiers.</p>
        ${(() => {
          const lijst = effectieveKostenPresets({ includeHidden: true }).filter(p => !p.nav);
          return `
          <table class="table kosten-beheer-table">
            <thead><tr><th>Omschrijving</th><th>Categorie</th><th class="num">Prijs</th><th></th></tr></thead>
            <tbody>
              ${lijst.map(p => {
                const bedrag = p.bedrag != null ? (Number(p.bedrag) || 0).toFixed(2).replace('.', ',') : '';
                return `<tr class="${p._hidden ? 'is-verborgen' : ''}" data-oms="${esc(p.omschrijving)}">
                  <td><strong>${esc(p.omschrijving)}</strong>${p._custom ? ' <span class="badge badge-amber" title="Zelf toegevoegd">eigen</span>' : ''}${p.vraagPrijs ? ' <span class="badge badge-amber" title="Richtprijs">±</span>' : ''}${p.food ? ' <span class="badge badge-amber" title="Aantal × prijs per stuk">×N</span>' : ''}</td>
                  <td class="muted small">${esc(categorieLabel(p.categorie))}</td>
                  <td class="num"><input type="text" inputmode="decimal" class="kb-prijs" value="${esc(bedrag)}" placeholder="0,00" style="max-width:110px;text-align:right;"></td>
                  <td class="row-form" style="justify-content:flex-end;gap:.35rem;">
                    <button type="button" class="btn btn-sm" data-kb-save title="Prijs opslaan">💾</button>
                    ${p._customBedrag ? '<button type="button" class="btn btn-sm btn-ghost" data-kb-reset title="Terug naar standaardprijs">↺</button>' : ''}
                    ${p._hidden
                      ? '<button type="button" class="btn btn-sm btn-ghost" data-kb-show title="Weer tonen">👁</button>'
                      : '<button type="button" class="btn btn-sm btn-ghost" data-kb-hide title="Verbergen uit lijst">🗑</button>'}
                    ${p._custom ? '<button type="button" class="btn btn-sm btn-ghost btn-danger" data-kb-del title="Definitief verwijderen (alleen eigen posten)">✕</button>' : ''}
                  </td>
                </tr>`;
              }).join('')}
            </tbody>
          </table>
          <details style="margin-top:.75rem;">
            <summary style="cursor:pointer;"><strong>+ Nieuwe kostenpost aanmaken</strong></summary>
            <form id="kb-add-form" class="row-form" style="margin-top:.5rem;flex-wrap:wrap;gap:.4rem;">
              <input type="text" name="omschrijving" placeholder="Omschrijving..." required style="flex:1;min-width:180px;">
              <select name="categorie">
                <option value="">Categorie</option>
                ${KOSTEN_CATEGORIEEN.map(c => `<option value="${c.id}">${esc(c.label)}</option>`).join('')}
              </select>
              <input type="text" name="bedrag" placeholder="Prijs" inputmode="decimal" style="max-width:110px;">
              <button type="submit" class="btn btn-sm btn-primary">+ Toevoegen</button>
            </form>
          </details>`;
        })()}
      </section>` : ''}

      <section class="card narrow" id="opdrachtgevers">
        <h2>Opdrachtgevers</h2>
        <p class="muted small">De uitvaartleiders / klanten waarvoor jullie werken. Deze verschijnen in de opdrachtgever-dropdown bovenaan het dossier.</p>
        ${(() => {
          const lijst = Settings.get('opdrachtgevers') || [];
          return `
          <form id="opdrachtgever-form" class="form" autocomplete="off">
            <p class="muted small" style="margin:.25rem 0 .5rem;">Sleep aan de <strong>≡</strong>-greep om de volgorde te veranderen. Klik Opslaan om te bewaren.</p>
            <div id="opdrachtgever-rows" class="parochie-rows">
              ${lijst.map((o, i) => `
                <div class="parochie-row opdr-drag-row" draggable="true" data-idx="${i}">
                  <span class="drag-grip" title="Sleep om te verplaatsen">≡</span>
                  <input type="text" class="opdrachtgever-naam" value="${esc(o.naam || o || '')}" placeholder="bv. Uitvaartzorg Jansen">
                  <button type="button" class="btn-icon" data-action="del-opdrachtgever" title="verwijderen">×</button>
                </div>`).join('')}
            </div>
            <div class="form-actions" style="justify-content:space-between;">
              <button type="button" class="btn btn-ghost" id="btn-add-opdrachtgever">+ Opdrachtgever toevoegen</button>
              <button type="submit" class="btn btn-primary">Opslaan</button>
            </div>
          </form>`;
        })()}
      </section>

      ${(typeof Auth !== 'undefined' && Auth.isBeheerder()) ? `
      <section class="card narrow" id="rouwauto-lijst-sectie">
        <h2>Rouwauto's</h2>
        <p class="muted small">De rouwauto's van OZN — deze verschijnen in de dropdown "Rouwauto" in het dossier. Eén per regel.</p>
        <form id="rouwauto-form" class="form" autocomplete="off">
          <label>
            <textarea name="rouwauto_lijst" rows="4" placeholder="bv.&#10;Mercedes E-klasse (grijs)&#10;Volvo XC90 (zwart)">${esc((Settings.get('rouwauto_lijst') || []).join('\n'))}</textarea>
          </label>
          <div class="form-actions" style="justify-content:flex-end;"><button type="submit" class="btn btn-primary">Opslaan</button></div>
        </form>
      </section>

      <section class="card narrow" id="rouwgoederen-sectie">
        <h2>Rouwgoederen (thuis opbaren)</h2>
        <p class="muted small">De vinkjes die in het dossier verschijnen bij "Benodigde rouwgoederen". Eén per regel.</p>
        <form id="rouwgoederen-form" class="form" autocomplete="off">
          <label>
            <textarea name="rouwgoederen_opties" rows="6" placeholder="Airco&#10;Opbaarplank&#10;Koelplaat&#10;Schermen&#10;Kaarsen/Kruis&#10;Schragen&#10;Baarwagen&#10;Rok">${esc((Settings.get('rouwgoederen_opties') || []).join('\n'))}</textarea>
          </label>
          <div class="form-actions" style="justify-content:flex-end;"><button type="submit" class="btn btn-primary">Opslaan</button></div>
        </form>
      </section>` : ''}

      <section class="card narrow" id="acc-welkom">
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

      <section class="card narrow" id="acc-data">
        <h2>Data &amp; synchronisatie</h2>
        ${(() => {
          const m = (() => { try { return JSON.parse(localStorage.getItem('sok_mirror') || '{}'); } catch (_) { return {}; } })();
          const lastSync = m.savedAt ? new Date(m.savedAt) : null;
          const offline = !!Cloud.offline || !navigator.onLine;
          const cnt = {
            dossiers: DB.list(KEYS.DOSSIERS).length,
            kosten: DB.list(KEYS.KOSTEN).length,
            notities: DB.list(KEYS.NOTITIES).length,
            kisten_fotos: DB.list(KEYS.KIST_AFBEELDINGEN).length,
          };
          return `
          <div class="alert ${offline ? 'alert-error' : 'alert-success'}" style="margin-bottom:.75rem;">
            <strong>${offline ? '⚠ Offline — leesmodus' : '✓ Veilig in de cloud'}</strong>
            <p class="muted small" style="margin:.35rem 0 0;color:inherit;opacity:.9;">
              Alle dossiers, kosten, notities, foto's én instellingen worden opgeslagen in Supabase (EU-regio).
              ${offline
                ? 'Op dit moment offline — wijzigingen kunnen pas worden opgeslagen zodra je weer internet hebt. Bestaande gegevens blijven veilig staan.'
                : 'Op elk apparaat zichtbaar zodra je inlogt. localStorage wordt enkel als offline-kopie gebruikt — niets gaat verloren bij cache wissen of nieuwe browser.'}
            </p>
          </div>
          <dl class="dl" style="grid-template-columns: 1fr 1fr;">
            <div><dt>Dossiers</dt><dd><strong>${cnt.dossiers}</strong></dd></div>
            <div><dt>Kostenposten</dt><dd>${cnt.kosten}</dd></div>
            <div><dt>Notities</dt><dd>${cnt.notities}</dd></div>
            <div><dt>Kistfoto's</dt><dd>${cnt.kisten_fotos}</dd></div>
            <div style="grid-column:span 2;"><dt>Laatst gesynchroniseerd</dt><dd>${lastSync ? lastSync.toLocaleString('nl-NL') : '—'}</dd></div>
          </dl>
          ${(typeof Auth === 'undefined' || Auth.isBeheerder()) ? `
          <div id="opslag-live" style="margin:.25rem 0 1rem;">
            <div class="muted small">Opslaggebruik (Supabase Free-plan) laden…</div>
          </div>` : ''}
          <div class="form-actions" style="justify-content:flex-start; gap:.5rem; flex-wrap:wrap;">
            <button type="button" class="btn btn-primary" id="btn-sync-now" ${offline ? 'disabled' : ''}>Sync nu opnieuw</button>
            <button type="button" class="btn" id="btn-export">Exporteer alle data (JSON)</button>
          </div>
          <p class="muted small" style="margin-top:.75rem;">
            Een JSON-export geeft je een volledig lokaal back-upbestand met alle dossiergegevens — voor in een veilige map of op een externe schijf, los van Supabase.
          </p>

          ${(typeof Auth === 'undefined' || Auth.isBeheerder()) ? `
          <div id="backup-lijst" style="margin-top:1rem;">
            <h3 style="margin:0 0 .35rem;font-size:.95rem;">Automatische backups</h3>
            <div class="muted small">Wordt elke maandag om 03:00 UTC automatisch gemaakt (laatste 12 bewaard).</div>
            <ul id="backup-items" class="muted small" style="margin:.4rem 0 0;padding:0;list-style:none;">
              <li>laden…</li>
            </ul>
          </div>` : ''}

          <details style="margin-top:1rem;">
            <summary style="cursor:pointer; font-weight:600;">Wat zijn de limieten van het Supabase Free-plan?</summary>
            <div class="muted small" style="margin-top:.5rem; line-height:1.55;">
              <p style="margin:.25rem 0;"><strong>Database</strong>: 500 MB — voor jouw dossiergegevens (tekst) ruim voldoende voor jaren.</p>
              <p style="margin:.25rem 0;"><strong>Storage</strong>: 1 GB totaal — voor foto's en documenten.
                Foto's worden bij upload <strong>automatisch verkleind</strong> (max ±1600 px, JPEG 85%) zodat een telefoon-foto van 8 MB als ~400 KB wordt opgeslagen.</p>
              <p style="margin:.25rem 0;"><strong>Bandbreedte</strong>: 5 GB/maand — alle keren dat foto's en documenten worden bekeken.</p>
              <p style="margin:.25rem 0;"><strong>Inactiviteit</strong>: na 1 week zonder activiteit wordt het project tijdelijk gepauzeerd; één login activeert het weer. Pas na 90+ dagen onafgebroken inactiviteit kan Supabase het project verwijderen (met e-mailwaarschuwing vooraf).</p>
              <p style="margin:.5rem 0;"><strong>Bij overschrijden van een limiet</strong>: nieuwe uploads/wijzigingen worden geblokkeerd, maar <strong>bestaande gegevens blijven bewaard</strong>. Niets wordt automatisch gewist.</p>
              <p style="margin:.25rem 0;"><strong>Adviezen</strong>:</p>
              <ul style="margin:.25rem 0 .25rem 1.25rem; padding:0;">
                <li>Maandelijks een JSON-export downloaden via de knop hierboven</li>
                <li>Periodiek inloggen via Supabase-dashboard om de opslaggrafiek te checken</li>
                <li>Bij ruimtegebrek: oude documenten van afgeronde dossiers handmatig verwijderen, of upgraden naar Pro ($25/m: 8 GB DB / 100 GB storage)</li>
              </ul>
            </div>
          </details>`;
        })()}
      </section>

      ${(typeof Auth !== 'undefined' && Auth.isBeheerder()) ? `
      <section class="card narrow" id="acc-logboek" style="margin-top:1rem;">
        <h2>Logboek</h2>
        <p class="muted small">Volledig audit-log van alle wijzigingen, logins en profielwissels. Alleen zichtbaar voor beheerders.</p>
        <div class="form-actions" style="justify-content:flex-start;">
          <a href="#/logboek" class="btn btn-primary">📖 Open logboek</a>
        </div>
      </section>` : ''}
    </div>`;

  // Branding-instellingen
  const brandForm = $('#brand-form');
  if (brandForm) {
    let pendingLogo = null; // tijdelijke logo-data tot opslaan

    $('#logo-input').addEventListener('change', async e => {
      const file = e.target.files[0];
      if (!file) return;
      if (!file.type.startsWith('image/')) return Modal.show({ type: 'warning', title: 'Ongeldig bestand', message: 'Alleen afbeeldingen toegestaan.' });
      if (file.size > 1024 * 1024) return Modal.show({ type: 'warning', title: 'Logo te groot', message: 'Maximaal 1 MB.' });
      // Demo-/review-account: geen cloud-upload (dat zou het gedeelde app-logo
      // overschrijven). Lokaal als verkleinde data-URL inlezen — alleen op dit
      // toestel, en het overleeft een herstart via de demo-instellingen.
      if (typeof Demo !== 'undefined' && Demo.isActive()) {
        try {
          const small = await compressImage(file, 256, 0.85);
          pendingLogo = await new Promise((res, rej) => {
            const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(small);
          });
          const prev = $('#logo-preview');
          if (prev) prev.innerHTML = `<img src="${pendingLogo}" alt="Logo">`;
        } catch (err) {
          Modal.show({ type: 'error', title: 'Kon logo niet laden', message: err.message || String(err) });
        }
        return;
      }
      if (!navigator.onLine) return Modal.show({ type: 'offline', title: 'Geen internet', message: 'Logo uploaden kan alleen met een actieve internetverbinding.' });
      const lbl = e.target.closest('label');
      // NIET textContent zetten — dat vernietigt de nested <input type="file">.
      // Alleen opacity aanpassen als visuele feedback, of via een span-child.
      if (lbl) lbl.style.opacity = .55;
      try {
        pendingLogo = await BrandingFotos.uploadLogo(file);
        const prev = $('#logo-preview');
        if (prev) prev.innerHTML = `<img src="${pendingLogo}" alt="Logo">`;
      } catch (err) {
        Modal.show({ type: 'error', title: 'Upload mislukt', message: err.message || String(err) });
      } finally {
        if (lbl) lbl.style.opacity = 1;
      }
    });

    const removeBtn = $('#btn-remove-logo');
    if (removeBtn) {
      removeBtn.addEventListener('click', () => {
        // Alleen pending-state zetten; storage-delete gebeurt pas bij Opslaan
        // zodat Annuleren / weg-navigeren geen data-verlies veroorzaakt.
        pendingLogo = '';
        const prev = $('#logo-preview');
        if (prev) prev.innerHTML = '<span>OZN</span>';
      });
    }

    brandForm.addEventListener('submit', async e => {
      e.preventDefault();
      const f = e.target;
      const patch = {
        app_name: f.app_name.value.trim() || Settings.defaults.app_name,
        app_tagline: f.app_tagline.value.trim() || Settings.defaults.app_tagline,
        primary_color: f.primary_color.value || Settings.defaults.primary_color,
        accent_color: f.accent_color.value || Settings.defaults.accent_color,
      };
      const oudLogo = Settings.get('logo_data_url') || '';
      if (pendingLogo !== null) patch.logo_data_url = pendingLogo;
      try {
        Settings.set(patch);
      } catch (err) {
        return renderAccount({ error: 'Opslaan mislukt — logo is mogelijk te groot voor lokale opslag.' });
      }
      // Storage-delete PAS als Settings-write is gelukt EN de user 'verwijderen'
      // koos (pendingLogo === '' en er was een oud logo).
      if (pendingLogo === '' && oudLogo) {
        const demo = (typeof Demo !== 'undefined' && Demo.isActive());
        if (!demo && navigator.onLine) {
          await BrandingFotos.removeLogo().catch(() => {});
        }
      }
      Branding.apply();
      renderAccount({ success: 'Branding opgeslagen.' });
    });

    $('#btn-reset-brand').addEventListener('click', async () => {
      const ok = await Modal.confirm({ title: 'Branding herstellen?', message: 'Alle branding-instellingen worden teruggezet en het logo verdwijnt.', confirmText: 'Herstellen' });
      if (!ok) return;
      Settings.set({
        app_name: Settings.defaults.app_name,
        app_tagline: Settings.defaults.app_tagline,
        primary_color: Settings.defaults.primary_color,
        accent_color: Settings.defaults.accent_color,
        logo_data_url: Settings.defaults.logo_data_url,
      });
      Branding.apply();
      renderAccount({ success: 'Standaard branding hersteld.' });
    });
  }

  // Login-scherm-instellingen
  const loginForm = $('#login-form-settings');
  if (loginForm) {
    const parseLines = txt => txt.split('\n').map(s => s.trim()).filter(Boolean);
    loginForm.addEventListener('submit', e => {
      e.preventDefault();
      const f = e.target;
      Settings.set({
        login_brand_title:    f.login_brand_title.value.trim()    || Settings.defaults.login_brand_title,
        login_brand_subtitle: f.login_brand_subtitle.value.trim() || Settings.defaults.login_brand_subtitle,
        login_brand_features: parseLines(f.login_brand_features.value),
        login_brand_foot:     f.login_brand_foot.value.trim()     || Settings.defaults.login_brand_foot,
        login_form_title:     f.login_form_title.value.trim()     || Settings.defaults.login_form_title,
        login_form_subtitle:  f.login_form_subtitle.value.trim()  || Settings.defaults.login_form_subtitle,
        login_secretariaat_text: f.login_secretariaat_text.value.trim() || Settings.defaults.login_secretariaat_text,
      });
      Branding.apply();
      renderAccount({ success: 'Loginscherm-teksten opgeslagen.' });
    });
    $('#btn-reset-login').addEventListener('click', async () => {
      const ok = await Modal.confirm({ title: 'Loginscherm herstellen?', message: 'Alle teksten op het loginscherm worden teruggezet naar de standaard.', confirmText: 'Herstellen' });
      if (!ok) return;
      Settings.set({
        login_brand_title:    Settings.defaults.login_brand_title,
        login_brand_subtitle: Settings.defaults.login_brand_subtitle,
        login_brand_features: Settings.defaults.login_brand_features,
        login_brand_foot:     Settings.defaults.login_brand_foot,
        login_form_title:     Settings.defaults.login_form_title,
        login_form_subtitle:  Settings.defaults.login_form_subtitle,
        login_secretariaat_text: Settings.defaults.login_secretariaat_text,
      });
      Branding.apply();
      renderAccount({ success: 'Standaardwaarden hersteld.' });
    });
  }

  // Weergave-instellingen
  const uiForm = $('#ui-form');
  if (uiForm) {
    // Lettertype live toepassen bij wijzigen — voorbeeld is meteen zichtbaar
    const fontSel = $('#font-select');
    if (fontSel) {
      fontSel.addEventListener('change', () => applyFont(fontSel.value));
    }
    const densSel = uiForm.querySelector('select[name="form_density"]');
    if (densSel) {
      densSel.addEventListener('change', () => {
        document.body.classList.remove('density-compact','density-normaal','density-ruim','density-extraruim');
        document.body.classList.add('density-' + densSel.value);
      });
    }
    uiForm.addEventListener('submit', e => {
      e.preventDefault();
      const f = e.target;
      Settings.set({
        design_version: f.design_version.value,
        compact_mode: f.compact_mode.checked,
        rounded_cards: f.rounded_cards.checked,
        font_id: f.font_id.value,
        form_density: f.form_density.value,
        catalog_admin_mode: f.catalog_admin_mode.checked,
        dossier_admin_mode: f.dossier_admin_mode.checked,
      });
      Branding.apply();
      renderAccount({ success: 'Weergave-instellingen opgeslagen.' });
    });
  }

  // E-mail-instellingen (Resend)
  const emailForm = $('#email-form');
  if (emailForm) {
    emailForm.addEventListener('submit', e => {
      e.preventDefault();
      const f = e.target;
      Settings.set({
        auto_send_dossier_email: f.auto_send_dossier_email.value.trim(),
      });
      renderAccount({ success: 'E-mail-instellingen opgeslagen.' });
    });

    // Footer / handtekening
    const emailFooterForm = $('#email-footer-form');
    if (emailFooterForm) {
      emailFooterForm.addEventListener('submit', e => {
        e.preventDefault();
        const f = e.target;
        Settings.set({
          email_footer_enabled:       f.email_footer_enabled.checked,
          email_footer_address:       f.email_footer_address.value.trim(),
          email_footer_phone:         f.email_footer_phone.value.trim(),
          email_footer_email:         f.email_footer_email.value.trim(),
          email_footer_website:       f.email_footer_website.value.trim(),
          email_footer_terms_url:     f.email_footer_terms_url.value.trim(),
          email_footer_privacy_url:   f.email_footer_privacy_url.value.trim(),
          email_footer_facebook_url:  f.email_footer_facebook_url.value.trim(),
          email_footer_instagram_url: f.email_footer_instagram_url.value.trim(),
        });
        renderAccount({ success: 'E-mail-footer opgeslagen.' });
      });
    }

    // Factuurgegevens
    const factuurForm = $('#factuur-form');
    if (factuurForm) {
      factuurForm.addEventListener('submit', e => {
        e.preventDefault();
        const f = e.target;
        Settings.set({
          factuur_bedrijfsnaam: f.factuur_bedrijfsnaam.value.trim(),
          factuur_adres:        f.factuur_adres.value.replace(/\r/g, '').trim(),
          factuur_telefoon:     f.factuur_telefoon.value.trim(),
          factuur_email:        f.factuur_email.value.trim(),
          factuur_iban:         f.factuur_iban.value.trim(),
          factuur_btw:          f.factuur_btw.value.trim(),
          factuur_kvk:          f.factuur_kvk.value.trim(),
          factuur_betalingstermijn_dagen: parseInt(f.factuur_betalingstermijn_dagen.value, 10) || 30,
        });
        renderAccount({ success: 'Factuurgegevens opgeslagen.' });
      });
    }

    $('#btn-email-test').addEventListener('click', async () => {
      const f = emailForm;
      const to = f.email_test_to.value.trim();
      const result = $('#email-test-result');
      result.innerHTML = '';
      if (!to) { result.innerHTML = '<div class="alert alert-error">Vul eerst een test-e-mailadres in.</div>'; return; }
      const btn = $('#btn-email-test');
      btn.disabled = true; const orig = btn.textContent;
      btn.textContent = 'Bezig met verzenden...';
      try {
        const appName = esc(Settings.get('app_name') || 'OZN');
        const html = `<div style="font-family:system-ui,-apple-system,sans-serif;max-width:560px;margin:0 auto;padding:24px;">
          <h2 style="color:#6b1e2a;margin:0 0 12px;">Test-e-mail</h2>
          <p>Dit is een test-e-mail vanuit <strong>${appName}</strong>. Als je dit ontvangt, werkt de Resend-koppeling correct.</p>
          <p style="color:#8a847b;font-size:13px;margin-top:24px;">Verstuurd via Supabase Edge Function → Resend.</p>
        </div>`;
        await EmailService.send(to, 'Test — ' + (Settings.get('app_name') || 'OZN'), html);
        result.innerHTML = `<div class="alert alert-success">Test verstuurd naar ${esc(to)}. Controleer de inbox (en spam-map).</div>`;
      } catch (e) {
        result.innerHTML = `<div class="alert alert-error">Verzenden mislukt: ${esc(e && e.message ? e.message : String(e))}</div>`;
      } finally {
        btn.disabled = false; btn.textContent = orig;
      }
    });
  }

  // Diagnose: is de native documentscanner-plugin geladen in deze app-build?
  const scanEl = $('#scanner-status');
  if (scanEl && typeof Native !== 'undefined' && Native.scannerStatus) {
    const isAndroid = Native.platform && Native.platform() === 'android';
    Native.scannerStatus().then(st => {
      if (st === 'native') {
        scanEl.innerHTML = '<span style="color:#1f7a3a;font-weight:600;">✓ actief</span> — ' +
          (isAndroid ? 'ML Kit scanner beschikbaar' : 'Apple VisionKit scanner beschikbaar');
      } else if (st === 'native-unsupported') {
        scanEl.textContent = 'plugin geladen, maar dit toestel ondersteunt de scanner niet';
      } else if (st === 'unavailable') {
        scanEl.innerHTML = '<span style="color:#b34;font-weight:600;">⚠ niet in deze build</span> — maak een nieuwe ' +
          (isAndroid ? 'APK' : 'TestFlight-build');
      } else {
        scanEl.textContent = 'alleen in de app (niet in de browser)';
      }
    }).catch(() => { scanEl.textContent = 'kon status niet bepalen'; });
  }

  // Diagnose + installer: Google Play Services (alleen Android-app)
  const gsEl = $('#gs-status');
  if (gsEl && typeof Native !== 'undefined' && Native.googleServicesStatus) {
    Native.googleServicesStatus().then(st => {
      if (st.unavailable) gsEl.innerHTML = '<span style="color:#b34;font-weight:600;">⚠ plugin niet in deze build</span>';
      else if (st.available === true) gsEl.innerHTML = '<span style="color:#1f7a3a;font-weight:600;">✓ beschikbaar</span>';
      else if (st.available === false) gsEl.innerHTML = '<span style="color:#b34;font-weight:600;">⚠ niet beschikbaar</span> — ' + esc(st.description || 'onbekende reden');
      else gsEl.textContent = 'kon status niet bepalen';
    }).catch(() => { gsEl.textContent = 'kon status niet bepalen'; });
  }
  const gsInstallBtn = $('#btn-gs-install');
  if (gsInstallBtn) gsInstallBtn.addEventListener('click', async () => {
    const res = $('#gs-install-result');
    gsInstallBtn.disabled = true; const orig = gsInstallBtn.textContent;
    gsInstallBtn.textContent = 'Bezig — volg de systeem-dialoog…';
    if (res) res.textContent = '';
    try {
      const r = await Native.installGoogleServices();
      if (r && r.nothingToDo) {
        if (res) res.innerHTML = '<span style="color:#1f7a3a;">✓ Niets te installeren — deze build gebruikt geen optionele Google-modules.</span>';
      } else if (r && r.alreadyInstalled) {
        if (res) res.innerHTML = '<span style="color:#1f7a3a;">✓ Alle Google-modules stonden al aan.</span>';
      } else {
        if (res) res.innerHTML = '<span style="color:#1f7a3a;">✓ Installatie aangevraagd — Google Play Services regelt de download op de achtergrond.</span>';
      }
    } catch (e) {
      if (res) res.innerHTML = '<span style="color:#b34;">' + esc((e && e.message) || String(e)) + '</span>';
    } finally {
      gsInstallBtn.disabled = false; gsInstallBtn.textContent = orig;
    }
  });

  // Diagnose + test: Live Activity
  const laEl = $('#la-status');
  if (laEl && typeof Native !== 'undefined' && Native.liveActivityStatus) {
    Native.liveActivityStatus().then(st => {
      if (st === 'on') laEl.innerHTML = '<span style="color:#1f7a3a;font-weight:600;">✓ aan</span> — widget kan getoond worden';
      else if (st === 'off') laEl.innerHTML = '<span style="color:#b8860b;font-weight:600;">uit</span> — zet aan bij Instellingen → Uitvaart Intake → Live activiteiten';
      else if (st === 'unavailable') laEl.innerHTML = '<span style="color:#b34;font-weight:600;">⚠ niet beschikbaar</span>' + (Native._laLastError ? ' <span class="muted small">(' + esc(Native._laLastError) + ')</span>' : '');
      else laEl.textContent = 'alleen in de app';
    }).catch(() => { laEl.textContent = 'kon status niet bepalen'; });
  }
  const laTestBtn = $('#btn-la-test');
  if (laTestBtn) laTestBtn.addEventListener('click', async () => {
    const res = $('#la-test-result');
    laTestBtn.disabled = true; const orig = laTestBtn.textContent; laTestBtn.textContent = 'Bezig…';
    try {
      const msg = await Native.testLiveActivity();
      if (res) res.innerHTML = '<span style="color:#1f7a3a;">' + esc(msg) + '</span>';
    } catch (e) {
      if (res) res.innerHTML = '<span style="color:#b34;">' + esc(e.message || String(e)) + '</span>';
    } finally {
      laTestBtn.disabled = false; laTestBtn.textContent = orig;
    }
  });
  const laStopBtn = $('#btn-la-stop');
  if (laStopBtn) laStopBtn.addEventListener('click', async () => {
    try { await Native.endUitvaartActivities(); const r = $('#la-test-result'); if (r) r.textContent = 'Gestopt.'; } catch (_) {}
  });

  // Update-check
  const updBtn = $('#btn-check-update');
  if (updBtn) {
    updBtn.addEventListener('click', async () => {
      const result = $('#update-result');
      updBtn.disabled = true; const orig = updBtn.textContent;
      updBtn.textContent = 'Bezig met controleren...';
      result.innerHTML = '';
      try {
        // In de APK: check op nieuwere APK i.p.v. de web-versie.
        if (typeof ApkUpdater !== 'undefined' && ApkUpdater.isApp()) {
          const info = await ApkUpdater.check({ force: true });
          if (info && info.hasUpdate) {
            result.innerHTML = `<div class="alert alert-info">📦 Nieuwe APK beschikbaar. <a href="${esc(info.downloadUrl)}" target="_blank" rel="noopener" class="btn btn-sm btn-primary" style="margin-left:.5rem;">Installeer</a></div>`;
          } else if (info) {
            result.innerHTML = `<div class="alert alert-success">Je draait al de laatste APK (${esc(APP_VERSION)}, ${esc(APP_BUILD_DATE)}).</div>`;
          } else {
            result.innerHTML = `<div class="alert alert-error">Kon niet controleren — offline of GitHub-release onbereikbaar.</div>`;
          }
          updBtn.disabled = false; updBtn.textContent = orig;
          return;
        }
        const r = await Updater.check();
        if (r.hasUpdate) {
          result.innerHTML = `<div class="alert alert-info">Nieuwe versie beschikbaar: <strong>${esc(r.remoteVersion)}</strong> (jij draait ${esc(r.currentVersion)}). De pagina wordt over enkele seconden ververst.</div>`;
          setTimeout(() => Updater.reloadHard(), 700);
        } else if (r.swUpdated) {
          result.innerHTML = `<div class="alert alert-success">Service-worker bijgewerkt naar de laatste versie. Pagina wordt ververst...</div>`;
          setTimeout(() => Updater.reloadHard(), 500);
        } else {
          result.innerHTML = `<div class="alert alert-success">Je draait al de laatste versie (<strong>${esc(r.currentVersion)}</strong>).</div>`;
          updBtn.disabled = false; updBtn.textContent = orig;
        }
      } catch (e) {
        result.innerHTML = `<div class="alert alert-error">Update-check mislukt: ${esc(e.message || e)}</div>`;
        updBtn.disabled = false; updBtn.textContent = orig;
      }
    });
  }

  const resetBtn = $('#btn-hard-reset');
  if (resetBtn) {
    resetBtn.addEventListener('click', async () => {
      const ok = await Modal.confirm({
        title: 'Volledig resetten?',
        message: 'De service-worker en alle lokale cache worden gewist. Dossiers blijven veilig in de cloud staan. Daarna wordt de app opnieuw vanaf de server geladen.',
        confirmText: 'Resetten',
        cancelText: 'Annuleren',
      });
      if (!ok) return;
      resetBtn.disabled = true;
      resetBtn.textContent = 'Bezig...';
      await Updater.hardReset();
    });
  }

  // ─── Push-notificaties beheer ─────────────────────────────────
  const pushForm = $('#push-form');
  if (pushForm) {
    const refreshPushStatus = async () => {
      const statusEl = $('#push-status');
      const enableBtn = $('#btn-push-enable');
      const disableBtn = $('#btn-push-disable');
      if (!await PushNotificaties.supported()) {
        statusEl.className = 'alert alert-error';
        statusEl.textContent = 'Deze browser ondersteunt geen push-notificaties.';
        enableBtn.disabled = true;
        return;
      }
      const perm = await PushNotificaties.permission();
      const sub = await PushNotificaties.currentSubscription();
      if (sub && perm === 'granted') {
        statusEl.className = 'alert alert-success';
        statusEl.innerHTML = '✓ <strong>Ingeschakeld</strong> op dit apparaat.';
        enableBtn.hidden = true;
        disableBtn.hidden = false;
      } else if (perm === 'denied') {
        statusEl.className = 'alert alert-error';
        statusEl.innerHTML = '⚠ Notificaties geblokkeerd door de browser. Sta ze handmatig toe via de adresbalk (slot-icoontje).';
        enableBtn.hidden = false;
        disableBtn.hidden = true;
      } else {
        statusEl.className = 'alert';
        statusEl.textContent = 'Nog niet ingeschakeld op dit apparaat.';
        enableBtn.hidden = false;
        disableBtn.hidden = true;
      }
    };
    refreshPushStatus();

    pushForm.addEventListener('submit', e => {
      e.preventDefault();
      const f = e.target;
      Settings.set({
        push_vapid_public_key: f.push_vapid_public_key.value.trim(),
        push_remind_days_ahead: parseInt(f.push_remind_days_ahead.value, 10) || 1,
      });
      renderAccount({ success: 'Push-instellingen opgeslagen.' });
    });

    $('#btn-push-enable').addEventListener('click', async () => {
      const btn = $('#btn-push-enable');
      btn.disabled = true; const orig = btn.textContent; btn.textContent = 'Bezig...';
      try {
        await PushNotificaties.subscribe();
        Modal.show({ type: 'success', title: 'Notificaties aan', message: 'Je krijgt nu meldingen op dit apparaat.' });
      } catch (e) {
        Modal.show({ type: 'error', title: 'Inschakelen mislukt', message: e.message || String(e) });
      } finally {
        btn.disabled = false; btn.textContent = orig;
        refreshPushStatus();
      }
    });

    $('#btn-push-disable').addEventListener('click', async () => {
      try { await PushNotificaties.unsubscribe(); } catch (_) {}
      refreshPushStatus();
    });

    $('#btn-push-test').addEventListener('click', async () => {
      try {
        const ok = await PushNotificaties.testLocal();
        if (!ok) Modal.show({ type: 'warning', title: 'Toestemming nodig', message: 'Sta notificaties toe in de browser.' });
      } catch (e) {
        Modal.show({ type: 'error', title: 'Test mislukt', message: e.message || String(e) });
      }
    });
  }

  // ─── SnelStart-koppeling (boekhouding) ───────────────────────
  const snelstartForm = $('#snelstart-form');
  if (snelstartForm) {
    snelstartForm.addEventListener('submit', e => {
      e.preventDefault();
      const f = e.target;
      Settings.set({
        snelstart_actief: f.snelstart_actief.checked,
        snelstart_subscription_key: f.snelstart_subscription_key.value.trim(),
        snelstart_client_key: f.snelstart_client_key.value.trim(),
      });
      renderAccount({ success: 'SnelStart-instellingen opgeslagen.' });
      location.hash = '#/account#snelstart-instellingen';
    });

    const testBtn = $('#btn-snelstart-test');
    if (testBtn) testBtn.addEventListener('click', async () => {
      const f = snelstartForm;
      const sub = f.snelstart_subscription_key.value.trim();
      const cli = f.snelstart_client_key.value.trim();
      const out = $('#snelstart-result');
      if (!sub || !cli) {
        if (out) out.innerHTML = '<div class="alert alert-error">Vul eerst beide sleutels in.</div>';
        return;
      }
      // Sleutels tijdelijk opslaan zodat de test ze meeneemt
      Settings.set({ snelstart_subscription_key: sub, snelstart_client_key: cli });
      if (out) out.innerHTML = '<div class="alert">Bezig met testen…</div>';
      testBtn.disabled = true;
      try {
        const res = await SnelStart.test();
        if (res && res.ok) {
          if (out) out.innerHTML = `<div class="alert alert-success">✓ ${esc(res.msg || 'Verbinding geslaagd.')}</div>`;
        } else {
          const detail = res && (res.msg || res.error) ? (res.msg || res.error) : 'Onbekende fout.';
          if (out) out.innerHTML = `<div class="alert alert-error">Verbinding mislukt: ${esc(detail)}</div>`;
        }
      } catch (err) {
        if (out) out.innerHTML = `<div class="alert alert-error">Kon de testfunctie niet bereiken: ${esc(err.message || String(err))}</div>`;
      } finally {
        testBtn.disabled = false;
      }
    });
  }

  // ─── Profielen-beheer (Wie werkt vandaag?) ───────────────────
  const profielenForm = $('#profielen-form');
  if (profielenForm) {
    const slugify = s => String(s || '').toLowerCase()
      .replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || 'profiel';

    function makeProfielRow(naam = '', kleur = '#6b1e2a') {
      const rows = $('#profielen-rows');
      const idx = rows.querySelectorAll('.profielen-row').length;
      const letter = (naam || '?').charAt(0).toUpperCase() || '?';
      const div = document.createElement('div');
      div.className = 'profielen-row';
      div.dataset.idx = idx;
      div.innerHTML = `
        <span class="profielen-avatar" style="background:${esc(kleur)};">${esc(letter)}</span>
        <input type="text" class="profielen-naam" value="${esc(naam)}" placeholder="Naam" maxlength="40">
        <select class="profielen-rol" title="Rol van dit profiel">
          <option value="medewerker" selected>Medewerker</option>
          <option value="beheerder">Beheerder</option>
        </select>
        <input type="text" inputmode="numeric" pattern="[0-9]{0,6}" maxlength="6" class="profielen-pincode" placeholder="pincode" title="4–6 cijfers (alleen beheerder)" style="width:6rem;visibility:hidden;">
        <input type="color" class="profielen-kleur" value="${esc(kleur)}" title="Kleur van de avatar">
        <button type="button" class="btn-icon" data-action="del-profiel" data-idx="${idx}" title="Verwijderen">×</button>`;
      rows.appendChild(div);
      bindRowEvents(div);
    }
    function bindRowEvents(row) {
      const naamInp = row.querySelector('.profielen-naam');
      const kleurInp = row.querySelector('.profielen-kleur');
      const avatar = row.querySelector('.profielen-avatar');
      const rolSel = row.querySelector('.profielen-rol');
      const pinInp = row.querySelector('.profielen-pincode');
      naamInp.addEventListener('input', () => {
        const c = (naamInp.value || '?').trim().charAt(0).toUpperCase() || '?';
        avatar.textContent = c;
      });
      kleurInp.addEventListener('input', () => {
        avatar.style.background = kleurInp.value;
      });
      if (rolSel && pinInp) {
        const syncPin = () => {
          const beh = rolSel.value === 'beheerder';
          pinInp.style.visibility = beh ? 'visible' : 'hidden';
          if (!beh) pinInp.value = '';
        };
        rolSel.addEventListener('change', syncPin);
        pinInp.addEventListener('input', () => {
          pinInp.value = pinInp.value.replace(/\D/g, '').slice(0, 6);
        });
      }
    }
    profielenForm.querySelectorAll('.profielen-row').forEach(bindRowEvents);

    $('#btn-add-profiel').addEventListener('click', () => makeProfielRow('', '#6b1e2a'));

    profielenForm.addEventListener('click', e => {
      const del = e.target.closest('[data-action="del-profiel"]');
      if (!del) return;
      const row = del.closest('.profielen-row');
      if (!row) return;
      const blijft = profielenForm.querySelectorAll('.profielen-row').length - 1;
      if (blijft < 1) {
        Modal.show({ type: 'warning', title: 'Minstens één profiel nodig', message: 'Voeg eerst een nieuw profiel toe voordat je dit verwijdert.' });
        return;
      }
      row.remove();
    });

    profielenForm.addEventListener('submit', e => {
      e.preventDefault();
      const rows = profielenForm.querySelectorAll('.profielen-row');
      const huidigLijst = Settings.get('profielen') || [];
      const profielen = [];
      const gebruikteIds = new Set();
      // Map: lowercased naam -> bestaand id, zodat een rij die dezelfde
      // naam heeft z'n oude id houdt (i.p.v. de id van dezelfde INDEX
      // — die shiftt bij verwijderen/insert en veroorzaakte data-corruptie
      // in dossier-auteur-referenties).
      const idByNaam = new Map();
      huidigLijst.forEach(p => {
        if (p && p.id && p.name) idByNaam.set(p.name.trim().toLowerCase(), p.id);
      });
      const actiefId = (ActiveProfile.current() || {}).id;
      // Bestaande pincodes indexeren op profiel-id (niet op naam!), zodat we
      // andermans pincodes NOOIT verliezen bij het opslaan — ook niet als de
      // beheerder z'n eigen naam of een van de anderen aanpast.
      const pincodeById = new Map();
      huidigLijst.forEach(p => {
        if (p && p.id && p.pincode) pincodeById.set(p.id, p.pincode);
      });
      rows.forEach(r => {
        const naam = r.querySelector('.profielen-naam').value.trim();
        if (!naam) return;
        const kleur = r.querySelector('.profielen-kleur').value || '#6b1e2a';
        const rolSel = r.querySelector('.profielen-rol');
        const rol = rolSel && rolSel.value === 'beheerder' ? 'beheerder' : 'medewerker';
        const pinInp = r.querySelector('.profielen-pincode');
        // Wie een read-only pincode-veld ziet (andermans profiel) mag de
        // waarde niet overschrijven — we pakken de opgeslagen pincode terug.
        // Alleen de eigenaar van het actieve profiel mag z'n eigen pincode
        // wijzigen of wissen. Medewerker-profielen krijgen geen pincode.
        const rowProfielId = r.dataset.profielId || null;
        const isEigen = actiefId && rowProfielId === actiefId;
        let pincode = '';
        if (rol === 'beheerder') {
          if (isEigen && pinInp) {
            pincode = pinInp.value.replace(/\D/g, '').slice(0, 6);
          } else if (rowProfielId) {
            pincode = pincodeById.get(rowProfielId) || '';
          }
        }
        let id = idByNaam.get(naam.toLowerCase());
        if (!id || gebruikteIds.has(id)) {
          const base = slugify(naam);
          id = base;
          let n = 2;
          while (gebruikteIds.has(id)) id = base + '_' + (n++);
        }
        gebruikteIds.add(id);
        const item = { id, name: naam, color: kleur, rol };
        if (pincode) item.pincode = pincode;
        profielen.push(item);
      });
      if (profielen.length === 0) {
        Modal.show({ type: 'warning', title: 'Geen profielen', message: 'Voeg minstens één profiel toe.' });
        return;
      }
      Settings.set({ profielen });
      // Als het actieve profiel niet meer bestaat: wissen
      if (actiefId && !profielen.some(p => p.id === actiefId)) ActiveProfile.clear();
      renderAccount({ success: 'Profielen opgeslagen.' });
    });
  }

  // Medewerkers & rollen (alleen beheerder)
  const rollenForm = $('#rollen-form');
  if (rollenForm) {
    rollenForm.addEventListener('submit', async e => {
      e.preventDefault();
      const selects = $$('#rollen-form .rol-select').filter(s => !s.disabled);
      try {
        await Promise.all(selects.map(s => DB.update(KEYS.PROFIELEN, s.dataset.id, { rol: s.value })));
        renderAccount({ success: 'Rollen opgeslagen.' });
      } catch (err) {
        Modal.show({ type: 'error', title: 'Opslaan mislukt', message: err.message || String(err) });
      }
    });
  }

  // Nieuw medewerker-account aanmaken via Edge Function 'nieuwe-medewerker'
  const nwForm = $('#nieuwe-medewerker-form');
  if (nwForm) {
    nwForm.addEventListener('submit', async e => {
      e.preventDefault();
      const f = e.target;
      const statusEl = $('#nieuwe-medewerker-status');
      const btn = f.querySelector('button[type=submit]');
      btn.disabled = true; btn.textContent = 'Bezig…';
      if (statusEl) statusEl.textContent = '';
      try {
        const { data, error } = await sb.functions.invoke('nieuwe-medewerker', {
          body: {
            naam:     f.naam.value.trim(),
            email:    f.email.value.trim(),
            password: f.password.value,
            rol:      f.rol.value,
          },
        });
        if (error) throw error;
        if (data && data.error) throw new Error(data.error);
        // Ververs de profiles-cache zodat de nieuwe medewerker meteen zichtbaar is
        await Cloud.loadAll();
        renderAccount({ success: `Account aangemaakt voor ${f.email.value.trim()}. Deel het wachtwoord met de medewerker — ze kunnen direct inloggen.` });
      } catch (err) {
        btn.disabled = false; btn.textContent = 'Account aanmaken';
        if (statusEl) { statusEl.textContent = '⚠ ' + (err.message || String(err)); statusEl.style.color = '#c0392b'; }
      }
    });
  }

  // Archief-instellingen (alleen beheerder)
  const archiefForm = $('#archief-form');
  if (archiefForm) {
    archiefForm.addEventListener('submit', e => {
      e.preventDefault();
      Settings.set({
        auto_archief_actief: e.target.auto_archief_actief.checked,
        medewerker_ziet_archief: e.target.medewerker_ziet_archief.checked,
      });
      renderAccount({ success: 'Archief-instellingen opgeslagen.' });
    });
  }

  // R2 smoke-test — controleert of de Cloudflare R2 credentials werken
  const r2Btn = $('#btn-r2-test');
  const r2Status = $('#r2-test-status');
  if (r2Btn) {
    r2Btn.addEventListener('click', async () => {
      r2Btn.disabled = true;
      r2Status.textContent = 'Bezig…';
      r2Status.style.color = '';
      try {
        const { data, error } = await sb.functions.invoke('r2-smoke-test');
        r2Btn.disabled = false;
        if (error) {
          r2Status.textContent = 'Fout';
          r2Status.style.color = '#b32020';
          Modal.show({
            type: 'error',
            title: 'R2-test mislukt',
            message: (error.message || String(error)) +
              '\n\nZorg dat R2_ACCOUNT_ID, R2_ACCESS_KEY_ID en R2_SECRET_ACCESS_KEY in Supabase Edge Function Secrets staan.',
          });
          return;
        }
        if (data && data.ok) {
          r2Status.textContent = '✓ Verbinding OK — ' + (data.bucket || '');
          r2Status.style.color = '#2ea862';
          const stepsTxt = (data.steps || []).map(s =>
            `• ${s.step}${s.status ? ' (' + s.status + ')' : ''} → ${s.ok === false ? '❌' : s.match === false ? '❌ content-mismatch' : '✓'}`
          ).join('\n');
          Modal.show({
            type: 'success',
            title: 'R2-verbinding OK',
            message: `Endpoint: ${data.endpoint}\nBucket: ${data.bucket}\nContent-match: ${data.contentMatched ? 'ja' : 'nee'}\n\nStappen:\n${stepsTxt}`,
          });
        } else {
          r2Status.textContent = 'Fout: ' + ((data && data.step) || '?');
          r2Status.style.color = '#b32020';
          const stepsTxt = (data && data.steps || []).map(s =>
            `• ${s.step}${s.status ? ' (' + s.status + ')' : ''}${s.error ? ' — ' + s.error : ''}`
          ).join('\n');
          const missing = (data && data.missing) ? '\n\nOntbrekende secrets: ' + data.missing.join(', ') : '';
          const err = (data && data.error) ? '\n\nDetail: ' + String(data.error).slice(0, 400) : '';
          Modal.show({
            type: 'error',
            title: 'R2-test mislukt in stap: ' + ((data && data.step) || 'onbekend'),
            message: `Endpoint: ${data && data.endpoint || 'n.v.t.'}\nBucket: ${data && data.bucket || 'n.v.t.'}${missing}${err}\n\nStappen:\n${stepsTxt || '(geen)'}`,
          });
        }
      } catch (e) {
        r2Btn.disabled = false;
        r2Status.textContent = 'Fout';
        r2Status.style.color = '#b32020';
        Modal.show({ type: 'error', title: 'R2-test crashte', message: e.message || String(e) });
      }
    });
  }

  // R2-migratie: alle bestaande Supabase-Storage bestanden naar R2 verhuizen
  const migBtn = $('#btn-r2-migreer');
  const migStatus = $('#r2-migratie-status');
  const migLog = $('#r2-migratie-log');
  if (migBtn && typeof R2Migratie !== 'undefined') {
    migBtn.addEventListener('click', async () => {
      const werk = R2Migratie.verzamel();
      if (!werk.length) {
        Modal.show({ type: 'info', title: 'Niks te migreren', message: 'Alle dossier-bestanden staan al op R2.' });
        return;
      }
      const ok = await Modal.confirm({
        type: 'info',
        title: `${werk.length} bestand${werk.length === 1 ? '' : 'en'} migreren?`,
        message: `De bestanden worden gedownload van Supabase Storage, geüpload naar Cloudflare R2, en vervolgens uit Supabase verwijderd. Dit kan een paar minuten duren.\n\nBij een fout blijft het originele bestand op Supabase staan; de app blijft dan gewoon werken.`,
        confirmText: `Ja, migreer ${werk.length}`,
      });
      if (!ok) return;
      migBtn.disabled = true;
      migLog.textContent = '';
      const t0 = Date.now();
      try {
        const r = await R2Migratie.migreerAlles(({ done, totaal, huidig, resultaat, error }) => {
          migStatus.textContent = `${done}/${totaal} — bezig met ${huidig}`;
          if (resultaat) migLog.textContent += `✓ ${resultaat.pad} → ${resultaat.nieuwPad}\n`;
          if (error)     migLog.textContent += `✗ ${huidig}: ${error}\n`;
          migLog.scrollTop = migLog.scrollHeight;
        });
        const secs = Math.round((Date.now() - t0) / 1000);
        const mb = (r.bytesTotaal / 1048576).toFixed(2);
        Modal.show({
          type: r.errors.length ? 'warning' : 'success',
          title: `Migratie klaar${r.errors.length ? ' met fouten' : ''}`,
          message:
            `${r.done}/${r.totaal} bestanden gemigreerd (${mb} MB) in ${secs}s.\n` +
            (r.errors.length ? `\n${r.errors.length} fout(en):\n` + r.errors.map(e => `• ${e.pad}: ${e.error}`).join('\n') : ''),
        });
        // Ververs de UI zodat de teller klopt
        renderAccount({ success: `Migratie afgerond: ${r.done}/${r.totaal} bestanden.` });
      } catch (e) {
        Modal.show({ type: 'error', title: 'Migratie crashte', message: e.message || String(e) });
        migBtn.disabled = false;
      }
    });
  }

  // R2-reorganize: losse R2-bestanden in dossier-submap plaatsen
  const reorgBtn = $('#btn-r2-reorg');
  const reorgStatus = $('#r2-reorg-status');
  const reorgLog = $('#r2-reorg-log');
  if (reorgBtn && typeof R2Reorg !== 'undefined') {
    reorgBtn.addEventListener('click', async () => {
      const werk = R2Reorg.verzamel();
      if (!werk.length) {
        Modal.show({ type: 'info', title: 'Niks te doen', message: 'Alle R2-bestanden staan al in de juiste submap.' });
        return;
      }
      const ok = await Modal.confirm({
        type: 'info',
        title: `${werk.length} bestand${werk.length === 1 ? '' : 'en'} herordenen?`,
        message: `Elk bestand wordt server-side gekopieerd naar de dossier-submap (bv. artsverklaring/Achternaam_Dnummer/) en het origineel wordt verwijderd. Geen data-transfer via jouw browser.`,
        confirmText: `Ja, order ${werk.length}`,
      });
      if (!ok) return;
      reorgBtn.disabled = true;
      reorgLog.textContent = '';
      const t0 = Date.now();
      try {
        const r = await R2Reorg.reorganiseerAlles(({ done, totaal, huidig, resultaat, error }) => {
          reorgStatus.textContent = `${done}/${totaal} — bezig met ${huidig}`;
          if (resultaat) reorgLog.textContent += `✓ ${huidig} → ${resultaat.destKey}\n`;
          if (error)     reorgLog.textContent += `✗ ${huidig}: ${error}\n`;
          reorgLog.scrollTop = reorgLog.scrollHeight;
        });
        const secs = Math.round((Date.now() - t0) / 1000);
        Modal.show({
          type: r.errors.length ? 'warning' : 'success',
          title: `Ordenen klaar${r.errors.length ? ' met fouten' : ''}`,
          message:
            `${r.done}/${r.totaal} bestanden verplaatst in ${secs}s.\n` +
            (r.errors.length ? `\n${r.errors.length} fout(en):\n` + r.errors.map(e => `• ${e.key}: ${e.error}`).join('\n') : ''),
        });
        renderAccount({ success: `Ordenen afgerond: ${r.done}/${r.totaal} bestanden.` });
      } catch (e) {
        Modal.show({ type: 'error', title: 'Ordenen crashte', message: e.message || String(e) });
        reorgBtn.disabled = false;
      }
    });
  }

  // Bulk-compressie van alle bestaande archief-foto's
  const compBtn = $('#btn-comprimeer-archief');
  const compStatus = $('#archief-compressie-status');
  if (compBtn && typeof ArchiefCompressie !== 'undefined') {
    compBtn.addEventListener('click', async () => {
      const gearchiveerd = DB.where(KEYS.DOSSIERS, x => x.gearchiveerd);
      if (!gearchiveerd.length) {
        Modal.show({ type:'info', title:'Niks te doen', message:'Geen dossiers in het archief.' });
        return;
      }
      const ok = await Modal.confirm({
        type:'info',
        title:`${gearchiveerd.length} dossiers comprimeren?`,
        message:`Alle foto's en scans van de gearchiveerde dossiers worden agressief verkleind (${ArchiefCompressie.MAX_DIM} px, JPEG ${Math.round(ArchiefCompressie.QUALITY*100)}%). De originelen worden overschreven; dit kun je niet ongedaan maken. Doorgaan?`,
        confirmText:'Ja, comprimeer',
      });
      if (!ok) return;
      compBtn.disabled = true;
      let totaalFotos = 0, totaalBespaard = 0, verwerkt = 0;
      for (const d of gearchiveerd) {
        if (compStatus) compStatus.textContent = `Bezig: ${++verwerkt}/${gearchiveerd.length} · ${totaalFotos} foto's · ${Math.round(totaalBespaard/1024)} KB bespaard`;
        try {
          const r = await ArchiefCompressie.comprimeerDossier(d);
          totaalFotos   += r.aantal;
          totaalBespaard += r.bespaard;
        } catch (_) {}
      }
      compBtn.disabled = false;
      const mb = (totaalBespaard / (1024*1024)).toFixed(2);
      Modal.show({
        type:'success',
        title:'Klaar',
        message:`${totaalFotos} foto's uit ${gearchiveerd.length} dossiers gecomprimeerd. Bespaard: ${mb} MB.`,
      });
      renderAccount();
    });
  }

  // Prijzen-instellingen (alleen beheerder)
  const prijzenForm = $('#prijzen-form');
  if (prijzenForm) {
    prijzenForm.addEventListener('submit', e => {
      e.preventDefault();
      Settings.set({ medewerker_ziet_prijzen: e.target.medewerker_ziet_prijzen.checked });
      renderAccount({ success: 'Prijs-instellingen opgeslagen.' });
    });
  }

  // Kostenposten beheren (alleen beheerder)
  const kostenSectie = $('#kostenposten');
  if (kostenSectie) {
    function _kostenPatchOverride(oms, patch) {
      const cur = Object.assign({}, Settings.get('kosten_overrides') || {});
      const entry = Object.assign({}, cur[oms] || {}, patch);
      if (entry.bedrag == null) delete entry.bedrag;
      if (!entry.hidden)        delete entry.hidden;
      if (Object.keys(entry).length === 0) delete cur[oms];
      else                                  cur[oms] = entry;
      Settings.set({ kosten_overrides: cur });
    }
    kostenSectie.querySelectorAll('tbody tr').forEach(tr => {
      const oms = tr.dataset.oms;
      const inp = tr.querySelector('.kb-prijs');
      const btnSave = tr.querySelector('[data-kb-save]');
      const btnReset = tr.querySelector('[data-kb-reset]');
      const btnHide  = tr.querySelector('[data-kb-hide]');
      const btnShow  = tr.querySelector('[data-kb-show]');
      const btnDel   = tr.querySelector('[data-kb-del]');
      if (btnSave) btnSave.addEventListener('click', () => {
        const bedrag = parseEUR(inp.value);
        if (!isFinite(bedrag) || bedrag < 0) {
          Modal.show({ type:'warning', title:'Ongeldige prijs', message:'Vul een geldig bedrag in (bv. 45,00).' });
          return;
        }
        // Bij eigen kostenposten schrijven we direct in kosten_extra, niet override
        const extra = (Settings.get('kosten_extra') || []).slice();
        const idx = extra.findIndex(x => x.omschrijving === oms);
        if (idx >= 0) {
          extra[idx] = Object.assign({}, extra[idx], { bedrag });
          Settings.set({ kosten_extra: extra });
        } else {
          _kostenPatchOverride(oms, { bedrag });
        }
        renderAccount({ success: `Prijs van "${oms}" opgeslagen.` });
      });
      if (btnReset) btnReset.addEventListener('click', () => {
        _kostenPatchOverride(oms, { bedrag: null });
        renderAccount({ success: `Standaardprijs voor "${oms}" hersteld.` });
      });
      if (btnHide) btnHide.addEventListener('click', () => {
        _kostenPatchOverride(oms, { hidden: true });
        renderAccount({ success: `"${oms}" verborgen uit de lijst.` });
      });
      if (btnShow) btnShow.addEventListener('click', () => {
        _kostenPatchOverride(oms, { hidden: false });
        renderAccount({ success: `"${oms}" weer toegevoegd aan de lijst.` });
      });
      if (btnDel) btnDel.addEventListener('click', async () => {
        const ok = await Modal.confirm({
          type:'warning',
          title:'Kostenpost definitief verwijderen?',
          message:`"${oms}" wordt uit je eigen lijst verwijderd. Bestaande kostenposten in dossiers blijven staan.`,
          confirmText:'Verwijderen',
        });
        if (!ok) return;
        const extra = (Settings.get('kosten_extra') || []).filter(x => x.omschrijving !== oms);
        Settings.set({ kosten_extra: extra });
        renderAccount({ success: `"${oms}" verwijderd.` });
      });
    });
    const kbAddForm = $('#kb-add-form');
    if (kbAddForm) kbAddForm.addEventListener('submit', e => {
      e.preventDefault();
      const f = e.target;
      const oms = f.omschrijving.value.trim();
      if (!oms) return;
      const cat = f.categorie.value || 'overig';
      const bedragRaw = f.bedrag.value.trim();
      const bedrag = bedragRaw ? parseEUR(bedragRaw) : null;
      if (bedragRaw && (!isFinite(bedrag) || bedrag < 0)) {
        Modal.show({ type:'warning', title:'Ongeldige prijs', message:'Vul een geldig bedrag in (bv. 45,00) of laat leeg.' });
        return;
      }
      const alle = effectieveKostenPresets({ includeHidden: true });
      if (alle.some(p => (p.omschrijving || '').toLowerCase() === oms.toLowerCase())) {
        Modal.show({ type:'warning', title:'Bestaat al', message:`Er bestaat al een kostenpost met de omschrijving "${oms}". Pas de bestaande post aan in plaats van een nieuwe aan te maken.` });
        return;
      }
      const extra = (Settings.get('kosten_extra') || []).slice();
      extra.push({ omschrijving: oms, categorie: cat, bedrag });
      Settings.set({ kosten_extra: extra });
      renderAccount({ success: `Kostenpost "${oms}" aangemaakt.` });
    });
  }

  // Opdrachtgevers beheer (met drag-and-drop volgorde)
  const opdrForm = $('#opdrachtgever-form');
  if (opdrForm) {
    $('#btn-add-opdrachtgever').addEventListener('click', () => {
      const rows = $('#opdrachtgever-rows');
      const div = document.createElement('div');
      div.className = 'parochie-row opdr-drag-row';
      div.draggable = true;
      div.innerHTML = `
        <span class="drag-grip" title="Sleep om te verplaatsen">≡</span>
        <input type="text" class="opdrachtgever-naam" value="" placeholder="bv. Uitvaartzorg Jansen">
        <button type="button" class="btn-icon" data-action="del-opdrachtgever" title="verwijderen">×</button>`;
      rows.appendChild(div);
      div.querySelector('.opdrachtgever-naam').focus();
    });

    // Drag-and-drop: sleep rijen om ze te herordenen
    const rowsEl = $('#opdrachtgever-rows');
    if (rowsEl) {
      let dragEl = null;
      rowsEl.addEventListener('dragstart', (e) => {
        const row = e.target.closest('.opdr-drag-row');
        if (!row) return;
        dragEl = row;
        row.classList.add('is-dragging');
        try { e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', ''); } catch (_) {}
      });
      rowsEl.addEventListener('dragend', () => {
        if (dragEl) dragEl.classList.remove('is-dragging');
        dragEl = null;
      });
      rowsEl.addEventListener('dragover', (e) => {
        e.preventDefault();
        const na = [...rowsEl.querySelectorAll('.opdr-drag-row:not(.is-dragging)')];
        const boven = na.find(r => {
          const box = r.getBoundingClientRect();
          return e.clientY < box.top + box.height / 2;
        });
        if (!dragEl) return;
        if (boven) rowsEl.insertBefore(dragEl, boven);
        else rowsEl.appendChild(dragEl);
      });
    }
    opdrForm.addEventListener('click', e => {
      const del = e.target.closest('button[data-action="del-opdrachtgever"]');
      if (!del) return;
      const row = del.closest('.parochie-row');
      if (row) row.remove();
    });
    opdrForm.addEventListener('submit', e => {
      e.preventDefault();
      const lijst = $$('#opdrachtgever-rows .parochie-row').map(row => ({
        naam: (row.querySelector('.opdrachtgever-naam').value || '').trim(),
      })).filter(o => o.naam);
      Settings.set({ opdrachtgevers: lijst });
      renderAccount({ success: 'Opdrachtgevers opgeslagen.' });
    });
  }

  // Rouwauto-lijst
  const rauForm = $('#rouwauto-form');
  if (rauForm) rauForm.addEventListener('submit', e => {
    e.preventDefault();
    const lijst = (e.target.rouwauto_lijst.value || '')
      .split('\n').map(s => s.trim()).filter(Boolean);
    Settings.set({ rouwauto_lijst: lijst });
    renderAccount({ success: `Rouwauto's opgeslagen (${lijst.length}).` });
  });

  // Rouwgoederen-opties
  const rgForm = $('#rouwgoederen-form');
  if (rgForm) rgForm.addEventListener('submit', e => {
    e.preventDefault();
    const lijst = (e.target.rouwgoederen_opties.value || '')
      .split('\n').map(s => s.trim()).filter(Boolean);
    Settings.set({ rouwgoederen_opties: lijst });
    renderAccount({ success: `Rouwgoederen-opties opgeslagen (${lijst.length}).` });
  });

  // Parochies + priesters beheer
  const parochieForm = $('#parochie-form');
  if (parochieForm) {
    function makeParochieRow(naam = '', priester = '') {
      const div = document.createElement('div');
      div.className = 'parochie-row';
      div.innerHTML = `
        <input type="text" class="parochie-naam" value="${esc(naam)}" placeholder="bv. Mor Severios — Hengelo">
        <input type="text" class="parochie-priester" value="${esc(priester)}" placeholder="standaard-priester (optioneel)">
        <button type="button" class="btn-icon" data-action="del-parochie" title="verwijderen">×</button>`;
      return div;
    }
    $('#btn-add-parochie').addEventListener('click', () => {
      const rows = $('#parochie-rows');
      const row = makeParochieRow();
      rows.appendChild(row);
      row.querySelector('.parochie-naam').focus();
    });
    parochieForm.addEventListener('click', e => {
      const del = e.target.closest('button[data-action="del-parochie"]');
      if (!del) return;
      const row = del.closest('.parochie-row');
      if (row) row.remove();
    });
    parochieForm.addEventListener('submit', e => {
      e.preventDefault();
      const f = e.target;
      const lijst = $$('#parochie-rows .parochie-row').map(row => ({
        naam: (row.querySelector('.parochie-naam').value || '').trim(),
        priester: (row.querySelector('.parochie-priester').value || '').trim(),
      })).filter(p => p.naam);
      Settings.set({
        parochies: lijst,
        default_kerk_locatie: f.default_kerk_locatie.value.trim() || Settings.defaults.default_kerk_locatie,
        default_begraafplaats: f.default_begraafplaats.value.trim() || Settings.defaults.default_begraafplaats,
      });
      renderAccount({ success: 'Parochies opgeslagen.' });
    });
  }

  // Verzekeringsmaatschappijen + pakketten beheer
  const verzForm = $('#verz-form');
  if (verzForm) {
    function makePakketRow(naam = '', dekking = '') {
      const div = document.createElement('div');
      div.className = 'parochie-row';
      div.innerHTML = `
        <input type="text" class="pakket-naam" value="${esc(naam)}" placeholder="bv. Uitgebreid pakket">
        <input type="text" class="pakket-dekking" value="${esc(dekking)}" inputmode="decimal" placeholder="standaard-dekking €">
        <button type="button" class="btn-icon" data-action="del-pakket" title="verwijderen">×</button>`;
      return div;
    }
    $('#btn-add-pakket').addEventListener('click', () => {
      const rows = $('#pakket-rows');
      const row = makePakketRow();
      rows.appendChild(row);
      row.querySelector('.pakket-naam').focus();
    });
    verzForm.addEventListener('click', e => {
      const del = e.target.closest('button[data-action="del-pakket"]');
      if (!del) return;
      const row = del.closest('.parochie-row');
      if (row) row.remove();
    });
    verzForm.addEventListener('submit', e => {
      e.preventDefault();
      const f = e.target;
      const parseList = txt => txt.split('\n').map(s => s.trim()).filter(Boolean);
      const pakketten = $$('#pakket-rows .parochie-row').map(row => ({
        naam: (row.querySelector('.pakket-naam').value || '').trim(),
        dekking: (row.querySelector('.pakket-dekking').value || '').trim(),
      })).filter(p => p.naam);
      Settings.set({
        verzekering_maatschappijen: parseList(f.maatschappijen.value),
        verzekering_pakketten: pakketten,
      });
      renderAccount({ success: 'Verzekeringslijsten opgeslagen.' });
    });
  }

  // Handtekening-velden beheer
  const sigForm = $('#sig-form');
  if (sigForm) {
    function slug(s) {
      return s.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || 'veld';
    }
    function readSigRows() {
      return $$('#sig-rows .sig-row').map((row, i) => {
        const label = (row.querySelector('.sig-label').value || '').trim() || ('Handtekening ' + (i + 1));
        const required = row.querySelector('.sig-required').checked;
        return { id: slug(label) + '_' + i, label, required };
      });
    }
    $('#btn-add-sig').addEventListener('click', () => {
      const rows = $('#sig-rows');
      const idx = rows.children.length;
      const div = document.createElement('div');
      div.className = 'sig-row';
      div.dataset.idx = idx;
      div.innerHTML = `
        <input type="text" class="sig-label" value="" placeholder="bv. Handtekening getuige">
        <label class="checkbox-inline" style="font-size:.85rem;white-space:nowrap;">
          <input type="checkbox" class="sig-required"> verplicht
        </label>
        <button type="button" class="btn-icon" data-action="del-sig">×</button>`;
      rows.appendChild(div);
      div.querySelector('.sig-label').focus();
    });
    sigForm.addEventListener('click', e => {
      const del = e.target.closest('button[data-action="del-sig"]');
      if (!del) return;
      const row = del.closest('.sig-row');
      if (row) row.remove();
    });
    sigForm.addEventListener('submit', e => {
      e.preventDefault();
      const fields = readSigRows();
      Settings.set({ signature_fields: fields });
      renderAccount({ success: 'Handtekening-velden opgeslagen.' });
    });
  }

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

    $('#btn-reset-splash').addEventListener('click', async () => {
      const ok = await Modal.confirm({ title: 'Welkomscherm herstellen?', message: 'Alle welkomscherm-instellingen worden teruggezet naar de standaard.', confirmText: 'Herstellen' });
      if (!ok) return;
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

  const profileForm = $('#profile-form');
  if (profileForm) {
    profileForm.addEventListener('submit', async e => {
      e.preventDefault();
      const f = e.target;
      const newName = f.full_name.value.trim();
      const newEmail = f.email.value.trim();
      const cur = Auth.current();
      const messages = [];
      let hadError = null;

      // Naam wijzigen indien anders
      const curName = (cur.fullName === cur.email) ? '' : (cur.fullName || '');
      if (newName !== curName) {
        const err = await Auth.updateDisplayName(newName);
        if (err) hadError = 'Naam wijzigen mislukt: ' + err;
        else messages.push('Naam bijgewerkt.');
      }

      // E-mail wijzigen indien anders
      if (!hadError && newEmail && newEmail !== cur.email) {
        const ok = await Modal.confirm({
          type: 'warning',
          title: 'E-mailadres wijzigen?',
          message: `Je krijgt een verificatielink in ${newEmail}. Pas nadat je daarop klikt is het nieuwe adres actief. Doorgaan?`,
          confirmText: 'Ja, verstuur',
          cancelText: 'Annuleren',
        });
        if (ok) {
          const err = await Auth.updateEmail(newEmail);
          if (err) hadError = 'E-mailwijziging mislukt: ' + err;
          else messages.push(`Verificatielink verzonden naar ${newEmail}.`);
        }
      }

      if (hadError) renderAccount({ error: hadError });
      else if (messages.length > 0) {
        // Topbar bijwerken
        const cur2 = Auth.current();
        if (cur2) document.getElementById('user-name').textContent = cur2.fullName || cur2.email;
        renderAccount({ success: messages.join(' ') });
      } else {
        renderAccount(); // niets veranderd
      }
    });
  }

  $('#pw-form').addEventListener('submit', async e => {
    e.preventDefault();
    const f = e.target;
    if (f.nieuw.value !== f.herhaal.value) {
      return Modal.show({ type: 'warning', title: 'Wachtwoorden verschillen',
        message: 'De twee wachtwoorden zijn niet gelijk. Vul ze allebei opnieuw in.' });
    }
    if (f.nieuw.value.length < 8) {
      return Modal.show({ type: 'warning', title: 'Te kort',
        message: 'Kies een wachtwoord van minstens 8 tekens — voor de zekerheid.' });
    }
    const btn = f.querySelector('button[type="submit"]');
    const origText = btn.textContent;
    btn.disabled = true; btn.textContent = 'Bezig...';
    const err = await Auth.changePassword(f.nieuw.value);
    btn.disabled = false; btn.textContent = origText;
    if (err) {
      Modal.show({ type: 'error', title: 'Wijzigen mislukt', message: err });
    } else {
      f.reset();
      Modal.show({ type: 'success', title: 'Wachtwoord gewijzigd',
        message: 'Je nieuwe wachtwoord is meteen actief op alle apparaten waar je bent ingelogd.' });
    }
  });

  // Live opslaggebruik (Supabase) ophalen en tonen met balkjes.
  const opslagBox = $('#opslag-live');
  if (opslagBox && typeof sb !== 'undefined' && navigator.onLine
      && !(typeof Demo !== 'undefined' && Demo.isActive())) {
    (async () => {
      try {
        const { data, error } = await sb.rpc('opslag_gebruik');
        if (error || !data) throw error || new Error('geen data');
        const MB = 1024 * 1024, GB = 1024 * MB;
        const fmtBytes = (b) => b >= GB ? (b / GB).toFixed(2) + ' GB'
                              : b >= MB ? (b / MB).toFixed(1) + ' MB'
                              : Math.max(1, Math.round(b / 1024)) + ' KB';
        const DB_LIMIT = 500 * MB, ST_LIMIT = 1 * GB;
        const dbPct = Math.min(100, (data.db_bytes / DB_LIMIT) * 100);
        const stPct = Math.min(100, (data.storage_bytes / ST_LIMIT) * 100);
        const perDossier = data.dossiers > 0 ? data.storage_bytes / data.dossiers : 0;
        const bar = (pct, kleur) => `
          <div style="height:9px;border-radius:6px;background:var(--border,#e5e0d6);overflow:hidden;margin:.2rem 0 .1rem;">
            <div style="height:100%;width:${pct.toFixed(1)}%;background:${pct >= 90 ? '#c0392b' : pct >= 70 ? '#d68910' : kleur};"></div>
          </div>`;
        // R2-teller: aantal R2-paden in de cache (indicatief; bytes weten we
        // niet direct — daarvoor zou een aparte edge function moeten pollen).
        let r2Count = 0;
        try {
          (Cloud.cache.dossiers || []).forEach(d => {
            ['artsverklaring_pad','overdraagformulier_pad',
             'bezit_oorbellen_foto','bezit_ringen_foto','bezit_armbanden_foto',
             'bezit_ketting_foto','bezit_bril_foto','bezit_horloge_foto']
              .forEach(k => { if (d[k] && typeof R2 !== 'undefined' && R2.isR2(d[k])) r2Count++; });
            if (Array.isArray(d.extra_bezittingen)) {
              d.extra_bezittingen.forEach(b => { if (b && b.foto_pad && typeof R2 !== 'undefined' && R2.isR2(b.foto_pad)) r2Count++; });
            }
          });
        } catch (_) {}
        opslagBox.innerHTML = `
          <h3 style="margin:.25rem 0 .5rem;font-size:.95rem;">Opslaggebruik</h3>
          <div class="muted small" style="display:flex;justify-content:space-between;">
            <span>Database · Supabase (tekstgegevens)</span><span>${fmtBytes(data.db_bytes)} / 500 MB</span>
          </div>
          ${bar(dbPct, 'var(--primary,#2563eb)')}
          <div class="muted small" style="display:flex;justify-content:space-between;margin-top:.5rem;">
            <span>Bestanden · Supabase Storage (${data.files} bestand${data.files === 1 ? '' : 'en'})</span><span>${fmtBytes(data.storage_bytes)} / 1 GB</span>
          </div>
          ${bar(stPct, 'var(--accent,#c9a24a)')}
          <div class="muted small" style="display:flex;justify-content:space-between;margin-top:.5rem;">
            <span>Bestanden · Cloudflare R2 (${r2Count} bestand${r2Count === 1 ? '' : 'en'})</span><span>ruimte: 10 GB</span>
          </div>
          ${bar(Math.min(100, r2Count > 0 ? 1 : 0), '#f38020')}
          <p class="muted small" style="margin:.5rem 0 0;">
            ${data.dossiers} dossier${data.dossiers === 1 ? '' : 's'} in gebruik${perDossier > 0 ? ` · gemiddeld ± ${fmtBytes(perDossier)} aan scans/foto's per dossier` : ' · nog geen scans geüpload'}.
            Nieuwe uploads gaan naar Cloudflare R2 (10 GB, EU-jurisdictie). Bestanden op Supabase Storage kun je via de knop hieronder migreren.
          </p>`;
      } catch (e) {
        opslagBox.innerHTML = `<p class="muted small">Opslaggebruik kon niet worden geladen${e && e.message ? ' (' + esc(e.message) + ')' : ''}.</p>`;
      }
    })();
  }

  // Automatische backups tonen (alleen beheerder — RLS zorgt daar server-side voor)
  const backupItems = $('#backup-items');
  if (backupItems && typeof sb !== 'undefined' && navigator.onLine
      && !(typeof Demo !== 'undefined' && Demo.isActive())) {
    (async () => {
      try {
        const { data, error } = await sb.storage.from('backups').list('', {
          limit: 20, sortBy: { column: 'name', order: 'desc' },
        });
        if (error) throw error;
        if (!data || !data.length) { backupItems.innerHTML = '<li>Nog geen backup gemaakt — verschijnt na de eerstvolgende maandag om 03:00.</li>'; return; }
        backupItems.innerHTML = data.map(f => {
          const kb = f.metadata && f.metadata.size ? Math.round(f.metadata.size / 1024) : null;
          return `<li style="display:flex;justify-content:space-between;gap:.5rem;padding:.2rem 0;">
            <span><strong>${esc(f.name)}</strong>${kb ? ' · ' + kb + ' KB' : ''}</span>
            <button type="button" class="link-btn" data-backup-dl="${esc(f.name)}">⬇ Download</button>
          </li>`;
        }).join('');
        backupItems.querySelectorAll('[data-backup-dl]').forEach(btn => {
          btn.addEventListener('click', async () => {
            const naam = btn.getAttribute('data-backup-dl');
            btn.disabled = true; btn.textContent = '…';
            try {
              const { data: sign, error: sErr } = await sb.storage.from('backups').createSignedUrl(naam, 300);
              if (sErr || !sign) throw sErr || new Error('Geen signed URL');
              window.open(sign.signedUrl, '_blank');
            } catch (e) {
              Modal.show({ type:'error', title:'Download mislukt', message: (e && e.message) || String(e) });
            } finally {
              btn.disabled = false; btn.textContent = '⬇ Download';
            }
          });
        });
      } catch (e) {
        backupItems.innerHTML = `<li>Backups niet geladen (${esc(e.message || String(e))}).</li>`;
      }
    })();
  }

  const syncBtn = $('#btn-sync-now');
  if (syncBtn) {
    syncBtn.addEventListener('click', async () => {
      syncBtn.disabled = true;
      const orig = syncBtn.textContent;
      syncBtn.textContent = 'Bezig met synchroniseren...';
      try {
        await Cloud.loadAll();
        await Settings.loadFromCloud();
        Branding.apply();
        renderAccount({ success: 'Synchronisatie voltooid — alle gegevens zijn vers opgehaald.' });
      } catch (e) {
        syncBtn.disabled = false;
        syncBtn.textContent = orig;
        renderAccount({ error: 'Synchronisatie mislukt: ' + (e.message || 'geen verbinding') });
      }
    });
  }

  $('#btn-export').addEventListener('click', () => {
    const data = {
      dossiers: DB.list(KEYS.DOSSIERS),
      kosten: DB.list(KEYS.KOSTEN),
      notities: DB.list(KEYS.NOTITIES),
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

// ─── Logboek (audit-log) — alleen beheerder ───────────────────────────────
async function renderLogboek() {
  if (typeof Auth !== 'undefined' && !Auth.isBeheerder()) {
    $('#view').innerHTML = `<div class="page"><section class="card narrow"><h1>Logboek</h1>
      <p>Het logboek is alleen zichtbaar voor beheerders.</p>
      <a href="#/account" class="btn">← Terug naar Account</a></section></div>`;
    return;
  }
  const url = new URL(location.href);
  const params = url.hash.split('?')[1] ? new URLSearchParams(url.hash.split('?')[1]) : new URLSearchParams();
  const filterActie = params.get('actie') || '';
  const filterTabel = params.get('tabel') || '';

  $('#view').innerHTML = `
    <div class="page">
      <div class="page-head">
        <div>
          <a href="#/account" class="back-link">← Account</a>
          <h1>Logboek</h1>
          <p class="muted">Volledig audit-log — mutaties, logins, profielwissels. Nieuwste bovenaan.</p>
        </div>
      </div>
      <form id="logboek-filters" class="dossiers-controls" style="margin-bottom:1rem;">
        <select name="actie" class="dossiers-control">
          <option value="">Alle acties</option>
          ${['insert','update','delete','login','logout','profiel'].map(a =>
            `<option value="${a}" ${filterActie === a ? 'selected' : ''}>${a}</option>`).join('')}
        </select>
        <select name="tabel" class="dossiers-control">
          <option value="">Alle tabellen</option>
          ${['dossiers','kosten','notities','planning_items','kist_voorraad','profiles'].map(t =>
            `<option value="${t}" ${filterTabel === t ? 'selected' : ''}>${t}</option>`).join('')}
        </select>
        <button type="submit" class="dossiers-control dossiers-filter-btn">Filter</button>
        ${(filterActie || filterTabel) ? '<a href="#/logboek" class="dossiers-wis">↺ Wis</a>' : ''}
      </form>
      <div class="dossiers-kaart">
        <div id="logboek-body" style="padding:1rem;">
          <p class="muted">Laden…</p>
        </div>
      </div>
    </div>`;

  const filterForm = $('#logboek-filters');
  if (filterForm) filterForm.addEventListener('submit', e => {
    e.preventDefault();
    const p = new URLSearchParams();
    if (e.target.actie.value) p.set('actie', e.target.actie.value);
    if (e.target.tabel.value) p.set('tabel', e.target.tabel.value);
    location.hash = '#/logboek' + (p.toString() ? '?' + p.toString() : '');
  });

  const body = $('#logboek-body');
  try {
    const rows = await AuditLog.fetch({
      limit: 500,
      actie: filterActie || null,
      tabel: filterTabel || null,
    });
    if (!rows.length) {
      body.innerHTML = '<p class="muted center" style="padding:1rem;">Nog geen logboek-entries voor deze filters.</p>';
      return;
    }
    // Groepeer op datum voor leesbaarheid ("Vandaag", "Gisteren", "9 juli 2026")
    const groepen = new Map();
    rows.forEach(r => {
      const dag = _logDagLabel(r.created_at);
      if (!groepen.has(dag)) groepen.set(dag, []);
      groepen.get(dag).push(r);
    });
    body.innerHTML = `<ul class="logboek-list">
      ${[...groepen.entries()].map(([dag, items]) => `
        <li class="logboek-dag">
          <h3 class="logboek-dag-kop">${esc(dag)}</h3>
          <ol class="logboek-items">
            ${items.map(r => {
              const tijd = r.created_at ? new Date(r.created_at).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' }) : '';
              const wieNaam = r.profiel_naam || (r.user_email ? r.user_email.split('@')[0] : 'Onbekend');
              const zin = _logZinSchrijf(r, wieNaam);
              const kleur = logActieKleur(r.actie);
              return `<li class="logboek-item logboek-item-${esc(kleur)}">
                <span class="logboek-tijd">${esc(tijd)}</span>
                <span class="logboek-punt" aria-hidden="true"></span>
                <span class="logboek-zin">${zin}</span>
              </li>`;
            }).join('')}
          </ol>
        </li>`).join('')}
    </ul>
    <p class="muted small" style="padding:.75rem 1rem;">${rows.length} entries getoond.</p>`;
  } catch (e) {
    body.innerHTML = `<p class="alert alert-error">Logboek laden mislukt: ${esc(e.message || String(e))}</p>`;
  }
}

// Datum-label voor de dag-koppen (Vandaag / Gisteren / '9 juli 2026')
function _logDagLabel(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  const nu = new Date(); nu.setHours(0,0,0,0);
  const dan = new Date(d); dan.setHours(0,0,0,0);
  const dagenGeleden = Math.floor((nu.getTime() - dan.getTime()) / 86400000);
  if (dagenGeleden === 0) return 'Vandaag';
  if (dagenGeleden === 1) return 'Gisteren';
  return d.toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

// Zin bouwen zoals "Kevin heeft dossier #12 aangemaakt"
function _logZinSchrijf(r, wieNaam) {
  const wie = `<strong>${esc(wieNaam)}</strong>`;
  const detail = r.detail || {};
  const tabelLabel = _logTabelLabel(r.tabel);
  const id = r.record_id || '';
  const link = id && r.tabel === 'dossiers' ? ` <a href="#/dossiers/${esc(id)}">#${esc(id)}</a>` : (id ? ` <span class="muted">#${esc(id)}</span>` : '');
  const dossierRef = (r.tabel === 'dossiers') ? '' : (detail.row && detail.row.dossier_id ? ` (dossier <a href="#/dossiers/${esc(detail.row.dossier_id)}">#${esc(detail.row.dossier_id)}</a>)` : '');

  switch (r.actie) {
    case 'login':
      return `${wie} heeft <em>ingelogd</em>${detail.email ? ' als <span class="muted">' + esc(detail.email) + '</span>' : ''}.`;
    case 'logout':
      return `${wie} heeft <em>uitgelogd</em>.`;
    case 'profiel':
      return `${wie} is <em>overgeschakeld naar profiel</em> <strong>${esc(detail.naam || wieNaam)}</strong>.`;
    case 'insert':
      return `${wie} heeft een nieuw ${esc(tabelLabel)}${link} <em>aangemaakt</em>${dossierRef}.`;
    case 'delete':
      return `${wie} heeft ${esc(tabelLabel)}${link} <em>verwijderd</em>${dossierRef}.`;
    case 'voorraad': {
      const naam = detail.naam || id || 'kist';
      const delta = detail.delta;
      const nu  = (detail.nu != null) ? detail.nu : (detail.was != null && typeof delta === 'number' ? detail.was + delta : null);
      const was = detail.was;
      const dossierLink = detail.dossier_id
        ? ` (dossier <a href="#/dossiers/${esc(detail.dossier_id)}">#${esc(detail.dossier_id)}</a>)`
        : '';
      const reden = detail.reden ? ` — <span class="muted small">${esc(detail.reden)}</span>` : '';
      if (typeof delta === 'number' && delta !== 0) {
        const sign = delta > 0 ? '+' : '';
        const stukTxt = (was != null && nu != null) ? ` (${was} → ${nu})` : '';
        return `${wie} — <em>voorraad</em> <strong>${esc(naam)}</strong> <strong>${sign}${delta}</strong>${stukTxt}${dossierLink}${reden}.`;
      }
      // Handmatige upsert: was/nu-objecten, toon aantal en min_aantal
      const wasA = (was && typeof was === 'object') ? was.aantal : was;
      const nuA  = (nu  && typeof nu  === 'object') ? nu.aantal  : nu;
      return `${wie} heeft voorraad van <strong>${esc(naam)}</strong> bijgewerkt${(wasA != null && nuA != null) ? ` (${wasA} → ${nuA})` : ''}${reden}.`;
    }
    case 'update': {
      // Toon de daadwerkelijk gewijzigde velden
      const oud = detail.oud || {};
      const kortelijst = Object.keys(oud).slice(0, 4);
      if (!kortelijst.length) {
        return `${wie} heeft ${esc(tabelLabel)}${link} <em>bijgewerkt</em>${dossierRef}.`;
      }
      const veldenTxt = kortelijst.map(k => {
        const v = oud[k];
        const was = _fmtWaarde(v && v.was);
        const nu  = _fmtWaarde(v && v.nu);
        return `<span class="log-veld"><strong>${esc(_veldLabel(k))}</strong>: ${esc(was)} → ${esc(nu)}</span>`;
      }).join(', ');
      const meer = Object.keys(oud).length > kortelijst.length ? ` (+${Object.keys(oud).length - kortelijst.length} meer)` : '';
      return `${wie} heeft ${esc(tabelLabel)}${link} <em>bijgewerkt</em>: ${veldenTxt}${meer}${dossierRef}.`;
    }
    default:
      return `${wie} — <em>${esc(r.actie)}</em> ${esc(tabelLabel)}${link}`;
  }
}
function _logTabelLabel(t) {
  return ({
    dossiers: 'dossier',
    kosten: 'kostenpost',
    notities: 'notitie',
    planning_items: 'planning-item',
    kist_voorraad: 'kist-voorraad',
    profiles: 'profiel',
    documenten: 'document',
  })[t] || (t || 'item');
}
function _veldLabel(k) {
  return ({
    status: 'status',
    kist_type: 'kist',
    rouwauto: 'rouwauto',
    opbaring_type: 'ophalen/thuis',
    opdrachtgever_naam: 'opdrachtgever',
    bedrag: 'bedrag',
    aantal: 'aantal',
    betaald: 'betaald',
    thuis_opbaren_datum: 'startdatum thuis',
    gearchiveerd: 'gearchiveerd',
  })[k] || k;
}
function _fmtWaarde(v) {
  if (v == null || v === '') return '—';
  if (v === true) return 'ja';
  if (v === false) return 'nee';
  if (typeof v === 'object') {
    try { const s = JSON.stringify(v); return s.length > 40 ? s.slice(0, 40) + '…' : s; }
    catch (_) { return '[object]'; }
  }
  const s = String(v);
  return s.length > 40 ? s.slice(0, 40) + '…' : s;
}
function logActieKleur(a) {
  switch (a) {
    case 'insert':   return 'green';
    case 'update':   return 'amber';
    case 'delete':   return 'red';
    case 'login':    return 'blue';
    case 'logout':   return 'grey';
    case 'profiel':  return 'blue';
    case 'voorraad': return 'amber';
    default:         return 'grey';
  }
}
