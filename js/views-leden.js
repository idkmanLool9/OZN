// Ledenadministratie — gezinnen (huishoudens) + leden (personen).
// De centrale ledenregistratie: gezinnen met een gezinsnummer, waaraan
// uitvaartdossiers gekoppeld kunnen worden, elk met één of meer leden.

// ─── Helpers ────────────────────────────────────────────────────────────────
function ledenVanGezin(gezinId) {
  const rel = { hoofd: 0, partner: 1, kind: 2, inwonend: 3, overig: 4 };
  return DB.where(KEYS.LEDEN, l => l.gezin_id === gezinId).sort((a, b) => {
    const ra = rel[a.relatie] ?? 9, rb = rel[b.relatie] ?? 9;
    if (ra !== rb) return ra - rb;
    return (a.geboortedatum || '').localeCompare(b.geboortedatum || '');
  });
}
function lidNaam(l) {
  return [l.voornaam, l.achternaam].filter(Boolean).join(' ') || '(naamloos lid)';
}
function berekenLeeftijd(dob, overlijden) {
  if (!dob) return null;
  const d = new Date(dob);
  if (isNaN(d)) return null;
  const eind = overlijden ? new Date(overlijden) : new Date();
  let jr = eind.getFullYear() - d.getFullYear();
  const m = eind.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && eind.getDate() < d.getDate())) jr--;
  return jr >= 0 && jr < 130 ? jr : null;
}
const RELATIE_LABEL = { hoofd: 'Gezinshoofd', partner: 'Partner', kind: 'Kind', inwonend: 'Inwonend', overig: 'Overig' };
function _persoonStatusPill(status) {
  const map = {
    actief:    ['#e7f5ec', '#1c7a43', 'Actief'],
    overleden: ['#eee',    '#555',    'Overleden'],
    verhuisd:  ['#fdf2e2', '#9a6a1a', 'Verhuisd'],
    inactief:  ['#eee',    '#555',    'Inactief'],
  };
  const s = map[status] || map.actief;
  return `<span style="display:inline-block;padding:.1rem .5rem;border-radius:999px;font-size:.72rem;font-weight:600;background:${s[0]};color:${s[1]};">${esc(s[2])}</span>`;
}
function parochieOpties(geselecteerd) {
  let lijst = [];
  try {
    const p = Settings.get('parochies');
    if (Array.isArray(p)) lijst = p.map(x => (typeof x === 'string' ? x : x.naam)).filter(Boolean);
  } catch (_) {}
  if (!lijst.length && typeof PAROCHIES !== 'undefined') lijst = PAROCHIES.slice();
  const opts = ['<option value="">— parochie —</option>']
    .concat(lijst.map(n => `<option value="${esc(n)}" ${geselecteerd === n ? 'selected' : ''}>${esc(n)}</option>`));
  // Bewaar een bestaande waarde die niet in de lijst staat
  if (geselecteerd && !lijst.includes(geselecteerd)) {
    opts.push(`<option value="${esc(geselecteerd)}" selected>${esc(geselecteerd)}</option>`);
  }
  return opts.join('');
}
function volgendGezinsnummer() {
  let max = 0;
  for (const g of DB.list(KEYS.GEZINNEN)) {
    const m = String(g.gezinsnummer || '').match(/(\d+)/);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  return 'G-' + String(max + 1).padStart(4, '0');
}

// ─── Lijst van gezinnen ───────────────────────────────────────────────────────
function renderLedenList() {
  const url = new URL(location.href);
  const q = (url.hash.split('?')[1] ? new URLSearchParams(url.hash.split('?')[1]).get('q') : '') || '';

  let gezinnen = DB.list(KEYS.GEZINNEN);
  if (q) {
    const ql = q.toLowerCase();
    const gezinIdsMetLid = new Set(
      DB.where(KEYS.LEDEN, l => lidNaam(l).toLowerCase().includes(ql) || (l.doopnaam || '').toLowerCase().includes(ql))
        .map(l => l.gezin_id)
    );
    gezinnen = gezinnen.filter(g =>
      [g.familienaam, g.gezinsnummer, g.parochie, g.woonplaats, g.adres, g.telefoon, g.email]
        .some(v => v && String(v).toLowerCase().includes(ql)) || gezinIdsMetLid.has(g.id));
  }
  gezinnen = gezinnen.slice().sort((a, b) =>
    (a.familienaam || '').localeCompare(b.familienaam || '', 'nl') ||
    (a.gezinsnummer || '').localeCompare(b.gezinsnummer || ''));

  const totaalLeden = DB.list(KEYS.LEDEN).length;

  $('#view').innerHTML = `
    <div class="page">
      <div class="page-head">
        <div>
          <h1>Leden</h1>
          <p class="muted">Ledenadministratie van de parochie — gezinnen en personen.</p>
        </div>
        <a href="#/leden/nieuw" class="btn btn-primary">+ Nieuw gezin</a>
      </div>

      <div class="stat-grid">
        <div class="stat-card"><div class="stat-label">Gezinnen</div><div class="stat-value">${DB.list(KEYS.GEZINNEN).length}</div></div>
        <div class="stat-card stat-blue"><div class="stat-label">Leden</div><div class="stat-value">${totaalLeden}</div></div>
      </div>

      <form class="dossiers-filterbar" id="leden-filter">
        <div class="catalog-search">
          <span class="catalog-search-icon">🔍</span>
          <input type="search" name="q" value="${esc(q)}" placeholder="Zoek op familienaam, gezinsnummer, parochie of lid…" autocomplete="off">
        </div>
        <button type="submit" class="dossiers-control dossiers-filter-btn">Zoeken</button>
        ${q ? '<a href="#/leden" class="dossiers-wis">↺ Wis</a>' : ''}
      </form>

      ${gezinnen.length === 0
        ? `<div class="dossiers-kaart"><p class="muted center" style="padding:2.5rem;">${q ? 'Geen gezinnen gevonden.' : 'Nog geen gezinnen. Klik op “+ Nieuw gezin” om te beginnen.'}</p></div>`
        : `<div class="dossiers-kaart">
            <table class="table dossiers-table">
              <thead><tr>
                <th>Gezinsnr.</th><th>Familienaam</th><th>Parochie</th><th>Woonplaats</th><th>Leden</th><th>Laatst gewijzigd</th><th aria-hidden="true"></th>
              </tr></thead>
              <tbody>
                ${gezinnen.map(g => {
                  const n = DB.where(KEYS.LEDEN, l => l.gezin_id === g.id).length;
                  return `<tr data-id="${g.id}">
                    <td><a href="#/leden/${g.id}" class="dossier-link">${esc(g.gezinsnummer || '—')}</a></td>
                    <td><strong>${esc(g.familienaam || '—')}</strong></td>
                    <td>${esc(g.parochie || '—')}</td>
                    <td>${esc(g.woonplaats || '—')}</td>
                    <td>${n}</td>
                    <td><span class="muted small">${esc(fmtRelative(g.updated_at || g.created_at))}${g.bijgewerkt_door ? '<br>- ' + esc(g.bijgewerkt_door) : ''}</span></td>
                    <td class="dossiers-chevron" aria-hidden="true">›</td>
                  </tr>`;
                }).join('')}
              </tbody>
            </table>
          </div>`}
    </div>`;

  $('#leden-filter').addEventListener('submit', e => {
    e.preventDefault();
    const val = e.target.q.value.trim();
    location.hash = '#/leden' + (val ? '?q=' + encodeURIComponent(val) : '');
  });
  $$('#view tr[data-id]').forEach(tr => {
    tr.addEventListener('click', e => {
      if (e.target.closest('a, button')) return;
      Router.go('/leden/' + tr.getAttribute('data-id'));
    });
  });
}

// ─── Gezin-detail ─────────────────────────────────────────────────────────────
function renderGezinDetail(params) {
  const id = parseInt(params.id, 10);
  const g = DB.byId(KEYS.GEZINNEN, id);
  if (!g) return render404();

  const leden = ledenVanGezin(id);
  const dossiers = g.gezinsnummer
    ? DB.where(KEYS.DOSSIERS, d => d.gezinsnummer && d.gezinsnummer === g.gezinsnummer)
    : [];

  const infoRij = (label, val) => val
    ? `<div><dt>${esc(label)}</dt><dd>${esc(val)}</dd></div>` : '';

  $('#view').innerHTML = `
    <div class="page">
      <div class="page-head no-print">
        <div>
          <a href="#/leden" class="back-link">← Terug naar leden</a>
          <h1>${esc(g.familienaam || 'Gezin')} ${_persoonStatusPill(g.status)}</h1>
          <p class="muted">Gezinsnummer <strong>${esc(g.gezinsnummer || '—')}</strong>${g.parochie ? ' · ' + esc(g.parochie) : ''}</p>
        </div>
        <div class="page-actions">
          <a href="#/leden/${g.id}/bewerk" class="btn btn-ghost">✎ Bewerk gezin</a>
          <button type="button" class="btn btn-primary" id="btn-lid-nieuw">+ Lid toevoegen</button>
        </div>
      </div>

      <div class="card">
        <h2>Gezinsgegevens</h2>
        <dl class="dl">
          ${infoRij('Adres', [g.adres, [g.postcode, g.woonplaats].filter(Boolean).join('  ')].filter(Boolean).join(', '))}
          ${infoRij('Telefoon', g.telefoon)}
          ${infoRij('E-mail', g.email)}
          ${infoRij('Parochie', g.parochie)}
          ${infoRij('Status', ({actief:'Actief',inactief:'Inactief',verhuisd:'Verhuisd'})[g.status] || g.status)}
        </dl>
        ${g.notities ? `<p class="muted" style="margin-top:.5rem;white-space:pre-wrap;">${esc(g.notities)}</p>` : ''}
      </div>

      <div id="lid-form-mount"></div>

      <div class="card">
        <h2>Leden (${leden.length})</h2>
        ${leden.length === 0
          ? '<p class="muted">Nog geen leden in dit gezin. Klik op “+ Lid toevoegen”.</p>'
          : `<div class="leden-cards">${leden.map(lidCardHTML).join('')}</div>`}
      </div>

      ${dossiers.length ? `
        <div class="card">
          <h2>Gekoppelde uitvaartdossiers</h2>
          <p class="muted small">Dossiers met hetzelfde gezinsnummer.</p>
          <ul class="gekoppelde-dossiers">
            ${dossiers.map(d => `<li><a href="#/dossiers/${d.id}">${esc(d.dossier_nummer || ('#' + d.id))}</a> — ${esc(fullName(d) || '—')}${d.uitvaart_datum ? ' <span class="muted small">(' + esc(fmtDate(d.uitvaart_datum)) + ')</span>' : ''}</li>`).join('')}
          </ul>
        </div>` : ''}
    </div>`;

  $('#btn-lid-nieuw').addEventListener('click', () => toonLidForm(g.id, null));
  $$('#view [data-lid-edit]').forEach(b =>
    b.addEventListener('click', () => toonLidForm(g.id, parseInt(b.dataset.lidEdit, 10))));
  $$('#view [data-lid-del]').forEach(b =>
    b.addEventListener('click', async () => {
      const lid = DB.byId(KEYS.LEDEN, parseInt(b.dataset.lidDel, 10));
      if (!lid) return;
      const ok = await Modal.confirm({ title: 'Lid verwijderen?', message: `Weet je zeker dat je ${lidNaam(lid)} uit dit gezin wilt verwijderen?`, confirmText: 'Verwijderen' });
      if (!ok) return;
      try { await DB.remove(KEYS.LEDEN, lid.id); renderGezinDetail({ id }); } catch (_) {}
    }));
}

function lidCardHTML(l) {
  const leeft = berekenLeeftijd(l.geboortedatum, l.status === 'overleden' ? l.overlijdensdatum : null);
  const regels = [];
  if (l.relatie) regels.push(RELATIE_LABEL[l.relatie] || l.relatie);
  if (l.geboortedatum) regels.push('Geb. ' + fmtDate(l.geboortedatum) + (leeft != null ? ` (${leeft} jr)` : ''));
  if (l.doopdatum) regels.push('Gedoopt ' + fmtDate(l.doopdatum));
  if (l.telefoon) regels.push('☎ ' + l.telefoon);
  if (l.email) regels.push('✉ ' + l.email);
  if (l.status === 'overleden' && l.overlijdensdatum) regels.push('Overleden ' + fmtDate(l.overlijdensdatum));
  return `
    <div class="lid-card">
      <div class="lid-card-body">
        <div class="lid-card-top">
          <strong>${esc(lidNaam(l))}</strong>
          ${l.doopnaam ? `<span class="muted small">· doopnaam ${esc(l.doopnaam)}</span>` : ''}
          ${_persoonStatusPill(l.status)}
        </div>
        <div class="muted small">${regels.map(esc).join(' · ')}</div>
        ${l.notities ? `<div class="muted small" style="margin-top:.25rem;white-space:pre-wrap;">${esc(l.notities)}</div>` : ''}
      </div>
      <div class="lid-card-acties">
        <button type="button" class="btn btn-sm btn-ghost" data-lid-edit="${l.id}">✎</button>
        <button type="button" class="btn btn-sm btn-ghost" data-lid-del="${l.id}" title="Verwijderen">🗑</button>
      </div>
    </div>`;
}

// Inline lid-formulier (toevoegen of bewerken) in de gezin-detailpagina
function toonLidForm(gezinId, lidId) {
  const l = lidId ? (DB.byId(KEYS.LEDEN, lidId) || {}) : {};
  const mount = $('#lid-form-mount');
  const veld = (name, label, val, type = 'text', extra = '') =>
    `<label><span>${esc(label)}</span><input type="${type}" name="${name}" value="${esc(val || '')}" ${extra}></label>`;
  const sel = (name, label, val, opts) =>
    `<label><span>${esc(label)}</span><select name="${name}">${opts.map(o =>
      `<option value="${esc(o[0])}" ${val === o[0] ? 'selected' : ''}>${esc(o[1])}</option>`).join('')}</select></label>`;

  mount.innerHTML = `
    <div class="card" id="lid-form-card">
      <h2>${lidId ? 'Lid bewerken' : 'Nieuw lid'}</h2>
      <form id="lid-form" class="form" autocomplete="off">
        <div class="grid-2" style="gap:.75rem;">
          ${veld('voornaam', 'Voornaam', l.voornaam)}
          ${veld('achternaam', 'Achternaam', l.achternaam)}
        </div>
        <div class="grid-2" style="gap:.75rem;">
          ${veld('doopnaam', 'Doopnaam', l.doopnaam)}
          ${sel('geslacht', 'Geslacht', l.geslacht || '', [['', '—'], ['man', 'Man'], ['vrouw', 'Vrouw']])}
        </div>
        <div class="grid-2" style="gap:.75rem;">
          ${sel('relatie', 'Relatie', l.relatie || 'hoofd', [['hoofd', 'Gezinshoofd'], ['partner', 'Partner'], ['kind', 'Kind'], ['inwonend', 'Inwonend'], ['overig', 'Overig']])}
          ${sel('status', 'Status', l.status || 'actief', [['actief', 'Actief'], ['overleden', 'Overleden'], ['verhuisd', 'Verhuisd']])}
        </div>
        <div class="grid-2" style="gap:.75rem;">
          ${veld('geboortedatum', 'Geboortedatum', l.geboortedatum, 'date')}
          ${veld('geboorteplaats', 'Geboorteplaats', l.geboorteplaats)}
        </div>
        <div class="grid-2" style="gap:.75rem;">
          ${veld('doopdatum', 'Doopdatum', l.doopdatum, 'date')}
          ${veld('doopplaats', 'Doopplaats', l.doopplaats)}
        </div>
        <div class="grid-2" style="gap:.75rem;">
          ${veld('telefoon', 'Telefoon', l.telefoon)}
          ${veld('email', 'E-mail', l.email, 'email')}
        </div>
        <label id="lid-overlijden-wrap" style="${(l.status === 'overleden') ? '' : 'display:none;'}">
          <span>Overlijdensdatum</span>
          <input type="date" name="overlijdensdatum" value="${esc(l.overlijdensdatum || '')}">
        </label>
        <label><span>Notities</span><textarea name="notities" rows="2">${esc(l.notities || '')}</textarea></label>
        <div class="form-actions" style="justify-content:flex-end;gap:.5rem;">
          <button type="button" class="btn btn-ghost" id="lid-annuleer">Annuleren</button>
          <button type="submit" class="btn btn-primary">${lidId ? 'Opslaan' : 'Toevoegen'}</button>
        </div>
      </form>
    </div>`;

  const card = $('#lid-form-card');
  card.scrollIntoView({ behavior: 'smooth', block: 'center' });
  const form = $('#lid-form');
  // Overlijdensdatum tonen zodra status = overleden
  form.status.addEventListener('change', () => {
    $('#lid-overlijden-wrap').style.display = form.status.value === 'overleden' ? '' : 'none';
  });
  $('#lid-annuleer').addEventListener('click', () => { mount.innerHTML = ''; });
  form.addEventListener('submit', async e => {
    e.preventDefault();
    const f = e.target;
    const data = {
      gezin_id: gezinId,
      voornaam: f.voornaam.value.trim(),
      achternaam: f.achternaam.value.trim(),
      doopnaam: f.doopnaam.value.trim(),
      geslacht: f.geslacht.value || null,
      relatie: f.relatie.value || null,
      status: f.status.value || 'actief',
      geboortedatum: f.geboortedatum.value || null,
      geboorteplaats: f.geboorteplaats.value.trim(),
      doopdatum: f.doopdatum.value || null,
      doopplaats: f.doopplaats.value.trim(),
      telefoon: f.telefoon.value.trim(),
      email: f.email.value.trim(),
      overlijdensdatum: f.status.value === 'overleden' ? (f.overlijdensdatum.value || null) : null,
      notities: f.notities.value.trim(),
    };
    if (!data.voornaam && !data.achternaam) {
      Modal.show({ type: 'warning', title: 'Naam nodig', message: 'Vul minstens een voor- of achternaam in.' });
      return;
    }
    const btn = f.querySelector('button[type=submit]');
    btn.disabled = true; btn.textContent = 'Bezig…';
    try {
      if (lidId) await DB.update(KEYS.LEDEN, lidId, data);
      else await DB.insert(KEYS.LEDEN, data);
      renderGezinDetail({ id: gezinId });
    } catch (_) {
      btn.disabled = false; btn.textContent = lidId ? 'Opslaan' : 'Toevoegen';
    }
  });
}

// ─── Gezin toevoegen / bewerken ───────────────────────────────────────────────
function renderGezinForm(params) {
  const isNew = !params.id;
  const g = isNew ? { status: 'actief', gezinsnummer: volgendGezinsnummer() } : DB.byId(KEYS.GEZINNEN, parseInt(params.id, 10));
  if (!isNew && !g) return render404();

  $('#view').innerHTML = `
    <div class="page">
      <div class="page-head">
        <div>
          <a href="${isNew ? '#/leden' : '#/leden/' + g.id}" class="back-link">← Terug</a>
          <h1>${isNew ? 'Nieuw gezin' : 'Gezin bewerken'}</h1>
        </div>
      </div>

      <div class="card narrow">
        <form id="gezin-form" class="form" autocomplete="off">
          <div class="grid-2" style="gap:.75rem;">
            <label><span>Gezinsnummer</span><input type="text" name="gezinsnummer" value="${esc(g.gezinsnummer || '')}" placeholder="bv. G-0001"></label>
            <label><span>Familienaam</span><input type="text" name="familienaam" value="${esc(g.familienaam || '')}" placeholder="bv. Aydın"></label>
          </div>
          <label><span>Parochie</span><select name="parochie">${parochieOpties(g.parochie || '')}</select></label>
          <label><span>Adres</span><input type="text" name="adres" value="${esc(g.adres || '')}"></label>
          <div class="grid-2" style="gap:.75rem;">
            <label><span>Postcode</span><input type="text" name="postcode" value="${esc(g.postcode || '')}"></label>
            <label><span>Woonplaats</span><input type="text" name="woonplaats" value="${esc(g.woonplaats || '')}"></label>
          </div>
          <div class="grid-2" style="gap:.75rem;">
            <label><span>Telefoon</span><input type="text" name="telefoon" value="${esc(g.telefoon || '')}"></label>
            <label><span>E-mail</span><input type="email" name="email" value="${esc(g.email || '')}"></label>
          </div>
          <label><span>Status</span><select name="status">
            <option value="actief" ${g.status === 'actief' ? 'selected' : ''}>Actief</option>
            <option value="inactief" ${g.status === 'inactief' ? 'selected' : ''}>Inactief</option>
            <option value="verhuisd" ${g.status === 'verhuisd' ? 'selected' : ''}>Verhuisd</option>
          </select></label>
          <label><span>Notities</span><textarea name="notities" rows="3">${esc(g.notities || '')}</textarea></label>
          <div class="form-actions" style="justify-content:${isNew ? 'flex-end' : 'space-between'};gap:.5rem;">
            ${isNew ? '' : '<button type="button" class="btn btn-ghost" id="btn-gezin-del" style="color:var(--danger,#b3261e);">Verwijder gezin</button>'}
            <span style="display:flex;gap:.5rem;">
              <a href="${isNew ? '#/leden' : '#/leden/' + g.id}" class="btn btn-ghost">Annuleren</a>
              <button type="submit" class="btn btn-primary">${isNew ? 'Gezin aanmaken' : 'Opslaan'}</button>
            </span>
          </div>
        </form>
      </div>
    </div>`;

  $('#gezin-form').addEventListener('submit', async e => {
    e.preventDefault();
    const f = e.target;
    const data = {
      gezinsnummer: f.gezinsnummer.value.trim() || null,
      familienaam: f.familienaam.value.trim(),
      parochie: f.parochie.value || null,
      adres: f.adres.value.trim(),
      postcode: f.postcode.value.trim(),
      woonplaats: f.woonplaats.value.trim(),
      telefoon: f.telefoon.value.trim(),
      email: f.email.value.trim(),
      status: f.status.value || 'actief',
      notities: f.notities.value.trim(),
    };
    if (!data.familienaam && !data.gezinsnummer) {
      Modal.show({ type: 'warning', title: 'Gegevens nodig', message: 'Vul minstens een familienaam of gezinsnummer in.' });
      return;
    }
    const btn = f.querySelector('button[type=submit]');
    btn.disabled = true; btn.textContent = 'Bezig…';
    try {
      let saved;
      if (isNew) saved = await DB.insert(KEYS.GEZINNEN, data);
      else saved = await DB.update(KEYS.GEZINNEN, g.id, data);
      Router.go('/leden/' + (isNew ? saved.id : g.id));
    } catch (err) {
      btn.disabled = false; btn.textContent = isNew ? 'Gezin aanmaken' : 'Opslaan';
    }
  });

  const delBtn = $('#btn-gezin-del');
  if (delBtn) delBtn.addEventListener('click', async () => {
    const n = DB.where(KEYS.LEDEN, l => l.gezin_id === g.id).length;
    const ok = await Modal.confirm({
      title: 'Gezin verwijderen?',
      message: `Het gezin “${g.familienaam || g.gezinsnummer || ''}”${n ? ` en de ${n} bijbehorende leden` : ''} worden verwijderd. Dit kan niet ongedaan worden gemaakt.`,
      confirmText: 'Verwijderen',
    });
    if (!ok) return;
    try {
      await DB.removeWhere(KEYS.LEDEN, l => l.gezin_id === g.id);
      await DB.remove(KEYS.GEZINNEN, g.id);
      Router.go('/leden');
    } catch (_) {}
  });
}
