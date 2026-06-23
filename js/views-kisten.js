// Kistenbeheer: per Unigra-model een echte foto uploaden

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

let _kistFilter = '';
let _kistPrijsMax = '';

function renderKistenBeheer(msg) {
  const adminMode = !!Settings.get('catalog_admin_mode');
  const drafts = _activeDossierDrafts();
  const hasDraft = drafts.length > 0;

  const q = (_kistFilter || '').trim().toLowerCase();
  const max = parseFloat(String(_kistPrijsMax).replace(',', '.')) || 0;
  // In beheermodus tonen we ook verborgen kisten (met een 'verborgen'-label)
  // zodat ze terug zichtbaar gemaakt kunnen worden.
  const bron = effectieveKistenCatalogus({ includeHidden: adminMode });
  const items = bron
    .slice()
    .filter(k => {
      if (q && !((k.naam || '').toLowerCase().includes(q) || (k.materiaal || '').toLowerCase().includes(q))) return false;
      if (max > 0 && Number(k.bedrag) > max) return false;
      return true;
    })
    .sort((a, b) => a.bedrag - b.bedrag);
  const totaalCount = bron.length;

  $('#view').innerHTML = `
    <div class="page">
      <div class="page-head">
        <div>
          <h1>Kisten</h1>
          <p class="muted">Klik op een kist voor een grotere afbeelding.${adminMode ? ' Beheermodus aan — je kunt foto\'s vervangen of verwijderen.' : ''}</p>
        </div>
        ${adminMode ? '<span class="badge badge-amber">Beheermodus aan</span>' : ''}
      </div>

      <section class="card catalog-filter-card">
        <div class="catalog-filter">
          <label class="catalog-filter-inline">
            <span class="muted small">Zoek op naam of materiaal</span>
            <input type="search" id="kist-filter-q" value="${esc(_kistFilter)}" placeholder="bv. natuur, eiken, populieren" autocomplete="off">
          </label>
          <label class="catalog-filter-inline">
            <span class="muted small">Max. prijs (€)</span>
            <input type="text" id="kist-filter-max" value="${esc(_kistPrijsMax)}" placeholder="bv. 1000" inputmode="decimal">
          </label>
          ${(_kistFilter || _kistPrijsMax) ? '<button type="button" class="btn btn-sm btn-ghost" id="kist-filter-clear">Wis filter</button>' : ''}
          <span class="muted small catalog-filter-count">${items.length} van ${totaalCount}</span>
        </div>
      </section>
      ${msg && msg.error ? `<div class="alert alert-error">${esc(msg.error)}</div>` : ''}
      ${msg && msg.success ? `<div class="alert alert-success">${esc(msg.success)}</div>` : ''}
      ${hasDraft ? `
        <div class="alert alert-info kist-draft-banner">
          <strong>💡 Actief dossier:</strong>
          ${drafts.length === 1
            ? `<span>${esc(drafts[0].naam)}${drafts[0].kist ? ' — huidige kist: <em>' + esc(drafts[0].kist) + '</em>' : ''}</span>`
            : `<select id="kist-draft-picker">${drafts.map((d, i) => `<option value="${i}">${esc(d.naam)}${d.kist ? ' — ' + esc(d.kist) : ''}</option>`).join('')}</select>`}
          <span class="muted small">— klik op de "Kies"-knop bij een kist om hem in het dossier te zetten</span>
        </div>` : ''}
      <div class="kist-grid">
        ${items.map(k => {
          const url = KistFotos.urlVoor(k.naam);
          const hidden = !!k._hidden;
          return `
            <div class="kist-card ${hidden ? 'is-hidden-catalog' : ''}" data-naam="${esc(k.naam)}">
              <button type="button" class="kist-card-img kist-card-img-btn" data-action="zoom" data-naam="${esc(k.naam)}" aria-label="Vergroot ${esc(k.naam)}">
                ${url
                  ? `<img src="${esc(url)}" alt="${esc(k.naam)}" loading="lazy">`
                  : `<div class="kist-card-svg">${kistSVG(k.materiaal)}</div>
                     <div class="kist-card-no-img">geen foto</div>`}
                ${hidden ? '<span class="kist-hidden-badge">verborgen</span>' : ''}
              </button>
              <div class="kist-card-meta">
                <strong>${esc(k.naam)}</strong>
                <span class="muted small">${esc(k.materiaal)}</span>
                <span class="kist-price">${fmtEUR(k.bedrag)} ${k._customBedrag ? '<span class="badge badge-amber" title="Eigen prijs">✏️</span>' : ''}</span>
              </div>
              ${hasDraft && !hidden ? `
                <div class="kist-card-actions">
                  <button type="button" class="btn btn-sm btn-primary" data-pick-kist="${esc(k.naam)}">✓ Kies voor dossier</button>
                </div>` : ''}
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
                    <input type="text" inputmode="decimal" data-edit-price="${esc(k.naam)}" value="${esc(String(k.bedrag).replace('.', ','))}" placeholder="0,00">
                  </label>
                  <button type="button" class="btn btn-sm" data-save-price="${esc(k.naam)}">Opslaan</button>
                  ${k._customBedrag ? `<button type="button" class="btn btn-sm btn-ghost" data-reset-price="${esc(k.naam)}" title="Terug naar standaardprijs">↺ Reset</button>` : ''}
                  ${hidden
                    ? `<button type="button" class="btn btn-sm btn-ghost" data-show-kist="${esc(k.naam)}">👁 Toon weer</button>`
                    : `<button type="button" class="btn btn-sm btn-ghost" data-hide-kist="${esc(k.naam)}">🗑 Verberg uit catalogus</button>`}
                </div>` : ''}
            </div>`;
        }).join('')}
      </div>
      ${adminMode ? '' : `
        <p class="muted small center" style="margin-top:1.5rem;">
          Foto's vervangen of verwijderen? Schakel <strong>Beheermodus</strong> in via <a href="#/account">Account</a>.
        </p>`}
    </div>`;

  // Filter handlers (live, met kleine debounce)
  let _kistFilterT = null;
  const filterQ = $('#kist-filter-q');
  const filterMax = $('#kist-filter-max');
  const filterClear = $('#kist-filter-clear');
  if (filterQ) {
    filterQ.addEventListener('input', () => {
      _kistFilter = filterQ.value;
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
  if (filterMax) {
    filterMax.addEventListener('input', () => {
      _kistPrijsMax = filterMax.value;
      clearTimeout(_kistFilterT);
      _kistFilterT = setTimeout(() => {
        const focusInput = document.activeElement === filterMax;
        const pos = focusInput ? filterMax.selectionStart : null;
        renderKistenBeheer();
        if (focusInput) {
          const newInp = $('#kist-filter-max');
          if (newInp) { newInp.focus(); if (pos != null) newInp.setSelectionRange(pos, pos); }
        }
      }, 150);
    });
  }
  if (filterClear) {
    filterClear.addEventListener('click', () => {
      _kistFilter = '';
      _kistPrijsMax = '';
      renderKistenBeheer();
    });
  }

  $('#view').onchange = async e => {
    const inp = e.target.closest('input[data-upload]');
    if (!inp) return;
    const naam = inp.getAttribute('data-upload');
    const file = inp.files[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      renderKistenBeheer({ error: 'Alleen afbeeldingsbestanden toegestaan.' });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      renderKistenBeheer({ error: 'Foto te groot (max. 5 MB).' });
      return;
    }
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
    // Cleanup: lege eigenschappen weghalen
    if (entry.bedrag == null) delete entry.bedrag;
    if (!entry.hidden)        delete entry.hidden;
    if (Object.keys(entry).length === 0) delete cur[naam];
    else                                  cur[naam] = entry;
    Settings.set({ kisten_overrides: cur });
  }

  $('#view').onclick = async e => {
    // ── Beheermodus: prijs / verberg / toon-weer / reset ──
    const savePriceBtn = e.target.closest('button[data-save-price]');
    if (savePriceBtn) {
      const naam = savePriceBtn.getAttribute('data-save-price');
      const inp = $(`input[data-edit-price="${CSS.escape(naam)}"]`);
      if (!inp) return;
      const bedrag = parseEUR(inp.value);
      if (!isFinite(bedrag) || bedrag < 0) {
        Modal.show({ type: 'warning', title: 'Ongeldige prijs', message: 'Vul een geldig bedrag in (bv. 1234,56).' });
        return;
      }
      _patchKistOverride(naam, { bedrag });
      renderKistenBeheer({ success: `Prijs van "${naam}" opgeslagen.` });
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
        title: 'Kist verbergen?',
        message: `"${naam}" verdwijnt uit de catalogus. Bestaande dossiers die deze kist gekozen hebben blijven werken; je kunt hem later weer zichtbaar maken in beheermodus.`,
        confirmText: 'Verbergen',
      });
      if (!ok) return;
      _patchKistOverride(naam, { hidden: true });
      renderKistenBeheer({ success: `"${naam}" verborgen uit de catalogus.` });
      return;
    }
    const showBtn = e.target.closest('button[data-show-kist]');
    if (showBtn) {
      const naam = showBtn.getAttribute('data-show-kist');
      _patchKistOverride(naam, { hidden: false });
      renderKistenBeheer({ success: `"${naam}" weer zichtbaar in de catalogus.` });
      return;
    }

    // Kies kist voor actief dossier
    const pickBtn = e.target.closest('button[data-pick-kist]');
    if (pickBtn) {
      const kistNaam = pickBtn.getAttribute('data-pick-kist');
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
    // Klik op afbeelding → lightbox
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
