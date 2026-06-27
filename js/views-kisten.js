// Kistencatalogus: kaart-galerij met filters, favorieten en dossier-koppeling.

// Detecteer alle actieve dossier-drafts in localStorage zodat we direct
// een kist kunnen koppelen aan een dossier-in-bewerking.
function _activeDossierDrafts() {
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
        kist: data.kist_type || '',
      });
    }
  } catch (_) {}
  return drafts;
}

function _setKistInDraft(key, kistNaam) {
  try {
    const cur = JSON.parse(localStorage.getItem(key) || '{}');
    cur.kist_type = kistNaam;
    localStorage.setItem(key, JSON.stringify(cur));
    return true;
  } catch (_) { return false; }
}

// ─── Filter-state (blijft bewaard tussen re-renders) ─────────────────────────
let _kistFilter = '';      // zoekterm
let _kistMateriaal = '';   // materiaalgroep
let _kistKleur = '';       // kleurgroep
let _kistPrijs = '';       // prijs-range key
let _kistEco = false;      // alleen eco/duurzaam
let _kistPagina = 1;       // huidige pagina
let _kistWeergave = 'grid';// 'grid' | 'lijst'
const KISTEN_PER_PAGINA = 12;

const KIST_PRIJS_RANGES = [
  { key: '<700',      label: 'tot € 700',         test: b => b < 700 },
  { key: '700-1200',  label: '€ 700 – 1.200',     test: b => b >= 700 && b < 1200 },
  { key: '1200-2000', label: '€ 1.200 – 2.000',   test: b => b >= 1200 && b < 2000 },
  { key: '>2000',     label: 'vanaf € 2.000',     test: b => b >= 2000 },
];

// Materiaal-/kleurgroep afleiden uit de vrije materiaal-tekst
function _kistMateriaalGroep(materiaal) {
  const m = (materiaal || '').toLowerCase();
  if (m.includes('populieren')) return 'Populieren';
  if (m.includes('eiken'))      return 'Eiken';
  if (m.includes('grenen'))     return 'Grenen';
  if (m.includes('vuren'))      return 'Vuren';
  if (m.includes('mahonie'))    return 'Mahonie';
  if (m.includes('rotan'))      return 'Rotan';
  if (m.includes('bamboe'))     return 'Bamboe';
  if (m.includes('wilgen'))     return 'Wilgenteen';
  if (m.includes('manilla') || m.includes('abaca') || m.includes('hennep')) return 'Manillahennep';
  if (m.includes('houtdecor'))  return 'Houtdecor';
  if (m.includes('gelakt') || m.includes('ral')) return 'Gelakt';
  if (m.includes('massief hout')) return 'Massief hout';
  return 'Overig';
}
function _kistKleurGroep(materiaal) {
  const m = (materiaal || '').toLowerCase();
  if (m.includes('wit'))        return 'Wit';
  if (m.includes('zwart'))      return 'Zwart';
  if (m.includes('grijs'))      return 'Grijs';
  if (m.includes('mahonie'))    return 'Donkerbruin';
  if (m.includes('eiken'))      return 'Eikenbruin';
  return 'Naturel';
}
function _kistIsEco(materiaal) {
  const m = (materiaal || '').toLowerCase();
  return m.includes('eco') || m.includes('rotan') || m.includes('bamboe')
      || m.includes('wilgen') || m.includes('manilla') || m.includes('abaca') || m.includes('hennep');
}

// Favorieten (persoonlijk, in localStorage)
function _kistFavs() {
  try { return JSON.parse(localStorage.getItem('sok_kist_favs') || '[]'); } catch (_) { return []; }
}
function _toggleKistFav(naam) {
  const f = _kistFavs();
  const i = f.indexOf(naam);
  if (i >= 0) f.splice(i, 1); else f.push(naam);
  try { localStorage.setItem('sok_kist_favs', JSON.stringify(f)); } catch (_) {}
}

// "Meest gekozen" = de kist die het vaakst in bestaande dossiers voorkomt
function _meestGekozenKist() {
  const tel = {};
  try {
    DB.list(KEYS.DOSSIERS).forEach(d => {
      if (d.kist_type) tel[d.kist_type] = (tel[d.kist_type] || 0) + 1;
    });
  } catch (_) {}
  let best = null, n = 0;
  for (const k in tel) if (tel[k] > n) { n = tel[k]; best = k; }
  return n > 0 ? best : null;
}

function _kistFiltersActief() {
  return !!(_kistFilter || _kistMateriaal || _kistKleur || _kistPrijs || _kistEco);
}

function renderKistenBeheer(msg) {
  const adminMode = !!Settings.get('catalog_admin_mode');
  const drafts = _activeDossierDrafts();
  const hasDraft = drafts.length > 0;
  const favs = _kistFavs();
  const meestGekozen = _meestGekozenKist();

  const bron = effectieveKistenCatalogus({ includeHidden: adminMode });

  // Filters toepassen
  const q = (_kistFilter || '').trim().toLowerCase();
  const prijsRange = KIST_PRIJS_RANGES.find(r => r.key === _kistPrijs);
  const gefilterd = bron.filter(k => {
    if (q && !((k.naam || '').toLowerCase().includes(q) || (k.materiaal || '').toLowerCase().includes(q))) return false;
    if (_kistMateriaal && _kistMateriaalGroep(k.materiaal) !== _kistMateriaal) return false;
    if (_kistKleur && _kistKleurGroep(k.materiaal) !== _kistKleur) return false;
    if (prijsRange && !prijsRange.test(Number(k.bedrag))) return false;
    if (_kistEco && !_kistIsEco(k.materiaal)) return false;
    return true;
  }).sort((a, b) => a.bedrag - b.bedrag);

  // Beschikbare materiaal-/kleurgroepen voor de dropdowns
  const materiaalGroepen = [...new Set(bron.map(k => _kistMateriaalGroep(k.materiaal)))].sort();
  const kleurGroepen = [...new Set(bron.map(k => _kistKleurGroep(k.materiaal)))].sort();

  // Paginering
  const totPaginas = Math.max(1, Math.ceil(gefilterd.length / KISTEN_PER_PAGINA));
  if (_kistPagina > totPaginas) _kistPagina = totPaginas;
  if (_kistPagina < 1) _kistPagina = 1;
  const start = (_kistPagina - 1) * KISTEN_PER_PAGINA;
  const pagina = gefilterd.slice(start, start + KISTEN_PER_PAGINA);

  const kaart = (k) => {
    const url = KistFotos.urlVoor(k.naam);
    const hidden = !!k._hidden;
    const isFav = favs.includes(k.naam);
    const isTop = meestGekozen && k.naam === meestGekozen;
    return `
      <div class="kist-card ${hidden ? 'is-hidden-catalog' : ''}" data-naam="${esc(k.naam)}">
        <div class="kist-card-imgwrap">
          <button type="button" class="kist-card-img kist-card-img-btn" data-action="zoom" data-naam="${esc(k.naam)}" aria-label="Bekijk ${esc(k.naam)}">
            ${url
              ? `<img src="${esc(url)}" alt="${esc(k.naam)}" loading="lazy">`
              : `<div class="kist-card-svg">${kistSVG(k.materiaal)}</div>
                 <div class="kist-card-no-img">geen foto</div>`}
          </button>
          <button type="button" class="kist-fav ${isFav ? 'is-fav' : ''}" data-fav="${esc(k.naam)}" aria-label="${isFav ? 'Verwijder uit favorieten' : 'Voeg toe aan favorieten'}" title="Favoriet">
            ${isFav ? '♥' : '♡'}
          </button>
          ${isTop ? '<span class="kist-badge-top">★ Meest gekozen</span>' : ''}
          ${hidden ? '<span class="kist-hidden-badge">verwijderd</span>' : ''}
        </div>
        <div class="kist-card-body">
          <strong class="kist-card-naam">${esc(k.naam)}</strong>
          <span class="muted small">${esc(k.materiaal)}</span>
          <div class="kist-card-foot">
            <span class="kist-price">${fmtEUR(k.bedrag)}${k._customBedrag ? ' <span class="badge badge-amber" title="Eigen prijs">✏️</span>' : ''}</span>
            ${hidden ? '' : `<button type="button" class="btn btn-sm btn-primary kist-kies-btn" data-pick-kist="${esc(k.naam)}">Kies deze kist</button>`}
          </div>
          ${adminMode ? `
            <div class="kist-card-actions">
              <label class="btn btn-sm">${url ? 'Vervang foto' : 'Foto uploaden'}
                <input type="file" accept="image/*" data-upload="${esc(k.naam)}" hidden>
              </label>
              ${url ? `<button type="button" class="btn btn-sm btn-ghost" data-remove-foto="${esc(k.naam)}">Foto weg</button>` : ''}
            </div>
            <div class="kist-card-actions catalog-edit-row">
              <label class="catalog-price-edit">
                <span class="muted small">Prijs €</span>
                <input type="text" inputmode="decimal" data-edit-price="${esc(k.naam)}" value="${esc((Number(k.bedrag) || 0).toFixed(2).replace('.', ','))}" placeholder="0,00">
              </label>
              <button type="button" class="btn btn-sm" data-save-price="${esc(k.naam)}">Opslaan</button>
              ${k._customBedrag ? `<button type="button" class="btn btn-sm btn-ghost" data-reset-price="${esc(k.naam)}" title="Terug naar standaardprijs">↺ Reset</button>` : ''}
              ${hidden
                ? `<button type="button" class="btn btn-sm btn-ghost" data-show-kist="${esc(k.naam)}">↺ Herstel kist</button>`
                : `<button type="button" class="btn btn-sm btn-ghost btn-danger" data-hide-kist="${esc(k.naam)}">🗑 Verwijder kist</button>`}
            </div>` : ''}
        </div>
      </div>`;
  };

  $('#view').innerHTML = `
    <div class="page">
      <div class="page-head">
        <div>
          <h1>Kisten</h1>
          <p class="muted">Kies de kist die het beste past. Klik op een kist voor meer informatie.${adminMode ? ' <strong>Beheermodus aan.</strong>' : ''}</p>
        </div>
        ${adminMode ? '<span class="badge badge-amber">Beheermodus aan</span>' : ''}
      </div>

      <div class="catalog-zoekbalk">
        <div class="catalog-search">
          <span class="catalog-search-icon">🔍</span>
          <input type="search" id="kist-filter-q" value="${esc(_kistFilter)}" placeholder="Zoek op naam, materiaal of kenmerk…" autocomplete="off">
        </div>
        <button type="button" class="btn catalog-filters-toggle" id="kist-filters-toggle">⛛ Filters</button>
      </div>

      <div class="catalog-chips">
        <select class="catalog-chip" id="kist-f-materiaal">
          <option value="">Materiaal</option>
          ${materiaalGroepen.map(g => `<option value="${esc(g)}" ${_kistMateriaal === g ? 'selected' : ''}>${esc(g)}</option>`).join('')}
        </select>
        <select class="catalog-chip" id="kist-f-kleur">
          <option value="">Kleur</option>
          ${kleurGroepen.map(g => `<option value="${esc(g)}" ${_kistKleur === g ? 'selected' : ''}>${esc(g)}</option>`).join('')}
        </select>
        <select class="catalog-chip" id="kist-f-prijs">
          <option value="">Prijs</option>
          ${KIST_PRIJS_RANGES.map(r => `<option value="${esc(r.key)}" ${_kistPrijs === r.key ? 'selected' : ''}>${esc(r.label)}</option>`).join('')}
        </select>
        <button type="button" class="catalog-chip catalog-chip-toggle ${_kistEco ? 'is-on' : ''}" id="kist-f-eco">🌿 Eco / Duurzaam</button>
        ${_kistFiltersActief() ? '<button type="button" class="catalog-wis" id="kist-filter-clear">↺ Wis filters</button>' : ''}
        <span class="catalog-count">${gefilterd.length} resultaten</span>
        <div class="catalog-view">
          <button type="button" class="catalog-view-btn ${_kistWeergave === 'grid' ? 'is-on' : ''}" data-view="grid" aria-label="Rasterweergave">▦</button>
          <button type="button" class="catalog-view-btn ${_kistWeergave === 'lijst' ? 'is-on' : ''}" data-view="lijst" aria-label="Lijstweergave">☰</button>
        </div>
      </div>

      ${msg && msg.error ? `<div class="alert alert-error">${esc(msg.error)}</div>` : ''}
      ${msg && msg.success ? `<div class="alert alert-success">${esc(msg.success)}</div>` : ''}
      ${hasDraft ? `
        <div class="alert alert-info kist-draft-banner">
          <strong>💡 Actief dossier:</strong>
          ${drafts.length === 1
            ? `<span>${esc(drafts[0].naam)}${drafts[0].kist ? ' — huidige kist: <em>' + esc(drafts[0].kist) + '</em>' : ''}</span>`
            : `<select id="kist-draft-picker">${drafts.map((d, i) => `<option value="${i}">${esc(d.naam)}${d.kist ? ' — ' + esc(d.kist) : ''}</option>`).join('')}</select>`}
          <span class="muted small">— klik op "Kies deze kist" om hem in het dossier te zetten</span>
        </div>` : ''}

      ${gefilterd.length === 0
        ? '<div class="card"><p class="muted center">Geen kisten gevonden met deze filters.</p></div>'
        : `<div class="kist-grid ${_kistWeergave === 'lijst' ? 'is-list' : ''}">
            ${pagina.map(kaart).join('')}
          </div>`}

      ${totPaginas > 1 ? `
        <div class="catalog-paginering">
          <button type="button" class="cat-page-nav" data-page="${_kistPagina - 1}" ${_kistPagina === 1 ? 'disabled' : ''}>‹</button>
          ${Array.from({ length: totPaginas }, (_, i) => i + 1).map(p =>
            `<button type="button" class="cat-page ${p === _kistPagina ? 'is-on' : ''}" data-page="${p}">${p}</button>`).join('')}
          <button type="button" class="cat-page-nav" data-page="${_kistPagina + 1}" ${_kistPagina === totPaginas ? 'disabled' : ''}>›</button>
        </div>` : ''}

      ${adminMode ? '' : `
        <p class="muted small center" style="margin-top:1.5rem;">
          Foto's, prijzen of catalogus beheren? Schakel <strong>Beheermodus</strong> in via <a href="#/account">Account</a>.
        </p>`}
    </div>`;

  // ─── Zoekveld: live met debounce + focusbehoud ─────────────────────────
  let _kistFilterT = null;
  const filterQ = $('#kist-filter-q');
  if (filterQ) {
    filterQ.addEventListener('input', () => {
      _kistFilter = filterQ.value;
      _kistPagina = 1;
      clearTimeout(_kistFilterT);
      _kistFilterT = setTimeout(() => {
        const focusInput = document.activeElement === filterQ;
        const pos = focusInput ? filterQ.selectionStart : null;
        renderKistenBeheer();
        if (focusInput) {
          const newInp = $('#kist-filter-q');
          if (newInp) { newInp.focus(); if (pos != null) newInp.setSelectionRange(pos, pos); }
        }
      }, 150);
    });
  }

  // ─── Dropdown-filters + upload (change-events) ─────────────────────────
  $('#view').onchange = async e => {
    const mat = e.target.closest('#kist-f-materiaal');
    if (mat) { _kistMateriaal = mat.value; _kistPagina = 1; renderKistenBeheer(); return; }
    const kleur = e.target.closest('#kist-f-kleur');
    if (kleur) { _kistKleur = kleur.value; _kistPagina = 1; renderKistenBeheer(); return; }
    const prijs = e.target.closest('#kist-f-prijs');
    if (prijs) { _kistPrijs = prijs.value; _kistPagina = 1; renderKistenBeheer(); return; }

    const inp = e.target.closest('input[data-upload]');
    if (!inp) return;
    const naam = inp.getAttribute('data-upload');
    const file = inp.files[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { renderKistenBeheer({ error: 'Alleen afbeeldingsbestanden toegestaan.' }); return; }
    if (file.size > 5 * 1024 * 1024) { renderKistenBeheer({ error: 'Foto te groot (max. 5 MB).' }); return; }
    const card = $(`.kist-card[data-naam="${CSS.escape(naam)}"]`);
    if (card) card.classList.add('is-uploading');
    try {
      await KistFotos.upload(naam, file);
      renderKistenBeheer({ success: `Foto opgeslagen voor "${naam}".` });
    } catch (_) {
      if (card) card.classList.remove('is-uploading');
    }
  };

  // Helper: muteer Settings.kisten_overrides[naam]
  function _patchKistOverride(naam, patch) {
    const cur = Object.assign({}, Settings.get('kisten_overrides') || {});
    const entry = Object.assign({}, cur[naam] || {}, patch);
    if (entry.bedrag == null) delete entry.bedrag;
    if (!entry.hidden)        delete entry.hidden;
    if (Object.keys(entry).length === 0) delete cur[naam];
    else                                  cur[naam] = entry;
    Settings.set({ kisten_overrides: cur });
  }

  $('#view').onclick = async e => {
    // ── Filters: eco-toggle, wis, weergave, paginering, favoriet ──
    const ecoBtn = e.target.closest('#kist-f-eco');
    if (ecoBtn) { _kistEco = !_kistEco; _kistPagina = 1; renderKistenBeheer(); return; }
    const wisBtn = e.target.closest('#kist-filter-clear');
    if (wisBtn) {
      _kistFilter = ''; _kistMateriaal = ''; _kistKleur = ''; _kistPrijs = ''; _kistEco = false; _kistPagina = 1;
      renderKistenBeheer(); return;
    }
    const filtersToggle = e.target.closest('#kist-filters-toggle');
    if (filtersToggle) {
      const chips = $('.catalog-chips');
      if (chips) chips.classList.toggle('is-collapsed');
      return;
    }
    const viewBtn = e.target.closest('[data-view]');
    if (viewBtn) { _kistWeergave = viewBtn.getAttribute('data-view'); renderKistenBeheer(); return; }
    const pageBtn = e.target.closest('[data-page]');
    if (pageBtn && !pageBtn.disabled) {
      _kistPagina = parseInt(pageBtn.getAttribute('data-page'), 10) || 1;
      renderKistenBeheer();
      const top = $('#view .catalog-zoekbalk');
      if (top) top.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
    const favBtn = e.target.closest('[data-fav]');
    if (favBtn) { _toggleKistFav(favBtn.getAttribute('data-fav')); renderKistenBeheer(); return; }

    // ── Beheermodus: prijs / verwijder / herstel / reset ──
    const savePriceBtn = e.target.closest('button[data-save-price]');
    if (savePriceBtn) {
      const naam = savePriceBtn.getAttribute('data-save-price');
      const inp = $(`input[data-edit-price="${CSS.escape(naam)}"]`);
      if (!inp) return;
      const raw = (inp.value || '').trim();
      let bedrag = parseEUR(raw);
      if (!isFinite(bedrag) || bedrag < 0) {
        Modal.show({ type: 'warning', title: 'Ongeldige prijs', message: 'Vul een geldig bedrag in (bv. 1234,56).' });
        return;
      }
      if (!/[.,]/.test(raw) && bedrag > 9999) {
        const guess = bedrag / 100;
        const ok = await Modal.confirm({
          type: 'warning',
          title: 'Bedoel je €' + guess.toFixed(2).replace('.', ',') + '?',
          message: `Je vulde "${raw}" in zonder komma. Dat lijkt erg veel voor een kist. Klik "Ja" om door te gaan met €${guess.toFixed(2).replace('.', ',')}, of "Nee, ${bedrag.toFixed(2).replace('.', ',')}" om de letterlijke waarde te gebruiken.`,
          confirmText: 'Ja, €' + guess.toFixed(2).replace('.', ','),
          cancelText: 'Nee, ' + bedrag.toFixed(2).replace('.', ','),
        });
        if (ok) bedrag = +guess.toFixed(2);
      }
      _patchKistOverride(naam, { bedrag });
      renderKistenBeheer({ success: `Prijs van "${naam}" opgeslagen: ${fmtEUR(bedrag)}.` });
      return;
    }
    const resetPriceBtn = e.target.closest('button[data-reset-price]');
    if (resetPriceBtn) {
      const naam = resetPriceBtn.getAttribute('data-reset-price');
      _patchKistOverride(naam, { bedrag: null });
      renderKistenBeheer({ success: `Standaardprijs voor "${naam}" hersteld.` });
      return;
    }
    const hideBtn = e.target.closest('button[data-hide-kist]');
    if (hideBtn) {
      const naam = hideBtn.getAttribute('data-hide-kist');
      const ok = await Modal.confirm({
        type: 'warning',
        title: 'Kist verwijderen?',
        message: `"${naam}" wordt definitief uit de catalogus verwijderd. Bestaande dossiers die deze kist gekozen hebben blijven werken. Je kunt verwijderde kisten later eventueel herstellen via de "↺ Herstel"-knop in beheermodus.`,
        confirmText: 'Verwijderen',
        cancelText: 'Annuleren',
      });
      if (!ok) return;
      _patchKistOverride(naam, { hidden: true });
      renderKistenBeheer({ success: `"${naam}" verwijderd uit de catalogus.` });
      return;
    }
    const showBtn = e.target.closest('button[data-show-kist]');
    if (showBtn) {
      const naam = showBtn.getAttribute('data-show-kist');
      _patchKistOverride(naam, { hidden: false });
      renderKistenBeheer({ success: `"${naam}" hersteld in de catalogus.` });
      return;
    }

    // ── Kies kist voor actief dossier ──
    const pickBtn = e.target.closest('button[data-pick-kist]');
    if (pickBtn) {
      const kistNaam = pickBtn.getAttribute('data-pick-kist');
      if (!hasDraft) {
        Modal.show({
          type: 'info',
          title: 'Open eerst een dossier',
          message: `Om "${kistNaam}" te koppelen, open of maak eerst een dossier. Bij de kostenstap kun je dan via deze pagina de kist kiezen.`,
        });
        return;
      }
      const picker = $('#kist-draft-picker');
      const idx = picker ? parseInt(picker.value, 10) : 0;
      const target = drafts[idx];
      if (!target) return;
      const ok = _setKistInDraft(target.key, kistNaam);
      if (!ok) {
        Modal.show({ type: 'error', title: 'Niet gelukt', message: 'Kon de kist niet in het dossier zetten.' });
        return;
      }
      const confirmGo = await Modal.confirm({
        type: 'success',
        title: `"${kistNaam}" gekoppeld`,
        message: `Toegevoegd aan dossier ${target.naam}. Wil je nu terug naar dat dossier?`,
        confirmText: 'Ja, ga terug',
        cancelText: 'Blijf hier',
      });
      if (confirmGo) {
        Router.go(target.isNew ? '/dossiers/nieuw' : '/dossiers/' + target.id + '/bewerken');
      } else {
        renderKistenBeheer({ success: `Kist "${kistNaam}" gekoppeld aan ${target.naam}.` });
      }
      return;
    }

    // ── Klik op afbeelding → lightbox ──
    const zoom = e.target.closest('button[data-action="zoom"]');
    if (zoom) {
      const naam = zoom.getAttribute('data-naam');
      const k = vindKist(naam); if (!k) return;
      Lightbox.show({
        src: KistFotos.urlVoor(k.naam) || null,
        svgFallback: kistSVG(k.materiaal),
        title: k.naam,
        subtitle: k.materiaal,
        price: fmtEUR(k.bedrag),
      });
      return;
    }

    // ── Foto verwijderen ──
    const btn = e.target.closest('button[data-remove-foto]');
    if (!btn) return;
    const naam = btn.getAttribute('data-remove-foto');
    const ok = await Modal.confirm({ title: 'Foto verwijderen?', message: `De foto van "${naam}" wordt definitief verwijderd.`, confirmText: 'Verwijderen' });
    if (!ok) return;
    try {
      await KistFotos.remove(naam);
      renderKistenBeheer({ success: 'Foto verwijderd.' });
    } catch (_) {}
  };
}
