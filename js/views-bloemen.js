// Bloemen-catalogus: gebruiker beheert eigen bloemstukken (naam, omschrijving, prijs, foto)

let _bloemEditing = null; // null = nieuw formulier dicht; 'new' = nieuw; <id> = bewerken
let _bloemFilter = '';
let _bloemPrijsMax = '';

// Actieve dossier-drafts uit localStorage (zoals views-kisten.js).
// Hiermee kan de gebruiker een bloemstuk direct in een lopend
// dossier-concept koppelen.
function _activeDossierDraftsBloem() {
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
        key, isNew, id: isNew ? null : idPart, naam,
        bloem: data.bloemstukken || '',
      });
    }
  } catch (_) {}
  return drafts;
}

// Voeg een bloem-kostpost toe aan een actief dossier. Voor nieuwe dossiers
// gaat het in de localStorage-kostenbuffer; voor bestaande direct in de DB.
// Als dezelfde bloem al bestaat, hogen we aantal+bedrag op zodat 'meerdere
// keren klikken' samenvoegt tot één rij met hoger aantal.
async function _addBloemAanDossier(target, naam, aantal, stuk) {
  const oms = '🌸 ' + naam;
  const cat = 'bloemen';
  const extraBedrag = +(stuk * aantal).toFixed(2);
  if (target.isNew) {
    const bufKey = 'sok_kosten_buffer_nieuw';
    let buf = [];
    try { buf = JSON.parse(localStorage.getItem(bufKey) || '[]') || []; } catch (_) {}
    const i = buf.findIndex(k => (k.omschrijving || '') === oms && (k.categorie || null) === cat);
    if (i >= 0) {
      buf[i].aantal = (Number(buf[i].aantal) || 1) + aantal;
      buf[i].bedrag = +(((Number(buf[i].bedrag) || 0) + extraBedrag)).toFixed(2);
    } else {
      buf.push({ omschrijving: oms, categorie: cat, bedrag: extraBedrag, aantal, betaald: false });
    }
    try { localStorage.setItem(bufKey, JSON.stringify(buf)); } catch (_) {}
  } else {
    const existing = DB.where(KEYS.KOSTEN, k =>
      k.dossier_id === target.id &&
      k.omschrijving === oms &&
      (k.categorie || null) === cat
    );
    if (existing.length > 0) {
      const e = existing[0];
      const nieuwAantal = (Number(e.aantal) || 1) + aantal;
      const nieuwBedrag = +((Number(e.bedrag) || 0) + extraBedrag).toFixed(2);
      try { await DB.update(KEYS.KOSTEN, e.id, { aantal: nieuwAantal, bedrag: nieuwBedrag }); } catch (_) {}
    } else {
      try { await DB.insert(KEYS.KOSTEN, { dossier_id: target.id, omschrijving: oms, categorie: cat, bedrag: extraBedrag, aantal, betaald: false }); } catch (_) {}
    }
    try { await DB.touchDossier(target.id); } catch (_) {}
  }
}

function bloemSVG() {
  return `
    <svg viewBox="0 0 240 130" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet">
      <defs>
        <radialGradient id="bg" cx="0.5" cy="0.5" r="0.6">
          <stop offset="0" stop-color="#f7e7e0"/>
          <stop offset="1" stop-color="#e7d3c8"/>
        </radialGradient>
      </defs>
      <rect width="240" height="130" fill="url(#bg)"/>
      <g transform="translate(120 75)">
        <circle r="34" fill="#3a7d44" opacity=".25"/>
        <g fill="#c94f6d">
          <circle cx="-18" cy="-12" r="11"/>
          <circle cx="18"  cy="-12" r="11"/>
          <circle cx="-12" cy="14"  r="11"/>
          <circle cx="14"  cy="14"  r="11"/>
          <circle cx="0"   cy="-2"  r="13"/>
        </g>
        <g fill="#fff">
          <circle cx="-18" cy="-12" r="3"/>
          <circle cx="18"  cy="-12" r="3"/>
          <circle cx="-12" cy="14"  r="3"/>
          <circle cx="14"  cy="14"  r="3"/>
          <circle cx="0"   cy="-2"  r="3"/>
        </g>
        <g fill="#3a7d44">
          <ellipse cx="-26" cy="6"  rx="9" ry="4" transform="rotate(-25 -26 6)"/>
          <ellipse cx="26"  cy="6"  rx="9" ry="4" transform="rotate(25 26 6)"/>
          <ellipse cx="0"   cy="22" rx="9" ry="4"/>
        </g>
      </g>
    </svg>`;
}

function renderBloemenBeheer(msg) {
  const alle = DB.list(KEYS.BLOEMEN).slice().sort((a, b) => a.naam.localeCompare(b.naam));
  const adminMode = !!Settings.get('catalog_admin_mode');
  const drafts = _activeDossierDraftsBloem();
  const hasDraft = drafts.length > 0;

  const q = (_bloemFilter || '').trim().toLowerCase();
  const max = parseFloat(String(_bloemPrijsMax).replace(',', '.')) || 0;
  const items = alle.filter(b => {
    if (q && !((b.naam || '').toLowerCase().includes(q) || (b.omschrijving || '').toLowerCase().includes(q))) return false;
    if (max > 0 && Number(b.bedrag) > max) return false;
    return true;
  });
  const totaalCount = alle.length;

  const editing = _bloemEditing === 'new' ? { naam: '', omschrijving: '', bedrag: '' }
                : (_bloemEditing != null ? alle.find(x => x.id === _bloemEditing) : null);

  $('#view').innerHTML = `
    <div class="page">
      <div class="page-head">
        <div>
          <h1>Bloemenbeheer</h1>
          <p class="muted">Eigen catalogus van bloemstukken. Verschijnen automatisch in het intake-formulier en het dossieroverzicht.</p>
        </div>
        ${editing ? '' : (adminMode ? '<button type="button" class="btn btn-primary" id="btn-nieuw-bloem">+ Nieuw bloemstuk</button>' : '')}
      </div>
      ${msg && msg.error ? `<div class="alert alert-error">${esc(msg.error)}</div>` : ''}
      ${msg && msg.success ? `<div class="alert alert-success">${esc(msg.success)}</div>` : ''}
      ${(!editing && hasDraft) ? `
        <div class="alert alert-info kist-draft-banner">
          <strong>💡 Actief dossier:</strong>
          ${drafts.length === 1
            ? `<span>${esc(drafts[0].naam)}${drafts[0].bloem ? ' — huidige bloem: <em>' + esc(drafts[0].bloem) + '</em>' : ''}</span>`
            : `<select id="bloem-draft-picker">${drafts.map((d, i) => `<option value="${i}">${esc(d.naam)}${d.bloem ? ' — ' + esc(d.bloem) : ''}</option>`).join('')}</select>`}
          <span class="muted small">— klik op de "Kies"-knop bij een bloemstuk om hem in het dossier te zetten</span>
        </div>` : ''}

      ${editing ? '' : `
        <section class="card catalog-filter-card">
          <div class="catalog-filter">
            <label class="catalog-filter-inline">
              <span class="muted small">Zoek op naam of omschrijving</span>
              <input type="search" id="bloem-filter-q" value="${esc(_bloemFilter)}" placeholder="bv. rozen, krans" autocomplete="off">
            </label>
            <label class="catalog-filter-inline">
              <span class="muted small">Max. prijs (€)</span>
              <input type="text" id="bloem-filter-max" value="${esc(_bloemPrijsMax)}" placeholder="bv. 250" inputmode="decimal">
            </label>
            ${(_bloemFilter || _bloemPrijsMax) ? '<button type="button" class="btn btn-sm btn-ghost" id="bloem-filter-clear">Wis filter</button>' : ''}
            <span class="muted small catalog-filter-count">${items.length} van ${totaalCount}</span>
          </div>
        </section>`}

      ${editing ? `
        <section class="card narrow">
          <h2>${_bloemEditing === 'new' ? 'Nieuw bloemstuk' : 'Bloemstuk bewerken'}</h2>
          <form id="bloem-form" class="form" autocomplete="off">
            <label><span>Naam</span><input type="text" name="naam" value="${esc(editing.naam || '')}" required></label>
            <label><span>Omschrijving</span><textarea name="omschrijving" rows="3">${esc(editing.omschrijving || '')}</textarea></label>
            <label><span>Prijs (€)</span><input type="text" name="bedrag" value="${editing.bedrag != null ? String(editing.bedrag).replace('.', ',') : ''}" inputmode="decimal" placeholder="0,00"></label>
            <label><span>Foto (jpg/png, max 5 MB)</span><input type="file" name="foto" accept="image/*"></label>
            <div class="form-actions">
              <button type="button" class="btn btn-ghost" id="btn-cancel-bloem">Annuleren</button>
              <button type="submit" class="btn btn-primary">${_bloemEditing === 'new' ? 'Aanmaken' : 'Opslaan'}</button>
            </div>
          </form>
        </section>` : ''}

      ${items.length === 0
        ? `<div class="card"><p class="muted">Nog geen bloemstukken. ${adminMode ? 'Klik rechtsboven op "+ Nieuw bloemstuk" om er een toe te voegen.' : 'Schakel <strong>Beheermodus</strong> in via <a href="#/account">Account</a> om bloemstukken toe te voegen.'}</p></div>`
        : `<div class="kist-grid">
            ${items.map(b => {
              const url = BloemenFotos.urlVoor(b.naam);
              return `
                <div class="kist-card" data-id="${b.id}">
                  <button type="button" class="kist-card-img kist-card-img-btn" data-action="zoom" data-id="${b.id}" aria-label="Vergroot ${esc(b.naam)}">
                    ${url
                      ? `<img src="${esc(url)}" alt="${esc(b.naam)}" loading="lazy">`
                      : `<div class="kist-card-svg">${bloemSVG()}</div>
                         <div class="kist-card-no-img">geen foto</div>`}
                  </button>
                  <div class="kist-card-meta">
                    <strong>${esc(b.naam)}</strong>
                    ${b.omschrijving ? `<span class="muted small">${esc(b.omschrijving)}</span>` : ''}
                    <span class="kist-price">${fmtEUR(b.bedrag)}</span>
                  </div>
                  ${hasDraft ? `
                    <div class="kist-card-actions">
                      <button type="button" class="btn btn-sm btn-primary" data-pick-bloem="${esc(b.naam)}">✓ Kies voor dossier</button>
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

  // Filter handlers (live, met debounce + focus-behoud)
  let _bloemFilterT = null;
  const filterQ = $('#bloem-filter-q');
  const filterMax = $('#bloem-filter-max');
  const filterClear = $('#bloem-filter-clear');
  const reRenderFilter = (focusId) => {
    const pos = focusId ? document.getElementById(focusId)?.selectionStart : null;
    renderBloemenBeheer();
    if (focusId) {
      const inp = document.getElementById(focusId);
      if (inp) { inp.focus(); if (pos != null) inp.setSelectionRange(pos, pos); }
    }
  };
  if (filterQ) {
    filterQ.addEventListener('input', () => {
      _bloemFilter = filterQ.value;
      clearTimeout(_bloemFilterT);
      _bloemFilterT = setTimeout(() => reRenderFilter('bloem-filter-q'), 150);
    });
  }
  if (filterMax) {
    filterMax.addEventListener('input', () => {
      _bloemPrijsMax = filterMax.value;
      clearTimeout(_bloemFilterT);
      _bloemFilterT = setTimeout(() => reRenderFilter('bloem-filter-max'), 150);
    });
  }
  if (filterClear) {
    filterClear.addEventListener('click', () => {
      _bloemFilter = '';
      _bloemPrijsMax = '';
      renderBloemenBeheer();
    });
  }

  const newBtn = $('#btn-nieuw-bloem');
  if (newBtn) newBtn.addEventListener('click', () => { _bloemEditing = 'new'; renderBloemenBeheer(); });

  const cancelBtn = $('#btn-cancel-bloem');
  if (cancelBtn) cancelBtn.addEventListener('click', () => { _bloemEditing = null; renderBloemenBeheer(); });

  const form = $('#bloem-form');
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
        if (!file.type.startsWith('image/')) return renderBloemenBeheer({ error: 'Alleen afbeeldingen toegestaan.' });
        if (file.size > 5 * 1024 * 1024) return renderBloemenBeheer({ error: 'Foto te groot (max. 5 MB).' });
      }
      const submitBtn = f.querySelector('button[type=submit]');
      submitBtn.disabled = true; submitBtn.textContent = 'Bezig...';
      try {
        let storage_pad = (typeof editing.id === 'number') ? editing.storage_pad : null;
        if (file) storage_pad = await BloemenFotos.uploadFoto(naam, file);
        if (_bloemEditing === 'new') {
          await DB.insert(KEYS.BLOEMEN, { naam, omschrijving, bedrag, storage_pad });
        } else {
          await DB.update(KEYS.BLOEMEN, editing.id, { naam, omschrijving, bedrag, storage_pad });
        }
        _bloemEditing = null;
        renderBloemenBeheer({ success: 'Opgeslagen.' });
      } catch (err) {
        submitBtn.disabled = false;
        submitBtn.textContent = (_bloemEditing === 'new' ? 'Aanmaken' : 'Opslaan');
      }
    });
  }

  $('#view').onclick = async e => {
    // Kies bloemstuk voor actief dossier-concept (additief — vraagt aantal,
    // klikken op meerdere bloemen of dezelfde bloem stapelt netjes op).
    const pickBtn = e.target.closest('button[data-pick-bloem]');
    if (pickBtn) {
      const bloemNaam = pickBtn.getAttribute('data-pick-bloem');
      const item = DB.list(KEYS.BLOEMEN).find(x => x.naam === bloemNaam);
      const stuk = Number(item?.bedrag) || 0;
      const picker = $('#bloem-draft-picker');
      const idx = picker ? parseInt(picker.value, 10) : 0;
      const target = drafts[idx];
      if (!target) return;
      const input = window.prompt(
        `Hoeveel "${bloemNaam}"? (prijs per stuk: ${fmtEUR(stuk)})`,
        '1'
      );
      if (input == null) return;
      const aantal = parseInt(String(input).trim(), 10);
      if (!isFinite(aantal) || aantal < 1) {
        Modal.show({ type: 'warning', title: 'Ongeldig aantal', message: 'Vul een aantal in van 1 of hoger.' });
        return;
      }
      await _addBloemAanDossier(target, bloemNaam, aantal, stuk);
      const totaal = +(stuk * aantal).toFixed(2);
      const confirmGo = await Modal.confirm({
        type: 'success',
        title: `${aantal}× ${bloemNaam} toegevoegd`,
        message: `Totaal: ${fmtEUR(totaal)} bij dossier ${target.naam}. Klik nog een keer op een bloem om er meer toe te voegen, of ga terug naar het dossier.`,
        confirmText: 'Ja, ga terug',
        cancelText: 'Blijf hier',
      });
      if (confirmGo) {
        Router.go(target.isNew ? '/dossiers/nieuw' : '/dossiers/' + target.id + '/bewerken');
      } else {
        renderBloemenBeheer({ success: `${aantal}× ${bloemNaam} (${fmtEUR(totaal)}) toegevoegd aan ${target.naam}.` });
      }
      return;
    }
    const zoom = e.target.closest('button[data-action="zoom"]');
    if (zoom) {
      const id = parseInt(zoom.getAttribute('data-id'), 10);
      const b = DB.byId(KEYS.BLOEMEN, id); if (!b) return;
      Lightbox.show({
        src: BloemenFotos.urlVoor(b.naam) || null,
        svgFallback: bloemSVG(),
        title: b.naam,
        subtitle: b.omschrijving || '',
        price: b.bedrag ? fmtEUR(b.bedrag) : '',
      });
      return;
    }
    const ed = e.target.closest('button[data-edit]');
    const del = e.target.closest('button[data-delete]');
    if (ed) {
      _bloemEditing = parseInt(ed.getAttribute('data-edit'), 10);
      renderBloemenBeheer();
      return;
    }
    if (del) {
      const id = parseInt(del.getAttribute('data-delete'), 10);
      const b = DB.byId(KEYS.BLOEMEN, id);
      if (!b) return;
      const ok = await Modal.confirm({ title: 'Bloemstuk verwijderen?', message: `"${b.naam}" wordt definitief uit de catalogus verwijderd.`, confirmText: 'Verwijderen' });
      if (!ok) return;
      try {
        await BloemenFotos.removeFoto(b);
        await DB.remove(KEYS.BLOEMEN, id);
        renderBloemenBeheer({ success: 'Verwijderd.' });
      } catch (_) {}
    }
  };
}
