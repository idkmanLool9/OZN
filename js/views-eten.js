// Eten & drinken-catalogus: zelfde patroon als bloemen, maar bij
// 'Kies voor dossier' wordt eerst een aantal gevraagd en als losse
// kostenpost (aantal × prijs) aan het actieve dossier toegevoegd.

let _etenEditing = null; // null = dicht; 'new' = nieuw; <id> = bewerken
let _etenFilter = '';
let _etenPrijsMax = '';

function _activeDossierDraftsEten() {
  const drafts = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key || !key.startsWith('sok_draft_')) continue;
      let data = null;
      try { data = JSON.parse(localStorage.getItem(key) || '{}'); } catch (_) {}
      if (!data) continue;
      const idPart = key.slice('sok_draft_'.length);
      const isNew = idPart === 'new';
      const naam = [data.voornaam, data.achternaam].filter(Boolean).join(' ').trim()
        || (isNew ? 'Nieuw dossier (concept)' : ('Dossier #' + idPart));
      drafts.push({
        key, isNew, id: isNew ? null : parseInt(idPart, 10), naam,
      });
    }
  } catch (_) {}
  return drafts;
}

// Voeg een eten-kostpost toe aan een actief dossier. Voor nieuwe dossiers
// gaat het in de localStorage-kostenbuffer; voor bestaande direct in DB.
async function _addEtenAanDossier(target, omschrijving, aantal, stuk) {
  const bedrag = +(stuk * aantal).toFixed(2);
  const post = { omschrijving: '🍽 ' + omschrijving, categorie: 'overig', bedrag, aantal, betaald: false };
  if (target.isNew) {
    const bufKey = 'sok_kosten_buffer_nieuw';
    let buf = [];
    try { buf = JSON.parse(localStorage.getItem(bufKey) || '[]') || []; } catch (_) {}
    buf.push(post);
    try { localStorage.setItem(bufKey, JSON.stringify(buf)); } catch (_) {}
  } else {
    try {
      await DB.insert(KEYS.KOSTEN, Object.assign({ dossier_id: target.id }, post));
      await DB.touchDossier(target.id);
    } catch (_) {}
  }
}

function etenSVG() {
  return `
    <svg viewBox="0 0 240 130" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet">
      <defs>
        <radialGradient id="bg-eten" cx="0.5" cy="0.5" r="0.6">
          <stop offset="0" stop-color="#fff4d6"/>
          <stop offset="1" stop-color="#f0dab0"/>
        </radialGradient>
      </defs>
      <rect width="240" height="130" fill="url(#bg-eten)"/>
      <g transform="translate(120 70)">
        <ellipse cx="0" cy="14" rx="60" ry="10" fill="#cfa56b" opacity=".55"/>
        <circle r="40" fill="#fff" stroke="#b88a55" stroke-width="2"/>
        <circle r="28" fill="#f8e6c8"/>
        <g fill="#b14d2a">
          <circle cx="-10" cy="-6" r="6"/>
          <circle cx="10"  cy="-2" r="6"/>
          <circle cx="-4"  cy="10" r="6"/>
        </g>
      </g>
    </svg>`;
}

function renderEtenBeheer(msg) {
  const alle = DB.list(KEYS.ETEN).slice().sort((a, b) => a.naam.localeCompare(b.naam));
  const adminMode = !!Settings.get('catalog_admin_mode');
  const drafts = _activeDossierDraftsEten();
  const hasDraft = drafts.length > 0;

  const q = (_etenFilter || '').trim().toLowerCase();
  const max = parseFloat(String(_etenPrijsMax).replace(',', '.')) || 0;
  const items = alle.filter(b => {
    if (q && !((b.naam || '').toLowerCase().includes(q) || (b.omschrijving || '').toLowerCase().includes(q))) return false;
    if (max > 0 && Number(b.bedrag) > max) return false;
    return true;
  });
  const totaalCount = alle.length;

  const editing = _etenEditing === 'new' ? { naam: '', omschrijving: '', bedrag: '' }
                : (_etenEditing != null ? alle.find(x => x.id === _etenEditing) : null);

  $('#view').innerHTML = `
    <div class="page">
      <div class="page-head">
        <div>
          <h1>Eten &amp; drinken</h1>
          <p class="muted">Eigen catalogus van eten- en drinkproducten. Bij kiezen wordt om een aantal gevraagd; totaal = aantal × prijs.</p>
        </div>
        ${editing ? '' : (adminMode ? '<button type="button" class="btn btn-primary" id="btn-nieuw-eten">+ Nieuw product</button>' : '')}
      </div>
      ${msg && msg.error ? `<div class="alert alert-error">${esc(msg.error)}</div>` : ''}
      ${msg && msg.success ? `<div class="alert alert-success">${esc(msg.success)}</div>` : ''}
      ${(!editing && hasDraft) ? `
        <div class="alert alert-info kist-draft-banner">
          <strong>💡 Actief dossier:</strong>
          ${drafts.length === 1
            ? `<span>${esc(drafts[0].naam)}</span>`
            : `<select id="eten-draft-picker">${drafts.map((d, i) => `<option value="${i}">${esc(d.naam)}</option>`).join('')}</select>`}
          <span class="muted small">— klik op "Kies + aantal" om als kostenpost toe te voegen</span>
        </div>` : ''}

      ${editing ? '' : `
        <section class="card catalog-filter-card">
          <div class="catalog-filter">
            <label class="catalog-filter-inline">
              <span class="muted small">Zoek op naam of omschrijving</span>
              <input type="search" id="eten-filter-q" value="${esc(_etenFilter)}" placeholder="bv. baklava, cola" autocomplete="off">
            </label>
            <label class="catalog-filter-inline">
              <span class="muted small">Max. prijs per stuk (€)</span>
              <input type="text" id="eten-filter-max" value="${esc(_etenPrijsMax)}" placeholder="bv. 10" inputmode="decimal">
            </label>
            ${(_etenFilter || _etenPrijsMax) ? '<button type="button" class="btn btn-sm btn-ghost" id="eten-filter-clear">Wis filter</button>' : ''}
            <span class="muted small catalog-filter-count">${items.length} van ${totaalCount}</span>
          </div>
        </section>`}

      ${editing ? `
        <section class="card narrow">
          <h2>${_etenEditing === 'new' ? 'Nieuw product' : 'Product bewerken'}</h2>
          <form id="eten-form" class="form" autocomplete="off">
            <label><span>Naam</span><input type="text" name="naam" value="${esc(editing.naam || '')}" required></label>
            <label><span>Omschrijving</span><textarea name="omschrijving" rows="3">${esc(editing.omschrijving || '')}</textarea></label>
            <label><span>Prijs per stuk (€)</span><input type="text" name="bedrag" value="${editing.bedrag != null && editing.bedrag !== '' ? (Number(editing.bedrag) || 0).toFixed(2).replace('.', ',') : ''}" inputmode="decimal" placeholder="0,00"></label>
            <label><span>Foto (jpg/png, max 5 MB)</span><input type="file" name="foto" accept="image/*"></label>
            <div class="form-actions">
              <button type="button" class="btn btn-ghost" id="btn-cancel-eten">Annuleren</button>
              <button type="submit" class="btn btn-primary">${_etenEditing === 'new' ? 'Aanmaken' : 'Opslaan'}</button>
            </div>
          </form>
        </section>` : ''}

      ${items.length === 0
        ? `<div class="card"><p class="muted">Nog geen producten. ${adminMode ? 'Klik rechtsboven op "+ Nieuw product".' : 'Schakel <strong>Beheermodus</strong> in via <a href="#/account">Account</a> om producten toe te voegen.'}</p></div>`
        : `<div class="kist-grid">
            ${items.map(b => {
              const url = EtenFotos.urlVoor(b.naam);
              return `
                <div class="kist-card" data-id="${b.id}">
                  <button type="button" class="kist-card-img kist-card-img-btn" data-action="zoom" data-id="${b.id}" aria-label="Vergroot ${esc(b.naam)}">
                    ${url
                      ? `<img src="${esc(url)}" alt="${esc(b.naam)}" loading="lazy">`
                      : `<div class="kist-card-svg">${etenSVG()}</div>
                         <div class="kist-card-no-img">geen foto</div>`}
                  </button>
                  <div class="kist-card-meta">
                    <strong>${esc(b.naam)}</strong>
                    ${b.omschrijving ? `<span class="muted small">${esc(b.omschrijving)}</span>` : ''}
                    <span class="kist-price">${fmtEUR(b.bedrag)} <span class="muted small">per stuk</span></span>
                  </div>
                  ${hasDraft ? `
                    <div class="kist-card-actions">
                      <button type="button" class="btn btn-sm btn-primary" data-pick-eten="${esc(b.naam)}">✓ Kies + aantal</button>
                    </div>` : ''}
                  ${adminMode ? `
                    <div class="kist-card-actions">
                      <button type="button" class="btn btn-sm" data-edit="${b.id}">Bewerken</button>
                      <button type="button" class="btn btn-sm btn-ghost" data-delete="${b.id}">Verwijderen</button>
                    </div>` : ''}
                </div>`;
            }).join('')}
          </div>
          ${adminMode ? '' : `<p class="muted small center" style="margin-top:1.5rem;">Toevoegen of bewerken? Schakel <strong>Beheermodus</strong> in via <a href="#/account">Account</a>.</p>`}`}
    </div>`;

  let _etenFilterT = null;
  const filterQ = $('#eten-filter-q');
  const filterMax = $('#eten-filter-max');
  const filterClear = $('#eten-filter-clear');
  const reRenderFilter = (focusId) => {
    const pos = focusId ? document.getElementById(focusId)?.selectionStart : null;
    renderEtenBeheer();
    if (focusId) {
      const inp = document.getElementById(focusId);
      if (inp) { inp.focus(); if (pos != null) inp.setSelectionRange(pos, pos); }
    }
  };
  if (filterQ) {
    filterQ.addEventListener('input', () => {
      _etenFilter = filterQ.value;
      clearTimeout(_etenFilterT);
      _etenFilterT = setTimeout(() => reRenderFilter('eten-filter-q'), 150);
    });
  }
  if (filterMax) {
    filterMax.addEventListener('input', () => {
      _etenPrijsMax = filterMax.value;
      clearTimeout(_etenFilterT);
      _etenFilterT = setTimeout(() => reRenderFilter('eten-filter-max'), 150);
    });
  }
  if (filterClear) {
    filterClear.addEventListener('click', () => {
      _etenFilter = ''; _etenPrijsMax = '';
      renderEtenBeheer();
    });
  }

  const newBtn = $('#btn-nieuw-eten');
  if (newBtn) newBtn.addEventListener('click', () => { _etenEditing = 'new'; renderEtenBeheer(); });

  const cancelBtn = $('#btn-cancel-eten');
  if (cancelBtn) cancelBtn.addEventListener('click', () => { _etenEditing = null; renderEtenBeheer(); });

  const form = $('#eten-form');
  if (form) {
    form.addEventListener('submit', async e => {
      e.preventDefault();
      const f = e.target;
      const naam = f.naam.value.trim();
      if (!naam) return;
      const bedrag = parseEUR(f.bedrag.value);
      const omschrijving = f.omschrijving.value.trim() || null;
      const file = f.foto.files[0];
      if (file) {
        if (!file.type.startsWith('image/')) return renderEtenBeheer({ error: 'Alleen afbeeldingen toegestaan.' });
        if (file.size > 5 * 1024 * 1024) return renderEtenBeheer({ error: 'Foto te groot (max. 5 MB).' });
      }
      const submitBtn = f.querySelector('button[type=submit]');
      submitBtn.disabled = true; submitBtn.textContent = 'Bezig...';
      try {
        let storage_pad = (typeof editing.id === 'number') ? editing.storage_pad : null;
        if (file) storage_pad = await EtenFotos.uploadFoto(naam, file);
        if (_etenEditing === 'new') {
          await DB.insert(KEYS.ETEN, { naam, omschrijving, bedrag, storage_pad });
        } else {
          await DB.update(KEYS.ETEN, editing.id, { naam, omschrijving, bedrag, storage_pad });
        }
        _etenEditing = null;
        renderEtenBeheer({ success: 'Opgeslagen.' });
      } catch (err) {
        submitBtn.disabled = false;
        submitBtn.textContent = (_etenEditing === 'new' ? 'Aanmaken' : 'Opslaan');
      }
    });
  }

  $('#view').onclick = async e => {
    const pickBtn = e.target.closest('button[data-pick-eten]');
    if (pickBtn) {
      const naam = pickBtn.getAttribute('data-pick-eten');
      const item = DB.list(KEYS.ETEN).find(x => x.naam === naam);
      const stuk = Number(item?.bedrag) || 0;
      const picker = $('#eten-draft-picker');
      const idx = picker ? parseInt(picker.value, 10) : 0;
      const target = drafts[idx];
      if (!target) return;
      const input = window.prompt(
        `Hoeveel ${naam}? (prijs per stuk: ${fmtEUR(stuk)})`,
        '1'
      );
      if (input == null) return;
      const aantal = parseInt(String(input).trim(), 10);
      if (!isFinite(aantal) || aantal < 1) {
        Modal.show({ type: 'warning', title: 'Ongeldig aantal', message: 'Vul een aantal in van 1 of hoger.' });
        return;
      }
      await _addEtenAanDossier(target, naam, aantal, stuk);
      const totaal = +(stuk * aantal).toFixed(2);
      const confirmGo = await Modal.confirm({
        type: 'success',
        title: `${aantal}× ${naam} toegevoegd`,
        message: `Totaal: ${fmtEUR(totaal)} bij dossier ${target.naam}. Terug naar het dossier?`,
        confirmText: 'Ja, ga terug',
        cancelText: 'Blijf hier',
      });
      if (confirmGo) {
        Router.go(target.isNew ? '/dossiers/nieuw' : '/dossiers/' + target.id + '/bewerken');
      } else {
        renderEtenBeheer({ success: `${aantal}× ${naam} (${fmtEUR(totaal)}) toegevoegd aan ${target.naam}.` });
      }
      return;
    }
    const zoom = e.target.closest('button[data-action="zoom"]');
    if (zoom) {
      const id = parseInt(zoom.getAttribute('data-id'), 10);
      const b = DB.byId(KEYS.ETEN, id); if (!b) return;
      Lightbox.show({
        src: EtenFotos.urlVoor(b.naam) || null,
        svgFallback: etenSVG(),
        title: b.naam,
        subtitle: b.omschrijving || '',
        price: b.bedrag ? fmtEUR(b.bedrag) + ' per stuk' : '',
      });
      return;
    }
    const ed = e.target.closest('button[data-edit]');
    const del = e.target.closest('button[data-delete]');
    if (ed) {
      _etenEditing = parseInt(ed.getAttribute('data-edit'), 10);
      renderEtenBeheer();
      return;
    }
    if (del) {
      const id = parseInt(del.getAttribute('data-delete'), 10);
      const b = DB.byId(KEYS.ETEN, id);
      if (!b) return;
      const ok = await Modal.confirm({ title: 'Product verwijderen?', message: `"${b.naam}" wordt definitief uit de catalogus verwijderd.`, confirmText: 'Verwijderen' });
      if (!ok) return;
      try {
        await EtenFotos.removeFoto(b);
        await DB.remove(KEYS.ETEN, id);
        renderEtenBeheer({ success: 'Verwijderd.' });
      } catch (_) {}
    }
  };
}
