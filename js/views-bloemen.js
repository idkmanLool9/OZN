// Bloemen-catalogus: galerij-stijl (zoals Kisten) + eigen beheer
// (naam, omschrijving, prijs, foto) en dossier-koppeling met aantal.

let _bloemEditing = null; // null = dicht; 'new' = nieuw; <id> = bewerken
let _bloemFilter = '';
let _bloemPagina = 1;
let _bloemWeergave = 'grid';
const BLOEMEN_PER_PAGINA = 12;

// Actieve dossier-drafts uit localStorage (zoals views-kisten.js).
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
      drafts.push({ key, isNew, id: isNew ? null : idPart, naam, bloem: data.bloemstukken || '' });
    }
  } catch (_) {}
  return drafts;
}

// Voeg een bloem-kostpost toe aan een actief dossier (additief: meerdere keren
// dezelfde bloem stapelt aantal + bedrag op).
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
      k.dossier_id === target.id && k.omschrijving === oms && (k.categorie || null) === cat);
    if (existing.length > 0) {
      const e = existing[0];
      try { await DB.update(KEYS.KOSTEN, e.id, {
        aantal: (Number(e.aantal) || 1) + aantal,
        bedrag: +((Number(e.bedrag) || 0) + extraBedrag).toFixed(2),
      }); } catch (_) {}
    } else {
      try { await DB.insert(KEYS.KOSTEN, { dossier_id: target.id, omschrijving: oms, categorie: cat, bedrag: extraBedrag, aantal, betaald: false }); } catch (_) {}
    }
    try { await DB.touchDossier(target.id); } catch (_) {}
  }
}

// Favorieten (persoonlijk, in localStorage)
function _bloemFavs() {
  try { return JSON.parse(localStorage.getItem('sok_bloem_favs') || '[]'); } catch (_) { return []; }
}
function _toggleBloemFav(naam) {
  const f = _bloemFavs();
  const i = f.indexOf(naam);
  if (i >= 0) f.splice(i, 1); else f.push(naam);
  try { localStorage.setItem('sok_bloem_favs', JSON.stringify(f)); } catch (_) {}
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
          <circle cx="-18" cy="-12" r="11"/><circle cx="18" cy="-12" r="11"/>
          <circle cx="-12" cy="14" r="11"/><circle cx="14" cy="14" r="11"/>
          <circle cx="0" cy="-2" r="13"/>
        </g>
        <g fill="#fff">
          <circle cx="-18" cy="-12" r="3"/><circle cx="18" cy="-12" r="3"/>
          <circle cx="-12" cy="14" r="3"/><circle cx="14" cy="14" r="3"/>
          <circle cx="0" cy="-2" r="3"/>
        </g>
        <g fill="#3a7d44">
          <ellipse cx="-26" cy="6" rx="9" ry="4" transform="rotate(-25 -26 6)"/>
          <ellipse cx="26" cy="6" rx="9" ry="4" transform="rotate(25 26 6)"/>
          <ellipse cx="0" cy="22" rx="9" ry="4"/>
        </g>
      </g>
    </svg>`;
}

function renderBloemenBeheer(msg) {
  const alle = DB.list(KEYS.BLOEMEN).slice().sort((a, b) => a.naam.localeCompare(b.naam));
  const adminMode = !!Settings.get('catalog_admin_mode');
  const drafts = _activeDossierDraftsBloem();
  const hasDraft = drafts.length > 0;
  const favs = _bloemFavs();

  const q = (_bloemFilter || '').trim().toLowerCase();
  const gefilterd = alle.filter(b => {
    if (q && !((b.naam || '').toLowerCase().includes(q) || (b.omschrijving || '').toLowerCase().includes(q))) return false;
    return true;
  });

  // Paginering
  const totPaginas = Math.max(1, Math.ceil(gefilterd.length / BLOEMEN_PER_PAGINA));
  if (_bloemPagina > totPaginas) _bloemPagina = totPaginas;
  if (_bloemPagina < 1) _bloemPagina = 1;
  const start = (_bloemPagina - 1) * BLOEMEN_PER_PAGINA;
  const pagina = gefilterd.slice(start, start + BLOEMEN_PER_PAGINA);

  const editing = _bloemEditing === 'new' ? { naam: '', omschrijving: '', bedrag: '' }
                : (_bloemEditing != null ? alle.find(x => x.id === _bloemEditing) : null);

  const kaart = (b) => {
    const url = BloemenFotos.urlVoor(b.naam);
    const isFav = favs.includes(b.naam);
    return `
      <div class="kist-card" data-id="${b.id}" data-naam="${esc(b.naam)}">
        <div class="kist-card-imgwrap">
          <button type="button" class="kist-card-img kist-card-img-btn" data-action="zoom" data-id="${b.id}" aria-label="Bekijk ${esc(b.naam)}">
            ${url
              ? `<img src="${esc(url)}" alt="${esc(b.naam)}" loading="lazy">`
              : `<div class="kist-card-svg">${bloemSVG()}</div><div class="kist-card-no-img">geen foto</div>`}
          </button>
          <button type="button" class="kist-fav ${isFav ? 'is-fav' : ''}" data-fav="${esc(b.naam)}" aria-label="Favoriet">${isFav ? '♥' : '♡'}</button>
        </div>
        <div class="kist-card-body">
          <strong class="kist-card-naam">${esc(b.naam)}</strong>
          ${b.omschrijving ? `<span class="muted small">${esc(b.omschrijving)}</span>` : ''}
          <div class="kist-card-foot">
            <span class="kist-price">${b.bedrag ? fmtEUR(b.bedrag) : '—'}</span>
            <button type="button" class="btn btn-sm btn-primary kist-kies-btn" data-pick-bloem="${esc(b.naam)}">Kies voor dossier</button>
          </div>
          ${adminMode ? `
            <div class="kist-card-actions">
              <button type="button" class="btn btn-sm" data-edit="${b.id}">Bewerken</button>
              <button type="button" class="btn btn-sm btn-ghost" data-delete="${b.id}">Verwijderen</button>
            </div>` : ''}
        </div>
      </div>`;
  };

  $('#view').innerHTML = `
    <div class="page">
      <div class="page-head">
        <div>
          <h1>Bloemen</h1>
          <p class="muted">Kies een bloemstuk dat past. Klik op een bloem voor een grotere afbeelding.${adminMode ? ' <strong>Beheermodus aan.</strong>' : ''}</p>
        </div>
        ${editing ? '' : (adminMode ? '<button type="button" class="btn btn-primary" id="btn-nieuw-bloem">+ Nieuw bloemstuk</button>' : '')}
      </div>

      ${editing ? '' : `
        <div class="catalog-zoekbalk">
          <div class="catalog-search">
            <span class="catalog-search-icon">🔍</span>
            <input type="search" id="bloem-filter-q" value="${esc(_bloemFilter)}" placeholder="Zoek op naam of omschrijving…" autocomplete="off">
          </div>
        </div>
        <div class="catalog-chips">
          ${_bloemFilter ? '<button type="button" class="catalog-wis" id="bloem-filter-clear">↺ Wis filter</button>' : ''}
          <span class="catalog-count">${gefilterd.length} resultaten</span>
          <div class="catalog-view">
            <button type="button" class="catalog-view-btn ${_bloemWeergave === 'grid' ? 'is-on' : ''}" data-view="grid" aria-label="Rasterweergave">▦</button>
            <button type="button" class="catalog-view-btn ${_bloemWeergave === 'lijst' ? 'is-on' : ''}" data-view="lijst" aria-label="Lijstweergave">☰</button>
          </div>
        </div>`}

      ${msg && msg.error ? `<div class="alert alert-error">${esc(msg.error)}</div>` : ''}
      ${msg && msg.success ? `<div class="alert alert-success">${esc(msg.success)}</div>` : ''}
      ${(!editing && hasDraft) ? `
        <div class="alert alert-info kist-draft-banner">
          <strong>💡 Actief dossier:</strong>
          ${drafts.length === 1
            ? `<span>${esc(drafts[0].naam)}</span>`
            : `<select id="bloem-draft-picker">${drafts.map((d, i) => `<option value="${i}">${esc(d.naam)}</option>`).join('')}</select>`}
          <span class="muted small">— klik op "Kies voor dossier" bij een bloemstuk</span>
        </div>` : ''}

      ${editing ? `
        <section class="card narrow">
          <h2>${_bloemEditing === 'new' ? 'Nieuw bloemstuk' : 'Bloemstuk bewerken'}</h2>
          <form id="bloem-form" class="form" autocomplete="off">
            <label><span>Naam</span><input type="text" name="naam" value="${esc(editing.naam || '')}" required></label>
            <label><span>Omschrijving</span><textarea name="omschrijving" rows="3">${esc(editing.omschrijving || '')}</textarea></label>
            <label><span>Prijs (€)</span><input type="text" name="bedrag" value="${editing.bedrag != null && editing.bedrag !== '' ? (Number(editing.bedrag) || 0).toFixed(2).replace('.', ',') : ''}" inputmode="decimal" placeholder="0,00"></label>
            <label><span>Foto (jpg/png, max 5 MB)</span><input type="file" name="foto" accept="image/*"></label>
            <div class="form-actions">
              <button type="button" class="btn btn-ghost" id="btn-cancel-bloem">Annuleren</button>
              <button type="submit" class="btn btn-primary">${_bloemEditing === 'new' ? 'Aanmaken' : 'Opslaan'}</button>
            </div>
          </form>
        </section>` : ''}

      ${editing ? '' : (gefilterd.length === 0
        ? `<div class="card"><p class="muted center" style="padding:2rem;">Nog geen bloemstukken. ${adminMode ? 'Klik rechtsboven op "+ Nieuw bloemstuk".' : 'Schakel <strong>Beheermodus</strong> in via <a href="#/account">Account</a> om er toe te voegen.'}</p></div>`
        : `<div class="kist-grid ${_bloemWeergave === 'lijst' ? 'is-list' : ''}">${pagina.map(kaart).join('')}</div>
          ${totPaginas > 1 ? `
            <div class="catalog-paginering">
              <button type="button" class="cat-page-nav" data-page="${_bloemPagina - 1}" ${_bloemPagina === 1 ? 'disabled' : ''}>‹</button>
              ${Array.from({ length: totPaginas }, (_, i) => i + 1).map(p => `<button type="button" class="cat-page ${p === _bloemPagina ? 'is-on' : ''}" data-page="${p}">${p}</button>`).join('')}
              <button type="button" class="cat-page-nav" data-page="${_bloemPagina + 1}" ${_bloemPagina === totPaginas ? 'disabled' : ''}>›</button>
            </div>` : ''}
          ${adminMode ? '' : '<p class="muted small center" style="margin-top:1.5rem;">Toevoegen of bewerken? Schakel <strong>Beheermodus</strong> in via <a href="#/account">Account</a>.</p>'}`)}
    </div>`;

  // ─── Zoekveld live (debounce + focusbehoud) ──
  let _bloemFilterT = null;
  const filterQ = $('#bloem-filter-q');
  if (filterQ) {
    filterQ.addEventListener('input', () => {
      _bloemFilter = filterQ.value;
      _bloemPagina = 1;
      clearTimeout(_bloemFilterT);
      _bloemFilterT = setTimeout(() => {
        const focus = document.activeElement === filterQ;
        const pos = focus ? filterQ.selectionStart : null;
        renderBloemenBeheer();
        if (focus) { const n = $('#bloem-filter-q'); if (n) { n.focus(); if (pos != null) n.setSelectionRange(pos, pos); } }
      }, 150);
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
    // Favoriet
    const favBtn = e.target.closest('[data-fav]');
    if (favBtn) { _toggleBloemFav(favBtn.getAttribute('data-fav')); renderBloemenBeheer(); return; }
    // Weergave
    const viewBtn = e.target.closest('[data-view]');
    if (viewBtn) { _bloemWeergave = viewBtn.getAttribute('data-view'); renderBloemenBeheer(); return; }
    // Paginering
    const pageBtn = e.target.closest('[data-page]');
    if (pageBtn && !pageBtn.disabled) {
      _bloemPagina = parseInt(pageBtn.getAttribute('data-page'), 10) || 1;
      renderBloemenBeheer();
      const top = $('#view .catalog-zoekbalk'); if (top) top.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
    // Wis filter
    const wisBtn = e.target.closest('#bloem-filter-clear');
    if (wisBtn) { _bloemFilter = ''; _bloemPagina = 1; renderBloemenBeheer(); return; }

    // Kies bloemstuk voor actief dossier (additief, vraagt aantal)
    const pickBtn = e.target.closest('button[data-pick-bloem]');
    if (pickBtn) {
      const bloemNaam = pickBtn.getAttribute('data-pick-bloem');
      if (!hasDraft) {
        Modal.show({ type: 'info', title: 'Open eerst een dossier', message: `Om "${bloemNaam}" te koppelen, open of maak eerst een dossier. Bij de kostenstap kun je dan via deze pagina kiezen.` });
        return;
      }
      const item = DB.list(KEYS.BLOEMEN).find(x => x.naam === bloemNaam);
      const stuk = Number(item?.bedrag) || 0;
      const picker = $('#bloem-draft-picker');
      const idx = picker ? parseInt(picker.value, 10) : 0;
      const target = drafts[idx];
      if (!target) return;
      const input = window.prompt(`Hoeveel "${bloemNaam}"? (prijs per stuk: ${fmtEUR(stuk)})`, '1');
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
        message: `Totaal: ${fmtEUR(totaal)} bij dossier ${target.naam}. Nog een bloem kiezen, of terug naar het dossier?`,
        confirmText: 'Ja, ga terug',
        cancelText: 'Blijf hier',
      });
      if (confirmGo) Router.go(target.isNew ? '/dossiers/nieuw' : '/dossiers/' + target.id + '/bewerken');
      else renderBloemenBeheer({ success: `${aantal}× ${bloemNaam} (${fmtEUR(totaal)}) toegevoegd aan ${target.naam}.` });
      return;
    }

    // Lightbox
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
    // Bewerken / verwijderen
    const ed = e.target.closest('button[data-edit]');
    if (ed) { _bloemEditing = parseInt(ed.getAttribute('data-edit'), 10); renderBloemenBeheer(); return; }
    const del = e.target.closest('button[data-delete]');
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
